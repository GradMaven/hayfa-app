-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'CAREGIVER', 'PROVIDER', 'PROVIDER_ADMIN', 'ORG_ADMIN', 'INTEGRATION_ADMIN', 'PLATFORM_SUPPORT', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CaregiverLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'CLINIC', 'LABORATORY', 'PHARMACY', 'INSURER', 'NGO', 'EMPLOYER', 'COUNTY_PROGRAM');

-- CreateEnum
CREATE TYPE "ProviderVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('PATIENT_ENTERED', 'PROVIDER_ENTERED', 'HOSPITAL_INTEGRATION', 'LAB_INTEGRATION', 'INSURANCE_INTEGRATION', 'WEARABLE', 'OCR', 'IMPORTED_DOCUMENT', 'API');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'PROVIDER_VERIFIED', 'AI_EXTRACTED_UNCONFIRMED', 'PATIENT_CONFIRMED');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('ACTIVE', 'MANAGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ConditionSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCONTINUED', 'PAUSED');

-- CreateEnum
CREATE TYPE "LabResultFlag" AS ENUM ('NORMAL', 'LOW', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VitalType" AS ENUM ('BLOOD_PRESSURE', 'BLOOD_GLUCOSE', 'WEIGHT', 'HEART_RATE', 'TEMPERATURE', 'OXYGEN_SATURATION', 'HEIGHT', 'BMI');

-- CreateEnum
CREATE TYPE "AllergySeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'LAB_REPORT', 'DISCHARGE_SUMMARY', 'IMAGING_REPORT', 'INVOICE', 'REFERRAL', 'VACCINATION_CARD', 'MEDICAL_CERTIFICATE', 'INSURANCE_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentSensitivity" AS ENUM ('STANDARD', 'SENSITIVE');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CarePlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "HealthEventType" AS ENUM ('ENCOUNTER', 'DIAGNOSIS', 'MEDICATION', 'LAB', 'VITAL', 'IMMUNIZATION', 'PROCEDURE', 'DOCUMENT', 'APPOINTMENT', 'CARE_PLAN');

-- CreateEnum
CREATE TYPE "ConsentRecipientType" AS ENUM ('PROVIDER', 'CAREGIVER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "ConsentDuration" AS ENUM ('ONE_TIME', 'HOURS_24', 'DAYS_7', 'DAYS_30', 'UNTIL_REVOKED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EmergencyAccessStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DataAccessAction" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT');

-- CreateEnum
CREATE TYPE "AccessResult" AS ENUM ('ALLOWED', 'DENIED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT', 'MEDICATION', 'CONSENT', 'ACCESS', 'DOCUMENT_PROCESSING', 'LAB_RESULT', 'CARE_PLAN', 'SECURITY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'USSD', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('HOSPITAL', 'LABORATORY', 'PHARMACY', 'INSURANCE', 'WEARABLE');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PREMIUM', 'PROVIDER', 'ORGANIZATION', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "biologicalSex" "BiologicalSex" NOT NULL DEFAULT 'UNSPECIFIED',
    "country" TEXT NOT NULL DEFAULT 'Kenya',
    "county" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "bloodType" "BloodType" NOT NULL DEFAULT 'UNKNOWN',
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "primaryCareProviderId" TEXT,
    "insuranceProvider" TEXT,
    "insuranceMemberId" TEXT,
    "emergencyAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverLink" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caregiverUserId" TEXT NOT NULL,
    "relationship" TEXT,
    "permissions" TEXT[],
    "status" "CaregiverLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CaregiverLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "county" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "fullName" TEXT NOT NULL,
    "specialty" TEXT,
    "licenseNumber" TEXT,
    "verificationStatus" "ProviderVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT,
    "organizationName" TEXT,
    "encounterDate" TIMESTAMP(3) NOT NULL,
    "encounterType" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "providerId" TEXT,
    "conditionName" TEXT NOT NULL,
    "icdCode" TEXT,
    "diagnosedDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "dateDiagnosed" TIMESTAMP(3),
    "status" "ConditionStatus" NOT NULL DEFAULT 'ACTIVE',
    "severity" "ConditionSeverity",
    "providerId" TEXT,
    "notes" TEXT,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "prescriberId" TEXT,
    "purpose" TEXT,
    "relatedConditionId" TEXT,
    "status" "MedicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationReminder" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "daysOfWeek" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "prescriberId" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "orderedDate" TIMESTAMP(3),
    "providerId" TEXT,
    "laboratoryName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "labTestId" TEXT,
    "testName" TEXT NOT NULL,
    "resultValue" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "flag" "LabResultFlag" NOT NULL DEFAULT 'NORMAL',
    "testDate" TIMESTAMP(3) NOT NULL,
    "providerName" TEXT,
    "laboratoryName" TEXT,
    "documentId" TEXT,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "aiExtractionConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vital" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "VitalType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "secondaryValue" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immunization" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" INTEGER,
    "administeredDate" TIMESTAMP(3) NOT NULL,
    "providerName" TEXT,
    "lotNumber" TEXT,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Immunization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "procedureDate" TIMESTAMP(3) NOT NULL,
    "providerName" TEXT,
    "notes" TEXT,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" "AllergySeverity" NOT NULL DEFAULT 'UNKNOWN',
    "notedDate" TIMESTAMP(3),
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "providerName" TEXT,
    "documentDate" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "source" "DataSourceType" NOT NULL DEFAULT 'PATIENT_ENTERED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "sensitivity" "DocumentSensitivity" NOT NULL DEFAULT 'STANDARD',
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "ocrExtractedData" JSONB,
    "ocrConfidence" DOUBLE PRECISION,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerName" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "location" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "conditionId" TEXT,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "providerId" TEXT,
    "status" "CarePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "HealthEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recipientType" "ConsentRecipientType" NOT NULL,
    "recipientUserId" TEXT,
    "recipientLabel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "dataScopes" TEXT[],
    "duration" "ConsentDuration" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAccess" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "verificationMethod" TEXT,
    "datasetScope" TEXT[] DEFAULT ARRAY['EMERGENCY_SUMMARY']::TEXT[],
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "EmergencyAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAccessLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "consentId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "action" "DataAccessAction" NOT NULL,
    "purpose" TEXT,
    "result" "AccessResult" NOT NULL DEFAULT 'ALLOWED',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "patientId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'INACTIVE',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRecord" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "patientId" TEXT,
    "externalId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "mappedEntityType" TEXT,
    "mappedEntityId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE INDEX "PatientProfile_userId_idx" ON "PatientProfile"("userId");

-- CreateIndex
CREATE INDEX "CaregiverLink_caregiverUserId_idx" ON "CaregiverLink"("caregiverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverLink_patientId_caregiverUserId_key" ON "CaregiverLink"("patientId", "caregiverUserId");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareProvider_userId_key" ON "HealthcareProvider"("userId");

-- CreateIndex
CREATE INDEX "HealthcareProvider_organizationId_idx" ON "HealthcareProvider"("organizationId");

-- CreateIndex
CREATE INDEX "Encounter_patientId_encounterDate_idx" ON "Encounter"("patientId", "encounterDate");

-- CreateIndex
CREATE INDEX "Diagnosis_patientId_diagnosedDate_idx" ON "Diagnosis"("patientId", "diagnosedDate");

-- CreateIndex
CREATE INDEX "Condition_patientId_status_idx" ON "Condition"("patientId", "status");

-- CreateIndex
CREATE INDEX "Medication_patientId_status_idx" ON "Medication"("patientId", "status");

-- CreateIndex
CREATE INDEX "LabResult_patientId_testName_testDate_idx" ON "LabResult"("patientId", "testName", "testDate");

-- CreateIndex
CREATE INDEX "Vital_patientId_type_recordedAt_idx" ON "Vital"("patientId", "type", "recordedAt");

-- CreateIndex
CREATE INDEX "Immunization_patientId_administeredDate_idx" ON "Immunization"("patientId", "administeredDate");

-- CreateIndex
CREATE INDEX "Procedure_patientId_procedureDate_idx" ON "Procedure"("patientId", "procedureDate");

-- CreateIndex
CREATE INDEX "Allergy_patientId_idx" ON "Allergy"("patientId");

-- CreateIndex
CREATE INDEX "Document_patientId_documentType_idx" ON "Document"("patientId", "documentType");

-- CreateIndex
CREATE INDEX "Appointment_patientId_scheduledAt_idx" ON "Appointment"("patientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "CarePlan_patientId_status_idx" ON "CarePlan"("patientId", "status");

-- CreateIndex
CREATE INDEX "HealthEvent_patientId_eventDate_idx" ON "HealthEvent"("patientId", "eventDate");

-- CreateIndex
CREATE INDEX "HealthEvent_patientId_type_idx" ON "HealthEvent"("patientId", "type");

-- CreateIndex
CREATE INDEX "Consent_patientId_status_idx" ON "Consent"("patientId", "status");

-- CreateIndex
CREATE INDEX "Consent_recipientUserId_idx" ON "Consent"("recipientUserId");

-- CreateIndex
CREATE INDEX "EmergencyAccess_patientId_idx" ON "EmergencyAccess"("patientId");

-- CreateIndex
CREATE INDEX "DataAccessLog_patientId_createdAt_idx" ON "DataAccessLog"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_patientId_idx" ON "AuditEvent"("patientId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- CreateIndex
CREATE INDEX "ExternalRecord_integrationId_idx" ON "ExternalRecord"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_primaryCareProviderId_fkey" FOREIGN KEY ("primaryCareProviderId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverLink" ADD CONSTRAINT "CaregiverLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverLink" ADD CONSTRAINT "CaregiverLink_caregiverUserId_fkey" FOREIGN KEY ("caregiverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareProvider" ADD CONSTRAINT "HealthcareProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareProvider" ADD CONSTRAINT "HealthcareProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_prescriberId_fkey" FOREIGN KEY ("prescriberId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_relatedConditionId_fkey" FOREIGN KEY ("relatedConditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationReminder" ADD CONSTRAINT "MedicationReminder_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_prescriberId_fkey" FOREIGN KEY ("prescriberId") REFERENCES "HealthcareProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vital" ADD CONSTRAINT "Vital_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "HealthcareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAccess" ADD CONSTRAINT "EmergencyAccess_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAccess" ADD CONSTRAINT "EmergencyAccess_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAccessLog" ADD CONSTRAINT "DataAccessLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAccessLog" ADD CONSTRAINT "DataAccessLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAccessLog" ADD CONSTRAINT "DataAccessLog_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecord" ADD CONSTRAINT "ExternalRecord_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecord" ADD CONSTRAINT "ExternalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
