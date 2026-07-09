const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcape')
    .setDescription('Add a Minecraft cape to the shop')
    .addStringOption(o => o.setName('name').setDescription('Cape name').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('Price in USD').setRequired(true).setMinValue(0.01))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji for this cape (unicode or custom server emoji)').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const name  = interaction.options.getString('name').trim();
    const price = interaction.options.getNumber('price');
    const emoji = interaction.options.getString('emoji').trim();

    const id = slugify(name);
    if (!id) return interaction.reply({ content: 'Invalid cape name.', ephemeral: true });

    const existing = await redis.get(`cape:${id}`);
    if (existing) {
      return interaction.reply({ content: `A cape with ID \`${id}\` already exists. Use a different name.`, ephemeral: true });
    }

    const cape = { id, name, price, emoji, stock: 0 };
    await redis.set(`cape:${id}`, JSON.stringify(cape));
    await redis.sadd('capes', id);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Cape Added')
          .setColor(0x57F287)
          .addFields(
            { name: 'Name',  value: `${emoji} ${name}`,       inline: true },
            { name: 'Price', value: `$${price.toFixed(2)}`,   inline: true },
            { name: 'ID',    value: `\`${id}\``,              inline: true }
          )
          .setFooter({ text: 'Use /addcodes to add redemption codes' }),
      ],
      ephemeral: true,
    });
  },
};
