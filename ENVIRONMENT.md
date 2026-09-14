# Environment Variables

Copy [`.env.example`](.env.example) to `.env` for local development. Never commit a real `.env`.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, read by Prisma |
| `AUTH_SECRET` | Yes | The AES-256 key used to encrypt MFA (TOTP) secrets at rest — must be a 64-character hex string (32 bytes). Losing or rotating it invalidates every enrolled user's MFA secret (they'd need to re-enroll). Sessions themselves don't use it (they're opaque, hashed tokens — see `docs/security-architecture.md`). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `SESSION_COOKIE_NAME` | No (default `hafya_session`) | Name of the session cookie |
| `SESSION_TTL_DAYS` | No (default `30`) | How long a session stays valid without being revoked |
| `STORAGE_PROVIDER` | No (default `s3`) | Reserved for future non-S3 providers; only S3-compatible is implemented |
| `STORAGE_ENDPOINT` | Yes | S3-compatible endpoint (MinIO locally: `http://localhost:9000`) |
| `STORAGE_REGION` | Yes | S3 region (any string works for MinIO) |
| `STORAGE_BUCKET` | Yes | Bucket for document uploads |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Yes | Credentials for the bucket above |
| `STORAGE_FORCE_PATH_STYLE` | No (default `false`) | Set `true` for MinIO; real AWS S3 should leave this unset/`false` |
| `ENABLE_AI` | No (default `false`) | Gates the `/insights` UI and every `/api/v1/ai/*` route. The mock provider runs regardless of the underlying vendor — see `docs/ai-architecture.md`. |
| `ENABLE_OCR` | No (default `true`) | Gates document-intelligence extraction |
| `ENABLE_WEARABLES` / `ENABLE_SMS` / `ENABLE_USSD` / `ENABLE_ORGANIZATIONS` / `ENABLE_BILLING` | No (default `false`) | Reserved for unbuilt features — flipping these does not currently unlock functionality; they exist so future feature work has a flag to land behind (§82) |
| `ENABLE_PROVIDER_PORTAL` | No (default `true`) | Reserved for the same reason; the current provider experience (`/portal`) is not gated by this flag |
| `AI_PROVIDER` / `AI_API_KEY` | No | Not read by any code path yet — no real AI vendor is wired in this phase |
| `EMAIL_FROM` | No | Display name/address for the mock email logger |
| `EMAIL_PROVIDER` | No (default `console`) | Only `console` is implemented (logs to server stdout) — see `src/lib/notifications/index.ts` |
| `NEXT_PUBLIC_APP_URL` | Yes | Used to build absolute links (e.g. password-reset URLs). `NEXT_PUBLIC_*` vars ARE sent to the browser — never put a secret in one. |
| `NODE_ENV` | Set by tooling | Standard Next.js env |

## Local MinIO bucket setup

`docker compose up -d` starts MinIO but does not create the bucket. Run once after first startup:

```bash
docker exec hafya-app-minio-1 sh -c \
  "mc alias set local http://localhost:9000 hafya_minio hafya_minio_password && \
   mc mb -p local/hafya-documents-dev && mc anonymous set none local/hafya-documents-dev"
```

## Environment separation (§101)

Development, staging, and production must each point at their own `DATABASE_URL` and `STORAGE_BUCKET` — never share a database across environments, and never point a non-production environment at a bucket/database that could contain real patient data once this goes beyond synthetic demo data.
