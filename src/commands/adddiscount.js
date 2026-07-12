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
    .addIntegerOption(o => o.setName('uses').setDescription('Number of times this code can be used').setRequired(false).setMinValue(1))
    .addIntegerOption(o => o.setName('days').setDescription('Instead of uses: unlimited uses, expires after this many days').setRequired(false).setMinValue(1)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const code  = interaction.options.getString('code').toUpperCase().trim();
    const type  = interaction.options.getString('type');
    const value = interaction.options.getNumber('value');
    const uses  = interaction.options.getInteger('uses');
    const days  = interaction.options.getInteger('days');

    if (type === 'percent' && value > 100) {
      return interaction.reply({ content: 'Percent discount cannot exceed 100%.', ephemeral: true });
    }

    if (!uses && !days) {
      return interaction.reply({ content: 'Provide either `uses` (limited-use code) or `days` (unlimited uses, time-limited).', ephemeral: true });
    }
    if (uses && days) {
      return interaction.reply({ content: 'Provide only one of `uses` or `days`, not both.', ephemeral: true });
    }

    const existing = await redis.get(`discount:${code}`);
    if (existing) {
      return interaction.reply({ content: `Discount code \`${code}\` already exists. Remove it first.`, ephemeral: true });
    }

    const discount = days
      ? { code, type, value, uses: null, unlimited: true, expiresAt: Date.now() + days * 86_400_000 }
      : { code, type, value, uses, unlimited: false, expiresAt: null };
    await redis.set(`discount:${code}`, JSON.stringify(discount));
    if (!days) await redis.set(`discount:${code}:usesleft`, uses);

    const displayValue = type === 'percent' ? `${value}% off` : `$${value.toFixed(2)} off`;
    const limitField = days
      ? { name: 'Limit', value: `Unlimited uses • expires <t:${Math.floor(discount.expiresAt / 1000)}:R>`, inline: true }
      : { name: 'Uses',  value: `${uses}`, inline: true };

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Discount Code Created')
          .setColor(0x57F287)
          .addFields(
            { name: 'Code',     value: `\`${code}\``,   inline: true },
            { name: 'Discount', value: displayValue,     inline: true },
            limitField
          ),
      ],
      ephemeral: true,
    });
  },
};
