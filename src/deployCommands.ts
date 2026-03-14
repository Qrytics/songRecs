import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import * as addPlaylist from './commands/addPlaylist';
import * as recommend from './commands/recommend';
import * as musicDNA from './commands/musicDNA';
import * as musicTwin from './commands/musicTwin';
import * as tasteDistance from './commands/tasteDistance';
import * as compatibility from './commands/compatibility';
import * as discover from './commands/discover';
import * as tasteLeaderboard from './commands/tasteLeaderboard';
import * as tasteProfile from './commands/tasteProfile';

dotenv.config();

const commands = [
  addPlaylist.data.toJSON(),
  recommend.data.toJSON(),
  musicDNA.data.toJSON(),
  musicTwin.data.toJSON(),
  tasteDistance.data.toJSON(),
  compatibility.data.toJSON(),
  discover.data.toJSON(),
  tasteLeaderboard.data.toJSON(),
  tasteProfile.data.toJSON(),
];

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands…`);

    if (guildId) {
      // Guild-scoped (instant, great for development)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`Successfully registered commands to guild ${guildId}`);
    } else {
      // Global (can take up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log('Successfully registered global commands');
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
