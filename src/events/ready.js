const { AUTO_ROLE_ID } = require('../utils/permissions');
const { resumeGiveaways } = require('../utils/giveawayManager');
const { startPoller } = require('../utils/ltcPoller');
const { cacheGuildInvites, startPendingJoinSweeper } = require('../utils/inviteTracker');
const inviterewardspanel = require('../commands/inviterewardspanel');

const KEEPALIVE_CHANNELS = [
  '1499195096447582228',
  '1499198119999705119',
  '1510532722844631040',
  '1510154600072745121',
];
const INTERVAL_MS = 90 * 60 * 1000; // 1.5 hours
const PANEL_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

async function ping(client) {
  for (const channelId of KEEPALIVE_CHANNELS) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) continue;
      const msg = await channel.send('.');
      await msg.delete();
    } catch (e) {
      console.error(`[keepalive] Error in ${channelId}:`, e.message);
    }
  }
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Client ID: ${client.user.id}`);

    setInterval(() => ping(client), INTERVAL_MS);

    await resumeGiveaways(client);
    startPoller(client);
    startPendingJoinSweeper(client);

    inviterewardspanel.updatePanel(client).catch(e => console.error('[inviterewardspanel] Initial update failed:', e.message));
    setInterval(
      () => inviterewardspanel.updatePanel(client).catch(e => console.error('[inviterewardspanel] Update failed:', e.message)),
      PANEL_UPDATE_INTERVAL_MS
    );

    for (const [, guild] of client.guilds.cache) {
      // Always cache invites first — this used to sit after the auto-role
      // sync below, but that block's `continue` (for guilds with no
      // AUTO_ROLE_ID role configured) skipped it entirely, leaving those
      // guilds' invite cache permanently empty.
      await cacheGuildInvites(guild);

      try {
        await guild.members.fetch();
        const role = guild.roles.cache.get(AUTO_ROLE_ID);
        if (!role) continue;
        for (const [, member] of guild.members.cache) {
          if (!member.user.bot && !member.roles.cache.has(AUTO_ROLE_ID)) {
            await member.roles.add(role).catch(() => {});
          }
        }
      } catch (e) {
        console.error(`Error syncing auto role in ${guild.name}:`, e.message);
      }
    }

    console.log('Ready. Auto role sync complete.');
  },
};
