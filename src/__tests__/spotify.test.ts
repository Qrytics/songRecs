import { extractPlaylistId } from '../services/spotify';

describe('extractPlaylistId', () => {
  it('extracts playlist id from a standard Spotify URL', () => {
    const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    expect(extractPlaylistId(url)).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('extracts playlist id from a Spotify URI', () => {
    const uri = 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M';
    expect(extractPlaylistId(uri)).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('extracts playlist id from a URL with query params', () => {
    const url =
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123';
    expect(extractPlaylistId(url)).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('returns null for an invalid URL', () => {
    expect(extractPlaylistId('https://google.com')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractPlaylistId('')).toBeNull();
  });
});
