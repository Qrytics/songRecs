import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import {
  energyLabel,
  moodLabel,
  danceabilityLabel,
  acousticnessLabel,
  progressBar,
  getMusicTwin,
} from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('musicdna')
  .setDescription('View your Music DNA — a personality profile built from your songs');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const discordId = interaction.user.id;

  try {
    const userResult = await pool.query(
      `SELECT u.id, u.username, tv.*
       FROM users u
       JOIN taste_vectors tv ON tv.user_id = u.id
       WHERE u.discord_id = $1`,
      [discordId]
    );

    if (userResult.rows.length === 0) {
      await interaction.editReply(
        '❌ No taste profile found. Use `/addplaylist <url>` to get started!'
      );
      return;
    }

    const row = userResult.rows[0];
    const twin = await getMusicTwin(row.id);

    const energyPct = Math.round(row.energy * 100);
    const dancePct = Math.round(row.danceability * 100);
    const valencePct = Math.round(row.valence * 100);
    const acousticPct = Math.round(row.acousticness * 100);
    const obscurity = Math.round(row.obscurity_score);

    const embed = new EmbedBuilder()
      .setTitle(`🧬 ${row.username}'s Music DNA`)
      .setColor(0x1db954)
      .addFields(
        {
          name: '🎸 Primary Genre',
          value: row.primary_genre ?? 'Unknown',
          inline: true,
        },
        {
          name: '🎭 Archetype',
          value: row.archetype ?? 'Unknown',
          inline: true,
        },
        {
          name: '📊 Songs Analyzed',
          value: `${row.song_count}`,
          inline: true,
        },
        {
          name: `⚡ Energy — ${energyPct}%`,
          value: `${progressBar(row.energy)} ${energyLabel(row.energy)}`,
          inline: false,
        },
        {
          name: `💃 Danceability — ${dancePct}%`,
          value: `${progressBar(row.danceability)} ${danceabilityLabel(row.danceability)}`,
          inline: false,
        },
        {
          name: `🌅 Mood — ${valencePct}%`,
          value: `${progressBar(row.valence)} ${moodLabel(row.valence)}`,
          inline: false,
        },
        {
          name: `🎵 Acousticness — ${acousticPct}%`,
          value: `${progressBar(row.acousticness)} ${acousticnessLabel(row.acousticness)}`,
          inline: false,
        },
        {
          name: '🕵️ Obscurity Score',
          value: `${obscurity}% — ${obscurity > 70 ? 'Very niche listener' : obscurity > 40 ? 'Mixed mainstream/indie' : 'Mainstream listener'}`,
          inline: false,
        }
      )
      .setTimestamp();

    if (twin) {
      embed.addFields({
        name: '👯 Music Twin',
        value: `**${twin.username}** (${Math.round(twin.similarity * 100)}% similarity)`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('musicDNA error:', err);
    await interaction.editReply('❌ Something went wrong generating your Music DNA.');
  }
}
