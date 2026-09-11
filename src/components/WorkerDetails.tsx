// ─────────────────────────────────────────────
// X-Guardian — Worker Details Panel
// ─────────────────────────────────────────────

import { X, MapPin, Radio, AlertTriangle } from 'lucide-react';
import { Worker, Zone } from '../types';
import { RISK_BG_CLASSES } from '../utils/constants';
import PPEStatusDisplay from './PPEStatusDisplay';

interface WorkerDetailsProps {
  worker: Worker;
  zone: Zone | undefined;
  onClose: () => void;
}

export default function WorkerDetails({ worker, zone, onClose }: WorkerDetailsProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">{worker.name}</h3>
          <p className="text-xs text-slate-500 font-mono">{worker.id}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          aria-label="Close worker details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Info grid */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <MapPin size={14} className="text-slate-500" />
          <span className="text-slate-500">Zone:</span>
          <span>{zone?.name ?? worker.zoneId}</span>
          <span className="text-xs text-slate-600 font-mono">({worker.zoneId})</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Radio size={14} className="text-slate-500" />
          <span className="text-slate-500">Tracker:</span>
          <span className="font-mono">{worker.trackerId}</span>
        </div>
      </div>

      {/* Risk */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-slate-800/70 border border-slate-700/50">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Risk Score</p>
          <p className="text-xl font-bold text-white">{worker.riskScore}</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${RISK_BG_CLASSES[worker.riskLevel]}`}>
          {worker.riskLevel}
        </span>
      </div>

      {/* PPE */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">PPE Compliance</p>
        <PPEStatusDisplay ppe={worker.ppe} />
      </div>

      {/* Violations */}
      {worker.violations.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Active Violations</p>
          <div className="space-y-1.5">
            {worker.violations.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                <AlertTriangle size={12} />
                {v}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
