const { AUTO_ROLE_ID } = require('../utils/permissions');
const { resumeGiveaways } = require('../utils/giveawayManager');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

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
