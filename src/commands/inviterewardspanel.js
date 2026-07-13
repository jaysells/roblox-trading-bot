const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { hasPermission, CUSTOMER_ROLE_ID } = require('../utils/permissions');

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

    const embed = new EmbedBuilder()
      .setTitle('📨 Invite Rewards')
      .setDescription(
        'Invite people to the server and claim rewards once they count toward your total!\n\n' +
        '> 🕒 A join only counts after the invited member has stayed **24 hours**\n' +
        '> 🔞 Their account had to be at least **7 days old** when they joined\n' +
        '> 🔒 Each Discord account can only ever be credited once\n' +
        `> 🛍️ You need the <@&${CUSTOMER_ROLE_ID}> role (make a purchase first) to claim\n\n` +
        'Use `/invites` to check your current balance, then claim below.\n\n' +
        '**Claim (Money)** pays out instantly in LTC to your registered wallet.\n' +
        '**Claim (Store Credit)** adds to a running balance you can spend on anything in the shop.'
      )
      .setColor(0xF1C40F)
      .setFooter({ text: 'Money and store credit claims are automatic — no ticket needed' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('invreward_claim_money').setLabel('Claim (Money)').setStyle(ButtonStyle.Success).setEmoji('💰'),
      new ButtonBuilder().setCustomId('invreward_claim_capes').setLabel('Claim (Store Credit)').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
      new ButtonBuilder().setCustomId('cape_set_wallet').setLabel('Set Wallet').setStyle(ButtonStyle.Secondary).setEmoji('👛'),
    );

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: 'Invite rewards panel posted!', ephemeral: true });
  },
};
