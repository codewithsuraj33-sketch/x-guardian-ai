// ─────────────────────────────────────────────
// X-Guardian — Industrial CCTV & Recorded Footage Presets
// Realistic scenarios for demonstration of PPE, Fire & Smoke Detection
// ─────────────────────────────────────────────

import { RecordedFootagePreset } from '../types';

export const RECORDED_FOOTAGE_PRESETS: RecordedFootagePreset[] = [
  {
    id: 'FEED-01',
    title: 'Factory Assembly Sector A — PPE Compliance Check',
    zoneId: 'ZONE-02',
    cameraId: 'CAM-02',
    description: 'Active assembly floor monitoring for standard safety gear (Helmets, High-Vis Vests, Safety Boots, Gloves).',
    hazardType: 'COMPLIANT',
    tag: 'PPE AUDIT',
  },
  {
    id: 'FEED-02',
    title: 'Welding & Boiler Bay — Critical Fire Outbreak',
    zoneId: 'ZONE-03',
    cameraId: 'CAM-03',
    description: 'High-temperature thermal flare and open flame ignition detected adjacent to gas manifolds.',
    hazardType: 'FIRE',
    tag: 'CRITICAL FIRE',
  },
  {
    id: 'FEED-03',
    title: 'Chemical & Raw Material Storage — Dense Smoke Plume',
    zoneId: 'ZONE-04',
    cameraId: 'CAM-04',
    description: 'Early particulate accumulation and rapid smoke plume dispersion detected above storage racks.',
    hazardType: 'SMOKE',
    tag: 'SMOKE HAZARD',
  },
  {
    id: 'FEED-04',
    title: 'Main Logistics & Entry Hub — PPE Gear Violations',
    zoneId: 'ZONE-01',
    cameraId: 'CAM-01',
    description: 'Operator entering industrial work zone without hard hat and missing high-visibility reflective vest.',
    hazardType: 'PPE_VIOLATION',
    tag: 'GEAR VIOLATION',
  },
];
