const { SlashCommandBuilder } = require('discord.js');

const OWNER_ROLE_ID = '1489698084161060934';
const PASSWORD = '0725';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transferownership')
    .setDescription('Claim the owner role with a password')
    .addStringOption(o =>
      o.setName('password')
        .setDescription('Enter the password')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('password');

    if (input !== PASSWORD) {
      return interaction.reply({ content: 'Incorrect password.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const role = await interaction.guild.roles.fetch(OWNER_ROLE_ID);
      if (!role) {
        return interaction.editReply({ content: 'Owner role not found.' });
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(role);
      await interaction.editReply({ content: `You have been given <@&${OWNER_ROLE_ID}>.` });
    } catch (e) {
      await interaction.editReply({ content: `Failed to assign role: ${e.message}` });
    }
  },
};
