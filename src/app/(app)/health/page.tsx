"use client";

import { useState } from "react";
import { PageHeader } from "@/components/health/page-header";
import { cn } from "@/lib/utils";
import { LabsTab } from "./labs-tab";
import { VitalsTab } from "./vitals-tab";
import { AllergiesTab } from "./allergies-tab";
import { ImmunizationsTab } from "./immunizations-tab";

const TABS = [
  { key: "labs", label: "Lab results" },
  { key: "vitals", label: "Vitals" },
  { key: "allergies", label: "Allergies" },
  { key: "immunizations", label: "Immunizations" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function HealthPage() {
  const [tab, setTab] = useState<TabKey>("labs");

  return (
    <div>
      <PageHeader title="Health" description="Lab results, vitals, allergies, and immunizations in one place." />

      <div role="tablist" aria-label="Health record sections" className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((t) => (
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

      {tab === "labs" && <LabsTab />}
      {tab === "vitals" && <VitalsTab />}
      {tab === "allergies" && <AllergiesTab />}
      {tab === "immunizations" && <ImmunizationsTab />}
    </div>
  );
}
