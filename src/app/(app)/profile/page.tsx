"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { patientProfileUpdateSchema } from "@/lib/validation/patient-profile";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface PatientProfileRecord {
  fullName: string;
  dateOfBirth: string;
  biologicalSex: string;
  country: string;
  county: string | null;
  bloodType: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  insuranceProvider: string | null;
  insuranceMemberId: string | null;
  emergencyAccessEnabled: boolean;
}

type FormValues = z.input<typeof patientProfileUpdateSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["patient-profile"], queryFn: () => api.get<PatientProfileRecord>("/api/v1/patients/me") });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitSuccessful },
  } = useForm<FormValues>({ resolver: zodResolver(patientProfileUpdateSchema) });

  useEffect(() => {
    if (data) {
      reset({
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth.slice(0, 10) as never,
        biologicalSex: data.biologicalSex as never,
        county: data.county ?? "",
        bloodType: data.bloodType as never,
        emergencyContactName: data.emergencyContactName ?? "",
        emergencyContactPhone: data.emergencyContactPhone ?? "",
        insuranceProvider: data.insuranceProvider ?? "",
        insuranceMemberId: data.insuranceMemberId ?? "",
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch("/api/v1/patients/me", values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-profile"] }),
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Profile" description="Your health profile details." />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Profile" description="Only what's needed to help manage your care — see the Privacy Center for how this is used." />

      <Card className="max-w-2xl">
        <CardContent>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5" noValidate>
            {mutation.error && <Alert tone="danger">{mutation.error instanceof ApiClientError ? mutation.error.message : "Something went wrong."}</Alert>}
            {isSubmitSuccessful && mutation.isSuccess && <Alert tone="success">Profile updated.</Alert>}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" {...register("fullName")} />
                <FieldError>{errors.fullName?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="biologicalSex">Biological sex</Label>
                <Select id="biologicalSex" {...register("biologicalSex")}>
                  <option value="UNSPECIFIED">Prefer not to say</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
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

            <div>
              <Label htmlFor="county">County</Label>
              <Input id="county" {...register("county")} />
            </div>

            <fieldset className="space-y-4 rounded-[var(--radius-md)] border border-border p-4">
              <legend className="px-1 text-sm font-medium">Emergency contact</legend>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContactName">Name</Label>
                  <Input id="emergencyContactName" {...register("emergencyContactName")} />
                </div>
                <div>
                  <Label htmlFor="emergencyContactPhone">Phone</Label>
                  <Input id="emergencyContactPhone" {...register("emergencyContactPhone")} />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-[var(--radius-md)] border border-border p-4">
              <legend className="px-1 text-sm font-medium">Insurance</legend>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="insuranceProvider">Provider</Label>
                  <Input id="insuranceProvider" {...register("insuranceProvider")} />
                </div>
                <div>
                  <Label htmlFor="insuranceMemberId">Member ID</Label>
                  <Input id="insuranceMemberId" {...register("insuranceMemberId")} />
                </div>
              </div>
            </fieldset>

            <Button type="submit" loading={mutation.isPending}>Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
