"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FlaskConical, X, Sparkles } from "lucide-react";
import type { z } from "zod";
import { labResultSchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { featureFlags } from "@/lib/feature-flags";

interface LabResultRecord {
  id: string;
  testName: string;
  resultValue: string;
  unit: string | null;
  referenceRange: string | null;
  flag: "NORMAL" | "LOW" | "HIGH" | "CRITICAL";
  testDate: string;
  source: string;
  verificationStatus: string;
}

type FormValues = z.input<typeof labResultSchema>;

const FLAG_TONE: Record<string, "success" | "warning" | "danger"> = {
  NORMAL: "success",
  LOW: "warning",
  HIGH: "warning",
  CRITICAL: "danger",
};

export function LabsTab() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["labs"],
    queryFn: () => api.get<LabResultRecord[]>("/api/v1/labs"),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.post("/api/v1/labs", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setShowForm(false);
    },
  });

  // Group by test name so repeated tests read as a trend (§19), most
  // recent first within each group.
  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, LabResultRecord[]>();
    for (const r of data) {
      const list = map.get(r.testName) ?? [];
      list.push(r);
      map.set(r.testName, list);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Cancel" : "Add lab result"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <LabForm onSubmit={(v) => createMutation.mutate(v)} pending={createMutation.isPending} error={createMutation.error} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : groups.length === 0 ? (
        <EmptyState icon={FlaskConical} title="No lab results yet" description="Results you add or upload will appear here, grouped by test so you can see trends over time." />
      ) : (
        <div className="space-y-4">
          {groups.map(([testName, results]) => (
            <Card key={testName} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{testName}</p>
                {featureFlags.ai && results.length > 0 && <ExplainButton labResultId={results[0].id} />}
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {[...results].reverse().map((r) => (
                  <div key={r.id} className="shrink-0 rounded-[var(--radius-md)] border border-border px-3 py-2 min-w-28">
                    <p className="text-xs text-muted-2">{formatDate(r.testDate, { month: "short", day: "numeric" })}</p>
                    <p className="text-sm font-semibold mt-0.5">{r.resultValue}{r.unit}</p>
                    {r.flag !== "NORMAL" && <Badge tone={FLAG_TONE[r.flag]} className="mt-1">{r.flag.toLowerCase()}</Badge>}
                  </div>
                ))}
              </div>
              {results[0].referenceRange && (
                <p className="text-xs text-muted mt-2">Reference: {results[0].referenceRange}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ExplainButton({ labResultId }: { labResultId: string }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post<{ text: string }>("/api/v1/ai/explain-lab", { labResultId }),
    onSuccess: (res) => setExplanation(res.text),
  });

  if (explanation) {
    return <p className="text-xs text-muted max-w-xs text-right">{explanation}</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        <Sparkles className="size-3.5" /> {mutation.isPending ? "Explaining…" : "Explain this"}
      </button>
      {mutation.isError && (
        <p className="text-xs text-danger max-w-xs text-right">
          {mutation.error instanceof ApiClientError ? mutation.error.message : "This explanation is temporarily unavailable."}
        </p>
      )}
    </div>
  );
}

function LabForm({ onSubmit, pending, error }: { onSubmit: (values: FormValues) => void; pending: boolean; error: Error | null }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(labResultSchema), defaultValues: { flag: "NORMAL" } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="testName">Test name</Label>
          <Input id="testName" placeholder="e.g. HbA1c" {...register("testName")} />
          <FieldError>{errors.testName?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="testDate">Test date</Label>
          <Input id="testDate" type="date" {...register("testDate")} />
          <FieldError>{errors.testDate?.message}</FieldError>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="resultValue">Result</Label>
          <Input id="resultValue" {...register("resultValue")} />
          <FieldError>{errors.resultValue?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" placeholder="%, mg/dL…" {...register("unit")} />
        </div>
        <div>
          <Label htmlFor="flag">Flag</Label>
          <Select id="flag" {...register("flag")}>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="referenceRange">Reference range</Label>
        <Input id="referenceRange" placeholder="e.g. <5.7%" {...register("referenceRange")} />
      </div>
      <Button type="submit" loading={pending}>Save result</Button>
    </form>
  );
}
