// ─────────────────────────────────────────────
// X-Guardian — Mock Camera Data
// ─────────────────────────────────────────────

import { Camera, CameraStatus } from '../types';

export const initialCameras: Camera[] = [
  {
    cameraId: 'CAM-01',
    zoneId: 'ZONE-01',
    status: CameraStatus.ONLINE,
    name: 'Main Entrance & Turnstiles',
    feedUrl: '/images/cam01_entry.jpg',
    resolution: '1920x1080',
    fps: 30,
  },
  {
    cameraId: 'CAM-02',
    zoneId: 'ZONE-02',
    status: CameraStatus.ONLINE,
    name: 'Assembly Line Alpha',
    feedUrl: '/images/cam02_assembly.jpg',
    resolution: '1920x1080',
    fps: 30,
  },
  {
    cameraId: 'CAM-03',
    zoneId: 'ZONE-03',
    status: CameraStatus.ONLINE,
    name: 'High-Temp Welding Bay',
    feedUrl: '/images/cam03_welding.jpg',
    resolution: '1920x1080',
    fps: 30,
  },
  {
    cameraId: 'CAM-04',
    zoneId: 'ZONE-04',
    status: CameraStatus.ONLINE,
    name: 'Logistics & High Storage Racks',
    feedUrl: '/images/cam04_storage.jpg',
    resolution: '1920x1080',
    fps: 30,
  },
  {
    cameraId: 'CAM-05',
    zoneId: 'ZONE-05',
    status: CameraStatus.ONLINE,
    name: 'Restricted Chemical Sector',
    feedUrl: '/images/cam05_restricted.jpg',
    resolution: '1920x1080',
    fps: 30,
  },
];
