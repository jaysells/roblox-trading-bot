const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getInviterStats } = require('../utils/inviteTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check invite stats for yourself or another member')
    .addUserOption(o => o.setName('user').setDescription('Member to check (defaults to you)').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const stats  = await getInviterStats(target.id);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📨 Invite Stats — ${target.username}`)
          .setColor(0x5865F2)
          .addFields(
            { name: 'Invites',   value: `${stats.net}`,       inline: true },
            { name: 'Claimable', value: `${stats.claimable}`, inline: true },
            { name: 'Alts',      value: `${stats.alts}`,      inline: true },
            { name: 'Left',      value: `${stats.leaves}`,    inline: true },
          )
          .setFooter({ text: 'Invites = joined and still in the server • Claimable = not yet redeemed for a reward' }),
      ],
      ephemeral: true,
    });
  },
};
