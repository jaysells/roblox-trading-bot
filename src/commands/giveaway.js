const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');
const { buildGiveawayEmbed, startGiveawayTimers } = require('../utils/giveawayManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a new giveaway'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('giveaway_modal').setTitle('Create Giveaway');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('prize')
          .setLabel('Prize Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duration (minutes)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 60')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('winners')
          .setLabel('Number of Winners')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 1')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('require_customer_role')
          .setLabel('Require Customer role to win? (yes/no)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('no')
      )
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction, client) {
    const prize = interaction.fields.getTextInputValue('prize');
    const description = interaction.fields.getTextInputValue('description') || '';
    const duration = parseInt(interaction.fields.getTextInputValue('duration'), 10);
    const winners = parseInt(interaction.fields.getTextInputValue('winners'), 10);
    const requireCustomerRole = /^y/i.test(interaction.fields.getTextInputValue('require_customer_role') || '');

    if (isNaN(duration) || duration <= 0) {
      return interaction.reply({ content: 'Invalid duration. Enter a positive number of minutes.', ephemeral: true });
    }
    if (isNaN(winners) || winners <= 0) {
      return interaction.reply({ content: 'Invalid winners count. Enter a positive number.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const endTime = Date.now() + duration * 60_000;

    const giveawayData = {
      prize,
      description,
      winners,
      endTime,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      entries: [],
      ended: false,
      selectedWinners: [],
      requireCustomerRole,
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_enter')
        .setLabel('Enter Giveaway')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎉')
    );

    const embed = buildGiveawayEmbed(giveawayData);
    const message = await interaction.channel.send({ embeds: [embed], components: [row] });

    giveawayData.id = message.id;
    await redis.set(`giveaway:${message.id}`, JSON.stringify(giveawayData));
    await redis.sadd('giveaways:active', message.id);

    startGiveawayTimers(client, message.id, endTime);

    await interaction.editReply({ content: `Giveaway for **${prize}** started!` });
  },
};
