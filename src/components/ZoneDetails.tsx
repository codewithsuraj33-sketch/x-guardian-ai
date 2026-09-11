// ─────────────────────────────────────────────
// X-Guardian — Zone Details Panel
// ─────────────────────────────────────────────

import { X, Camera, Users, AlertTriangle, Shield } from 'lucide-react';
import { Zone, Worker, Camera as CameraType, CameraStatus, Incident, IncidentStatus } from '../types';
import { RISK_BG_CLASSES } from '../utils/constants';

interface ZoneDetailsProps {
  zone: Zone;
  workers: Worker[];
  camera: CameraType | undefined;
  incidents: Incident[];
  onClose: () => void;
  onSelectWorker: (worker: Worker) => void;
}

export default function ZoneDetails({ zone, workers, camera, incidents, onClose, onSelectWorker }: ZoneDetailsProps) {
  const zoneWorkers = workers.filter((w) => w.zoneId === zone.id);
  const activeIncidents = incidents.filter(
    (i) => i.zoneId === zone.id && i.status === IncidentStatus.OPEN
  );

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: zone.color }} />
          <div>
            <h3 className="text-base font-semibold text-white">{zone.name}</h3>
            <p className="text-xs text-slate-500 font-mono">{zone.id}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          aria-label="Close zone details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">{zone.description}</p>

      {/* Safety & Camera */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield size={12} className="text-slate-500" />
            <p className="text-[10px] text-slate-500 uppercase">Safety</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${RISK_BG_CLASSES[zone.safetyStatus]}`}>
            {zone.safetyStatus}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Camera size={12} className="text-slate-500" />
            <p className="text-[10px] text-slate-500 uppercase">Camera</p>
          </div>
          <p className="text-xs text-slate-300 font-mono">{camera?.cameraId ?? '—'}</p>
          {camera && (
            <p className={`text-[10px] ${camera.status === CameraStatus.ONLINE ? 'text-green-400' : 'text-red-400'}`}>
              {camera.status}
            </p>
          )}
        </div>
      </div>

      {/* Workers */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={12} className="text-slate-500" />
          <p className="text-xs text-slate-500 uppercase tracking-wider">
            Workers ({zoneWorkers.length})
          </p>
        </div>
        {zoneWorkers.length === 0 ? (
          <p className="text-xs text-slate-600 italic">No workers in this zone</p>
        ) : (
          <div className="space-y-1.5">
            {zoneWorkers.map((w) => (
              <button
                key={w.id}
                onClick={() => onSelectWorker(w)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-slate-600/50 transition-colors text-left"
              >
                <div>
                  <p className="text-xs text-slate-200">{w.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{w.id}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${RISK_BG_CLASSES[w.riskLevel]}`}>
                  {w.riskLevel}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Violations */}
      {activeIncidents.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-red-400" />
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Active Violations ({activeIncidents.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {activeIncidents.map((inc) => (
              <div key={inc.incidentId} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                {inc.violation} — {inc.workerId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
