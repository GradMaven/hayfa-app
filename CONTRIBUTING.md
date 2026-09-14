# Contributing

## Before you start

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`docs/discovery-report.md`](docs/discovery-report.md) first — the latter explains what's deliberately out of scope for this phase, so you don't rebuild something that was cut on purpose vs. simply missing.

## Workflow

1. `npm install`, follow [`README.md`](README.md) "Getting started" to get a local DB/storage running.
2. `npm run db:migrate` after any `prisma/schema.prisma` change — never hand-edit the database or use `prisma db push` against a database with real data in it.
3. Before opening a PR: `npm run typecheck && npm run lint && npm test && npm run build` should all pass. None of these are optional — see §108's "never assume a feature works because the code compiles."
4. If you touch a patient-scoped route, re-read [`SECURITY.md`](SECURITY.md) — specifically, confirm `authorizePatientAccess`/`canAccess()` is called before any read or write of patient data. This is the one class of bug that turns into an IDOR vulnerability.

## Commit style (§102)

Conventional, scoped, present-tense: `feat(timeline): add year grouping`, `fix(consent): prevent expired grants from passing canAccess`. One logical change per commit — not one commit for the whole feature and not a commit per file.

## Code conventions

- TypeScript strict mode; avoid `any` — if you reach for it, there's usually a real type available (check what Prisma or Zod already infers).
- No comments explaining *what* code does — name things so the code reads plainly. Comment only the *why* when it's genuinely non-obvious (a workaround, a spec section being satisfied, a constraint that isn't visible from the code alone) — see the existing codebase for the calibration.
- New Zod schemas go in `src/lib/validation/`, shared by client forms and server route handlers — don't hand-write a second validation pass.
- New patient-scoped API routes follow the pattern documented in [`API.md`](API.md) "Adding a new patient-scoped route."
- New clinical record types that should appear on `/timeline` must call `recordHealthEvent()` at creation — see [`docs/database-architecture.md`](docs/database-architecture.md) for why `HealthEvent` exists and what it's for.

## Tests

Unit tests live next to what they test in `__tests__/` directories, run via `npm test` (Vitest). See [`docs/discovery-report.md`](docs/discovery-report.md) and this repo's current test coverage for what's tested (validation schemas, password hashing, rate limiting, AI safety screening) vs. not yet (integration tests against a real database, E2E golden-path tests) — the latter is a good place to contribute.
