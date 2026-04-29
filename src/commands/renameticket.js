const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('renameticket')
    .setDescription('Rename the current ticket channel'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const ticketData = await redis.get(`ticketchannel:${interaction.channelId}`);
    if (!ticketData) {
      return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('rename_ticket_modal').setTitle('Rename Ticket');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('new_name')
          .setLabel('New channel name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setPlaceholder('e.g. sell-john-rare-item')
      )
    );
    await interaction.showModal(modal);
  },
};
