"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, History } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/utils";

export type CorrectionResourceType = "MEDICATION" | "CONDITION" | "LAB_RESULT";

export interface CorrectionField {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
}

interface CorrectionEntry {
  id: string;
  reason: string;
  previousValues: Record<string, unknown>;
  correctedValues: Record<string, unknown>;
  createdAt: string;
}

// Source-verified records (§56) can't be edited directly — this is the
// escape hatch: pick a field, say what it should be and why, and the change
// applies immediately while permanently keeping the original value. See
// docs/security-architecture.md "Data correction workflow".
export function CorrectionRequestControl({
  resourceType,
  resourceId,
  fields,
  invalidateQueryKeys,
}: {
  resourceType: CorrectionResourceType;
  resourceId: string;
  fields: CorrectionField[];
  invalidateQueryKeys: unknown[][];
}) {
  const [mode, setMode] = useState<"closed" | "form" | "history">("closed");
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ["corrections", resourceType, resourceId],
    queryFn: () =>
      api.get<CorrectionEntry[]>(`/api/v1/corrections?resourceType=${resourceType}&resourceId=${resourceId}`),
    enabled: mode === "history",
  });

  const mutation = useMutation({
    mutationFn: (input: { fieldKey: string; value: string; reason: string }) =>
      api.post("/api/v1/corrections", {
        resourceType,
        resourceId,
        reason: input.reason,
        correctedFields: { [input.fieldKey]: input.value },
      }),
    onSuccess: () => {
      for (const key of invalidateQueryKeys) queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["corrections", resourceType, resourceId] });
      setMode("closed");
    },
  });

  if (mode === "closed") {
    return (
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={() => setMode("form")}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Pencil className="size-3.5" /> Request correction
        </button>
        <button
          onClick={() => setMode("history")}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:underline"
        >
          <History className="size-3.5" /> Correction history
        </button>
      </div>
    );
  }

  if (mode === "history") {
    return (
      <div className="mt-3 rounded-[var(--radius-md)] border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">Correction history</p>
          <button onClick={() => setMode("closed")} className="text-xs text-muted hover:underline">
            Close
          </button>
        </div>
        {historyQuery.isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : !historyQuery.data || historyQuery.data.length === 0 ? (
          <p className="text-sm text-muted">No corrections have been submitted for this record.</p>
        ) : (
          <ul className="space-y-2">
            {historyQuery.data.map((c) => (
              <li key={c.id} className="text-sm">
                {Object.keys(c.correctedValues).map((key) => {
                  const label = fields.find((f) => f.key === key)?.label ?? key;
                  return (
                    <p key={key}>
                      <span className="font-medium">{label}:</span>{" "}
                      <span className="line-through text-muted-2">{String(c.previousValues[key] ?? "—")}</span>{" "}
                      → <span>{String(c.correctedValues[key])}</span>
                    </p>
                  );
                })}
                <p className="text-xs text-muted mt-0.5">
                  &ldquo;{c.reason}&rdquo; · {formatDateTime(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <CorrectionForm
      fields={fields}
      pending={mutation.isPending}
      error={mutation.error}
      onCancel={() => setMode("closed")}
      onSubmit={(v) => mutation.mutate(v)}
    />
  );
}

function CorrectionForm({
  fields,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  fields: CorrectionField[];
  pending: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (values: { fieldKey: string; value: string; reason: string }) => void;
}) {
  const [fieldKey, setFieldKey] = useState(fields[0]?.key ?? "");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const field = fields.find((f) => f.key === fieldKey);

  const valid = fieldKey.trim().length > 0 && value.trim().length > 0 && reason.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!valid) return;
        onSubmit({ fieldKey, value, reason });
      }}
      className="mt-3 rounded-[var(--radius-md)] border border-border p-3 space-y-3"
      noValidate
    >
      {error && <Alert tone="danger">{error instanceof ApiClientError ? error.message : "Something went wrong."}</Alert>}
      <div>
        <Label htmlFor="correction-field">Field to correct</Label>
        <Select
          id="correction-field"
          value={fieldKey}
          onChange={(e) => {
            setFieldKey(e.target.value);
            setValue("");
          }}
        >
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="correction-value">Corrected value</Label>
        {field?.type === "select" ? (
          <Select id="correction-value" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Select…</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : field?.type === "textarea" ? (
          <Textarea id="correction-value" value={value} onChange={(e) => setValue(e.target.value)} />
        ) : (
          <Input
            id="correction-value"
            type={field?.type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {touched && value.trim().length === 0 && <FieldError>A corrected value is required.</FieldError>}
      </div>
      <div>
        <Label htmlFor="correction-reason">Why is this being corrected?</Label>
        <Textarea
          id="correction-reason"
          placeholder="e.g. Dose was recorded incorrectly at the clinic visit"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {touched && reason.trim().length === 0 && <FieldError>A reason is required.</FieldError>}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Submit correction
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
