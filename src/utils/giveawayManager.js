const redis = require('./redis');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const timers = new Map();

function buildGiveawayEmbed(giveaway) {
  const endUnix = Math.floor(giveaway.endTime / 1000);
  return new EmbedBuilder()
    .setTitle(`🎉 GIVEAWAY: ${giveaway.prize}`)
    .setDescription(giveaway.description || '​')
    .addFields(
      { name: '🏆 Winners', value: String(giveaway.winners), inline: true },
      { name: '👥 Entries', value: String((giveaway.entries || []).length), inline: true },
      { name: '⏰ Ends', value: `<t:${endUnix}:R>`, inline: true }
    )
    .setColor(0xF4D03F)
    .setFooter({ text: 'Click the button below to enter!' })
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

    const entryCount = await redis.scard(`giveaway:${giveawayId}:entries`) || 0;
    const embed = buildGiveawayEmbed({ ...giveaway, entries: new Array(entryCount) });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_enter')
        .setLabel('Enter Giveaway')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎉')
    );
    await message.edit({ embeds: [embed], components: [row] }).catch(() => {});
  } catch (e) {
    console.error('Error updating giveaway embed:', e.message);
  }
}

async function endGiveaway(client, giveawayId) {
  const t = timers.get(giveawayId);
  if (t) {
    clearTimeout(t.endTimeout);
    timers.delete(giveawayId);
  }

  try {
    const raw = await redis.get(`giveaway:${giveawayId}`);
    if (!raw) return;
    const giveaway = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (giveaway.ended) return;

    const entries = await redis.smembers(`giveaway:${giveawayId}:entries`) || [];
    console.log(`[Giveaway] Ending ${giveawayId} | Entries (${entries.length}):`, entries);
    const winnerCount = Math.min(giveaway.winners, entries.length);
    const pool = [...entries];
    const winners = [];
    for (let i = 0; i < winnerCount; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(idx, 1)[0]);
    }
    console.log(`[Giveaway] Winners:`, winners);

    giveaway.ended = true;
    giveaway.endedAt = Date.now();
    giveaway.selectedWinners = winners;
    giveaway.entries = entries;

    await redis.set(`giveaway:${giveawayId}`, JSON.stringify(giveaway));
    await redis.srem('giveaways:active', giveawayId);
    await redis.sadd('giveaways:ended', giveawayId);

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(giveawayId).catch(() => null);
    if (message) {
      const endedEmbed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize}`)
        .setDescription(giveaway.description || '​')
        .addFields(
          { name: '🏆 Winners', value: winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No winners', inline: true },
          { name: '👥 Total Entries', value: String(entries.length), inline: true }
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_enter')
          .setLabel('Giveaway Ended')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await message.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
    }

    if (winners.length > 0) {
      await channel.send(`🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`).catch(() => {});
    } else {
      await channel.send(`The giveaway for **${giveaway.prize}** has ended with no entries.`).catch(() => {});
    }
  } catch (e) {
    console.error('Error ending giveaway:', e.message);
  }
}

function startGiveawayTimers(client, giveawayId, endTime) {
  const delay = Math.max(0, endTime - Date.now());
  const endTimeout = setTimeout(() => endGiveaway(client, giveawayId), delay);
  timers.set(giveawayId, { endTimeout });
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
