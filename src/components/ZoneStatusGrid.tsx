// ─────────────────────────────────────────────
// X-Guardian — Zone Status Grid
// ─────────────────────────────────────────────

import { Zone, Camera, CameraStatus } from '../types';
import { RISK_BG_CLASSES } from '../utils/constants';
import { MapPin, Camera as CameraIcon, Users } from 'lucide-react';

interface ZoneStatusGridProps {
  zones: Zone[];
  cameras: Camera[];
}

export default function ZoneStatusGrid({ zones, cameras }: ZoneStatusGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {zones.map((zone) => {
        const cam = cameras.find((c) => c.zoneId === zone.id);
        return (
          <div
            key={zone.id}
            className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 hover:border-slate-600/60 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                <span className="text-xs text-slate-400 font-mono">{zone.id}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${RISK_BG_CLASSES[zone.safetyStatus]}`}>
                {zone.safetyStatus}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-white mb-3">{zone.name}</h3>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users size={12} />
                <span>{zone.workerCount} worker{zone.workerCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CameraIcon size={12} />
                <span>{cam?.cameraId ?? '—'}</span>
                {cam && (
                  <span className={cam.status === CameraStatus.ONLINE ? 'text-green-400' : 'text-red-400'}>
                    {cam.status === CameraStatus.ONLINE ? '● Online' : '○ Offline'}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
