// ─────────────────────────────────────────────
// X-Guardian — Worker Marker (on factory map)
// ─────────────────────────────────────────────

import { Worker } from '../types';
import { RISK_COLORS } from '../utils/constants';

interface WorkerMarkerProps {
  worker: Worker;
  onClick: (worker: Worker) => void;
}

export default function WorkerMarker({ worker, onClick }: WorkerMarkerProps) {
  const color = RISK_COLORS[worker.riskLevel];

  return (
    <button
      onClick={() => onClick(worker)}
      title={`${worker.name} (${worker.id}) — ${worker.riskLevel}`}
      className="relative group cursor-pointer"
      aria-label={`Worker ${worker.name}, risk level ${worker.riskLevel}`}
    >
      {/* Outer pulse ring for HIGH/CRITICAL */}
      {(worker.riskLevel === 'HIGH' || worker.riskLevel === 'CRITICAL') && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-40"
          style={{ backgroundColor: color }}
        />
      )}
      {/* Dot */}
      <span
        className="relative block w-5 h-5 rounded-full border-2 border-slate-900 transition-transform group-hover:scale-125"
        style={{ backgroundColor: color }}
      />
      {/* Label */}
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        {worker.id}
      </span>
    </button>
  );
}
