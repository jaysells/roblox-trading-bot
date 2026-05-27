const redis = require('../utils/redis');
const { CALC_CHANNEL_KEY, evaluate } = require('../commands/setcalculator');

const VOUCH_CHANNEL_NAME = 'vouches';

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ── Vouch listener ────────────────────────────────────────────
    if (message.channel.name.toLowerCase().includes(VOUCH_CHANNEL_NAME)) {
      const vouch = {
        id: message.id,
        userId: message.author.id,
        username: message.author.tag,
        content: message.content || '(no text)',
        timestamp: message.createdTimestamp,
        attachments: [...message.attachments.values()].map(a => a.url),
      };
      await redis.set(`vouch:${message.id}`, JSON.stringify(vouch));
    }

    // ── Calculator ────────────────────────────────────────────────
    const calcChannelId = await redis.get(CALC_CHANNEL_KEY);
    if (calcChannelId && message.channelId === calcChannelId) {
      const result = evaluate(message.content);
      if (result !== null) {
        await message.reply(`= **${result}**`);
      }
    }
  },
};
