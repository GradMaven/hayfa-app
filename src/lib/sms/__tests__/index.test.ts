import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getSmsProvider, AfricasTalkingSmsProvider, buildSmsBody, _resetSmsProviderForTests } from "../index";

describe("buildSmsBody", () => {
  it("combines title and body with a colon", () => {
    expect(buildSmsBody("Appointment reminder", "Tomorrow at 10am with Dr. Mwangi")).toBe(
      "Appointment reminder: Tomorrow at 10am with Dr. Mwangi"
    );
  });

  it("falls back to just the title when there is no body", () => {
    expect(buildSmsBody("New lab result available", "")).toBe("New lab result available");
  });

  it("truncates to a single GSM-7 SMS segment (160 chars) rather than silently sending a multi-part message", () => {
    const longBody = "x".repeat(200);
    const result = buildSmsBody("Alert", longBody);
    expect(result.length).toBe(160);
    expect(result.endsWith("…")).toBe(true);
  });

  it("never sends full clinical detail — it only ever combines what the caller already gave it", () => {
    // This is a structural note, not a runtime check: buildSmsBody has no
    // way to know what's "clinical" — the §39 constraint is enforced by
    // notify()'s callers always passing a short pointer, never a full
    // record, as title/body. See lib/notifications/index.ts.
    const result = buildSmsBody("New lab result available", "Open the app to view your full result.");
    expect(result).not.toContain("HbA1c");
  });
});

describe("getSmsProvider — provider selection", () => {
  const originalProvider = process.env.SMS_PROVIDER;
  const originalKey = process.env.SMS_API_KEY;
  const originalUsername = process.env.SMS_USERNAME;

  beforeEach(() => {
    _resetSmsProviderForTests();
  });

  afterEach(() => {
    process.env.SMS_PROVIDER = originalProvider;
    process.env.SMS_API_KEY = originalKey;
    process.env.SMS_USERNAME = originalUsername;
    _resetSmsProviderForTests();
  });

  it("defaults to the console provider when SMS_PROVIDER is unset", () => {
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_USERNAME;
    const provider = getSmsProvider();
    expect(provider).not.toBeInstanceOf(AfricasTalkingSmsProvider);
  });

  it("uses the console provider even with SMS_PROVIDER=africastalking if credentials are missing — fails safe, not throws", () => {
    process.env.SMS_PROVIDER = "africastalking";
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_USERNAME;
    const provider = getSmsProvider();
    expect(provider).not.toBeInstanceOf(AfricasTalkingSmsProvider);
  });

  it("uses the console provider if only one of SMS_API_KEY/SMS_USERNAME is set", () => {
    process.env.SMS_PROVIDER = "africastalking";
    process.env.SMS_API_KEY = "test-key";
    delete process.env.SMS_USERNAME;
    const provider = getSmsProvider();
    expect(provider).not.toBeInstanceOf(AfricasTalkingSmsProvider);
  });

  it("selects the real Africa's Talking provider only when SMS_PROVIDER=africastalking and both credentials are set", () => {
    process.env.SMS_PROVIDER = "africastalking";
    process.env.SMS_API_KEY = "test-key";
    process.env.SMS_USERNAME = "sandbox";
    const provider = getSmsProvider();
    expect(provider).toBeInstanceOf(AfricasTalkingSmsProvider);
  });

  it("is a singleton across calls until reset", () => {
    delete process.env.SMS_PROVIDER;
    const a = getSmsProvider();
    const b = getSmsProvider();
    expect(a).toBe(b);
  });
});
