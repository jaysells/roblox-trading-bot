const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { isDev, hasPermission } = require('../utils/permissions');

const RESTORE_CODE = '0725';
const RESTORE_TIMEOUT = 60_000; // 1 minute to enter code

// Track pending keypad sessions: userId -> { entered, messageId, channelId }
const sessions = new Map();

function buildKeypadEmbed(entered) {
  const display = entered.length > 0
    ? '`' + '●'.repeat(entered.length) + '`'
    : '`_ _ _ _`';

  return new EmbedBuilder()
    .setColor(entered.length === 4 ? 0x57F287 : 0x2B2D31)
    .setTitle('🔐  Server Restore')
    .setDescription(
      '> Enter the **4-digit restore code** to begin.\n' +
      '> This will rebuild channels, roles, and vouches.\n\u200b'
    )
    .addFields({ name: 'Code Entry', value: display, inline: false })
    .setFooter({ text: 'Session expires in 60 seconds · Wrong code = locked out' });
}

function buildKeypad(disabled = false) {
  const btn = (label, id, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);

  return [
    new ActionRowBuilder().addComponents(
      btn('1', 'kp_1'), btn('2', 'kp_2'), btn('3', 'kp_3')
    ),
    new ActionRowBuilder().addComponents(
      btn('4', 'kp_4'), btn('5', 'kp_5'), btn('6', 'kp_6')
    ),
    new ActionRowBuilder().addComponents(
      btn('7', 'kp_7'), btn('8', 'kp_8'), btn('9', 'kp_9')
    ),
    new ActionRowBuilder().addComponents(
      btn('⌫', 'kp_back', ButtonStyle.Primary),
      btn('0', 'kp_0'),
      btn('✓', 'kp_confirm', ButtonStyle.Success)
    ),
  ];
}

async function runRestore(interaction, client) {
  const guild = interaction.guild;

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅  Code Accepted — Starting Restore')
        .setDescription('> Rebuilding server structure...\n> This may take a moment.')
    ],
    components: [],
  });

  const redis = require('../utils/redis');
  const snapshot = await redis.get('server:snapshot');

  if (!snapshot) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌  No Snapshot Found')
          .setDescription('> No server snapshot exists in Redis yet.\n> Run `/snapshot` on your original server first.')
      ],
    });
    return;
  }

  const data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;

  // ── Restore roles ────────────────────────────────────────────────
  const roleMap = new Map(); // oldId -> newId
  if (data.roles) {
    const sorted = [...data.roles].sort((a, b) => a.position - b.position);
    for (const r of sorted) {
      if (r.name === '@everyone') continue;
      try {
        const created = await guild.roles.create({
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          mentionable: r.mentionable,
          permissions: BigInt(r.permissions),
        });
        roleMap.set(r.id, created.id);
      } catch {}
    }
  }

  // ── Restore channels ─────────────────────────────────────────────
  const channelMap = new Map(); // oldId -> newChannel
  if (data.channels) {
    // Create categories first
    const cats = data.channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
    for (const cat of cats) {
      try {
        const overwrites = (cat.permissionOverwrites || []).map(o => ({
          id: roleMap.get(o.id) || o.id,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny),
          type: o.type,
        }));
        const created = await guild.channels.create({
          name: cat.name,
          type: 4,
          position: cat.position,
          permissionOverwrites: overwrites,
        });
        channelMap.set(cat.id, created);
      } catch {}
    }

    // Create text/voice channels
    const rest = data.channels.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
    for (const ch of rest) {
      try {
        const parent = ch.parentId ? channelMap.get(ch.parentId) : null;
        const overwrites = (ch.permissionOverwrites || []).map(o => ({
          id: roleMap.get(o.id) || o.id,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny),
          type: o.type,
        }));
        const created = await guild.channels.create({
          name: ch.name,
          type: ch.type,
          topic: ch.topic || undefined,
          nsfw: ch.nsfw || false,
          position: ch.position,
          parent: parent?.id || undefined,
          permissionOverwrites: overwrites,
        });
        channelMap.set(ch.id, created);
      } catch {}
    }
  }

  // ── Restore vouches ──────────────────────────────────────────────
  if (data.vouchChannelId) {
    const newVouchChannel = channelMap.get(data.vouchChannelId);
    if (newVouchChannel) {
      const vouchKeys = await redis.keys('vouch:*');
      const vouches = [];
      for (const key of vouchKeys) {
        const v = await redis.get(key);
        if (v) vouches.push(typeof v === 'string' ? JSON.parse(v) : v);
      }
      vouches.sort((a, b) => a.timestamp - b.timestamp);

      for (const v of vouches) {
        try {
          const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setAuthor({ name: v.username })
            .setDescription(v.content)
            .setTimestamp(v.timestamp)
            .setFooter({ text: `Original ID: ${v.userId}` });
          await newVouchChannel.send({ embeds: [embed] });
        } catch {}
      }
    }
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅  Restore Complete')
        .setDescription(
          `> ✔ Roles restored: **${roleMap.size}**\n` +
          `> ✔ Channels restored: **${channelMap.size}**\n` +
          `> ✔ Vouches reposted\n\u200b`
        )
        .setTimestamp()
    ],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription('Restore server from snapshot (staff only)'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }

    const embed = buildKeypadEmbed('');
    const components = buildKeypad();

    await interaction.reply({ embeds: [embed], components, ephemeral: true });

    sessions.set(interaction.user.id, {
      entered: '',
      attempts: 0,
    });

    // Auto-expire session
    setTimeout(() => {
      if (sessions.has(interaction.user.id)) {
        sessions.delete(interaction.user.id);
      }
    }, RESTORE_TIMEOUT);
  },

  async handleButton(interaction, client) {
    const userId = interaction.user.id;
    const session = sessions.get(userId);

    if (!session) {
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('⏱  Session Expired')
            .setDescription('> Run `/restore` again to start a new session.')
        ],
        components: [],
      });
    }

    const { customId } = interaction;

    if (customId === 'kp_back') {
      session.entered = session.entered.slice(0, -1);
    } else if (customId === 'kp_confirm') {
      if (session.entered === RESTORE_CODE) {
        sessions.delete(userId);
        return runRestore(interaction, client);
      } else {
        session.attempts++;
        session.entered = '';

        if (session.attempts >= 3) {
          sessions.delete(userId);
          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🔒  Locked Out')
                .setDescription('> Too many incorrect attempts.\n> Run `/restore` again to try again.')
            ],
            components: buildKeypad(true),
          });
        }

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌  Wrong Code')
              .setDescription(`> Incorrect code. **${3 - session.attempts}** attempt(s) remaining.\n\u200b`)
              .addFields({ name: 'Code Entry', value: '`_ _ _ _`', inline: false })
              .setFooter({ text: 'Session expires in 60 seconds' })
          ],
          components: buildKeypad(),
        });
      }
    } else {
      // Number button
      const digit = customId.replace('kp_', '');
      if (session.entered.length < 4) {
        session.entered += digit;
      }
    }

    await interaction.update({
      embeds: [buildKeypadEmbed(session.entered)],
      components: buildKeypad(),
    });
  },
};
