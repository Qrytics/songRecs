import { Client, Collection, Events, GatewayIntentBits, Interaction } from 'discord.js';
import dotenv from 'dotenv';
import { initDatabase } from './db/schema';
import { startDailySongScheduler } from './scheduler/dailySong';

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

// ---------------------------------------------------------------------------
// Command interface
// ---------------------------------------------------------------------------

interface Command {
  data: { name: string; toJSON: () => unknown };
  execute: (interaction: import('discord.js').ChatInputCommandInteraction) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Build the command registry
// ---------------------------------------------------------------------------

const commandModules: Command[] = [
  addPlaylist,
  recommend,
  musicDNA,
  musicTwin,
  tasteDistance,
  compatibility,
  discover,
  tasteLeaderboard,
  tasteProfile,
];

const commands = new Collection<string, Command>();
for (const mod of commandModules) {
  commands.set(mod.data.name, mod);
}

// ---------------------------------------------------------------------------
// Discord client
// ---------------------------------------------------------------------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  try {
    await initDatabase();
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }

  startDailySongScheduler(client);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const reply = {
      content: '❌ There was an error while executing this command.',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// ---------------------------------------------------------------------------
// Start the bot
// ---------------------------------------------------------------------------

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(token);
