"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { providerSignUpSchema, type ProviderSignUpInput } from "@/lib/validation/provider";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError, FieldHint } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

interface OrganizationOption {
  id: string;
  name: string;
  type: string;
  county: string | null;
}

export default function ProviderSignUpPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProviderSignUpInput>({ resolver: zodResolver(providerSignUpSchema) });

  const orgsQuery = useQuery({
    queryKey: ["public-organizations"],
    queryFn: () => api.get<OrganizationOption[]>("/api/v1/organizations"),
  });

  async function onSubmit(values: ProviderSignUpInput) {
    setServerError(null);
    try {
      await api.post("/api/v1/auth/provider-signup", values);
      router.push("/portal");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Register as a provider</h1>
      <p className="mt-1.5 text-sm text-muted">
        Your registration is reviewed before you can receive patient consent grants. You can sign in and use the
        portal immediately, but your records will be marked unverified until then.
      </p>

      {serverError && <Alert tone="danger" className="mt-5">{serverError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="phone">Phone number (optional)</Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="+254712345678" {...register("phone")} />
          <FieldError>{errors.phone?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="licenseNumber">License number</Label>
          <Input id="licenseNumber" {...register("licenseNumber")} />
          <FieldError>{errors.licenseNumber?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="specialty">Specialty (optional)</Label>
          <Input id="specialty" placeholder="e.g. Internal Medicine" {...register("specialty")} />
        </div>
        {orgsQuery.data && orgsQuery.data.length > 0 && (
          <div>
            <Label htmlFor="organizationId">Organization (optional)</Label>
            <Select id="organizationId" {...register("organizationId")}>
              <option value="">Not affiliated with a listed organization</option>
              {orgsQuery.data.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </Select>
            <FieldHint>Only verified organizations are listed. Not listed? You can add this later.</FieldHint>
          </div>
        )}
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          <FieldError>{errors.password?.message}</FieldError>
          <FieldHint>At least 10 characters.</FieldHint>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Register</Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        Signing up as a patient?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">Create a patient account</Link>
      </p>
    </div>
  );
}
