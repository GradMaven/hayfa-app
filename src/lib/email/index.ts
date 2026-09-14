import nodemailer, { type Transporter } from "nodemailer";

// EmailProvider abstraction — same shape as StorageProvider/AIProvider/
// OCRProvider (see docs/system-architecture.md): a real implementation
// swapped in behind an interface, selected by env var, never a framework
// rewrite. EMAIL_PROVIDER=console (default) logs to stdout for local dev
// with zero setup; EMAIL_PROVIDER=smtp sends real email over SMTP, which
// works against literally any provider that speaks SMTP — Amazon SES,
// SendGrid, Postmark, Mailgun, Gmail, or a local catcher like Mailpit
// (see docker-compose.yml) — by changing env vars only, never this code.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.info(`[email:console] to=${message.to} subject="${message.subject}"\n${message.text}\n`);
  }
}

class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (!host) {
      throw new Error("SMTP_HOST must be set when EMAIL_PROVIDER=smtp. See ENVIRONMENT.md.");
    }
    const port = Number(process.env.SMTP_PORT ?? "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    this.from = process.env.EMAIL_FROM || "Hafya <no-reply@hafya.health>";
    this.transporter = nodemailer.createTransport({
      host,
      port,
      // Implicit TLS (port 465) vs STARTTLS (587/others) — SMTP_SECURE lets
      // an operator override the port-based default for a nonstandard vendor.
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!instance) {
    instance = process.env.EMAIL_PROVIDER === "smtp" ? new SmtpEmailProvider() : new ConsoleEmailProvider();
  }
  return instance;
}

// Test-only: forces the next getEmailProvider() call to reconstruct the
// provider instead of reusing the module-level singleton — needed because
// tests flip EMAIL_PROVIDER/SMTP_* between cases.
export function _resetEmailProviderForTests(): void {
  instance = null;
}
