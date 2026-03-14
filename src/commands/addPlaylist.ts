import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import { parseAndStorePlaylist } from '../services/playlistParser';
import { computeAndStoreTasteVector } from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('addplaylist')
  .setDescription('Register your Spotify playlist with the bot')
  .addStringOption((option) =>
    option
      .setName('url')
      .setDescription('Your Spotify playlist URL')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const url = interaction.options.getString('url', true);
  const discordId = interaction.user.id;
  const username = interaction.user.username;

  try {
    // Upsert user
    const userResult = await pool.query(
      `INSERT INTO users (discord_id, username)
       VALUES ($1, $2)
       ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [discordId, username]
    );
    const userId: number = userResult.rows[0].id;

    await interaction.editReply('⏳ Fetching your playlist from Spotify… this may take a moment.');

    const { imported, skipped } = await parseAndStorePlaylist(userId, url);

    // Recompute taste vector
    await computeAndStoreTasteVector(userId);

    await interaction.editReply(
      `✅ Playlist imported!\n` +
        `• **${imported}** songs added to your library\n` +
        `• **${skipped}** songs skipped (missing audio features)\n\n` +
        `Your taste profile has been updated. Try \`/recommend\` or \`/musicdna\`!`
    );
  } catch (err) {
    console.error('addPlaylist error:', err);
    await interaction.editReply(
      '❌ Failed to import playlist. Make sure the URL is a valid public Spotify playlist.'
    );
  }
}
