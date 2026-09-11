// ─────────────────────────────────────────────
// X-Guardian — Camera Marker (on factory map)
// ─────────────────────────────────────────────

import { Camera, CameraStatus } from '../types';
import { Video, VideoOff } from 'lucide-react';

interface CameraMarkerProps {
  camera: Camera;
  onSelect?: (camera: Camera) => void;
}

export default function CameraMarker({ camera, onSelect }: CameraMarkerProps) {
  const isOnline = camera.status === CameraStatus.ONLINE;

  return (
    <div
      onClick={() => onSelect?.(camera)}
      title={`${camera.cameraId} • Status: ${camera.status}`}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium border transition-all ${
        isOnline
          ? 'bg-slate-900/90 text-slate-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:border-emerald-400/60'
          : 'bg-slate-900/90 text-rose-400 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.15)] hover:border-rose-400/60'
      } cursor-pointer backdrop-blur-sm`}
    >
      {isOnline ? (
        <Video size={13} className="text-emerald-400" />
      ) : (
        <VideoOff size={13} className="text-rose-400" />
      )}
      <span>{camera.cameraId}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
        }`}
      />
    </div>
  );
}
