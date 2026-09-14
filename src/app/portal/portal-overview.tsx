"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

interface ProviderOverview {
  role: "PROVIDER";
  patients: { consentId: string; patientName: string; purpose: string; dataScopes: string[]; expiresAt: string | null }[];
}
interface CaregiverOverview {
  role: "CAREGIVER";
  patients: { linkId: string; patientName: string; relationship: string | null; permissions: string[] }[];
}

export function PortalOverview({ role }: { role: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => api.get<ProviderOverview | CaregiverOverview>("/api/v1/portal/overview"),
  });

  if (isLoading || !data) return <SkeletonList rows={2} />;

  if (data.patients.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={Users}
          title="No patients yet"
          description={role === "PROVIDER" ? "When a patient grants you access, they'll appear here." : "When a patient adds you as a caregiver, they'll appear here."}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {data.role === "PROVIDER"
        ? data.patients.map((p) => (
            <Card key={p.consentId} className="p-4">
              <p className="font-medium">{p.patientName}</p>
              <p className="text-sm text-muted mt-0.5">{p.purpose}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.dataScopes.map((s) => (
                  <Badge key={s} tone="primary">{s.replace(/_/g, " ").toLowerCase()}</Badge>
                ))}
              </div>
              {p.expiresAt && <p className="text-xs text-muted-2 mt-2">Access expires {formatDate(p.expiresAt)}</p>}
            </Card>
          ))
        : data.patients.map((p) => (
            <Card key={p.linkId} className="p-4">
              <div className="flex items-center gap-2">
                <p className="font-medium">{p.patientName}</p>
                {p.relationship && <Badge tone="neutral">{p.relationship}</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.permissions.map((s) => (
                  <Badge key={s} tone="primary">{s.replace(/_/g, " ").toLowerCase()}</Badge>
                ))}
              </div>
            </Card>
          ))}
    </div>
  );
}
