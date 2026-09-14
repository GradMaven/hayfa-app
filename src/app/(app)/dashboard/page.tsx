"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Pill, Activity, CalendarClock, FlaskConical, Syringe, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ActivityIcon } from "@/components/health/activity-icon";

interface DashboardSummary {
  activeConditions: { id: string; name: string; severity: string | null }[];
  allergies: { id: string; allergen: string; severity: string }[];
  activeMedications: { id: string; name: string; dose: string | null; frequency: string | null }[];
  recentVitals: { id: string; type: string; value: number; secondaryValue: number | null; unit: string; recordedAt: string }[];
  upcomingAppointments: { id: string; reason: string | null; scheduledAt: string; provider: { fullName: string } | null }[];
  recentLabs: { id: string; testName: string; resultValue: string; unit: string | null; flag: string; testDate: string }[];
  recentImmunizations: { id: string; vaccineName: string; administeredDate: string }[];
  recentActivity: { id: string; type: string; title: string; eventDate: string }[];
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/api/v1/dashboard/summary"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s where your health record stands today.</p>
      </div>

      {isLoading || !data ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryTile icon={Activity} label="Active conditions" value={data.activeConditions.length} href="/health" />
            <SummaryTile icon={Pill} label="Current medications" value={data.activeMedications.length} href="/medications" />
            <SummaryTile icon={AlertTriangle} label="Allergies" value={data.allergies.length} href="/health" tone={data.allergies.length ? "warning" : undefined} />
            <SummaryTile icon={CalendarClock} label="Upcoming visits" value={data.upcomingAppointments.length} href="/appointments" />
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Health summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <SummarySection title="Active conditions" empty="No active conditions recorded.">
                  {data.activeConditions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1.5">
                      <span>{c.name}</span>
                      {c.severity && <Badge tone="neutral">{c.severity.toLowerCase()}</Badge>}
                    </div>
                  ))}
                </SummarySection>

                <SummarySection title="Current medications" empty="No active medications.">
                  {data.activeMedications.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm py-1.5">
                      <span>{m.name}{m.dose ? ` — ${m.dose}` : ""}</span>
                      <span className="text-muted text-xs">{m.frequency}</span>
                    </div>
                  ))}
                </SummarySection>

                <SummarySection title="Allergies" empty="No known allergies recorded.">
                  {data.allergies.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm py-1.5">
                      <span>{a.allergen}</span>
                      <Badge tone={a.severity === "SEVERE" ? "danger" : a.severity === "MODERATE" ? "warning" : "neutral"}>
                        {a.severity.toLowerCase()}
                      </Badge>
                    </div>
                  ))}
                </SummarySection>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted">Nothing recorded yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.recentActivity.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <ActivityIcon type={e.type} className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{e.title}</p>
                          <p className="text-xs text-muted">{formatDate(e.eventDate)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/timeline" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  View full timeline <ArrowRight className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FlaskConical className="size-4" /> Recent lab results</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentLabs.length === 0 ? (
                  <EmptyState icon={FlaskConical} title="No lab results yet" description="Results you add or upload will appear here." />
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentLabs.map((l) => (
                      <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{l.testName}</p>
                          <p className="text-xs text-muted">{formatDate(l.testDate)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{l.resultValue}{l.unit}</span>
                          {l.flag !== "NORMAL" && <Badge tone={l.flag === "CRITICAL" ? "danger" : "warning"}>{l.flag.toLowerCase()}</Badge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4" /> Upcoming appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {data.upcomingAppointments.length === 0 ? (
                  <EmptyState icon={CalendarClock} title="Nothing scheduled" description="Appointments you add will show up here." />
                ) : (
                  <ul className="divide-y divide-border">
                    {data.upcomingAppointments.map((a) => (
                      <li key={a.id} className="py-2.5 text-sm">
                        <p className="font-medium">{a.reason ?? "Visit"}</p>
                        <p className="text-xs text-muted">{formatDateTime(a.scheduledAt)}{a.provider ? ` · ${a.provider.fullName}` : ""}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {data.recentImmunizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Syringe className="size-4" /> Immunization status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.recentImmunizations.map((i) => (
                    <Badge key={i.id} tone="success">{i.vaccineName} · {formatDate(i.administeredDate)}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  href: string;
  tone?: "warning";
}) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:border-primary/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`flex size-9 items-center justify-center rounded-[var(--radius-sm)] ${tone === "warning" && value > 0 ? "bg-warning-tint text-warning" : "bg-primary-tint text-primary"}`}>
            <Icon className="size-4.5" />
          </div>
          <div>
            <p className="text-xl font-semibold leading-none">{value}</p>
            <p className="text-xs text-muted mt-1">{label}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function SummarySection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-2 mb-1">{title}</h3>
      {hasChildren ? <div className="divide-y divide-border">{children}</div> : <p className="text-sm text-muted">{empty}</p>}
    </div>
  );
}
