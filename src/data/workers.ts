// ─────────────────────────────────────────────
// X-Guardian — Mock Worker Data
// ─────────────────────────────────────────────

import { Worker, RiskLevel, WorkerStatus } from '../types';

export const initialWorkers: Worker[] = [
  {
    id: 'W-1001',
    name: 'Arjun Mehta',
    zoneId: 'ZONE-01',
    trackerId: 'TRK-4401',
    ppe: { helmet: true, vest: true, gloves: true, shoes: true },
    riskLevel: RiskLevel.LOW,
    riskScore: 0,
    status: WorkerStatus.ACTIVE,
    violations: [],
  },
  {
    id: 'W-1002',
    name: 'Priya Sharma',
    zoneId: 'ZONE-02',
    trackerId: 'TRK-4402',
    ppe: { helmet: false, vest: true, gloves: true, shoes: true },
    riskLevel: RiskLevel.MEDIUM,
    riskScore: 30,
    status: WorkerStatus.ACTIVE,
    violations: ['Helmet Missing'],
  },
  {
    id: 'W-1003',
    name: 'Ravi Kumar',
    zoneId: 'ZONE-03',
    trackerId: 'TRK-4403',
    ppe: { helmet: true, vest: true, gloves: false, shoes: true },
    riskLevel: RiskLevel.MEDIUM,
    riskScore: 20,
    status: WorkerStatus.ACTIVE,
    violations: ['Gloves Missing'],
  },
  {
    id: 'W-1004',
    name: 'Neha Patel',
    zoneId: 'ZONE-04',
    trackerId: 'TRK-4404',
    ppe: { helmet: true, vest: true, gloves: false, shoes: true },
    riskLevel: RiskLevel.MEDIUM,
    riskScore: 20,
    status: WorkerStatus.IDLE,
    violations: ['Gloves Missing'],
  },
  {
    id: 'W-1005',
    name: 'Vikram Singh',
    zoneId: 'ZONE-05',
    trackerId: 'TRK-4405',
    ppe: { helmet: true, vest: false, gloves: true, shoes: true },
    riskLevel: RiskLevel.HIGH,
    riskScore: 45,
    status: WorkerStatus.ACTIVE,
    violations: ['Vest Missing', 'Restricted Zone Entry'],
  },
];
