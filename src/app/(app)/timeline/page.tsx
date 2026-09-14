"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Sparkles } from "lucide-react";
import { api, requestWithMeta } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { ActivityIcon, activityTypeLabel } from "@/components/health/activity-icon";
import { cn, formatDate } from "@/lib/utils";
import { featureFlags } from "@/lib/feature-flags";

interface HealthEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  eventDate: string;
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "ENCOUNTER", label: "Consultations" },
  { value: "DIAGNOSIS", label: "Diagnoses" },
  { value: "MEDICATION", label: "Medications" },
  { value: "LAB", label: "Labs" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "IMMUNIZATION", label: "Vaccinations" },
  { value: "PROCEDURE", label: "Procedures" },
  { value: "VITAL", label: "Vitals" },
  { value: "APPOINTMENT", label: "Appointments" },
];

export default function TimelinePage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["timeline", typeFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      params.set("limit", "100");
      return requestWithMeta<HealthEvent[]>(`/api/v1/timeline?${params.toString()}`);
    },
  });

  const grouped = useMemo(() => {
    const events = data?.data ?? [];
    const map = new Map<string, HealthEvent[]>();
    for (const e of events) {
      const year = new Date(e.eventDate).getFullYear().toString();
      const list = map.get(year) ?? [];
      list.push(e);
      map.set(year, list);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <div>
      <PageHeader title="Health Timeline" description="Your complete health history, in one place." />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-2" />
          <Input placeholder="Search your history…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {featureFlags.ai && <AISummaryButton />}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              typeFilter === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted hover:bg-surface-alt"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : grouped.length === 0 ? (
        <EmptyState icon={Clock} title="Nothing here yet" description="As you add records, upload documents, or connect providers, your history will appear here." />
      ) : (
        <div className="space-y-8">
          {grouped.map(([year, events]) => (
            <div key={year}>
              <h2 className="text-lg font-semibold mb-3">{year}</h2>
              <ol className="space-y-5">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <ActivityIcon type={e.type} />
                      <span className="w-px flex-1 bg-border mt-1" aria-hidden="true" />
                    </div>
                    <div className="pb-1">
                      <p className="text-xs text-muted-2">{formatDate(e.eventDate, { month: "long", day: "numeric" })}</p>
                      <p className="text-xs font-medium text-primary mt-0.5">{activityTypeLabel(e.type)}</p>
                      <p className="text-sm text-foreground mt-0.5">{e.title}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AISummaryButton() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await api.post<{ text: string; disclaimer: string }>("/api/v1/ai/timeline-summary", {});
      setSummary(res.text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sm:w-64">
      <Button variant="outline" onClick={run} loading={loading} className="w-full">
        <Sparkles className="size-4" /> Summarize
      </Button>
      {summary && <p className="mt-2 text-xs text-muted">{summary}</p>}
    </div>
  );
}
