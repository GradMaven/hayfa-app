"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { featureFlags } from "@/lib/feature-flags";

interface SessionUser {
  phone: string | null;
}

export function PhoneCard() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: () => api.get<{ user: SessionUser | null }>("/api/v1/auth/session"),
  });

  useEffect(() => {
    if (sessionQuery.data?.user) setValue(sessionQuery.data.user.phone ?? "");
  }, [sessionQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (phone: string | null) => api.patch("/api/v1/account/phone", { phone }),
    onSuccess: () => {
      setTouched(false);
      queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    },
  });

  if (sessionQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="size-4" /> Phone number</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-10 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Phone className="size-4" /> Phone number</CardTitle>
        <CardDescription>
          {featureFlags.sms
            ? "Used to send you SMS notifications — appointment reminders, security alerts, and similar short pointers. We never send clinical detail by SMS."
            : "Not currently used for notifications (SMS is off for this deployment), but you can still save it for later."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {saveMutation.isError && (
          <Alert tone="danger" className="mb-3">
            {saveMutation.error instanceof ApiClientError ? saveMutation.error.message : "Something went wrong."}
          </Alert>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            const trimmed = value.trim();
            if (trimmed && !/^\+[1-9]\d{7,14}$/.test(trimmed)) return;
            saveMutation.mutate(trimmed || null);
          }}
          className="flex items-start gap-3"
        >
          <div className="flex-1">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+254712345678"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {touched && value.trim() && !/^\+[1-9]\d{7,14}$/.test(value.trim()) ? (
              <FieldError>Enter a phone number in international format, e.g. +254712345678.</FieldError>
            ) : (
              <FieldHint>International format, e.g. +254712345678. Leave blank to remove it.</FieldHint>
            )}
          </div>
          <Button type="submit" className="mt-6" loading={saveMutation.isPending}>Save</Button>
        </form>
      </CardContent>
    </Card>
  );
}
