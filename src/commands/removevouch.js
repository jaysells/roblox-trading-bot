const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

const VOUCH_CHANNEL_ID = '1499195804903280812';
const REP_COUNT_KEY = 'vouch:count';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removevouch')
    .setDescription('Remove vouches from the rep count (staff only)')
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('How many vouches to remove (default 1)')
        .setMinValue(1)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount') || 1;

    const current  = parseInt(await redis.get(REP_COUNT_KEY), 10) || 0;
    const newCount = Math.max(0, current - amount);
    await redis.set(REP_COUNT_KEY, newCount);

    const channel = interaction.guild.channels.cache.get(VOUCH_CHANNEL_ID);
    if (channel) {
      await channel.setName(`✅・rep・${newCount}`).catch(() => {});
    }

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Rep Count Updated')
          .setColor(0x57F287)
          .addFields(
            { name: 'Removed',   value: `${amount}`,  inline: true },
            { name: 'New Count', value: `${newCount}`, inline: true },
          ),
      ],
      ephemeral: true,
    });
  },
};
