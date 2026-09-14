// Plain, calm, on-brand email templates — same "clinically credible, not a
// generic SaaS blast" direction as the rest of the product (§9). Inline
// styles throughout: email clients strip <style> blocks unpredictably, so
// nothing here relies on external CSS or the app's design tokens.

const BRAND_COLOR = "#0f6e5d";
const TEXT_COLOR = "#1c1f1e";
const MUTED_COLOR = "#6b7270";
const BORDER_COLOR = "#e5e1da";

function baseLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid ${BORDER_COLOR};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="font-size:18px;font-weight:600;color:${TEXT_COLOR};">Hafya</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px 32px;color:${TEXT_COLOR};font-size:14px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="max-width:480px;margin:20px 0 0 0;color:${MUTED_COLOR};font-size:12px;line-height:1.5;">
            Hafya — your health record, brought together and under your control.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:8px;background:${BRAND_COLOR};">
    <a href="${url}" style="display:inline-block;padding:11px 20px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>
  </td></tr></table>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function passwordResetEmail(params: { name: string; resetUrl: string }): RenderedEmail {
  const subject = "Reset your Hafya password";

  const html = baseLayout(`
    <p style="margin:0 0 12px 0;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin:0 0 12px 0;">We received a request to reset your Hafya password. This link expires in <strong>1 hour</strong>.</p>
    ${button(params.resetUrl, "Reset password")}
    <p style="margin:16px 0 0 0;color:${MUTED_COLOR};font-size:12px;">
      If the button doesn't work, copy and paste this link:<br>
      <a href="${params.resetUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${params.resetUrl}</a>
    </p>
    <p style="margin:20px 0 0 0;color:${MUTED_COLOR};font-size:13px;">
      If you didn't request this, you can safely ignore this email — your password won't be changed.
    </p>
  `);

  const text =
    `Hi ${params.name},\n\n` +
    `We received a request to reset your Hafya password. This link expires in 1 hour:\n\n` +
    `${params.resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't be changed.\n\n` +
    `— Hafya`;

  return { subject, html, text };
}

export function verifyEmailAddressEmail(params: { name: string; verifyUrl: string }): RenderedEmail {
  const subject = "Verify your Hafya email address";

  const html = baseLayout(`
    <p style="margin:0 0 12px 0;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin:0 0 12px 0;">Confirm this is your email address to finish setting up your Hafya account. This link expires in <strong>24 hours</strong>.</p>
    ${button(params.verifyUrl, "Verify email address")}
    <p style="margin:16px 0 0 0;color:${MUTED_COLOR};font-size:12px;">
      If the button doesn't work, copy and paste this link:<br>
      <a href="${params.verifyUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${params.verifyUrl}</a>
    </p>
    <p style="margin:20px 0 0 0;color:${MUTED_COLOR};font-size:13px;">
      If you didn't create a Hafya account, you can safely ignore this email.
    </p>
  `);

  const text =
    `Hi ${params.name},\n\n` +
    `Confirm this is your email address to finish setting up your Hafya account. This link expires in 24 hours:\n\n` +
    `${params.verifyUrl}\n\n` +
    `If you didn't create a Hafya account, you can safely ignore this email.\n\n` +
    `— Hafya`;

  return { subject, html, text };
}

export function passwordChangedEmail(params: { name: string }): RenderedEmail {
  const subject = "Your Hafya password was changed";

  const html = baseLayout(`
    <p style="margin:0 0 12px 0;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin:0 0 12px 0;">Your Hafya password was just changed. If this was you, no action is needed — every other device has been signed out as a precaution.</p>
    <p style="margin:16px 0 0 0;color:${MUTED_COLOR};font-size:13px;">
      If you didn't make this change, contact support immediately — your account may be compromised.
    </p>
  `);

  const text =
    `Hi ${params.name},\n\n` +
    `Your Hafya password was just changed. If this was you, no action is needed — every other device has been signed out as a precaution.\n\n` +
    `If you didn't make this change, contact support immediately — your account may be compromised.\n\n` +
    `— Hafya`;

  return { subject, html, text };
}

// Generic wrapper for in-app notification -> email delivery (see
// lib/notifications). Deliberately terse — §39 "never put full clinical
// detail in the notification body itself," so this never carries more than
// the notification's own short title/body, same as the in-app copy.
export function notificationEmail(params: { name: string; title: string; body: string }): RenderedEmail {
  const html = baseLayout(`
    <p style="margin:0 0 12px 0;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin:0 0 4px 0;font-weight:600;">${escapeHtml(params.title)}</p>
    <p style="margin:0;color:${MUTED_COLOR};">${escapeHtml(params.body)}</p>
    <p style="margin:20px 0 0 0;color:${MUTED_COLOR};font-size:13px;">Open Hafya to see more detail and manage your notification preferences.</p>
  `);

  const text = `Hi ${params.name},\n\n${params.title}\n${params.body}\n\nOpen Hafya to see more detail.\n\n— Hafya`;

  return { subject: params.title, html, text };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
