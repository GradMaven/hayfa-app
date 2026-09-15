"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { medicationSchema, conditionSchema, carePlanSchema } from "@/lib/validation/clinical";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

// Provider-side equivalents of the patient-facing add forms (see
// (app)/medications/page.tsx, (app)/conditions/page.tsx) — same schemas and
// POST endpoints, the only difference is an explicit patientId in the
// payload (a provider has no patientProfileId of their own for
// resolvePatientId() to fall back to — see lib/api/patient-scope.ts). Every
// record created here lands with source: PROVIDER_ENTERED and, since the
// demo/seed provider is verificationStatus: VERIFIED,
// verificationStatus: PROVIDER_VERIFIED — see sourceForActor()/
// verificationForActor() in lib/api/patient-scope.ts. No backend change was
// needed for any of this; it already worked for any verified, consented
// provider, it just had no UI to reach it.

type MedicationFormValues = z.input<typeof medicationSchema>;
type ConditionFormValues = z.input<typeof conditionSchema>;
type CarePlanFormValues = z.input<typeof carePlanSchema>;

export function ProviderMedicationForm({
  patientId,
  onSuccess,
  onCancel,
}: {
  patientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<MedicationFormValues>({ resolver: zodResolver(medicationSchema), defaultValues: { status: "ACTIVE" } });

  async function onSubmit(values: MedicationFormValues) {
    try {
      await api.post("/api/v1/medications", { ...values, patientId });
      onSuccess();
    } catch (err) {
      setError("root", { message: err instanceof ApiClientError ? err.message : "Something went wrong." });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {errors.root?.message && <Alert tone="danger">{errors.root.message}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="p-med-name">Medication name</Label>
          <Input id="p-med-name" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="p-med-dose">Dose</Label>
          <Input id="p-med-dose" placeholder="e.g. 5mg" {...register("dose")} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="p-med-frequency">Frequency</Label>
          <Input id="p-med-frequency" placeholder="e.g. Once daily" {...register("frequency")} />
        </div>
        <div>
          <Label htmlFor="p-med-route">Route</Label>
          <Input id="p-med-route" placeholder="e.g. Oral" {...register("route")} />
        </div>
      </div>
      <div>
        <Label htmlFor="p-med-purpose">Purpose</Label>
        <Input id="p-med-purpose" placeholder="What is this for?" {...register("purpose")} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={isSubmitting}>Prescribe</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export function ProviderConditionForm({
  patientId,
  onSuccess,
  onCancel,
}: {
  patientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ConditionFormValues>({ resolver: zodResolver(conditionSchema), defaultValues: { status: "ACTIVE" } });

  async function onSubmit(values: ConditionFormValues) {
    try {
      await api.post("/api/v1/conditions", { ...values, patientId });
      onSuccess();
    } catch (err) {
      setError("root", { message: err instanceof ApiClientError ? err.message : "Something went wrong." });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {errors.root?.message && <Alert tone="danger">{errors.root.message}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="p-cond-name">Condition</Label>
          <Input id="p-cond-name" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="p-cond-severity">Severity</Label>
          <Select id="p-cond-severity" {...register("severity")}>
            <option value="">Not specified</option>
            <option value="MILD">Mild</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="p-cond-notes">Clinical notes</Label>
        <Textarea id="p-cond-notes" {...register("notes")} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={isSubmitting}>Add diagnosis</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export function ProviderCarePlanForm({
  patientId,
  onSuccess,
  onCancel,
}: {
  patientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CarePlanFormValues>({ resolver: zodResolver(carePlanSchema), defaultValues: { status: "ACTIVE" } });

  async function onSubmit(values: CarePlanFormValues) {
    try {
      await api.post("/api/v1/care-plans", { ...values, patientId });
      onSuccess();
    } catch (err) {
      setError("root", { message: err instanceof ApiClientError ? err.message : "Something went wrong." });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {errors.root?.message && <Alert tone="danger">{errors.root.message}</Alert>}
      <div>
        <Label htmlFor="p-cp-title">Title</Label>
        <Input id="p-cp-title" {...register("title")} />
        <FieldError>{errors.title?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="p-cp-goal">Goal</Label>
        <Textarea id="p-cp-goal" {...register("goal")} />
        <FieldError>{errors.goal?.message}</FieldError>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={isSubmitting}>Create care plan</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
