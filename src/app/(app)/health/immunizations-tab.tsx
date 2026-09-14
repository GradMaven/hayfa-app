"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Syringe, X, Trash2 } from "lucide-react";
import type { z } from "zod";
import { immunizationSchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface ImmunizationRecord {
  id: string;
  vaccineName: string;
  doseNumber: number | null;
  administeredDate: string;
  providerName: string | null;
}

type FormValues = z.input<typeof immunizationSchema>;

export function ImmunizationsTab() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["immunizations"], queryFn: () => api.get<ImmunizationRecord[]>("/api/v1/immunizations") });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/immunizations", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["immunizations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/immunizations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["immunizations"] }),
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Cancel" : "Add immunization"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <ImmunizationForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Syringe} title="No immunizations recorded" description="Vaccination history will appear here." />
      ) : (
        <div className="space-y-2">
          {data.map((i) => (
            <Card key={i.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{i.vaccineName}{i.doseNumber ? ` — dose ${i.doseNumber}` : ""}</p>
                <p className="text-xs text-muted-2 mt-0.5">{formatDate(i.administeredDate)}{i.providerName ? ` · ${i.providerName}` : ""}</p>
              </div>
              <button onClick={() => deleteMutation.mutate(i.id)} className="text-muted-2 hover:text-danger" aria-label={`Remove ${i.vaccineName}`}>
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ImmunizationForm({ onSubmit, pending, error }: { onSubmit: (values: FormValues) => void; pending: boolean; error: Error | null }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(immunizationSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="vaccineName">Vaccine</Label>
          <Input id="vaccineName" {...register("vaccineName")} />
          <FieldError>{errors.vaccineName?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="administeredDate">Date given</Label>
          <Input id="administeredDate" type="date" {...register("administeredDate")} />
          <FieldError>{errors.administeredDate?.message}</FieldError>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="doseNumber">Dose number</Label>
          <Input id="doseNumber" type="number" min={1} {...register("doseNumber")} />
        </div>
        <div>
          <Label htmlFor="providerName">Provider</Label>
          <Input id="providerName" {...register("providerName")} />
        </div>
      </div>
      <Button type="submit" loading={pending}>Save immunization</Button>
    </form>
  );
}
