const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { getStoreCreditCents, addStoreCreditCents } = require('../utils/storeCredit');
const { LOG_CHANNEL_ID } = require('../utils/ltcPoller');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstorecredit')
    .setDescription('Add to (or subtract from) a member\'s store credit balance')
    .addUserOption(o => o.setName('user').setDescription('Member to adjust').setRequired(true))
    .addNumberOption(o => o.setName('amount').setDescription('Dollar amount to add — use a negative number to subtract').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');

    if (amount === 0) {
      return interaction.reply({ content: 'Amount cannot be 0.', ephemeral: true });
    }

    const cents = Math.round(amount * 100);
    await addStoreCreditCents(target.id, cents);
    const newBalance = await getStoreCreditCents(target.id);

    const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🛠️ Store Credit Manually Adjusted')
            .setColor(0xF1C40F)
            .addFields(
              { name: 'Staff',  value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Target', value: `<@${target.id}>`,           inline: true },
              { name: 'Change', value: `${amount > 0 ? '+' : ''}$${amount.toFixed(2)}`, inline: true },
            )
            .setTimestamp(),
        ],
      }).catch(() => {});
    }

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Store Credit Adjusted')
          .setColor(0x57F287)
          .addFields(
            { name: 'User',        value: `<@${target.id}>`, inline: true },
            { name: 'Change',      value: `${amount > 0 ? '+' : ''}$${amount.toFixed(2)}`, inline: true },
            { name: 'New Balance', value: `$${(newBalance / 100).toFixed(2)}`, inline: true },
          ),
      ],
      ephemeral: true,
    });
  },
};
