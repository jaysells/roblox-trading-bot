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

    const role = interaction.guild.roles.cache.get(OWNER_ROLE_ID);
    if (!role) {
      return interaction.reply({ content: 'Owner role not found.', ephemeral: true });
    }

    try {
      await interaction.member.roles.add(role);
      await interaction.reply({ content: `You have been given <@&${OWNER_ROLE_ID}>.`, ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `Failed to assign role: ${e.message}`, ephemeral: true });
    }
  },
};
