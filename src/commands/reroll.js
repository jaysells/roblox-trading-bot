const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const { pickEligibleWinners } = require('../utils/giveawayManager');
const redis = require('../utils/redis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reroll')
    .setDescription('Reroll a winner for a recently ended giveaway'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const endedIds = await redis.smembers('giveaways:ended');
    if (!endedIds || endedIds.length === 0) {
      return interaction.editReply({ content: 'No ended giveaways found.' });
    }

    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const eligible = [];

    for (const id of endedIds) {
      const raw = await redis.get(`giveaway:${id}`);
      if (!raw) continue;
      const g = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (g.endedAt && g.endedAt >= cutoff) eligible.push(g);
    }

    if (eligible.length === 0) {
      return interaction.editReply({ content: 'No giveaways ended in the last 48 hours.' });
    }

    const options = eligible.slice(0, 25).map(g =>
      new StringSelectMenuOptionBuilder()
        .setLabel(g.prize.slice(0, 100))
        .setValue(g.id)
        .setDescription(`${(g.entries || []).length} entries · Ended <t:${Math.floor(g.endedAt / 1000)}:R>`.slice(0, 100))
    );

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('reroll_select')
        .setPlaceholder('Select a giveaway to reroll')
        .addOptions(options)
    );

    await interaction.editReply({ content: 'Select a giveaway to reroll:', components: [row] });
  },

  async handleSelect(interaction, client) {
    await interaction.deferUpdate();

    const giveawayId = interaction.values[0];
    const raw = await redis.get(`giveaway:${giveawayId}`);
    if (!raw) return interaction.editReply({ content: 'Giveaway not found.', components: [] });

    const giveaway = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const entries = giveaway.entries || [];
    const alreadyWon = new Set(giveaway.selectedWinners || []);

    const pool = entries.filter(id => !alreadyWon.has(id));
    if (pool.length === 0) {
      return interaction.editReply({ content: 'No eligible entries left to reroll.', components: [] });
    }

    const guild = client.guilds.cache.get(giveaway.guildId);
    const [newWinner] = await pickEligibleWinners(guild, pool, 1, giveaway.requireCustomerRole);
    if (!newWinner) {
      return interaction.editReply({ content: 'No remaining entrant meets the requirements for this giveaway (e.g. Customer role).', components: [] });
    }

    giveaway.selectedWinners = [...(giveaway.selectedWinners || []), newWinner];
    await redis.set(`giveaway:${giveawayId}`, JSON.stringify(giveaway));

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel) {
      await channel
        .send(`🎉 **Reroll!** The new winner for **${giveaway.prize}** is <@${newWinner}>! Congratulations!`)
        .catch(() => {});
    }

    await interaction.editReply({ content: `Rerolled! New winner: <@${newWinner}>`, components: [] });
  },
};
