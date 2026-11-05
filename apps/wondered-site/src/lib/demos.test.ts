import { describe, expect, it } from 'vitest';
import { DEMOS, colourName, rayleighRelativeToRed } from './demos';

describe('rayleighRelativeToRed', () => {
  it('is exactly 1 for red itself', () => {
    expect(rayleighRelativeToRed(700)).toBe(1);
  });

  it('matches (700 / 450)^4 ≈ 5.86 for blue, as in the sky question', () => {
    expect(rayleighRelativeToRed(450)).toBeCloseTo(5.855, 2);
  });

  it('halving the wavelength scatters 2^4 = 16 times more', () => {
    expect(rayleighRelativeToRed(350)).toBeCloseTo(16, 10);
  });
});

describe('colourName', () => {
  it('names the main bands of visible light', () => {
    expect(colourName(400)).toBe('violet');
    expect(colourName(470)).toBe('blue');
    expect(colourName(530)).toBe('green');
    expect(colourName(580)).toBe('yellow');
    expect(colourName(600)).toBe('orange');
    expect(colourName(680)).toBe('red');
  });
});

describe('DEMOS.rayleigh', () => {
  const demo = DEMOS.rayleigh;

  it('starts inside its own slider range', () => {
    expect(demo.start).toBeGreaterThanOrEqual(demo.min);
    expect(demo.start).toBeLessThanOrEqual(demo.max);
  });

  it('fills the bar at the shortest wavelength and keeps it between 0 and 1', () => {
    expect(demo.compute(demo.min).barFraction).toBeCloseTo(1, 10);
    const atRed = demo.compute(demo.max).barFraction;
    expect(atRed).toBeGreaterThan(0);
    expect(atRed).toBeLessThan(1);
  });

  it('describes the result in words', () => {
    expect(demo.compute(450).text).toBe('450 nm (blue) is scattered 5.9 times as much as red light at 700 nm.');
  });
});
