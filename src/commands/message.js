const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('message')
    .setDescription('Send an embedded message in this channel'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('message_modal').setTitle('Send Embed Message');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Embed Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(256)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('body')
          .setLabel('Embed Body')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Hex Color (optional, e.g. #FF5733)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('#5865F2')
      )
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const title = interaction.fields.getTextInputValue('title');
    const body = interaction.fields.getTextInputValue('body');
    const colorRaw = (interaction.fields.getTextInputValue('color') || '').replace('#', '');

    let color = 0x5865F2;
    if (/^[0-9a-fA-F]{6}$/.test(colorRaw)) {
      color = parseInt(colorRaw, 16);
    }

    const embed = new EmbedBuilder().setTitle(title).setDescription(body).setColor(color).setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: 'Message sent!', ephemeral: true });
  },
};
