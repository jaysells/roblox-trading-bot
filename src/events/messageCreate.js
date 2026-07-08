const redis = require('../utils/redis');

const VOUCH_CHANNEL_ID = '1499195804903280812';
const VOUCH_CHANNEL_NAME = 'vouches';

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ── Vouch formatter ───────────────────────────────────────────
    if (message.channelId === VOUCH_CHANNEL_ID) {
      const { EmbedBuilder } = require('discord.js');

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(message.content || '*(no text)*')
        .setTimestamp(message.createdAt)
        .setFooter({ text: 'Limited Hub' });

      // Delete original and repost as embed
      await message.delete().catch(() => {});
      await message.channel.send({ embeds: [embed] });

      // Save to Redis for snapshot
      await redis.set(`vouch:${message.id}`, JSON.stringify({
        id: message.id,
        userId: message.author.id,
        username: message.author.tag,
        content: message.content || '(no text)',
        timestamp: message.createdTimestamp,
        attachments: [...message.attachments.values()].map(a => a.url),
      }));
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
        if (result !== null) {
          await message.reply(`= **${result}**`);
        }
      }
    } catch {}
  },
};
