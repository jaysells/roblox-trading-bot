const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewdiscounts')
    .setDescription('View all active discount codes'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const keys = await redis.keys('discount:*');
    if (!keys || keys.length === 0) {
      return interaction.editReply({ content: 'No discount codes exist.' });
    }

    const fields = [];
    for (const key of keys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const d     = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const value = d.type === 'percent' ? `${d.value}% off` : `$${d.value.toFixed(2)} off`;
      fields.push({
        name:   `\`${d.code}\``,
        value:  `${value}\n${d.usesLeft} use${d.usesLeft !== 1 ? 's' : ''} remaining`,
        inline: true,
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🏷️ Discount Codes')
          .setColor(0x5865F2)
          .addFields(fields)
          .setTimestamp(),
      ],
    });
  },
};
