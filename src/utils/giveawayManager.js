const redis = require('./redis');
const { EmbedBuilder } = require('discord.js');

const timers = new Map();

function formatTimeLeft(ms) {
  if (ms <= 0) return 'Ended';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function buildGiveawayEmbed(giveaway) {
  const timeLeft = giveaway.endTime - Date.now();
  return new EmbedBuilder()
    .setTitle(`🎉 GIVEAWAY: ${giveaway.prize}`)
    .setDescription(giveaway.description || '​')
    .addFields(
      { name: '🏆 Winners', value: String(giveaway.winners), inline: true },
      { name: '⏰ Time Left', value: formatTimeLeft(timeLeft), inline: true }
    )
    .setColor(0xF4D03F)
    .setFooter({ text: 'All server members are automatically entered!' })
    .setTimestamp(new Date(giveaway.endTime));
}

async function updateGiveawayEmbed(client, giveawayId) {
  try {
    const raw = await redis.get(`giveaway:${giveawayId}`);
    if (!raw) return;
    const giveaway = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (giveaway.ended) return;

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;
    const message = await channel.messages.fetch(giveawayId).catch(() => null);
    if (!message) return;

    const embed = buildGiveawayEmbed(giveaway);
    await message.edit({ embeds: [embed] }).catch(() => {});
  } catch (e) {
    console.error('Error updating giveaway embed:', e.message);
  }
}

async function endGiveaway(client, giveawayId) {
  const t = timers.get(giveawayId);
  if (t) {
    clearTimeout(t.endTimeout);
    clearInterval(t.updateInterval);
    timers.delete(giveawayId);
  }

  try {
    const raw = await redis.get(`giveaway:${giveawayId}`);
    if (!raw) return;
    const giveaway = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (giveaway.ended) return;

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    // Fetch all non-bot members as the pool
    const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
    if (!guild) return;
    await guild.members.fetch();
    const allMembers = guild.members.cache.filter(m => !m.user.bot).map(m => m.id);

    const winnerCount = Math.min(giveaway.winners, allMembers.length);
    const pool = [...allMembers];
    const winners = [];
    for (let i = 0; i < winnerCount; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(idx, 1)[0]);
    }

    giveaway.ended = true;
    giveaway.endedAt = Date.now();
    giveaway.selectedWinners = winners;
    giveaway.entries = allMembers;

    await redis.set(`giveaway:${giveawayId}`, JSON.stringify(giveaway));
    await redis.srem('giveaways:active', giveawayId);
    await redis.sadd('giveaways:ended', giveawayId);

    const message = await channel.messages.fetch(giveawayId).catch(() => null);
    if (message) {
      const endedEmbed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize}`)
        .setDescription(giveaway.description || '​')
        .addFields(
          { name: '🏆 Winners', value: winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No winners', inline: true },
          { name: '👥 Total Members', value: String(allMembers.length), inline: true }
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      await message.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
    }

    if (winners.length > 0) {
      await channel.send(`🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`).catch(() => {});
    } else {
      await channel.send(`The giveaway for **${giveaway.prize}** has ended.`).catch(() => {});
    }
  } catch (e) {
    console.error('Error ending giveaway:', e.message);
  }
}

function startGiveawayTimers(client, giveawayId, endTime) {
  const delay = Math.max(0, endTime - Date.now());
  const endTimeout = setTimeout(() => endGiveaway(client, giveawayId), delay);
  const updateInterval = setInterval(() => updateGiveawayEmbed(client, giveawayId), 60_000);
  timers.set(giveawayId, { endTimeout, updateInterval });
}

async function resumeGiveaways(client) {
  try {
    const ids = await redis.smembers('giveaways:active');
    if (!ids || ids.length === 0) return;

    for (const id of ids) {
      const raw = await redis.get(`giveaway:${id}`);
      if (!raw) continue;
      const giveaway = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (giveaway.ended) continue;
      startGiveawayTimers(client, id, giveaway.endTime);
    }

    console.log(`Resumed ${ids.length} active giveaway(s)`);
  } catch (e) {
    console.error('Error resuming giveaways:', e.message);
  }
}

module.exports = { buildGiveawayEmbed, startGiveawayTimers, endGiveaway, resumeGiveaways };
