const { SlashCommandBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their ID')
    .addStringOption(o => o.setName('userid').setDescription('The user ID to unban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for unban').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason');

    try {
      const user = await interaction.client.users.fetch(userId);
      await interaction.guild.members.unban(userId, reason);
      await user.send(`You have been unbanned from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
      await interaction.reply({ content: `✅ Unbanned **${user.tag}**.\n**Reason:** ${reason}` });
    } catch (e) {
      await interaction.reply({ content: `Failed to unban: ${e.message}`, ephemeral: true });
    }
  },
};
