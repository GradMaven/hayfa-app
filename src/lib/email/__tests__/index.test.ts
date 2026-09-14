import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getEmailProvider, _resetEmailProviderForTests } from "../index";

const originalEnv = { ...process.env };

beforeEach(() => {
  _resetEmailProviderForTests();
});

afterEach(() => {
  process.env = { ...originalEnv };
  _resetEmailProviderForTests();
});

describe("getEmailProvider", () => {
  it("defaults to the console provider when EMAIL_PROVIDER is unset", () => {
    delete process.env.EMAIL_PROVIDER;
    const provider = getEmailProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.send).toBe("function");
  });

  it("uses the console provider for any value other than 'smtp'", () => {
    process.env.EMAIL_PROVIDER = "something-else";
    expect(() => getEmailProvider()).not.toThrow();
  });

  it("throws a clear error if EMAIL_PROVIDER=smtp but SMTP_HOST is missing", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.SMTP_HOST;
    expect(() => getEmailProvider()).toThrow(/SMTP_HOST/);
  });

  it("constructs an SMTP provider without throwing when SMTP_HOST is set", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";
    const provider = getEmailProvider();
    expect(provider).toBeDefined();
  });

  it("returns the same instance across calls (singleton) until reset", () => {
    delete process.env.EMAIL_PROVIDER;
    const a = getEmailProvider();
    const b = getEmailProvider();
    expect(a).toBe(b);
  });

  it("console provider's send() resolves without throwing", async () => {
    delete process.env.EMAIL_PROVIDER;
    const provider = getEmailProvider();
    await expect(
      provider.send({ to: "test@example.com", subject: "Test", html: "<p>hi</p>", text: "hi" })
    ).resolves.toBeUndefined();
  });
});
