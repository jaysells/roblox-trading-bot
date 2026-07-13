const { SlashCommandBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { isValidLtcAddress, getBotLtcAddress, sendLtc } = require('../utils/ltcWallet');
const { getLTCPrice } = require('../utils/ltcPoller');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tip')
    .setDescription('Send LTC from the bot payout wallet to an address')
    .addStringOption(opt =>
      opt.setName('address')
        .setDescription('LTC destination address')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('amount_usd')
        .setDescription('Amount in USD to send (e.g. 10, 10.50)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('amount_ltc')
        .setDescription('Amount in LTC to send (e.g. 0.05)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
    }

    await interaction.deferReply();

    const toAddress = interaction.options.getString('address').trim();
    const rawUsd = interaction.options.getString('amount_usd');
    const rawLtc = interaction.options.getString('amount_ltc');

    if (!rawUsd && !rawLtc) {
      return interaction.editReply({ content: '**Provide either `amount_usd` or `amount_ltc`.**' });
    }
    if (!isValidLtcAddress(toAddress)) {
      return interaction.editReply({ content: `**Invalid address.** \`${toAddress}\` is not a valid LTC address.` });
    }

    let amountLtc, amountUsd, ltcPrice;

    try {
      ltcPrice = await getLTCPrice();
    } catch (e) {
      ltcPrice = null;
    }

    if (rawLtc) {
      amountLtc = parseFloat(rawLtc.replace(',', '.'));
      if (isNaN(amountLtc) || amountLtc <= 0) {
        return interaction.editReply({ content: '**Invalid LTC amount.**' });
      }
      amountUsd = ltcPrice ? amountLtc * ltcPrice : null;
    } else {
      amountUsd = parseFloat(rawUsd.replace(',', '.'));
      if (isNaN(amountUsd) || amountUsd <= 0) {
        return interaction.editReply({ content: '**Invalid USD amount.**' });
      }
      if (!ltcPrice) {
        return interaction.editReply({ content: '**Failed to fetch the LTC price.** Try again in a moment, or use `amount_ltc` instead.' });
      }
      amountLtc = amountUsd / ltcPrice;
    }

    const botAddress = getBotLtcAddress();
    let txHash;
    try {
      txHash = await sendLtc(toAddress, amountLtc);
    } catch (e) {
      return interaction.editReply({ content: `**Transfer failed:** ${e.message}` });
    }

    const usdPart = amountUsd != null && ltcPrice != null
      ? `$${amountUsd.toFixed(2)} (${amountLtc.toFixed(6)} LTC @ $${ltcPrice.toLocaleString()}/LTC)`
      : `${amountLtc.toFixed(6)} LTC`;

    return interaction.editReply({
      content: `**Sent ${usdPart}**\nTo: \`${toAddress}\`\nFrom: \`${botAddress}\`\nTx: \`${txHash}\``,
    });
  },
};
