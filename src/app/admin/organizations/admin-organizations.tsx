"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, ShieldCheck } from "lucide-react";
import type { z } from "zod";
import { organizationSchema, ORGANIZATION_TYPES } from "@/lib/validation/organization";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface OrganizationRow {
  id: string;
  name: string;
  type: string;
  county: string | null;
  verified: boolean;
  providerCount: number;
  createdAt: string;
}

type FormValues = z.input<typeof organizationSchema>;

export function AdminOrganizations() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: () => api.get<OrganizationRow[]>("/api/v1/admin/organizations"),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/admin/organizations", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      setShowForm(false);
    },
  });

  const toggleVerified = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      api.patch(`/api/v1/admin/organizations/${id}`, { verified }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-organizations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/organizations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-organizations"] }),
  });

  return (
    <div>
      <div className="flex justify-end mt-6 mb-4">
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Cancel" : "Add organization"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <OrganizationForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No organizations yet" description="Add one so providers can affiliate with it at registration." />
      ) : (
        <div className="space-y-3">
          {data.map((org) => (
            <Card key={org.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{org.name}</p>
                    <Badge tone={org.verified ? "success" : "warning"}>{org.verified ? "verified" : "unverified"}</Badge>
                  </div>
                  <p className="text-sm text-muted mt-0.5">
                    {[org.type.replace(/_/g, " ").toLowerCase(), org.county].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-2 mt-1.5">
                    {org.providerCount} provider{org.providerCount === 1 ? "" : "s"} · Added {formatDate(org.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={toggleVerified.isPending}
                    onClick={() => toggleVerified.mutate({ id: org.id, verified: !org.verified })}
                  >
                    {org.verified ? "Unverify" : "Verify"}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`Delete ${org.name}`}
                    onClick={() => deleteMutation.mutate(org.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OrganizationForm({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (values: FormValues) => void;
  pending: boolean;
  error: Error | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(organizationSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="org-name">Name</Label>
          <Input id="org-name" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="org-type">Type</Label>
          <Select id="org-type" {...register("type")}>
            {ORGANIZATION_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="org-county">County (optional)</Label>
        <Input id="org-county" {...register("county")} />
      </div>
      <Button type="submit" size="sm" loading={pending}>Add organization</Button>
    </form>
  );
}
