import {
  LayoutDashboard,
  Activity,
  Clock,
  FileText,
  Pill,
  HeartPulse,
  CalendarDays,
  Share2,
  Sparkles,
  User,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  inBottomNav?: boolean;
}

// §11 exactly: Home, Health, Timeline, Documents, Medications, Conditions,
// Appointments, Sharing, Insights, Profile, Settings. "Health" is labs,
// vitals, allergies and immunizations (§2) — general health metrics, distinct
// from "Conditions" (chronic-condition management, §21).
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, inBottomNav: true },
  { href: "/health", label: "Health", icon: Activity },
  { href: "/timeline", label: "Timeline", icon: Clock, inBottomNav: true },
  { href: "/documents", label: "Documents", icon: FileText, inBottomNav: true },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/conditions", label: "Conditions", icon: HeartPulse },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/sharing", label: "Sharing", icon: Share2, inBottomNav: true },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User, inBottomNav: true },
  { href: "/settings", label: "Settings", icon: Settings },
];
