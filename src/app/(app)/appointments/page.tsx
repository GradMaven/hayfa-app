"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarDays, X, Trash2 } from "lucide-react";
import type { z } from "zod";
import { appointmentSchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

interface AppointmentRecord {
  id: string;
  reason: string | null;
  location: string | null;
  scheduledAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  provider: { fullName: string; specialty: string | null } | null;
}

type FormValues = z.input<typeof appointmentSchema>;

export default function AppointmentsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["appointments"], queryFn: () => api.get<AppointmentRecord[]>("/api/v1/appointments") });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/appointments", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/appointments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcoming = (data ?? []).filter((a) => new Date(a.scheduledAt).getTime() >= now && a.status === "SCHEDULED");
    const past = (data ?? []).filter((a) => !(new Date(a.scheduledAt).getTime() >= now && a.status === "SCHEDULED"));
    return { upcoming, past };
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Upcoming and past visits."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Cancel" : "Add appointment"}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <AppointmentForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No appointments yet" description="Scheduled and past visits will appear here." action={<Button variant="outline" onClick={() => setShowForm(true)}>Add appointment</Button>} />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && <AppointmentGroup title="Upcoming" records={upcoming} onDelete={(id) => deleteMutation.mutate(id)} />}
          {past.length > 0 && <AppointmentGroup title="Past" records={past} onDelete={(id) => deleteMutation.mutate(id)} />}
        </div>
      )}
    </div>
  );
}

function AppointmentGroup({ title, records, onDelete }: { title: string; records: AppointmentRecord[]; onDelete: (id: string) => void }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-2 mb-2">{title}</h2>
      <div className="space-y-3">
        {records.map((a) => (
          <Card key={a.id} className="p-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{a.reason ?? "Visit"}</p>
                <Badge tone={a.status === "SCHEDULED" ? "primary" : a.status === "COMPLETED" ? "success" : "neutral"}>
                  {a.status.toLowerCase().replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-1">{formatDateTime(a.scheduledAt)}</p>
              {(a.provider || a.location) && (
                <p className="text-xs text-muted-2 mt-1">{[a.provider?.fullName, a.location].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <button onClick={() => onDelete(a.id)} className="text-muted-2 hover:text-danger shrink-0" aria-label="Remove appointment">
              <Trash2 className="size-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AppointmentForm({ onSubmit, pending, error }: { onSubmit: (values: FormValues) => void; pending: boolean; error: Error | null }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(appointmentSchema), defaultValues: { status: "SCHEDULED" } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Input id="reason" placeholder="e.g. Hypertension follow-up" {...register("reason")} />
        </div>
        <div>
          <Label htmlFor="scheduledAt">Date & time</Label>
          <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
          <FieldError>{errors.scheduledAt?.message}</FieldError>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="providerName">Provider / clinic</Label>
          <Input id="providerName" {...register("providerName")} />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...register("location")} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register("notes")} />
      </div>
      <Button type="submit" loading={pending}>Save appointment</Button>
    </form>
  );
}
