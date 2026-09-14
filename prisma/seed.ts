// Synthetic demo data only — never real patient data (§73). Every seeded
// name, result, and document is fictional and clearly scoped to a @hafya.demo
// email domain so it's obvious in any environment this ran against.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding synthetic demo data...");

  const demoPasswordHash = await bcrypt.hash("DemoPass123!", 12);

  // ── Demo patient: Amina Otieno ──────────────────────────────────────
  const patientUser = await db.user.upsert({
    where: { email: "amina.demo@hafya.demo" },
    update: {},
    create: {
      email: "amina.demo@hafya.demo",
      name: "Amina Otieno",
      passwordHash: demoPasswordHash,
      role: "PATIENT",
      emailVerifiedAt: new Date(),
    },
  });

  const patient = await db.patientProfile.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      fullName: "Amina Otieno",
      dateOfBirth: new Date("1988-04-12"),
      biologicalSex: "FEMALE",
      country: "Kenya",
      county: "Nairobi",
      bloodType: "O_POS",
      emergencyContactName: "Peter Otieno",
      emergencyContactPhone: "+254700000001",
      insuranceProvider: "NHIF",
      insuranceMemberId: "NHIF-DEMO-00123",
      emergencyAccessEnabled: true,
    },
  });

  // ── Demo organization + provider: Dr. Jane Mwangi ───────────────────
  const hospital = await db.organization.upsert({
    where: { id: "demo-org-nairobi-hospital" },
    update: {},
    create: {
      id: "demo-org-nairobi-hospital",
      name: "Nairobi Hospital (Demo)",
      type: "HOSPITAL",
      county: "Nairobi",
      verified: true,
    },
  });

  const providerUser = await db.user.upsert({
    where: { email: "dr.mwangi.demo@hafya.demo" },
    update: {},
    create: {
      email: "dr.mwangi.demo@hafya.demo",
      name: "Dr. Jane Mwangi",
      passwordHash: demoPasswordHash,
      role: "PROVIDER",
      emailVerifiedAt: new Date(),
    },
  });

  const provider = await db.healthcareProvider.upsert({
    where: { userId: providerUser.id },
    update: {},
    create: {
      userId: providerUser.id,
      organizationId: hospital.id,
      fullName: "Dr. Jane Mwangi",
      specialty: "Internal Medicine",
      licenseNumber: "KMPDC-DEMO-4821",
      verificationStatus: "VERIFIED",
    },
  });

  // ── Demo caregiver: Peter Otieno (spouse) ───────────────────────────
  const caregiverUser = await db.user.upsert({
    where: { email: "peter.demo@hafya.demo" },
    update: {},
    create: {
      email: "peter.demo@hafya.demo",
      name: "Peter Otieno",
      passwordHash: demoPasswordHash,
      role: "CAREGIVER",
      emailVerifiedAt: new Date(),
    },
  });

  await db.caregiverLink.upsert({
    where: { patientId_caregiverUserId: { patientId: patient.id, caregiverUserId: caregiverUser.id } },
    update: {},
    create: {
      patientId: patient.id,
      caregiverUserId: caregiverUser.id,
      relationship: "spouse",
      permissions: ["MEDICATIONS", "APPOINTMENTS", "ALLERGIES"],
      status: "ACTIVE",
    },
  });

  // ── Condition: Hypertension ──────────────────────────────────────────
  const hypertension = await db.condition.create({
    data: {
      patientId: patient.id,
      name: "Hypertension",
      category: "hypertension",
      dateDiagnosed: new Date("2026-08-10"),
      status: "MANAGED",
      severity: "MODERATE",
      providerId: provider.id,
      source: "PROVIDER_ENTERED",
      verificationStatus: "PROVIDER_VERIFIED",
    },
  });
  await db.healthEvent.create({
    data: {
      patientId: patient.id,
      type: "DIAGNOSIS",
      title: "Diagnosed: Hypertension",
      eventDate: hypertension.dateDiagnosed!,
      sourceEntityType: "Condition",
      sourceEntityId: hypertension.id,
    },
  });

  // ── Medication: Amlodipine ────────────────────────────────────────────
  const medication = await db.medication.create({
    data: {
      patientId: patient.id,
      name: "Amlodipine",
      dose: "5mg",
      frequency: "Once daily",
      route: "Oral",
      startDate: new Date("2026-08-10"),
      prescriberId: provider.id,
      purpose: "Blood pressure control",
      relatedConditionId: hypertension.id,
      status: "ACTIVE",
      source: "PROVIDER_ENTERED",
      verificationStatus: "PROVIDER_VERIFIED",
    },
  });
  await db.healthEvent.create({
    data: {
      patientId: patient.id,
      type: "MEDICATION",
      title: "Started: Amlodipine 5mg",
      eventDate: medication.startDate!,
      sourceEntityType: "Medication",
      sourceEntityId: medication.id,
    },
  });

  await db.carePlan.create({
    data: {
      patientId: patient.id,
      conditionId: hypertension.id,
      providerId: provider.id,
      title: "Hypertension management",
      goal: "Monitor blood pressure daily; follow up in 6 weeks; maintain sodium-reduced diet.",
      status: "ACTIVE",
    },
  });

  // ── Lab results: HbA1c trend ──────────────────────────────────────────
  const labPoints: [string, string][] = [
    ["2026-01-15", "8.2"],
    ["2026-04-10", "7.8"],
    ["2026-07-22", "7.4"],
  ];
  for (const [date, value] of labPoints) {
    const lab = await db.labResult.create({
      data: {
        patientId: patient.id,
        testName: "HbA1c",
        resultValue: value,
        unit: "%",
        referenceRange: "<5.7%",
        flag: "HIGH",
        testDate: new Date(date),
        laboratoryName: "Nairobi Hospital Lab (Demo)",
        source: "LAB_INTEGRATION",
        verificationStatus: "PROVIDER_VERIFIED",
      },
    });
    await db.healthEvent.create({
      data: {
        patientId: patient.id,
        type: "LAB",
        title: `Lab result: HbA1c ${value}%`,
        eventDate: lab.testDate,
        sourceEntityType: "LabResult",
        sourceEntityId: lab.id,
      },
    });
  }

  // ── Vitals: blood pressure trend ─────────────────────────────────────
  const vitalPoints: [string, number, number][] = [
    ["2026-08-10", 148, 94],
    ["2026-08-24", 142, 90],
    ["2026-09-07", 134, 86],
  ];
  for (const [date, sys, dia] of vitalPoints) {
    await db.vital.create({
      data: {
        patientId: patient.id,
        type: "BLOOD_PRESSURE",
        value: sys,
        secondaryValue: dia,
        unit: "mmHg",
        recordedAt: new Date(date),
        source: "PATIENT_ENTERED",
      },
    });
  }

  // ── Allergy ───────────────────────────────────────────────────────────
  const allergy = await db.allergy.create({
    data: {
      patientId: patient.id,
      allergen: "Penicillin",
      reaction: "Skin rash",
      severity: "MODERATE",
      notedDate: new Date("2015-03-01"),
      source: "PATIENT_ENTERED",
    },
  });
  void allergy;

  // ── Immunization ──────────────────────────────────────────────────────
  const immunization = await db.immunization.create({
    data: {
      patientId: patient.id,
      vaccineName: "Tetanus-Diphtheria (Td)",
      administeredDate: new Date("2026-06-01"),
      providerName: "Nairobi Hospital (Demo)",
      source: "PROVIDER_ENTERED",
      verificationStatus: "PROVIDER_VERIFIED",
    },
  });
  await db.healthEvent.create({
    data: {
      patientId: patient.id,
      type: "IMMUNIZATION",
      title: "Immunization: Tetanus-Diphtheria (Td)",
      eventDate: immunization.administeredDate,
      sourceEntityType: "Immunization",
      sourceEntityId: immunization.id,
    },
  });

  // ── Appointment ───────────────────────────────────────────────────────
  const appointment = await db.appointment.create({
    data: {
      patientId: patient.id,
      providerId: provider.id,
      scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      reason: "Hypertension follow-up",
      location: "Nairobi Hospital, Outpatient Clinic 2",
      status: "SCHEDULED",
    },
  });
  await db.healthEvent.create({
    data: {
      patientId: patient.id,
      type: "APPOINTMENT",
      title: "Upcoming: Hypertension follow-up",
      eventDate: appointment.scheduledAt,
      sourceEntityType: "Appointment",
      sourceEntityId: appointment.id,
    },
  });

  // ── Consent: Dr. Mwangi has 30-day access to diabetes-related records ──
  await db.consent.create({
    data: {
      patientId: patient.id,
      recipientType: "PROVIDER",
      recipientUserId: providerUser.id,
      recipientLabel: "Dr. Jane Mwangi",
      purpose: "Hypertension consultation",
      dataScopes: ["MEDICATIONS", "LAB_RESULTS", "CONDITIONS", "VITALS"],
      duration: "DAYS_30",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  console.log("Seed complete.");
  console.log("Demo logins (password: DemoPass123!):");
  console.log("  Patient:   amina.demo@hafya.demo");
  console.log("  Provider:  dr.mwangi.demo@hafya.demo");
  console.log("  Caregiver: peter.demo@hafya.demo");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
