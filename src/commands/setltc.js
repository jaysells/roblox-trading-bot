const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setltc')
    .setDescription('Set the LTC address that buyers send payments to')
    .addStringOption(o => o.setName('address').setDescription('Your LTC wallet address').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const address = interaction.options.getString('address').trim();
    await redis.set('ltc:address', address);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ LTC Address Updated')
          .setColor(0x57F287)
          .addFields({ name: 'Address', value: `\`${address}\`` })
          .setFooter({ text: 'Buyers will send LTC to this address on checkout' }),
      ],
      ephemeral: true,
    });
  },
};
