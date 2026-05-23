const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

const VOUCH_CHANNEL_NAME = 'vouches';

async function scrapeVouches(channel) {
  let saved = 0;
  let lastId = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;

    for (const msg of messages.values()) {
      if (msg.author.bot) continue;

      const vouch = {
        id: msg.id,
        userId: msg.author.id,
        username: msg.author.tag,
        content: msg.content || '(no text)',
        timestamp: msg.createdTimestamp,
        attachments: [...msg.attachments.values()].map(a => a.url),
      };

      await redis.set(`vouch:${msg.id}`, JSON.stringify(vouch));
      saved++;
    }

    lastId = messages.last().id;
    if (messages.size < 100) break;
  }

  return saved;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snapshot')
    .setDescription('Save the server structure and vouches to Redis for restore'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    // ── Roles ─────────────────────────────────────────────────────
    const roles = guild.roles.cache.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
    }));

    // ── Channels ──────────────────────────────────────────────────
    const channels = guild.channels.cache
      .filter(c => [
        ChannelType.GuildText,
        ChannelType.GuildVoice,
        ChannelType.GuildCategory,
        ChannelType.GuildAnnouncement,
      ].includes(c.type))
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position,
        parentId: c.parentId || null,
        topic: c.topic || null,
        nsfw: c.nsfw || false,
        permissionOverwrites: c.permissionOverwrites.cache.map(o => ({
          id: o.id,
          type: o.type,
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString(),
        })),
      }));

    // ── Find vouch channel ────────────────────────────────────────
    const vouchChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes(VOUCH_CHANNEL_NAME)
    );

    const snapshot = {
      guildName: guild.name,
      snapshotAt: Date.now(),
      roles,
      channels,
      vouchChannelId: vouchChannel?.id || null,
    };

    await redis.set('server:snapshot', JSON.stringify(snapshot));

    // ── Scrape vouch history ──────────────────────────────────────
    let vouchesSaved = 0;
    if (vouchChannel) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📸  Snapshotting...')
            .setDescription('> Scraping vouch history, this may take a moment...')
        ],
      });
      vouchesSaved = await scrapeVouches(vouchChannel);
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('📸  Snapshot Saved')
          .setDescription('> Server structure and vouches saved to Redis.\n\u200b')
          .addFields(
            { name: 'Roles',    value: `\`${roles.length}\``,    inline: true },
            { name: 'Channels', value: `\`${channels.length}\``, inline: true },
            { name: 'Vouch Channel', value: vouchChannel ? `<#${vouchChannel.id}>` : '`Not found`', inline: true },
            { name: 'Vouches Scraped', value: `\`${vouchesSaved}\``, inline: true },
          )
          .setTimestamp()
      ],
    });
  },
};
