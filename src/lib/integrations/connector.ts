// HealthDataConnector abstraction (§36, §87). The point of this interface is
// that a real hospital/lab/insurer integration can be dropped in later by
// implementing it — nothing else in the app should change. MockHospitalConnector
// exists purely to prove the interface is exercised end-to-end (ExternalRecord
// rows land in the DB and can be mapped into the canonical model); it is not
// wired into any UI in this phase.

export interface ExternalPatient {
  externalId: string;
  fullName: string;
  dateOfBirth: string;
}

export interface ExternalEncounter {
  externalId: string;
  patientExternalId: string;
  date: string;
  type: string;
  reason?: string;
}

export interface ExternalLabResult {
  externalId: string;
  patientExternalId: string;
  testName: string;
  value: string;
  unit?: string;
  date: string;
}

export interface ExternalMedication {
  externalId: string;
  patientExternalId: string;
  name: string;
  dose?: string;
}

export interface ExternalDocument {
  externalId: string;
  patientExternalId: string;
  title: string;
  url: string;
}

export interface HealthDataConnector {
  authenticate(): Promise<void>;
  fetchPatients(): Promise<ExternalPatient[]>;
  fetchEncounters(): Promise<ExternalEncounter[]>;
  fetchLabs(): Promise<ExternalLabResult[]>;
  fetchMedications(): Promise<ExternalMedication[]>;
  fetchDocuments(): Promise<ExternalDocument[]>;
}

export class MockHospitalConnector implements HealthDataConnector {
  async authenticate(): Promise<void> {
    // No-op: a real connector would exchange credentials for an access token.
  }
  async fetchPatients(): Promise<ExternalPatient[]> {
    return [];
  }
  async fetchEncounters(): Promise<ExternalEncounter[]> {
    return [];
  }
  async fetchLabs(): Promise<ExternalLabResult[]> {
    return [];
  }
  async fetchMedications(): Promise<ExternalMedication[]> {
    return [];
  }
  async fetchDocuments(): Promise<ExternalDocument[]> {
    return [];
  }
}
