// ─────────────────────────────────────────────
// X-Guardian — Incident List
// ─────────────────────────────────────────────

import { Incident } from '../types';
import { formatTimestamp, getIncidentStatusClass } from '../utils/formatters';
import { RISK_BG_CLASSES } from '../utils/constants';
import { AlertTriangle } from 'lucide-react';

interface IncidentListProps {
  incidents: Incident[];
  limit?: number;
}

export default function IncidentList({ incidents, limit }: IncidentListProps) {
  const display = limit ? incidents.slice(0, limit) : incidents;

  if (display.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
        <AlertTriangle size={28} className="mb-2 opacity-40" />
        <p className="text-sm">No incidents recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {display.map((inc) => (
        <div
          key={inc.incidentId}
          className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              inc.severity === 'CRITICAL' || inc.severity === 'HIGH' ? 'bg-red-500' :
              inc.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'
            }`} />
            <div className="min-w-0">
              <p className="text-sm text-slate-200 truncate">{inc.violation}</p>
              <p className="text-xs text-slate-500">
                {inc.workerId} • {inc.zoneId} • {formatTimestamp(inc.timestamp)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${RISK_BG_CLASSES[inc.severity]}`}>
              {inc.severity}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getIncidentStatusClass(inc.status)}`}>
              {inc.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
