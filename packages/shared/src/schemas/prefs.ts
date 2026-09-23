// zod/mini keeps the client bundle small; see docs/adr/0002-zod-mini.md.
import * as z from 'zod/mini';
import { REGION_IDS } from '../regions';

/** Largest budget we accept: R100 000. Guards against typos like an extra zero or two. */
export const MAX_BUDGET_CENTS = 10_000_000;

export const DEFAULT_SPLIT_THRESHOLD_CENTS = 5_000;

const cents = z.int().check(z.nonnegative(), z.maximum(MAX_BUDGET_CENTS));

export const userPrefsSchema = z.object({
  regionId: z.enum(REGION_IDS),
  budgetCents: z.nullable(cents),
  splitThresholdCents: cents,
});

export type UserPrefs = z.infer<typeof userPrefsSchema>;

/** `GET /api/me/prefs` — `prefs` is null until the user finishes onboarding. */
export const prefsResponseSchema = z.object({
  prefs: z.nullable(userPrefsSchema),
});

export type PrefsResponse = z.infer<typeof prefsResponseSchema>;
