"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, ScanText, Check, Pencil, X as XIcon, Sparkles, ShieldOff } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";
import { featureFlags } from "@/lib/feature-flags";

export interface DocumentRecord {
  id: string;
  documentType: string;
  title: string;
  providerName: string | null;
  documentDate: string | null;
  uploadedAt: string;
  source: string;
  verificationStatus: string;
  ocrStatus: "NOT_APPLICABLE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CONFIRMED";
  tags: string[];
}

interface OcrField {
  label: string;
  value: string;
  confidence: number;
}
interface OcrResult {
  documentType: string | null;
  fields: OcrField[];
  overallConfidence: number;
}

interface AISummaryResponse {
  text: string;
  disclaimer: string;
  safetyFlag: "NONE" | "SUGGEST_PROFESSIONAL_REVIEW" | "URGENT_CARE_RECOMMENDED";
}

const VERIFICATION_LABEL: Record<string, { label: string; tone: "neutral" | "success" | "info" | "warning" }> = {
  UNVERIFIED: { label: "Patient entered", tone: "neutral" },
  PENDING: { label: "Pending verification", tone: "warning" },
  PROVIDER_VERIFIED: { label: "Provider verified", tone: "success" },
  AI_EXTRACTED_UNCONFIRMED: { label: "AI draft — unconfirmed", tone: "warning" },
  PATIENT_CONFIRMED: { label: "Confirmed by you", tone: "info" },
};

export function DocumentCard({ doc }: { doc: DocumentRecord }) {
  const queryClient = useQueryClient();
  const [showOcr, setShowOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  const runOcrMutation = useMutation({
    mutationFn: () => api.post<{ ocrExtractedData: OcrResult }>(`/api/v1/documents/${doc.id}/ocr`),
    onSuccess: (res) => {
      setOcrResult(res.ocrExtractedData);
      setEditedFields(Object.fromEntries(res.ocrExtractedData.fields.map((f) => [f.label, f.value])));
      setShowOcr(true);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (createAs: "LAB_RESULT" | "NONE") =>
      api.post(`/api/v1/documents/${doc.id}/ocr/confirm`, { createAs, fields: editedFields }),
    onSuccess: () => {
      setShowOcr(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["labs"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/documents/${doc.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const [summary, setSummary] = useState<AISummaryResponse | null>(null);
  const summarizeMutation = useMutation({
    mutationFn: () => api.post<AISummaryResponse>("/api/v1/ai/summarize-document", { documentId: doc.id }),
    onSuccess: setSummary,
  });

  async function handleDownload() {
    const { url } = await api.get<{ url: string }>(`/api/v1/documents/${doc.id}/download`);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const verification = VERIFICATION_LABEL[doc.verificationStatus] ?? VERIFICATION_LABEL.UNVERIFIED;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{doc.title}</p>
            <Badge tone="neutral">{doc.documentType.replace(/_/g, " ").toLowerCase()}</Badge>
            <Badge tone={verification.tone}>{verification.label}</Badge>
          </div>
          <p className="text-xs text-muted-2 mt-1">
            {doc.providerName ? `${doc.providerName} · ` : ""}
            {doc.documentDate ? formatDate(doc.documentDate) : `Uploaded ${formatDate(doc.uploadedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {featureFlags.ocr && (doc.ocrStatus === "PENDING" || doc.ocrStatus === "FAILED") && (
            <Button size="sm" variant="outline" onClick={() => runOcrMutation.mutate()} loading={runOcrMutation.isPending}>
              <ScanText className="size-4" /> Extract data
            </Button>
          )}
          {doc.ocrStatus === "COMPLETED" && !showOcr && (
            <Button size="sm" variant="outline" onClick={() => runOcrMutation.mutate()}>
              <ScanText className="size-4" /> Review draft
            </Button>
          )}
          {featureFlags.ai && (doc.ocrStatus === "COMPLETED" || doc.ocrStatus === "CONFIRMED") && !summary && (
            <Button size="sm" variant="outline" onClick={() => summarizeMutation.mutate()} loading={summarizeMutation.isPending}>
              <Sparkles className="size-4" /> Summarize
            </Button>
          )}
          <button onClick={handleDownload} className="text-muted-2 hover:text-foreground p-2" aria-label={`Download ${doc.title}`}>
            <Download className="size-4" />
          </button>
          <button onClick={() => deleteMutation.mutate()} className="text-muted-2 hover:text-danger p-2" aria-label={`Delete ${doc.title}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {summarizeMutation.isError && (
        <Alert tone="danger" className="mt-4">
          {summarizeMutation.error instanceof ApiClientError ? summarizeMutation.error.message : "This document summary is temporarily unavailable."}
        </Alert>
      )}

      {summary && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-alt/50 p-4">
          {summary.safetyFlag === "URGENT_CARE_RECOMMENDED" && (
            <Alert tone="danger" title="Consider seeking care soon" className="mb-3">
              Something in this document may need prompt attention. This is not a diagnosis — please contact a
              healthcare provider.
            </Alert>
          )}
          <p className="text-sm text-foreground leading-relaxed">{summary.text}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-2 mt-2">
            <ShieldOff className="size-3.5" /> AI-generated · {summary.disclaimer}
          </div>
        </div>
      )}

      {showOcr && ocrResult && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-alt/50 p-4">
          <p className="text-sm font-medium mb-1">Review extracted data</p>
          <p className="text-xs text-muted mb-3">
            AI extraction confidence: {Math.round(ocrResult.overallConfidence * 100)}%. Review and edit before this becomes part
            of your health record — nothing is saved automatically.
          </p>
          <div className="space-y-3">
            {ocrResult.fields.map((f) => (
              <div key={f.label} className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center">
                <span className="text-sm text-muted">{f.label}</span>
                <Input
                  value={editedFields[f.label] ?? ""}
                  onChange={(e) => setEditedFields((prev) => ({ ...prev, [f.label]: e.target.value }))}
                />
                <span className="text-xs text-muted-2 w-10 text-right">{Math.round(f.confidence * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" onClick={() => confirmMutation.mutate("LAB_RESULT")} loading={confirmMutation.isPending}>
              <Check className="size-4" /> Confirm as lab result
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowOcr(false)}>
              <Pencil className="size-4" /> Keep editing later
            </Button>
            <Button size="sm" variant="ghost" onClick={() => confirmMutation.mutate("NONE")} loading={confirmMutation.isPending}>
              <XIcon className="size-4" /> Reject
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
