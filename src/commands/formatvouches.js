const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

const VOUCH_CHANNEL_ID = '1499195804903280812';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('formatvouches')
    .setDescription('Reformat all existing vouches in the vouch channel as embeds'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(VOUCH_CHANNEL_ID);
    if (!channel) {
      return interaction.reply({ content: 'Vouch channel not found.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // Fetch all messages oldest first
    let allMessages = [];
    let lastId = null;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const batch = await channel.messages.fetch(options);
      if (batch.size === 0) break;
      allMessages = allMessages.concat([...batch.values()]);
      lastId = batch.last().id;
      if (batch.size < 100) break;
    }

    // Sort oldest first
    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Filter out bot messages (already formatted embeds)
    const userMessages = allMessages.filter(m => !m.author.bot);

    await interaction.editReply({ content: `Found **${userMessages.length}** messages to reformat. Starting...` });

    let done = 0;
    for (const msg of userMessages) {
      try {
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: msg.author.username,
            iconURL: msg.author.displayAvatarURL({ dynamic: true }),
          })
          .setDescription(msg.content || '*(no text)*')
          .setTimestamp(msg.createdAt)
          .setFooter({ text: 'Limited Hub' });

        // Save to Redis
        await redis.set(`vouch:${msg.id}`, JSON.stringify({
          id: msg.id,
          userId: msg.author.id,
          username: msg.author.tag,
          content: msg.content || '(no text)',
          timestamp: msg.createdTimestamp,
          attachments: [...msg.attachments.values()].map(a => a.url),
        }));

        await msg.delete().catch(() => {});
        await channel.send({ embeds: [embed] });
        done++;

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`Failed to reformat vouch ${msg.id}:`, e.message);
      }
    }

    await interaction.editReply({ content: `✅ Done! Reformatted **${done}/${userMessages.length}** vouches.` });
  },
};
