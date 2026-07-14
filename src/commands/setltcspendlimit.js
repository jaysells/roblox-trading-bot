const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { getSpendLimitUsd, setSpendLimitUsd, getSpentTodayUsd } = require('../utils/ltcWallet');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setltcspendlimit')
    .setDescription('Set (or clear) the max USD that can be sent out via LTC per day')
    .addNumberOption(o =>
      o.setName('amount')
        .setDescription('Max USD per day (omit to remove the limit)')
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
      return interaction.reply({ content: '✅ LTC daily spend limit removed — sends are now unlimited.', ephemeral: true });
    }

    await setSpendLimitUsd(amount);
    const spentToday = await getSpentTodayUsd();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ LTC Daily Spend Limit Updated')
          .setColor(0x57F287)
          .addFields(
            { name: 'Daily Limit', value: `$${amount.toFixed(2)}`, inline: true },
            { name: 'Spent Today', value: `$${spentToday.toFixed(2)}`, inline: true },
          )
          .setFooter({ text: 'Applies to /tip and automatic invite-reward payouts combined, resets daily (UTC)' }),
      ],
      ephemeral: true,
    });
  },
};
