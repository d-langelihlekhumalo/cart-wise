/**
 * South African provinces used to scope pamphlets and prices. The `regions` table is seeded
 * with exactly these rows (see packages/db migrations); a test keeps the two in sync.
 */
export const REGIONS = [
  { id: 'gauteng', name: 'Gauteng' },
  { id: 'western-cape', name: 'Western Cape' },
  { id: 'kwazulu-natal', name: 'KwaZulu-Natal' },
  { id: 'eastern-cape', name: 'Eastern Cape' },
  { id: 'free-state', name: 'Free State' },
  { id: 'limpopo', name: 'Limpopo' },
  { id: 'mpumalanga', name: 'Mpumalanga' },
  { id: 'north-west', name: 'North West' },
  { id: 'northern-cape', name: 'Northern Cape' },
] as const;

export type RegionId = (typeof REGIONS)[number]['id'];

export const REGION_IDS = REGIONS.map((r) => r.id) as [RegionId, ...RegionId[]];

export function regionName(id: RegionId): string {
  return REGIONS.find((r) => r.id === id)?.name ?? id;
}
