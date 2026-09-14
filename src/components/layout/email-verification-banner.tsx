"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MailWarning, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";

// Not persisted — dismissing hides it for this page view only, not forever.
// Verification isn't required to use the app, but it shouldn't be silenceable
// indefinitely either; the nudge comes back on the next navigation/reload.
export function EmailVerificationBanner({ email }: { email: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  const resendMutation = useMutation({
    mutationFn: () => api.post<{ sent: boolean; alreadyVerified: boolean }>("/api/v1/auth/verify-email/resend"),
    onSuccess: () => setSent(true),
  });

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-warning-tint px-4 py-2.5 text-sm text-warning mb-5">
      <MailWarning className="size-4 shrink-0" />
      <p className="flex-1 min-w-0">
        {sent ? (
          <>Verification email sent{email ? ` to ${email}` : ""} — check your inbox.</>
        ) : (
          <>Please verify your email address{email ? ` (${email})` : ""} to secure your account.</>
        )}
      </p>
      {!sent && (
        <button
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending}
          className="shrink-0 font-medium underline hover:no-underline disabled:opacity-50"
        >
          {resendMutation.isPending ? "Sending…" : "Resend email"}
        </button>
      )}
      {resendMutation.error && (
        <span className="shrink-0 text-danger text-xs">
          {resendMutation.error instanceof ApiClientError ? resendMutation.error.message : "Failed to send."}
        </span>
      )}
      <button onClick={() => setDismissed(true)} className="shrink-0 text-warning/70 hover:text-warning" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
