const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const redis = require('./redis');
const { getLTCPrice } = require('./ltcPoller');

const CART_TTL = 900; // 15 minutes
const LOCK_TTL = 270; // 4.5 minutes (covers 3-min window + buffer)

function parseEmoji(str) {
  const match = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (match) return { animated: !!match[1], name: match[2], id: match[3] };
  return str;
}

function buildCartEmbed(cart) {
  const total = cart.reduce((sum, i) => sum + i.price, 0);
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

// Handles both cape_shop_select (from public stock message) and cape_cart_add_select (from ephemeral cart)
async function handleCapeSelect(interaction) {
  const capeId    = interaction.values[0];
  const userId    = interaction.user.id;
  const fromCart  = interaction.customId === 'cape_cart_add_select';

  const rawCape = await redis.get(`cape:${capeId}`);
  if (!rawCape) {
    const payload = { content: '❌ Cape not found.', embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  const cape = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;

  // Check stock (code count)
  const codeCount = await redis.llen(`cape:${capeId}:codes`);
  if (codeCount <= 0) {
    const payload = { content: `❌ **${cape.name}** is out of stock.`, embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  // Check lock
  const lock = await redis.get(`ltc:lock:${capeId}`);
  if (lock && lock !== userId) {
    const payload = { content: `⏳ **${cape.name}** is currently being purchased. Try again in a moment.`, embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  // Load cart
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

  if (fromCart) {
    return interaction.update({ embeds: [embed], components: [buttons] });
  } else {
    return interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
  }
}

async function handleAddMore(interaction) {
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];
  const inCart  = cart.map(i => i.capeId);

  const options = await buildBrowseDropdown(inCart);

  if (options.length === 0) {
    return interaction.update({
      embeds: [buildCartEmbed(cart)],
      components: [buildCartButtons()],
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cape_cart_add_select')
      .setPlaceholder('Select another cape to add...')
      .addOptions(options)
  );

  return interaction.update({
    embeds: [buildCartEmbed(cart)],
    components: [row],
  });
}

async function handleCheckout(interaction, client) {
  await interaction.deferUpdate();

  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  if (cart.length === 0) {
    return interaction.editReply({ content: 'Your cart is empty.', embeds: [], components: [] });
  }

  // Validate stock and acquire locks
  const locked = [];
  for (const item of cart) {
    const codeCount = await redis.llen(`cape:${item.capeId}:codes`);
    if (codeCount <= 0) {
      // Release any locks we already set this round
      for (const id of locked) await redis.del(`ltc:lock:${id}`);
      return interaction.editReply({
        content: `❌ **${item.name}** just went out of stock. Please remove it from your cart and try again.`,
        embeds: [],
        components: [],
      });
    }

    // SET NX — only lock if no one else holds it
    const acquired = await redis.set(`ltc:lock:${item.capeId}`, userId, { nx: true, ex: LOCK_TTL });
    if (!acquired) {
      const existing = await redis.get(`ltc:lock:${item.capeId}`);
      if (existing !== userId) {
        for (const id of locked) await redis.del(`ltc:lock:${id}`);
        return interaction.editReply({
          content: `⏳ **${item.name}** is currently being purchased by someone else. Try again shortly.`,
          embeds: [],
          components: [],
        });
      }
      // We already hold the lock — extend it
      await redis.expire(`ltc:lock:${item.capeId}`, LOCK_TTL);
    }
    locked.push(item.capeId);
  }

  // Get LTC address
  const ltcAddress = await redis.get('ltc:address');
  if (!ltcAddress) {
    for (const id of locked) await redis.del(`ltc:lock:${id}`);
    return interaction.editReply({ content: '❌ LTC payments are not configured yet. Contact the owner.', embeds: [], components: [] });
  }

  // Fetch LTC price and calculate total
  let ltcPrice;
  try {
    ltcPrice = await getLTCPrice();
  } catch {
    for (const id of locked) await redis.del(`ltc:lock:${id}`);
    return interaction.editReply({ content: '❌ Could not fetch LTC price. Try again in a moment.', embeds: [], components: [] });
  }

  const totalUSD = cart.reduce((sum, i) => sum + i.price, 0);
  const totalLTC = (totalUSD / ltcPrice).toFixed(8);
  const expiresAt = Date.now() + 3 * 60 * 1000;

  // Store pending payment
  const pending = { items: cart, totalUSD, totalLTC: parseFloat(totalLTC), ltcAddress, expiresAt, detectedTxHash: null };
  await redis.set(`ltc:pending:${userId}`, JSON.stringify(pending), { ex: LOCK_TTL + 60 });

  // Clear cart
  await redis.del(`cart:${userId}`);

  const embed = new EmbedBuilder()
    .setTitle('💳 Checkout — Send LTC')
    .setColor(0xF1C40F)
    .addFields(
      ...cart.map(i => ({ name: `${i.emoji} ${i.name}`, value: `$${i.price.toFixed(2)}`, inline: true })),
      { name: '​', value: '​', inline: false },
      { name: '💵 Total (USD)',     value: `**$${totalUSD.toFixed(2)}**`,            inline: true  },
      { name: '🪙 Total (LTC)',     value: `**${totalLTC} LTC**`,                    inline: true  },
      { name: '📬 Send LTC to',    value: `\`\`\`${ltcAddress}\`\`\``,              inline: false },
      { name: '⏰ Time Remaining', value: 'You have **3 minutes** to send payment.', inline: false }
    )
    .setFooter({ text: `1 LTC ≈ $${ltcPrice.toFixed(2)} • Payment detected automatically` })
    .setTimestamp();

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cape_cancel_checkout').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );

  return interaction.editReply({ embeds: [embed], components: [cancelRow] });
}

async function handleCancelCheckout(interaction) {
  const userId  = interaction.user.id;
  const rawPending = await redis.get(`ltc:pending:${userId}`);

  if (rawPending) {
    const pending = typeof rawPending === 'string' ? JSON.parse(rawPending) : rawPending;
    for (const item of pending.items) await redis.del(`ltc:lock:${item.capeId}`);
    await redis.del(`ltc:pending:${userId}`);
  }

  return interaction.update({
    embeds: [new EmbedBuilder().setDescription('❌ Checkout cancelled. Run **/capestock** to browse again.').setColor(0xED4245)],
    components: [],
  });
}

module.exports = { handleCapeSelect, handleAddMore, handleCheckout, handleCancelCheckout };
