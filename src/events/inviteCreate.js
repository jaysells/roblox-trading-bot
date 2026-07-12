const { noteInviteCreate } = require('../utils/inviteTracker');

module.exports = {
  name: 'inviteCreate',
  async execute(invite) {
    noteInviteCreate(invite);
  },
};
