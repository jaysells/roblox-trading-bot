const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

function parseEmoji(str) {
  const match = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (match) return { animated: !!match[1], name: match[2], id: match[3] };
  return str;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('capestock')
    .setDescription('Post the cape shop embed with buy dropdown')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to post in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const capeIds = await redis.smembers('capes');
    if (!capeIds || capeIds.length === 0) {
      return interaction.editReply({ content: 'No capes in the shop yet. Use /addcape first.' });
    }

    const capes = [];
    for (const id of capeIds) {
      const raw = await redis.get(`cape:${id}`);
      if (raw) capes.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
    }

    if (capes.length === 0) return interaction.editReply({ content: 'Failed to load capes.' });

    const embed = new EmbedBuilder()
      .setTitle('🎭 Cape Shop')
      .setDescription('Browse and buy Minecraft capes with LTC.\nSelect a cape from the dropdown below to add it to your cart.')
      .setColor(0x5865F2)
      .addFields(
        capes.map(c => ({
          name: `${c.emoji} ${c.name}`,
          value: c.stock > 0 ? `**$${c.price.toFixed(2)}** • ${c.stock} in stock` : `**$${c.price.toFixed(2)}** • ~~Out of stock~~`,
          inline: true,
        }))
      )
      .setFooter({ text: 'Payments via LTC • Instant delivery after 1 confirmation' });

    const inStock = capes.filter(c => c.stock > 0);

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (inStock.length === 0) {
      await targetChannel.send({ embeds: [embed] });
      return interaction.editReply({ content: 'Cape shop posted (all capes currently out of stock).' });
    }

    const options = inStock.map(c => ({
      label: c.name.slice(0, 100),
      description: `$${c.price.toFixed(2)} USD`,
      value: c.id,
      emoji: parseEmoji(c.emoji),
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cape_shop_select')
        .setPlaceholder('Select a cape to add to your cart...')
        .addOptions(options)
    );

    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.editReply({ content: 'Cape shop posted!' });
  },
};
