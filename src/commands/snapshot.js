const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

// The name of your vouch channel so we know which one to tag
const VOUCH_CHANNEL_NAME = 'vouches';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snapshot')
    .setDescription('Save the server structure to Redis for restore'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    // ── Roles ────────────────────────────────────────────────────
    const roles = guild.roles.cache.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
    }));

    // ── Channels ─────────────────────────────────────────────────
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

    // Find vouch channel ID
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

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('📸  Snapshot Saved')
          .setDescription('> Server structure saved to Redis.\n\u200b')
          .addFields(
            { name: 'Roles',    value: `\`${roles.length}\``,    inline: true },
            { name: 'Channels', value: `\`${channels.length}\``, inline: true },
            { name: 'Vouch Channel', value: vouchChannel ? `<#${vouchChannel.id}>` : '`Not found`', inline: true },
          )
          .setTimestamp()
      ],
    });
  },
};
