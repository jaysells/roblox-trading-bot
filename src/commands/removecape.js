const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');
const { updateCapeStockMessage } = require('../utils/ltcPoller');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecape')
    .setDescription('Remove a cape from the shop entirely')
    .addStringOption(o => o.setName('cape_id').setDescription('Cape ID').setRequired(true)),

  async execute(interaction, client) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const capeId = interaction.options.getString('cape_id').trim();

    const rawCape = await redis.get(`cape:${capeId}`);
    if (!rawCape) {
      return interaction.reply({ content: `No cape found with ID \`${capeId}\`.`, ephemeral: true });
    }

    const cape = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;

    await redis.del(`cape:${capeId}`);
    await redis.del(`cape:${capeId}:codes`);
    await redis.srem('capes', capeId);
    await updateCapeStockMessage(client);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Cape Removed')
          .setColor(0xED4245)
          .addFields(
            { name: 'Name', value: `${cape.emoji} ${cape.name}`, inline: true },
            { name: 'ID',   value: `\`${capeId}\``,              inline: true }
          )
          .setFooter({ text: 'Cape and all its codes have been deleted' }),
      ],
      ephemeral: true,
    });
  },
};
