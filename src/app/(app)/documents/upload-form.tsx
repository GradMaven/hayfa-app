"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { DOCUMENT_TYPES } from "@/lib/validation/documents";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function UploadForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("OTHER");
  const [title, setTitle] = useState("");
  const [providerName, setProviderName] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file to upload.");
      const form = new FormData();
      form.set("file", file);
      form.set("documentType", documentType);
      form.set("title", title || file.name);
      if (providerName) form.set("providerName", providerName);
      if (documentDate) form.set("documentDate", documentDate);
      return api.post("/api/v1/documents", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFileError(file ? null : "Select a file to upload.");
        if (file) uploadMutation.mutate();
      }}
      className="space-y-4"
    >
      {uploadMutation.error && (
        <Alert tone="danger">{uploadMutation.error instanceof ApiClientError ? uploadMutation.error.message : "Upload failed. Please try again."}</Alert>
      )}

      <div>
        <Label htmlFor="file">File</Label>
        <label
          htmlFor="file"
          className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-surface-alt/50 px-4 py-8 text-center cursor-pointer hover:border-primary/50"
        >
          <UploadCloud className="size-6 text-muted" />
          <span className="text-sm text-muted">{file ? file.name : "PDF, JPEG, PNG, or WebP — up to 20MB"}</span>
          <input
            id="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <FieldError>{fileError ?? undefined}</FieldError>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="documentType">Document type</Label>
          <Select id="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="Defaults to file name" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="providerName">Provider / facility</Label>
          <Input id="providerName" value={providerName} onChange={(e) => setProviderName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="documentDate">Document date</Label>
          <Input id="documentDate" type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
        </div>
      </div>

      <Button type="submit" loading={uploadMutation.isPending}>Upload</Button>
    </form>
  );
}
