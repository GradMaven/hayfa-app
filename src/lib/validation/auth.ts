import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
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
