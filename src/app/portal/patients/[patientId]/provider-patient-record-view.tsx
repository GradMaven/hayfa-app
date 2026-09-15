"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldOff, Inbox } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { ProviderMedicationForm, ProviderConditionForm, ProviderCarePlanForm } from "./provider-clinical-forms";
import type { DataScope } from "@/lib/consent";

// Read-only-by-default browsing of a consented patient's record, scoped to
// exactly the categories the patient granted (consent.dataScopes) — a tab
// for MEDICATIONS the patient never granted simply doesn't render, the same
// authorization canAccess() would enforce if this UI didn't bother checking
// first (see docs/security-architecture.md "defense in depth": this is the
// UI being a good citizen, not the actual security boundary). "Add" actions
// are deliberately limited to the three categories docs/product-architecture.md
// named as the gap this closes — diagnoses, prescriptions, care plans — not
// every writable resource type, to keep this pass bounded.

interface TabDef {
  scope: DataScope;
  key: string;
  label: string;
  canAdd: boolean;
}

const TAB_DEFS: TabDef[] = [
  { scope: "CONDITIONS", key: "conditions", label: "Conditions", canAdd: true },
  { scope: "MEDICATIONS", key: "medications", label: "Medications", canAdd: true },
  { scope: "LAB_RESULTS", key: "labs", label: "Lab results", canAdd: false },
  { scope: "VITALS", key: "vitals", label: "Vitals", canAdd: false },
  { scope: "CARE_PLANS", key: "care-plans", label: "Care plans", canAdd: true },
  { scope: "ALLERGIES", key: "allergies", label: "Allergies", canAdd: false },
  { scope: "IMMUNIZATIONS", key: "immunizations", label: "Immunizations", canAdd: false },
  { scope: "APPOINTMENTS", key: "appointments", label: "Appointments", canAdd: false },
];

export function ProviderPatientRecordView({ patientId, dataScopes }: { patientId: string; dataScopes: string[] }) {
  const visibleTabs = TAB_DEFS.filter((t) => dataScopes.includes(t.scope));
  const [tab, setTab] = useState<string>(visibleTabs[0]?.key ?? "");

  if (visibleTabs.length === 0) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="No record categories granted"
        description="This consent doesn't name any of the record categories this portal can display."
      />
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Patient record sections" className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "conditions" && <ConditionsTab patientId={patientId} />}
      {tab === "medications" && <MedicationsTab patientId={patientId} />}
      {tab === "labs" && <LabsTab patientId={patientId} />}
      {tab === "vitals" && <VitalsTab patientId={patientId} />}
      {tab === "care-plans" && <CarePlansTab patientId={patientId} />}
      {tab === "allergies" && <AllergiesTab patientId={patientId} />}
      {tab === "immunizations" && <ImmunizationsTab patientId={patientId} />}
      {tab === "appointments" && <AppointmentsTab patientId={patientId} />}
    </div>
  );
}

function AddToggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> {label}
        </Button>
      ) : (
        <Card className="p-4">
          <CardContent className="p-0">{children(() => setOpen(false))}</CardContent>
        </Card>
      )}
    </div>
  );
}

interface ConditionRecord {
  id: string;
  name: string;
  status: "ACTIVE" | "MANAGED" | "RESOLVED";
  severity: "MILD" | "MODERATE" | "SEVERE" | null;
  dateDiagnosed: string | null;
  notes: string | null;
}
const STATUS_TONE: Record<string, "warning" | "success" | "neutral"> = { ACTIVE: "warning", MANAGED: "success", RESOLVED: "neutral" };

function ConditionsTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portal-conditions", patientId],
    queryFn: () => api.get<ConditionRecord[]>(`/api/v1/conditions?patientId=${patientId}`),
  });

  return (
    <div>
      <AddToggle label="Add diagnosis">
        {(close) => (
          <ProviderConditionForm
            patientId={patientId}
            onCancel={close}
            onSuccess={() => {
              close();
              queryClient.invalidateQueries({ queryKey: ["portal-conditions", patientId] });
            }}
          />
        )}
      </AddToggle>

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Inbox} title="No conditions recorded" description="Nothing in this category yet." />
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{c.name}</p>
                <Badge tone={STATUS_TONE[c.status]}>{c.status.toLowerCase()}</Badge>
                {c.severity && <Badge tone="neutral">{c.severity.toLowerCase()}</Badge>}
              </div>
              {c.dateDiagnosed && <p className="text-xs text-muted-2 mt-1.5">Diagnosed {formatDate(c.dateDiagnosed)}</p>}
              {c.notes && <p className="text-sm text-muted mt-2">{c.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface MedicationRecord {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  startDate: string | null;
  purpose: string | null;
  status: "ACTIVE" | "COMPLETED" | "DISCONTINUED" | "PAUSED";
}
const MED_STATUS_TONE: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "neutral",
  DISCONTINUED: "danger",
};

function MedicationsTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portal-medications", patientId],
    queryFn: () => api.get<MedicationRecord[]>(`/api/v1/medications?patientId=${patientId}`),
  });

  return (
    <div>
      <AddToggle label="Prescribe medication">
        {(close) => (
          <ProviderMedicationForm
            patientId={patientId}
            onCancel={close}
            onSuccess={() => {
              close();
              queryClient.invalidateQueries({ queryKey: ["portal-medications", patientId] });
            }}
          />
        )}
      </AddToggle>

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Inbox} title="No medications recorded" description="Nothing in this category yet." />
      ) : (
        <div className="space-y-3">
          {data.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{m.name}{m.dose ? ` ${m.dose}` : ""}</p>
                <Badge tone={MED_STATUS_TONE[m.status]}>{m.status.toLowerCase()}</Badge>
              </div>
              <p className="text-sm text-muted mt-1">{[m.frequency, m.route].filter(Boolean).join(" · ") || "No frequency recorded"}</p>
              {m.purpose && <p className="text-sm text-muted mt-0.5">For: {m.purpose}</p>}
              {m.startDate && <p className="text-xs text-muted-2 mt-1.5">Started {formatDate(m.startDate)}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface LabResultRecord {
  id: string;
  testName: string;
  resultValue: string;
  unit: string | null;
  referenceRange: string | null;
  flag: "NORMAL" | "LOW" | "HIGH" | "CRITICAL";
  testDate: string;
}
const FLAG_TONE: Record<string, "success" | "warning" | "danger"> = { NORMAL: "success", LOW: "warning", HIGH: "warning", CRITICAL: "danger" };

function LabsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-labs", patientId],
    queryFn: () => api.get<LabResultRecord[]>(`/api/v1/labs?patientId=${patientId}`),
  });

  if (isLoading) return <SkeletonList rows={2} />;
  if (!data || data.length === 0) return <EmptyState icon={Inbox} title="No lab results recorded" description="Nothing in this category yet." />;

  return (
    <div className="space-y-3">
      {data.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-medium">{r.testName}</p>
            <Badge tone={FLAG_TONE[r.flag]}>{r.flag.toLowerCase()}</Badge>
          </div>
          <p className="text-sm text-muted mt-1">
            {r.resultValue}{r.unit} {r.referenceRange ? `(ref ${r.referenceRange})` : ""}
          </p>
          <p className="text-xs text-muted-2 mt-1.5">{formatDate(r.testDate)}</p>
        </Card>
      ))}
    </div>
  );
}

interface VitalRecord {
  id: string;
  type: string;
  value: number;
  secondaryValue: number | null;
  unit: string;
  recordedAt: string;
}

function VitalsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-vitals", patientId],
    queryFn: () => api.get<VitalRecord[]>(`/api/v1/vitals?patientId=${patientId}`),
  });

  if (isLoading) return <SkeletonList rows={2} />;
  if (!data || data.length === 0) return <EmptyState icon={Inbox} title="No vitals recorded" description="Nothing in this category yet." />;

  return (
    <div className="space-y-3">
      {data.map((v) => (
        <Card key={v.id} className="p-4">
          <p className="font-medium">{v.type.replace(/_/g, " ")}</p>
          <p className="text-sm text-muted mt-1">{v.value}{v.secondaryValue ? `/${v.secondaryValue}` : ""} {v.unit}</p>
          <p className="text-xs text-muted-2 mt-1.5">{formatDateTime(v.recordedAt)}</p>
        </Card>
      ))}
    </div>
  );
}

interface CarePlanRecord {
  id: string;
  title: string;
  goal: string;
  status: "ACTIVE" | "COMPLETED" | "DISCONTINUED";
  condition: { name: string } | null;
}

function CarePlansTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portal-care-plans", patientId],
    queryFn: () => api.get<CarePlanRecord[]>(`/api/v1/care-plans?patientId=${patientId}`),
  });

  return (
    <div>
      <AddToggle label="Create care plan">
        {(close) => (
          <ProviderCarePlanForm
            patientId={patientId}
            onCancel={close}
            onSuccess={() => {
              close();
              queryClient.invalidateQueries({ queryKey: ["portal-care-plans", patientId] });
            }}
          />
        )}
      </AddToggle>

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Inbox} title="No care plans recorded" description="Nothing in this category yet." />
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{c.title}</p>
                <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status.toLowerCase()}</Badge>
              </div>
              <p className="text-sm text-muted mt-1">{c.goal}</p>
              {c.condition && <p className="text-xs text-muted-2 mt-1.5">For: {c.condition.name}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface AllergyRecord {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";
}
const ALLERGY_TONE: Record<string, "warning" | "danger" | "neutral"> = { MILD: "warning", MODERATE: "warning", SEVERE: "danger", UNKNOWN: "neutral" };

function AllergiesTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-allergies", patientId],
    queryFn: () => api.get<AllergyRecord[]>(`/api/v1/allergies?patientId=${patientId}`),
  });

  if (isLoading) return <SkeletonList rows={2} />;
  if (!data || data.length === 0) return <EmptyState icon={Inbox} title="No allergies recorded" description="Nothing in this category yet." />;

  return (
    <div className="space-y-3">
      {data.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{a.allergen}</p>
            <Badge tone={ALLERGY_TONE[a.severity]}>{a.severity.toLowerCase()}</Badge>
          </div>
          {a.reaction && <p className="text-sm text-muted mt-1">{a.reaction}</p>}
        </Card>
      ))}
    </div>
  );
}

interface ImmunizationRecord {
  id: string;
  vaccineName: string;
  doseNumber: number | null;
  administeredDate: string;
  providerName: string | null;
}

function ImmunizationsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-immunizations", patientId],
    queryFn: () => api.get<ImmunizationRecord[]>(`/api/v1/immunizations?patientId=${patientId}`),
  });

  if (isLoading) return <SkeletonList rows={2} />;
  if (!data || data.length === 0) return <EmptyState icon={Inbox} title="No immunizations recorded" description="Nothing in this category yet." />;

  return (
    <div className="space-y-3">
      {data.map((i) => (
        <Card key={i.id} className="p-4">
          <p className="font-medium">{i.vaccineName}{i.doseNumber ? ` — dose ${i.doseNumber}` : ""}</p>
          <p className="text-xs text-muted-2 mt-1.5">
            {formatDate(i.administeredDate)}{i.providerName ? ` · ${i.providerName}` : ""}
          </p>
        </Card>
      ))}
    </div>
  );
}

interface AppointmentRecord {
  id: string;
  reason: string | null;
  scheduledAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  provider: { fullName: string; specialty: string | null } | null;
}
const APPT_TONE: Record<string, "primary" | "success" | "neutral" | "danger"> = {
  SCHEDULED: "primary",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
};

function AppointmentsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-appointments", patientId],
    queryFn: () => api.get<AppointmentRecord[]>(`/api/v1/appointments?patientId=${patientId}`),
  });

  if (isLoading) return <SkeletonList rows={2} />;
  if (!data || data.length === 0) return <EmptyState icon={Inbox} title="No appointments recorded" description="Nothing in this category yet." />;

  return (
    <div className="space-y-3">
      {data.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{a.reason ?? "Visit"}</p>
            <Badge tone={APPT_TONE[a.status]}>{a.status.toLowerCase().replace("_", " ")}</Badge>
          </div>
          <p className="text-xs text-muted-2 mt-1.5">
            {formatDateTime(a.scheduledAt)}{a.provider ? ` · ${a.provider.fullName}` : ""}
          </p>
        </Card>
      ))}
    </div>
  );
}
