const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwallet')
    .setDescription('Register the LTC address you will send cape shop payments from')
    .addStringOption(o => o.setName('address').setDescription('Your LTC wallet address').setRequired(true)),

  async execute(interaction) {
    const address = interaction.options.getString('address').trim();
    await redis.set(`userltc:${interaction.user.id}`, address);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Wallet Registered')
          .setColor(0x57F287)
          .addFields({ name: 'Your LTC address', value: `\`${address}\`` })
          .setFooter({ text: 'Cape shop payments must be sent from this address • Run this again anytime to update it' }),
      ],
      ephemeral: true,
    });
  },
};
