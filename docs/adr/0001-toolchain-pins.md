# ADR 0001: Toolchain version pins

- **Status:** accepted
- **Date:** 2026-09-23

## Context

The latest TypeScript is 7.x (native compiler), but typescript-eslint 8.x supports `typescript <6.1`. The latest Vitest is 5.x, but `@cloudflare/vitest-pool-workers` (needed from M1 to test the API against real D1) requires Vitest `^4.1`.

## Decision

- Pin `typescript` to `~6.0` and use it across the monorepo.
- Pin `vitest` to `^4.1` across the monorepo so every workspace runs the same test runner.

## Consequences

Revisit both when typescript-eslint supports TS 7 and the Workers pool supports Vitest 5. Upgrading is a single `package.json` change plus fixing any new type errors.
