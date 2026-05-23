const redis = require('../utils/redis');

const VOUCH_CHANNEL_NAME = 'vouches';

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.channel.name.toLowerCase().includes(VOUCH_CHANNEL_NAME)) return;

    // Save vouch to Redis
    const vouch = {
      id: message.id,
      userId: message.author.id,
      username: message.author.tag,
      content: message.content || '(no text)',
      timestamp: message.createdTimestamp,
      attachments: message.attachments.map(a => a.url),
    };

    await redis.set(`vouch:${message.id}`, JSON.stringify(vouch));
  },
};
