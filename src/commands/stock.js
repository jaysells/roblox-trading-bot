const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Post the current buying stock and rates'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('stock_modal').setTitle('Set Stock');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gems_amount')
          .setLabel('💎 Gems — Amount Buying')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 500B')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gems_rate')
          .setLabel('💎 Gems — Rate')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. $1 per 10B')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rap_amount')
          .setLabel('📊 RAP — Amount Buying')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 200B RAP')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rap_rate')
          .setLabel('📊 RAP — Rate')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. $1 per 5B RAP')
      )
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const gemsAmount = interaction.fields.getTextInputValue('gems_amount');
    const gemsRate   = interaction.fields.getTextInputValue('gems_rate');
    const rapAmount  = interaction.fields.getTextInputValue('rap_amount');
    const rapRate    = interaction.fields.getTextInputValue('rap_rate');

    const now = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setColor(0xE91E8C)
      .setTitle('<:ps99:1500643809036472442>  PS99 Buying Stock')
      .setDescription(
        '> We are currently **open** and buying!\n' +
        '> Open a ticket to sell — prices are firm.\n\u200b'
      )
      .addFields(
        {
          name: '<:ps99:1500643809036472442>  ─── GEMS ───',
          value:
            `> 🛒 **Buying:** \`${gemsAmount}\`\n` +
            `> 💵 **Rate:** \`${gemsRate}\``,
          inline: false,
        },
        {
          name: '📊  ─── RAP ───',
          value:
            `> 🛒 **Buying:** \`${rapAmount}\`\n` +
            `> 💵 **Rate:** \`${rapRate}\``,
          inline: false,
        },
        {
          name: '\u200b',
          value: `🕒 **Last Updated:** <t:${now}:R>  ·  <t:${now}:f>`,
          inline: false,
        }
      )
      .setFooter({ text: 'Prices subject to change · Open a ticket to sell' })
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Stock posted!', ephemeral: true });
  },
};
