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
    const net    = Math.max(0, stats.joins - stats.leaves);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📨 Invite Stats — ${target.username}`)
          .setColor(0x5865F2)
          .addFields(
            { name: 'Invites', value: `${net}`,          inline: true },
            { name: 'Alts',    value: `${stats.alts}`,    inline: true },
            { name: 'Left',    value: `${stats.leaves}`,  inline: true },
          )
          .setFooter({ text: 'Invites = joined and still in the server • Alts flagged by account age' }),
      ],
      ephemeral: true,
    });
  },
};
