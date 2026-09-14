import { db } from "@/lib/db";
import { generateOpaqueToken, hashToken } from "./tokens";
import { getEmailProvider } from "@/lib/email";
import { verifyEmailAddressEmail } from "@/lib/email/templates";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — longer than
// the 1-hour password-reset window since verification is lower-stakes and a
// new signup may not check email right away.

// Shared by signup (send on account creation) and the resend endpoint — one
// place generates the token and sends the email so both paths can't drift.
export async function sendVerificationEmail(user: { id: string; name: string; email: string | null }): Promise<void> {
  if (!user.email) return;

  // Only the most recently requested link should work — otherwise a user
  // who clicks "resend" twice ends up with two simultaneously valid links,
  // which is confusing and unnecessary.
  await db.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const rawToken = generateOpaqueToken();
  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify-email?token=${rawToken}`;
  const { subject, html, text } = verifyEmailAddressEmail({ name: user.name, verifyUrl });

  try {
    await getEmailProvider().send({ to: user.email, subject, html, text });
  } catch (err) {
    // Never block signup or a resend request on email delivery — log and
    // move on, same as password-reset email failures.
    console.error("[email] failed to send verification email:", err instanceof Error ? err.message : err);
  }
}
