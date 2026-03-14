import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'songrecs',
  user: process.env.PGUSER || 'songrecs',
  password: process.env.PGPASSWORD || 'songrecs_password',
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(32) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        spotify_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Songs table with Spotify audio features
    await client.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        spotify_id VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(512) NOT NULL,
        artist VARCHAR(512) NOT NULL,
        album VARCHAR(512),
        album_art VARCHAR(1024),
        spotify_url VARCHAR(1024),
        duration_ms INTEGER,
        popularity INTEGER DEFAULT 0,
        tempo FLOAT,
        energy FLOAT,
        danceability FLOAT,
        valence FLOAT,
        acousticness FLOAT,
        instrumentalness FLOAT,
        speechiness FLOAT,
        loudness FLOAT,
        genres TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Playlists table (user ↔ song associations)
    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, song_id)
      )
    `);

    // Taste vectors - precomputed average feature vectors per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS taste_vectors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        tempo FLOAT,
        energy FLOAT,
        danceability FLOAT,
        valence FLOAT,
        acousticness FLOAT,
        instrumentalness FLOAT,
        speechiness FLOAT,
        loudness FLOAT,
        primary_genre VARCHAR(255),
        archetype VARCHAR(255),
        obscurity_score FLOAT,
        song_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Daily song history
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
        posted_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User similarity cache
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_similarity (
        id SERIAL PRIMARY KEY,
        user_a_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        user_b_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        similarity FLOAT NOT NULL,
        computed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_a_id, user_b_id)
      )
    `);

    await client.query('COMMIT');
    console.log('Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
