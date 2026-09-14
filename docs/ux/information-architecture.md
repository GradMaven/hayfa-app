# Information Architecture

## Navigation (§11)

Primary nav, exactly as specified: Home, Health, Timeline, Documents, Medications, Conditions, Appointments, Sharing, Insights, Profile, Settings ([`src/lib/nav.ts`](../../src/lib/nav.ts)).

Two items needed disambiguation the brief left implicit:
- **Health** vs **Conditions** — "Health" houses the general health-metrics modules from §2 (lab results, vitals, allergies, immunizations) as tabs on one page; "Conditions" is the chronic-condition management module from §21 (diagnosis, status, severity, linked medications/care plans). Splitting these by name alone would have meant two nav items with overlapping mental models — grouping by "what changes together" (vitals/labs/allergies/immunizations are all "current health facts") vs. "what's a standing diagnosis" made the split legible.
- **Sharing** covers both consent-based provider/organization access (§28) and caregiver links (§4) as two tabs — both are "who can see my data," just with different grant mechanics underneath.

## Desktop vs. mobile shell (§69)

Desktop: a persistent left sidebar with all 11 items plus the signed-in user's name/role. Mobile: a 5-item bottom nav (Home, Timeline, Documents, Sharing, Profile — the actions a phone user needs most often) plus a minimal top bar (Privacy Center shortcut, sign out); the remaining nav items (Health, Medications, Conditions, Appointments, Insights, Settings) are reached from the Home dashboard's summary tiles and links rather than a hidden hamburger menu, keeping the primary mobile surface uncluttered. See [`src/components/layout/app-shell.tsx`](../../src/components/layout/app-shell.tsx).

## Screen hierarchy

```
/ (marketing, public)
/signin, /signup, /forgot-password, /reset-password (public)
/onboarding (patient, profile not yet created)
/portal (provider/caregiver — minimal overview, see docs/discovery-report.md)
/(app)/* (patient, profile exists)
  /dashboard         Home
  /health            Labs · Vitals · Allergies · Immunizations (tabs)
  /timeline          Filterable chronological history
  /documents         Upload, OCR review, download
  /medications       Active / past
  /conditions
  /appointments      Upcoming / past
  /sharing           Provider access · Caregivers (tabs)
  /insights          AI features (only shown meaningfully when ENABLE_AI=true)
  /privacy           Export, AI privacy, access history
  /profile
  /settings          Devices/sessions, emergency-access toggle, sign out
```

## Redirect rules (who lands where)

- Unauthenticated → `/signin`
- Authenticated, role ≠ PATIENT → `/portal` (the patient shell assumes a `PatientProfile` on every page; sending a provider into it would 422 on the first API call)
- Authenticated PATIENT, no profile yet → `/onboarding`
- Authenticated PATIENT, profile exists → the requested `/(app)/*` page

Implemented once, server-side, in [`src/app/(app)/layout.tsx`](../../src/app/(app)/layout.tsx) — no individual page re-implements this logic.
