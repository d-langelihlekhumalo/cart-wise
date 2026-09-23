# ADR 0002: zod/mini for shared schemas

- **Status:** accepted
- **Date:** 2026-09-23

## Context

The shared Zod schemas in `packages/shared` are used by both the API and the web app. With classic `zod`, the web app's initial JS was 148.6 KB gzip, just under the 150 KB budget, before any real features. About 37 KB of that was Zod, because the classic API isn't tree-shakable.

## Decision

- Shared schemas use `zod/mini` (functional API: `z.nullable(x)`, `z.int().check(z.nonnegative())`).
- Code that validates against any schema takes the core type `$ZodType` from `zod/v4/core` and calls `z.parse(schema, value)`.
- The API calls `z.config(z.locales.en())` once, since `zod/mini` ships without error messages.
- The API error handler catches `$ZodError` (the base class of both variants).
- Server-only schemas may still use classic `zod` if it's more convenient, since bundle size doesn't matter there.

## Consequences

Initial JS dropped to 126.4 KB gzip. Schemas are slightly more verbose to write. `pnpm size` (run in CI) fails the build if initial JS exceeds 150 KB.
