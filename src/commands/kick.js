const { SlashCommandBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(o => o.setName('member').setDescription('Member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for kick').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const target = interaction.options.getMember('member');
    const reason = interaction.options.getString('reason');

    if (!target) return interaction.reply({ content: 'Member not found.', ephemeral: true });
    if (!target.kickable) return interaction.reply({ content: 'I cannot kick this member.', ephemeral: true });

    await target.send(`You have been kicked from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    await target.kick(reason);
    await interaction.reply({ content: `✅ Kicked **${target.user.tag}**.\n**Reason:** ${reason}` });
  },
};
