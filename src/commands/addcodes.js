const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcodes')
    .setDescription('Add redemption codes to a cape')
    .addStringOption(o => o.setName('cape_id').setDescription('Cape ID (shown when you ran /addcape)').setRequired(true))
    .addStringOption(o => o.setName('codes').setDescription('Comma-separated codes').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const capeId   = interaction.options.getString('cape_id').trim();
    const codesRaw = interaction.options.getString('codes');

    const rawCape = await redis.get(`cape:${capeId}`);
    if (!rawCape) return interaction.editReply({ content: `No cape found with ID \`${capeId}\`. Check spelling.` });

    const cape  = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;
    const codes = codesRaw.split(',').map(c => c.trim()).filter(Boolean);

    if (codes.length === 0) return interaction.editReply({ content: 'No valid codes found. Separate codes with commas.' });

    for (const code of codes) {
      await redis.rpush(`cape:${capeId}:codes`, code);
    }

    const total = await redis.llen(`cape:${capeId}:codes`);
    cape.stock  = total;
    await redis.set(`cape:${capeId}`, JSON.stringify(cape));

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Codes Added')
          .setColor(0x57F287)
          .addFields(
            { name: 'Cape',        value: `${cape.emoji} ${cape.name}`, inline: true },
            { name: 'Added',       value: `${codes.length}`,            inline: true },
            { name: 'Total Stock', value: `${total}`,                   inline: true }
          ),
      ],
    });
  },
};
