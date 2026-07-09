const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearcodes')
    .setDescription('Remove all redemption codes from a cape')
    .addStringOption(o => o.setName('cape_id').setDescription('Cape ID').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const capeId = interaction.options.getString('cape_id').trim();

    const rawCape = await redis.get(`cape:${capeId}`);
    if (!rawCape) {
      return interaction.reply({ content: `No cape found with ID \`${capeId}\`.`, ephemeral: true });
    }

    const cape  = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;
    const count = await redis.llen(`cape:${capeId}:codes`);

    await redis.del(`cape:${capeId}:codes`);
    cape.stock = 0;
    await redis.set(`cape:${capeId}`, JSON.stringify(cape));

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Codes Cleared')
          .setColor(0xED4245)
          .addFields(
            { name: 'Cape',    value: `${cape.emoji} ${cape.name}`, inline: true },
            { name: 'Removed', value: `${count} code(s)`,           inline: true }
          ),
      ],
      ephemeral: true,
    });
  },
};
