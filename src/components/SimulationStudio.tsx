// ─────────────────────────────────────────────
// X-Guardian — Hackathon Simulation Studio
// Interactive evaluation controls to test Fire, Smoke, and PPE Compliance detection
// ─────────────────────────────────────────────

import { useState } from 'react';
import { audioAlert } from '../utils/audioAlert';
import {
  Flame,
  CloudFog,
  ShieldCheck,
  AlertTriangle,
  Volume2,
  VolumeX,
  Sparkles,
  Play,
  RotateCcw,
} from 'lucide-react';

interface SimulationStudioProps {
  onTriggerHazard: (type: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'ALL_CLEAR') => void;
  activeHazard?: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'NONE';
}

export default function SimulationStudio({
  onTriggerHazard,
  activeHazard = 'NONE',
}: SimulationStudioProps) {
  const [isMuted, setIsMuted] = useState(audioAlert.getIsMuted());

  const handleToggleMute = () => {
    const muted = audioAlert.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="w-full rounded-xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-blue-500/30 p-3.5 shadow-xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Label */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                PS6 AI Prototype Demonstration Studio
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono border border-blue-500/20 font-semibold">
                EVALUATION MODE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simulate dynamic industrial scenarios to evaluate real-time gear compliance, fire, and smoke detection
            </p>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fire Trigger */}
          <button
            onClick={() => onTriggerHazard('FIRE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeHazard === 'FIRE'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-400'
                : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40'
            }`}
          >
            <Flame size={14} className={activeHazard === 'FIRE' ? 'animate-bounce' : ''} />
            <span>Simulate Fire</span>
          </button>

          {/* Smoke Trigger */}
          <button
            onClick={() => onTriggerHazard('SMOKE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeHazard === 'SMOKE'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 ring-2 ring-purple-400'
                : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40'
            }`}
          >
            <CloudFog size={14} className={activeHazard === 'SMOKE' ? 'animate-pulse' : ''} />
            <span>Simulate Smoke</span>
          </button>

          {/* PPE Gear Violation Trigger */}
          <button
            onClick={() => onTriggerHazard('PPE_VIOLATION')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeHazard === 'PPE_VIOLATION'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40 ring-2 ring-amber-400'
                : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40'
            }`}
          >
            <AlertTriangle size={14} />
            <span>Simulate Gear Violation</span>
          </button>

          {/* All Clear / Restore */}
          <button
            onClick={() => onTriggerHazard('ALL_CLEAR')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeHazard === 'NONE'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            <ShieldCheck size={14} />
            <span>All Clear (100% Compliant)</span>
          </button>

          {/* Siren Mute Toggle */}
          <button
            onClick={handleToggleMute}
            className={`p-1.5 rounded-lg border transition-all ${
              isMuted
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : 'bg-blue-600/30 text-blue-300 border-blue-500/40'
            }`}
            title={isMuted ? 'Unmute Audio Siren' : 'Mute Audio Siren'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
