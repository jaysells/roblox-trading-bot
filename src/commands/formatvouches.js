const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

const VOUCH_CHANNEL_ID = '1499195804903280812';
const OWNER_ID = '888743210363551755';
const REP_COUNT_KEY = 'vouch:count';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('formatvouches')
    .setDescription('Reformat all existing vouches and sync rep count'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(VOUCH_CHANNEL_ID);
    if (!channel) return interaction.reply({ content: 'Vouch channel not found.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    // Fetch all messages
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

    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const userMessages = allMessages.filter(m => !m.author.bot);

    await interaction.editReply({ content: `Found **${userMessages.length}** messages to reformat. Starting...` });

    let done = 0;
    for (const msg of userMessages) {
      try {
        const isForward = msg.messageSnapshots && msg.messageSnapshots.size > 0;
        let embed;

        if (isForward) {
          const snapshot = msg.messageSnapshots.first();
          const content = snapshot?.content || '*(no text)*';
          let sourceInfo = '*(unknown server)*';
          if (msg.reference?.guildId) {
            try {
              const sourceGuild = await interaction.client.guilds.fetch(msg.reference.guildId).catch(() => null);
              if (sourceGuild) sourceInfo = sourceGuild.name;
            } catch {}
          }
          embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: msg.author.username, iconURL: msg.author.displayAvatarURL({ dynamic: true }) })
            .setDescription(content)
            .addFields({ name: '📨 Forwarded from', value: sourceInfo, inline: true })
            .setTimestamp(msg.createdAt)
            .setFooter({ text: 'Limited Hub · Forwarded Message' });
        } else {
          embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setAuthor({ name: msg.author.username, iconURL: msg.author.displayAvatarURL({ dynamic: true }) })
            .setDescription(msg.content || '*(no text)*')
            .setTimestamp(msg.createdAt)
            .setFooter({ text: 'Limited Hub' });
        }

        await redis.set(`vouch:${msg.id}`, JSON.stringify({
          id: msg.id,
          userId: msg.author.id,
          username: msg.author.tag,
          content: isForward
            ? `[Forwarded] ${msg.messageSnapshots?.first()?.content || '(no text)'}`
            : (msg.content || '(no text)'),
          timestamp: msg.createdTimestamp,
          attachments: [...msg.attachments.values()].map(a => a.url),
        }));

        // Only delete if not the owner
        if (msg.author.id !== OWNER_ID) {
          await msg.delete().catch(() => {});
        }

        await channel.send({ embeds: [embed] });
        done++;

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`Failed to reformat vouch ${msg.id}:`, e.message);
      }
    }

    // Set rep count to total done and update channel name
    await redis.set(REP_COUNT_KEY, done);
    try {
      await channel.setName(`✅・rep・${done}`);
    } catch (e) {
      console.error('[rep] Failed to update channel name:', e.message);
    }

    await interaction.editReply({ content: `✅ Done! Reformatted **${done}/${userMessages.length}** vouches.\nChannel renamed to **✅・rep・${done}**` });
  },
};
