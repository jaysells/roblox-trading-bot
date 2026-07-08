const redis = require('../utils/redis');

const VOUCH_CHANNEL_ID = '1499195804903280812';
const VOUCH_CHANNEL_NAME = 'vouches';

async function formatVouch(message, channel) {
  const { EmbedBuilder } = require('discord.js');

  const isForward = message.messageSnapshots && message.messageSnapshots.size > 0;

  let embed;

  if (isForward) {
    const snapshot = message.messageSnapshots.first();
    const content = snapshot?.content || '*(no text)*';

    // Try to get the source guild name
    let sourceInfo = '*(unknown server)*';
    if (message.reference?.guildId) {
      try {
        const sourceGuild = await message.client.guilds.fetch(message.reference.guildId).catch(() => null);
        if (sourceGuild) sourceInfo = sourceGuild.name;
      } catch {}
    }

    embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(content)
      .addFields({ name: '📨 Forwarded from', value: sourceInfo, inline: true })
      .setTimestamp(message.createdAt)
      .setFooter({ text: 'Limited Hub · Forwarded Message' });
  } else {
    embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(message.content || '*(no text)*')
      .setTimestamp(message.createdAt)
      .setFooter({ text: 'Limited Hub' });
  }

  await message.delete().catch(() => {});
  await channel.send({ embeds: [embed] });

  // Save to Redis
  await redis.set(`vouch:${message.id}`, JSON.stringify({
    id: message.id,
    userId: message.author.id,
    username: message.author.tag,
    content: isForward
      ? `[Forwarded] ${message.messageSnapshots?.first()?.content || '(no text)'}`
      : (message.content || '(no text)'),
    timestamp: message.createdTimestamp,
    attachments: [...message.attachments.values()].map(a => a.url),
  }));
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ── Vouch formatter ───────────────────────────────────────────
    if (message.channelId === VOUCH_CHANNEL_ID) {
      await formatVouch(message, message.channel);
      return;
    }

    // ── Vouch listener (name-based fallback) ─────────────────────
    if (message.channel.name.toLowerCase().includes(VOUCH_CHANNEL_NAME)) {
      await redis.set(`vouch:${message.id}`, JSON.stringify({
        id: message.id,
        userId: message.author.id,
        username: message.author.tag,
        content: message.content || '(no text)',
        timestamp: message.createdTimestamp,
        attachments: [...message.attachments.values()].map(a => a.url),
      }));
    }

    // ── Calculator ────────────────────────────────────────────────
    try {
      const { CALC_CHANNEL_KEY, evaluate } = require('../commands/setcalculator');
      const calcChannelId = await redis.get(CALC_CHANNEL_KEY);
      if (calcChannelId && message.channelId === calcChannelId) {
        const result = evaluate(message.content);
        if (result !== null) await message.reply(`= **${result}**`);
      }
    } catch {}
  },
};
