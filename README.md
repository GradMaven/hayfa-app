# Hafya

A privacy-first personal health-data platform for Africa, starting with Kenya. Patients bring fragmented health records together into one timeline they own, understand, and control access to.

See [`docs/discovery-report.md`](docs/discovery-report.md) for the full technical discovery and scope decisions behind this build, and [`docs/product-architecture.md`](docs/product-architecture.md) for what's built vs. deferred.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS v4 · PostgreSQL + Prisma · S3-compatible object storage · SMTP email · custom revocable-session auth with TOTP MFA · Zod + React Hook Form · TanStack Query.

## Getting started

Requires Node 20+, Docker (for local Postgres + MinIO + Mailpit).

```bash
cp .env.example .env          # generates nothing on its own — see below for a real AUTH_SECRET
npm install
docker compose up -d          # starts Postgres (5432), MinIO (9000/9001), Mailpit (1025/8025)
npm run db:migrate            # applies the schema
npm run db:seed               # loads synthetic demo data (clearly marked, never real patient data)
npm run dev
```

Open http://localhost:3000. Demo logins (password `DemoPass123!`):

- Patient: `amina.demo@hafya.demo`
- Provider: `dr.mwangi.demo@hafya.demo`
- Caregiver: `peter.demo@hafya.demo`

Generate a real `AUTH_SECRET` before running anything beyond a throwaway local session:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The first time you start MinIO, create the dev bucket (already done for you if you ran the commands above in order, since `docker-compose.yml` doesn't auto-create it — see [`ENVIRONMENT.md`](ENVIRONMENT.md) if you need to recreate it):

```bash
docker exec hafya-app-minio-1 sh -c \
  "mc alias set local http://localhost:9000 hafya_minio hafya_minio_password && \
   mc mb -p local/hafya-documents-dev && mc anonymous set none local/hafya-documents-dev"
```

By default `.env.example` sets `EMAIL_PROVIDER=console` (emails just log to your terminal). To actually see a password-reset email arrive, set `EMAIL_PROVIDER=smtp` (with the default `SMTP_HOST=localhost`/`SMTP_PORT=1025`) and open **http://localhost:8025** — that's Mailpit's inbox, catching every email the app sends locally without delivering anywhere real. Trigger one from "Forgot password?" on the sign-in page.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Load synthetic demo data |
| `npm run db:studio` | Prisma Studio (inspect the local DB) |

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — start here for the system as a whole
- [`SECURITY.md`](SECURITY.md), [`PRIVACY.md`](PRIVACY.md) — the rules this codebase enforces and why
- [`API.md`](API.md) — route inventory and conventions
- [`ENVIRONMENT.md`](ENVIRONMENT.md) — every env var explained
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — deploying beyond local dev
- [`docs/`](docs/) — full architecture, UX, and privacy documentation set

## Status

This is a Phase 1 MVP: the patient-facing golden path (account → profile → documents → timeline → medications/labs/vitals/conditions → consent-based sharing → revocation → access log → export) is fully built and working end-to-end. Provider portal, organization dashboards, billing, real integrations, and SMS/USSD are explicitly out of scope for this phase — see [`docs/discovery-report.md`](docs/discovery-report.md) for the full breakdown of what's built vs. deferred and why.
