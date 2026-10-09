// ─────────────────────────────────────────────
// X-Guardian — Virtual Factory Page
// ─────────────────────────────────────────────

import { useState } from 'react';
import { useFactory } from '../context/FactoryContext';
import FactoryMap from '../components/FactoryMap';
import SimulationStudio from '../components/SimulationStudio';
import ZoneDetails from '../components/ZoneDetails';
import WorkerDetails from '../components/WorkerDetails';
import { Worker, Zone } from '../types';
import { Factory as FactoryIcon, Play, Pause, RefreshCw, Eye, AlertCircle } from 'lucide-react';

export default function Factory() {
  const { workers, zones, cameras, incidents, triggerHazard, activeHazardSimulation } = useFactory();
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [filterZone, setFilterZone] = useState<string>('ALL');

  const filteredWorkers =
    filterZone === 'ALL'
      ? workers
      : workers.filter((w) => w.zoneId === filterZone);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FactoryIcon size={16} className="text-blue-400" />
            <span className="text-xs font-mono tracking-wider text-blue-400 uppercase">
              Digital Twin Simulation
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Virtual Factory Control Room
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Live interactive telemetry of factory zones, smart camera feeds, and worker RFID positioning
          </p>
        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterZone('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterZone === 'ALL'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            All Zones
          </button>
          {zones.map((z) => (
            <button
              key={z.id}
              onClick={() => setFilterZone(z.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterZone === z.id
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {z.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Interactive 2D Map (2 columns on large screen) */}
        <div className="lg:col-span-2 space-y-4">
          <SimulationStudio
            activeHazard={activeHazardSimulation}
            onTriggerHazard={triggerHazard}
          />

          <FactoryMap
            zones={zones}
            workers={filteredWorkers}
            cameras={cameras}
            selectedZoneId={selectedZone?.id}
            onSelectZone={(zone) => {
              setSelectedZone(zone);
              setSelectedWorker(null);
            }}
            onSelectWorker={(worker) => {
              setSelectedWorker(worker);
              setSelectedZone(null);
            }}
          />

          {/* Real-time worker movement simulation info card */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-start gap-3 text-xs text-slate-400">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 mt-0.5">
              <RefreshCw size={15} className="animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <p className="font-semibold text-slate-200">Continuous Movement Simulation Active</p>
              <p className="mt-0.5 text-slate-400 leading-relaxed">
                Workers autonomously transition across assembly, welding, and storage zones. Entering the Restricted Zone (ZONE-05) or detaching PPE immediately triggers risk scoring recalculation and generates incident tickets.
              </p>
            </div>
          </div>
        </div>

        {/* Right Details Panel */}
        <div className="space-y-4">
          {selectedWorker ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Selected Entity: Worker</span>
                <span className="font-mono text-blue-400">{selectedWorker.id}</span>
              </div>
              <WorkerDetails
                worker={selectedWorker}
                zone={zones.find((z) => z.id === selectedWorker.zoneId)}
                onClose={() => setSelectedWorker(null)}
              />
            </div>
          ) : selectedZone ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Selected Entity: Zone</span>
                <span className="font-mono text-blue-400">{selectedZone.id}</span>
              </div>
              <ZoneDetails
                zone={selectedZone}
                workers={workers}
                camera={cameras.find((c) => c.zoneId === selectedZone.id)}
                incidents={incidents}
                onClose={() => setSelectedZone(null)}
                onSelectWorker={(w) => setSelectedWorker(w)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="p-3 rounded-xl bg-slate-800/80 text-slate-400 mb-3">
                <Eye size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Inspector Panel</h3>
              <p className="text-xs text-slate-500 max-w-[220px] leading-relaxed">
                Click any zone card or worker marker on the factory map to inspect real-time telemetry, camera feed details, and PPE compliance status.
              </p>
            </div>
          )}

          {/* Quick Worker Roster List */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Factory Personnel Tracker ({workers.length})
            </h3>
            <div className="space-y-2">
              {workers.map((w) => {
                const z = zones.find((item) => item.id === w.zoneId);
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWorker(w);
                      setSelectedZone(null);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                      selectedWorker?.id === w.id
                        ? 'bg-blue-600/15 border-blue-500/40'
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{w.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {w.id} • {z?.name ?? w.zoneId}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                        w.riskLevel === 'LOW'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : w.riskLevel === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {w.riskLevel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
