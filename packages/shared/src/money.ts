/**
 * Money is always integer cents (VAT-inclusive ZAR). These helpers are the only place
 * cents are converted to or from rand strings.
 */

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Expected integer cents, got ${cents}`);
  }
}

/** Formats cents in the retailer style used on SA pamphlets: `R12.99`, `R1 299.00`, `-R5.00`. */
export function formatZAR(cents: number): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const rands = Math.trunc(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${sign}R${rands}.${rest}`;
}

const RAND_PATTERN = /^R?(\d{1,7})(?:[.,](\d{1,2}))?$/i;

/**
 * Parses user-entered rand amounts into cents. Accepts `12`, `12.9`, `12.99`, `12,99`,
 * `R12.99` and space-grouped thousands (`R1 299.99`). Returns `null` for anything else.
 */
export function parseRandsToCents(input: string): number | null {
  const match = RAND_PATTERN.exec(input.replace(/\s/g, ''));
  if (!match) return null;
  const [, rands = '0', fraction = ''] = match;
  return Number(rands) * 100 + Number(fraction.padEnd(2, '0'));
}
