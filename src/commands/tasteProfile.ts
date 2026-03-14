import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import { computeAndStoreTasteVector } from '../services/recommender';
import {
  energyLabel,
  moodLabel,
  danceabilityLabel,
  progressBar,
} from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('tasteprofile')
  .setDescription('View a summary of your music taste profile');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const discordId = interaction.user.id;

  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE discord_id = $1`,
      [discordId]
    );

    if (userResult.rows.length === 0) {
      await interaction.editReply(
        '❌ You haven\'t registered a playlist yet. Use `/addplaylist <url>` first!'
      );
      return;
    }

    const userId: number = userResult.rows[0].id;

    // Recompute to ensure it's fresh
    const tv = await computeAndStoreTasteVector(userId);

    if (!tv) {
      await interaction.editReply(
        '❌ No songs in your playlist with audio features. Try adding more songs.'
      );
      return;
    }

    const tvResult = await pool.query(
      `SELECT * FROM taste_vectors WHERE user_id = $1`,
      [userId]
    );

    const row = tvResult.rows[0];

    const embed = new EmbedBuilder()
      .setTitle(`🎵 ${interaction.user.username}'s Taste Profile`)
      .setColor(0x1db954)
      .addFields(
        { name: '🎸 Primary Genre', value: row.primary_genre ?? 'Unknown', inline: true },
        { name: '🎭 Archetype', value: row.archetype ?? 'Unknown', inline: true },
        { name: '📊 Songs', value: `${row.song_count}`, inline: true },
        {
          name: `⚡ Energy`,
          value: `${progressBar(row.energy)} ${Math.round(row.energy * 100)}% — ${energyLabel(row.energy)}`,
          inline: false,
        },
        {
          name: `💃 Danceability`,
          value: `${progressBar(row.danceability)} ${Math.round(row.danceability * 100)}% — ${danceabilityLabel(row.danceability)}`,
          inline: false,
        },
        {
          name: `😊 Mood`,
          value: `${progressBar(row.valence)} ${Math.round(row.valence * 100)}% — ${moodLabel(row.valence)}`,
          inline: false,
        },
        {
          name: '🕵️ Obscurity',
          value: `${Math.round(row.obscurity_score)}%`,
          inline: true,
        },
        {
          name: '🎵 Avg Tempo',
          value: `${Math.round(row.tempo)} BPM`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('tasteProfile error:', err);
    await interaction.editReply('❌ Something went wrong loading your taste profile.');
  }
}
