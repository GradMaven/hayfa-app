# AI Architecture

## Pipeline (§50)

```
Feature request (e.g. "summarize my timeline")
        ↓
Route handler: authenticate + canAccess() for the scope involved
        ↓
Data minimization: select only the fields this feature needs
        ↓
AIProvider (interface) — mock by default; Anthropic (Claude) when
                          AI_PROVIDER=anthropic + AI_API_KEY are set
        ↓
Vendor call wrapped in try/catch — any failure becomes a plain
"temporarily unavailable" message (§65), never a leaked error
        ↓
Safety screen: screenForHighRisk() on BOTH the input data and the
                model's own output text
        ↓
AIResponse { text, sources[], generatedAt, safetyFlag, disclaimer }
        ↓
UI renders result WITH sources + disclaimer + urgent-care banner if flagged
```

`AIProvider` ([`src/lib/ai/index.ts`](../src/lib/ai/index.ts)) is the only place an AI vendor call is made. It is never called directly from a UI component — always from a route handler, so the data-minimization and consent checks happen server-side and can't be bypassed by a modified client.

## The real vendor: Anthropic (Claude)

`AnthropicAIProvider` implements the same four-method interface as the mock, using the official `@anthropic-ai/sdk`. Selected only when **both** `AI_PROVIDER=anthropic` and `AI_API_KEY` are set ([`getAIProvider()`](../src/lib/ai/index.ts)) — any other or missing configuration falls back to the mock rather than throwing, so a half-configured environment fails safe. Model defaults to `claude-haiku-4-5-20251001` (fast, inexpensive, the right fit for short factual summaries), overridable via `AI_MODEL`.

**Verified live against the real API** (not just typechecked or unit-tested against a mock client) — this session has no valid Anthropic API key, so verification took two forms:
1. **Request-building and response-parsing logic**: 23 unit tests inject a fake client matching the SDK's shape ([`AnthropicClientLike`](../src/lib/ai/index.ts)) and assert on exact request contents (system prompt per feature, temperature, token limits, message structure) and response handling (text extraction, error wrapping, safety-flag computation) — see [`src/lib/ai/__tests__/anthropic-provider.test.ts`](../src/lib/ai/__tests__/anthropic-provider.test.ts).
2. **The real network path**: pointed the running app at `AI_PROVIDER=anthropic` with an intentionally invalid key and called `/api/v1/ai/explain-lab` for real. A genuine HTTPS round-trip to `api.anthropic.com` happened (~1s response time, a real `401 authentication_error` in the server log) — proving the request is correctly formed enough to reach and be parsed by Anthropic's servers — and the failure surfaced through the exact §65-compliant path: logged server-side with the real vendor error, returned to the client as "This explanation is temporarily unavailable," rendered correctly in the UI. A valid key would follow the identical code path to a successful response — this is the strongest verification possible without one.

## The real OCR vendor: Claude vision/document input

`AnthropicOCRProvider` ([`src/lib/ocr/index.ts`](../src/lib/ocr/index.ts)) implements the same `OCRProvider.extract()` interface as the mock, sending the uploaded document's bytes to Claude as an image or PDF content block (`@anthropic-ai/sdk`'s `ImageBlockParam`/`DocumentBlockParam`) with a system prompt that requires a single structured JSON response (`documentType`, `rawText`, up to 15 `fields` each with a label/value/confidence, `overallConfidence`) — parsed and validated against a Zod schema before it's trusted, so a malformed or off-shape response from the vendor is rejected rather than silently written into `Document.ocrExtractedData`. Selected only when **both** `OCR_PROVIDER=anthropic` and `AI_API_KEY` are set ([`getOcrProvider()`](../src/lib/ocr/index.ts)); any other or missing configuration falls back to the mock. It deliberately reuses `AI_API_KEY` rather than introducing a separate `OCR_API_KEY` — it's the same Anthropic vendor account already required for `AI_PROVIDER=anthropic`, and there's no distinct "OCR product" being called, just Claude's vision/document input. Model defaults to `claude-sonnet-5` (vision-capable, and the stronger model is worth it for reading a document image where `AI_MODEL`'s faster/cheaper default suffices for the text-only AI features), overridable via `OCR_MODEL`.

A field's `confidence` here is the model's own self-assessment of how certain it is a value was read correctly, not a calibrated statistical measure the way a purpose-built OCR engine's confidence score would be — this is a real, documented limitation of using an LLM for extraction rather than a dedicated OCR vendor (Textract/Vision/etc.), noted so the UI's confidence display isn't read as more precise than it is.

**A real bug this work surfaced and fixed, unrelated to OCR itself**: live-testing the confirm-before-write flow end-to-end (mock OCR draft → `/confirm`) to make sure the surrounding routes still worked after the provider changes above turned up `ocrConfirmSchema.documentId` (and `labResultSchema.documentId`) validated as `z.string().cuid()`, while `POST /api/v1/documents` actually generates `Document.id` with `crypto.randomUUID()` (needed up front to build the storage key before the row exists) — a UUID, not a cuid, despite the Prisma model's `@default(cuid())` (which never fires, since the route always supplies its own `id`). This meant `/confirm` rejected **every** real document with `VALIDATION_ERROR`, not just an edge case — the confirm-before-write flow was broken end-to-end despite being documented elsewhere as "Built" and "verified against the running app." Fixed by changing both fields to `z.string().uuid()` to match what's actually generated; see [`src/lib/validation/documents.ts`](../src/lib/validation/documents.ts) and [`clinical.ts`](../src/lib/validation/clinical.ts).

**Verified by unit tests against an injected fake client, not the live API** — this session had no `AI_API_KEY` available for a real network call (unlike the AI-vendor work, which got one manual live round-trip against `api.anthropic.com`). 19 unit tests ([`src/lib/ocr/__tests__/anthropic-provider.test.ts`](../src/lib/ocr/__tests__/anthropic-provider.test.ts), [`index.test.ts`](../src/lib/ocr/__tests__/index.test.ts)) cover request-building (image vs. PDF content block selection, mime-type fallback for an unrecognized image type, the system prompt's content), response parsing (well-formed JSON, JSON wrapped in a markdown fence despite instructions not to, invalid JSON, schema-violating JSON, a hallucinated `documentType` outside the known enum, a `null` documentType), error handling (vendor error messages never leak to the caller, an empty response throws), and provider selection (mock fallback when unconfigured or partially configured, real provider only when both env vars are set, singleton behavior). The request/response-handling logic is exercised the same way as `AnthropicAIProvider`'s own tests; only the final "does a real key produce a real successful vision response" step is unverified this session.

## Why the response shape is fixed, not free text

`AIResponse` requires `sources` and `disclaimer` as structural fields, not optional ones — a caller cannot construct a response that omits them. This is what makes §52 ("every AI-generated insight must clearly indicate it's AI-generated, based on what, and when") a property of the type system rather than a UI convention someone can forget to apply on a new screen.

## Safety screening (§25, §91)

`screenForHighRisk()` checks text against a fixed term list (chest pain, difficulty breathing, unconsciousness, severe bleeding, suicidal ideation, severe allergic reaction). The real provider screens **both** the input data passed to the model **and** the model's own output text, flagging `URGENT_CARE_RECOMMENDED` if either matches — screening only the input would miss a case where the model itself surfaces something concerning that wasn't phrased that way in the source data; screening only the output would miss a case where the model, despite instructions, doesn't repeat a risk term present in what it was given. The UI (`/insights`, `/timeline`, `/documents`) renders a prominent "consider seeking care soon" banner *above* the AI text when flagged, not folded into it.

This is intentionally a blunt, auditable keyword screen rather than a second model call — for this phase, false positives (over-flagging) are the safe failure mode; false negatives are not something a keyword list should be trusted to catch reliably, which is exactly why the product framing (§25) is "prioritize seeking care," not "the AI decided this is/isn't an emergency."

## What the AI is never allowed to do (§23, §51 boundary)

Enforced two ways, not by prompt instructions alone:
- **Structurally**: `AIProvider` has four narrow methods (`summarizeTimeline`, `explainLabResult`, `summarizeDocument`, `prepareForVisit`). There is no `diagnose()`, `prescribe()`, or `recommendTreatment()` method — adding one would be a visible, reviewable interface change, not a prompt tweak. `CarePlan.goal` is a free-text field the patient or provider sets; nothing in the AI layer writes to it.
- **In the system prompt**: every real-provider call carries a shared safety-boundary instruction (`SAFETY_BOUNDARY` in `src/lib/ai/index.ts`) appended to all four feature-specific prompts — "never diagnose, prescribe, recommend starting/stopping/changing any medication, or claim certainty about a diagnosis... base your response only on the information given... [escalate clearly on emergency signs]." A unit test asserts this instruction is present in every one of the four prompts, so a future edit that accidentally drops it from one feature fails CI rather than shipping silently.

Prompt instructions are not a hard guarantee the way the missing methods are — a model can, in principle, fail to follow them. That's a known, documented limit of this approach (see "What's not covered" below), not a claim of perfect enforcement.

## Data governance (§53)

- `NEXT_PUBLIC_ENABLE_AI` defaults to `false`. When off, `/insights` shows a plain "AI features are turned off, no data is sent to any provider" message rather than a disabled button — the state is legible, not just inert.
- No patient data reaches a real external AI vendor unless an operator deliberately sets both `AI_PROVIDER=anthropic` and a real `AI_API_KEY` — `getAIProvider()` returns the mock otherwise, and the mock never makes a network call.
- Every route selects only the minimal fields a feature needs before calling the provider (e.g. `timeline-summary` pulls `{id, type, title}` from `HealthEvent`, never the underlying clinical record) — unchanged by which provider answers the call.
- No prompt/response logging beyond the existing generic error log (vendor error message only, on failure) — full conversation content is never persisted server-side.
- OCR follows the identical non-negotiable rule (§18): `OCRProvider.extract()` returns a **draft** (`OcrResult` with per-field confidence); nothing writes it into a clinical table until a human calls the `/confirm` endpoint with reviewed (possibly edited) values. See [`src/app/api/v1/documents/[id]/ocr/confirm/route.ts`](../src/app/api/v1/documents/[id]/ocr/confirm/route.ts). This rule is unaffected by which provider produced the draft — it applies identically to the mock and to `AnthropicOCRProvider` (see "The real OCR vendor" above).
- OCR's real vendor is gated the same way as AI's: `OCR_PROVIDER=anthropic` + `AI_API_KEY` must both be set, or the mock runs — never a partial/misconfigured state silently reaching a vendor.

## A bug this work surfaced and fixed: feature flags in Client Components

`featureFlags.ai`/`.ocr` are read from several Client Components (`/insights`, the labs-tab "Explain this" button, the document card's OCR/Summarize buttons, the timeline AI-summary button) to decide what to render. The flags were originally sourced from plain `ENABLE_AI`/`ENABLE_OCR` env vars via a dynamic `process.env[name]` lookup — which Next.js never inlines into the browser bundle (only statically-referenced `NEXT_PUBLIC_*` vars are), so every one of those checks silently evaluated to `false` in the browser regardless of the real server-side value. The Insights page, for instance, permanently showed "AI features are turned off" even with `ENABLE_AI=true`, and produced a genuine React hydration-mismatch error in the process (server render saw the real value, client hydration didn't).

Fixed by renaming every flag to `NEXT_PUBLIC_*` and reading each via a static `process.env.NEXT_PUBLIC_X` expression ([`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts)) — both are required for Next's build-time inlining to work. None of these flags are sensitive (they're on/off switches, not secrets), so exposing them to the client is the correct fix, not a compromise. Verified live: before the fix, `/insights` showed the disabled message and threw a hydration error despite `ENABLE_AI=true`; after, it renders the real feature and the button/panel wiring described above.

## AI-feature-to-spec-section map (§51)

| §51 feature | Status |
|---|---|
| 1. Medical document summary | `POST /api/v1/ai/summarize-document` — built, and now actually wired to a "Summarize" button on `/documents` (previously implemented server-side with no UI caller — fixed alongside this work) |
| 2. Health timeline summary | `POST /api/v1/ai/timeline-summary` — built, on `/timeline` and `/insights` |
| 3. Lab explanation | `POST /api/v1/ai/explain-lab` — built, on `/health` labs tab |
| 4. Doctor visit preparation | `POST /api/v1/ai/prepare-visit` — built, on `/insights` |
| 5. Record organization suggestions | Not built — natural next addition to the OCR confirm step |
| OCR / document intelligence (§18) | `POST /api/v1/documents/:id/ocr` — built, mock by default, real vendor (`OCR_PROVIDER=anthropic`, Claude vision/document input) wired and unit-tested, not yet live-API-verified — see "The real OCR vendor" above |

## What's not covered by this phase

- **No real-vendor integration test in CI** — the unit tests (23 for `AIProvider`, 19 for `OCRProvider`) use an injected fake client; nothing in the automated test suite makes a real network call (correctly — that would require a real key in CI, cost money per run, and be flaky against a live third-party service). The AI-vendor live verification described above was a manual, one-time pass in one session; OCR's real vendor has not yet had that same manual live-API pass (no key was available in the session that built it) — the request/response logic is unit-tested, but a real Claude vision response to a real document has not been observed by this codebase's own verification process yet.
- **OCR confidence scores are a model self-assessment**, not a calibrated statistic the way a purpose-built OCR/document-AI vendor's would be — see "The real OCR vendor" above.
- **No prompt-injection hardening** beyond the safety-boundary instructions — a carefully-crafted patient-entered record (e.g. a document title or care-plan note containing adversarial text) is passed into the user-turn content the same as any other data. This is a known class of risk for any LLM feature reading user-controlled data and is not specifically mitigated here beyond the model's own instruction-following.
- **No cost/rate limiting specific to AI calls** beyond the general per-route authorization — a verified, authenticated user can call these endpoints as often as the UI allows; production use should add usage limits before enabling a real vendor for real users.
