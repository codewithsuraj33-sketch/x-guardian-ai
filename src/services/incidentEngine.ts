// ─────────────────────────────────────────────
// X-Guardian — Incident Engine
// Generates incidents from safety violations.
// ─────────────────────────────────────────────

import { Worker, Zone, Incident, RiskLevel, IncidentStatus } from '../types';
import { assessWorkerSafety } from './safetyEngine';

let incidentCounter = 100;

/** Generate a unique incident ID */
function nextIncidentId(): string {
  incidentCounter += 1;
  return `INC-${String(incidentCounter).padStart(4, '0')}`;
}

/**
 * Check a worker's current state and generate new incidents
 * for any violations not already tracked.
 */
export function generateIncidents(
  worker: Worker,
  zone: Zone,
  existingIncidents: Incident[]
): Incident[] {
  const assessment = assessWorkerSafety(worker, zone);

  if (assessment.violations.length === 0) return [];

  // Only generate incidents for violations not already OPEN for this worker
  const openViolations = new Set(
    existingIncidents
      .filter((i) => i.workerId === worker.id && i.status === IncidentStatus.OPEN)
      .map((i) => i.violation)
  );

  const newIncidents: Incident[] = [];

  for (const violation of assessment.violations) {
    if (!openViolations.has(violation)) {
      newIncidents.push({
        incidentId: nextIncidentId(),
        workerId: worker.id,
        cameraId: zone.cameraId,
        zoneId: zone.id,
        violation,
        severity: assessment.riskLevel >= RiskLevel.HIGH ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        timestamp: new Date().toISOString(),
        status: IncidentStatus.OPEN,
      });
    }
  }

  return newIncidents;
}
