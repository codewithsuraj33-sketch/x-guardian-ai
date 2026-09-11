// ─────────────────────────────────────────────
// X-Guardian — Workers Directory Page
// ─────────────────────────────────────────────

import { useState } from 'react';
import { useFactory } from '../context/FactoryContext';
import { Worker, RiskLevel } from '../types';
import PPEStatusDisplay from '../components/PPEStatusDisplay';
import WorkerDetails from '../components/WorkerDetails';
import { RISK_BG_CLASSES } from '../utils/constants';
import { getWorkerStatusClass } from '../utils/formatters';
import { Users, Filter, Search, ShieldAlert, Radio } from 'lucide-react';

export default function Workers() {
  const { workers, zones } = useFactory();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const filtered = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.trackerId.toLowerCase().includes(search.toLowerCase());

    const matchesRisk = riskFilter === 'ALL' || w.riskLevel === riskFilter;

    return matchesSearch && matchesRisk;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-blue-400" />
            <span className="text-xs font-mono tracking-wider text-blue-400 uppercase">
              Personnel Registry
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Factory Workers & PPE Compliance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time biometric tracking, smart sensor telemetry, and safety compliance status
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search worker / RFID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors w-48 sm:w-56"
            />
          </div>

          {/* Risk Level Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors font-mono"
          >
            <option value="ALL">All Risk Levels</option>
            <option value={RiskLevel.LOW}>LOW</option>
            <option value={RiskLevel.MEDIUM}>MEDIUM</option>
            <option value={RiskLevel.HIGH}>HIGH</option>
            <option value={RiskLevel.CRITICAL}>CRITICAL</option>
          </select>
        </div>
      </div>

      {/* Main Table / Detail Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Workers Table (2 cols on lg) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Worker</th>
                  <th className="py-3.5 px-4 font-semibold">Zone</th>
                  <th className="py-3.5 px-4 font-semibold">PPE Compliance</th>
                  <th className="py-3.5 px-4 font-semibold">Risk Level</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                      No matching personnel found
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => {
                    const zone = zones.find((z) => z.id === w.zoneId);
                    const isSelected = selectedWorker?.id === w.id;

                    return (
                      <tr
                        key={w.id}
                        onClick={() => setSelectedWorker(w)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600/10'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 font-mono text-xs">
                              {w.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200">{w.name}</p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {w.id} • {w.trackerId}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-300">
                            {zone?.name ?? w.zoneId}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-mono">
                            {w.zoneId}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <PPEStatusDisplay ppe={w.ppe} compact />
                        </td>

                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${RISK_BG_CLASSES[w.riskLevel]}`}
                            >
                              {w.riskLevel} ({w.riskScore})
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorker(w);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700/80 transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worker Details Side Panel */}
        <div>
          {selectedWorker ? (
            <WorkerDetails
              worker={selectedWorker}
              zone={zones.find((z) => z.id === selectedWorker.zoneId)}
              onClose={() => setSelectedWorker(null)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center flex flex-col items-center justify-center min-h-[250px]">
              <div className="p-3 rounded-xl bg-slate-800/80 text-slate-400 mb-3">
                <Radio size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Select a Worker</h3>
              <p className="text-xs text-slate-500 max-w-[220px]">
                Click any row in the personnel directory to inspect detailed telemetry, real-time safety scores, and individual PPE components.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
