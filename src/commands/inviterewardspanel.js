const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { hasPermission } = require('../utils/permissions');

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
        '> 🔒 Each Discord account can only ever be credited once\n\n' +
        'Use `/invites` to check your current balance, then claim below.'
      )
      .setColor(0xF1C40F)
      .setFooter({ text: 'Claims are reviewed and fulfilled by staff via ticket' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('invreward_claim_money').setLabel('Claim (Money)').setStyle(ButtonStyle.Success).setEmoji('💰'),
      new ButtonBuilder().setCustomId('invreward_claim_capes').setLabel('Claim (Capes)').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
      new ButtonBuilder().setCustomId('cape_set_wallet').setLabel('Set Wallet').setStyle(ButtonStyle.Secondary).setEmoji('👛'),
    );

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: 'Invite rewards panel posted!', ephemeral: true });
  },
};
