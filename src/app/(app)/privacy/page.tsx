"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ShieldCheck, Eye, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { featureFlags } from "@/lib/feature-flags";

interface AccessLogEntry {
  id: string;
  actorLabel: string;
  resourceType: string;
  action: "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "EXPORT";
  purpose: string | null;
  result: "ALLOWED" | "DENIED";
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  VIEW: "Viewed",
  CREATE: "Added",
  UPDATE: "Updated",
  DELETE: "Deleted",
  EXPORT: "Exported",
};

export default function PrivacyPage() {
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["access-log"],
    queryFn: () => api.get<AccessLogEntry[]>("/api/v1/audit"),
  });

  async function handleExport() {
    setDownloading(true);
    try {
      const record = await api.get<unknown>("/api/v1/export");
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hafya-health-record-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Privacy Center" description="Your health information is private. You decide who can access it." />

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader>
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle className="mt-2">Your data</CardTitle>
            <CardDescription>Download a complete copy of your structured health record at any time.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} loading={downloading} variant="outline">
              <Download className="size-4" /> Export my record (JSON)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Sparkles className="size-5 text-primary" />
            <CardTitle className="mt-2">AI privacy</CardTitle>
            <CardDescription>
              {featureFlags.ai
                ? "AI features use only the specific records needed to answer your request. Nothing is used to train models, and requests are not retained beyond what's needed to generate the response."
                : "AI features are currently disabled for this account. No health data is sent to any AI provider."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="size-4" /> Access history</CardTitle>
          <CardDescription>Who has viewed or changed your records, and when.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonList rows={4} />
          ) : !data || data.length === 0 ? (
            <EmptyState icon={Eye} title="No access recorded yet" description="Every time your records are viewed or changed, it will be logged here." />
          ) : (
            <ul className="divide-y divide-border">
              {data.map((log) => (
                <li key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{log.actorLabel}</span>{" "}
                      {ACTION_LABEL[log.action].toLowerCase()}: {log.resourceType.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    {log.purpose && <p className="text-xs text-muted mt-0.5">Purpose: {log.purpose}</p>}
                    <p className="text-xs text-muted-2 mt-0.5">{formatDateTime(log.createdAt)}</p>
                  </div>
                  {log.result === "DENIED" && <Badge tone="danger">Blocked</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
