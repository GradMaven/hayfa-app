"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Share2, X, Ban, UserPlus } from "lucide-react";
import type { z } from "zod";
import { createConsentSchema, caregiverInviteSchema } from "@/lib/validation/consent";
import { DATA_SCOPES, type DataScope } from "@/lib/consent";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate, cn } from "@/lib/utils";

interface ConsentRecord {
  id: string;
  recipientLabel: string;
  recipientType: string;
  purpose: string;
  dataScopes: string[];
  duration: string;
  grantedAt: string;
  expiresAt: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

interface CaregiverLinkRecord {
  id: string;
  relationship: string | null;
  permissions: string[];
  status: "ACTIVE" | "REVOKED";
  caregiverUser: { name: string; email: string | null };
}

const SCOPE_LABELS: Record<DataScope, string> = {
  MEDICATIONS: "Medications",
  ALLERGIES: "Allergies",
  APPOINTMENTS: "Appointments",
  LAB_RESULTS: "Lab results",
  CONDITIONS: "Conditions",
  DOCUMENTS: "Documents",
  VITALS: "Vitals",
  IMMUNIZATIONS: "Immunizations",
  CARE_PLANS: "Care plans",
  MENTAL_HEALTH: "Mental health records",
  INSURANCE: "Insurance information",
};

const DURATION_LABELS: Record<string, string> = {
  ONE_TIME: "One-time",
  HOURS_24: "24 hours",
  DAYS_7: "7 days",
  DAYS_30: "30 days",
  UNTIL_REVOKED: "Until revoked",
};

export default function SharingPage() {
  const [tab, setTab] = useState<"access" | "caregivers">("access");
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [showCaregiverForm, setShowCaregiverForm] = useState(false);
  const queryClient = useQueryClient();

  const consentsQuery = useQuery({ queryKey: ["consents"], queryFn: () => api.get<ConsentRecord[]>("/api/v1/consents") });
  const caregiversQuery = useQuery({ queryKey: ["caregivers"], queryFn: () => api.get<CaregiverLinkRecord[]>("/api/v1/caregivers") });

  const revokeConsent = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/consents/${id}/revoke`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["consents"] }),
  });

  const removeCaregiver = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/caregivers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["caregivers"] }),
  });

  return (
    <div>
      <PageHeader title="Sharing" description="Decide exactly who can see your health information, and for how long." />

      <div role="tablist" className="flex gap-1 border-b border-border mb-6">
        {(["access", "caregivers"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2.5 text-sm font-medium border-b-2 -mb-px",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {t === "access" ? "Provider access" : "Caregivers"}
          </button>
        ))}
      </div>

      {tab === "access" && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowConsentForm((s) => !s)}>
              {showConsentForm ? <X className="size-4" /> : <Plus className="size-4" />}
              {showConsentForm ? "Cancel" : "Grant access"}
            </Button>
          </div>

          {showConsentForm && (
            <Card className="mb-6">
              <CardContent>
                <ConsentForm
                  onDone={() => {
                    setShowConsentForm(false);
                    queryClient.invalidateQueries({ queryKey: ["consents"] });
                  }}
                />
              </CardContent>
            </Card>
          )}

          {consentsQuery.isLoading ? (
            <SkeletonList rows={3} />
          ) : !consentsQuery.data || consentsQuery.data.length === 0 ? (
            <EmptyState icon={Share2} title="No access granted" description="When you share your record with a doctor, you'll see and manage it here." />
          ) : (
            <div className="space-y-3">
              {consentsQuery.data.map((c) => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{c.recipientLabel}</p>
                        <Badge tone={c.status === "ACTIVE" ? "success" : c.status === "EXPIRED" ? "neutral" : "danger"}>
                          {c.status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted mt-1">{c.purpose}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {c.dataScopes.map((s) => (
                          <Badge key={s} tone="primary">{SCOPE_LABELS[s as DataScope] ?? s}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-2 mt-2">
                        Granted {formatDate(c.grantedAt)} · {DURATION_LABELS[c.duration]}
                        {c.expiresAt ? ` · expires ${formatDate(c.expiresAt)}` : ""}
                      </p>
                    </div>
                    {c.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" onClick={() => revokeConsent.mutate(c.id)} loading={revokeConsent.isPending}>
                        <Ban className="size-4" /> Remove access
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "caregivers" && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowCaregiverForm((s) => !s)}>
              {showCaregiverForm ? <X className="size-4" /> : <UserPlus className="size-4" />}
              {showCaregiverForm ? "Cancel" : "Add caregiver"}
            </Button>
          </div>

          {showCaregiverForm && (
            <Card className="mb-6">
              <CardContent>
                <CaregiverForm
                  onDone={() => {
                    setShowCaregiverForm(false);
                    queryClient.invalidateQueries({ queryKey: ["caregivers"] });
                  }}
                />
              </CardContent>
            </Card>
          )}

          {caregiversQuery.isLoading ? (
            <SkeletonList rows={2} />
          ) : !caregiversQuery.data || caregiversQuery.data.length === 0 ? (
            <EmptyState icon={UserPlus} title="No caregivers added" description="A spouse, parent, or caregiver can be given limited access — you choose exactly what they see." />
          ) : (
            <div className="space-y-3">
              {caregiversQuery.data.map((c) => (
                <Card key={c.id} className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{c.caregiverUser.name}</p>
                      {c.relationship && <Badge tone="neutral">{c.relationship}</Badge>}
                      <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status.toLowerCase()}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {c.permissions.map((p) => (
                        <Badge key={p} tone="primary">{SCOPE_LABELS[p as DataScope] ?? p}</Badge>
                      ))}
                    </div>
                  </div>
                  {c.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" onClick={() => removeCaregiver.mutate(c.id)} loading={removeCaregiver.isPending}>
                      <Ban className="size-4" /> Remove
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ConsentFormValues = z.infer<typeof createConsentSchema>;

function ConsentForm({ onDone }: { onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsentFormValues>({
    resolver: zodResolver(createConsentSchema),
    defaultValues: { recipientType: "PROVIDER", duration: "DAYS_30", dataScopes: [] },
  });

  const mutation = useMutation({
    mutationFn: (values: ConsentFormValues) => api.post("/api/v1/consents", values),
    onSuccess: onDone,
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
      {mutation.error && <Alert tone="danger">{mutation.error instanceof ApiClientError ? mutation.error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="recipientEmail">Recipient&apos;s email</Label>
          <Input id="recipientEmail" type="email" placeholder="doctor@example.com" {...register("recipientEmail")} />
          <FieldError>{errors.recipientEmail?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="recipientType">Recipient type</Label>
          <Select id="recipientType" {...register("recipientType")}>
            <option value="PROVIDER">Healthcare provider</option>
            <option value="ORGANIZATION">Organization</option>
            <option value="CAREGIVER">Caregiver</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="purpose">Purpose</Label>
        <Textarea id="purpose" placeholder="e.g. Diabetes consultation" {...register("purpose")} />
        <FieldError>{errors.purpose?.message}</FieldError>
      </div>
      <fieldset>
        <legend className="text-sm font-medium mb-2">What can they access?</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DATA_SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={scope} {...register("dataScopes")} className="rounded border-border" />
              {SCOPE_LABELS[scope]}
            </label>
          ))}
        </div>
        <FieldError>{errors.dataScopes?.message}</FieldError>
      </fieldset>
      <div>
        <Label htmlFor="duration">Duration</Label>
        <Select id="duration" {...register("duration")}>
          <option value="ONE_TIME">One-time</option>
          <option value="HOURS_24">24 hours</option>
          <option value="DAYS_7">7 days</option>
          <option value="DAYS_30">30 days</option>
          <option value="UNTIL_REVOKED">Until revoked</option>
        </Select>
      </div>
      <Button type="submit" loading={mutation.isPending}>Grant access</Button>
    </form>
  );
}

type CaregiverFormValues = z.infer<typeof caregiverInviteSchema>;

function CaregiverForm({ onDone }: { onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CaregiverFormValues>({ resolver: zodResolver(caregiverInviteSchema), defaultValues: { permissions: [] } });

  const mutation = useMutation({
    mutationFn: (values: CaregiverFormValues) => api.post("/api/v1/caregivers", values),
    onSuccess: onDone,
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
      {mutation.error && <Alert tone="danger">{mutation.error instanceof ApiClientError ? mutation.error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="caregiverEmail">Caregiver&apos;s email</Label>
          <Input id="caregiverEmail" type="email" {...register("caregiverEmail")} />
          <FieldError>{errors.caregiverEmail?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="relationship">Relationship</Label>
          <Input id="relationship" placeholder="e.g. spouse" {...register("relationship")} />
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium mb-2">What can they access?</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DATA_SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={scope} {...register("permissions")} className="rounded border-border" />
              {SCOPE_LABELS[scope]}
            </label>
          ))}
        </div>
        <FieldError>{errors.permissions?.message}</FieldError>
      </fieldset>
      <Button type="submit" loading={mutation.isPending}>Add caregiver</Button>
    </form>
  );
}
