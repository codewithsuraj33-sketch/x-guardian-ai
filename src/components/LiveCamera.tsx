// ─────────────────────────────────────────────
// X-Guardian — Live Camera & Recorded Footage AI Surveillance Viewport
// High-tech industrial viewport with real-time bounding boxes for:
// Safety Gear (Helmets, Vests, Gloves, Footwear), Fire Presence & Smoke Presence
// ─────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  CameraStreamState,
  CameraErrorInfo,
  CameraFacingMode,
  VisionEngineStatus,
  Detection,
  PPEDetection,
  FireSmokeDetection,
  SkeletonPose,
  VideoFeedMode,
} from '../types';
import { renderIndustrialHUD } from '../services/aiVisionEngine';
import {
  Video,
  VideoOff,
  Radio,
  AlertOctagon,
  RefreshCw,
  Cpu,
  Maximize2,
  Minimize2,
  FlipHorizontal,
  Camera as CameraIcon,
  Flame,
  CloudFog,
  FileVideo,
  Upload,
  Play,
  Pause,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface LiveCameraProps {
  cameraId?: string;
  zoneName?: string;
  streamState: CameraStreamState;
  stream: MediaStream | null;
  error: CameraErrorInfo | null;
  facingMode?: CameraFacingMode;
  visionStatus?: VisionEngineStatus;
  inferenceFps?: number;
  detections?: Detection[];
  ppeSummary?: PPEDetection;
  fireSmoke?: FireSmokeDetection;
  skeletons?: SkeletonPose[];
  showSkeleton?: boolean;
  videoMode?: VideoFeedMode;
  recordedVideoSrc?: string;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onToggleFacingMode?: () => void;
  onVideoReady?: (video: HTMLVideoElement | null) => void;
  onSelectVideoMode?: (mode: VideoFeedMode) => void;
  onFileUpload?: (file: File) => void;
  onTriggerEmergency?: (hazard: 'FIRE' | 'SMOKE') => void;
  className?: string;
}

export default function LiveCamera({
  cameraId = 'CAM-01',
  zoneName = 'Entry',
  streamState,
  stream,
  error,
  facingMode = 'user',
  visionStatus = VisionEngineStatus.AI_READY,
  inferenceFps = 10,
  detections = [],
  ppeSummary,
  fireSmoke,
  skeletons,
  showSkeleton = true,
  videoMode = 'RECORDED_FOOTAGE',
  recordedVideoSrc,
  onStartCamera,
  onStopCamera,
  onToggleFacingMode,
  onVideoReady,
  onSelectVideoMode,
  onFileUpload,
  onTriggerEmergency,
  className = '',
}: LiveCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [resolution, setResolution] = useState<string>('1280x720');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState<boolean>(true);

  // Sync stream to video element when in WEBCAM mode
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (videoMode === 'WEBCAM') {
      if (stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
        onVideoReady?.(video);
      } else {
        video.srcObject = null;
        onVideoReady?.(null);
      }
    } else {
      // Recorded footage or uploaded file
      video.srcObject = null;
      if (recordedVideoSrc) {
        video.src = recordedVideoSrc;
        video.loop = true;
        video.muted = true;
        video.play().catch(() => {});
        onVideoReady?.(video);
      }
    }
  }, [stream, videoMode, recordedVideoSrc, onVideoReady]);

  // Animation frame loop to render the HUD overlay onto canvas
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video) {
        // Match canvas dimensions to container viewport
        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth || 640;
          canvas.height = video.clientHeight || 360;
        }

        renderIndustrialHUD({
          canvas,
          video,
          detections,
          ppeSummary,
          fireSmoke,
          skeletons,
          showSkeleton,
          cameraId,
          zoneName,
          fps: inferenceFps,
          inferenceMs: 24,
          isMirrored: videoMode === 'WEBCAM' && facingMode === 'user',
        });
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [detections, ppeSummary, fireSmoke, skeletons, showSkeleton, cameraId, zoneName, inferenceFps, videoMode, facingMode]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const w = videoRef.current.videoWidth;
      const h = videoRef.current.videoHeight;
      if (w && h) {
        setResolution(`${w}x${h}`);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  const toggleRecordedPlayback = () => {
    if (!videoRef.current) return;
    if (isPlayingRecorded) {
      videoRef.current.pause();
      setIsPlayingRecorded(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlayingRecorded(true);
    }
  };

  const isLive = (videoMode === 'WEBCAM' && streamState === CameraStreamState.LIVE && !!stream) ||
    videoMode === 'RECORDED_FOOTAGE' ||
    videoMode === 'FILE_UPLOAD';

  const hasFire = fireSmoke?.hasFire;
  const hasSmoke = fireSmoke?.hasSmoke;

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 border ${
        hasFire
          ? 'border-rose-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
          : hasSmoke
          ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.3)]'
          : 'border-slate-800 shadow-2xl'
      } flex flex-col justify-between select-none ${className}`}
    >
      {/* Video + Canvas HUD Viewport */}
      <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
        {/* HTMLVideoElement */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          loop
          onLoadedMetadata={handleLoadedMetadata}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLive ? 'opacity-100' : 'opacity-0'
          } ${videoMode === 'WEBCAM' && facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Dynamic AI Computer Vision HUD Overlay Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Top Control Overlay */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-20 pointer-events-auto">
          {/* Top Left: Camera Identification & Mode Pill */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-blue-600/90 backdrop-blur-md text-[11px] font-mono font-bold text-white shadow">
              X-GUARDIAN AI
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900/90 backdrop-blur-md text-[11px] font-mono font-bold text-slate-200 border border-slate-700/80">
              {cameraId} • {zoneName.toUpperCase()}
            </span>
            {hasFire && (
              <span className="px-2 py-0.5 rounded bg-rose-600 text-[11px] font-mono font-black text-white animate-pulse flex items-center gap-1">
                <Flame size={12} /> FIRE
              </span>
            )}
            {hasSmoke && (
              <span className="px-2 py-0.5 rounded bg-purple-600 text-[11px] font-mono font-black text-white animate-pulse flex items-center gap-1">
                <CloudFog size={12} /> SMOKE
              </span>
            )}
          </div>

          {/* Top Right: Status Badge & Utility Buttons */}
          <div className="flex items-center gap-2">
            {videoMode === 'WEBCAM' ? (
              isLive ? (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 backdrop-blur-md text-[11px] font-mono font-bold text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE CAM</span>
                </div>
              ) : streamState === CameraStreamState.REQUESTING_PERMISSION ? (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/50 backdrop-blur-md text-[11px] font-mono font-bold text-amber-300">
                  <RefreshCw size={12} className="animate-spin text-amber-400" />
                  <span>PERM REQ</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 backdrop-blur-md text-[11px] font-mono font-bold text-slate-400">
                  <span>OFFLINE</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/50 backdrop-blur-md text-[11px] font-mono font-bold text-blue-300">
                <FileVideo size={12} className="text-blue-400" />
                <span>CCTV REPLAY</span>
              </div>
            )}

            {/* Flip Camera button in WEBCAM mode */}
            {videoMode === 'WEBCAM' && onToggleFacingMode && (
              <button
                onClick={onToggleFacingMode}
                title={`Switch camera lens (Current: ${facingMode})`}
                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-colors"
              >
                <FlipHorizontal size={14} />
              </button>
            )}

            {/* Play/Pause for recorded playback */}
            {videoMode !== 'WEBCAM' && (
              <button
                onClick={toggleRecordedPlayback}
                title={isPlayingRecorded ? 'Pause Replay' : 'Resume Replay'}
                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-colors"
              >
                {isPlayingRecorded ? <Pause size={14} /> : <Play size={14} />}
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-colors"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        {/* Offline / Idle Fallback for Webcam */}
        {videoMode === 'WEBCAM' && !isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-950/90 backdrop-blur-sm">
            {streamState === CameraStreamState.REQUESTING_PERMISSION ? (
              <div className="space-y-3 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <RefreshCw size={24} className="animate-spin" />
                </div>
                <h3 className="text-base font-bold text-white">Camera Permission Requested</h3>
                <p className="text-xs text-slate-400">
                  Please click <strong>"Allow"</strong> in your browser to start optical streaming for {cameraId}.
                </p>
              </div>
            ) : streamState === CameraStreamState.ERROR && error ? (
              <div className="space-y-3 max-w-md">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                  <AlertOctagon size={24} />
                </div>
                <h3 className="text-base font-bold text-rose-300">Camera Unavailable</h3>
                <p className="text-xs text-slate-300">{error.message}</p>
                <div className="pt-2">
                  <button
                    onClick={onStartCamera}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <VideoOff size={28} />
                </div>
                <h3 className="text-base font-bold text-white">Live Camera Standby</h3>
                <p className="text-xs text-slate-400">
                  Activate your hardware camera or switch to recorded industrial footage above.
                </p>
                <div className="pt-2">
                  <button
                    onClick={onStartCamera}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25"
                  >
                    <Video size={15} />
                    <span>Start Webcam Feed</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Viewport Action Toolbar */}
      <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Source Mode Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono text-[11px] uppercase">Optical Source:</span>
          {onSelectVideoMode && (
            <div className="inline-flex p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
              <button
                onClick={() => onSelectVideoMode('RECORDED_FOOTAGE')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  videoMode === 'RECORDED_FOOTAGE'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Recorded CCTV
              </button>
              <button
                onClick={() => onSelectVideoMode('WEBCAM')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  videoMode === 'WEBCAM'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Webcam
              </button>
              <button
                onClick={() => {
                  onSelectVideoMode('FILE_UPLOAD');
                  fileInputRef.current?.click();
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                  videoMode === 'FILE_UPLOAD'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload size={11} />
                Upload Clip
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Stream Actions */}
        <div className="flex items-center gap-2">

          {videoMode === 'WEBCAM' && isLive && (
            <button
              onClick={onStopCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold"
            >
              <VideoOff size={13} />
              <span>Stop Stream</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
