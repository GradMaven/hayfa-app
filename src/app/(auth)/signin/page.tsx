"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";
import { mfaVerifySchema } from "@/lib/validation/mfa";
import type { z } from "zod";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type MfaFormValues = z.infer<typeof mfaVerifySchema>;

export default function SignInPage() {
  const [awaitingMfa, setAwaitingMfa] = useState(false);

  if (awaitingMfa) {
    return <MfaChallengeStep onBack={() => setAwaitingMfa(false)} />;
  }

  return <PasswordStep onMfaRequired={() => setAwaitingMfa(true)} />;
}

function PasswordStep({ onMfaRequired }: { onMfaRequired: () => void }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInInput) {
    setServerError(null);
    try {
      const result = await api.post<{ mfaRequired: boolean }>("/api/v1/auth/signin", values);
      if (result.mfaRequired) {
        onMfaRequired();
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">Sign in to your Hafya account.</p>

      {serverError && <Alert tone="danger" className="mt-5">{serverError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline mb-1.5">Forgot password?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">Create one</Link>
      </p>

      <div className="mt-8 rounded-[var(--radius-md)] border border-border bg-surface-alt p-4 text-xs text-muted">
        <p className="font-medium text-foreground mb-1">Demo accounts (synthetic data)</p>
        <p>Patient: amina.demo@hafya.demo</p>
        <p>Provider: dr.mwangi.demo@hafya.demo</p>
        <p>Password: DemoPass123!</p>
      </div>
    </div>
  );
}

// No email/password is asked for again here — the server already knows
// which user this is from the MFA-challenge cookie set by /signin. This
// component only ever collects the second factor.
function MfaChallengeStep({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaFormValues>({ resolver: zodResolver(mfaVerifySchema) });

  async function onSubmit(values: MfaFormValues) {
    setServerError(null);
    try {
      await api.post("/api/v1/auth/mfa/verify", values);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
      <p className="mt-1.5 text-sm text-muted">
        {useBackupCode
          ? "Enter one of your backup codes."
          : "Enter the 6-digit code from your authenticator app."}
      </p>

      {serverError && <Alert tone="danger" className="mt-5">{serverError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="code">{useBackupCode ? "Backup code" : "6-digit code"}</Label>
          <Input
            id="code"
            autoComplete="one-time-code"
            inputMode={useBackupCode ? "text" : "numeric"}
            className={useBackupCode ? undefined : "max-w-40 tracking-widest text-center text-lg"}
            {...register("code")}
          />
          <FieldError>{errors.code?.message}</FieldError>
          <FieldHint>This code expires a few minutes after your password was accepted.</FieldHint>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Verify and sign in</Button>
      </form>

      <div className="mt-4 flex justify-between text-sm">
        <button onClick={onBack} className="text-muted hover:text-foreground">← Back</button>
        <button onClick={() => setUseBackupCode((v) => !v)} className="text-primary hover:underline">
          {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
        </button>
      </div>
    </div>
  );
}
