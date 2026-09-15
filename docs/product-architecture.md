# Product Architecture

## What Hafya is (§1)

A patient-centered health-data platform, not a hospital management system, appointment-booker, or AI chatbot. The organizing idea: fragmented health records (hospitals, clinics, labs, paper, memory) become one patient-owned, patient-controlled record with a real audit trail over who else can see it.

## Modules and their build status (§7)

| Module | Status |
|---|---|
| Authentication | Built — custom, revocable sessions, TOTP-based MFA with backup codes, email verification (non-blocking) |
| User Profiles / Patient Health Record | Built |
| Health Timeline | Built |
| Documents + OCR + malware scanning (real ClamAV) | Built — OCR mock by default; a real vendor (Anthropic/Claude vision/document input) is wired, off by default, unit-tested but not yet live-API-verified (see ai-architecture.md) |
| Laboratory Results, Medications, Conditions, Allergies, Immunizations, Vitals, Appointments | Built — includes a patient-initiated correction workflow (§56) for medications/conditions/labs once a record is provider-verified or not patient-sourced, instead of a silent direct overwrite |
| Chronic Conditions + Care Plans | Built (condition/care-plan CRUD; no clinician-facing care-plan authoring UI yet) |
| Consent & Permissions, Data Sharing, Emergency Access | Built |
| Notifications | Built — in-app + real email (SMTP, any vendor); SMS/USSD/push not wired |
| Audit Logs | Built |
| AI Health Insights | Built — mock provider by default; a real vendor (Anthropic/Claude) is wired and verified against the live API, off by default |
| Provider Portal | Minimal placeholder only (`/portal`) — see [discovery-report.md](discovery-report.md) |
| Admin Portal, Organizations, Subscription/Billing, Analytics, full Integrations, API Platform | Not built — schema/interfaces exist where noted in their respective docs |

## User types and what they can actually do today

- **Patient**: the fully-built experience — profile, timeline, documents, all clinical modules, sharing, privacy center, sessions.
- **Caregiver**: backend fully modeled (`CaregiverLink`, scoped permissions enforced by `canAccess()`); UI is the minimal `/portal` overview listing which patients granted access, not a full record browser.
- **Provider**: same shape as caregiver — `canAccess()` correctly scopes what a consented provider could read via the API, plus `POST /api/v1/emergency-access`; no clinical-workflow UI (adding diagnoses, prescriptions, care plans as a provider) is built.
- **Organization / Administrator**: data model exists (`Organization`, roles in `UserRole`); no dashboard, staff management, or admin tooling is built.

## Golden path (§99 Step 6) — fully working end to end

Create account → create health profile → upload a document → confirm its OCR draft into a lab result → see it on the timeline → add a medication → share selected records with a provider by email → revoke that access → see both events in the access log → export the full record. This was verified against the running app (dev server + local Postgres/MinIO), not just written and assumed correct.

## Design principle carried through every module

A feature is not "the screen exists" — see §104's Definition of Done. Concretely, every clinical write in this codebase produces: a validated input (Zod), an authorized actor (`canAccess()`), a provenance-tagged record (`source`/`verificationStatus`), a timeline entry where relevant (`recordHealthEvent`), and an audit trail entry (`DataAccessLog`/`AuditEvent`) — automatically, not as an opt-in extra step a future contributor might forget.
