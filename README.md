# songRecs — Discord Music Intelligence Bot

A TypeScript Discord bot powered by Spotify that turns your server into a music ecosystem. It analyzes your playlists, computes taste profiles using audio feature vectors, and connects users through a shared music taste graph.

---

## Features

| Command | Description |
|---|---|
| `/addplaylist <url>` | Import your Spotify playlist (stores audio features) |
| `/recommend` | Get 5 songs recommended based on your taste profile |
| `/musicdna` | View your Music DNA — genre, archetype, energy, mood, obscurity |
| `/musictwin` | Find who in the server has the most similar taste |
| `/tastedistance @user` | See the similarity score between you and another user |
| `/compatibility @user` | Check music compatibility + shared artists |
| `/discover` | Find songs liked by similar users you haven't heard |
| `/tasteleaderboard` | See who is most obscure, most energetic, or most chill |
| `/tasteprofile` | View a summary of your music taste profile |

### Automated
- **Daily Song** — Every day at 12 PM, the bot picks a random user and posts one song from their playlist to a configured channel.

---

## Tech Stack

- **Runtime**: Node.js (v20+)
- **Language**: TypeScript
- **Discord**: discord.js v14
- **Database**: PostgreSQL (via `pg`)
- **Music API**: Spotify Web API
- **Scheduler**: node-cron
- **Config**: dotenv
- **Container**: Docker + Docker Compose

---

## Architecture

```
Discord Server
     │
     │ slash commands
     ▼
Discord Bot (Node.js + discord.js)
     │
     ├── PostgreSQL database
     │     ├── users
     │     ├── songs (with audio features)
     │     ├── playlists (user ↔ song)
     │     ├── taste_vectors (precomputed per user)
     │     ├── daily_history
     │     └── user_similarity
     │
     ├── Spotify Web API
     │     ├── playlist tracks
     │     ├── audio features (energy, danceability, tempo, valence…)
     │     └── artist genres
     │
     └── Recommendation Engine
           ├── Cosine similarity (content-based filtering)
           ├── Collaborative filtering (taste graph)
           └── Music DNA computation
```

### Recommendation Engine

**Layer 1 — Content-based (cosine similarity)**

Each song is a vector of 8 audio features from the Spotify API:

```
[tempo, energy, danceability, valence, acousticness, instrumentalness, speechiness, loudness]
```

Each user's *taste vector* is the average of all their songs. Recommendations are songs (from other users' playlists) closest to the user's taste vector.

**Layer 2 — Collaborative filtering**

Users with similar taste vectors (above a configurable threshold) influence each other's recommendations. The `/discover` command uses this to surface songs loved by your musical neighbours.

---

## Quick Start

### 1. Prerequisites

- Node.js v20+
- Docker & Docker Compose
- A [Discord bot application](https://discord.com/developers/applications)
- A [Spotify Developer application](https://developer.spotify.com/dashboard)

### 2. Clone and install

```bash
git clone <repo>
cd songRecs
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# edit .env with your tokens
```

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your Discord bot token |
| `DISCORD_CLIENT_ID` | Your Discord application client ID |
| `DISCORD_GUILD_ID` | (Optional) Guild ID for instant command deployment |
| `DISCORD_CHANNEL_ID` | Channel ID where daily songs are posted |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `PGHOST` | PostgreSQL host (default: `localhost`) |
| `PGPORT` | PostgreSQL port (default: `5432`) |
| `PGDATABASE` | Database name (default: `songrecs`) |
| `PGUSER` | Database user |
| `PGPASSWORD` | Database password |
| `SIMILARITY_THRESHOLD` | Min cosine similarity for discovery (default: `0.75`) |
| `DAILY_SONG_CRON` | Cron schedule (default: `0 12 * * *` = 12 PM daily) |

### 4. Start the database

```bash
docker-compose up -d postgres
```

### 5. Register slash commands

```bash
npm run deploy-commands
```

### 6. Run the bot

```bash
# Development
npm run dev

# Production (build first)
npm run build
npm start
```

### 7. Full Docker deployment

```bash
docker-compose up -d
```

---

## Project Structure

```
src/
├── bot.ts                  # Bot entry point
├── deployCommands.ts       # Slash command registration
├── commands/
│   ├── addPlaylist.ts      # /addplaylist
│   ├── recommend.ts        # /recommend
│   ├── musicDNA.ts         # /musicdna
│   ├── musicTwin.ts        # /musictwin
│   ├── tasteDistance.ts    # /tastedistance
│   ├── compatibility.ts    # /compatibility
│   ├── discover.ts         # /discover
│   ├── tasteLeaderboard.ts # /tasteleaderboard
│   └── tasteProfile.ts     # /tasteprofile
├── services/
│   ├── spotify.ts          # Spotify Web API client
│   ├── recommender.ts      # Cosine similarity, taste vectors, DNA
│   └── playlistParser.ts   # Fetch + store playlist tracks
├── scheduler/
│   └── dailySong.ts        # Daily song cron job
└── db/
    └── schema.ts           # PostgreSQL schema + connection pool
```

---

## Database Schema

```sql
users          — Discord users (discord_id, username, spotify_id)
songs          — Song library with Spotify audio features
playlists      — User ↔ song associations
taste_vectors  — Precomputed average feature vectors per user
daily_history  — Log of daily song posts
user_similarity — Pairwise cosine similarity cache
```

---

## Music DNA

Every user gets a profile based on their playlist's average audio features:

| Feature | Label Examples |
|---|---|
| Energy | High Energy ⚡ / Balanced 🎵 / Chill 🌊 |
| Mood (valence) | Happy 😊 / Emotional 🌅 / Dark 🌑 |
| Danceability | Dancefloor 🕺 / Groove 🎶 / Atmospheric 🌌 |
| Acousticness | Acoustic 🎸 / Electronic 🎛️ / Mixed 🎹 |

**Archetypes**: Party Starter · Chill Wanderer · Indie Explorer · Pop Enthusiast · Intense Listener · Eclectic Curator

**Obscurity Score** = 100 − average Spotify popularity

---

## Development

```bash
npm run build   # Compile TypeScript
npm test        # Run Jest tests
npm run lint    # ESLint
```

---

## License

MIT
