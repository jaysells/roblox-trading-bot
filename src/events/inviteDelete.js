const { noteInviteDelete } = require('../utils/inviteTracker');

module.exports = {
  name: 'inviteDelete',
  async execute(invite) {
    noteInviteDelete(invite);
  },
};
