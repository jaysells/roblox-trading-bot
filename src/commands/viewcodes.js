const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewcodes')
    .setDescription('View the code database (staff only)')
    .addStringOption(o =>
      o.setName('cape_id')
        .setDescription('Cape ID to view codes for (omit to see all capes summary)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const capeId = interaction.options.getString('cape_id')?.trim();

    // Summary view — all capes with code counts
    if (!capeId) {
      const capeIds = await redis.smembers('capes');
      if (!capeIds || capeIds.length === 0) {
        return interaction.editReply({ content: 'No capes in the database.' });
      }

      const fields = [];
      for (const id of capeIds) {
        const raw = await redis.get(`cape:${id}`);
        if (!raw) continue;
        const cape  = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const count = await redis.llen(`cape:${id}:codes`);
        fields.push({
          name: `${cape.emoji} ${cape.name}`,
          value: `ID: \`${id}\`\nPrice: $${cape.price.toFixed(2)}\nCodes: **${count}**`,
          inline: true,
        });
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📦 Cape Code Database')
            .setColor(0x5865F2)
            .addFields(fields)
            .setFooter({ text: 'Use /viewcodes cape_id:<id> to see actual codes' })
            .setTimestamp(),
        ],
      });
    }

    // Detailed view — actual codes for one cape
    const rawCape = await redis.get(`cape:${capeId}`);
    if (!rawCape) {
      return interaction.editReply({ content: `No cape found with ID \`${capeId}\`.` });
    }

    const cape  = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;
    const codes = await redis.lrange(`cape:${capeId}:codes`, 0, -1);

    if (!codes || codes.length === 0) {
      return interaction.editReply({ content: `**${cape.name}** has no codes in stock.` });
    }

    // Split into chunks of 20 to avoid hitting embed limits
    const chunk    = 20;
    const embeds   = [];
    for (let i = 0; i < codes.length; i += chunk) {
      const slice = codes.slice(i, i + chunk);
      embeds.push(
        new EmbedBuilder()
          .setTitle(i === 0 ? `🗂️ ${cape.emoji} ${cape.name} — Codes (${codes.length} total)` : `(continued)`)
          .setColor(0x5865F2)
          .setDescription('```\n' + slice.join('\n') + '\n```')
      );
    }

    // Discord allows max 10 embeds per message
    return interaction.editReply({ embeds: embeds.slice(0, 10) });
  },
};
