# Hafya — Technical Discovery Report

Date: 2026-09-14

## 1. Current stack
None. `hafya-app/` was an empty directory with no git history, no package.json, and no prior code. This is a greenfield build, not a migration.

## 2. Current architecture
N/A — nothing existed prior to this session.

## 3–8. Existing functionality / database / auth / APIs / UI
N/A. All of it is being created from scratch as part of this session.

## 9. Existing technical debt
None inherited. Debt introduced from here forward is tracked in this doc's changelog and in commit messages, not silently absorbed.

## 10. Security risks
None inherited. See [security-architecture.md](security-architecture.md) for the risks the *new* design must actively defend against (IDOR across patients, over-broad provider access, consent bypass, secrets in the client bundle, health data in logs/analytics).

## 11. Missing functionality
Everything in the brief. Section 12 below scopes what this session actually builds vs. what is architected-for-but-deferred.

## 12. Recommended architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend + BFF | Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4 | Single deployable for MVP velocity, but API routes are written under `/api/v1/*` as a real versioned REST surface so the same backend can later serve a mobile app or partner integrations — not UI-only endpoints. |
| Auth | Auth.js (NextAuth v5) + Prisma adapter, DB-backed sessions, Credentials provider (bcrypt) now | DB sessions are revocable (needed for device/session management, §13, §42 RBAC), and Auth.js's provider model gives a clean path to OAuth/passkeys later without a rewrite. |
| Database | PostgreSQL + Prisma ORM | Relational integrity for consent/permission/audit relationships is non-negotiable in health data (§44); Prisma gives typed queries and reviewable migrations. |
| File storage | S3-compatible object storage behind a `StorageProvider` interface; MinIO locally via Docker | Documents never live in DB rows (§45); interface swap lets production point at real S3/DO Spaces/etc. without touching call sites. |
| Validation | Zod, shared between client forms and server route handlers | One schema, both sides — reduces drift between what the form allows and what the API accepts. |
| AI | `AIProvider` interface, mock implementation by default, **disabled unless `ENABLE_AI=true` and a key is configured** | Per §53/§81, no patient data reaches a real LLM vendor without an explicit, reviewed integration. The mock lets the UI/UX for AI features be built and tested safely now. |
| OCR | `OCRProvider` interface, mock implementation returning confidence-scored draft extractions | Per §18, OCR output is always a draft the user confirms — never an auto-write to the record. |
| i18n | Lightweight JSON dictionary (`en`, `sw`) loaded via a small custom provider, not a heavy framework | Two locales at MVP scope doesn't justify next-intl's build complexity yet; the dictionary shape is compatible with a future swap. |

Next.js 16.3.5 was create-next-app's default at scaffold time; it was downgraded to 15.5.25 because 16 is very new (its own generated `AGENTS.md` explicitly warns App Router conventions differ from training data) and this build prioritizes correctness in a security-sensitive domain over being on the newest release.

## 13. Proposed database schema
See [database-architecture.md](database-architecture.md).

## 14. Proposed folder structure
See [system-architecture.md](system-architecture.md) §"Folder structure".

## 15. MVP implementation roadmap (this session)

**Built now — Phase 1 golden path (§99 Step 6):**
Account creation → patient health profile → document upload (with mocked OCR confirm-before-write flow) → health timeline → medications → lab results → conditions → vitals → granular consent-based sharing → revocation → access-history audit log → data export (JSON/PDF-ready) → Privacy Center → responsive marketing landing page → responsive authenticated app shell (sidebar desktop / bottom nav mobile).

Underneath that surface: RBAC scaffold (patient/caregiver/provider/admin roles), a centralized consent-engine (`canAccess()`), an append-only audit-event writer, Zod validation on every write endpoint, and object-level authorization checked server-side on every patient-scoped route (never inferred from the URL alone).

**Architected-for, not built now (explicitly deferred, interfaces only where noted):**
- Provider portal clinical workflows beyond basic record viewing (§62). (Built in a later session — a per-patient chart scoped to consent.dataScopes, with diagnosis/prescription/care-plan write actions; see [provider-portal-architecture.md](provider-portal-architecture.md). This report is a point-in-time snapshot from the original build and is left otherwise unedited.)
- Organization/admin dashboards with staff & billing management (§60–61). (A narrow slice — SUPER_ADMIN provider verification only — was built in a later session; see [admin-architecture.md](admin-architecture.md). Org management, staff management, and billing remain exactly as described here. This report is a point-in-time snapshot from the original build and is left otherwise unedited.)
- Real hospital/lab/insurance/wearable integrations — `HealthDataConnector` interface exists, only a mock connector is wired (§36, §87)
- Billing/subscriptions/entitlements (§58–59) — data model stubbed, no payment provider wired
- SMS/USSD delivery — `NotificationProvider` interface exists, only in-app/email channel wired (§39–40). (Real SMS — Africa's Talking — was wired in a later session; USSD remains deferred, being architecturally an inbound-session feature rather than a push channel. See [notification-architecture.md](notification-architecture.md). This report is a point-in-time snapshot from the original build and is left otherwise unedited.)
- FHIR mapping layer (§34–35) — canonical model is FHIR-shaped where practical, no live FHIR I/O yet
- Webhooks (§49)
- Real OCR vendor calls (§18) — interface + mock implementation only. (A real AI vendor, and later a real OCR vendor — both Anthropic/Claude — were wired in later sessions; see [ai-architecture.md](ai-architecture.md). This report is a point-in-time snapshot from the original build and is left otherwise unedited.)

This split is a scope decision, not an oversight — building every module shallowly would leave nothing production-ready; building the golden path deeply gives you something real to evaluate and extend.

## 16. Immediate next implementation step
Prisma schema → migration → seed data → Auth.js wiring → app shell/navigation → golden-path features in the order listed above, with `npm run typecheck`/`lint`/`build` run after each milestone per §108.
