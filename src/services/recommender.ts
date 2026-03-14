import { pool } from '../db/schema';

export interface TasteVector {
  userId: number;
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
}

export interface SongRow {
  id: number;
  spotify_id: string;
  title: string;
  artist: string;
  album: string;
  album_art: string;
  spotify_url: string;
  popularity: number;
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
}

export interface UserSimilarity {
  userId: number;
  username: string;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function vectorFromSong(song: Partial<SongRow>): number[] {
  return [
    song.tempo ?? 0,
    song.energy ?? 0,
    song.danceability ?? 0,
    song.valence ?? 0,
    song.acousticness ?? 0,
    song.instrumentalness ?? 0,
    song.speechiness ?? 0,
    song.loudness ?? 0,
  ];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ---------------------------------------------------------------------------
// Taste vector computation
// ---------------------------------------------------------------------------

export async function computeAndStoreTasteVector(userId: number): Promise<TasteVector | null> {
  const result = await pool.query(
    `SELECT s.tempo, s.energy, s.danceability, s.valence, s.acousticness,
            s.instrumentalness, s.speechiness, s.loudness, s.popularity, s.genres
     FROM playlists p
     JOIN songs s ON s.id = p.song_id
     WHERE p.user_id = $1
       AND s.tempo IS NOT NULL`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const rows = result.rows;
  const count = rows.length;

  const avg = (field: string) =>
    rows.reduce((sum: number, r: Record<string, number>) => sum + (r[field] ?? 0), 0) / count;

  const tempoAvg = avg('tempo');
  const energyAvg = avg('energy');
  const danceabilityAvg = avg('danceability');
  const valenceAvg = avg('valence');
  const acousticnessAvg = avg('acousticness');
  const instrumentalnessAvg = avg('instrumentalness');
  const speechinessAvg = avg('speechiness');
  const loudnessAvg = avg('loudness');
  const popularityAvg = avg('popularity');

  // Primary genre
  const genreCounts = new Map<string, number>();
  for (const row of rows) {
    const genres: string[] = row.genres ?? [];
    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  let primaryGenre = 'Unknown';
  let maxCount = 0;
  for (const [genre, cnt] of genreCounts) {
    if (cnt > maxCount) {
      maxCount = cnt;
      primaryGenre = genre;
    }
  }

  // Archetype
  const archetype = computeArchetype(energyAvg, danceabilityAvg, valenceAvg, popularityAvg);
  const obscurityScore = 100 - popularityAvg;

  await pool.query(
    `INSERT INTO taste_vectors
       (user_id, tempo, energy, danceability, valence, acousticness, instrumentalness,
        speechiness, loudness, primary_genre, archetype, obscurity_score, song_count, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       tempo=$2, energy=$3, danceability=$4, valence=$5, acousticness=$6,
       instrumentalness=$7, speechiness=$8, loudness=$9, primary_genre=$10,
       archetype=$11, obscurity_score=$12, song_count=$13, updated_at=NOW()`,
    [
      userId,
      tempoAvg,
      energyAvg,
      danceabilityAvg,
      valenceAvg,
      acousticnessAvg,
      instrumentalnessAvg,
      speechinessAvg,
      loudnessAvg,
      primaryGenre,
      archetype,
      obscurityScore,
      count,
    ]
  );

  return {
    userId,
    tempo: tempoAvg,
    energy: energyAvg,
    danceability: danceabilityAvg,
    valence: valenceAvg,
    acousticness: acousticnessAvg,
    instrumentalness: instrumentalnessAvg,
    speechiness: speechinessAvg,
    loudness: loudnessAvg,
  };
}

function computeArchetype(
  energy: number,
  danceability: number,
  valence: number,
  popularity: number
): string {
  const obscurity = 100 - popularity;
  if (energy > 0.75 && danceability > 0.7) return 'Party Starter';
  if (energy < 0.45 && danceability < 0.45) return 'Chill Wanderer';
  if (energy > 0.65 && obscurity > 60) return 'Indie Explorer';
  if (valence > 0.7 && popularity > 60) return 'Pop Enthusiast';
  if (energy > 0.6 && valence < 0.4) return 'Intense Listener';
  return 'Eclectic Curator';
}

// ---------------------------------------------------------------------------
// Recommendations (content-based filtering)
// ---------------------------------------------------------------------------

export async function recommendSongs(userId: number, limit = 5): Promise<SongRow[]> {
  const tvResult = await pool.query(
    `SELECT * FROM taste_vectors WHERE user_id = $1`,
    [userId]
  );

  if (tvResult.rows.length === 0) return [];
  const tv = tvResult.rows[0];
  const userVector = [
    tv.tempo, tv.energy, tv.danceability, tv.valence,
    tv.acousticness, tv.instrumentalness, tv.speechiness, tv.loudness,
  ].map((v: unknown) => Number(v));

  // Fetch songs NOT already in the user's playlist that have full features
  const candidatesResult = await pool.query(
    `SELECT s.*
     FROM songs s
     WHERE s.tempo IS NOT NULL
       AND s.id NOT IN (
         SELECT song_id FROM playlists WHERE user_id = $1
       )
     ORDER BY s.created_at DESC
     LIMIT 500`,
    [userId]
  );

  const candidates: SongRow[] = candidatesResult.rows;

  const scored = candidates
    .map((song) => ({
      song,
      score: cosineSimilarity(userVector, vectorFromSong(song)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.song);

  return scored;
}

// ---------------------------------------------------------------------------
// User similarity & music twins
// ---------------------------------------------------------------------------

export async function computeAllUserSimilarities(): Promise<void> {
  const usersResult = await pool.query(
    `SELECT u.id, tv.tempo, tv.energy, tv.danceability, tv.valence,
            tv.acousticness, tv.instrumentalness, tv.speechiness, tv.loudness
     FROM users u
     JOIN taste_vectors tv ON tv.user_id = u.id`
  );

  const users = usersResult.rows;
  if (users.length < 2) return;

  // Compute all pairwise similarities in memory, then bulk-upsert
  const pairs: Array<{ aId: number; bId: number; sim: number }> = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i];
      const b = users[j];
      const vecA = [a.tempo, a.energy, a.danceability, a.valence, a.acousticness, a.instrumentalness, a.speechiness, a.loudness].map(Number);
      const vecB = [b.tempo, b.energy, b.danceability, b.valence, b.acousticness, b.instrumentalness, b.speechiness, b.loudness].map(Number);
      pairs.push({ aId: a.id, bId: b.id, sim: cosineSimilarity(vecA, vecB) });
    }
  }

  if (pairs.length === 0) return;

  // Bulk upsert using UNNEST to minimise round-trips
  const aIds = pairs.map((p) => p.aId);
  const bIds = pairs.map((p) => p.bId);
  const sims = pairs.map((p) => p.sim);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO user_similarity (user_a_id, user_b_id, similarity, computed_at)
       SELECT * FROM UNNEST($1::int[], $2::int[], $3::float[], ARRAY_FILL(NOW()::timestamp, ARRAY[$4::int]))
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE
         SET similarity = EXCLUDED.similarity, computed_at = NOW()`,
      [aIds, bIds, sims, pairs.length]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getMusicTwin(userId: number): Promise<UserSimilarity | null> {
  const result = await pool.query(
    `SELECT
       CASE WHEN us.user_a_id = $1 THEN us.user_b_id ELSE us.user_a_id END AS twin_id,
       u.username,
       us.similarity
     FROM user_similarity us
     JOIN users u ON u.id = CASE WHEN us.user_a_id = $1 THEN us.user_b_id ELSE us.user_a_id END
     WHERE (us.user_a_id = $1 OR us.user_b_id = $1)
     ORDER BY us.similarity DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { userId: row.twin_id, username: row.username, similarity: row.similarity };
}

export async function getUserSimilarity(
  userIdA: number,
  userIdB: number
): Promise<number> {
  const [a, b] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
  const result = await pool.query(
    `SELECT similarity FROM user_similarity
     WHERE user_a_id = $1 AND user_b_id = $2`,
    [a, b]
  );
  if (result.rows.length === 0) return 0;
  return result.rows[0].similarity as number;
}

// ---------------------------------------------------------------------------
// Discovery (collaborative filtering)
// ---------------------------------------------------------------------------

export async function discoverSongs(userId: number, limit = 5): Promise<SongRow[]> {
  const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD ?? '0.75');

  // Find similar users above threshold
  const similarUsers = await pool.query(
    `SELECT
       CASE WHEN us.user_a_id = $1 THEN us.user_b_id ELSE us.user_a_id END AS similar_id
     FROM user_similarity us
     WHERE (us.user_a_id = $1 OR us.user_b_id = $1)
       AND us.similarity >= $2
     ORDER BY us.similarity DESC
     LIMIT 10`,
    [userId, threshold]
  );

  if (similarUsers.rows.length === 0) {
    // Fallback to content-based
    return recommendSongs(userId, limit);
  }

  const similarIds: number[] = similarUsers.rows.map((r: { similar_id: number }) => r.similar_id);

  const result = await pool.query(
    `SELECT s.*, COUNT(*) AS freq
     FROM playlists p
     JOIN songs s ON s.id = p.song_id
     WHERE p.user_id = ANY($1)
       AND s.id NOT IN (SELECT song_id FROM playlists WHERE user_id = $2)
       AND s.tempo IS NOT NULL
     GROUP BY s.id
     ORDER BY freq DESC, s.popularity DESC
     LIMIT $3`,
    [similarIds, userId, limit]
  );

  return result.rows as SongRow[];
}

// ---------------------------------------------------------------------------
// Taste leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  username: string;
  discordId: string;
  value: number;
}

const LEADERBOARD_COLUMNS = ['obscurity_score', 'energy', 'danceability', 'valence'] as const;
type LeaderboardColumn = (typeof LEADERBOARD_COLUMNS)[number];

export async function getTasteLeaderboard(): Promise<{
  mostObscure: LeaderboardEntry[];
  mostEnergetic: LeaderboardEntry[];
  mostChill: LeaderboardEntry[];
}> {
  const queryByColumn = (col: LeaderboardColumn, ascending = false, limit = 3) => {
    const direction = ascending ? 'ASC' : 'DESC';
    // col is validated against a compile-time whitelist — no injection risk
    return pool.query(
      `SELECT u.username, u.discord_id, tv.${col} AS value
       FROM taste_vectors tv
       JOIN users u ON u.id = tv.user_id
       WHERE tv.song_count > 0
       ORDER BY tv.${col} ${direction}
       LIMIT $1`,
      [limit]
    );
  };

  const [obscureResult, energyResult, chillResult] = await Promise.all([
    queryByColumn('obscurity_score'),
    queryByColumn('energy'),
    queryByColumn('energy', true),
  ]);

  const mapRows = (rows: Array<Record<string, unknown>>) =>
    rows.map((r) => ({
      username: r.username as string,
      discordId: r.discord_id as string,
      value: r.value as number,
    }));

  return {
    mostObscure: mapRows(obscureResult.rows),
    mostEnergetic: mapRows(energyResult.rows),
    mostChill: mapRows(chillResult.rows),
  };
}

// ---------------------------------------------------------------------------
// Shared artists helper
// ---------------------------------------------------------------------------

export async function getSharedArtists(userIdA: number, userIdB: number): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT s.artist
     FROM playlists pa
     JOIN songs s ON s.id = pa.song_id
     JOIN playlists pb ON pb.song_id = pa.song_id AND pb.user_id = $2
     WHERE pa.user_id = $1`,
    [userIdA, userIdB]
  );
  return result.rows.map((r: { artist: string }) => r.artist);
}

// ---------------------------------------------------------------------------
// DNA helpers (human-readable labels)
// ---------------------------------------------------------------------------

export function energyLabel(energy: number): string {
  if (energy > 0.75) return 'High Energy ⚡';
  if (energy > 0.45) return 'Balanced 🎵';
  return 'Chill 🌊';
}

export function moodLabel(valence: number): string {
  if (valence > 0.7) return 'Happy / Upbeat 😊';
  if (valence > 0.4) return 'Emotional / Nostalgic 🌅';
  return 'Dark / Moody 🌑';
}

export function danceabilityLabel(danceability: number): string {
  if (danceability > 0.75) return 'Dancefloor 🕺';
  if (danceability > 0.4) return 'Groove 🎶';
  return 'Atmospheric 🌌';
}

export function acousticnessLabel(acousticness: number): string {
  if (acousticness > 0.6) return 'Acoustic / Folk 🎸';
  if (acousticness < 0.3) return 'Electronic 🎛️';
  return 'Mixed 🎹';
}

export function progressBar(value: number, max = 1, length = 10): string {
  const filled = Math.round((value / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}
