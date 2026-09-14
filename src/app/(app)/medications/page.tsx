"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pill, Trash2, X } from "lucide-react";
import type { z } from "zod";
import { medicationSchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface MedicationRecord {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  startDate: string | null;
  endDate: string | null;
  purpose: string | null;
  status: "ACTIVE" | "COMPLETED" | "DISCONTINUED" | "PAUSED";
  source: string;
  prescriber: { fullName: string } | null;
  relatedCondition: { name: string } | null;
}

type FormValues = z.input<typeof medicationSchema>;

const STATUS_TONE: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "neutral",
  DISCONTINUED: "danger",
};

export default function MedicationsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["medications"],
    queryFn: () => api.get<MedicationRecord[]>("/api/v1/medications"),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/medications", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/medications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const active = data?.filter((m) => m.status === "ACTIVE") ?? [];
  const inactive = data?.filter((m) => m.status !== "ACTIVE") ?? [];

  return (
    <div>
      <PageHeader
        title="Medications"
        description="Everything you're taking, and everything you've taken."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Cancel" : "Add medication"}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <MedicationForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No medications yet"
          description="Your medication history will appear here once you add or import a medication."
          action={<Button variant="outline" onClick={() => setShowForm(true)}>Add medication</Button>}
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <MedicationGroup title="Active" records={active} onDelete={(id) => deleteMutation.mutate(id)} />
          )}
          {inactive.length > 0 && (
            <MedicationGroup title="Past" records={inactive} onDelete={(id) => deleteMutation.mutate(id)} />
          )}
        </div>
      )}
    </div>
  );
}

function MedicationGroup({ title, records, onDelete }: { title: string; records: MedicationRecord[]; onDelete: (id: string) => void }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-2 mb-2">{title}</h2>
      <div className="space-y-3">
        {records.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{m.name}{m.dose ? ` ${m.dose}` : ""}</p>
                  <Badge tone={STATUS_TONE[m.status]}>{m.status.toLowerCase()}</Badge>
                  {m.source === "PATIENT_ENTERED" && <Badge tone="neutral">Patient entered</Badge>}
                  {m.source === "PROVIDER_ENTERED" && <Badge tone="info">Provider entered</Badge>}
                </div>
                <p className="text-sm text-muted mt-1">
                  {[m.frequency, m.route].filter(Boolean).join(" · ") || "No frequency recorded"}
                </p>
                {m.purpose && <p className="text-sm text-muted mt-0.5">For: {m.purpose}</p>}
                <p className="text-xs text-muted-2 mt-1.5">
                  {m.startDate ? `Started ${formatDate(m.startDate)}` : ""}
                  {m.endDate ? ` · Ended ${formatDate(m.endDate)}` : ""}
                  {m.prescriber ? ` · ${m.prescriber.fullName}` : ""}
                </p>
              </div>
              <button
                onClick={() => onDelete(m.id)}
                className="text-muted-2 hover:text-danger shrink-0"
                aria-label={`Remove ${m.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MedicationForm({
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
  } = useForm<FormValues>({ resolver: zodResolver(medicationSchema), defaultValues: { status: "ACTIVE" } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Medication name</Label>
          <Input id="name" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="dose">Dose</Label>
          <Input id="dose" placeholder="e.g. 5mg" {...register("dose")} />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="frequency">Frequency</Label>
          <Input id="frequency" placeholder="e.g. Once daily" {...register("frequency")} />
        </div>
        <div>
          <Label htmlFor="route">Route</Label>
          <Input id="route" placeholder="e.g. Oral" {...register("route")} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="DISCONTINUED">Discontinued</option>
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" type="date" {...register("startDate")} />
        </div>
        <div>
          <Label htmlFor="purpose">Purpose</Label>
          <Input id="purpose" placeholder="What is this for?" {...register("purpose")} />
        </div>
      </div>
      <Button type="submit" loading={pending}>Save medication</Button>
    </form>
  );
}
