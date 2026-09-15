"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { MfaCard } from "./mfa-card";
import { PhoneCard } from "./phone-card";

interface SessionRecord {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

interface PatientProfileRecord {
  emergencyAccessEnabled: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: () => api.get<SessionRecord[]>("/api/v1/auth/sessions") });
  const profileQuery = useQuery({ queryKey: ["patient-profile"], queryFn: () => api.get<PatientProfileRecord>("/api/v1/patients/me") });

  const toggleEmergencyAccess = useMutation({
    mutationFn: (enabled: boolean) => api.patch("/api/v1/patients/me/emergency-access", { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-profile"] }),
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/auth/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const revokeAllOthers = useMutation({
    mutationFn: () => api.delete("/api/v1/auth/sessions"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  async function handleSignOut() {
    await api.post("/api/v1/auth/signout");
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="space-y-5 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Laptop className="size-4" /> Devices & sessions</CardTitle>
            <CardDescription>Everywhere you&apos;re currently signed in. End any session you don&apos;t recognize.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonList rows={2} />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {data?.map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{s.userAgent ? summarizeUserAgent(s.userAgent) : "Unknown device"}</p>
                          {s.isCurrent && <Badge tone="success">This device</Badge>}
                        </div>
                        <p className="text-xs text-muted-2 mt-0.5">Last active {formatDateTime(s.lastUsedAt)} · {s.ipAddress ?? "unknown IP"}</p>
                      </div>
                      {!s.isCurrent && (
                        <Button size="sm" variant="outline" onClick={() => revokeSession.mutate(s.id)}>End session</Button>
                      )}
                    </li>
                  ))}
                </ul>
                {(data?.length ?? 0) > 1 && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => revokeAllOthers.mutate()} loading={revokeAllOthers.isPending}>
                    Sign out all other devices
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <MfaCard />

        <PhoneCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="size-4" /> Emergency access</CardTitle>
            <CardDescription>
              When enabled, a verified healthcare provider can retrieve a limited emergency summary (blood type,
              allergies, active medications, emergency contact) without your active consent, for genuine emergencies
              only. Every use is logged in your Privacy Center.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={profileQuery.data?.emergencyAccessEnabled ?? false}
                disabled={profileQuery.isLoading || toggleEmergencyAccess.isPending}
                onChange={(e) => toggleEmergencyAccess.mutate(e.target.checked)}
              />
              Allow emergency access
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <Button variant="danger" onClick={handleSignOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function summarizeUserAgent(ua: string): string {
  if (/mobile/i.test(ua)) return "Mobile browser";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Browser";
}
