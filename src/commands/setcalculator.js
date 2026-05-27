const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissions');
const redis = require('../utils/redis');

const CALC_CHANNEL_KEY = 'calculator:channelId';

// Safe math evaluator — supports PEMDAS, exponents, parentheses
function evaluate(expr) {
  // Clean input
  let e = expr
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**')  // exponents
    .replace(/[^0-9+\-*/().%**]/g, '');

  if (!e) return null;

  // Must contain at least one operator to be a math expression
  if (!/[+\-*/%^()]/.test(expr)) return null;

  // Prevent empty or dangerous expressions
  if (e.length > 200) return null;

  try {
    // Use Function instead of eval for slightly safer scope
    const result = Function('"use strict"; return (' + e + ')')();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    // Round to avoid floating point weirdness like 0.1+0.2=0.30000000000000004
    return parseFloat(result.toPrecision(12));
  } catch {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcalculator')
    .setDescription('Set this channel as the calculator channel'),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }

    await redis.set(CALC_CHANNEL_KEY, interaction.channelId);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🧮  Calculator')
      .setDescription(
        'Type any math expression and I\'ll solve it!\n\u200b'
      )
      .addFields(
        {
          name: 'Supported Operations',
          value:
            '`+` Addition\n' +
            '`-` Subtraction\n' +
            '`*` Multiplication\n' +
            '`/` Division\n' +
            '`^` Exponents\n' +
            '`%` Modulo\n' +
            '`()` Parentheses (PEMDAS)',
          inline: true,
        },
        {
          name: 'Examples',
          value:
            '`4 / 2` → 2\n' +
            '`2^10` → 1024\n' +
            '`(3+5) * 2` → 16\n' +
            '`100 / 4 + 3^2` → 34\n' +
            '`sqrt not supported — use ^0.5`',
          inline: true,
        }
      )
      .setFooter({ text: 'Just type your expression — no command needed!' });

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Calculator channel set!', ephemeral: true });
  },

  CALC_CHANNEL_KEY,
  evaluate,
};
