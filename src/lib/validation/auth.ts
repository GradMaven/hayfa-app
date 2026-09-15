import { z } from "zod";

// International format only (e.g. +254712345678) — this is what a real SMS
// gateway (Africa's Talking) requires for the `to` field. See lib/sms.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in international format, e.g. +254712345678.");

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: phoneSchema.optional().or(z.literal("")),
  password: z.string().min(10, "Password must be at least 10 characters."),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Enter your password."),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(10, "Password must be at least 10 characters."),
});

export const verifyEmailConfirmSchema = z.object({
  token: z.string().min(1),
});
