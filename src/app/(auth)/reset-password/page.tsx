"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type FormValues = { token: string; newPassword: string };

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token } });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await api.post("/api/v1/auth/reset-password", values);
      router.push("/signin");
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  if (!token) {
    return <Alert tone="danger">This reset link is missing its token. Request a new one from the sign-in page.</Alert>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      {serverError && <Alert tone="danger" className="mt-5">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <input type="hidden" {...register("token")} />
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
          <FieldError>{errors.newPassword?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Reset password</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/signin" className="font-medium text-primary hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
