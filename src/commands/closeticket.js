const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('closeticket')
    .setDescription('Close the current ticket channel'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    let ticketData = await redis.get(`ticketchannel:${interaction.channelId}`);

    // Fallback: if Redis key is missing, check the channel topic (format: "userId:type")
    if (!ticketData) {
      const topic = interaction.channel.topic;
      if (topic && /^[0-9]+:[a-z]+$/i.test(topic)) {
        ticketData = topic;
        // Restore the Redis key so future lookups work
        await redis.set(`ticketchannel:${interaction.channelId}`, ticketData);
      } else {
        return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
      }
    }

    const modal = new ModalBuilder().setCustomId('close_ticket_modal').setTitle('Close Ticket');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('close_reason')
          .setLabel('Reason for closing')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
      )
    );
    await interaction.showModal(modal);
  },
};
