const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const redis = require('./redis');
const { getLTCPrice } = require('./ltcPoller');

const CART_TTL    = 900; // 15 min
const PENDING_TTL = 270; // 4.5 min (covers 3-min window + buffer)

function parseEmoji(str) {
  const match = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (match) return { animated: !!match[1], name: match[2], id: match[3] };
  return str;
}

function buildCartEmbed(cart) {
  const total  = cart.reduce((sum, i) => sum + i.price, 0);
  const fields = cart.map(i => ({ name: `${i.emoji} ${i.name}`, value: `$${i.price.toFixed(2)}`, inline: true }));
  fields.push({ name: '💵 Total', value: `**$${total.toFixed(2)} USD**`, inline: false });
  return new EmbedBuilder()
    .setTitle('🛒 Your Cart')
    .setColor(0x5865F2)
    .addFields(fields)
    .setFooter({ text: 'Checkout with LTC • 3-minute payment window' });
}

function buildCartButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cape_add_more').setLabel('Add More').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
    new ButtonBuilder().setCustomId('cape_checkout').setLabel('Checkout').setStyle(ButtonStyle.Success).setEmoji('💳'),
    new ButtonBuilder().setCustomId('cape_leave').setLabel('Leave').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );
}

async function buildBrowseDropdown(excludeIds = []) {
  const capeIds = await redis.smembers('capes');
  const options = [];
  for (const id of capeIds) {
    if (excludeIds.includes(id)) continue;
    const raw = await redis.get(`cape:${id}`);
    if (!raw) continue;
    const cape = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (cape.stock <= 0) continue;
    options.push({
      label: cape.name.slice(0, 100),
      description: `$${cape.price.toFixed(2)} USD`,
      value: cape.id,
      emoji: parseEmoji(cape.emoji),
    });
  }
  return options;
}

async function handleCapeSelect(interaction) {
  const capeId   = interaction.values[0];
  const userId   = interaction.user.id;
  const fromCart = interaction.customId === 'cape_cart_add_select';

  if (capeId === 'cape_leave') {
    await redis.del(`cart:${userId}`);
    const payload = { embeds: [new EmbedBuilder().setDescription('👋 Come back anytime!').setColor(0x2b2d31)], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  const rawCape = await redis.get(`cape:${capeId}`);
  if (!rawCape) {
    const payload = { content: '❌ Cape not found.', embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }
  const cape = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;

  if (cape.stock <= 0) {
    const payload = { content: `❌ **${cape.name}** is out of stock.`, embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  if (cart.find(i => i.capeId === capeId)) {
    const payload = { content: `**${cape.name}** is already in your cart.`, embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  cart.push({ capeId: cape.id, name: cape.name, price: cape.price, emoji: cape.emoji });
  await redis.set(`cart:${userId}`, JSON.stringify(cart), { ex: CART_TTL });

  const embed   = buildCartEmbed(cart);
  const buttons = buildCartButtons();

  return fromCart
    ? interaction.update({ embeds: [embed], components: [buttons] })
    : interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

async function handleAddMore(interaction) {
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];
  const inCart  = cart.map(i => i.capeId);

  const options = await buildBrowseDropdown(inCart);
  if (options.length === 0) {
    return interaction.update({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()] });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cape_cart_add_select')
      .setPlaceholder('Select another cape...')
      .addOptions(options)
  );
  return interaction.update({ embeds: [buildCartEmbed(cart)], components: [row] });
}

// Button click — show modal asking for their LTC wallet address
async function handleCheckout(interaction) {
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  if (cart.length === 0) {
    return interaction.update({ content: 'Your cart is empty.', embeds: [], components: [] });
  }

  const modal = new ModalBuilder()
    .setCustomId('cape_checkout_modal')
    .setTitle('Your LTC Wallet');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ltc_wallet')
        .setLabel('LTC address you are SENDING FROM')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('ltc1q...')
    )
  );

  return interaction.showModal(modal);
}

// Modal submit — reserve codes and show payment info
async function handleCheckoutModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const userId       = interaction.user.id;
  const buyerAddress = interaction.fields.getTextInputValue('ltc_wallet').trim();

  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  if (cart.length === 0) {
    return interaction.editReply({ content: 'Your cart expired. Please browse again.' });
  }

  const ltcAddress = await redis.get('ltc:address');
  if (!ltcAddress) {
    return interaction.editReply({ content: '❌ LTC payments are not configured yet. Contact the owner.' });
  }

  let ltcPrice;
  try {
    ltcPrice = await getLTCPrice();
  } catch {
    return interaction.editReply({ content: '❌ Could not fetch LTC price. Try again in a moment.' });
  }

  // Reserve codes immediately (atomic lpop)
  const reservedCodes = [];
  for (const item of cart) {
    const code = await redis.lpop(`cape:${item.capeId}:codes`);
    if (!code) {
      // Return any already reserved codes back to the pool
      for (const r of reservedCodes) {
        await redis.rpush(`cape:${r.capeId}:codes`, r.code);
        await syncStock(r.capeId);
      }
      return interaction.editReply({ content: `❌ **${item.name}** just went out of stock. Please update your cart.` });
    }
    reservedCodes.push({ capeId: item.capeId, name: item.name, emoji: item.emoji, code });
    await syncStock(item.capeId);
  }

  const totalUSD  = cart.reduce((sum, i) => sum + i.price, 0);
  const totalLTC  = (totalUSD / ltcPrice).toFixed(8);
  const expiresAt = Date.now() + 3 * 60 * 1000;

  const pending = {
    items: cart,
    reservedCodes,
    buyerLtcAddress: buyerAddress,
    totalUSD,
    totalLTC: parseFloat(totalLTC),
    ltcAddress,
    createdAt: Date.now(),
    expiresAt,
    detectedTxHash: null,
  };

  await redis.set(`ltc:pending:${userId}`, JSON.stringify(pending), { ex: PENDING_TTL });
  await redis.del(`cart:${userId}`);

  const embed = new EmbedBuilder()
    .setTitle('💳 Checkout — Send LTC')
    .setColor(0xF1C40F)
    .addFields(
      ...cart.map(i => ({ name: `${i.emoji} ${i.name}`, value: `$${i.price.toFixed(2)}`, inline: true })),
      { name: '​', value: '​', inline: false },
      { name: '💵 Total (USD)',    value: `**$${totalUSD.toFixed(2)}**`,            inline: true  },
      { name: '🪙 Total (LTC)',    value: `**${totalLTC} LTC**`,                    inline: true  },
      { name: '📬 Send LTC to',   value: `\`\`\`${ltcAddress}\`\`\``,              inline: false },
      { name: '👛 Sending From',   value: `\`${buyerAddress}\``,                    inline: false },
      { name: '⏰ Time Remaining', value: 'You have **3 minutes** to send payment.', inline: false }
    )
    .setFooter({ text: `1 LTC ≈ $${ltcPrice.toFixed(2)} • Detected from your wallet automatically` })
    .setTimestamp();

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cape_cancel_checkout').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );

  return interaction.editReply({ embeds: [embed], components: [cancelRow] });
}

async function handleCancelCheckout(interaction) {
  const userId     = interaction.user.id;
  const rawPending = await redis.get(`ltc:pending:${userId}`);

  if (rawPending) {
    const pending = typeof rawPending === 'string' ? JSON.parse(rawPending) : rawPending;
    if (pending.reservedCodes) {
      for (const r of pending.reservedCodes) {
        await redis.rpush(`cape:${r.capeId}:codes`, r.code);
        await syncStock(r.capeId);
      }
    }
    await redis.del(`ltc:pending:${userId}`);
  }

  return interaction.update({
    embeds: [new EmbedBuilder().setDescription('❌ Checkout cancelled.').setColor(0xED4245)],
    components: [],
  });
}

async function handleLeave(interaction) {
  await redis.del(`cart:${interaction.user.id}`);
  return interaction.update({
    embeds: [new EmbedBuilder().setDescription('👋 Come back anytime!').setColor(0x2b2d31)],
    components: [],
  });
}

// Syncs cape.stock to actual Redis list length
async function syncStock(capeId) {
  const raw = await redis.get(`cape:${capeId}`);
  if (!raw) return;
  const cape = typeof raw === 'string' ? JSON.parse(raw) : raw;
  cape.stock = await redis.llen(`cape:${capeId}:codes`);
  await redis.set(`cape:${capeId}`, JSON.stringify(cape));
}

module.exports = { handleCapeSelect, handleAddMore, handleCheckout, handleCheckoutModal, handleCancelCheckout, handleLeave, syncStock };
