import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Raw Spotify API types
// ---------------------------------------------------------------------------

interface SpotifyRawArtistRef {
  id: string;
  name: string;
}

interface SpotifyRawAlbum {
  name: string;
  images: Array<{ url: string }>;
}

interface SpotifyRawTrack {
  id: string;
  name: string;
  artists: SpotifyRawArtistRef[];
  album: SpotifyRawAlbum;
  external_urls: { spotify: string };
  duration_ms: number;
  popularity: number;
  is_local: boolean;
}

interface SpotifyRawAudioFeature {
  id: string;
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
}

interface SpotifyRawArtist {
  id: string;
  genres: string[];
}

interface PlaylistTracksResponse {
  items: Array<{ track: SpotifyRawTrack | null }>;
  next: string | null;
}

interface AudioFeaturesResponse {
  audio_features: Array<SpotifyRawAudioFeature | null>;
}

interface ArtistsResponse {
  artists: Array<SpotifyRawArtist | null>;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SpotifyAudioFeatures {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
}

export interface SpotifyTrack {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  spotifyUrl: string;
  durationMs: number;
  popularity: number;
  genres: string[];
  features: SpotifyAudioFeatures | null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials are not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res: AxiosResponse<TokenResponse> = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  accessToken = res.data.access_token;
  tokenExpiry = Date.now() + res.data.expires_in * 1000 - 60_000;
  return accessToken;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractPlaylistId(url: string): string | null {
  const patterns = [
    /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
    /spotify:playlist:([a-zA-Z0-9]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getPage(
  url: string,
  token: string
): Promise<PlaylistTracksResponse> {
  const res: AxiosResponse<PlaylistTracksResponse> = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const token = await getAccessToken();
  const tracks: SpotifyTrack[] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (nextUrl) {
    // eslint-disable-next-line no-await-in-loop
    const page = await getPage(nextUrl, token);

    for (const item of page.items) {
      if (!item.track || item.track.is_local) continue;
      const track = item.track;
      const artistNames = track.artists.map((a: SpotifyRawArtistRef) => a.name).join(', ');
      tracks.push({
        spotifyId: track.id,
        title: track.name,
        artist: artistNames,
        album: track.album.name,
        albumArt: track.album.images[0]?.url ?? '',
        spotifyUrl: track.external_urls.spotify,
        durationMs: track.duration_ms,
        popularity: track.popularity,
        genres: [],
        features: null,
      });
    }

    nextUrl = page.next;
  }

  return tracks;
}

export async function fetchAudioFeatures(
  spotifyIds: string[]
): Promise<Map<string, SpotifyAudioFeatures>> {
  const token = await getAccessToken();
  const featureMap = new Map<string, SpotifyAudioFeatures>();

  for (let i = 0; i < spotifyIds.length; i += 100) {
    const batch = spotifyIds.slice(i, i + 100);
    // eslint-disable-next-line no-await-in-loop
    const res: AxiosResponse<AudioFeaturesResponse> = await axios.get(
      `https://api.spotify.com/v1/audio-features?ids=${batch.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    for (const feat of res.data.audio_features) {
      if (!feat) continue;
      featureMap.set(feat.id, {
        tempo: feat.tempo,
        energy: feat.energy,
        danceability: feat.danceability,
        valence: feat.valence,
        acousticness: feat.acousticness,
        instrumentalness: feat.instrumentalness,
        speechiness: feat.speechiness,
        loudness: feat.loudness,
      });
    }
  }

  return featureMap;
}

export async function fetchArtistGenres(artistIds: string[]): Promise<Map<string, string[]>> {
  const token = await getAccessToken();
  const genreMap = new Map<string, string[]>();

  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    // eslint-disable-next-line no-await-in-loop
    const res: AxiosResponse<ArtistsResponse> = await axios.get(
      `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    for (const artist of res.data.artists) {
      if (artist) genreMap.set(artist.id, artist.genres);
    }
  }

  return genreMap;
}

export async function enrichTracksWithFeatures(tracks: SpotifyTrack[]): Promise<SpotifyTrack[]> {
  if (tracks.length === 0) return tracks;

  const spotifyIds = tracks.map((t) => t.spotifyId);
  const featureMap = await fetchAudioFeatures(spotifyIds);

  for (const track of tracks) {
    track.features = featureMap.get(track.spotifyId) ?? null;
  }

  return tracks;
}
