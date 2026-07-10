const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editdiscount')
    .setDescription('Change the remaining uses on a discount code')
    .addStringOption(o => o.setName('code').setDescription('The discount code').setRequired(true))
    .addIntegerOption(o => o.setName('uses').setDescription('New number of remaining uses').setRequired(true).setMinValue(0)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const code = interaction.options.getString('code').toUpperCase().trim();
    const uses = interaction.options.getInteger('uses');

    const raw = await redis.get(`discount:${code}`);
    if (!raw) {
      return interaction.reply({ content: `Discount code \`${code}\` not found.`, ephemeral: true });
    }

    const discount       = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const oldUses        = discount.usesLeft;
    discount.usesLeft    = uses;
    discount.uses        = uses;
    await redis.set(`discount:${code}`, JSON.stringify(discount));

    const displayValue = discount.type === 'percent'
      ? `${discount.value}% off`
      : `$${discount.value.toFixed(2)} off`;

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Discount Code Updated')
          .setColor(0x57F287)
          .addFields(
            { name: 'Code',      value: `\`${code}\``, inline: true },
            { name: 'Discount',  value: displayValue,   inline: true },
            { name: 'Old Uses',  value: `${oldUses}`,   inline: true },
            { name: 'New Uses',  value: `${uses}`,      inline: true }
          ),
      ],
      ephemeral: true,
    });
  },
};
