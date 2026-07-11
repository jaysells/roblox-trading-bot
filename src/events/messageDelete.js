const redis = require('../utils/redis');

const VOUCH_CHANNEL_ID = '1499195804903280812';
const REP_COUNT_KEY = 'vouch:count';

async function updateRepChannel(guild, count) {
  try {
    const channel = guild.channels.cache.get(VOUCH_CHANNEL_ID);
    if (!channel) return;
    await channel.setName(`✅・rep・${count}`);
  } catch (e) {
    console.error('[rep] Failed to update channel name:', e.message);
  }
}

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (message.channelId !== VOUCH_CHANNEL_ID) return;
    if (!message.guild || !message.author) return;

    // Only a formatted vouch embed (posted by the bot) counts as a real vouch
    if (message.author.id !== message.client.user.id) return;
    if (!message.embeds || message.embeds.length === 0) return;

    await redis.del(`vouch:${message.id}`);

    const current = parseInt(await redis.get(REP_COUNT_KEY), 10) || 0;
    const newCount = Math.max(0, current - 1);
    await redis.set(REP_COUNT_KEY, newCount);
    await updateRepChannel(message.guild, newCount);
  },
};
