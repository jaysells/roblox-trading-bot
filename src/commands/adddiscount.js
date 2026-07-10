const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adddiscount')
    .setDescription('Create a discount code')
    .addStringOption(o => o.setName('code').setDescription('The discount code (e.g. SUMMER10)').setRequired(true))
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Discount type')
        .setRequired(true)
        .addChoices(
          { name: 'Percent off (%)', value: 'percent' },
          { name: 'Fixed amount off ($)', value: 'fixed' }
        )
    )
    .addNumberOption(o => o.setName('value').setDescription('Discount amount (e.g. 10 for 10% or $10)').setRequired(true).setMinValue(0.01))
    .addIntegerOption(o => o.setName('uses').setDescription('Number of times this code can be used').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const code  = interaction.options.getString('code').toUpperCase().trim();
    const type  = interaction.options.getString('type');
    const value = interaction.options.getNumber('value');
    const uses  = interaction.options.getInteger('uses');

    if (type === 'percent' && value > 100) {
      return interaction.reply({ content: 'Percent discount cannot exceed 100%.', ephemeral: true });
    }

    const existing = await redis.get(`discount:${code}`);
    if (existing) {
      return interaction.reply({ content: `Discount code \`${code}\` already exists. Remove it first.`, ephemeral: true });
    }

    const discount = { code, type, value, uses, usesLeft: uses };
    await redis.set(`discount:${code}`, JSON.stringify(discount));

    const displayValue = type === 'percent' ? `${value}% off` : `$${value.toFixed(2)} off`;

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Discount Code Created')
          .setColor(0x57F287)
          .addFields(
            { name: 'Code',     value: `\`${code}\``,   inline: true },
            { name: 'Discount', value: displayValue,     inline: true },
            { name: 'Uses',     value: `${uses}`,        inline: true }
          ),
      ],
      ephemeral: true,
    });
  },
};
