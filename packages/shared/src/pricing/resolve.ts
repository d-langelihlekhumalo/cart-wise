import type { Price } from '../schemas/catalogue';

/** Regular (non-special) prices older than this don't count as current (D5). */
export const REGULAR_PRICE_MAX_AGE_DAYS = 60;
const DAY_MS = 86_400_000;

/** Today's date in South Africa as `YYYY-MM-DD` (pamphlet dates are SA calendar days). */
export function todayInSA(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

interface StoreScope {
  id: string;
  chainId: string;
  regionId: string;
}

/** 3 = this store, 2 = the chain in this region, 1 = the chain nationally, 0 = not applicable. */
function specificity(p: Price, store: StoreScope): number {
  if (p.chainId !== store.chainId) return 0;
  if (p.storeId !== null) return p.storeId === store.id ? 3 : 0;
  if (p.regionId !== null) return p.regionId === store.regionId ? 2 : 0;
  return 1;
}

function isValidOn(p: Price, today: string): boolean {
  return (
    (p.validFrom === null || p.validFrom <= today) && (p.validTo === null || p.validTo >= today)
  );
}

/** Most specific scope first, then most recently observed. */
function best(prices: Price[], store: StoreScope): Price | null {
  let winner: Price | null = null;
  let winnerScore = 0;
  for (const p of prices) {
    const score = specificity(p, store);
    if (score === 0) continue;
    if (
      winner === null ||
      score > winnerScore ||
      (score === winnerScore && p.observedAt > winner.observedAt)
    ) {
      winner = p;
      winnerScore = score;
    }
  }
  return winner;
}

export interface ResolvedStorePrice {
  regular: Price | null;
  promo: Price | null;
  lastSeen: Price | null;
}

/**
 * Picks the prices that apply at one store today from all known price rows for a product.
 * Rows from other chains, other regions or other stores are ignored.
 */
export function resolveStorePrice(
  prices: Price[],
  store: StoreScope,
  now: number,
  today: string = todayInSA(new Date(now)),
): ResolvedStorePrice {
  const applicable = prices.filter((p) => specificity(p, store) > 0);
  const freshSince = now - REGULAR_PRICE_MAX_AGE_DAYS * DAY_MS;
  return {
    regular: best(
      applicable.filter((p) => !p.isPromo && p.observedAt >= freshSince && isValidOn(p, today)),
      store,
    ),
    promo: best(
      applicable.filter((p) => p.isPromo && isValidOn(p, today)),
      store,
    ),
    lastSeen: applicable.reduce<Price | null>(
      (latest, p) => (latest === null || p.observedAt > latest.observedAt ? p : latest),
      null,
    ),
  };
}
