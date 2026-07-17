const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');
const { updateCapeStockMessage } = require('../utils/ltcPoller');

const PAGE_SIZE = 25; // Discord select menus cap out at 25 options

async function syncStock(capeId) {
  const raw = await redis.get(`cape:${capeId}`);
  if (!raw) return;
  const cape = typeof raw === 'string' ? JSON.parse(raw) : raw;
  cape.stock = await redis.llen(`cape:${capeId}:codes`);
  await redis.set(`cape:${capeId}`, JSON.stringify(cape));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecode')
    .setDescription('View a cape\'s codes and pick one to remove')
    .addStringOption(o => o.setName('cape_id').setDescription('Cape ID').setRequired(true))
    .addIntegerOption(o => o.setName('page').setDescription('Page number (25 codes per page) if there are more than 25').setRequired(false).setMinValue(1)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const capeId = interaction.options.getString('cape_id').trim();
    const page   = interaction.options.getInteger('page') || 1;

    const rawCape = await redis.get(`cape:${capeId}`);
    if (!rawCape) {
      return interaction.reply({ content: `No cape found with ID \`${capeId}\`.`, ephemeral: true });
    }
    const cape = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;

    const total = await redis.llen(`cape:${capeId}:codes`);
    if (total === 0) {
      return interaction.reply({ content: `**${cape.emoji} ${cape.name}** has no codes in stock.`, ephemeral: true });
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (page > totalPages) {
      return interaction.reply({
        content: `Page ${page} is out of range — **${cape.name}** has ${total} code(s) across ${totalPages} page(s).`,
        ephemeral: true,
      });
    }

    const start = (page - 1) * PAGE_SIZE;
    const codes = await redis.lrange(`cape:${capeId}:codes`, start, start + PAGE_SIZE - 1);

    const options = codes.map(code =>
      new StringSelectMenuOptionBuilder()
        .setLabel(code.slice(0, 100))
        .setValue(code.slice(0, 100))
    );

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`removecode_select:${capeId}`)
        .setPlaceholder('Select a code to remove...')
        .addOptions(options)
    );

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🗂️ ${cape.emoji} ${cape.name} — Codes (page ${page}/${totalPages}, ${total} total)`)
          .setColor(0x5865F2)
          .setDescription(codes.map((c, i) => `${start + i + 1}. \`${c}\``).join('\n'))
          .setFooter({
            text: totalPages > 1
              ? `More pages available — run /removecode cape_id:${capeId} page:<n> to see them`
              : 'Select a code below to remove it',
          }),
      ],
      components: [row],
      ephemeral: true,
    });
  },

  async handleSelect(interaction, client) {
    const capeId       = interaction.customId.split(':')[1];
    const selectedCode = interaction.values[0];

    const rawCape = await redis.get(`cape:${capeId}`);
    const cape    = rawCape ? (typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape) : null;

    // LREM targets the exact code value wherever it currently sits in the
    // list, so it's safe even if a purchase (LPOP) shifted positions around
    // between viewing the list and picking one here.
    const removed = await redis.lrem(`cape:${capeId}:codes`, 1, selectedCode);

    if (removed === 0) {
      return interaction.update({
        content: '⚠️ That code is no longer in stock (it may have already been sold or removed).',
        embeds: [],
        components: [],
      });
    }

    await syncStock(capeId);
    await updateCapeStockMessage(client);

    return interaction.update({
      content: `✅ Removed code \`${selectedCode}\` from **${cape ? `${cape.emoji} ${cape.name}` : capeId}**.`,
      embeds: [],
      components: [],
    });
  },
};
