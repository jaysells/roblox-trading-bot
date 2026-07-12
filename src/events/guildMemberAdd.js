const { AUTO_ROLE_ID } = require('../utils/permissions');
const { handleMemberJoin } = require('../utils/inviteTracker');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    if (member.user.bot) return;
    const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
    if (role) await member.roles.add(role).catch(() => {});

    await handleMemberJoin(member).catch(e => console.error('[invites] join tracking failed:', e.message));
  },
};
