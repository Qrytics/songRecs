import cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { pool } from '../db/schema';
import { computeAllUserSimilarities } from '../services/recommender';

/**
 * Picks a random user who has songs in their playlist, then picks a random
 * song from that user's playlist and posts it to the configured channel.
 */
async function postDailySong(client: Client): Promise<void> {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) {
    console.warn('DISCORD_CHANNEL_ID not set — skipping daily song post');
    return;
  }

  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) {
    console.warn(`Channel ${channelId} not found in cache`);
    return;
  }

  // Pick a random user who has at least one song
  const userResult = await pool.query(
    `SELECT u.id, u.username
     FROM users u
     WHERE EXISTS (SELECT 1 FROM playlists p WHERE p.user_id = u.id)
     ORDER BY RANDOM()
     LIMIT 1`
  );

  if (userResult.rows.length === 0) {
    console.log('No users with playlists — skipping daily song');
    return;
  }

  const user = userResult.rows[0];

  // Pick a random song from that user's playlist
  const songResult = await pool.query(
    `SELECT s.title, s.artist, s.album_art, s.spotify_url
     FROM playlists p
     JOIN songs s ON s.id = p.song_id
     WHERE p.user_id = $1
     ORDER BY RANDOM()
     LIMIT 1`,
    [user.id]
  );

  if (songResult.rows.length === 0) return;

  const song = songResult.rows[0];

  const embed = new EmbedBuilder()
    .setTitle('🎧 Daily Song')
    .setColor(0x1db954)
    .addFields(
      { name: "Today's Curator", value: user.username, inline: true },
      { name: 'Song', value: `**${song.title}** — ${song.artist}`, inline: false }
    )
    .setTimestamp();

  if (song.album_art) {
    embed.setThumbnail(song.album_art);
  }
  if (song.spotify_url) {
    embed.setURL(song.spotify_url);
    embed.setDescription(`[Listen on Spotify](${song.spotify_url})`);
  }

  await channel.send({ embeds: [embed] });

  // Log the daily song
  await pool.query(
    `INSERT INTO daily_history (user_id, song_id)
     SELECT $1, s.id
     FROM songs s
     WHERE s.title = $2 AND s.artist = $3
     LIMIT 1`,
    [user.id, song.title, song.artist]
  );

  // Also refresh similarity matrix daily
  try {
    await computeAllUserSimilarities();
    console.log('User similarity matrix refreshed');
  } catch (err) {
    console.error('Failed to refresh similarities:', err);
  }
}

export function startDailySongScheduler(client: Client): void {
  const cronExpression = process.env.DAILY_SONG_CRON ?? '0 12 * * *';

  if (!cron.validate(cronExpression)) {
    console.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  cron.schedule(cronExpression, async () => {
    console.log('Running daily song scheduler…');
    try {
      await postDailySong(client);
    } catch (err) {
      console.error('Daily song scheduler error:', err);
    }
  });

  console.log(`Daily song scheduler started (${cronExpression})`);
}
