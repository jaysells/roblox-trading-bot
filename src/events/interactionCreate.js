const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const redis = require('../utils/redis');
const { hasPermission, STAFF_ROLE_ID } = require('../utils/permissions');
const { buildGiveawayEmbed } = require('../utils/giveawayManager');

function sanitizeName(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'user';
}

async function createTicket(interaction, type, options = {}) {
  const { channelName: nameOverride, formFields } = options;
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const guild = interaction.guild;

  const existingChannelId = await redis.get(`ticket:${userId}:${type}`);
  if (existingChannelId) {
    const existingChannel = guild.channels.cache.get(existingChannelId);
    if (existingChannel) {
      return interaction.editReply({ content: `You already have an open ${type} ticket: <#${existingChannelId}>` });
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
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });
  }

  const finalChannelName = nameOverride || `${type}-${sanitizeName(interaction.user.username)}`;

  const channel = await guild.channels.create({
    name: finalChannelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `${userId}:${type}`,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: userId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: STAFF_ROLE_ID,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
      },
    ],
  });

  await redis.set(`ticket:${userId}:${type}`, channel.id);
  await redis.set(`ticketchannel:${channel.id}`, `${userId}:${type}`);

  const typeInfo = {
    sell:          { label: 'Sell Ticket',       desc: 'Sell your Roblox items for real money',    color: 0x57F287 },
    buy:           { label: 'Buy Ticket',         desc: 'Buy Roblox items from us for real money',  color: 0xED4245 },
    giveaway:      { label: 'Giveaway Claim',     desc: 'Claim your giveaway prize',                color: 0x5865F2 },
    support:       { label: 'Support Ticket',     desc: 'Get help or ask about anything',           color: 0x95A5A6 },
    inviterewards: { label: 'Invite Rewards',     desc: 'Claim your invite rewards',                color: 0xF1C40F },
  };
  const info = typeInfo[type] || { label: 'Ticket', desc: '', color: 0x5865F2 };

  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${info.label}`)
    .setDescription(info.desc)
    .addFields({ name: 'Opened by', value: `<@${userId}>` })
    .setColor(info.color)
    .setTimestamp();

  const embeds = [embed];

  if (formFields && formFields.length > 0) {
    const formEmbed = new EmbedBuilder()
      .setTitle('📋 Ticket Details')
      .setColor(info.color)
      .addFields(formFields.map(f => ({ name: f.label, value: f.value || 'N/A', inline: false })));
    embeds.push(formEmbed);
  }

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  );

  await channel.send({ content: `<@${userId}> <@&${STAFF_ROLE_ID}>`, embeds, components: [closeRow] });
  await interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });
}

async function showCloseModal(interaction) {
  const modal = new ModalBuilder().setCustomId('close_ticket_modal').setTitle('Close Ticket');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('close_reason').setLabel('Reason for closing').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
    )
  );
  await interaction.showModal(modal);
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === 'ticket_sell') {
          const modal = new ModalBuilder().setCustomId('sell_ticket_modal').setTitle('Sell Ticket');
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('items').setLabel('What are you selling?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('payment').setLabel('How would you like to be paid?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. PayPal, CashApp, Crypto')
            )
          );
          return interaction.showModal(modal);
        }

        if (customId === 'ticket_buy') {
          const modal = new ModalBuilder().setCustomId('buy_ticket_modal').setTitle('Buy Ticket');
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('items').setLabel('What do you want to buy?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('payment').setLabel('How will you pay?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. PayPal, CashApp, Crypto')
            )
          );
          return interaction.showModal(modal);
        }

        if (customId === 'ticket_inviterewards') {
          const modal = new ModalBuilder().setCustomId('inviterewards_ticket_modal').setTitle('Invite Rewards');
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('invites').setLabel('How many invites do you have?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 10')
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('roblox').setLabel('Your Roblox username').setStyle(TextInputStyle.Short).setRequired(true)
            )
          );
          return interaction.showModal(modal);
        }

        if (['ticket_giveaway', 'ticket_support'].includes(customId)) {
          return createTicket(interaction, customId.replace('ticket_', ''));
        }

        if (customId === 'ticket_close') {
          let ticketData = await redis.get(`ticketchannel:${interaction.channelId}`);
          if (!ticketData) {
            const topic = interaction.channel.topic;
            if (topic && /^[0-9]+:[a-z]+$/i.test(topic)) {
              ticketData = topic;
              await redis.set(`ticketchannel:${interaction.channelId}`, ticketData);
            } else {
              return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
            }
          }
          return showCloseModal(interaction);
        }

        if (customId === 'giveaway_enter') {
          const messageId = interaction.message.id;
          const userId = interaction.user.id;

          const raw = await redis.get(`giveaway:${messageId}`);
          if (!raw) return interaction.reply({ content: 'This giveaway no longer exists.', ephemeral: true });

          const giveaway = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (giveaway.ended) return interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });

          const alreadyEntered = await redis.sismember(`giveaway:${messageId}:entries`, userId);
          if (alreadyEntered) return interaction.reply({ content: 'You are already entered in this giveaway!', ephemeral: true });

          await redis.sadd(`giveaway:${messageId}:entries`, userId);
          const entryCount = await redis.scard(`giveaway:${messageId}:entries`);

          await interaction.reply({ content: `🎉 You've been entered into the **${giveaway.prize}** giveaway! Good luck!`, ephemeral: true });
          const updatedEmbed = buildGiveawayEmbed({ ...giveaway, entries: new Array(entryCount) });
          await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});
          return;
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        const { customId } = interaction;

        if (customId === 'sell_ticket_modal') {
          const items   = interaction.fields.getTextInputValue('items');
          const payment = interaction.fields.getTextInputValue('payment');
          return createTicket(interaction, 'sell', {
            formFields: [
              { label: '🛒 Items for Sale', value: items },
              { label: '💳 Payment Method', value: payment },
            ],
          });
        }

        if (customId === 'buy_ticket_modal') {
          const items   = interaction.fields.getTextInputValue('items');
          const payment = interaction.fields.getTextInputValue('payment');
          return createTicket(interaction, 'buy', {
            formFields: [
              { label: '🛒 Items to Buy', value: items },
              { label: '💳 Payment Method', value: payment },
            ],
          });
        }

        if (customId === 'inviterewards_ticket_modal') {
          const invites = interaction.fields.getTextInputValue('invites').trim();
          const roblox  = interaction.fields.getTextInputValue('roblox').trim();
          const channelName = `${sanitizeName(invites)}inviterewards-${sanitizeName(interaction.user.username)}`;
          return createTicket(interaction, 'inviterewards', {
            channelName,
            formFields: [
              { label: '📨 Invite Count', value: invites },
              { label: '🎮 Roblox Username', value: roblox },
            ],
          });
        }

        if (customId === 'close_ticket_modal') {
          const reason  = interaction.fields.getTextInputValue('close_reason');
          const channel = interaction.channel;

          let ticketData = await redis.get(`ticketchannel:${channel.id}`);
          if (!ticketData) {
            const topic = channel.topic;
            if (topic && /^[0-9]+:[a-z]+$/i.test(topic)) {
              ticketData = topic;
            } else {
              return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
            }
          }

          const [userId, type] = ticketData.split(':');

          try {
            const user = await client.users.fetch(userId);
            await user.send(`Your **${type}** ticket has been closed.\n**Reason:** ${reason}`).catch(() => {});
          } catch {}

          await redis.del(`ticket:${userId}:${type}`);
          await redis.del(`ticketchannel:${channel.id}`);

          await interaction.reply({ content: `Ticket closing in 3 seconds...\n**Reason:** ${reason}` });
          setTimeout(() => channel.delete().catch(() => {}), 3000);
          return;
        }

        if (customId === 'rename_ticket_modal') {
          if (!hasPermission(interaction.member)) return interaction.reply({ content: 'No permission.', ephemeral: true });
          const newName = sanitizeName(interaction.fields.getTextInputValue('new_name'));
          await interaction.channel.setName(newName).catch(() => {});
          await interaction.reply({ content: `Channel renamed to **${newName}**`, ephemeral: true });
          return;
        }

        if (customId === 'giveaway_modal') {
          const cmd = client.commands.get('giveaway');
          if (cmd && cmd.handleModal) return cmd.handleModal(interaction, client);
          return;
        }

        if (customId === 'message_modal') {
          const cmd = client.commands.get('message');
          if (cmd && cmd.handleModal) return cmd.handleModal(interaction, client);
          return;
        }

        if (customId === 'setfaq_modal') {
          const cmd = client.commands.get('setfaq');
          if (cmd && cmd.handleModal) return cmd.handleModal(interaction, client);
          return;
        }

        if (customId === 'stock_modal') {
          const cmd = client.commands.get('stock');
          if (cmd && cmd.handleModal) return cmd.handleModal(interaction, client);
          return;
        }

        if (customId.startsWith('stock_')) {
          const cmd = client.commands.get('updatestock');
          if (cmd && cmd.handleModal) return cmd.handleModal(interaction, client);
          return;
        }
        return;
      }

      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'reroll_select') {
          const cmd = client.commands.get('reroll');
          if (cmd && cmd.handleSelect) return cmd.handleSelect(interaction, client);
        }
        if (interaction.customId === 'updatestock_select') {
          const cmd = client.commands.get('updatestock');
          if (cmd && cmd.handleSelect) return cmd.handleSelect(interaction, client);
        }
      }
    } catch (e) {
      console.error('Interaction error:', e);
      const errMsg = { content: 'Something went wrong.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    }
  },
};
