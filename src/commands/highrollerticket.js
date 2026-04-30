const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { isDev, STAFF_ROLE_ID } = require('../utils/permissions');
const redis = require('../utils/redis');

const HIGH_ROLLER_ROLE_ID = '1499261138305810443';

function sanitizeName(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'user';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('highrollerticket')
    .setDescription('Open a high roller ticket'),

  async execute(interaction) {
    const member = interaction.member;
    const hasAccess =
      isDev(member.id) ||
      member.roles.cache.has(STAFF_ROLE_ID) ||
      member.roles.cache.has(HIGH_ROLLER_ROLE_ID);

    if (!hasAccess) {
      return interaction.reply({
        content: `You need the <@&${HIGH_ROLLER_ROLE_ID}> role to use this command.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const userId = member.id;
    const guild = interaction.guild;
    const type = 'highroller';

    const existingChannelId = await redis.get(`ticket:${userId}:${type}`);
    if (existingChannelId) {
      const existingChannel = guild.channels.cache.get(existingChannelId);
      if (existingChannel) {
        return interaction.editReply({
          content: `You already have an open high roller ticket: <#${existingChannelId}>`,
        });
      }
      await redis.del(`ticket:${userId}:${type}`);
      await redis.del(`ticketchannel:${existingChannelId}`);
    }

    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets'
    );
    if (!category) {
      category = await guild.channels.create({
        name: 'Tickets',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });
    }

    const channel = await guild.channels.create({
      name: `highroller-${sanitizeName(member.user.username)}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `${userId}:${type}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });

    await redis.set(`ticket:${userId}:${type}`, channel.id);
    await redis.set(`ticketchannel:${channel.id}`, `${userId}:${type}`);

    const embed = new EmbedBuilder()
      .setTitle('💎 High Roller Ticket')
      .setDescription('Welcome! A staff member will be with you shortly.')
      .addFields({ name: 'Opened by', value: `<@${userId}>` })
      .setColor(0xF1C40F)
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    await channel.send({
      content: `<@${userId}> <@&${STAFF_ROLE_ID}>`,
      embeds: [embed],
      components: [closeRow],
    });

    await interaction.editReply({ content: `Your high roller ticket has been created: <#${channel.id}>` });
  },
};
