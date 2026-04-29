const { SlashCommandBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');

const DURATIONS = {
  '60s':  { ms: 60_000,       label: '1 minute' },
  '10m':  { ms: 600_000,      label: '10 minutes' },
  '30m':  { ms: 1_800_000,    label: '30 minutes' },
  '1h':   { ms: 3_600_000,    label: '1 hour' },
  '12h':  { ms: 43_200_000,   label: '12 hours' },
  '1d':   { ms: 86_400_000,   label: '1 day' },
  '1w':   { ms: 604_800_000,  label: '1 week' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .addUserOption(o => o.setName('member').setDescription('Member to timeout').setRequired(true))
    .addStringOption(o =>
      o.setName('duration')
        .setDescription('Timeout duration')
        .setRequired(true)
        .addChoices(
          { name: '1 Minute',   value: '60s' },
          { name: '10 Minutes', value: '10m' },
          { name: '30 Minutes', value: '30m' },
          { name: '1 Hour',     value: '1h' },
          { name: '12 Hours',   value: '12h' },
          { name: '1 Day',      value: '1d' },
          { name: '1 Week',     value: '1w' }
        )
    )
    .addStringOption(o => o.setName('reason').setDescription('Reason for timeout').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const target = interaction.options.getMember('member');
    const durationKey = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');
    const duration = DURATIONS[durationKey];

    if (!target) return interaction.reply({ content: 'Member not found.', ephemeral: true });
    if (!target.moderatable) return interaction.reply({ content: 'I cannot timeout this member.', ephemeral: true });

    await target
      .send(`You have been timed out in **${interaction.guild.name}** for **${duration.label}**.\n**Reason:** ${reason}`)
      .catch(() => {});
    await target.timeout(duration.ms, reason);
    await interaction.reply({
      content: `✅ Timed out **${target.user.tag}** for **${duration.label}**.\n**Reason:** ${reason}`,
    });
  },
};
