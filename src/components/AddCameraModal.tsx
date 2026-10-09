// ─────────────────────────────────────────────
// X-Guardian — Add IP / Mobile / RTSP Camera Modal
// Allows connecting Mobile IP Webcams and CCTV RTSP streams
// ─────────────────────────────────────────────

import { useState } from 'react';
import {
  X,
  Camera as CameraIcon,
  Smartphone,
  Video,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  Shield,
  Zap,
} from 'lucide-react';
import { Camera, CameraStatus, Zone } from '../types';
import { registerCameraApi, testStreamConnectionApi } from '../services/visionService';

interface AddCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: Zone[];
  existingCameras: Camera[];
  onCameraAdded: (camera: Camera) => void;
}

type StreamPreset = 'IP_WEBCAM' | 'CCTV_RTSP';

export default function AddCameraModal({
  isOpen,
  onClose,
  zones,
  existingCameras,
  onCameraAdded,
}: AddCameraModalProps) {
  const [activePreset, setActivePreset] = useState<StreamPreset>('IP_WEBCAM');
  const [name, setName] = useState('Mobile IP Webcam');
  const [streamUrl, setStreamUrl] = useState('http://10.150.74.97:8080/video');
  const [selectedZone, setSelectedZone] = useState('ZONE-01');
  const [fps, setFps] = useState(15);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    resolution?: string;
    fps?: number;
    error?: string;
    message?: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const nextCamId = (() => {
    const nextNum = existingCameras.length + 1;
    return nextNum < 10 ? `CAM-0${nextNum}` : `CAM-${nextNum}`;
  })();

  const applyPreset = (preset: StreamPreset) => {
    setActivePreset(preset);
    setTestResult(null);
    setSubmitError(null);

    if (preset === 'IP_WEBCAM') {
      setName('Mobile IP Webcam');
      setStreamUrl('http://10.150.74.97:8080/video');
      setFps(15);
    } else if (preset === 'CCTV_RTSP') {
      setName('Industrial CCTV Node');
      setStreamUrl('rtsp://admin:123456@192.168.1.50:554/stream1');
      setFps(15);
    }
  };

  const handleTestConnection = async () => {
    if (!streamUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testStreamConnectionApi(streamUrl);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !streamUrl.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await registerCameraApi({
        id: nextCamId,
        name: name.trim(),
        zoneId: selectedZone,
        streamUrl: streamUrl.trim(),
        fps,
      });

      const newCamera: Camera = {
        cameraId: res.cameraId || nextCamId,
        name: name.trim(),
        zoneId: selectedZone,
        feedUrl: `/api/v1/stream/${res.cameraId || nextCamId}`,
        streamUrl: streamUrl.trim(),
        resolution: '1080p',
        fps,
        status: CameraStatus.ONLINE,
        isCustom: true,
      };

      onCameraAdded(newCamera);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to register camera');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <CameraIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Add Live Camera / RTSP / IP Feed</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {nextCamId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Connect your mobile phone IP Webcam or commercial CCTV for real-time YOLOv8 PPE detection.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Preset Selector Tabs (IP Webcam & CCTV RTSP only) */}
          <div>
            <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Select Camera Source Type:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'IP_WEBCAM',
                  title: 'Mobile App (IP Webcam)',
                  desc: 'Android Mobile Camera Feed',
                  icon: Smartphone,
                  color: 'text-emerald-400',
                  badge: 'Recommended for Phone',
                },
                {
                  id: 'CCTV_RTSP',
                  title: 'Commercial CCTV (RTSP)',
                  desc: 'Industrial Camera / NVR Stream',
                  icon: Video,
                  color: 'text-amber-400',
                  badge: 'RTSP Protocol',
                },
              ].map((p) => {
                const Icon = p.icon;
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id as StreamPreset)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-600/15 ring-2 ring-blue-500/40 shadow-lg'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                      <Icon size={22} className={p.color} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white leading-tight">{p.title}</span>
                      </div>
                      <span className="text-xs text-slate-400 block mt-0.5">{p.desc}</span>
                      <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {p.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Setup Instructions Callout */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-semibold">
              <HelpCircle size={15} />
              <span>How to setup this stream:</span>
            </div>

            {activePreset === 'IP_WEBCAM' ? (
              <ol className="list-decimal list-inside text-slate-300 space-y-1.5 pl-1">
                <li>
                  Open <strong className="text-white">IP Webcam</strong> app on your Android phone.
                </li>
                <li>Make sure phone and laptop are connected to the same Wi-Fi network.</li>
                <li>
                  Scroll to bottom in the app and tap <strong className="text-emerald-400">"Start server"</strong>.
                </li>
                <li>
                  Enter the IPv4 URL displayed on your phone with <code className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300">/video</code> (e.g. <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">http://10.150.74.97:8080/video</code>).
                </li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside text-slate-300 space-y-1 pl-1">
                <li>Standard CCTV formats: <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">rtsp://user:pass@&lt;ip&gt;:554/stream1</code></li>
                <li>Hikvision: <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">rtsp://admin:pass@&lt;ip&gt;:554/Streaming/Channels/101</code></li>
                <li>Dahua / CP Plus: <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">rtsp://admin:pass@&lt;ip&gt;:554/cam/realmonitor?channel=1&subtype=0</code></li>
              </ol>
            )}
          </div>

          {/* Form Fields */}
          <form id="add-camera-form" onSubmit={handleSaveCamera} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Camera Name:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mobile IP Webcam"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Assigned Factory Zone:
                </label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.id}: {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Stream URL (IP Address / RTSP Endpoint):
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  Supports: HTTP MJPEG / RTSP
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={streamUrl}
                  onChange={(e) => {
                    setStreamUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="http://10.150.74.97:8080/video or rtsp://..."
                  required
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !streamUrl.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-blue-400" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="text-amber-400" />
                      <span>Test Ping</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Result Feedback */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
                    : 'border-rose-500/50 bg-rose-950/40 text-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">
                    {testResult.success
                      ? testResult.message || 'Stream successfully reachable!'
                      : 'Connection Warning'}
                  </p>
                  {testResult.error && (
                    <p className="text-[11px] opacity-90 mt-0.5">{testResult.error}</p>
                  )}
                  {testResult.success && testResult.resolution && (
                    <p className="text-[11px] opacity-80 mt-0.5 font-mono">
                      Feed Resolution: {testResult.resolution} • {testResult.fps ?? 15} FPS
                    </p>
                  )}
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-3 rounded-xl border border-rose-500 bg-rose-950/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-400 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Stream Sampling FPS:</span>
                {[5, 10, 15, 25, 30].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFps(rate)}
                    className={`px-2 py-1 rounded-md text-xs font-mono font-bold border transition-colors ${
                      fps === rate
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield size={14} className="text-emerald-400" />
            <span>Real-time YOLOv8 PPE detection runs automatically on added streams</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-camera-form"
              disabled={submitting || !streamUrl.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Connecting Feed...</span>
                </>
              ) : (
                <>
                  <CameraIcon size={14} />
                  <span>Add Camera to Matrix</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
