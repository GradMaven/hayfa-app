"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/health/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { UploadForm } from "./upload-form";
import { DocumentCard, type DocumentRecord } from "./document-card";

export default function DocumentsPage() {
  const [showUpload, setShowUpload] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<DocumentRecord[]>("/api/v1/documents"),
  });

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Prescriptions, lab reports, discharge summaries, and more — securely stored, never publicly accessible."
        action={
          <Button onClick={() => setShowUpload((s) => !s)}>
            {showUpload ? <X className="size-4" /> : <Plus className="size-4" />}
            {showUpload ? "Cancel" : "Upload document"}
          </Button>
        }
      />

      {showUpload && (
        <Card className="mb-6">
          <CardContent>
            <UploadForm onDone={() => setShowUpload(false)} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload a prescription, lab report, or scanned paper record to get started."
          action={<Button variant="outline" onClick={() => setShowUpload(true)}>Upload document</Button>}
        />
      ) : (
        <div className="space-y-3">
          {data.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
