const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { getBotLtcAddress } = require('../utils/ltcWallet');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botwallet')
    .setDescription('Show the bot\'s LTC payout wallet address (fund this to enable /tip and invite payouts)'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
    }

    let address;
    try {
      address = getBotLtcAddress();
    } catch (e) {
      return interaction.reply({ content: `**Could not derive the wallet address:** ${e.message}\nIs \`LTC_PRIVATE_KEY\` set?`, ephemeral: true });
    }

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('👛 Bot Payout Wallet')
          .setColor(0x5865F2)
          .addFields({ name: 'Address', value: `\`${address}\`` })
          .setFooter({ text: 'Send LTC here to fund /tip and automatic invite-reward payouts' }),
      ],
      ephemeral: true,
    });
  },
};
