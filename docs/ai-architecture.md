# AI Architecture

## Pipeline (§50)

```
Feature request (e.g. "summarize my timeline")
        ↓
Route handler: authenticate + canAccess() for the scope involved
        ↓
Data minimization: select only the fields this feature needs
        ↓
AIProvider (interface) — mock in this phase, real vendor is a swap
        ↓
Safety screen: screenForHighRisk() on source text
        ↓
AIResponse { text, sources[], generatedAt, safetyFlag, disclaimer }
        ↓
UI renders result WITH sources + disclaimer + urgent-care banner if flagged
```

`AIProvider` ([`src/lib/ai/index.ts`](../src/lib/ai/index.ts)) is the only place an AI vendor call would be made. It is never called directly from a UI component — always from a route handler, so the data-minimization and consent checks happen server-side and can't be bypassed by a modified client.

## Why the response shape is fixed, not free text

`AIResponse` requires `sources` and `disclaimer` as structural fields, not optional ones — a caller cannot construct a response that omits them. This is what makes §52 ("every AI-generated insight must clearly indicate it's AI-generated, based on what, and when") a property of the type system rather than a UI convention someone can forget to apply on a new screen.

## Safety screening (§25, §91)

`screenForHighRisk()` checks source text against a fixed term list (chest pain, difficulty breathing, unconsciousness, severe bleeding, suicidal ideation, severe allergic reaction). A match sets `safetyFlag: "URGENT_CARE_RECOMMENDED"`, which the UI (`/insights`, `/timeline`) renders as a prominent "consider seeking care soon" banner *above* the AI text, not folded into it. This is intentionally a blunt, auditable keyword screen rather than a second model call — for an MVP, false positives (over-flagging) are the safe failure mode; false negatives are not something a keyword list should be trusted to catch reliably, which is exactly why the product framing (§25) is "prioritize seeking care," not "the AI decided this is/isn't an emergency."

## What the AI is never allowed to do (§23, §51 boundary)

Enforced by what the interface exposes, not by prompt instructions alone: `AIProvider` has four narrow methods (`summarizeTimeline`, `explainLabResult`, `summarizeDocument`, `prepareForVisit`). There is no `diagnose()`, `prescribe()`, or `recommendTreatment()` method — adding one would be a visible, reviewable interface change, not a prompt tweak. `CarePlan.goal` is a free-text field the patient or provider sets; nothing in the AI layer writes to it.

## Data governance (§53)

- `ENABLE_AI` defaults to `false`. When off, `/insights` shows a plain "AI features are turned off, no data is sent to any provider" message rather than a disabled button — the state is legible, not just inert.
- No patient data reaches a real external AI vendor in this phase — `getAIProvider()` always returns the deterministic mock (see comment in `src/lib/ai/index.ts`). Wiring a real provider is a Phase 2 task that must land alongside: a vendor agreement covering data retention/training-use, prompt logging policy, and an update to this document — not a one-line env var change treated as complete.
- OCR follows the identical non-negotiable rule (§18): `OCRProvider.extract()` returns a **draft** (`OcrResult` with per-field confidence); nothing writes it into a clinical table until a human calls the `/confirm` endpoint with reviewed (possibly edited) values. See [`src/app/api/v1/documents/[id]/ocr/confirm/route.ts`](../src/app/api/v1/documents/[id]/ocr/confirm/route.ts).

## AI-feature-to-spec-section map (§51)

| §51 feature | Status |
|---|---|
| 1. Medical document summary | `POST /api/v1/ai/summarize-document` — built |
| 2. Health timeline summary | `POST /api/v1/ai/timeline-summary` — built, on `/timeline` |
| 3. Lab explanation | `POST /api/v1/ai/explain-lab` — built, on `/health` labs tab |
| 4. Doctor visit preparation | `POST /api/v1/ai/prepare-visit` — built, on `/insights` |
| 5. Record organization suggestions | Not built — natural next addition to the OCR confirm step |
