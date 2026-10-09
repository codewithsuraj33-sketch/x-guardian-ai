// ─────────────────────────────────────────────
// X-Guardian — Fast Location & Context Emergency Alert Modal
// Instant actionable incident dispatch with audible siren control
// ─────────────────────────────────────────────

import { useState } from 'react';
import { EmergencyAlert } from '../types';
import { audioAlert } from '../utils/audioAlert';
import {
  AlertTriangle,
  Flame,
  CloudFog,
  ShieldAlert,
  Volume2,
  VolumeX,
  Radio,
  Send,
  CheckCircle2,
  X,
  ExternalLink,
  PhoneCall,
  BellRing,
} from 'lucide-react';

interface EmergencyAlertModalProps {
  alert: EmergencyAlert | null;
  onClose: () => void;
  onEvacuate: (zoneId: string) => void;
  onAcknowledge: (alertId: string) => void;
}

export default function EmergencyAlertModal({
  alert,
  onClose,
  onEvacuate,
  onAcknowledge,
}: EmergencyAlertModalProps) {
  const [isMuted, setIsMuted] = useState(audioAlert.getIsMuted());
  const [suppressionTriggered, setSuppressionTriggered] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!alert) return null;

  const toggleSiren = () => {
    const muted = audioAlert.toggleMute();
    setIsMuted(muted);
  };

  const handleTriggerSuppression = () => {
    setSuppressionTriggered(true);
  };

  const handleAcknowledge = () => {
    setAcknowledged(true);
    audioAlert.stopSiren();
    onAcknowledge(alert.alertId);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const isFire = alert.hazardType === 'FIRE';
  const isSmoke = alert.hazardType === 'SMOKE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-950 border-2 border-rose-500/80 shadow-[0_0_50px_rgba(239,68,68,0.4)] overflow-hidden flex flex-col">
        {/* Animated Emergency Beacon Top Stripe */}
        <div className="h-2 w-full bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_12px,#000_12px,#000_24px)] animate-pulse" />

        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-900 border-b border-rose-500/40 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-600/30 border border-rose-500 flex items-center justify-center text-rose-400 animate-bounce">
              {isFire ? <Flame size={28} /> : isSmoke ? <CloudFog size={28} /> : <AlertTriangle size={28} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-600 text-[11px] font-mono font-black text-white uppercase tracking-wider">
                  EMERGENCY SAFETY ACTION REQUIRED
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {alert.alertId}
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
                {alert.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Siren Mute / Unmute Button */}
            <button
              onClick={toggleSiren}
              className={`p-2 rounded-lg border transition-all ${
                isMuted
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-rose-600 text-white border-rose-500 animate-pulse'
              }`}
              title={isMuted ? 'Unmute Alarm Siren' : 'Mute Alarm Siren'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              onClick={() => {
                audioAlert.stopSiren();
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Context & Location Breakdown */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Location Details Callout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500">Affected Sector</span>
              <p className="text-sm font-bold text-rose-300 mt-0.5">{alert.zoneName}</p>
              <span className="text-[10px] font-mono text-slate-400">({alert.zoneId})</span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500">Optical Source</span>
              <p className="text-sm font-bold text-white mt-0.5">{alert.cameraId}</p>
              <span className="text-[10px] font-mono text-emerald-400">Live AI Feed Active</span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500">AI Confidence</span>
              <p className="text-sm font-bold text-amber-300 mt-0.5">{Math.round(alert.confidence * 100)}% Match</p>
              <span className="text-[10px] font-mono text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Description & Recommended SOP */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
              <strong>Incident Description: </strong> {alert.description}
            </div>

            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 leading-relaxed flex items-start gap-2.5">
              <ShieldAlert size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-blue-300">Mandatory Industrial SOP: </strong>
                <span>{alert.recommendedAction}</span>
              </div>
            </div>
          </div>

          {/* Automated Personnel Dispatch Status */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                <BellRing size={14} className="text-amber-400" />
                Automated Incident Dispatch Matrix
              </h3>
              <span className="text-[10px] font-mono text-emerald-400">Zero-Delay Broadcast</span>
            </div>

            <div className="space-y-2">
              {alert.dispatchedPersonnel.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-bold text-white">{p.role}</span>
                    <span className="text-slate-400">({p.name})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-blue-300 border border-slate-700">
                      via {p.channel}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suppression System Feedback */}
          {suppressionTriggered && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
              <span>
                <strong>Suppression Protocol Engaged:</strong> Halon gas dampers and sector foam cannons initiated in {alert.zoneName}.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEvacuate(alert.zoneId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all active:scale-95"
            >
              <Radio size={14} className="animate-spin" />
              <span>Order Sector Evacuation</span>
            </button>

            <button
              onClick={handleTriggerSuppression}
              disabled={suppressionTriggered}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/25 transition-all disabled:opacity-50"
            >
              <Flame size={14} />
              <span>{suppressionTriggered ? 'Suppression Active' : 'Activate Suppression'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAcknowledge}
              disabled={acknowledged}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{acknowledged ? 'Acknowledged' : 'Acknowledge & Log'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
