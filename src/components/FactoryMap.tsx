// ─────────────────────────────────────────────
// X-Guardian — Factory Map Component
// Interactive 2D/2.5D Factory Visualization
// ─────────────────────────────────────────────

import { Zone, Worker, Camera } from '../types';
import FactoryZone from './FactoryZone';
import { Layers, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';

interface FactoryMapProps {
  zones: Zone[];
  workers: Worker[];
  cameras: Camera[];
  selectedZoneId?: string;
  onSelectZone: (zone: Zone) => void;
  onSelectWorker: (worker: Worker) => void;
}

export default function FactoryMap({
  zones,
  workers,
  cameras,
  selectedZoneId,
  onSelectZone,
  onSelectWorker,
}: FactoryMapProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 shadow-2xl relative overflow-hidden">
      {/* Background industrial grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Top Map Toolbar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Virtual Factory Floor Plan
            </h2>
            <p className="text-xs text-slate-400">
              Real-time sector zoning & spatial worker tracking
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Low Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>High/Critical</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 border-l border-slate-800 pl-3">
            <Cpu size={13} className="text-blue-400" />
            <span>Live Sim</span>
          </div>
        </div>
      </div>

      {/* Factory Zones Layout Grid */}
      {/* Layout: Entry and Storage on left/right wings, Assembly in center, Welding next, Restricted at the end */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((zone) => {
          const zoneWorkers = workers.filter((w) => w.zoneId === zone.id);
          const camera = cameras.find((c) => c.zoneId === zone.id);

          return (
            <FactoryZone
              key={zone.id}
              zone={zone}
              workers={zoneWorkers}
              camera={camera}
              isSelected={zone.id === selectedZoneId}
              onSelectZone={onSelectZone}
              onSelectWorker={onSelectWorker}
            />
          );
        })}
      </div>

      {/* Map Footer Status Bar */}
      <div className="relative z-10 mt-5 pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-blue-400" />
          <span>Coordinate Grid: Sector Alpha-1 through Alpha-5</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Active Nodes: {zones.length} Zones</span>
          <span>•</span>
          <span>Surveillance: {cameras.filter((c) => c.status === 'ONLINE').length}/{cameras.length} Active</span>
        </div>
      </div>
    </div>
  );
}
