const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecode')
    .setDescription('Remove a specific code from a cape')
    .addStringOption(o => o.setName('cape_id').setDescription('Cape ID').setRequired(true))
    .addStringOption(o => o.setName('code').setDescription('The code to remove').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const capeId = interaction.options.getString('cape_id').trim();
    const code   = interaction.options.getString('code').trim();

    const rawCape = await redis.get(`cape:${capeId}`);
    if (!rawCape) {
      return interaction.editReply({ content: `No cape found with ID \`${capeId}\`.` });
    }

    const cape    = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;
    const removed = await redis.lrem(`cape:${capeId}:codes`, 0, code);

    if (removed === 0) {
      return interaction.editReply({ content: `Code \`${code}\` not found in **${cape.name}**.` });
    }

    const remaining = await redis.llen(`cape:${capeId}:codes`);
    cape.stock = remaining;
    await redis.set(`cape:${capeId}`, JSON.stringify(cape));

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Code Removed')
          .setColor(0x57F287)
          .addFields(
            { name: 'Cape',           value: `${cape.emoji} ${cape.name}`, inline: true },
            { name: 'Removed Code',   value: `\`${code}\``,                inline: true },
            { name: 'Remaining Stock', value: `${remaining}`,              inline: true }
          ),
      ],
    });
  },
};
