"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, ShieldOff, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  createdAt: string;
}

const ROLE_OPTIONS = [
  "PATIENT",
  "CAREGIVER",
  "PROVIDER",
  "PROVIDER_ADMIN",
  "ORG_ADMIN",
  "INTEGRATION_ADMIN",
  "PLATFORM_SUPPORT",
  "SUPER_ADMIN",
];

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  DEACTIVATED: "danger",
};

export function AdminUsers({ currentUserId }: { currentUserId: string }) {
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", role, status, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      return api.get<UserRow[]>(`/api/v1/admin/users?${params.toString()}`);
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-3 mt-6 mb-4">
        <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, " ").toLowerCase()}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </Select>
      </div>

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Users} title="No accounts match" description="Try a different search or filter." />
      ) : (
        <div className="space-y-3">
          {data.map((u) => (
            <UserRowCard key={u.id} user={u} isSelf={u.id === currentUserId} onChanged={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRowCard({ user, isSelf, onChanged }: { user: UserRow; isSelf: boolean; onChanged: () => void }) {
  const [changing, setChanging] = useState<"SUSPENDED" | "DEACTIVATED" | null>(null);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { status: string; reason?: string }) => api.patch(`/api/v1/admin/users/${user.id}/status`, input),
    onSuccess: () => {
      setChanging(null);
      setReason("");
      onChanged();
    },
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{user.name}</p>
            <Badge tone={STATUS_TONE[user.status]}>{user.status.toLowerCase()}</Badge>
            <Badge tone="neutral">{user.role.replace(/_/g, " ").toLowerCase()}</Badge>
            {isSelf && <Badge tone="primary">you</Badge>}
          </div>
          <p className="text-sm text-muted mt-0.5">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ""}
          </p>
          <p className="text-xs text-muted-2 mt-1.5">
            {user.emailVerifiedAt ? "Email verified" : "Email unverified"}
            {user.mfaEnabled ? " · MFA on" : ""} · Joined {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      {mutation.isError && (
        <Alert tone="danger" className="mt-3">
          {mutation.error instanceof ApiClientError ? mutation.error.message : "Something went wrong."}
        </Alert>
      )}

      {!isSelf && (
        <div className="mt-3">
          {!changing ? (
            <div className="flex gap-2">
              {user.status !== "ACTIVE" ? (
                <Button size="sm" onClick={() => mutation.mutate({ status: "ACTIVE" })} loading={mutation.isPending}>
                  <ShieldCheck className="size-4" /> Reactivate
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setChanging("SUSPENDED")}>
                    <ShieldOff className="size-4" /> Suspend
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setChanging("DEACTIVATED")}>
                    <ShieldOff className="size-4" /> Deactivate
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`status-reason-${user.id}`}>
                Reason {changing === "SUSPENDED" ? "for suspension" : "for deactivation"} (optional)
              </Label>
              <Textarea
                id={`status-reason-${user.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Shared with the account holder if provided."
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ status: changing, reason: reason.trim() || undefined })}
                >
                  Confirm {changing === "SUSPENDED" ? "suspension" : "deactivation"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setChanging(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {isSelf && <p className="mt-3 text-xs text-muted-2">You can&apos;t change your own account status.</p>}
    </Card>
  );
}
