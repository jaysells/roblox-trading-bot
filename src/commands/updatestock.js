const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');

// ── Emoji constants ──────────────────────────────────────────────
const E = {
  ps99:   '<:ps99:1500643809036472442>',
  db:     '<:db_gems:1501042581201752154>',
  bb:     '<:bb:1500680956296822835>',
  gag:    '<:gag:1500681045597753364>',
  tap:    '<:tapsim:1500644044571938826>',
};

// ── Embed builders ────────────────────────────────────────────────
function timestamp() {
  const now = Math.floor(Date.now() / 1000);
  return `<t:${now}:R>  ·  <t:${now}:f>`;
}

function baseEmbed(title, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: 'Prices subject to change · Open a ticket to sell' })
    .setTimestamp();
}

// PS99
function buildPS99(gemsAmount, gemsRate, rapAmount, rapRate) {
  return baseEmbed(`${E.ps99}  PS99 Buying Stock`, 0xE91E8C)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.ps99}  ─── GEMS ───`, value: `> 🛒 **Buying:** \`${gemsAmount}\`\n> 💵 **Rate:** \`${gemsRate}\``, inline: false },
      { name: `📊  ─── RAP ───`,         value: `> 🛒 **Buying:** \`${rapAmount}\`\n> 💵 **Rate:** \`${rapRate}\``,   inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// Pets Go
function buildPetsGo(gemsAmount, gemsRate, rapAmount, rapRate) {
  return baseEmbed(`${E.ps99}  Pets Go Buying Stock`, 0x00C8FF)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.ps99}  ─── GEMS ───`, value: `> 🛒 **Buying:** \`${gemsAmount}\`\n> 💵 **Rate:** \`${gemsRate}\``, inline: false },
      { name: `📊  ─── RAP ───`,         value: `> 🛒 **Buying:** \`${rapAmount}\`\n> 💵 **Rate:** \`${rapRate}\``,   inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// MM2
function buildMM2(items, rate) {
  return baseEmbed(`🔪  MM2 Buying Stock`, 0xFF4444)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `🔪  ─── ITEMS BUYING ───`, value: `${items}`, inline: false },
      { name: `💵  ─── RATE ───`,         value: `\`${rate}\``,               inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// DaHood
function buildDaHood(items, rate) {
  return baseEmbed(`🏙️  Da Hood Buying Stock`, 0xFF8C00)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `🏙️  ─── ITEMS BUYING ───`, value: `${items}`, inline: false },
      { name: `💵  ─── RATE ───`,          value: `\`${rate}\``,               inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// Limiteds
function buildLimiteds(items, rate) {
  return baseEmbed(`👑  Limiteds Buying Stock`, 0xFFD700)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `👑  ─── LIMITEDS BUYING ───`, value: `${items}`, inline: false },
      { name: `💵  ─── RATE ───`,            value: `\`${rate}\``,               inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// Death Ball
function buildDeathBall(amount, rate) {
  return baseEmbed(`${E.db}  Death Ball Buying Stock`, 0x8B0000)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.db}  ─── TOKENS ───`, value: `> 🛒 **Buying:** \`${amount}\`\n> 💵 **Rate:** \`${rate}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// Blade Ball
function buildBladeBall(amount, rate) {
  return baseEmbed(`${E.bb}  Blade Ball Buying Stock`, 0x0055FF)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.bb}  ─── TRADE TOKENS ───`, value: `> 🛒 **Buying:** \`${amount}\`\n> 💵 **Rate:** \`${rate}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// Grow a Garden
function buildGAG(amount, rate) {
  return baseEmbed(`${E.gag}  Grow a Garden Buying Stock`, 0x57F287)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.gag}  ─── TRADE TOKENS ───`, value: `> 🛒 **Buying:** \`${amount}\`\n> 💵 **Rate:** \`${rate}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// Tap Sim
function buildTapSim(amount, rate) {
  return baseEmbed(`${E.tap}  Tap Simulator Buying Stock`, 0x9B59B6)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.tap}  ─── TOKENS ───`, value: `> 🛒 **Buying:** \`${amount}\`\n> 💵 **Rate:** \`${rate}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

// ── Modal helpers ─────────────────────────────────────────────────
function twoFieldModal(id, title, f1label, f1ph, f2label, f2ph) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field1').setLabel(f1label).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f1ph)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field2').setLabel(f2label).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f2ph)
    )
  );
  return modal;
}

function fourFieldModal(id, title, f1l, f1p, f2l, f2p, f3l, f3p, f4l, f4p) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field1').setLabel(f1l).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f1p)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field2').setLabel(f2l).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f2p)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field3').setLabel(f3l).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f3p)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field4').setLabel(f4l).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f4p)
    )
  );
  return modal;
}

function itemsModal(id, title) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('items')
        .setLabel('Items (use emojis + item names, one per line)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('e.g.\n🔫 Ghostblade — Paying $5\n💎 Godly Set — Paying $20')
        .setMaxLength(1000)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('rate')
        .setLabel('General Rate / Notes')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('e.g. Paying market value · DM for prices')
    )
  );
  return modal;
}

// ── Command ───────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('updatestock')
    .setDescription('Post a buying stock update for a game'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('updatestock_select')
        .setPlaceholder('🎮 Select a game...')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('PS99').setDescription('Pet Simulator 99').setValue('ps99').setEmoji({ id: '1500643809036472442', name: 'ps99' }),
          new StringSelectMenuOptionBuilder().setLabel('Pets Go').setDescription('Pets Go gems & RAP').setValue('petsgo').setEmoji({ id: '1500643809036472442', name: 'ps99' }),
          new StringSelectMenuOptionBuilder().setLabel('MM2').setDescription('Murder Mystery 2 items').setValue('mm2').setEmoji('🔪'),
          new StringSelectMenuOptionBuilder().setLabel('Da Hood').setDescription('Da Hood items').setValue('dahood').setEmoji('🏙️'),
          new StringSelectMenuOptionBuilder().setLabel('Limiteds').setDescription('Roblox limited items').setValue('limiteds').setEmoji('👑'),
          new StringSelectMenuOptionBuilder().setLabel('Death Ball').setDescription('Death Ball gems').setValue('deathball').setEmoji({ id: '1501042581201752154', name: 'db_gems' }),
          new StringSelectMenuOptionBuilder().setLabel('Blade Ball').setDescription('Blade Ball trade tokens').setValue('bladeball').setEmoji({ id: '1500680956296822835', name: 'bb' }),
          new StringSelectMenuOptionBuilder().setLabel('Grow a Garden').setDescription('Grow a Garden trade tokens').setValue('gag').setEmoji({ id: '1500681045597753364', name: 'gag' }),
          new StringSelectMenuOptionBuilder().setLabel('Tap Simulator').setDescription('Tap Simulator tokens').setValue('tapsim').setEmoji({ id: '1500644044571938826', name: 'tapsim' })
        )
    );

    await interaction.reply({
      content: '## 📋 Update Stock\nChoose which game you want to post a stock update for:',
      components: [row],
      ephemeral: true,
    });
  },

  async handleSelect(interaction) {
    const game = interaction.values[0];
    let modal;

    switch (game) {
      case 'ps99':
        modal = fourFieldModal('stock_ps99', 'PS99 Stock', 'Gems — Amount Buying', '500B', 'Gems — Rate', '$1 per 10B', 'RAP — Amount Buying', '200B RAP', 'RAP — Rate', '$1 per 5B RAP');
        break;
      case 'petsgo':
        modal = fourFieldModal('stock_petsgo', 'Pets Go Stock', 'Gems — Amount Buying', '500B', 'Gems — Rate', '$1 per 10B', 'RAP — Amount Buying', '200B RAP', 'RAP — Rate', '$1 per 5B RAP');
        break;
      case 'mm2':
        modal = itemsModal('stock_mm2', 'MM2 Stock');
        break;
      case 'dahood':
        modal = itemsModal('stock_dahood', 'Da Hood Stock');
        break;
      case 'limiteds':
        modal = itemsModal('stock_limiteds', 'Limiteds Stock');
        break;
      case 'deathball':
        modal = twoFieldModal('stock_deathball', 'Death Ball Stock', 'Amount Buying', '10,000 tokens', 'Rate', '$1 per 1,000 tokens');
        break;
      case 'bladeball':
        modal = twoFieldModal('stock_bladeball', 'Blade Ball Stock', 'Amount Buying', '5,000 tokens', 'Rate', '$1 per 500 tokens');
        break;
      case 'gag':
        modal = twoFieldModal('stock_gag', 'Grow a Garden Stock', 'Amount Buying', '10,000 tokens', 'Rate', '$1 per 1,000 tokens');
        break;
      case 'tapsim':
        modal = twoFieldModal('stock_tapsim', 'Tap Simulator Stock', 'Amount Buying', '50,000 tokens', 'Rate', '$1 per 5,000 tokens');
        break;
      default:
        return interaction.reply({ content: 'Unknown game.', ephemeral: true });
    }

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const id = interaction.customId;
    let embed;

    if (id === 'stock_ps99') {
      embed = buildPS99(
        interaction.fields.getTextInputValue('field1'),
        interaction.fields.getTextInputValue('field2'),
        interaction.fields.getTextInputValue('field3'),
        interaction.fields.getTextInputValue('field4')
      );
    } else if (id === 'stock_petsgo') {
      embed = buildPetsGo(
        interaction.fields.getTextInputValue('field1'),
        interaction.fields.getTextInputValue('field2'),
        interaction.fields.getTextInputValue('field3'),
        interaction.fields.getTextInputValue('field4')
      );
    } else if (id === 'stock_mm2') {
      embed = buildMM2(
        interaction.fields.getTextInputValue('items'),
        interaction.fields.getTextInputValue('rate')
      );
    } else if (id === 'stock_dahood') {
      embed = buildDaHood(
        interaction.fields.getTextInputValue('items'),
        interaction.fields.getTextInputValue('rate')
      );
    } else if (id === 'stock_limiteds') {
      embed = buildLimiteds(
        interaction.fields.getTextInputValue('items'),
        interaction.fields.getTextInputValue('rate')
      );
    } else if (id === 'stock_deathball') {
      embed = buildDeathBall(
        interaction.fields.getTextInputValue('field1'),
        interaction.fields.getTextInputValue('field2')
      );
    } else if (id === 'stock_bladeball') {
      embed = buildBladeBall(
        interaction.fields.getTextInputValue('field1'),
        interaction.fields.getTextInputValue('field2')
      );
    } else if (id === 'stock_gag') {
      embed = buildGAG(
        interaction.fields.getTextInputValue('field1'),
        interaction.fields.getTextInputValue('field2')
      );
    } else if (id === 'stock_tapsim') {
      embed = buildTapSim(
        interaction.fields.getTextInputValue('field1'),
        interaction.fields.getTextInputValue('field2')
      );
    } else {
      return interaction.reply({ content: 'Unknown stock type.', ephemeral: true });
    }

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Stock posted!', ephemeral: true });
  },
};
