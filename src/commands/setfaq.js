const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setfaq')
    .setDescription('Set the server FAQ content'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('setfaq_modal').setTitle('Set FAQ');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('faq_content')
          .setLabel('FAQ Content')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000)
      )
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const content = interaction.fields.getTextInputValue('faq_content');
    await redis.set('faq:content', content);
    await interaction.reply({ content: 'FAQ updated successfully!', ephemeral: true });
  },
};
