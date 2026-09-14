"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle, X, Trash2 } from "lucide-react";
import type { z } from "zod";
import { allergySchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";

interface AllergyRecord {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";
}

type FormValues = z.input<typeof allergySchema>;

const SEVERITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  SEVERE: "danger",
  MODERATE: "warning",
  MILD: "neutral",
  UNKNOWN: "neutral",
};

export function AllergiesTab() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["allergies"], queryFn: () => api.get<AllergyRecord[]>("/api/v1/allergies") });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/allergies", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allergies"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/allergies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allergies"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Cancel" : "Add allergy"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <AllergyForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No known allergies recorded" description="Recording allergies helps keep your emergency information accurate." />
      ) : (
        <div className="space-y-2">
          {data.map((a) => (
            <Card key={a.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.allergen}</p>
                  <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity.toLowerCase()}</Badge>
                </div>
                {a.reaction && <p className="text-sm text-muted mt-1">{a.reaction}</p>}
              </div>
              <button onClick={() => deleteMutation.mutate(a.id)} className="text-muted-2 hover:text-danger" aria-label={`Remove ${a.allergen}`}>
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AllergyForm({ onSubmit, pending, error }: { onSubmit: (values: FormValues) => void; pending: boolean; error: Error | null }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(allergySchema), defaultValues: { severity: "UNKNOWN" } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="allergen">Allergen</Label>
          <Input id="allergen" placeholder="e.g. Penicillin" {...register("allergen")} />
          <FieldError>{errors.allergen?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="severity">Severity</Label>
          <Select id="severity" {...register("severity")}>
            <option value="UNKNOWN">Not sure</option>
            <option value="MILD">Mild</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="reaction">Reaction</Label>
        <Input id="reaction" placeholder="e.g. Skin rash" {...register("reaction")} />
      </div>
      <Button type="submit" loading={pending}>Save allergy</Button>
    </form>
  );
}
