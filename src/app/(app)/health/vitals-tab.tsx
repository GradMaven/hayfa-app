"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, HeartPulse, X, Trash2 } from "lucide-react";
import type { z } from "zod";
import { vitalSchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

interface VitalRecord {
  id: string;
  type: string;
  value: number;
  secondaryValue: number | null;
  unit: string;
  recordedAt: string;
}

type FormValues = z.input<typeof vitalSchema>;

const VITAL_TYPES: { value: string; label: string; unit: string; needsSecondary?: boolean }[] = [
  { value: "BLOOD_PRESSURE", label: "Blood pressure", unit: "mmHg", needsSecondary: true },
  { value: "BLOOD_GLUCOSE", label: "Blood glucose", unit: "mg/dL" },
  { value: "WEIGHT", label: "Weight", unit: "kg" },
  { value: "HEART_RATE", label: "Heart rate", unit: "bpm" },
  { value: "TEMPERATURE", label: "Temperature", unit: "°C" },
  { value: "OXYGEN_SATURATION", label: "Oxygen saturation", unit: "%" },
  { value: "HEIGHT", label: "Height", unit: "cm" },
  { value: "BMI", label: "BMI", unit: "kg/m²" },
];

export function VitalsTab() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["vitals"],
    queryFn: () => api.get<VitalRecord[]>("/api/v1/vitals"),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/vitals", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vitals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/vitals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vitals"] }),
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Cancel" : "Record vital"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <VitalForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={HeartPulse} title="No vitals recorded" description="Blood pressure, glucose, weight, and other measurements will appear here." />
      ) : (
        <div className="space-y-2">
          {data.map((v) => {
            const meta = VITAL_TYPES.find((t) => t.value === v.type);
            return (
              <Card key={v.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {meta?.label ?? v.type}: {v.value}{v.secondaryValue ? `/${v.secondaryValue}` : ""} {v.unit}
                  </p>
                  <p className="text-xs text-muted-2 mt-0.5">{formatDateTime(v.recordedAt)}</p>
                </div>
                <button onClick={() => deleteMutation.mutate(v.id)} className="text-muted-2 hover:text-danger" aria-label="Remove entry">
                  <Trash2 className="size-4" />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VitalForm({ onSubmit, pending, error }: { onSubmit: (values: FormValues) => void; pending: boolean; error: Error | null }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(vitalSchema), defaultValues: { type: "BLOOD_PRESSURE", unit: "mmHg" } });

  const type = watch("type");
  const meta = VITAL_TYPES.find((t) => t.value === type);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      onChange={() => {
        if (meta) setValue("unit", meta.unit);
      }}
    >
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div>
        <Label htmlFor="type">Measurement</Label>
        <Select id="type" {...register("type")}>
          {VITAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </div>
      <div className={`grid gap-4 ${meta?.needsSecondary ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div>
          <Label htmlFor="value">{meta?.needsSecondary ? "Systolic" : "Value"}</Label>
          <Input id="value" type="number" step="any" {...register("value")} />
          <FieldError>{errors.value?.message}</FieldError>
        </div>
        {meta?.needsSecondary && (
          <div>
            <Label htmlFor="secondaryValue">Diastolic</Label>
            <Input id="secondaryValue" type="number" step="any" {...register("secondaryValue")} />
          </div>
        )}
        <div>
          <Label htmlFor="recordedAt">When</Label>
          <Input id="recordedAt" type="datetime-local" {...register("recordedAt")} />
          <FieldError>{errors.recordedAt?.message}</FieldError>
        </div>
      </div>
      <input type="hidden" {...register("unit")} />
      <Button type="submit" loading={pending}>Save</Button>
    </form>
  );
}
