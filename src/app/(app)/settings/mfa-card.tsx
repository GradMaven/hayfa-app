"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, KeyRound, RefreshCw, Copy, Check } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface MfaStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}
interface EnrollStartResponse {
  manualEntryKey: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
}

type ViewState = "idle" | "enrolling" | "backup-codes" | "disabling" | "regenerating-codes";

export function MfaCard() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewState>("idle");
  const [enrollData, setEnrollData] = useState<EnrollStartResponse | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const statusQuery = useQuery({ queryKey: ["mfa-status"], queryFn: () => api.get<MfaStatus>("/api/v1/auth/mfa/status") });

  const startMutation = useMutation({
    mutationFn: () => api.post<EnrollStartResponse>("/api/v1/auth/mfa/enroll/start"),
    onSuccess: (data) => {
      setEnrollData(data);
      setView("enrolling");
    },
  });

  function refreshStatus() {
    queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
  }

  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-10 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Two-factor authentication</CardTitle>
        <CardDescription>
          Add a code from an authenticator app (Google Authenticator, Authy, 1Password, etc.) as a second step when
          signing in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {view === "idle" && (
          <IdleView
            enabled={statusQuery.data.enabled}
            backupCodesRemaining={statusQuery.data.backupCodesRemaining}
            onEnable={() => startMutation.mutate()}
            onDisable={() => setView("disabling")}
            onRegenerateCodes={() => setView("regenerating-codes")}
            enabling={startMutation.isPending}
            enableError={startMutation.error}
          />
        )}

        {view === "enrolling" && enrollData && (
          <EnrollView
            data={enrollData}
            onConfirmed={(codes) => {
              setBackupCodes(codes);
              setView("backup-codes");
              refreshStatus();
            }}
            onCancel={() => setView("idle")}
          />
        )}

        {view === "backup-codes" && backupCodes && (
          <BackupCodesView
            codes={backupCodes}
            title="Save your backup codes"
            description="Each code works once, if you lose access to your authenticator app. Store them somewhere safe — they won't be shown again."
            onDone={() => {
              setBackupCodes(null);
              setEnrollData(null);
              setView("idle");
            }}
          />
        )}

        {view === "disabling" && (
          <DisableView
            onDisabled={() => {
              setView("idle");
              refreshStatus();
            }}
            onCancel={() => setView("idle")}
          />
        )}

        {view === "regenerating-codes" && (
          <RegenerateCodesView
            onDone={(codes) => {
              setBackupCodes(codes);
              setView("backup-codes");
            }}
            onCancel={() => setView("idle")}
          />
        )}
      </CardContent>
    </Card>
  );
}

function IdleView({
  enabled,
  backupCodesRemaining,
  onEnable,
  onDisable,
  onRegenerateCodes,
  enabling,
  enableError,
}: {
  enabled: boolean;
  backupCodesRemaining: number;
  onEnable: () => void;
  onDisable: () => void;
  onRegenerateCodes: () => void;
  enabling: boolean;
  enableError: Error | null;
}) {
  if (!enabled) {
    return (
      <div className="space-y-3">
        {enableError && <Alert tone="danger">{enableError instanceof ApiClientError ? enableError.message : "Something went wrong."}</Alert>}
        <div className="flex items-center justify-between">
          <Badge tone="neutral">Not enabled</Badge>
          <Button size="sm" onClick={onEnable} loading={enabling}>Enable two-factor authentication</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge tone="success">Enabled</Badge>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRegenerateCodes}>
            <RefreshCw className="size-3.5" /> New backup codes
          </Button>
          <Button size="sm" variant="outline" onClick={onDisable}>Disable</Button>
        </div>
      </div>
      <p className="text-xs text-muted">
        {backupCodesRemaining} unused backup code{backupCodesRemaining === 1 ? "" : "s"} remaining.
      </p>
    </div>
  );
}

function EnrollView({
  data,
  onConfirmed,
  onCancel,
}: {
  data: EnrollStartResponse;
  onConfirmed: (backupCodes: string[]) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const confirmMutation = useMutation({
    mutationFn: () => api.post<{ enabled: boolean; backupCodes: string[] }>("/api/v1/auth/mfa/enroll/confirm", { code }),
    onSuccess: (res) => onConfirmed(res.backupCodes),
  });

  async function copyKey() {
    await navigator.clipboard.writeText(data.manualEntryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        confirmMutation.mutate();
      }}
      className="space-y-4"
    >
      {confirmMutation.error && (
        <Alert tone="danger">{confirmMutation.error instanceof ApiClientError ? confirmMutation.error.message : "Something went wrong."}</Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- a locally-generated data: URL, not a remote image next/image would optimize */}
        <img src={data.qrCodeDataUrl} alt="Scan this QR code with your authenticator app" width={160} height={160} className="rounded-[var(--radius-md)] border border-border shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            Scan this QR code with your authenticator app, or enter the key manually:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-[var(--radius-sm)] border border-border bg-surface-alt px-2 py-1.5 text-xs">
              {data.manualEntryKey}
            </code>
            <button type="button" onClick={copyKey} className="text-muted-2 hover:text-foreground shrink-0" aria-label="Copy key">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="mfa-code">Enter the 6-digit code from your app</Label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="max-w-40 tracking-widest text-center text-lg"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={confirmMutation.isPending} disabled={code.length !== 6}>Confirm and enable</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function BackupCodesView({
  codes,
  title,
  description,
  onDone,
}: {
  codes: string[];
  title: string;
  description: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert tone="warning" title={title}>{description}</Alert>
      <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-border bg-surface-alt p-4 font-mono text-sm">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <Button onClick={onDone}>
        <KeyRound className="size-4" /> I&apos;ve saved these codes
      </Button>
    </div>
  );
}

function DisableView({ onDisabled, onCancel }: { onDisabled: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const disableMutation = useMutation({
    mutationFn: () => api.post("/api/v1/auth/mfa/disable", { password, code }),
    onSuccess: onDisabled,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        disableMutation.mutate();
      }}
      className="space-y-4"
    >
      {disableMutation.error && (
        <Alert tone="danger">{disableMutation.error instanceof ApiClientError ? disableMutation.error.message : "Something went wrong."}</Alert>
      )}
      <p className="text-sm text-muted">Confirm your password and a current code to turn off two-factor authentication.</p>
      <div>
        <Label htmlFor="disable-password">Password</Label>
        <Input id="disable-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="disable-code">6-digit code or backup code</Label>
        <Input id="disable-code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-52" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" loading={disableMutation.isPending}>Disable two-factor authentication</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function RegenerateCodesView({ onDone, onCancel }: { onDone: (codes: string[]) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post<{ backupCodes: string[] }>("/api/v1/auth/mfa/backup-codes/regenerate", { code }),
    onSuccess: (res) => onDone(res.backupCodes),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      {mutation.error && <Alert tone="danger">{mutation.error instanceof ApiClientError ? mutation.error.message : "Something went wrong."}</Alert>}
      <FieldHint>This replaces all existing backup codes — old ones stop working immediately.</FieldHint>
      <div>
        <Label htmlFor="regen-code">Enter your current 6-digit code</Label>
        <Input
          id="regen-code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="max-w-40 tracking-widest text-center text-lg"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending} disabled={code.length !== 6}>Generate new codes</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
