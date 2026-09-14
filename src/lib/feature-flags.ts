// Central feature-flag reads. Never branch on process.env.* directly elsewhere —
// route everything through here so flags are documented in one place and easy
// to audit (§82).
//
// Every flag is NEXT_PUBLIC_-prefixed and referenced as a static
// `process.env.NEXT_PUBLIC_X` expression (not a dynamic `process.env[name]`
// lookup) — both are required for Next.js to inline the real value into the
// browser bundle at build time. Several of these flags gate what a Client
// Component renders (e.g. whether the "Explain this" AI button appears at
// all), not just server-side route behavior — a non-prefixed or
// dynamically-read var silently evaluates to `undefined` in the browser
// regardless of the real server value, which is a real bug class, not a
// theoretical one: it's exactly what made featureFlags.ai/.ocr permanently
// read as `false` on the client even with ENABLE_AI=true on the server,
// until this file was rewritten this way. None of these values are
// sensitive — they're on/off switches, not secrets — so exposing them to
// the browser is the correct fix, not a compromise.

function toBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  return raw === "true" || raw === "1";
}

export const featureFlags = {
  ai: toBool(process.env.NEXT_PUBLIC_ENABLE_AI, false),
  ocr: toBool(process.env.NEXT_PUBLIC_ENABLE_OCR, true),
  wearables: toBool(process.env.NEXT_PUBLIC_ENABLE_WEARABLES, false),
  sms: toBool(process.env.NEXT_PUBLIC_ENABLE_SMS, false),
  ussd: toBool(process.env.NEXT_PUBLIC_ENABLE_USSD, false),
  providerPortal: toBool(process.env.NEXT_PUBLIC_ENABLE_PROVIDER_PORTAL, true),
  billing: toBool(process.env.NEXT_PUBLIC_ENABLE_BILLING, false),
  organizations: toBool(process.env.NEXT_PUBLIC_ENABLE_ORGANIZATIONS, false),
} as const;

export type FeatureFlags = typeof featureFlags;
