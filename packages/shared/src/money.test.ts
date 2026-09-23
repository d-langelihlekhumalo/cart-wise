import { describe, expect, it } from 'vitest';
import { formatZAR, parseRandsToCents } from './money';

describe('formatZAR', () => {
  it.each([
    [0, 'R0.00'],
    [5, 'R0.05'],
    [1299, 'R12.99'],
    [100000, 'R1 000.00'],
    [129999, 'R1 299.99'],
    [123456789, 'R1 234 567.89'],
    [-500, '-R5.00'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatZAR(cents)).toBe(expected);
  });

  it('rejects non-integer cents', () => {
    expect(() => formatZAR(12.99)).toThrow(RangeError);
    expect(() => formatZAR(Number.NaN)).toThrow(RangeError);
  });
});

describe('parseRandsToCents', () => {
  it.each([
    ['12', 1200],
    ['12.9', 1290],
    ['12.99', 1299],
    ['12,99', 1299],
    ['R12.99', 1299],
    ['r 12.99', 1299],
    ['R1 299.99', 129999],
    ['  0.05 ', 5],
  ])('parses %j as %i cents', (input, expected) => {
    expect(parseRandsToCents(input)).toBe(expected);
  });

  it.each(['', 'R', 'abc', '12.999', '-5', '1.2.3', '12.'])('rejects %j', (input) => {
    expect(parseRandsToCents(input)).toBeNull();
  });

  it('round-trips with formatZAR', () => {
    for (const cents of [0, 1, 99, 1299, 129999]) {
      expect(parseRandsToCents(formatZAR(cents))).toBe(cents);
    }
  });
});
