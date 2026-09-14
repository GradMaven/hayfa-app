"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, MessageCircleQuestion, ShieldOff } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { featureFlags } from "@/lib/feature-flags";

interface AIResponse {
  text: string;
  sources: { type: string; id: string; label: string }[];
  generatedAt: string;
  safetyFlag: "NONE" | "SUGGEST_PROFESSIONAL_REVIEW" | "URGENT_CARE_RECOMMENDED";
  disclaimer: string;
}

export default function InsightsPage() {
  if (!featureFlags.ai) {
    return (
      <div>
        <PageHeader title="Insights" description="AI-powered summaries of your health information." />
        <Alert tone="info" title="AI features are turned off">
          Insights are currently disabled for this environment. No health data is sent to any AI provider while
          this is off.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Insights" description="AI helps you understand your records — it never diagnoses or replaces your clinician." />
      <div className="grid md:grid-cols-2 gap-5">
        <InsightCard
          icon={Sparkles}
          title="Explain my health"
          description="A plain-language summary of your recorded history over the last 6 months."
          endpoint="/api/v1/ai/timeline-summary"
        />
        <InsightCard
          icon={MessageCircleQuestion}
          title="Prepare for your visit"
          description="Questions worth asking your doctor, based on your recent records."
          endpoint="/api/v1/ai/prepare-visit"
        />
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  description,
  endpoint,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  endpoint: string;
}) {
  const [result, setResult] = useState<AIResponse | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post<AIResponse>(endpoint, {}),
    onSuccess: setResult,
  });

  return (
    <Card>
      <CardHeader>
        <Icon className="size-5 text-primary" />
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!result ? (
          <div className="space-y-3">
            <Button variant="outline" onClick={() => mutation.mutate()} loading={mutation.isPending}>Generate</Button>
            {mutation.isError && (
              <Alert tone="danger">
                {mutation.error instanceof ApiClientError ? mutation.error.message : "Something went wrong. Please try again."}
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {result.safetyFlag === "URGENT_CARE_RECOMMENDED" && (
              <Alert tone="danger" title="Consider seeking care soon">
                Something in your records may need prompt attention. This is not a diagnosis — please contact a
                healthcare provider.
              </Alert>
            )}
            <p className="text-sm text-foreground leading-relaxed">{result.text}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-2">
              <ShieldOff className="size-3.5" />
              AI-generated · {result.disclaimer}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>Generate again</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
