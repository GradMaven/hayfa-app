"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Textarea, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";

interface ProviderRow {
  id: string;
  fullName: string;
  specialty: string | null;
  licenseNumber: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "UNVERIFIED";
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  registeredAt: string;
}

const STATUS_TABS = [
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
] as const;

const STATUS_TONE: Record<string, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

export function AdminProviderQueue() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["key"]>("PENDING");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-providers", status],
    queryFn: () => api.get<ProviderRow[]>(`/api/v1/admin/providers?status=${status}`),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
  }

  return (
    <div>
      <div role="tablist" aria-label="Provider status" className="flex gap-1 border-b border-border mb-6 mt-6 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={status === t.key}
            onClick={() => setStatus(t.key)}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              status === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={`No ${status.toLowerCase()} registrations`}
          description={status === "PENDING" ? "New provider registrations will appear here for review." : "Nothing here yet."}
        />
      ) : (
        <div className="space-y-3">
          {data.map((p) => (
            <ProviderCard key={p.id} provider={p} onDecided={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider, onDecided }: { provider: ProviderRow; onDecided: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/admin/providers/${provider.id}/verify`),
    onSuccess: onDecided,
  });
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/api/v1/admin/providers/${provider.id}/reject`, { reason }),
    onSuccess: onDecided,
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{provider.fullName}</p>
            <Badge tone={STATUS_TONE[provider.verificationStatus]}>{provider.verificationStatus.toLowerCase()}</Badge>
          </div>
          <p className="text-sm text-muted mt-0.5">
            {[provider.specialty, provider.organizationName].filter(Boolean).join(" · ") || "No specialty or organization given"}
          </p>
          <p className="text-xs text-muted-2 mt-1.5">License: {provider.licenseNumber ?? "not provided"}</p>
          <p className="text-xs text-muted-2 mt-0.5">
            {provider.email}
            {provider.phone ? ` · ${provider.phone}` : ""}
          </p>
          <p className="text-xs text-muted-2 mt-0.5">Registered {formatDateTime(provider.registeredAt)}</p>
        </div>
      </div>

      {(verifyMutation.isError || rejectMutation.isError) && (
        <Alert tone="danger" className="mt-3">
          {(verifyMutation.error ?? rejectMutation.error) instanceof ApiClientError
            ? ((verifyMutation.error ?? rejectMutation.error) as ApiClientError).message
            : "Something went wrong."}
        </Alert>
      )}

      {provider.verificationStatus === "PENDING" && (
        <div className="mt-3">
          {!rejecting ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => verifyMutation.mutate()} loading={verifyMutation.isPending}>
                <Check className="size-4" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
                <X className="size-4" /> Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`reject-reason-${provider.id}`}>Reason for rejection</Label>
              <Textarea
                id={`reject-reason-${provider.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="This is shared with the provider."
              />
              {touched && !reason.trim() && <FieldError>A reason is required.</FieldError>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={rejectMutation.isPending}
                  onClick={() => {
                    setTouched(true);
                    if (!reason.trim()) return;
                    rejectMutation.mutate(reason.trim());
                  }}
                >
                  Confirm rejection
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
