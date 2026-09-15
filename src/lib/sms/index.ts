// SmsProvider abstraction — same shape as EmailProvider/AIProvider/OCRProvider
// (see docs/system-architecture.md): a real implementation swapped in behind
// an interface, selected by env var, never a framework rewrite.
// SMS_PROVIDER=console (default) logs to stdout for local dev with zero
// setup; SMS_PROVIDER=africastalking sends real SMS via Africa's Talking
// (https://africastalking.com), the standard SMS/USSD gateway across Kenya
// and East Africa — see docs/ai-architecture.md's sibling reasoning for why
// a protocol this simple (one HTTP POST, JSON reply) is implemented directly
// against the REST API rather than through the `africastalking` npm package,
// consistent with the same judgment already applied to session auth and
// malware scanning: a small, fully-understood implementation over an
// unaudited dependency for a security/delivery-sensitive path.
//
// §39: never send full clinical detail over SMS. This module only ever sees
// what notify() gives it (already a short title/body pointer by convention,
// enforced at the notify() call sites, not here) — buildSmsBody() further
// caps it to a single GSM-7 SMS segment so a long body can't silently
// balloon into an expensive multi-part message.

export interface SmsMessage {
  to: string; // E.164, e.g. +254712345678
  message: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

const MAX_SMS_LENGTH = 160; // single GSM-7 segment

export function buildSmsBody(title: string, body: string): string {
  const combined = body ? `${title}: ${body}` : title;
  if (combined.length <= MAX_SMS_LENGTH) return combined;
  return `${combined.slice(0, MAX_SMS_LENGTH - 1)}…`;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<void> {
    console.info(`[sms:console] to=${message.to}\n${message.message}\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Africa's Talking — the real vendor implementation. Selected only when
// SMS_PROVIDER=africastalking and SMS_API_KEY/SMS_USERNAME are set (see
// getSmsProvider() below).
// ─────────────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 15_000;
const PRODUCTION_URL = "https://api.africastalking.com/version1/messaging";
const SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging";

interface AfricasTalkingResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: { number: string; status: string; statusCode: number; messageId?: string; cost?: string }[];
  };
}

// Minimal shape this module actually uses — mirrors AnthropicClientLike in
// lib/ai/index.ts so tests can inject a lightweight fake without needing a
// real network call.
export type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class AfricasTalkingSmsProvider implements SmsProvider {
  private apiKey: string;
  private username: string;
  private senderId?: string;
  private baseUrl: string;
  private fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    const apiKey = process.env.SMS_API_KEY;
    const username = process.env.SMS_USERNAME;
    if (!apiKey || !username) {
      throw new Error("SMS_API_KEY and SMS_USERNAME must be set when SMS_PROVIDER=africastalking. See ENVIRONMENT.md.");
    }
    this.apiKey = apiKey;
    this.username = username;
    this.senderId = process.env.SMS_SENDER_ID || undefined;
    this.baseUrl = username === "sandbox" ? SANDBOX_URL : PRODUCTION_URL;
    this.fetchImpl = fetchImpl ?? (fetch as FetchLike);
  }

  async send(message: SmsMessage): Promise<void> {
    const body = new URLSearchParams({
      username: this.username,
      to: message.to,
      message: message.message,
      ...(this.senderId ? { from: this.senderId } : {}),
    });

    let json: AfricasTalkingResponse;
    try {
      const response = await this.fetchImpl(this.baseUrl, {
        method: "POST",
        headers: {
          apiKey: this.apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      json = (await response.json()) as AfricasTalkingResponse;
    } catch (err) {
      // Never let vendor error details reach the caller — same reasoning as
      // lib/ai/index.ts and lib/ocr/index.ts. Logged server-side only.
      console.error("[sms:africastalking] request failed:", err instanceof Error ? err.message : err);
      throw new Error("SMS provider request failed.");
    }

    const recipient = json.SMSMessageData?.Recipients?.[0];
    if (!recipient || recipient.status !== "Success") {
      console.error(
        "[sms:africastalking] send was not successful:",
        recipient?.status ?? json.SMSMessageData?.Message ?? "unrecognized response"
      );
      throw new Error("SMS provider was unable to deliver this message.");
    }
  }
}

let instance: SmsProvider | null = null;

// SMS_PROVIDER selects the provider: AfricasTalkingSmsProvider only when
// SMS_PROVIDER=africastalking AND both SMS_API_KEY/SMS_USERNAME are set; the
// console provider otherwise, so a misconfigured or partially-configured
// environment fails safe rather than throwing on every notification. This is
// independent of NEXT_PUBLIC_ENABLE_SMS, which gates whether notify() calls
// this module at all.
export function getSmsProvider(): SmsProvider {
  if (!instance) {
    instance =
      process.env.SMS_PROVIDER === "africastalking" && process.env.SMS_API_KEY && process.env.SMS_USERNAME
        ? new AfricasTalkingSmsProvider()
        : new ConsoleSmsProvider();
  }
  return instance;
}

// Test-only: forces the next getSmsProvider() call to reconstruct the
// provider instead of reusing the module-level singleton.
export function _resetSmsProviderForTests(): void {
  instance = null;
}
