# System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                       │
│                                                                 │
│  ┌───────────────────┐        ┌──────────────────────────┐  │
│  │  App Router (UI)    │        │  Route Handlers (API)      │  │
│  │  /app/(marketing)    │        │  /app/api/v1/*             │  │
│  │  /app/(app)/*         │◄──────►│  versioned, JSON envelope  │  │
│  │  server + client comp│        │  auth + consent + audit    │  │
│  └───────────────────┘        └──────────────┬───────────┘  │
│                                                 │               │
│  ┌──────────────────────────────────────────────▼─────────┐ │
│  │  lib/ — domain services (not UI, not framework-bound)     │ │
│  │  auth · consent-engine · audit · storage · ai · ocr ·     │ │
│  │  validation · feature-flags · i18n · notifications          │ │
│  └──────────────────────────────────────────────┬─────────┘ │
└─────────────────────────────────────────────────┼─────────────┘
                                                     │
                 ┌───────────────────────────────────┼──────────────────┐
                 ▼                                    ▼                  ▼
         ┌───────────────┐                  ┌──────────────────┐  ┌──────────────┐
         │  PostgreSQL     │                  │  Object storage     │  │  AI provider   │
         │  (Prisma)        │                  │  (S3-compatible,     │  │  (mock now,     │
         │                 │                  │  MinIO locally)     │  │  swappable)     │
         └───────────────┘                  └──────────────────┘  └──────────────┘
```

A single Next.js deployable is the right call for MVP velocity, but the API is written as if it will be consumed by more than the bundled UI: every route lives under `/api/v1/`, returns the `{success, data, meta}` / `{success, error}` envelope from §46, and does its own auth/consent/audit — never trusting that "the UI already checked."

## Why not microservices yet

Splitting auth/consent/documents/AI into separate services before there's a single real user buys nothing and costs a lot (network calls where function calls would do, distributed transactions for what are currently local ones). The domain services in `lib/` are already isolated behind interfaces (`StorageProvider`, `AIProvider`, `OCRProvider`, `HealthDataConnector`, `NotificationProvider`) specifically so that if/when scale demands it, one of them can be pulled into its own service without touching the others.

## Folder structure

```
hafya-app/
  docs/                          architecture + privacy + UX docs (this set)
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      (marketing)/                landing page, public
        page.tsx
      (auth)/                     sign-in, sign-up, verify, reset
      (app)/                      authenticated shell (sidebar/bottom-nav)
        layout.tsx
        dashboard/
        timeline/
        documents/
        medications/
        conditions/
        labs/
        vitals/
        appointments/
        sharing/                  consent + data sharing UI
        insights/                 AI features
        privacy/                  Privacy Center
        profile/
        settings/
      portal/                       provider/caregiver shell (not the (app) sidebar — own minimal header)
        page.tsx                    patient list (who granted this actor access)
        patients/[patientId]/       provider-only chart view — see docs/provider-portal-architecture.md
      admin/                        SUPER_ADMIN shell — provider verification, organization
                                     management, user account administration; see
                                     docs/admin-architecture.md
        organizations/               organization CRUD + verification
        users/                       account list + suspend/deactivate/reactivate
      api/v1/
        auth/[...nextauth]/
        patients/
        health-records/
        timeline/
        documents/
        labs/
        medications/
        conditions/
        vitals/
        appointments/
        consents/
        sharing/
        audit/
        ai/
    components/
      ui/                         design-system primitives (Button, Card, Badge…)
      health/                     domain components (TimelineEvent, LabResultCard…)
      layout/                     AppShell, Sidebar, BottomNav, TopBar
    lib/
      auth/                       Auth.js config, session helpers, RBAC guards
      consent/                    canAccess() engine
      audit/                      append-only audit writer
      storage/                    StorageProvider interface + local/S3 impls
      ai/                         AIProvider interface + mock impl
      ocr/                        OCRProvider interface + mock impl
      integrations/                HealthDataConnector interface + mock connector
      notifications/               NotificationProvider interface + in-app/email/SMS impls
      sms/                         SmsProvider interface + console/Africa's Talking impls
      validation/                  Zod schemas, one per domain entity
      db.ts                       Prisma client singleton
      feature-flags.ts
      i18n/
        en.json / sw.json
      api-response.ts             envelope helpers
    types/
  public/
  docker-compose.yml               local Postgres + MinIO
  .env.example
```

## Request lifecycle (every sensitive route)

```
Request
  → Auth.js session check (authenticated?)
  → Role authorization (does this role ever get this action?)
  → Object-level check: does THIS actor own/have consent for THIS patient's data?
  → Zod validation of input
  → Domain logic
  → Audit event write
  → Response
```

This mirrors §90/§105: authentication alone never authorizes access to a specific patient's resource — see [security-architecture.md](security-architecture.md).

## Environments

Development / Staging / Production are separate Postgres databases and separate object-storage buckets, selected via environment variables (`DATABASE_URL`, `STORAGE_*`), never by branching code on `NODE_ENV` inside business logic. See [ENVIRONMENT.md](../ENVIRONMENT.md).
