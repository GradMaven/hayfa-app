# Privacy

Full detail: [`docs/privacy-architecture.md`](docs/privacy-architecture.md) and [`docs/privacy/`](docs/privacy/) (data map, DPIA working draft, retention, consent model, access control). This file is the plain-language summary.

## What we believe

The patient owns their health record. Hafya's job is to make that ownership real and usable: bring fragmented records together, show a clear history, and make sharing an explicit, revocable, auditable choice — never a default.

## What this means in the product

- **Nothing is shared by default.** A provider or caregiver sees only what you explicitly grant, for exactly the scopes and duration you choose (`/sharing`).
- **You can see who looked at your records, and when** (`/privacy` access history) — every access, allowed or denied, is logged.
- **You can export your full record at any time**, in a structured format, without asking anyone's permission.
- **AI features never see more than they need**, are off by default (`NEXT_PUBLIC_ENABLE_AI=false`), and run on a local mock — no data reaches any AI vendor — unless an operator explicitly configures a real one (`AI_PROVIDER=anthropic` + a real key). That path exists and is verified working, but stays opt-in on purpose; see [`docs/ai-architecture.md`](docs/ai-architecture.md) for exactly what data a real vendor call sends.
- **Emergency access is opt-in and logged**, never a standing backdoor — see [`docs/security-architecture.md`](docs/security-architecture.md).

## What this build is not (yet)

This is not a legal compliance certification. [`docs/privacy/dpia.md`](docs/privacy/dpia.md) is an engineering-authored working draft that explicitly flags where qualified Kenyan legal/privacy review is required before any claim of Data Protection Act or Digital Health Act compliance is made. Data retention periods are not yet enforced by code — see [`docs/privacy/data-retention.md`](docs/privacy/data-retention.md).

## Synthetic data only

Everything seeded into this project (`prisma/seed.ts`) is fictional, clearly marked (`@hafya.demo` email domain), and intended for development/demo purposes only — see §73. Never load real patient data into this build as it currently stands without completing the legal review flagged throughout `docs/privacy/`.
