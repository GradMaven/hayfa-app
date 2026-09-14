// StorageProvider abstraction (§45). Documents are never stored as DB blobs —
// only the storageKey + metadata live in Postgres. Swapping S3 for another
// S3-compatible provider (DigitalOcean Spaces, Cloudflare R2, real AWS) means
// changing env vars only, never call sites.

export interface StoredObjectMeta {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
}

export interface StorageProvider {
  put(params: { key: string; body: Buffer; mimeType: string }): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET || "hafya-documents-dev";
    this.client = new S3Client({
      region: process.env.STORAGE_REGION || "us-east-1",
      endpoint: process.env.STORAGE_ENDPOINT,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async put({ key, body, mimeType }: { key: string; body: Buffer; mimeType: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        // Never public: every document is fetched via a short-lived signed
        // URL, never a permanent public link (§45).
      })
    );
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!instance) instance = new S3StorageProvider();
  return instance;
}

export function buildDocumentStorageKey(patientId: string, documentId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return `patients/${patientId}/documents/${documentId}/${safeName}`;
}
