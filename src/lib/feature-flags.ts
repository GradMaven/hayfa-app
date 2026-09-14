// Central feature-flag reads. Never branch on process.env.* directly elsewhere —
// route everything through here so flags are documented in one place and easy
// to audit (§82).

function flag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw === "true" || raw === "1";
}

export const featureFlags = {
  ai: flag("ENABLE_AI", false),
  ocr: flag("ENABLE_OCR", true),
  wearables: flag("ENABLE_WEARABLES", false),
  sms: flag("ENABLE_SMS", false),
  ussd: flag("ENABLE_USSD", false),
  providerPortal: flag("ENABLE_PROVIDER_PORTAL", true),
  billing: flag("ENABLE_BILLING", false),
  organizations: flag("ENABLE_ORGANIZATIONS", false),
} as const;

export type FeatureFlags = typeof featureFlags;
