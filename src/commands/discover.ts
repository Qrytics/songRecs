import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import { discoverSongs } from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('discover')
  .setDescription(
    'Discover songs liked by people with similar taste that you haven\'t heard yet'
  );

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
    const songs = await discoverSongs(userId, 5);

    if (songs.length === 0) {
      await interaction.editReply(
        '🎵 Nothing to discover yet. More users need to add their playlists!'
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Discovery Mode — ${interaction.user.username}`)
      .setColor(0x1db954)
      .setDescription('Songs loved by people with similar taste that aren\'t in your playlist:')
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
    console.error('discover error:', err);
    await interaction.editReply('❌ Something went wrong with discovery mode.');
  }
}
