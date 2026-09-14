# Critical User Flows

Each flow below is built and was exercised against the running app (not just designed on paper). Screen/error/empty states referenced exist in the linked component.

## 1. Sign up → health profile → dashboard

`POST /api/v1/auth/signup` (creates `User`, starts a session) → redirect to `/onboarding` (blocked from `/dashboard` until a profile exists, [`src/app/(app)/layout.tsx`](../../src/app/(app)/layout.tsx)) → `POST /api/v1/patients/me` (creates `PatientProfile`) → `/dashboard`.

Error states: duplicate email on signup returns a deliberately generic `CONFLICT` (never "email already taken" — see [security-architecture.md](../security-architecture.md)); onboarding form validation errors render inline per field ([`src/app/onboarding/onboarding-form.tsx`](../../src/app/onboarding/onboarding-form.tsx)).

Signup also fires a verification email in the background (doesn't block the redirect to onboarding). The account is fully usable before verifying — a dismissible-per-page-view banner ([`src/components/layout/email-verification-banner.tsx`](../../src/components/layout/email-verification-banner.tsx)) nudges toward it from every page in the app shell, with a one-click resend. Clicking the emailed link opens `/verify-email`, which confirms automatically on load and shows success/error inline — no form to fill in. Verified live: signup → email arrives → link confirms → banner disappears on next page load; a second "resend" supersedes the first link (the old one then fails) and a used link can't be replayed.

## 2. Upload a document → confirm OCR draft → structured record

`/documents` → Upload (multipart, client-side type/size guard mirrors server validation) → document appears with `ocrStatus: PENDING` → "Extract data" (`POST .../ocr`, mock provider returns confidence-scored fields) → "Review draft" panel: every field editable, confidence % shown per field → **Confirm as lab result** (writes a `LabResult` with `source: OCR`, `verificationStatus: PATIENT_CONFIRMED`) or **Reject** (document stays, no record created). See [`src/app/(app)/documents/document-card.tsx`](../../src/app/(app)/documents/document-card.tsx). Verified end-to-end against local MinIO storage.

## 3. Add a medication → appears on timeline and dashboard

`/medications` → Add medication form → `POST /api/v1/medications` → same transaction-adjacent call writes a `HealthEvent` → invalidates the `medications`, `dashboard-summary`, and `timeline` query caches client-side so all three surfaces update without a manual refresh.

## 4. Share records with a provider → provider sees them → patient revokes

`/sharing` → Grant access → enter the provider's **email** (resolved server-side to an existing account — see [privacy-architecture.md](../privacy-architecture.md) for why a dangling label isn't allowed) → pick scopes (checkboxes, at least one required) → pick duration → `POST /api/v1/consents`. The provider (signed in separately) sees the patient listed on `/portal` with the granted scopes. Patient clicks **Remove access** → `POST /api/v1/consents/:id/revoke` → `Consent.status` flips to `REVOKED` immediately; the next `canAccess()` call for that provider denies and logs the denial.

## 5. View access history (Privacy Center)

`/privacy` → every allowed *and* denied access attempt against this patient's data is listed with actor, action, resource type, purpose, and timestamp — sourced from `DataAccessLog`, which `canAccess()` writes unconditionally regardless of outcome.

## 6. Export full record

`/privacy` → Export → `GET /api/v1/export` assembles profile + all clinical tables (documents as metadata only, not file bytes) → downloaded as a timestamped `.json` file client-side; the export action itself is logged as a `DataAccessLog` entry with `action: EXPORT`.

## 7. Provider emergency access

`POST /api/v1/emergency-access` (provider-initiated, requires `providerVerified` + target patient's `emergencyAccessEnabled`) → returns a fixed emergency dataset, creates an `EmergencyAccess` record and an `AuditEvent` regardless of allow/deny. No UI is built for the provider side of this yet (API-verified only) — see [discovery-report.md](../discovery-report.md).

## Empty and loading states (§66, §108)

Every list page (`medications`, `conditions`, `health` tabs, `documents`, `appointments`, `sharing`) renders a skeleton while loading and a purpose-specific `EmptyState` (icon + explanation + primary action) when there's nothing yet — never a blank page. See [`src/components/ui/empty-state.tsx`](../../src/components/ui/empty-state.tsx) and its usages.
