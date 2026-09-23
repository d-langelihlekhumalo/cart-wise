import { ulid } from 'ulid';

/** New ULID primary key. Safe to call on the client for offline-created rows. */
export function newId(): string {
  return ulid();
}
