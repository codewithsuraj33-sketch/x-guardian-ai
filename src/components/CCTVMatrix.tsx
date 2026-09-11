// ─────────────────────────────────────────────
// X-Guardian — CCTV Multi-Camera Surveillance Matrix (Video Wall)
// Simultaneous 4-Channel Industrial Feeds with Live Threat Overlays
// ─────────────────────────────────────────────

import { Camera, Zone, RiskLevel } from '../types';
import {
  Camera as CameraIcon,
  Flame,
  CloudFog,
  ShieldCheck,
  AlertTriangle,
  Maximize2,
  Radio,
} from 'lucide-react';

interface CCTVMatrixProps {
  cameras: Camera[];
  zones: Zone[];
  selectedCameraId: string;
  onSelectCamera: (cameraId: string) => void;
  activeHazard?: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'NONE';
}

export default function CCTVMatrix({
  cameras,
  zones,
  selectedCameraId,
  onSelectCamera,
  activeHazard = 'NONE',
}: CCTVMatrixProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur-md space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400">
            <CameraIcon size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Surveillance Grid Matrix (CCTV Video Wall)
            </h2>
            <p className="text-xs text-slate-400">
              Simultaneous AI multi-channel optical monitoring across industrial sectors
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>4 Channels Active • 30 FPS</span>
        </div>
      </div>

      {/* 4-Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cameras.slice(0, 4).map((cam, idx) => {
          const zone = zones.find((z) => z.id === cam.zoneId) || zones[idx];
          const isSelected = cam.cameraId === selectedCameraId;

          // Determine simulated threat for each feed
          const isFireCam = cam.cameraId === 'CAM-03' && (zone?.hasActiveFire || activeHazard === 'FIRE');
          const isSmokeCam = cam.cameraId === 'CAM-04' && (zone?.hasActiveSmoke || activeHazard === 'SMOKE');
          const isPPEViolCam = cam.cameraId === 'CAM-01' && activeHazard === 'PPE_VIOLATION';

          return (
            <div
              key={cam.cameraId}
              onClick={() => onSelectCamera(cam.cameraId)}
              className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 border group ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : isFireCam
                  ? 'border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : isSmokeCam
                  ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                  : 'border-slate-800 hover:border-slate-600'
              } bg-slate-950`}
            >
              {/* Aspect Ratio 16:9 Viewport */}
              <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                {/* Simulated CCTV Background Image Pattern */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)`,
                    backgroundSize: '16px 16px',
                  }}
                />

                {/* Industrial Scanlines */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40" />

                {/* Center Visual Mockup */}
                <div className="relative z-10 text-center space-y-1">
                  <span className="text-2xl font-black font-mono tracking-widest text-slate-700 select-none">
                    FEED {cam.cameraId}
                  </span>
                  <p className="text-[11px] font-mono text-slate-400">
                    {zone?.name.toUpperCase()} SECTOR
                  </p>
                </div>

                {/* Threat Visual Overlays */}
                {isFireCam && (
                  <div className="absolute inset-0 bg-rose-950/40 border-2 border-rose-500 flex flex-col items-center justify-center p-3 animate-pulse">
                    <Flame size={32} className="text-rose-500 animate-bounce" />
                    <span className="mt-1 px-2.5 py-0.5 rounded bg-rose-600 text-white font-mono font-black text-xs uppercase tracking-wider">
                      CRITICAL FIRE DETECTED
                    </span>
                    <span className="text-[10px] font-mono text-rose-200 mt-1">
                      Thermal Radiant Hotspot: 96.4%
                    </span>
                  </div>
                )}

                {isSmokeCam && (
                  <div className="absolute inset-0 bg-purple-950/40 border-2 border-purple-500 flex flex-col items-center justify-center p-3 animate-pulse">
                    <CloudFog size={32} className="text-purple-400" />
                    <span className="mt-1 px-2.5 py-0.5 rounded bg-purple-600 text-white font-mono font-black text-xs uppercase tracking-wider">
                      DENSE SMOKE PLUME
                    </span>
                    <span className="text-[10px] font-mono text-purple-200 mt-1">
                      Haze Dispersion: 78% Density
                    </span>
                  </div>
                )}

                {isPPEViolCam && (
                  <div className="absolute inset-0 bg-amber-950/30 border-2 border-amber-500 flex flex-col items-center justify-center p-3">
                    <AlertTriangle size={28} className="text-amber-400 animate-pulse" />
                    <span className="mt-1 px-2 py-0.5 rounded bg-amber-600 text-white font-mono font-black text-[11px] uppercase tracking-wider">
                      PPE GEAR VIOLATION
                    </span>
                    <span className="text-[10px] font-mono text-amber-200 mt-0.5">
                      Missing Hard Hat & Vest
                    </span>
                  </div>
                )}

                {/* Normal / Compliant State Overlay */}
                {!isFireCam && !isSmokeCam && !isPPEViolCam && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-[10px] font-mono text-emerald-400">
                    <ShieldCheck size={11} />
                    <span>ALL GEAR COMPLIANT</span>
                  </div>
                )}

                {/* Top Corner Watermark */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950/90 text-[10px] font-mono font-bold text-slate-200 border border-slate-700">
                    {cam.cameraId}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {zone?.name}
                  </span>
                </div>

                {/* Top Right Live Dot */}
                <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>REC</span>
                </div>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="px-3 py-1 rounded-lg bg-slate-900/90 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg border border-slate-700">
                    <Maximize2 size={12} />
                    <span>Expand Deep-Dive View</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
