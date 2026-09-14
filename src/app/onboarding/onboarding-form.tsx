"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { patientProfileSchema } from "@/lib/validation/patient-profile";

// Bind the form to the pre-coercion input shape (dateOfBirth as the raw
// string a <input type="date"> produces) — the resolver still validates
// against the full schema and the server re-validates/coerces on receipt.
type OnboardingFormValues = z.input<typeof patientProfileSchema>;
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const KENYAN_COUNTIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Uasin Gishu", "Kiambu", "Machakos",
  "Kakamega", "Kilifi", "Meru", "Nyeri", "Kajiado", "Other",
];

export function OnboardingForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(patientProfileSchema),
    defaultValues: { country: "Kenya", preferredLanguage: "en", biologicalSex: "UNSPECIFIED", bloodType: "UNKNOWN" },
  });

  async function onSubmit(values: OnboardingFormValues) {
    setServerError(null);
    try {
      await api.post("/api/v1/patients/me", values);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
      {serverError && <Alert tone="danger">{serverError}</Alert>}

      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" {...register("fullName")} />
        <FieldError>{errors.fullName?.message}</FieldError>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
          <FieldError>{errors.dateOfBirth?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="biologicalSex">Biological sex</Label>
          <Select id="biologicalSex" {...register("biologicalSex")}>
            <option value="UNSPECIFIED">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="county">County</Label>
          <Select id="county" {...register("county")}>
            <option value="">Select county</option>
            {KENYAN_COUNTIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bloodType">Blood type</Label>
          <Select id="bloodType" {...register("bloodType")}>
            <option value="UNKNOWN">Not sure</option>
            {["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"].map((bt) => (
              <option key={bt} value={bt}>{bt.replace("_POS", "+").replace("_NEG", "-")}</option>
            ))}
          </Select>
        </div>
      </div>

      <fieldset className="space-y-4 rounded-[var(--radius-md)] border border-border p-4">
        <legend className="px-1 text-sm font-medium">Emergency contact</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input id="emergencyContactName" {...register("emergencyContactName")} />
          </div>
          <div>
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input id="emergencyContactPhone" placeholder="+254 7XX XXX XXX" {...register("emergencyContactPhone")} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-[var(--radius-md)] border border-border p-4">
        <legend className="px-1 text-sm font-medium">Insurance (optional)</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="insuranceProvider">Provider</Label>
            <Input id="insuranceProvider" placeholder="e.g. NHIF" {...register("insuranceProvider")} />
          </div>
          <div>
            <Label htmlFor="insuranceMemberId">Member ID</Label>
            <Input id="insuranceMemberId" {...register("insuranceMemberId")} />
          </div>
        </div>
      </fieldset>

      <Button type="submit" className="w-full" loading={isSubmitting}>Continue to your dashboard</Button>
    </form>
  );
}
