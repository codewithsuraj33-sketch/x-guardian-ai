// ─────────────────────────────────────────────
// X-Guardian — Factory Zone Component
// 2D/2.5D Room visualization with worker avatars, camera marker, and Fire/Smoke hazards
// ─────────────────────────────────────────────

import { Zone, Worker, Camera, RiskLevel } from '../types';
import CameraMarker from './CameraMarker';
import WorkerMarker from './WorkerMarker';
import { Users, AlertOctagon, Flame, CloudFog, Radio } from 'lucide-react';

interface FactoryZoneProps {
  zone: Zone;
  workers: Worker[];
  camera?: Camera;
  isSelected: boolean;
  onSelectZone: (zone: Zone) => void;
  onSelectWorker: (worker: Worker) => void;
}

export default function FactoryZone({
  zone,
  workers,
  camera,
  isSelected,
  onSelectZone,
  onSelectWorker,
}: FactoryZoneProps) {
  const isFire = zone.hasActiveFire;
  const isSmoke = zone.hasActiveSmoke;
  const isEvac = zone.evacuationOrdered;

  const isCritical = zone.safetyStatus === RiskLevel.CRITICAL || isFire || isSmoke;
  const isHigh = zone.safetyStatus === RiskLevel.HIGH;
  const isWarning = zone.safetyStatus === RiskLevel.MEDIUM;

  const getBorderColor = () => {
    if (isSelected) return 'border-blue-400 ring-2 ring-blue-500/30';
    if (isFire) return 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] animate-pulse';
    if (isSmoke) return 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.35)] animate-pulse';
    if (isCritical) return 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.25)]';
    if (isHigh) return 'border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
    if (isWarning) return 'border-yellow-500/50';
    return 'border-slate-700/80 hover:border-slate-500';
  };

  const getStatusBadge = () => {
    if (isFire) return 'bg-rose-600 text-white font-black animate-pulse border-rose-400';
    if (isSmoke) return 'bg-purple-600 text-white font-black animate-pulse border-purple-400';
    if (isCritical) return 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse';
    if (isHigh) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (isWarning) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  };

  return (
    <div
      onClick={() => onSelectZone(zone)}
      className={`relative group rounded-xl border bg-slate-900/80 backdrop-blur-md p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[230px] ${getBorderColor()} ${
        isFire
          ? 'bg-gradient-to-b from-rose-950/40 via-slate-900/90 to-slate-950'
          : isSmoke
          ? 'bg-gradient-to-b from-purple-950/40 via-slate-900/90 to-slate-950'
          : zone.isRestricted
          ? 'bg-gradient-to-b from-amber-950/20 to-slate-900/90'
          : ''
      }`}
    >
      {/* Top hazard bar for fire or restricted zone */}
      {isFire ? (
        <div className="absolute top-0 left-0 right-0 h-2 rounded-t-xl bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 animate-pulse" />
      ) : isSmoke ? (
        <div className="absolute top-0 left-0 right-0 h-2 rounded-t-xl bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-600 animate-pulse" />
      ) : zone.isRestricted ? (
        <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-xl bg-[repeating-linear-gradient(45deg,#f59e0b,#f59e0b_10px,#000_10px,#000_20px)] opacity-80" />
      ) : null}

      {/* Zone Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-800"
              style={{ backgroundColor: isFire ? '#ef4444' : isSmoke ? '#a855f7' : zone.color }}
            />
            <div>
              <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-400">
                {zone.id}
              </span>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
                {zone.name}
                {isFire && <Flame size={14} className="text-rose-500 animate-bounce" />}
                {isSmoke && <CloudFog size={14} className="text-purple-400 animate-pulse" />}
                {zone.isRestricted && !isFire && !isSmoke && (
                  <span title="Restricted Zone" className="inline-flex">
                    <AlertOctagon size={14} className="text-rose-400" />
                  </span>
                )}
              </h3>
            </div>
          </div>

          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusBadge()}`}
          >
            {isFire ? 'FIRE' : isSmoke ? 'SMOKE' : zone.safetyStatus}
          </span>
        </div>

        {/* Camera & Worker count row */}
        <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
          {camera ? (
            <CameraMarker camera={camera} />
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">No Cam</span>
          )}

          <div className="flex items-center gap-2">
            {isEvac && (
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[9px] font-bold animate-pulse flex items-center gap-1">
                <Radio size={9} /> EVAC
              </span>
            )}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/60 font-mono text-[11px]">
              <Users size={12} className="text-slate-400" />
              <span className="font-semibold text-slate-200">{workers.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floor Area / Workers Container */}
      <div className="relative my-3 min-h-[90px] rounded-lg bg-slate-950/70 border border-slate-800/80 p-3 flex flex-wrap items-center justify-center gap-2.5 transition-colors group-hover:border-slate-700">
        {/* Optical grid texture */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none rounded-lg"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)`,
            backgroundSize: '16px 16px',
          }}
        />

        {/* Smoke haze overlay if smoke active */}
        {isSmoke && (
          <div className="absolute inset-0 bg-purple-900/25 backdrop-blur-[1px] rounded-lg pointer-events-none flex items-center justify-center">
            <span className="px-2 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold">
              💨 DENSE HAZE (78%)
            </span>
          </div>
        )}

        {/* Flame heatwave overlay if fire active */}
        {isFire && (
          <div className="absolute inset-0 bg-rose-950/30 rounded-lg pointer-events-none flex items-center justify-center">
            <span className="px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-500/50 text-[10px] font-mono font-bold animate-pulse">
              🔥 THERMAL RADIANCE
            </span>
          </div>
        )}

        {workers.length === 0 ? (
          <span className="text-[11px] text-slate-600 font-mono italic select-none">
            No personnel present
          </span>
        ) : (
          workers.map((worker) => (
            <div
              key={worker.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectWorker(worker);
              }}
              className="z-10 transition-transform duration-300 hover:scale-110"
            >
              <WorkerMarker worker={worker} onClick={onSelectWorker} />
            </div>
          ))
        )}
      </div>

      {/* Bottom info hint */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
        <span className="truncate max-w-[170px]">{zone.description}</span>
        <span className="text-[10px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-1">
          Inspect →
        </span>
      </div>
    </div>
  );
}
