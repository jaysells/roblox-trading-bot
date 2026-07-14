const { ChannelType } = require('discord.js');
const redis = require('./redis');
const { getBotLtcBalanceUsd } = require('./ltcWallet');
const { getTotalStoreCreditCents } = require('./storeCredit');

// Discord rate-limits channel renames (~2 per 10 min per channel), so this
// runs on a slow cadence — it's a display, not something needing to be live.
const UPDATE_INTERVAL_MS = 15 * 60 * 1000;

async function ensurePayoutChannel(guild, redisKey, initialName) {
  const existingId = await redis.get(redisKey);
  if (existingId) {
    const existing = guild.channels.cache.get(existingId);
    if (existing) return existing;
  }
  try {
    const created = await guild.channels.create({ name: initialName, type: ChannelType.GuildVoice });
    await redis.set(redisKey, created.id);
    return created;
  } catch (e) {
    console.error('[payouts] Failed to create payout channel:', e.message);
    return null;
  }
}

async function updatePayoutChannels(client) {
  for (const [, guild] of client.guilds.cache) {
    try {
      const ltcChannel = await ensurePayoutChannel(guild, 'payoutchannel:ltc', 'Payouts in LTC 0');
      const scChannel  = await ensurePayoutChannel(guild, 'payoutchannel:sc', 'Payouts in SC 0');

      let ltcUsd = null;
      try {
        ltcUsd = await getBotLtcBalanceUsd();
      } catch (e) {
        console.error('[payouts] LTC balance fetch failed:', e.message);
      }

      const scCents = await getTotalStoreCreditCents();

      if (ltcChannel && ltcUsd != null) {
        await ltcChannel.setName(`Payouts in LTC ${Math.round(ltcUsd)}`).catch(() => {});
      }
      if (scChannel) {
        await scChannel.setName(`Payouts in SC ${Math.round(scCents / 100)}`).catch(() => {});
      }
    } catch (e) {
      console.error(`[payouts] Failed to update payout channels in ${guild.name}:`, e.message);
    }
  }
}

function startPayoutChannelUpdater(client) {
  updatePayoutChannels(client).catch(e => console.error('[payouts] Initial update failed:', e.message));
  setInterval(() => updatePayoutChannels(client).catch(e => console.error('[payouts] Update failed:', e.message)), UPDATE_INTERVAL_MS);
  console.log('[payouts] Payout channel updater started.');
}

module.exports = { startPayoutChannelUpdater };
