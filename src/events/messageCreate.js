const redis = require('../utils/redis');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

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
