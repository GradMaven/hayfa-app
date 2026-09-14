import { db } from "@/lib/db";
import type { HealthEventType } from "@prisma/client";

// Writes the thin timeline-index row alongside a clinical record write. See
// docs/database-architecture.md — HealthEvent is a generated index, not a
// second source of truth, so this is the only place that ever writes one.
export async function recordHealthEvent(params: {
  patientId: string;
  type: HealthEventType;
  title: string;
  description?: string;
  eventDate: Date;
  sourceEntityType: string;
  sourceEntityId: string;
}): Promise<void> {
  await db.healthEvent.create({
    data: {
      patientId: params.patientId,
      type: params.type,
      title: params.title,
      description: params.description,
      eventDate: params.eventDate,
      sourceEntityType: params.sourceEntityType,
      sourceEntityId: params.sourceEntityId,
    },
  });
}
