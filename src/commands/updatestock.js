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

// ── Emoji constants ───────────────────────────────────────────────
const E = {
  ps99:     '<:ps99:1500643809036472442>',
  db:       '<:db_gems:1501042581201752154>',
  bb:       '<:bb:1500680956296822835>',
  gag:      '<:gag:1500681045597753364>',
  tap:      '<:tapsim:1500644044571938826>',
  spawner:  '<:spawner:1510534341124558888>',
  money:    '<a:money_:1510534554065178744>',
};

// Each game has a unique title string we search for in existing embeds
const GAME_TITLES = {
  ps99:       'PS99 Buying Stock',
  petsgo:     'Pets Go Buying Stock',
  mm2:        'MM2 Buying Stock',
  dahood:     'Da Hood Buying Stock',
  limiteds:   'Limiteds Buying Stock',
  deathball:  'Death Ball Buying Stock',
  bladeball:  'Blade Ball Buying Stock',
  gag:        'Grow a Garden Buying Stock',
  tapsim:     'Tap Simulator Buying Stock',
  robux:      'Robux Selling Stock',
  donutmoney: 'DonutSMP Buying Stock',
  donutskelly: 'DonutSMP Skelly Buying Stock',
};

// ── Helpers ───────────────────────────────────────────────────────
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

// ── Embed builders ────────────────────────────────────────────────
function buildPS99(f1, f2, f3, f4) {
  return baseEmbed(`${E.ps99}  PS99 Buying Stock`, 0xE91E8C)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.ps99}  ─── GEMS ───`, value: `> 🛒 **Buying:** \`${f1}\`\n> 💵 **Rate:** \`${f2}\``, inline: false },
      { name: `📊  ─── RAP ───`,         value: `> 🛒 **Buying:** \`${f3}\`\n> 💵 **Rate:** \`${f4}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildPetsGo(f1, f2, f3, f4) {
  return baseEmbed(`${E.ps99}  Pets Go Buying Stock`, 0x00C8FF)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.ps99}  ─── GEMS ───`, value: `> 🛒 **Buying:** \`${f1}\`\n> 💵 **Rate:** \`${f2}\``, inline: false },
      { name: `📊  ─── RAP ───`,         value: `> 🛒 **Buying:** \`${f3}\`\n> 💵 **Rate:** \`${f4}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildMM2(items, rate) {
  return baseEmbed(`🔪  MM2 Buying Stock`, 0xFF4444)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `🔪  ─── ITEMS BUYING ───`, value: items,          inline: false },
      { name: `💵  ─── RATE ───`,         value: `\`${rate}\``,  inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildDaHood(items, rate) {
  return baseEmbed(`🏙️  Da Hood Buying Stock`, 0xFF8C00)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `🏙️  ─── ITEMS BUYING ───`, value: items,          inline: false },
      { name: `💵  ─── RATE ───`,          value: `\`${rate}\``,  inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildLimiteds(items, rate) {
  return baseEmbed(`👑  Limiteds Buying Stock`, 0xFFD700)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `👑  ─── LIMITEDS BUYING ───`, value: items,          inline: false },
      { name: `💵  ─── RATE ───`,            value: `\`${rate}\``,  inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildDeathBall(f1, f2) {
  return baseEmbed(`${E.db}  Death Ball Buying Stock`, 0x8B0000)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.db}  ─── TOKENS ───`, value: `> 🛒 **Buying:** \`${f1}\`\n> 💵 **Rate:** \`${f2}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildBladeBall(f1, f2) {
  return baseEmbed(`${E.bb}  Blade Ball Buying Stock`, 0x0055FF)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.bb}  ─── TRADE TOKENS ───`, value: `> 🛒 **Buying:** \`${f1}\`\n> 💵 **Rate:** \`${f2}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildGAG(f1, f2) {
  return baseEmbed(`${E.gag}  Grow a Garden Buying Stock`, 0x57F287)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.gag}  ─── TRADE TOKENS ───`, value: `> 🛒 **Buying:** \`${f1}\`\n> 💵 **Rate:** \`${f2}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildTapSim(f1, f2) {
  return baseEmbed(`${E.tap}  Tap Simulator Buying Stock`, 0x9B59B6)
    .setDescription('> We are currently **open** and buying!\n> Open a ticket to sell.\n\u200b')
    .addFields(
      { name: `${E.tap}  ─── TOKENS ───`, value: `> 🛒 **Buying:** \`${f1}\`\n> 💵 **Rate:** \`${f2}\``, inline: false },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildRobux(normAmount, normRate, delivery, igAmount, igRate) {
  return baseEmbed(`💰  Robux Selling Stock`, 0x00B06B)
    .setDescription(
      '> We are currently **selling** Robux!\n' +
      '> ⚠️ **We do NOT cover tax — buyer pays tax.**\n' +
      '> Open a ticket to buy.\n\u200b'
    )
    .addFields(
      {
        name: `💰  ─── NORMAL ROBUX ───`,
        value: `> 📦 **Amount:** \`${normAmount}\`\n> 💵 **Rate:** \`${normRate}\`\n> 🚚 **Delivery:** \`${delivery}\``,
        inline: false
      },
      {
        name: `🎮  ─── IN-GAME ROBUX ───`,
        value: `> 📦 **Amount:** \`${igAmount}\`\n> 💵 **Rate:** \`${igRate}\`\n> 🚚 **Delivery:** \`${delivery}\``,
        inline: false
      },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildDonutMoney(moneyAmount, moneyRate, skellyAmount, skellyRate) {
  return baseEmbed(`${E.money}  DonutSMP Buying Stock`, 0xF4A223)
    .setDescription(
      `> ${E.money} ${E.spawner} We are currently **buying** DonutSMP items!\n` +
      `> Open a ticket to sell.\n\u200b`
    )
    .addFields(
      {
        name: `${E.money}  ─── IN-GAME MONEY ───`,
        value: `> 🛒 **Buying:** \`${moneyAmount}\`\n> 💵 **Rate:** \`${moneyRate}\``,
        inline: false,
      },
      {
        name: `${E.spawner}  ─── SKELLYS ───`,
        value: `> 🛒 **Buying:** \`${skellyAmount}\`\n> 💵 **Rate:** \`${skellyRate}\``,
        inline: false,
      },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}

function buildDonutSkelly(budget, pricePerSpawner) {
  return baseEmbed(`${E.spawner}  DonutSMP Skelly Buying Stock`, 0x9B59B6)
    .setDescription(
      `> ${E.spawner} 💀 ☠️ 🦴 👻 We are **buying Skelly Spawners**!\n` +
      `> Pay with **in-game money** · Open a ticket to sell.\n\u200b`
    )
    .addFields(
      {
        name: `${E.money}  ─── BUDGET ───`,
        value: `> ${E.money} **Money to Spend:** \`${budget}\``,
        inline: false,
      },
      {
        name: `${E.spawner}  ─── PRICE PER SPAWNER ───`,
        value: `> ${E.spawner} **Paying:** \`${pricePerSpawner}\` per spawner`,
        inline: false,
      },
      { name: '\u200b', value: `🕒 **Last Updated:** ${timestamp()}`, inline: false }
    );
}
async function findExistingMessage(channel, game) {
  const targetTitle = GAME_TITLES[game];
  if (!targetTitle) return null;

  try {
    // Fetch up to 100 recent messages and find a bot embed matching the title
    const messages = await channel.messages.fetch({ limit: 100 });
    for (const msg of messages.values()) {
      if (!msg.author.bot) continue;
      for (const embed of msg.embeds) {
        if (embed.title && embed.title.includes(targetTitle)) {
          return msg;
        }
      }
    }
  } catch {}
  return null;
}

// ── Modal helpers ─────────────────────────────────────────────────
function twoFieldModal(id, title, f1l, f1p, f2l, f2p) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field1').setLabel(f1l).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f1p)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('field2').setLabel(f2l).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(f2p)
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
        .setLabel('Items (emoji + name, one per line)')
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
    .setDescription('Post or update a buying stock embed in this channel'),

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
          new StringSelectMenuOptionBuilder().setLabel('Tap Simulator').setDescription('Tap Simulator tokens').setValue('tapsim').setEmoji({ id: '1500644044571938826', name: 'tapsim' }),
          new StringSelectMenuOptionBuilder().setLabel('Robux').setDescription('Selling Robux — buyer pays tax').setValue('robux').setEmoji('💰'),
          new StringSelectMenuOptionBuilder().setLabel('DonutSMP — Money & Skellys').setDescription('Buying in-game money and skellys').setValue('donutmoney').setEmoji({ id: '1510534554065178744', name: 'money_' }),
          new StringSelectMenuOptionBuilder().setLabel('DonutSMP — Skelly Spawners').setDescription('Buying skelly spawners with in-game money').setValue('donutskelly').setEmoji({ id: '1510534341124558888', name: 'spawner' })
        )
    );

    await interaction.reply({
      content: '## 📋 Update Stock\nChoose which game to post or update:',
      components: [row],
      ephemeral: true,
    });
  },

  // Store channel per pending select so the modal knows where to edit
  _pendingChannels: new Map(),

  async handleSelect(interaction) {
    const game = interaction.values[0];

    // Remember which channel this came from so handleModal can find it
    this._pendingChannels.set(interaction.user.id, interaction.channelId);

    let modal;
    switch (game) {
      case 'ps99':      modal = fourFieldModal('stock_ps99',      'PS99 Stock',           'Gems — Amount Buying', '500B',          'Gems — Rate',  '$1 per 10B',    'RAP — Amount Buying', '200B RAP',      'RAP — Rate',   '$1 per 5B RAP'); break;
      case 'petsgo':    modal = fourFieldModal('stock_petsgo',    'Pets Go Stock',         'Gems — Amount Buying', '500B',          'Gems — Rate',  '$1 per 10B',    'RAP — Amount Buying', '200B RAP',      'RAP — Rate',   '$1 per 5B RAP'); break;
      case 'mm2':       modal = itemsModal('stock_mm2',      'MM2 Stock');       break;
      case 'dahood':    modal = itemsModal('stock_dahood',   'Da Hood Stock');   break;
      case 'limiteds':  modal = itemsModal('stock_limiteds', 'Limiteds Stock');  break;
      case 'deathball': modal = twoFieldModal('stock_deathball', 'Death Ball Stock',   'Amount Buying', '10,000 tokens', 'Rate', '$1 per 1,000 tokens'); break;
      case 'bladeball': modal = twoFieldModal('stock_bladeball', 'Blade Ball Stock',   'Amount Buying', '5,000 tokens',  'Rate', '$1 per 500 tokens');   break;
      case 'gag':       modal = twoFieldModal('stock_gag',       'Grow a Garden Stock', 'Amount Buying', '10,000 tokens', 'Rate', '$1 per 1,000 tokens'); break;
      case 'tapsim':    modal = twoFieldModal('stock_tapsim',     'Tap Sim Stock',       'Amount Buying', '50,000 tokens', 'Rate', '$1 per 5,000 tokens'); break;
      case 'donutmoney': modal = fourFieldModal('stock_donutmoney', 'DonutSMP Stock', 'Money — Amount Buying', 'e.g. $500M', 'Money — Rate', 'e.g. $1 per 10M', 'Skellys — Amount Buying', 'e.g. 50 skellys', 'Skellys — Rate', 'e.g. $1 per skelly'); break;
      case 'donutskelly': modal = twoFieldModal('stock_donutskelly', 'DonutSMP Skelly Spawners', 'Budget (in-game money to spend)', 'e.g. $500M in-game', 'Price Per Spawner', 'e.g. $10M per spawner'); break;
        const m = new ModalBuilder().setCustomId('stock_robux').setTitle('Robux Stock');
        m.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('field1').setLabel('Normal Robux — Amount Selling').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 10,000 Robux')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('field2').setLabel('Normal Robux — Rate').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. $1 per 100 Robux')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('field3').setLabel('Normal Robux — Delivery Method').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. Gamepass, Group Funds')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('field4').setLabel('In-Game Robux — Amount Selling').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 5,000 Robux')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('field5').setLabel('In-Game Robux — Rate').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. $1 per 80 Robux')
          )
        );
        modal = m;
        break;
      }
      default: return interaction.reply({ content: 'Unknown game.', ephemeral: true });
    }

    await interaction.showModal(modal);
  },

  async handleModal(interaction, client) {
    const id = interaction.customId;

    // Work out which game this modal belongs to
    const gameMap = {
      stock_ps99: 'ps99', stock_petsgo: 'petsgo', stock_mm2: 'mm2',
      stock_dahood: 'dahood', stock_limiteds: 'limiteds', stock_deathball: 'deathball',
      stock_bladeball: 'bladeball', stock_gag: 'gag', stock_tapsim: 'tapsim', stock_robux: 'robux',
      stock_donutmoney: 'donutmoney', stock_donutskelly: 'donutskelly',
    };
    const game = gameMap[id];
    if (!game) return interaction.reply({ content: 'Unknown stock type.', ephemeral: true });

    // Build the new embed
    let embed;
    if (id === 'stock_ps99')      embed = buildPS99(      interaction.fields.getTextInputValue('field1'), interaction.fields.getTextInputValue('field2'), interaction.fields.getTextInputValue('field3'), interaction.fields.getTextInputValue('field4'));
    if (id === 'stock_petsgo')    embed = buildPetsGo(    interaction.fields.getTextInputValue('field1'), interaction.fields.getTextInputValue('field2'), interaction.fields.getTextInputValue('field3'), interaction.fields.getTextInputValue('field4'));
    if (id === 'stock_mm2')       embed = buildMM2(       interaction.fields.getTextInputValue('items'),  interaction.fields.getTextInputValue('rate'));
    if (id === 'stock_dahood')    embed = buildDaHood(    interaction.fields.getTextInputValue('items'),  interaction.fields.getTextInputValue('rate'));
    if (id === 'stock_limiteds')  embed = buildLimiteds(  interaction.fields.getTextInputValue('items'),  interaction.fields.getTextInputValue('rate'));
    if (id === 'stock_deathball') embed = buildDeathBall( interaction.fields.getTextInputValue('field1'), interaction.fields.getTextInputValue('field2'));
    if (id === 'stock_bladeball') embed = buildBladeBall( interaction.fields.getTextInputValue('field1'), interaction.fields.getTextInputValue('field2'));
    if (id === 'stock_gag')       embed = buildGAG(       interaction.fields.getTextInputValue('field1'), interaction.fields.getTextInputValue('field2'));
    if (id === 'stock_tapsim')    embed = buildTapSim(    interaction.fields.getTextInputValue('field1'), interaction.fields.getTextInputValue('field2'));
    if (id === 'stock_robux')     embed = buildRobux(
      interaction.fields.getTextInputValue('field1'),
      interaction.fields.getTextInputValue('field2'),
      interaction.fields.getTextInputValue('field3'),
      interaction.fields.getTextInputValue('field4'),
      interaction.fields.getTextInputValue('field5')
    );
    if (id === 'stock_donutmoney')  embed = buildDonutMoney(
      interaction.fields.getTextInputValue('field1'),
      interaction.fields.getTextInputValue('field2'),
      interaction.fields.getTextInputValue('field3'),
      interaction.fields.getTextInputValue('field4')
    );
    if (id === 'stock_donutskelly') embed = buildDonutSkelly(
      interaction.fields.getTextInputValue('field1'),
      interaction.fields.getTextInputValue('field2')
    );

    // Resolve channel — use saved channel from select, fall back to current
    const channelId = this._pendingChannels.get(interaction.user.id) || interaction.channelId;
    this._pendingChannels.delete(interaction.user.id);
    const channel = client.channels.cache.get(channelId) || interaction.channel;

    // Try to find and edit an existing stock message
    const existing = await findExistingMessage(channel, game);
    if (existing) {
      await existing.edit({ embeds: [embed] });
      await interaction.reply({ content: '✅ Stock updated!', ephemeral: true });
    } else {
      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ Stock posted!', ephemeral: true });
    }
  },
};
