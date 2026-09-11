// ─────────────────────────────────────────────
// X-Guardian — Industrial Safety & Compliance Analytics
// Predictive Intelligence for Safety Gear, Smoke & Fire Incidents
// ─────────────────────────────────────────────

import { useFactory } from '../context/FactoryContext';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CloudFog,
  Sparkles,
  Cpu,
  Clock,
  HardHat,
  Shirt,
  Footprints,
  Hand,
  Download,
} from 'lucide-react';

export default function Analytics() {
  const { stats, workers, incidents, zones } = useFactory();

  const gearComplianceBreakdown = [
    { name: 'Industrial Hard Hats', rate: 94.2, target: 98.0, icon: HardHat, color: 'bg-emerald-500' },
    { name: 'High-Visibility Vests', rate: 91.8, target: 95.0, icon: Shirt, color: 'bg-blue-500' },
    { name: 'Protective Footwear', rate: 96.5, target: 99.0, icon: Footprints, color: 'bg-indigo-500' },
    { name: 'Industrial Gloves', rate: 88.4, target: 92.0, icon: Hand, color: 'bg-amber-500' },
  ];

  const hazardIncidents = [
    { type: 'Active Fire Outbreaks', count: 2, avgResponseSec: 4.8, color: 'bg-rose-500' },
    { type: 'Smoke & Aerosol Plumes', count: 5, avgResponseSec: 6.2, color: 'bg-purple-500' },
    { type: 'Hard Hat Non-Compliance', count: 18, avgResponseSec: 12.0, color: 'bg-amber-500' },
    { type: 'High-Vis Vest Violations', count: 12, avgResponseSec: 15.4, color: 'bg-blue-500' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={16} className="text-blue-400" />
            <span className="text-xs font-mono tracking-wider text-blue-400 uppercase">
              PS6 Executive Safety Intelligence
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Safety Gear & Environmental Risk Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quantitative analysis of worker compliance, fire mitigation response time, and atmospheric smoke dispersion
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>OSHA & Industrial ISO 45001 Compliant</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80">
          <p className="text-xs font-mono text-slate-400 uppercase">Gear Compliance Rate</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-white">92.7%</p>
            <span className="text-xs font-medium text-emerald-400 flex items-center">
              <TrendingUp size={12} className="inline mr-0.5" /> +4.1%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all 5 monitored sectors</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80">
          <p className="text-xs font-mono text-slate-400 uppercase">AI Hazard Detection Latency</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-blue-400">1.2 sec</p>
            <span className="text-[10px] font-mono text-emerald-400">Ultra-Fast</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Flame & smoke optical recognition</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80">
          <p className="text-xs font-mono text-slate-400 uppercase">Mean Time to Dispatch</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">18 sec</p>
          <p className="text-[11px] text-slate-500 mt-1">Automated ERT & Fire Marshal alert</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80">
          <p className="text-xs font-mono text-slate-400 uppercase">Total Optical Streams</p>
          <p className="text-2xl font-bold text-white mt-1">5 CCTV Nodes</p>
          <p className="text-[11px] text-slate-500 mt-1">100% video feed uptime</p>
        </div>
      </div>

      {/* Analytics Visual Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Safety Gear Compliance Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Safety Gear Compliance by Category
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Benchmark against industrial target thresholds
              </p>
            </div>
            <span className="text-xs font-mono text-blue-400">Audited Weekly</span>
          </div>

          <div className="space-y-4 pt-1">
            {gearComplianceBreakdown.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Icon size={14} className="text-blue-400" />
                      {item.name}
                    </span>
                    <span className="font-mono text-slate-300 font-semibold">
                      {item.rate}%{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        (Target: {item.target}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hazard Incident Response Performance */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Environmental & PPE Incident Frequency
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Recorded incident breakdown & mean intervention times
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400">Real-Time</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {hazardIncidents.map((hazard) => (
              <div
                key={hazard.type}
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${hazard.color}`} />
                  <div>
                    <span className="font-bold text-slate-200">{hazard.type}</span>
                    <p className="text-[11px] text-slate-500">
                      Mean Intervention: {hazard.avgResponseSec}s
                    </p>
                  </div>
                </div>

                <span className="font-mono font-bold text-white text-sm">
                  {hazard.count}{' '}
                  <span className="text-[10px] text-slate-500 font-normal">Events</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
