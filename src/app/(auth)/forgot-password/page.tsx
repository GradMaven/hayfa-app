"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { z } from "zod";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type FormValues = z.infer<typeof requestPasswordResetSchema>;

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(requestPasswordResetSchema) });

  async function onSubmit(values: FormValues) {
    await api.post("/api/v1/auth/request-password-reset", values);
    setDone(true);
  }

  if (done) {
    return (
      <Alert tone="success" title="Check your email">
        If an account exists for that address, we&apos;ve sent a link to reset your password. It expires in 1 hour.
      </Alert>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted">We&apos;ll email you a link to choose a new one.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/signin" className="font-medium text-primary hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
