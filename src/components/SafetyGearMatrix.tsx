// ─────────────────────────────────────────────
// X-Guardian — Safety Gear & Hazard Compliance Matrix
// Real-time compliance breakdown for Helmets, Vests, Gloves, Footwear, Fire & Smoke
// ─────────────────────────────────────────────

import { Worker, Zone, RiskLevel } from '../types';
import {
  HardHat,
  Shirt,
  Hand,
  Footprints,
  Glasses,
  Flame,
  CloudFog,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface SafetyGearMatrixProps {
  workers: Worker[];
  zones: Zone[];
}

export default function SafetyGearMatrix({ workers, zones }: SafetyGearMatrixProps) {
  const total = workers.length || 1;

  const helmetCount = workers.filter((w) => w.ppe.helmet).length;
  const vestCount = workers.filter((w) => w.ppe.vest).length;
  const glovesCount = workers.filter((w) => w.ppe.gloves).length;
  const shoesCount = workers.filter((w) => w.ppe.shoes).length;
  const gogglesCount = workers.filter((w) => w.ppe.goggles ?? true).length;

  const helmetRate = Math.round((helmetCount / total) * 100);
  const vestRate = Math.round((vestCount / total) * 100);
  const glovesRate = Math.round((glovesCount / total) * 100);
  const shoesRate = Math.round((shoesCount / total) * 100);
  const gogglesRate = Math.round((gogglesCount / total) * 100);

  const activeFireZones = zones.filter((z) => z.hasActiveFire);
  const activeSmokeZones = zones.filter((z) => z.hasActiveSmoke);

  const gearItems = [
    {
      name: 'Safety Helmets',
      count: helmetCount,
      rate: helmetRate,
      icon: HardHat,
      color: helmetRate >= 90 ? 'emerald' : helmetRate >= 70 ? 'amber' : 'rose',
    },
    {
      name: 'High-Vis Vests',
      count: vestCount,
      rate: vestRate,
      icon: Shirt,
      color: vestRate >= 90 ? 'emerald' : vestRate >= 70 ? 'amber' : 'rose',
    },
    {
      name: 'Protective Boots',
      count: shoesCount,
      rate: shoesRate,
      icon: Footprints,
      color: shoesRate >= 90 ? 'emerald' : shoesRate >= 70 ? 'amber' : 'rose',
    },
    {
      name: 'Industrial Gloves',
      count: glovesCount,
      rate: glovesRate,
      icon: Hand,
      color: glovesRate >= 90 ? 'emerald' : glovesRate >= 70 ? 'amber' : 'rose',
    },
    {
      name: 'Safety Goggles',
      count: gogglesCount,
      rate: gogglesRate,
      icon: Glasses,
      color: gogglesRate >= 90 ? 'emerald' : gogglesRate >= 70 ? 'amber' : 'rose',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur-md space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            Safety Gear & Environmental Hazard Matrix
          </h2>
          <p className="text-xs text-slate-400">
            Real-time compliance audit across all monitored factory sectors
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
          {workers.length} Personnel Active
        </span>
      </div>

      {/* 5 Gear Items Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {gearItems.map((item, idx) => {
          const Icon = item.icon;
          const isGood = item.rate >= 90;
          const isWarn = item.rate >= 70 && item.rate < 90;

          return (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`p-2 rounded-lg ${
                    isGood
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isWarn
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <span
                  className={`text-lg font-black font-mono ${
                    isGood ? 'text-emerald-400' : isWarn ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {item.rate}%
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-200">{item.name}</p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isGood ? 'bg-emerald-500' : isWarn ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-slate-400 mt-1">
                  {item.count}/{total} compliant
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Environmental Threat Sensors Status Row (Fire & Smoke) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Fire Presence Sensor Card */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            activeFireZones.length > 0
              ? 'bg-rose-950/40 border-rose-500/70 text-rose-200 animate-pulse'
              : 'bg-slate-950/60 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                activeFireZones.length > 0
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Flame size={20} />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Optical Flame Sensor
              </span>
              <p className="text-sm font-bold mt-0.5">
                {activeFireZones.length > 0 ? (
                  <span className="text-rose-400">
                    🔥 ACTIVE FIRE in {activeFireZones.map((z) => z.name).join(', ')}
                  </span>
                ) : (
                  <span className="text-emerald-400">✓ No Fire Detected (All Sectors Safe)</span>
                )}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
              activeFireZones.length > 0
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
            }`}
          >
            {activeFireZones.length > 0 ? 'CRITICAL ALERT' : 'SECURE'}
          </span>
        </div>

        {/* Smoke Presence Sensor Card */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            activeSmokeZones.length > 0
              ? 'bg-purple-950/40 border-purple-500/70 text-purple-200 animate-pulse'
              : 'bg-slate-950/60 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                activeSmokeZones.length > 0
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <CloudFog size={20} />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Optical Smoke & Aerosol Sensor
              </span>
              <p className="text-sm font-bold mt-0.5">
                {activeSmokeZones.length > 0 ? (
                  <span className="text-purple-400">
                    💨 SMOKE PLUME in {activeSmokeZones.map((z) => z.name).join(', ')}
                  </span>
                ) : (
                  <span className="text-emerald-400">✓ Normal Atmospheric Clarity</span>
                )}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
              activeSmokeZones.length > 0
                ? 'bg-purple-600 text-white'
                : 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
            }`}
          >
            {activeSmokeZones.length > 0 ? 'SMOKE HAZARD' : 'NORMAL'}
          </span>
        </div>
      </div>
    </div>
  );
}
