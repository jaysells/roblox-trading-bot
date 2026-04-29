const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('View the server FAQ (only visible to you)'),

  async execute(interaction) {
    const content = await redis.get('faq:content');
    if (!content) {
      return interaction.reply({ content: 'No FAQ has been set yet.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Frequently Asked Questions')
      .setDescription(content)
      .setColor(0x5865F2);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
