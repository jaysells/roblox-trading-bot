const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');
const { updateCapeStockMessage } = require('../utils/ltcPoller');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprice')
    .setDescription('Change the price of a cape')
    .addStringOption(o => o.setName('cape_id').setDescription('Cape ID').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('New price in USD').setRequired(true).setMinValue(0.01)),

  async execute(interaction, client) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const capeId = interaction.options.getString('cape_id').trim();
    const price  = interaction.options.getNumber('price');

    const rawCape = await redis.get(`cape:${capeId}`);
    if (!rawCape) {
      return interaction.reply({ content: `No cape found with ID \`${capeId}\`.`, ephemeral: true });
    }

    const cape     = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;
    const oldPrice = cape.price;
    cape.price     = price;
    await redis.set(`cape:${capeId}`, JSON.stringify(cape));
    await updateCapeStockMessage(client);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Price Updated')
          .setColor(0x57F287)
          .addFields(
            { name: 'Cape',      value: `${cape.emoji} ${cape.name}`, inline: true  },
            { name: 'Old Price', value: `$${oldPrice.toFixed(2)}`,    inline: true  },
            { name: 'New Price', value: `$${price.toFixed(2)}`,       inline: true  }
          ),
      ],
      ephemeral: true,
    });
  },
};
