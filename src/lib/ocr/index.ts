// OCRProvider abstraction (§18). CRITICAL invariant: OCR output is always a
// draft. Nothing in this module — or any caller of it — may write extracted
// values directly into a clinical record (Medication/LabResult/etc). The
// result always lands as Document.ocrExtractedData + ocrStatus="COMPLETED",
// and a structured record is only created after a human calls the confirm
// endpoint, which copies user-reviewed (possibly edited) values across.

export interface OcrExtractedField {
  label: string;
  value: string;
  confidence: number; // 0–1
}

export interface OcrResult {
  documentType: string | null;
  fields: OcrExtractedField[];
  rawText: string;
  overallConfidence: number;
}

export interface OCRProvider {
  extract(params: { buffer: Buffer; mimeType: string }): Promise<OcrResult>;
}

// Deterministic mock: real OCR/vendor wiring is a Phase 2 item (§109 scope
// note in docs/discovery-report.md). This lets the confirm-before-write UX
// (§18) be built and tested end-to-end without a vendor key.
class MockOCRProvider implements OCRProvider {
  async extract(): Promise<OcrResult> {
    return {
      documentType: "LAB_REPORT",
      rawText:
        "MOCK OCR OUTPUT — no vendor configured. Replace lib/ocr's provider with a real " +
        "implementation (see OCRProvider) to extract real text from uploaded documents.",
      fields: [
        { label: "Test Name", value: "HbA1c", confidence: 0.94 },
        { label: "Result", value: "7.4", confidence: 0.91 },
        { label: "Unit", value: "%", confidence: 0.97 },
        { label: "Reference Range", value: "<5.7%", confidence: 0.88 },
      ],
      overallConfidence: 0.92,
    };
  }
}

let instance: OCRProvider | null = null;

export function getOcrProvider(): OCRProvider {
  if (!instance) instance = new MockOCRProvider();
  return instance;
}
