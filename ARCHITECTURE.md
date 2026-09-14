# Architecture

One Next.js 15 App Router deployable, with a real versioned API (`/api/v1/*`) underneath the UI rather than UI-only endpoints. Full reasoning and diagrams live in [`docs/system-architecture.md`](docs/system-architecture.md) — this file is the map to the rest.

```
UI (Server + Client Components)  ──►  /api/v1/* route handlers
                                            │
                          requireUser() → canAccess() → Zod validate → Prisma
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
              PostgreSQL              Object storage            AI / OCR
              (Prisma)                (S3 / MinIO)          (mock providers,
                                                              swappable interface)
```

## Where to look

| Question | Doc |
|---|---|
| What exists vs. was deferred, and why | [`docs/discovery-report.md`](docs/discovery-report.md) |
| Product scope, module status | [`docs/product-architecture.md`](docs/product-architecture.md) |
| Folder structure, request lifecycle | [`docs/system-architecture.md`](docs/system-architecture.md) |
| Database schema and its reasoning | [`docs/database-architecture.md`](docs/database-architecture.md) |
| Auth, authorization, IDOR prevention | [`SECURITY.md`](SECURITY.md) → [`docs/security-architecture.md`](docs/security-architecture.md) |
| Consent, data ownership, Privacy Center | [`PRIVACY.md`](PRIVACY.md) → [`docs/privacy-architecture.md`](docs/privacy-architecture.md) |
| AI safety and data-minimization | [`docs/ai-architecture.md`](docs/ai-architecture.md) |
| Future integrations (hospitals, labs, wearables) | [`docs/integration-architecture.md`](docs/integration-architecture.md) |
| API routes and conventions | [`API.md`](API.md) → [`docs/api-architecture.md`](docs/api-architecture.md) |
| Navigation, screens, user flows | [`docs/ux/`](docs/ux/) |

## Core design decisions (and why)

- **Custom session auth, not NextAuth** — NextAuth v5 was beta at build time with known rough edges around Credentials + database sessions; revocable device sessions are an explicit product requirement, so a small, fully-understood implementation (opaque token, SHA-256 hash at rest) beat a beta dependency. See [`docs/security-architecture.md`](docs/security-architecture.md).
- **Next.js 15, not 16 / Prisma 6, not 7-8** — both newer majors were released very recently relative to this build; pinned to the versions with well-understood, stable behavior for a security-sensitive domain. See [`docs/discovery-report.md`](docs/discovery-report.md).
- **One `canAccess()` for every patient-scoped route** — centralizing object-level authorization means it's implemented correctly once instead of independently in ~20 route files. See [`docs/security-architecture.md`](docs/security-architecture.md).
- **`HealthEvent` as a generated index, not a second source of truth** — the timeline never becomes a place where data can disagree with its source record. See [`docs/database-architecture.md`](docs/database-architecture.md).
- **Provider interfaces for AI/OCR/Storage/Integrations, mocked by default** — real vendors are a swap behind an existing interface, not a rewrite. AI's real option (Anthropic/Claude) is built and verified against the live API, but stays off unless an operator explicitly sets `AI_PROVIDER=anthropic` with a real key — nothing touches a real AI vendor by default.
