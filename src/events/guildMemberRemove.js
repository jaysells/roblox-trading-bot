const { handleMemberLeave } = require('../utils/inviteTracker');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await handleMemberLeave(member).catch(e => console.error('[invites] leave tracking failed:', e.message));
  },
};
