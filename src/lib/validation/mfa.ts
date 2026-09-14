import { z } from "zod";

export const mfaVerifySchema = z.object({
  code: z.string().trim().min(6, "Enter the 6-digit code or a backup code.").max(11),
});

export const mfaEnrollConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export const mfaDisableSchema = z.object({
  password: z.string().min(1, "Enter your password."),
  code: z.string().trim().min(6, "Enter your current 6-digit code or a backup code.").max(11),
});

export const mfaRegenerateBackupCodesSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter your current 6-digit code."),
});
