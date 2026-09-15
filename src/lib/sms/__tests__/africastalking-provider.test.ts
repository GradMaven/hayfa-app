import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AfricasTalkingSmsProvider, type FetchLike } from "../index";

function fakeFetch(jsonBody: unknown, ok = true) {
  const fn: FetchLike = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => jsonBody });
  return fn;
}

const SUCCESS_RESPONSE = {
  SMSMessageData: {
    Message: "Sent to 1/1 Total Cost: KES 0.8000",
    Recipients: [{ number: "+254712345678", status: "Success", statusCode: 101, messageId: "ATXid_123", cost: "KES 0.8000" }],
  },
};

describe("AfricasTalkingSmsProvider — construction", () => {
  const originalKey = process.env.SMS_API_KEY;
  const originalUsername = process.env.SMS_USERNAME;
  beforeEach(() => {
    process.env.SMS_API_KEY = originalKey;
    process.env.SMS_USERNAME = originalUsername;
  });

  it("throws a clear error if constructed without both SMS_API_KEY and SMS_USERNAME", () => {
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_USERNAME;
    expect(() => new AfricasTalkingSmsProvider()).toThrow(/SMS_API_KEY/);
  });
});

describe("AfricasTalkingSmsProvider — request shape", () => {
  const originalKey = process.env.SMS_API_KEY;
  const originalUsername = process.env.SMS_USERNAME;
  const originalSender = process.env.SMS_SENDER_ID;

  beforeEach(() => {
    process.env.SMS_API_KEY = "test-key";
    process.env.SMS_USERNAME = "sandbox";
    delete process.env.SMS_SENDER_ID;
  });

  afterEach(() => {
    process.env.SMS_API_KEY = originalKey;
    process.env.SMS_USERNAME = originalUsername;
    process.env.SMS_SENDER_ID = originalSender;
  });

  it("uses the sandbox URL when SMS_USERNAME=sandbox", async () => {
    const fetchImpl = fakeFetch(SUCCESS_RESPONSE);
    const provider = new AfricasTalkingSmsProvider(fetchImpl);
    await provider.send({ to: "+254712345678", message: "Test" });
    const url = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain("sandbox.africastalking.com");
  });

  it("uses the production URL for a real username", async () => {
    process.env.SMS_USERNAME = "hafya_prod";
    const fetchImpl = fakeFetch(SUCCESS_RESPONSE);
    const provider = new AfricasTalkingSmsProvider(fetchImpl);
    await provider.send({ to: "+254712345678", message: "Test" });
    const url = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toBe("https://api.africastalking.com/version1/messaging");
    expect(url).not.toContain("sandbox");
  });

  it("sends the apiKey as a header, never in the body or URL", async () => {
    const fetchImpl = fakeFetch(SUCCESS_RESPONSE);
    const provider = new AfricasTalkingSmsProvider(fetchImpl);
    await provider.send({ to: "+254712345678", message: "Test" });
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>).apiKey).toBe("test-key");
    expect(url).not.toContain("test-key");
    expect(String(init.body)).not.toContain("test-key");
  });

  it("includes username, to, and message in the form body", async () => {
    const fetchImpl = fakeFetch(SUCCESS_RESPONSE);
    const provider = new AfricasTalkingSmsProvider(fetchImpl);
    await provider.send({ to: "+254712345678", message: "Your appointment is tomorrow" });
    const init = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const params = new URLSearchParams(init.body as string);
    expect(params.get("username")).toBe("sandbox");
    expect(params.get("to")).toBe("+254712345678");
    expect(params.get("message")).toBe("Your appointment is tomorrow");
    expect(params.has("from")).toBe(false);
  });

  it("includes a from param only when SMS_SENDER_ID is set", async () => {
    process.env.SMS_SENDER_ID = "HAFYA";
    const fetchImpl = fakeFetch(SUCCESS_RESPONSE);
    const provider = new AfricasTalkingSmsProvider(fetchImpl);
    await provider.send({ to: "+254712345678", message: "Test" });
    const init = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const params = new URLSearchParams(init.body as string);
    expect(params.get("from")).toBe("HAFYA");
  });
});

describe("AfricasTalkingSmsProvider — response handling", () => {
  const originalKey = process.env.SMS_API_KEY;
  const originalUsername = process.env.SMS_USERNAME;

  beforeEach(() => {
    process.env.SMS_API_KEY = "test-key";
    process.env.SMS_USERNAME = "sandbox";
  });

  afterEach(() => {
    process.env.SMS_API_KEY = originalKey;
    process.env.SMS_USERNAME = originalUsername;
  });

  it("resolves without throwing on a successful send", async () => {
    const provider = new AfricasTalkingSmsProvider(fakeFetch(SUCCESS_RESPONSE));
    await expect(provider.send({ to: "+254712345678", message: "Test" })).resolves.toBeUndefined();
  });

  it("throws when the recipient status is not Success", async () => {
    const failed = {
      SMSMessageData: {
        Message: "InvalidPhoneNumber",
        Recipients: [{ number: "+254712345678", status: "InvalidPhoneNumber", statusCode: 400 }],
      },
    };
    const provider = new AfricasTalkingSmsProvider(fakeFetch(failed));
    await expect(provider.send({ to: "+254712345678", message: "Test" })).rejects.toThrow();
  });

  it("throws when there are no recipients in the response", async () => {
    const empty = { SMSMessageData: { Message: "No recipients", Recipients: [] } };
    const provider = new AfricasTalkingSmsProvider(fakeFetch(empty));
    await expect(provider.send({ to: "+254712345678", message: "Test" })).rejects.toThrow();
  });

  it("throws (without leaking vendor error details) when the request itself fails", async () => {
    const fetchImpl: FetchLike = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT 1.2.3.4:443"));
    const provider = new AfricasTalkingSmsProvider(fetchImpl);

    let caught: unknown;
    try {
      await provider.send({ to: "+254712345678", message: "Test" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain("ETIMEDOUT");
  });
});
