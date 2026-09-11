// ─────────────────────────────────────────────
// X-Guardian — Mock Zone Data
// ─────────────────────────────────────────────

import { Zone, RiskLevel } from '../types';
import { ZONE_COLORS } from '../utils/constants';

export const initialZones: Zone[] = [
  {
    id: 'ZONE-01',
    name: 'Entry',
    cameraId: 'CAM-01',
    safetyStatus: RiskLevel.LOW,
    workerCount: 0,
    description: 'Main entry point and check-in area for all factory personnel.',
    color: ZONE_COLORS['ZONE-01'],
    isRestricted: false,
  },
  {
    id: 'ZONE-02',
    name: 'Assembly',
    cameraId: 'CAM-02',
    safetyStatus: RiskLevel.LOW,
    workerCount: 0,
    description: 'Primary assembly line for component manufacturing and quality control.',
    color: ZONE_COLORS['ZONE-02'],
    isRestricted: false,
  },
  {
    id: 'ZONE-03',
    name: 'Welding',
    cameraId: 'CAM-03',
    safetyStatus: RiskLevel.MEDIUM,
    workerCount: 0,
    description: 'High-temperature welding operations. Full PPE required at all times.',
    color: ZONE_COLORS['ZONE-03'],
    isRestricted: false,
  },
  {
    id: 'ZONE-04',
    name: 'Storage',
    cameraId: 'CAM-04',
    safetyStatus: RiskLevel.LOW,
    workerCount: 0,
    description: 'Raw materials and finished goods storage area.',
    color: ZONE_COLORS['ZONE-04'],
    isRestricted: false,
  },
  {
    id: 'ZONE-05',
    name: 'Restricted Zone',
    cameraId: 'CAM-05',
    safetyStatus: RiskLevel.HIGH,
    workerCount: 0,
    description: 'Authorized personnel only. High-risk operations and hazardous materials.',
    color: ZONE_COLORS['ZONE-05'],
    isRestricted: true,
  },
];
