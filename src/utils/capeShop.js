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
const { getLTCPrice, updateCapeStockMessage, LOG_CHANNEL_ID } = require('./ltcPoller');

const CART_LOG_CHANNEL_ID   = '1525417940151701505';
const WALLET_LOG_CHANNEL_ID = '1525417994140913724';

const CART_TTL    = 900;
const PENDING_TTL = 270;

function parseEmoji(str) {
  const match = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (match) return { animated: !!match[1], name: match[2], id: match[3] };
  return str;
}

async function syncStock(capeId) {
  const raw = await redis.get(`cape:${capeId}`);
  if (!raw) return;
  const cape = typeof raw === 'string' ? JSON.parse(raw) : raw;
  cape.stock = await redis.llen(`cape:${capeId}:codes`);
  await redis.set(`cape:${capeId}`, JSON.stringify(cape));
}

function buildCartEmbed(cart) {
  const total  = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const fields = cart.map(i => ({
    name:   `${i.emoji} ${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`,
    value:  `$${(i.price * i.quantity).toFixed(2)}`,
    inline: true,
  }));
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
    new ButtonBuilder().setCustomId('cape_remove_item').setLabel('Remove').setStyle(ButtonStyle.Secondary).setEmoji('➖'),
    new ButtonBuilder().setCustomId('cape_checkout').setLabel('Checkout').setStyle(ButtonStyle.Success).setEmoji('💳'),
    new ButtonBuilder().setCustomId('cape_leave').setLabel('Leave').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );
}

function buildCartRemoveOptions(cart) {
  return [
    ...cart.map(i => ({
      label:       `${i.name} (×${i.quantity})`.slice(0, 100),
      description: `$${(i.price * i.quantity).toFixed(2)} total`,
      value:       i.capeId,
      emoji:       parseEmoji(i.emoji),
    })),
    { label: 'Cancel', description: 'Go back without removing anything', value: 'cape_remove_cancel', emoji: '↩️' },
  ];
}

async function buildBrowseDropdown(excludeIds = []) {
  const capeIds = await redis.smembers('capes');
  const options = [];
  for (const id of capeIds) {
    if (excludeIds.includes(id)) continue;
    const raw = await redis.get(`cape:${id}`);
    if (!raw) continue;
    const cape  = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const stock = await redis.llen(`cape:${id}:codes`);
    if (stock <= 0) continue;
    options.push({
      label:       cape.name.slice(0, 100),
      description: `$${cape.price.toFixed(2)} USD`,
      value:       cape.id,
      emoji:       parseEmoji(cape.emoji),
    });
  }
  return options;
}

function cartLines(cart) {
  return cart.map(i => `${i.emoji} ${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''} — $${(i.price * i.quantity).toFixed(2)}`).join('\n');
}

async function logToChannel(client, channelId, embed) {
  const logChannel = client?.channels.cache.get(channelId);
  if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function logLeftCart(client, userId, cart) {
  await logToChannel(client, CART_LOG_CHANNEL_ID, new EmbedBuilder()
    .setTitle('🚪 Left Shop')
    .setColor(0x2b2d31)
    .addFields(
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Cart', value: cart.length > 0 ? cartLines(cart) : '*(cart was empty)*', inline: false },
    )
    .setTimestamp());
}

async function handleCapeSelect(interaction, client) {
  const capeId   = interaction.values[0];
  const userId   = interaction.user.id;
  const fromCart = interaction.customId === 'cape_cart_add_select';

  if (capeId === 'cape_leave') {
    const rawCart = await redis.get(`cart:${userId}`);
    const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];
    await redis.del(`cart:${userId}`);
    await logLeftCart(client, userId, cart);
    const payload = { embeds: [new EmbedBuilder().setDescription('👋 Come back anytime!').setColor(0x2b2d31)], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  const rawCape = await redis.get(`cape:${capeId}`);
  if (!rawCape) {
    const payload = { content: '❌ Cape not found.', embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }
  const cape = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;

  const liveStock = await redis.llen(`cape:${capeId}:codes`);
  if (liveStock <= 0) {
    const payload = { content: `❌ **${cape.name}** is out of stock.`, embeds: [], components: [], ephemeral: true };
    return fromCart ? interaction.update(payload) : interaction.reply(payload);
  }

  const modal = new ModalBuilder()
    .setCustomId(`cape_qty_modal:${capeId}:${fromCart ? '1' : '0'}`)
    .setTitle(`${cape.name} — Quantity`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel(`How many? (${liveStock} in stock)`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('1')
        .setPlaceholder('1')
    )
  );

  return interaction.showModal(modal);
}

async function handleQuantityModal(interaction, client) {
  const [, capeId, fromCartFlag] = interaction.customId.split(':');
  const fromCart = fromCartFlag === '1';
  const userId   = interaction.user.id;

  const rawCape = await redis.get(`cape:${capeId}`);
  if (!rawCape) {
    return interaction.reply({ content: '❌ Cape not found.', ephemeral: true });
  }
  const cape = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;

  const qty = parseInt(interaction.fields.getTextInputValue('quantity').trim(), 10);
  if (!Number.isInteger(qty) || qty <= 0) {
    return interaction.reply({ content: '❌ Enter a whole number greater than 0.', ephemeral: true });
  }

  const liveStock = await redis.llen(`cape:${capeId}:codes`);
  if (liveStock <= 0) {
    return interaction.reply({ content: `❌ **${cape.name}** is out of stock.`, ephemeral: true });
  }

  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  const existing    = cart.find(i => i.capeId === capeId);
  const currentQty  = existing ? existing.quantity : 0;
  const totalWanted = currentQty + qty;

  if (totalWanted > liveStock) {
    return interaction.reply({
      content: `❌ Only **${liveStock}** of **${cape.name}** available${currentQty > 0 ? ` (you already have ${currentQty} in your cart)` : ''}.`,
      ephemeral: true,
    });
  }

  if (existing) {
    existing.quantity = totalWanted;
  } else {
    cart.push({ capeId: cape.id, name: cape.name, price: cape.price, emoji: cape.emoji, quantity: qty });
  }

  await redis.set(`cart:${userId}`, JSON.stringify(cart), { ex: CART_TTL });

  await logToChannel(client, CART_LOG_CHANNEL_ID, new EmbedBuilder()
    .setTitle('🛒 Added to Cart')
    .setColor(0x5865F2)
    .addFields(
      { name: 'User',  value: `<@${userId}>`, inline: true },
      { name: 'Added', value: `${cape.emoji} ${cape.name} ×${qty}`, inline: true },
      { name: 'Cart',  value: cartLines(cart), inline: false },
    )
    .setTimestamp());

  return fromCart
    ? interaction.update({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()] })
    : interaction.reply({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()], ephemeral: true });
}

async function handleAddMore(interaction) {
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  // Show all capes (including ones already in cart so they can add more quantity)
  const options = await buildBrowseDropdown([]);
  if (options.length === 0) {
    return interaction.update({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()] });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cape_cart_add_select')
      .setPlaceholder('Select a cape to add...')
      .addOptions(options)
  );
  return interaction.update({ embeds: [buildCartEmbed(cart)], components: [row] });
}

async function handleRemoveItem(interaction) {
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  if (cart.length === 0) {
    return interaction.update({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()] });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cape_remove_select')
      .setPlaceholder('Select an item to remove...')
      .addOptions(buildCartRemoveOptions(cart))
  );
  return interaction.update({ embeds: [buildCartEmbed(cart)], components: [row] });
}

async function handleRemoveSelect(interaction, client) {
  const capeId  = interaction.values[0];
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  if (capeId === 'cape_remove_cancel') {
    return interaction.update({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()] });
  }

  const idx = cart.findIndex(i => i.capeId === capeId);
  if (idx === -1) {
    return interaction.update({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()] });
  }
  const [removed] = cart.splice(idx, 1);

  if (cart.length === 0) {
    await redis.del(`cart:${userId}`);
  } else {
    await redis.set(`cart:${userId}`, JSON.stringify(cart), { ex: CART_TTL });
  }

  await logToChannel(client, CART_LOG_CHANNEL_ID, new EmbedBuilder()
    .setTitle('➖ Removed from Cart')
    .setColor(0xED4245)
    .addFields(
      { name: 'User',    value: `<@${userId}>`, inline: true },
      { name: 'Removed', value: `${removed.emoji} ${removed.name} ×${removed.quantity}`, inline: true },
      { name: 'Cart',    value: cart.length > 0 ? cartLines(cart) : '*(now empty)*', inline: false },
    )
    .setTimestamp());

  if (cart.length === 0) {
    return interaction.update({
      embeds: [new EmbedBuilder().setDescription('🛒 Your cart is now empty.').setColor(0x2b2d31)],
      components: [],
    });
  }

  return interaction.update({ embeds: [buildCartEmbed(cart)], components: [buildCartButtons()] });
}

async function handleSetWalletButton(interaction) {
  const current = await redis.get(`userltc:${interaction.user.id}`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cape_wallet_view').setLabel('View').setStyle(ButtonStyle.Secondary).setEmoji('👁️'),
    new ButtonBuilder().setCustomId('cape_wallet_change').setLabel(current ? 'Change' : 'Set').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
  );

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('👛 Your LTC Wallet')
        .setColor(0x5865F2)
        .setDescription(current
          ? 'You have a wallet on file. Use the buttons below to view or change it.'
          : 'You haven\'t set a wallet yet. Press **Set** to register the address you\'ll pay from.'),
    ],
    components: [row],
    ephemeral: true,
  });
}

async function handleWalletView(interaction, client) {
  const userId  = interaction.user.id;
  const current = await redis.get(`userltc:${userId}`);

  if (!current) {
    return interaction.reply({ content: 'You haven\'t set a wallet yet.', ephemeral: true });
  }

  await logToChannel(client, WALLET_LOG_CHANNEL_ID, new EmbedBuilder()
    .setTitle('👁️ Wallet Viewed')
    .setColor(0x5865F2)
    .addFields(
      { name: 'User',   value: `<@${userId}>`, inline: true },
      { name: 'Wallet', value: `\`${current}\``, inline: true },
    )
    .setTimestamp());

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('👁️ Your LTC Wallet')
        .setColor(0x5865F2)
        .addFields({ name: 'Address', value: `\`${current}\`` }),
    ],
    ephemeral: true,
  });
}

async function handleWalletChange(interaction) {
  const current = await redis.get(`userltc:${interaction.user.id}`);

  const modal = new ModalBuilder()
    .setCustomId('cape_set_wallet_modal')
    .setTitle('Set Your LTC Wallet');

  const input = new TextInputBuilder()
    .setCustomId('wallet_address')
    .setLabel('LTC address you will pay from')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('ltc1q...');
  if (current) input.setValue(current);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return interaction.showModal(modal);
}

async function handleSetWalletModal(interaction, client) {
  const userId  = interaction.user.id;
  const address = interaction.fields.getTextInputValue('wallet_address').trim();
  const old     = await redis.get(`userltc:${userId}`);

  await redis.set(`userltc:${userId}`, address);

  await logToChannel(client, WALLET_LOG_CHANNEL_ID, new EmbedBuilder()
    .setTitle('✏️ Wallet Changed')
    .setColor(0x57F287)
    .addFields(
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Old',  value: old ? `\`${old}\`` : '*(none)*', inline: true },
      { name: 'New',  value: `\`${address}\``, inline: true },
    )
    .setTimestamp());

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('✅ Wallet Registered')
        .setColor(0x57F287)
        .addFields({ name: 'Your LTC address', value: `\`${address}\`` })
        .setFooter({ text: 'Cape shop payments must be sent from this address • Press the wallet button anytime to view or change it' }),
    ],
    ephemeral: true,
  });
}

async function handleCheckout(interaction) {
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  if (cart.length === 0) {
    return interaction.update({ content: 'Your cart is empty.', embeds: [], components: [] });
  }

  const registeredWallet = await redis.get(`userltc:${userId}`);
  if (!registeredWallet) {
    return interaction.reply({
      content: '❌ You need to set your LTC wallet first. Press the **👛 Set Wallet** button on the shop panel, then click Checkout again.',
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('cape_checkout_modal')
    .setTitle('Checkout');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('discount_code')
        .setLabel('Discount code (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('e.g. SUMMER10')
    )
  );

  return interaction.showModal(modal);
}

async function handleCheckoutModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });

  const userId        = interaction.user.id;
  const buyerAddress  = await redis.get(`userltc:${userId}`);
  const discountInput = (interaction.fields.getTextInputValue('discount_code') || '').toUpperCase().trim();

  if (!buyerAddress) {
    return interaction.editReply({ content: '❌ You need to set your LTC wallet first. Press the **👛 Set Wallet** button on the shop panel.' });
  }

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

  // Validate and apply discount code
  let discount     = null;
  let discountText = null;
  if (discountInput) {
    const rawDiscount = await redis.get(`discount:${discountInput}`);
    if (!rawDiscount) {
      return interaction.editReply({ content: `❌ Discount code \`${discountInput}\` is invalid.` });
    }
    discount = typeof rawDiscount === 'string' ? JSON.parse(rawDiscount) : rawDiscount;
    if (discount.unlimited) {
      if (Date.now() > discount.expiresAt) {
        return interaction.editReply({ content: `❌ Discount code \`${discountInput}\` has expired.` });
      }
    } else if (discount.usesLeft <= 0) {
      return interaction.editReply({ content: `❌ Discount code \`${discountInput}\` has no uses remaining.` });
    }
  }

  // Reserve codes immediately via atomic lpop
  const reservedCodes = [];
  for (const item of cart) {
    for (let q = 0; q < item.quantity; q++) {
      const code = await redis.lpop(`cape:${item.capeId}:codes`);
      if (!code) {
        for (const r of reservedCodes) {
          await redis.rpush(`cape:${r.capeId}:codes`, r.code);
          await syncStock(r.capeId);
        }
        await updateCapeStockMessage(client);
        return interaction.editReply({ content: `❌ **${item.name}** just went out of stock. Please update your cart.` });
      }
      reservedCodes.push({ capeId: item.capeId, name: item.name, emoji: item.emoji, code });
    }
    await syncStock(item.capeId);
  }

  await updateCapeStockMessage(client);

  // Calculate totals
  let totalUSD = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  let discountAmount = 0;

  if (discount) {
    if (discount.type === 'percent') {
      discountAmount = totalUSD * (discount.value / 100);
    } else {
      discountAmount = Math.min(discount.value, totalUSD - 0.01);
    }
    totalUSD      = Math.max(0.01, totalUSD - discountAmount);
    discountText  = discount.type === 'percent'
      ? `${discount.value}% off (-$${discountAmount.toFixed(2)})`
      : `$${discount.value.toFixed(2)} off`;

    // Decrement uses (unlimited codes just expire, no count to track)
    if (!discount.unlimited) {
      discount.usesLeft = Math.max(0, discount.usesLeft - 1);
      await redis.set(`discount:${discount.code}`, JSON.stringify(discount));
    }
  }

  const totalLTC  = (totalUSD / ltcPrice).toFixed(8);
  const now       = Date.now();
  const expiresAt = now + 3 * 60 * 1000;

  const pending = {
    items: cart,
    reservedCodes,
    buyerLtcAddress: buyerAddress,
    totalUSD,
    totalLTC: parseFloat(totalLTC),
    ltcPriceAtCheckout: ltcPrice,
    ltcAddress,
    createdAt: now,
    expiresAt,
    detectedTxHash: null,
    discountCode: discount ? discount.code : null,
  };

  await redis.set(`ltc:pending:${userId}`, JSON.stringify(pending), { ex: PENDING_TTL });
  await redis.del(`cart:${userId}`);

  await logToChannel(client, LOG_CHANNEL_ID, new EmbedBuilder()
    .setTitle('🧾 Checkout Started')
    .setColor(0xF1C40F)
    .addFields(
      { name: 'User',   value: `<@${userId}>`, inline: true },
      { name: 'Wallet', value: `\`${buyerAddress}\``, inline: true },
      { name: 'Total',  value: `$${totalUSD.toFixed(2)} | ${totalLTC} LTC`, inline: true },
      { name: 'Cart',   value: cartLines(cart), inline: false },
    )
    .setFooter({ text: '3-minute payment window' })
    .setTimestamp());

  const fields = [
    ...cart.map(i => ({
      name:   `${i.emoji} ${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`,
      value:  `$${(i.price * i.quantity).toFixed(2)}`,
      inline: true,
    })),
    { name: '​', value: '​', inline: false },
  ];

  if (discount) {
    fields.push({ name: '🏷️ Discount', value: `\`${discount.code}\` — ${discountText}`, inline: false });
  }

  fields.push(
    { name: '💵 Total (USD)',    value: `**$${totalUSD.toFixed(2)}**`,             inline: true  },
    { name: '🪙 Total (LTC)',    value: `\`\`\`${totalLTC}\`\`\``,                 inline: true  },
    { name: '📬 Send LTC to',   value: `\`\`\`${ltcAddress}\`\`\``,               inline: false },
    { name: '👛 Sending From',   value: `\`${buyerAddress}\``,                     inline: false },
    { name: '⏰ Time Remaining', value: 'You have **3 minutes** to send payment.', inline: false }
  );

  const embed = new EmbedBuilder()
    .setTitle('💳 Checkout — Send LTC')
    .setColor(0xF1C40F)
    .addFields(fields)
    .setFooter({ text: `1 LTC ≈ $${ltcPrice.toFixed(2)} • Detected from your wallet automatically` })
    .setTimestamp();

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cape_cancel_checkout').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );

  return interaction.editReply({ embeds: [embed], components: [cancelRow] });
}

async function handleCancelCheckout(interaction, client) {
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
    // Refund discount use if it was consumed (unlimited codes don't track uses)
    if (pending.discountCode) {
      const rawDiscount = await redis.get(`discount:${pending.discountCode}`);
      if (rawDiscount) {
        const discount = typeof rawDiscount === 'string' ? JSON.parse(rawDiscount) : rawDiscount;
        if (!discount.unlimited) {
          discount.usesLeft = Math.min(discount.uses, discount.usesLeft + 1);
          await redis.set(`discount:${pending.discountCode}`, JSON.stringify(discount));
        }
      }
    }
    await redis.del(`ltc:pending:${userId}`);
    await updateCapeStockMessage(client);

    await logToChannel(client, LOG_CHANNEL_ID, new EmbedBuilder()
      .setTitle('❌ Checkout Cancelled')
      .setColor(0xED4245)
      .addFields(
        { name: 'User',  value: `<@${userId}>`, inline: true },
        { name: 'Total', value: `$${pending.totalUSD.toFixed(2)} | ${pending.totalLTC} LTC`, inline: true },
        { name: 'Cart',  value: cartLines(pending.items), inline: false },
      )
      .setTimestamp());
  }

  return interaction.update({
    embeds: [new EmbedBuilder().setDescription('❌ Checkout cancelled.').setColor(0xED4245)],
    components: [],
  });
}

async function handleLeave(interaction, client) {
  const userId  = interaction.user.id;
  const rawCart = await redis.get(`cart:${userId}`);
  const cart    = rawCart ? (typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart) : [];

  await redis.del(`cart:${userId}`);
  await logLeftCart(client, userId, cart);

  return interaction.update({
    embeds: [new EmbedBuilder().setDescription('👋 Come back anytime!').setColor(0x2b2d31)],
    components: [],
  });
}

module.exports = {
  handleCapeSelect,
  handleAddMore,
  handleRemoveItem,
  handleRemoveSelect,
  handleCheckout,
  handleCheckoutModal,
  handleCancelCheckout,
  handleLeave,
  handleSetWalletButton,
  handleWalletView,
  handleWalletChange,
  handleSetWalletModal,
  handleQuantityModal,
};
