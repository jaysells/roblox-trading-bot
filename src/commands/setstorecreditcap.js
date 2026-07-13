const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { getStoreCreditCap, setStoreCreditCap } = require('../utils/storeCredit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstorecreditcap')
    .setDescription('Set (or clear) the max store credit balance a member can hold from invite claims')
    .addNumberOption(o =>
      o.setName('amount')
        .setDescription('Max dollar balance (omit to remove the cap entirely)')
        .setRequired(false)
        .setMinValue(0)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const amount = interaction.options.getNumber('amount');

    if (amount == null) {
      await setStoreCreditCap(null);
      return interaction.reply({ content: '✅ Store credit cap removed — claims are now unlimited.', ephemeral: true });
    }

    const cents = Math.round(amount * 100);
    await setStoreCreditCap(cents);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Store Credit Cap Updated')
          .setColor(0x57F287)
          .addFields({ name: 'Max Balance', value: `$${amount.toFixed(2)}` })
          .setFooter({ text: 'Invite claims that would exceed this are rejected, not partially fulfilled' }),
      ],
      ephemeral: true,
    });
  },
};
