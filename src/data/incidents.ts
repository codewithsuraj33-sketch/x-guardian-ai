// ─────────────────────────────────────────────
// X-Guardian — Mock Incident Data
// ─────────────────────────────────────────────

import { Incident, RiskLevel, IncidentStatus } from '../types';

export const initialIncidents: Incident[] = [
  {
    incidentId: 'INC-0001',
    workerId: 'W-1002',
    cameraId: 'CAM-02',
    zoneId: 'ZONE-02',
    violation: 'Helmet Missing',
    severity: RiskLevel.MEDIUM,
    timestamp: new Date(Date.now() - 12 * 60_000).toISOString(),
    status: IncidentStatus.OPEN,
  },
  {
    incidentId: 'INC-0002',
    workerId: 'W-1004',
    cameraId: 'CAM-04',
    zoneId: 'ZONE-04',
    violation: 'Gloves Missing',
    severity: RiskLevel.MEDIUM,
    timestamp: new Date(Date.now() - 25 * 60_000).toISOString(),
    status: IncidentStatus.ACKNOWLEDGED,
  },
  {
    incidentId: 'INC-0003',
    workerId: 'W-1005',
    cameraId: 'CAM-05',
    zoneId: 'ZONE-05',
    violation: 'Restricted Zone Entry — Vest Missing',
    severity: RiskLevel.HIGH,
    timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    status: IncidentStatus.OPEN,
  },
  {
    incidentId: 'INC-0004',
    workerId: 'W-1001',
    cameraId: 'CAM-05',
    zoneId: 'ZONE-05',
    violation: 'Restricted Zone Entry',
    severity: RiskLevel.HIGH,
    timestamp: new Date(Date.now() - 45 * 60_000).toISOString(),
    status: IncidentStatus.RESOLVED,
  },
  {
    incidentId: 'INC-0005',
    workerId: 'W-1003',
    cameraId: 'CAM-03',
    zoneId: 'ZONE-03',
    violation: 'Gloves Missing — Welding Zone',
    severity: RiskLevel.HIGH,
    timestamp: new Date(Date.now() - 8 * 60_000).toISOString(),
    status: IncidentStatus.OPEN,
  },
];
