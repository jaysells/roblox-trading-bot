const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editdiscount')
    .setDescription('Change the remaining uses or expiry on a discount code')
    .addStringOption(o => o.setName('code').setDescription('The discount code').setRequired(true))
    .addIntegerOption(o => o.setName('uses').setDescription('New number of remaining uses (switches to limited-use)').setRequired(false).setMinValue(0))
    .addIntegerOption(o => o.setName('days').setDescription('New expiry in days from now, unlimited uses (switches to time-limited)').setRequired(false).setMinValue(1)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const code = interaction.options.getString('code').toUpperCase().trim();
    const uses = interaction.options.getInteger('uses');
    const days = interaction.options.getInteger('days');

    if (uses === null && days === null) {
      return interaction.reply({ content: 'Provide either `uses` or `days` to update.', ephemeral: true });
    }
    if (uses !== null && days !== null) {
      return interaction.reply({ content: 'Provide only one of `uses` or `days`, not both.', ephemeral: true });
    }

    const raw = await redis.get(`discount:${code}`);
    if (!raw) {
      return interaction.reply({ content: `Discount code \`${code}\` not found.`, ephemeral: true });
    }

    const discount = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const wasUnlimited = discount.unlimited;
    const oldLimit = wasUnlimited
      ? `Unlimited (expired <t:${Math.floor(discount.expiresAt / 1000)}:R>)`
      : `${discount.usesLeft}`;

    let newLimit;
    if (days !== null) {
      discount.unlimited = true;
      discount.uses      = null;
      discount.usesLeft  = null;
      discount.expiresAt = Date.now() + days * 86_400_000;
      newLimit = `Unlimited uses • expires <t:${Math.floor(discount.expiresAt / 1000)}:R>`;
    } else {
      discount.unlimited = false;
      discount.uses      = uses;
      discount.usesLeft  = uses;
      discount.expiresAt = null;
      newLimit = `${uses}`;
    }

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
            { name: 'Old Limit', value: oldLimit,       inline: true },
            { name: 'New Limit', value: newLimit,       inline: true }
          ),
      ],
      ephemeral: true,
    });
  },
};
