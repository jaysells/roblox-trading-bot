const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removediscount')
    .setDescription('Remove a discount code')
    .addStringOption(o => o.setName('code').setDescription('The discount code to remove').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const code = interaction.options.getString('code').toUpperCase().trim();

    const existing = await redis.get(`discount:${code}`);
    if (!existing) {
      return interaction.reply({ content: `Discount code \`${code}\` not found.`, ephemeral: true });
    }

    await redis.del(`discount:${code}`);
    await redis.del(`discount:${code}:usesleft`);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Discount Code Removed')
          .setColor(0xED4245)
          .addFields({ name: 'Code', value: `\`${code}\`` }),
      ],
      ephemeral: true,
    });
  },
};
