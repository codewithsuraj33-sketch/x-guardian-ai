// ─────────────────────────────────────────────
// X-Guardian — Mock Camera Data
// ─────────────────────────────────────────────

import { Camera, CameraStatus } from '../types';

export const initialCameras: Camera[] = [
  { cameraId: 'CAM-01', zoneId: 'ZONE-01', status: CameraStatus.ONLINE },
  { cameraId: 'CAM-02', zoneId: 'ZONE-02', status: CameraStatus.ONLINE },
  { cameraId: 'CAM-03', zoneId: 'ZONE-03', status: CameraStatus.ONLINE },
  { cameraId: 'CAM-04', zoneId: 'ZONE-04', status: CameraStatus.ONLINE },
  { cameraId: 'CAM-05', zoneId: 'ZONE-05', status: CameraStatus.OFFLINE },
];
