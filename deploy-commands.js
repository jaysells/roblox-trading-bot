const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.TOKEN);

// Support multiple guild IDs separated by commas in .env
// e.g. GUILD_ID=123456789,987654321
const guildIds = process.env.GUILD_ID
  ? process.env.GUILD_ID.split(',').map(id => id.trim()).filter(Boolean)
  : [];

const REQUEST_TIMEOUT_MS = 20_000;

(async () => {
  if (guildIds.length === 0) {
    // No guild IDs — deploy globally
    try {
      console.log(`Deploying ${commands.length} commands globally...`);
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
      );
      console.log(`Successfully deployed ${data.length} commands globally.`);
    } catch (err) {
      console.error('Failed to deploy commands globally:', err.message);
    }
  } else {
    // Deploy to each guild — one guild's failure/timeout must not block the rest
    for (const guildId of guildIds) {
      try {
        console.log(`Deploying ${commands.length} commands to guild ${guildId}...`);
        const data = await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
          { body: commands, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
        );
        console.log(`Successfully deployed ${data.length} commands to guild ${guildId}.`);
      } catch (err) {
        console.error(`Failed to deploy commands to guild ${guildId}:`, err.message);
      }
    }
  }
})();
