"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Status = "verifying" | "success" | "error";

function VerifyEmailInner() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setMessage("This verification link is missing its token.");
      return;
    }
    api
      .post("/api/v1/auth/verify-email/confirm", { token })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      });
  }, [token]);

  if (status === "verifying") {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verifying your email…</h1>
        <p className="mt-1.5 text-sm text-muted">This will just take a moment.</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div>
        <Alert tone="success" title="Email verified">
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 className="size-4" /> Your email address is confirmed.
          </div>
        </Alert>
        <Link href="/dashboard" className="mt-6 inline-flex">
          <Button>Continue to Hafya</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Alert tone="danger" title="Couldn't verify your email">{message}</Alert>
      <p className="mt-6 text-sm text-muted">
        <Link href="/signin" className="font-medium text-primary hover:underline">Sign in</Link> and you&apos;ll be able to
        request a new verification link from anywhere in the app.
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
