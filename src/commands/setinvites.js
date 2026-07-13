const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { getInviterStats, bumpInviterStats } = require('../utils/inviteTracker');
const { LOG_CHANNEL_ID } = require('../utils/ltcPoller');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setinvites')
    .setDescription('Manually add to (or subtract from) a member\'s invite stats')
    .addUserOption(o => o.setName('user').setDescription('Member to adjust').setRequired(true))
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Which stat to adjust')
        .setRequired(true)
        .addChoices(
          { name: 'Invites (joins)',           value: 'joins' },
          { name: 'Leaves',                    value: 'leaves' },
          { name: 'Alts',                       value: 'alts' },
          { name: 'Claimed (already redeemed)', value: 'claimed' },
        )
    )
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to add — use a negative number to subtract').setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const type   = interaction.options.getString('type');
    const amount = interaction.options.getInteger('amount');

    if (amount === 0) {
      return interaction.reply({ content: 'Amount cannot be 0.', ephemeral: true });
    }

    await bumpInviterStats(target.id, { [type]: amount });
    const stats = await getInviterStats(target.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ Invite Stats Adjusted')
      .setColor(0x57F287)
      .addFields(
        { name: 'User',      value: `<@${target.id}>`,               inline: true },
        { name: 'Field',     value: type,                            inline: true },
        { name: 'Change',    value: `${amount > 0 ? '+' : ''}${amount}`, inline: true },
        { name: 'Invites',   value: `${stats.net}`,                  inline: true },
        { name: 'Claimable', value: `${stats.claimable}`,            inline: true },
        { name: 'Alts',      value: `${stats.alts}`,                 inline: true },
        { name: 'Left',      value: `${stats.leaves}`,               inline: true },
      )
      .setTimestamp();

    const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🛠️ Invite Stats Manually Adjusted')
            .setColor(0xF1C40F)
            .addFields(
              { name: 'Staff',  value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Target', value: `<@${target.id}>`,           inline: true },
              { name: 'Change', value: `${type} ${amount > 0 ? '+' : ''}${amount}`, inline: true },
            )
            .setTimestamp(),
        ],
      }).catch(() => {});
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
