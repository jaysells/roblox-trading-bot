const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { getSpendLimitUsd, setSpendLimitUsd, getSpentTotalUsd } = require('../utils/ltcWallet');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setltcspendlimit')
    .setDescription('Set (or clear) the overall max USD that can ever be sent out via LTC')
    .addNumberOption(o =>
      o.setName('amount')
        .setDescription('Max total USD ever (omit to remove the limit)')
        .setRequired(false)
        .setMinValue(0)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const amount = interaction.options.getNumber('amount');

    if (amount == null) {
      await setSpendLimitUsd(null);
      return interaction.reply({ content: '✅ LTC spend limit removed — sends are now unlimited.', ephemeral: true });
    }

    await setSpendLimitUsd(amount);
    const spentTotal = await getSpentTotalUsd();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ LTC Spend Limit Updated')
          .setColor(0x57F287)
          .addFields(
            { name: 'Overall Limit', value: `$${amount.toFixed(2)}`, inline: true },
            { name: 'Sent So Far',   value: `$${spentTotal.toFixed(2)}`, inline: true },
          )
          .setFooter({ text: 'Applies to /tip and automatic invite-reward payouts combined — does not reset; raise the limit to allow more' }),
      ],
      ephemeral: true,
    });
  },
};
