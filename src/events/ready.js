const KEEPALIVE_CHANNELS = [
  '1499195096447582228',
  '1499198119999705119',
  '1504306277986074795',
];
const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

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

    setInterval(() => ping(client), INTERVAL_MS);

    const { resumeGiveaways } = require('../utils/giveawayManager');
    const { AUTO_ROLE_ID } = require('../utils/permissions');

    await resumeGiveaways(client);

    for (const [, guild] of client.guilds.cache) {
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
