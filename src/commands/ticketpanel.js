const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { hasPermission } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post the ticket panel in this channel'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 Open a Ticket')
      .setDescription('Select a category below to open a private ticket with our team.')
      .setColor(0x5865F2)
      .addFields(
        { name: '💸 Sell', value: 'Sell your Roblox items for real money', inline: true },
        { name: '💰 Buy', value: 'Buy Roblox items from us for real money', inline: true },
        { name: '🎉 Giveaway Claim', value: 'Claim your giveaway prize', inline: true },
        { name: '🛠️ Support', value: 'Get help or ask about anything regarding the server', inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_sell').setLabel('Sell').setStyle(ButtonStyle.Success).setEmoji('💸'),
      new ButtonBuilder().setCustomId('ticket_buy').setLabel('Buy').setStyle(ButtonStyle.Danger).setEmoji('💰'),
      new ButtonBuilder().setCustomId('ticket_giveaway').setLabel('Giveaway Claim').setStyle(ButtonStyle.Primary).setEmoji('🎉'),
      new ButtonBuilder().setCustomId('ticket_support').setLabel('Support').setStyle(ButtonStyle.Secondary).setEmoji('🛠️')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Ticket panel posted!', ephemeral: true });
  },
};
