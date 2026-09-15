# Notification Architecture

## Channels and their status (§39–40)

| Channel | Status |
|---|---|
| In-app | Built — every `notify()` call writes a `Notification` row, surfaced in the notification bell/list |
| Email | Built — real vendor (`EMAIL_PROVIDER=smtp`, any SMTP-speaking vendor), console mode by default. See [`src/lib/email/index.ts`](../src/lib/email/index.ts). |
| SMS | Built — real vendor (`SMS_PROVIDER=africastalking`), console mode by default. See "SMS" below. |
| USSD | Not built, and not the same shape of problem — see "Why USSD isn't wired the same way" below. |
| Push | Not built — no mobile app/push-token infrastructure exists yet to send to. |

`notify()` ([`src/lib/notifications/index.ts`](../src/lib/notifications/index.ts)) is the single call site every feature uses to notify a user — callers never call `EmailProvider`/`SmsProvider` directly. It always writes the in-app `Notification` row, then best-effort fires email (if the user has one) and SMS (if `NEXT_PUBLIC_ENABLE_SMS=true` and the user has a phone number) — a delivery failure on either is logged and swallowed, never surfaced to the caller or the end user as an error, since the in-app notification already succeeded and is the source of truth.

## SMS: Africa's Talking

`AfricasTalkingSmsProvider` ([`src/lib/sms/index.ts`](../src/lib/sms/index.ts)) implements `SmsProvider.send()` against [Africa's Talking](https://africastalking.com)'s Messaging API — the standard SMS/USSD gateway across Kenya and East Africa, and a natural fit for this product's stated market. The protocol is one HTTP POST (form-urlencoded, `apiKey` as a header) and a JSON reply; it's called directly via `fetch` rather than through the `africastalking` npm package, the same judgment already applied to session auth (custom over a dependency with rough edges) and malware scanning (the clamd wire protocol implemented directly after `clamdjs` proved unreliable against a live daemon) — a protocol this simple doesn't need an unaudited dependency in a delivery-sensitive path.

- Selected only when **both** `SMS_PROVIDER=africastalking` and `SMS_API_KEY`/`SMS_USERNAME` are set (`getSmsProvider()`); any other or partial configuration falls back to the console provider (`[sms:console]` stdout logging, nothing sent), so a misconfigured environment fails safe rather than throwing on every notification.
- `SMS_USERNAME=sandbox` routes to Africa's Talking's sandbox API (`api.sandbox.africastalking.com`) for free testing against a real endpoint without sending real messages or incurring cost; any other username routes to the production API.
- `buildSmsBody()` caps the message to 160 characters (one GSM-7 SMS segment) so a notification body can't silently balloon into an expensive multi-part message — truncating with `…` rather than growing.
- §39's "never send full clinical detail over SMS" is enforced upstream, at `notify()`'s call sites, which already only ever pass short pointers ("New lab result available") as `title`/`body` — the SMS layer itself has no way to distinguish clinical from non-clinical text, so this is a convention every caller must follow, the same as it already is for email and in-app notifications.

**Verified by unit tests against an injected fetch, not the live API** — same reasoning and same gap as OCR's Claude vision call (see [ai-architecture.md](ai-architecture.md)): no Africa's Talking credentials were available this session. 10 unit tests ([`src/lib/sms/__tests__/africastalking-provider.test.ts`](../src/lib/sms/__tests__/africastalking-provider.test.ts)) cover request shape (sandbox vs. production URL selection, the API key sent as a header and never in the body/URL, form-body contents, the optional sender ID), response handling (success, a non-`Success` recipient status, an empty recipients array, a network failure that never leaks vendor error details), and construction (throws a clear error without both credentials). Provider selection is covered separately in [`index.test.ts`](../src/lib/sms/__tests__/index.test.ts) (9 tests), matching the fail-safe-selection pattern already used for `getAIProvider()`/`getOcrProvider()`.

## A real gap this surfaced and fixed: phone numbers were never collected

`User.phone` has existed in the schema since the original build (`@unique`, alongside `phoneVerifiedAt`), but no UI anywhere — not signup, not settings — ever let a user set one. Wiring a real SMS vendor without also fixing this would have been dead code: `notify()`'s `if (featureFlags.sms && user?.phone)` guard would never be true for any real user. Fixed narrowly:

- Sign-up (`POST /api/v1/auth/signup`) now accepts an optional `phone` field (`signUpSchema`, [`src/lib/validation/auth.ts`](../src/lib/validation/auth.ts)), checked for uniqueness the same way email already was.
- `PATCH /api/v1/account/phone` ([`src/app/api/v1/account/phone/route.ts`](../src/app/api/v1/account/phone/route.ts)) lets an existing account set or clear its phone number, surfaced as a "Phone number" card on `/settings`. Deliberately narrow — only the phone number, not name/email/password, which have their own dedicated (and more security-sensitive) flows. Every change writes an `AuditEvent` (`ACCOUNT_PHONE_UPDATED`/`ACCOUNT_PHONE_REMOVED`) and resets `phoneVerifiedAt` to `null` (no phone-verification flow exists yet — see "What's deferred" below — but a changed number should never inherit a previous number's verified state once one exists).
- Both validate against `phoneSchema` — international format only (`+` followed by 8–15 digits), which is what Africa's Talking's API requires for the `to` field.

## Why USSD isn't wired the same way

USSD has no "send a message" vendor API the way SMS does — a telco network doesn't support unsolicited USSD push to a phone. USSD only works as an **inbound** session: a patient dials a code (e.g. `*384*XXX#`), the network calls the application's webhook with a session ID and the digits typed so far, and the app must respond synchronously with either `CON <menu text>` (continue the session) or `END <final text>` (close it). This is a fundamentally different shape of feature — a new inbound endpoint with session-state handling and a menu system, not a channel `notify()` can push through — and was scoped out of this pass rather than faked as a send-side channel that would never actually do anything. `NotificationChannel.USSD` remains modeled in the schema (unused) and `NEXT_PUBLIC_ENABLE_USSD` remains a reserved, inert flag, both there for whenever this is built as its own feature.

## What's deferred

- The inbound USSD menu system described above.
- Phone number verification (an OTP-over-SMS confirm flow, mirroring `EmailVerificationToken`) — `phoneVerifiedAt` is modeled and reset on every phone change, but nothing currently sets it. Not required for SMS notifications to work (email verification is similarly non-blocking — see [security-architecture.md](security-architecture.md)), but would harden phone-based account recovery if that's ever built.
- Push notifications — no mobile app or push-token registration exists yet.
- No real-vendor integration test in CI for SMS, same reasoning as AI/OCR (see [ai-architecture.md](ai-architecture.md)) — a real network call in CI would need a real key, cost money, and be flaky against a live third party.
