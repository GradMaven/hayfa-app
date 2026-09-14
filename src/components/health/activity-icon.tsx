import {
  Stethoscope,
  ClipboardList,
  Pill,
  FlaskConical,
  HeartPulse,
  Syringe,
  Scissors,
  FileText,
  CalendarClock,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  ENCOUNTER: Stethoscope,
  DIAGNOSIS: ClipboardList,
  MEDICATION: Pill,
  LAB: FlaskConical,
  VITAL: HeartPulse,
  IMMUNIZATION: Syringe,
  PROCEDURE: Scissors,
  DOCUMENT: FileText,
  APPOINTMENT: CalendarClock,
  CARE_PLAN: ClipboardCheck,
};

const TONES: Record<string, string> = {
  ENCOUNTER: "bg-info-tint text-info",
  DIAGNOSIS: "bg-warning-tint text-warning",
  MEDICATION: "bg-primary-tint text-primary",
  LAB: "bg-accent-tint text-accent",
  VITAL: "bg-danger-tint text-danger",
  IMMUNIZATION: "bg-success-tint text-success",
  PROCEDURE: "bg-info-tint text-info",
  DOCUMENT: "bg-surface-alt text-muted",
  APPOINTMENT: "bg-primary-tint text-primary",
  CARE_PLAN: "bg-success-tint text-success",
};

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? ClipboardList;
  return (
    <span className={cn("flex size-7 items-center justify-center rounded-full", TONES[type] ?? "bg-surface-alt text-muted", className)}>
      <Icon className="size-3.5" aria-hidden="true" />
    </span>
  );
}

export function activityTypeLabel(type: string): string {
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}
