import {
  cosineSimilarity,
  energyLabel,
  moodLabel,
  danceabilityLabel,
  acousticnessLabel,
  progressBar,
} from '../services/recommender';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [0.7, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, -5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('returns 0 for zero vectors', () => {
    const v = [0, 0, 0, 0, 0, 0, 0, 0];
    expect(cosineSimilarity(v, v)).toBe(0);
  });

  it('returns a value between -1 and 1 for arbitrary vectors', () => {
    const a = [0.72, 0.80, 0.60, 0.45, 0.30, 0.10, 0.05, -5];
    const b = [0.70, 0.77, 0.63, 0.42, 0.35, 0.08, 0.04, -6];
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('reflects high similarity for similar vectors', () => {
    const a = [0.72, 0.80, 0.60, 0.45, 0.30, 0.10, 0.05, -5];
    const b = [0.70, 0.77, 0.63, 0.42, 0.35, 0.08, 0.04, -6];
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.9);
  });

  it('reflects low similarity for very different vectors', () => {
    const a = [0.9, 0.9, 0.9, 0.9, 0.1, 0.1, 0.1, 10];
    const b = [0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.9, -10];
    expect(cosineSimilarity(a, b)).toBeLessThan(0.5);
  });
});

describe('energyLabel', () => {
  it('returns High Energy for values > 0.75', () => {
    expect(energyLabel(0.8)).toContain('High Energy');
  });

  it('returns Balanced for values between 0.45 and 0.75', () => {
    expect(energyLabel(0.6)).toContain('Balanced');
  });

  it('returns Chill for values < 0.45', () => {
    expect(energyLabel(0.3)).toContain('Chill');
  });
});

describe('moodLabel', () => {
  it('returns Happy for valence > 0.7', () => {
    expect(moodLabel(0.8)).toContain('Happy');
  });

  it('returns Emotional for valence between 0.4 and 0.7', () => {
    expect(moodLabel(0.55)).toContain('Emotional');
  });

  it('returns Dark for valence < 0.4', () => {
    expect(moodLabel(0.2)).toContain('Dark');
  });
});

describe('danceabilityLabel', () => {
  it('returns Dancefloor for values > 0.75', () => {
    expect(danceabilityLabel(0.9)).toContain('Dancefloor');
  });

  it('returns Groove for values between 0.4 and 0.75', () => {
    expect(danceabilityLabel(0.55)).toContain('Groove');
  });

  it('returns Atmospheric for values < 0.4', () => {
    expect(danceabilityLabel(0.2)).toContain('Atmospheric');
  });
});

describe('acousticnessLabel', () => {
  it('returns Acoustic for values > 0.6', () => {
    expect(acousticnessLabel(0.8)).toContain('Acoustic');
  });

  it('returns Electronic for values < 0.3', () => {
    expect(acousticnessLabel(0.1)).toContain('Electronic');
  });

  it('returns Mixed for values between 0.3 and 0.6', () => {
    expect(acousticnessLabel(0.45)).toContain('Mixed');
  });
});

describe('progressBar', () => {
  it('returns a string of the specified length', () => {
    const bar = progressBar(0.5, 1, 10);
    expect(bar.replace(/[█░]/g, '').length).toBe(0); // only block chars
    expect(bar.length).toBe(10);
  });

  it('returns all filled for value equal to max', () => {
    expect(progressBar(1, 1, 10)).toBe('█'.repeat(10));
  });

  it('returns all empty for value 0', () => {
    expect(progressBar(0, 1, 10)).toBe('░'.repeat(10));
  });
});
