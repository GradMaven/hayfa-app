import QRCode from "qrcode";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { generateTotpSecret, buildEnrollmentUri, encryptTotpSecret } from "@/lib/auth/mfa";

// Starts (or restarts) enrollment: generates a fresh secret and stores it
// encrypted immediately, but mfaEnabled stays false until /enroll/confirm
// proves the user actually has it in their authenticator app. An abandoned
// enrollment just leaves an unused, disabled secret — harmless.
export async function POST() {
  return withApiErrors(async () => {
    const user = await requireUser();

    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (dbUser.mfaEnabled) {
      throw new ApiException("CONFLICT", "Two-factor authentication is already enabled.");
    }

    const secret = generateTotpSecret();
    const accountLabel = dbUser.email ?? dbUser.id;
    const otpauthUri = buildEnrollmentUri(secret, accountLabel);

    await db.user.update({
      where: { id: user.id },
      data: { mfaSecret: encryptTotpSecret(secret) },
    });

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 });

    return apiSuccess({
      manualEntryKey: secret.base32,
      otpauthUri,
      qrCodeDataUrl,
    });
  });
}
