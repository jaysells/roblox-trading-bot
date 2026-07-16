const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');
const { getBotLtcBalanceUsd } = require('../utils/ltcWallet');
const { getTotalStoreCreditCents, getStoreCreditCap } = require('../utils/storeCredit');

const PANEL_MESSAGE_KEY = 'inviterewardpanel:message';

function buildRulesEmbed() {
  return new EmbedBuilder()
    .setTitle('📨 Invite Rewards')
    .setDescription(
      'Invite people to the server and claim rewards once they count toward your total!\n\n' +
      '> 🕒 A join only counts after the invited member has stayed **24 hours**\n' +
      '> 🔞 Their account had to be at least **7 days old** when they joined\n' +
      '> 🔒 Each Discord account can only ever be credited once\n\n' +
      'Use `/invites` to check your current balance, then claim below.\n\n' +
      '**Claim (Money)** pays out instantly in LTC to your registered wallet.\n' +
      '**Claim (Store Credit)** adds to a running balance you can spend on anything in the shop.'
    )
    .setColor(0xF1C40F)
    .setFooter({ text: 'Money and store credit claims are automatic — no ticket needed' });
}

async function buildBalancesEmbed() {
  let ltcUsd = null;
  try {
    ltcUsd = await getBotLtcBalanceUsd();
  } catch (e) {
    console.error('[inviterewardspanel] LTC balance fetch failed:', e.message);
  }
  const scCents = await getTotalStoreCreditCents();
  const capCents = await getStoreCreditCap();
  const remainingText = capCents != null
    ? `$${Math.max(0, (capCents - scCents) / 100).toFixed(2)}`
    : 'Unlimited';

  return new EmbedBuilder()
    .setTitle('💳 Payout Balances')
    .setColor(0x2ECC71)
    .addFields(
      { name: '🪙 LTC Wallet Remaining',   value: ltcUsd != null ? `$${ltcUsd.toFixed(2)}` : '*(unavailable)*', inline: true },
      { name: '📈 Store Credit Remaining', value: remainingText, inline: true },
    )
    .setTimestamp();
}

function buildButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('invreward_claim_money').setLabel('Claim (Money)').setStyle(ButtonStyle.Success).setEmoji('💰'),
    new ButtonBuilder().setCustomId('invreward_claim_capes').setLabel('Claim (Store Credit)').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
    new ButtonBuilder().setCustomId('cape_set_wallet').setLabel('Set Wallet').setStyle(ButtonStyle.Secondary).setEmoji('👛'),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviterewardspanel')
    .setDescription('Post the invite rewards claim panel in this channel')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to post in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const msg = await targetChannel.send({
      embeds: [buildRulesEmbed(), await buildBalancesEmbed()],
      components: [buildButtonRow()],
    });

    await redis.set(PANEL_MESSAGE_KEY, JSON.stringify({ channelId: targetChannel.id, messageId: msg.id }));
    return interaction.editReply({ content: 'Invite rewards panel posted!' });
  },

  // Called periodically to refresh the balances embed in place — no channel
  // renames, no rate-limit concerns, just an ordinary message edit.
  async updatePanel(client) {
    const raw = await redis.get(PANEL_MESSAGE_KEY);
    if (!raw) return;
    const { channelId, messageId } = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;

    await msg.edit({ embeds: [buildRulesEmbed(), await buildBalancesEmbed()] }).catch(() => {});
  },
};
