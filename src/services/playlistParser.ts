import { pool } from '../db/schema';
import {
  fetchPlaylistTracks,
  enrichTracksWithFeatures,
  extractPlaylistId,
  SpotifyTrack,
} from './spotify';

export interface ParseResult {
  imported: number;
  skipped: number;
  tracks: SpotifyTrack[];
}

/**
 * Given a Spotify playlist URL and a database user id, fetches all tracks,
 * stores them in the songs table and links them to the user in the playlists
 * table.  Returns a summary of what was imported.
 *
 * All tracks are processed within a single database transaction using one
 * connection, avoiding the overhead of per-track connection acquisition.
 */
export async function parseAndStorePlaylist(
  userId: number,
  playlistUrl: string
): Promise<ParseResult> {
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) {
    throw new Error('Invalid Spotify playlist URL');
  }

  const tracks = await fetchPlaylistTracks(playlistId);
  if (tracks.length === 0) {
    return { imported: 0, skipped: 0, tracks: [] };
  }

  const enriched = await enrichTracksWithFeatures(tracks);
  const tracksWithFeatures = enriched.filter((t) => t.features !== null);
  const skipped = enriched.length - tracksWithFeatures.length;

  if (tracksWithFeatures.length === 0) {
    return { imported: 0, skipped, tracks: enriched };
  }

  let imported = 0;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const track of tracksWithFeatures) {
      // track.features is guaranteed non-null by the filter above
      const features = track.features!;

      const songResult = await client.query(
        `INSERT INTO songs
           (spotify_id, title, artist, album, album_art, spotify_url, duration_ms,
            popularity, tempo, energy, danceability, valence, acousticness,
            instrumentalness, speechiness, loudness, genres)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (spotify_id) DO UPDATE SET
           popularity = EXCLUDED.popularity,
           tempo      = EXCLUDED.tempo,
           energy     = EXCLUDED.energy,
           danceability = EXCLUDED.danceability,
           valence    = EXCLUDED.valence,
           acousticness = EXCLUDED.acousticness,
           instrumentalness = EXCLUDED.instrumentalness,
           speechiness = EXCLUDED.speechiness,
           loudness   = EXCLUDED.loudness,
           genres     = EXCLUDED.genres
         RETURNING id`,
        [
          track.spotifyId,
          track.title,
          track.artist,
          track.album,
          track.albumArt,
          track.spotifyUrl,
          track.durationMs,
          track.popularity,
          features.tempo,
          features.energy,
          features.danceability,
          features.valence,
          features.acousticness,
          features.instrumentalness,
          features.speechiness,
          features.loudness,
          track.genres,
        ]
      );

      const songId: number = songResult.rows[0].id;

      await client.query(
        `INSERT INTO playlists (user_id, song_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, song_id) DO NOTHING`,
        [userId, songId]
      );

      imported++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to store playlist tracks:', err);
    throw err;
  } finally {
    client.release();
  }

  return { imported, skipped, tracks: enriched };
}
