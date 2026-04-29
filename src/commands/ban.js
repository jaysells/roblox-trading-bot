const { SlashCommandBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(o => o.setName('member').setDescription('Member to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for ban').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const target = interaction.options.getMember('member');
    const reason = interaction.options.getString('reason');

    if (!target) return interaction.reply({ content: 'Member not found.', ephemeral: true });
    if (!target.bannable) return interaction.reply({ content: 'I cannot ban this member.', ephemeral: true });

    await target.send(`You have been banned from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    await target.ban({ reason });
    await interaction.reply({ content: `✅ Banned **${target.user.tag}**.\n**Reason:** ${reason}` });
  },
};
