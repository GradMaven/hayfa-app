import Link from "next/link";
import {
  ShieldCheck,
  Clock,
  Share2,
  FileText,
  Sparkles,
  Network,
  HeartPulse,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Logo } from "@/components/brand/logo";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-full">
      <MarketingNav />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary mb-6">
            <Lock className="size-3.5" /> Built for Kenya, private by design
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-foreground text-balance">
            Your Health. Your Records. Your Control.
          </h1>
          <p className="mt-5 text-lg text-muted max-w-2xl mx-auto text-balance">
            Hafya helps you securely bring your health information together, understand your health
            history, and decide who can access it.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Get Started</Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline">See How Hafya Works</Button>
            </a>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Your health history is scattered — and that costs you.
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Records fragmented across hospitals, clinics, labs, and paper files mean repeated tests,
              incomplete histories at the moment they matter most, and no easy way to move between
              providers with your history intact.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "Repeated medical tests because past results aren't on hand",
              "Delayed diagnoses from incomplete history",
              "Hard to switch clinics or hospitals without losing your record",
              "No single view of medications, labs, and visits over time",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-surface-alt/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">How Hafya works</h2>
          <div className="mt-12 grid sm:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Bring your records together",
                body: "Upload documents, add records yourself, or connect a provider — each entry keeps its source and verification status.",
              },
              {
                icon: Clock,
                title: "See one health timeline",
                body: "Visits, diagnoses, medications, labs, and documents become a single chronological history you can search and filter.",
              },
              {
                icon: Share2,
                title: "Share exactly what's needed",
                body: "Grant a doctor or caregiver access to specific record types for a specific time — and revoke it whenever you choose.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="text-center sm:text-left">
                <div className="mx-auto sm:mx-0 flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-primary-tint">
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="mt-4 font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: HeartPulse,
              title: "Chronic-care companion",
              body: "Track conditions like hypertension and diabetes alongside clinician-defined care plans and medication schedules.",
            },
            {
              icon: Sparkles,
              title: "Document intelligence",
              body: "Photograph a paper prescription or lab report — Hafya drafts the structured entry, you confirm before it's saved.",
            },
            {
              icon: Network,
              title: "Built for interoperability",
              body: "A standards-oriented architecture designed to connect with hospitals, labs, and insurers as partners come online.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="border-y border-border bg-surface-alt/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <ShieldCheck className="size-8 text-primary" />
            <h2 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight">
              Private by design, not by promise.
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Your health information is private. You decide who can access it, for how long, and for
              what purpose — and you can see exactly who has looked at your records and why. Built with
              Kenya&apos;s Data Protection Act and Digital Health Act in mind from day one.
            </p>
            <Link href="/signup" className="mt-6 inline-flex">
              <Button variant="outline">
                Learn about the Privacy Center <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
          <ul className="space-y-4">
            {[
              "Granular sharing — pick exactly which record types, for how long",
              "A full access log — see who viewed your records, and when",
              "Revoke any access instantly, no questions asked",
              "Export your full record at any time",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-4 text-sm">
                <Lock className="size-4 shrink-0 mt-0.5 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* For providers */}
      <section id="providers" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Built to grow into an ecosystem</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto leading-relaxed">
          Hospitals, clinics, laboratories, and insurers will connect to Hafya as authorized partners —
          never gaining automatic access to a patient&apos;s full record, only what the patient explicitly
          shares.
        </p>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bring your health record together.</h2>
          <p className="mt-3 text-muted">Free to start. Your data, your control.</p>
          <Link href="/signup" className="mt-6 inline-flex">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-muted text-center">
            © {new Date().getFullYear()} Hafya. Synthetic demo environment — not for real patient data.
          </p>
        </div>
      </footer>
    </div>
  );
}
