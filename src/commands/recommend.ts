import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import { recommendSongs } from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('recommend')
  .setDescription('Get 5 song recommendations based on your music taste');

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
    const songs = await recommendSongs(userId, 5);

    if (songs.length === 0) {
      await interaction.editReply(
        '🎵 No recommendations found yet. Add more songs with `/addplaylist` so we have more to compare!'
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎧 Recommendations for ${interaction.user.username}`)
      .setColor(0x1db954)
      .setDescription('Based on your music taste profile, here are 5 songs you might love:')
      .setTimestamp();

    songs.forEach((song, index) => {
      embed.addFields({
        name: `${index + 1}. ${song.title}`,
        value: `**${song.artist}**${song.album ? ` · ${song.album}` : ''}\n[Open in Spotify](${song.spotify_url})`,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('recommend error:', err);
    await interaction.editReply('❌ Something went wrong generating recommendations.');
  }
}
