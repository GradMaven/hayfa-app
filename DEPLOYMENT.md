# Deployment

No production deployment exists yet for this project — this document describes what deploying it would require, so the gaps are visible rather than discovered at deploy time.

## What you need

1. **PostgreSQL** (managed or self-hosted) — run `prisma migrate deploy` (not `migrate dev`) against it as part of your deploy pipeline, never by hand against a database holding real data.
2. **S3-compatible object storage** (real AWS S3, DigitalOcean Spaces, Cloudflare R2, etc.) with `STORAGE_FORCE_PATH_STYLE=false` for real AWS, `true` for most S3-compatible alternatives. The bucket must **not** be public — this app relies entirely on short-lived signed URLs for downloads (§45).
3. **A Node.js host** capable of running `next build && next start`, or a platform that natively runs Next.js (Vercel, etc.). Nothing in this codebase is Vercel-specific.
4. Every variable in [`ENVIRONMENT.md`](ENVIRONMENT.md), set per-environment — **never share a database or bucket between environments** (§74/§101).

## Before deploying with real (non-synthetic) patient data

This is not optional pre-launch polish — see [`PRIVACY.md`](PRIVACY.md) and [`docs/privacy/dpia.md`](docs/privacy/dpia.md):

- Complete the legal/privacy review flagged throughout `docs/privacy/` (DPIA, retention periods, lawful basis per processing purpose).
- Decide and implement an actual data-retention/purge policy — the current soft-delete behavior retains data indefinitely (see `docs/privacy/data-retention.md`).
- Replace the in-memory rate limiter (`src/lib/rate-limit.ts`) with a shared store if running more than one instance — it is explicitly documented as not multi-instance-safe.
- Add a real email provider (only a console-logging mock exists today — no password reset or notification email actually sends anywhere).
- Run a security review against §71's checklist (IDOR, auth bypass, XSS, CSRF, rate-limit bypass) — reasoned through in design, not yet verified by an automated or manual pentest.
- Decide on and configure a backup strategy with a retention/deletion policy that matches your data-retention policy.

## CI recommendations (not yet configured)

A pipeline should run, in order: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `prisma migrate deploy` against a disposable/staging database before promoting to production. None of this is wired up as an actual CI config in this repository yet.

## Health checks

No `/api/health` endpoint exists yet. A minimal one (checking DB connectivity via `db.$queryRaw` and storage reachability) is a small, worthwhile addition before any real deployment.
