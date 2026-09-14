-- CreateEnum
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('APPLIED', 'REJECTED');

-- AlterEnum
ALTER TYPE "VerificationStatus" ADD VALUE 'PATIENT_CORRECTED';

-- CreateTable
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousValues" JSONB NOT NULL,
    "correctedValues" JSONB NOT NULL,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'APPLIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorrectionRequest_patientId_idx" ON "CorrectionRequest"("patientId");

-- CreateIndex
CREATE INDEX "CorrectionRequest_resourceType_resourceId_idx" ON "CorrectionRequest"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
