// ─────────────────────────────────────────────
// X-Guardian — CCTV Multi-Camera Surveillance Matrix (Video Wall)
// Simultaneous 5-Channel Industrial Feeds with Live Threat Overlays & Real Feeds
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Camera, Zone } from '../types';
import {
  Camera as CameraIcon,
  Flame,
  CloudFog,
  ShieldCheck,
  AlertTriangle,
  Maximize2,
  Radio,
  Eye,
} from 'lucide-react';

interface CCTVMatrixProps {
  cameras: Camera[];
  zones: Zone[];
  selectedCameraId?: string;
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
  const [timecode, setTimecode] = useState<string>('');
  const [simulatedHazard, setSimulatedHazard] = useState<'NONE' | 'FIRE' | 'PPE'>('NONE');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimecode(
        d.toLocaleTimeString('en-US', { hour12: false }) +
          '.' +
          String(Math.floor(d.getMilliseconds() / 100))
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur-md space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400">
            <CameraIcon size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Surveillance Grid Matrix (5-Channel CCTV Video Wall)
            </h2>
            <p className="text-xs text-slate-400">
              Simultaneous AI optical monitoring across all 5 industrial factory sectors
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <Radio size={12} className="text-blue-400 animate-pulse" />
            <span>UTC {timecode || 'LIVE'}</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>5/5 Channels Active • 30 FPS</span>
          </div>
        </div>
      </div>

      {/* Surveillance Threat Simulation Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-mono font-semibold">
          <AlertTriangle size={14} className="text-amber-400" />
          <span>SURVEILLANCE HAZARD SIMULATION:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSimulatedHazard(simulatedHazard === 'FIRE' ? 'NONE' : 'FIRE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
              simulatedHazard === 'FIRE'
                ? 'border-red-500 bg-red-950 text-red-200 ring-2 ring-red-500/50 shadow-md shadow-red-950/50'
                : 'border-red-900/60 bg-red-950/30 text-red-300 hover:border-red-600 hover:bg-red-900/50'
            }`}
          >
            <Flame size={12} className="text-red-400 animate-pulse" />
            <span>🔥 Fire &amp; Smoke Emergency (CAM-03)</span>
          </button>

          <button
            type="button"
            onClick={() => setSimulatedHazard(simulatedHazard === 'PPE' ? 'NONE' : 'PPE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
              simulatedHazard === 'PPE'
                ? 'border-amber-500 bg-amber-950 text-amber-200 ring-2 ring-amber-500/50 shadow-md shadow-amber-950/50'
                : 'border-amber-900/60 bg-amber-950/30 text-amber-300 hover:border-amber-600'
            }`}
          >
            <AlertTriangle size={12} className="text-amber-400" />
            <span>⚠️ PPE Non-Compliance (CAM-01)</span>
          </button>

          {simulatedHazard !== 'NONE' && (
            <button
              type="button"
              onClick={() => setSimulatedHazard('NONE')}
              className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-white text-xs font-mono"
            >
              Reset Feeds
            </button>
          )}
        </div>
      </div>

      {/* 5-Camera Responsive Video Wall Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((cam, idx) => {
          const zone = zones.find((z) => z.id === cam.zoneId) || zones[idx];
          const isSelected = cam.cameraId === selectedCameraId;

          // Determine simulated threat for each feed
          const isFireCam =
            cam.cameraId === 'CAM-03' &&
            (zone?.hasActiveFire || activeHazard === 'FIRE' || simulatedHazard === 'FIRE');
          const isSmokeCam =
            cam.cameraId === 'CAM-04' &&
            (zone?.hasActiveSmoke || activeHazard === 'SMOKE');
          const isPPEViolCam =
            cam.cameraId === 'CAM-01' &&
            (activeHazard === 'PPE_VIOLATION' || simulatedHazard === 'PPE');
          const isRestrictedCam = cam.cameraId === 'CAM-05';

          const feedImage = isFireCam
            ? '/images/fire_smoke_hazard.jpg'
            : (cam.feedUrl ||
               (cam.cameraId === 'CAM-01'
                 ? '/images/cam01_entry.jpg'
                 : cam.cameraId === 'CAM-02'
                 ? '/images/cam02_assembly.jpg'
                 : cam.cameraId === 'CAM-03'
                 ? '/images/cam03_welding.jpg'
                 : cam.cameraId === 'CAM-04'
                 ? '/images/cam04_storage.jpg'
                 : '/images/cam05_restricted.jpg'));

          return (
            <div
              key={cam.cameraId}
              onClick={() => onSelectCamera(cam.cameraId)}
              className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 border group ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                  : isFireCam
                  ? 'border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : isSmokeCam
                  ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                  : 'border-slate-800 hover:border-blue-500/60 hover:shadow-lg'
              } bg-slate-950`}
            >
              {/* Aspect Ratio 16:9 Viewport */}
              <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                {/* Real CCTV Feed Snapshot Background */}
                <img
                  src={feedImage}
                  alt={`${cam.cameraId} Feed`}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to stylized background if image not found
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />

                {/* Industrial Scanlines & Vignette */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] opacity-40" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/60" />

                {/* Threat Visual Overlays */}
                {isFireCam && (
                  <div className="absolute inset-0 bg-rose-950/50 border-2 border-rose-500 flex flex-col items-center justify-center p-3 animate-pulse z-10">
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
                  <div className="absolute inset-0 bg-purple-950/50 border-2 border-purple-500 flex flex-col items-center justify-center p-3 animate-pulse z-10">
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
                  <div className="absolute inset-0 bg-amber-950/40 border-2 border-amber-500 flex flex-col items-center justify-center p-3 z-10">
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
                  <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-[10px] font-mono text-emerald-400">
                    <ShieldCheck size={11} />
                    <span>{isRestrictedCam ? 'PERIMETER SECURED' : 'PPE COMPLIANT'}</span>
                  </div>
                )}

                {/* Top Left Camera Badge */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950/90 text-[10px] font-mono font-bold text-white border border-slate-700">
                    {cam.cameraId}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] font-mono text-slate-300 border border-slate-800">
                    {zone?.name || `Zone ${idx + 1}`}
                  </span>
                </div>

                {/* Top Right Live REC Dot */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>REC</span>
                </div>

                {/* Bottom Right Resolution & FPS */}
                <div className="absolute bottom-2 right-2 z-10 text-[9px] font-mono text-slate-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                  {cam.resolution || '1080p'} • {cam.fps || 30} FPS
                </div>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900/95 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-xl border border-blue-500/50">
                    <Eye size={13} className="text-blue-400" />
                    <span>Inspect & Run AI Detection</span>
                  </span>
                </div>
              </div>

              {/* Card Footer Bar */}
              <div className="px-3 py-2 bg-slate-900 flex items-center justify-between text-xs border-t border-slate-800/80">
                <div className="truncate font-medium text-slate-200">
                  {cam.name || `${zone?.name} Surveillance`}
                </div>
                <div className="text-[11px] font-mono text-blue-400 flex items-center gap-1">
                  <span>SELECT</span>
                  <Maximize2 size={11} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
