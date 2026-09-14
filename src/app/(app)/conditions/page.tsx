"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, HeartPulse, X } from "lucide-react";
import type { z } from "zod";
import { conditionSchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface ConditionRecord {
  id: string;
  name: string;
  category: string | null;
  status: "ACTIVE" | "MANAGED" | "RESOLVED";
  severity: "MILD" | "MODERATE" | "SEVERE" | null;
  dateDiagnosed: string | null;
  notes: string | null;
  medications: { id: string; name: string }[];
}

type FormValues = z.input<typeof conditionSchema>;

const STATUS_TONE: Record<string, "warning" | "success" | "neutral"> = {
  ACTIVE: "warning",
  MANAGED: "success",
  RESOLVED: "neutral",
};

export default function ConditionsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["conditions"],
    queryFn: () => api.get<ConditionRecord[]>("/api/v1/conditions"),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/conditions", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conditions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setShowForm(false);
    },
  });

  return (
    <div>
      <PageHeader
        title="Conditions"
        description="Long-term and past diagnoses, with the care plans and medications tied to them."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Cancel" : "Add condition"}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <ConditionForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="No conditions recorded"
          description="Conditions you or your provider add will appear here, along with linked medications and care plans."
          action={<Button variant="outline" onClick={() => setShowForm(true)}>Add condition</Button>}
        />
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{c.name}</p>
                <Badge tone={STATUS_TONE[c.status]}>{c.status.toLowerCase()}</Badge>
                {c.severity && <Badge tone="neutral">{c.severity.toLowerCase()}</Badge>}
              </div>
              {c.dateDiagnosed && <p className="text-xs text-muted-2 mt-1.5">Diagnosed {formatDate(c.dateDiagnosed)}</p>}
              {c.notes && <p className="text-sm text-muted mt-2">{c.notes}</p>}
              {c.medications.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.medications.map((m) => (
                    <Badge key={m.id} tone="primary">{m.name}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionForm({
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
  } = useForm<FormValues>({ resolver: zodResolver(conditionSchema), defaultValues: { status: "ACTIVE" } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Condition</Label>
          <Input id="name" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" {...register("category")}>
            <option value="">Select a category</option>
            <option value="diabetes">Diabetes</option>
            <option value="hypertension">Hypertension</option>
            <option value="asthma">Asthma</option>
            <option value="cardiovascular">Cardiovascular</option>
            <option value="maternal">Maternal health</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="dateDiagnosed">Date diagnosed</Label>
          <Input id="dateDiagnosed" type="date" {...register("dateDiagnosed")} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="MANAGED">Managed</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="severity">Severity</Label>
          <Select id="severity" {...register("severity")}>
            <option value="">Not specified</option>
            <option value="MILD">Mild</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register("notes")} />
      </div>
      <Button type="submit" loading={pending}>Save condition</Button>
    </form>
  );
}
