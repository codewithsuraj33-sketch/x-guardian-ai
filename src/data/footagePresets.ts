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
    imageSrc: '/images/cam02_assembly.jpg',
  },
  {
    id: 'FEED-02',
    title: 'Welding & Boiler Bay — Critical Fire Outbreak',
    zoneId: 'ZONE-03',
    cameraId: 'CAM-03',
    description: 'High-temperature thermal flare and open flame ignition detected adjacent to gas manifolds.',
    hazardType: 'FIRE',
    tag: 'CRITICAL FIRE',
    imageSrc: '/images/cam03_welding.jpg',
  },
  {
    id: 'FEED-03',
    title: 'Chemical & Raw Material Storage — Dense Smoke Plume',
    zoneId: 'ZONE-04',
    cameraId: 'CAM-04',
    description: 'Early particulate accumulation and rapid smoke plume dispersion detected above storage racks.',
    hazardType: 'SMOKE',
    tag: 'SMOKE HAZARD',
    imageSrc: '/images/cam04_storage.jpg',
  },
  {
    id: 'FEED-04',
    title: 'Main Logistics & Entry Hub — PPE Gear Violations',
    zoneId: 'ZONE-01',
    cameraId: 'CAM-01',
    description: 'Operator entering industrial work zone without hard hat and missing high-visibility reflective vest.',
    hazardType: 'PPE_VIOLATION',
    tag: 'GEAR VIOLATION',
    imageSrc: '/images/cam01_entry.jpg',
  },
  {
    id: 'FEED-05',
    title: 'Chemical Restricted Perimeter — Intrusion Detection',
    zoneId: 'ZONE-05',
    cameraId: 'CAM-05',
    description: 'Hazardous chemical reaction sector monitored for perimeter breaches and unauthorized personnel.',
    hazardType: 'RESTRICTED_ACCESS',
    tag: 'RESTRICTED ACCESS',
    imageSrc: '/images/cam05_restricted.jpg',
  },
  {
    id: 'FEED-06',
    title: 'Worker PPE Full Compliance Audit — Complete Safety Gear',
    zoneId: 'ZONE-02',
    cameraId: 'CAM-02',
    description: 'Certified worker in manufacturing bay equipped with hard hat, high-vis vest, gloves, and steel-toe safety boots.',
    hazardType: 'COMPLIANT',
    tag: '100% PPE COMPLIANT',
    imageSrc: '/images/worker_ppe_compliant.jpg',
  },
  {
    id: 'FEED-07',
    title: 'Safety Gear Equipment Array — PPE Verification Kit',
    zoneId: 'ZONE-01',
    cameraId: 'CAM-01',
    description: 'Inspection of essential safety kit: safety helmet, reflective high-vis vest, protective gloves, and safety boots.',
    hazardType: 'COMPLIANT',
    tag: 'PPE GEAR CHECK',
    imageSrc: '/images/worker_safety_gear.jpg',
  },
];
