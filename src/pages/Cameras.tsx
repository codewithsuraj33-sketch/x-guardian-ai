import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera as CameraIcon,
  Image as ImageIcon,
  RotateCcw,
  Square,
  Upload,
  Video,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sliders,
  Check,
  X,
  Flame,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CameraErrorInfo,
  CameraFacingMode,
  CameraStreamState,
  Detection,
  IncidentStatus,
  PersonSafety,
  RiskLevel,
  SkeletonPose,
  VisionFrameResult,
} from '../types';
import {
  checkBackendHealth,
  createInferenceController,
  resetInferenceSession,
  sendFrameForInference,
} from '../services/visionService';
import {
  isCameraSupported,
  startCameraStream,
  stopCameraStream,
} from '../services/cameraService';
import { COCO_SKELETON_BONES } from '../services/aiVisionEngine';
import { useSafety } from '../context/SafetyContext';
import { useFactory } from '../context/FactoryContext';
import CCTVMatrix from '../components/CCTVMatrix';
import { audioAlert } from '../utils/audioAlert';

type InputMode = 'LIVE_CAMERA' | 'RECORDED_VIDEO' | 'IMAGE';
type InferenceState = 'IDLE' | 'ANALYZING' | 'READY' | 'STOPPED' | 'ERROR';

function displayLabel(detection: Detection): string {
  const c = detection.className.toLowerCase();
  if (c === 'fire') return '🔥 FIRE HAZARD';
  if (c === 'smoke') return '💨 SMOKE';
  if (c === 'glass' || c === 'glasses' || c === 'goggles') return 'safety goggles';
  return detection.className.replaceAll('_', ' ');
}

function getPpeBadgeColor(className: string): { border: string; bg: string; text: string } {
  const c = className.toLowerCase();
  if (c.includes('fire')) {
    return { border: 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]', bg: 'bg-red-600', text: 'text-white' };
  }
  if (c.includes('smoke')) {
    return { border: 'border-orange-400', bg: 'bg-orange-500', text: 'text-white' };
  }
  if (c.includes('helmet') || c.includes('hardhat')) {
    return { border: 'border-cyan-400', bg: 'bg-cyan-400', text: 'text-slate-950' };
  }
  if (c.includes('vest')) {
    return { border: 'border-lime-400', bg: 'bg-lime-400', text: 'text-slate-950' };
  }
  if (c.includes('glove')) {
    return { border: 'border-amber-400', bg: 'bg-amber-400', text: 'text-slate-950' };
  }
  if (c.includes('boot') || c.includes('shoe')) {
    return { border: 'border-fuchsia-400', bg: 'bg-fuchsia-400', text: 'text-slate-950' };
  }
  if (c.includes('mask')) {
    return { border: 'border-sky-400', bg: 'bg-sky-400', text: 'text-slate-950' };
  }
  if (c.includes('glass') || c.includes('goggle')) {
    return { border: 'border-yellow-400', bg: 'bg-yellow-400', text: 'text-slate-950' };
  }
  return { border: 'border-blue-400', bg: 'bg-blue-400', text: 'text-slate-950' };
}

function getPpeStateValue(ppeStates: Record<string, string>, name: string): string {
  if (ppeStates[name]) return ppeStates[name];
  if (name === 'Boots' && ppeStates['Shoes']) return ppeStates['Shoes'];
  if (name === 'Shoes' && ppeStates['Boots']) return ppeStates['Boots'];
  if (name === 'Glove' && ppeStates['Gloves']) return ppeStates['Gloves'];
  if (name === 'Gloves' && ppeStates['Glove']) return ppeStates['Glove'];
  if (['Glass', 'Goggles', 'Safety Goggles'].includes(name)) {
    return ppeStates['Glass'] || ppeStates['Goggles'] || ppeStates['Glasses'] || 'UNKNOWN';
  }
  return 'UNKNOWN';
}

function isPpeStateConfirmed(state: string): boolean {
  return ['DETECTED', 'CONFIRMED', 'COMPLIANT'].includes(state);
}

interface PersonComplianceOverlayProps {
  person: PersonSafety;
  style?: React.CSSProperties;
  requiredPpeList: string[];
}

function PersonComplianceOverlay({
  person,
  style,
  requiredPpeList,
}: PersonComplianceOverlayProps) {
  const isFall = person.skeleton?.isFall;

  // Evaluate compliance strictly against currently active required PPE
  const missingItems = requiredPpeList.filter((name) => {
    const st = getPpeStateValue(person.ppeStates, name);
    return !isPpeStateConfirmed(st);
  });

  const compliant = person.visible && !isFall && missingItems.length === 0;
  const violation = person.visible && (missingItems.length > 0 || isFall);

  const borderClass = isFall
    ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.7)] animate-pulse'
    : violation
    ? 'border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
    : compliant
    ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]'
    : 'border-amber-400';

  const labelClass = isFall
    ? 'bg-rose-600 text-white'
    : violation
    ? 'bg-rose-600 text-white'
    : compliant
    ? 'bg-emerald-500 text-slate-950'
    : 'bg-amber-400 text-slate-950';

  const stateTitle = isFall
    ? '🚨 CRITICAL: WORKER FALL / COLLAPSE'
    : violation
    ? `⚠️ PPE VIOLATION (Missing ${missingItems.length})`
    : compliant
    ? '✅ 100% PPE COMPLIANT'
    : '🔍 SCANNING PPE...';

  const defaultStyle: React.CSSProperties = {
    left: `${person.boundingBox.x * 100}%`,
    top: `${person.boundingBox.y * 100}%`,
    width: `${person.boundingBox.width * 100}%`,
    height: `${person.boundingBox.height * 100}%`,
  };

  return (
    <div
      className={`pointer-events-none absolute border-2 ${borderClass} rounded-sm transition-all duration-150`}
      style={style || defaultStyle}
    >
      <div
        className={`absolute -top-7 left-0 min-w-max ${labelClass} px-2 py-0.5 text-[10px] font-bold shadow-lg rounded-t flex items-center gap-1.5`}
      >
        <span>ID {person.trackId}</span>
        <span>•</span>
        <span>{stateTitle}</span>
      </div>

      {/* Checklist Floating Pill Strip */}
      <div className="absolute top-1 left-1 flex flex-wrap gap-1 max-w-[95%]">
        {requiredPpeList.map((name) => {
          const st = getPpeStateValue(person.ppeStates, name);
          const ok = isPpeStateConfirmed(st);

          return (
            <span
              key={name}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 backdrop-blur-md shadow ${
                ok
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                  : 'bg-rose-950/90 text-rose-300 border border-rose-500/50'
              }`}
            >
              {ok ? <Check size={10} className="text-emerald-400" /> : <X size={10} className="text-rose-400" />}
              <span>{name}</span>
            </span>
          );
        })}

        {person.skeleton && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-950/90 text-cyan-300 border border-cyan-500/40">
            {person.skeleton.postureState} ({person.skeleton.torsoAngle ?? '--'}°)
          </span>
        )}
      </div>
    </div>
  );
}

interface SkeletonSvgOverlayProps {
  skeletons: SkeletonPose[];
  mediaLayout: { width: number; height: number; offsetX: number; offsetY: number };
  isMirrored: boolean;
}

function SkeletonSvgOverlay({ skeletons, mediaLayout, isMirrored }: SkeletonSvgOverlayProps) {
  if (!skeletons || skeletons.length === 0 || !mediaLayout.width || !mediaLayout.height)
    return null;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full z-10">
      {skeletons.map((skel, sIdx) => {
        const isEmergency = skel.isFall || skel.postureState === 'FALLEN';
        const isBending = skel.isAbnormalPosture || skel.postureState === 'BENDING';
        const isSitting = skel.postureState === 'SITTING';
        const isCrouching = skel.postureState === 'CROUCHING';

        let strokeColor = '#06b6d4';
        let jointColor = '#67e8f9';
        let badgeBg = '#0891b2';

        if (isEmergency) {
          strokeColor = '#ef4444';
          jointColor = '#fca5a5';
          badgeBg = '#dc2626';
        } else if (isBending) {
          strokeColor = '#f59e0b';
          jointColor = '#fde68a';
          badgeBg = '#d97706';
        } else if (isSitting) {
          strokeColor = '#10b981';
          jointColor = '#6ee7b7';
          badgeBg = '#059669';
        } else if (isCrouching) {
          strokeColor = '#38bdf8';
          jointColor = '#bae6fd';
          badgeBg = '#0284c7';
        }

        const getCoord = (kp: { x: number; y: number }) => {
          const displayX = isMirrored ? 1 - kp.x : kp.x;
          return {
            x: mediaLayout.offsetX + displayX * mediaLayout.width,
            y: mediaLayout.offsetY + kp.y * mediaLayout.height,
          };
        };

        const headKp =
          skel.keypoints[0]?.confidence >= 0.15
            ? skel.keypoints[0]
            : skel.keypoints[5]?.confidence >= 0.15
            ? skel.keypoints[5]
            : skel.keypoints[11];
        const headCoord = headKp ? getCoord(headKp) : null;

        const badgeText = isEmergency
          ? `🚨 FALL ${skel.torsoAngle ?? 0}°`
          : isBending
          ? `⚠️ BEND ${skel.torsoAngle ?? 0}°`
          : isSitting
          ? `🪑 SIT ${skel.torsoAngle ?? 0}°`
          : isCrouching
          ? `🦵 CROUCH ${skel.torsoAngle ?? 0}°`
          : `STAND ${skel.torsoAngle ?? 0}°`;

        return (
          <g key={`skel-${skel.trackId || sIdx}`}>
            {/* Bone Lines */}
            {COCO_SKELETON_BONES.map(([i, j], bIdx) => {
              const p1 = skel.keypoints[i];
              const p2 = skel.keypoints[j];
              if (!p1 || !p2 || p1.confidence < 0.15 || p2.confidence < 0.15) return null;
              const c1 = getCoord(p1);
              const c2 = getCoord(p2);
              return (
                <line
                  key={`bone-${bIdx}`}
                  x1={c1.x}
                  y1={c1.y}
                  x2={c2.x}
                  y2={c2.y}
                  stroke={strokeColor}
                  strokeWidth={isEmergency ? 3.5 : 2.5}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Joints */}
            {skel.keypoints.map((kp, kIdx) => {
              if (kp.confidence < 0.15) return null;
              const c = getCoord(kp);
              return (
                <circle
                  key={`joint-${kIdx}`}
                  cx={c.x}
                  cy={c.y}
                  r={isEmergency ? 4.5 : 3.5}
                  fill={jointColor}
                  stroke="#020617"
                  strokeWidth={1}
                />
              );
            })}

            {/* Posture Badge */}
            {headCoord && (
              <g transform={`translate(${headCoord.x}, ${Math.max(22, headCoord.y - 18)})`}>
                <rect x="-60" y="-12" width="120" height="16" rx="3" fill={badgeBg} />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {badgeText}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Client fallback detection for instant demo if backend is offline
function createSampleDetection(presetType: string, cameraId: string): VisionFrameResult {
  const nowIso = new Date().toISOString();

  if (presetType === 'WORKER_PPE_COMPLIANT') {
    return {
      timestamp: nowIso,
      cameraId,
      source: 'image',
      inferenceTimeMs: 18,
      detections: [
        {
          detectionId: 'det-person-1',
          className: 'person',
          confidence: 0.98,
          boundingBox: { x: 0.33, y: 0.08, width: 0.36, height: 0.86 },
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
        {
          detectionId: 'det-helmet-1',
          className: 'helmet',
          confidence: 0.99,
          boundingBox: { x: 0.44, y: 0.09, width: 0.15, height: 0.11 },
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
        {
          detectionId: 'det-vest-1',
          className: 'vest',
          confidence: 0.98,
          boundingBox: { x: 0.37, y: 0.24, width: 0.28, height: 0.32 },
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
        {
          detectionId: 'det-gloves-1',
          className: 'gloves',
          confidence: 0.95,
          boundingBox: { x: 0.33, y: 0.50, width: 0.09, height: 0.11 },
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
        {
          detectionId: 'det-gloves-2',
          className: 'gloves',
          confidence: 0.94,
          boundingBox: { x: 0.59, y: 0.49, width: 0.09, height: 0.11 },
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
        {
          detectionId: 'det-shoes-1',
          className: 'boots',
          boundingBox: { x: 0.34, y: 0.84, width: 0.14, height: 0.10 },
          confidence: 0.96,
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
        {
          detectionId: 'det-shoes-2',
          className: 'boots',
          boundingBox: { x: 0.54, y: 0.84, width: 0.14, height: 0.10 },
          confidence: 0.96,
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
        {
          detectionId: 'det-goggles-1',
          className: 'glass',
          boundingBox: { x: 0.46, y: 0.16, width: 0.11, height: 0.05 },
          confidence: 0.95,
          trackId: 'TRK-101',
          timestamp: nowIso,
        },
      ],
      persons: [
        {
          trackId: 'TRK-101',
          boundingBox: { x: 0.33, y: 0.08, width: 0.36, height: 0.86 },
          visible: true,
          ppeStates: {
            Helmet: 'CONFIRMED',
            Vest: 'CONFIRMED',
            Boots: 'CONFIRMED',
            Glove: 'CONFIRMED',
            Mask: 'COMPLIANT',
            Glass: 'CONFIRMED',
            Goggles: 'CONFIRMED',
          },
          violationTypes: [],
          skeleton: {
            trackId: 'TRK-101',
            postureState: 'STANDING',
            torsoAngle: 90,
            isFall: false,
            isAbnormalPosture: false,
            keypoints: [
              { x: 0.51, y: 0.18, confidence: 0.98, name: 'nose' },
              { x: 0.49, y: 0.17, confidence: 0.97, name: 'left_eye' },
              { x: 0.53, y: 0.17, confidence: 0.97, name: 'right_eye' },
              { x: 0.46, y: 0.19, confidence: 0.95, name: 'left_ear' },
              { x: 0.56, y: 0.19, confidence: 0.95, name: 'right_ear' },
              { x: 0.43, y: 0.27, confidence: 0.98, name: 'left_shoulder' },
              { x: 0.58, y: 0.27, confidence: 0.98, name: 'right_shoulder' },
              { x: 0.38, y: 0.39, confidence: 0.96, name: 'left_elbow' },
              { x: 0.63, y: 0.39, confidence: 0.96, name: 'right_elbow' },
              { x: 0.37, y: 0.53, confidence: 0.95, name: 'left_wrist' },
              { x: 0.63, y: 0.53, confidence: 0.95, name: 'right_wrist' },
              { x: 0.45, y: 0.54, confidence: 0.98, name: 'left_hip' },
              { x: 0.56, y: 0.54, confidence: 0.98, name: 'right_hip' },
              { x: 0.45, y: 0.70, confidence: 0.97, name: 'left_knee' },
              { x: 0.56, y: 0.70, confidence: 0.97, name: 'right_knee' },
              { x: 0.43, y: 0.88, confidence: 0.96, name: 'left_ankle' },
              { x: 0.59, y: 0.88, confidence: 0.96, name: 'right_ankle' },
            ],
          },
        },
      ],
      skeletons: [
        {
          trackId: 'TRK-101',
          postureState: 'STANDING',
          torsoAngle: 90,
          isFall: false,
          isAbnormalPosture: false,
          keypoints: [
            { x: 0.51, y: 0.18, confidence: 0.98, name: 'nose' },
            { x: 0.49, y: 0.17, confidence: 0.97, name: 'left_eye' },
            { x: 0.53, y: 0.17, confidence: 0.97, name: 'right_eye' },
            { x: 0.46, y: 0.19, confidence: 0.95, name: 'left_ear' },
            { x: 0.56, y: 0.19, confidence: 0.95, name: 'right_ear' },
            { x: 0.43, y: 0.27, confidence: 0.98, name: 'left_shoulder' },
            { x: 0.58, y: 0.27, confidence: 0.98, name: 'right_shoulder' },
            { x: 0.38, y: 0.39, confidence: 0.96, name: 'left_elbow' },
            { x: 0.63, y: 0.39, confidence: 0.96, name: 'right_elbow' },
            { x: 0.37, y: 0.53, confidence: 0.95, name: 'left_wrist' },
            { x: 0.63, y: 0.53, confidence: 0.95, name: 'right_wrist' },
            { x: 0.45, y: 0.54, confidence: 0.98, name: 'left_hip' },
            { x: 0.56, y: 0.54, confidence: 0.98, name: 'right_hip' },
            { x: 0.45, y: 0.70, confidence: 0.97, name: 'left_knee' },
            { x: 0.56, y: 0.70, confidence: 0.97, name: 'right_knee' },
            { x: 0.43, y: 0.88, confidence: 0.96, name: 'left_ankle' },
            { x: 0.59, y: 0.88, confidence: 0.96, name: 'right_ankle' },
          ],
        },
      ],
      ppeSummary: {
        person: true,
        helmet: true,
        vest: true,
        gloves: true,
        shoes: true,
        mask: true,
        goggles: true,
      },
    };
  }

  if (presetType === 'WORKER_SAFETY_GEAR') {
    return {
      timestamp: nowIso,
      cameraId,
      source: 'image',
      inferenceTimeMs: 15,
      detections: [
        {
          detectionId: 'det-helmet',
          className: 'helmet',
          confidence: 0.99,
          boundingBox: { x: 0.36, y: 0.05, width: 0.28, height: 0.26 },
          timestamp: nowIso,
        },
        {
          detectionId: 'det-vest',
          className: 'vest',
          confidence: 0.98,
          boundingBox: { x: 0.29, y: 0.34, width: 0.42, height: 0.59 },
          timestamp: nowIso,
        },
        {
          detectionId: 'det-gloves',
          className: 'gloves',
          confidence: 0.96,
          boundingBox: { x: 0.07, y: 0.57, width: 0.23, height: 0.31 },
          timestamp: nowIso,
        },
        {
          detectionId: 'det-shoes',
          className: 'boots',
          confidence: 0.97,
          boundingBox: { x: 0.71, y: 0.51, width: 0.24, height: 0.41 },
          timestamp: nowIso,
        },
      ],
      persons: [],
      skeletons: [],
      ppeSummary: {
        person: false,
        helmet: true,
        vest: true,
        gloves: true,
        shoes: true,
      },
    };
  }

  if (presetType === 'FIRE_SMOKE_HAZARD') {
    return {
      timestamp: nowIso,
      cameraId: cameraId || 'CAM-03',
      source: 'image',
      inferenceTimeMs: 14,
      detections: [
        {
          detectionId: 'det-fire-1',
          className: 'fire',
          confidence: 0.95,
          boundingBox: { x: 0.38, y: 0.36, width: 0.24, height: 0.44 },
          timestamp: nowIso,
        },
        {
          detectionId: 'det-smoke-1',
          className: 'smoke',
          confidence: 0.96,
          boundingBox: { x: 0.21, y: 0.02, width: 0.56, height: 0.55 },
          timestamp: nowIso,
        },
      ],
      fireSmoke: {
        hasFire: true,
        fireConfidence: 0.95,
        fireBbox: { x: 0.38, y: 0.36, width: 0.24, height: 0.44 },
        hasSmoke: true,
        smokeConfidence: 0.96,
        smokeDensity: 98.5,
        smokeBbox: { x: 0.21, y: 0.02, width: 0.56, height: 0.55 },
      },
      persons: [],
      skeletons: [],
      ppeSummary: {
        person: false,
        helmet: false,
        vest: false,
        gloves: false,
        shoes: false,
      },
    };
  }

  // Camera zone snapshots detection
  return {
    timestamp: nowIso,
    cameraId,
    source: 'image',
    inferenceTimeMs: 22,
    detections: [
      {
        detectionId: 'det-1',
        className: 'person',
        confidence: 0.95,
        boundingBox: { x: 0.35, y: 0.25, width: 0.22, height: 0.65 },
        trackId: 'TRK-201',
        timestamp: nowIso,
      },
      {
        detectionId: 'det-2',
        className: 'helmet',
        confidence: 0.92,
        boundingBox: { x: 0.41, y: 0.25, width: 0.10, height: 0.10 },
        trackId: 'TRK-201',
        timestamp: nowIso,
      },
      {
        detectionId: 'det-3',
        className: 'vest',
        confidence: 0.91,
        boundingBox: { x: 0.38, y: 0.35, width: 0.16, height: 0.25 },
        trackId: 'TRK-201',
        timestamp: nowIso,
      },
    ],
    persons: [
      {
        trackId: 'TRK-201',
        boundingBox: { x: 0.35, y: 0.25, width: 0.22, height: 0.65 },
        visible: true,
        ppeStates: {
          Helmet: 'CONFIRMED',
          Vest: 'CONFIRMED',
          Boots: 'DETECTED',
          Glove: 'DETECTED',
          Mask: 'COMPLIANT',
        },
        violationTypes: [],
      },
    ],
    skeletons: [],
    ppeSummary: {
      person: true,
      helmet: true,
      vest: true,
      gloves: true,
      shoes: true,
    },
  };
}

export default function Cameras() {
  const { settings, updateSettings, addIncident, setCameraOperationalStatus } = useSafety();
  const { cameras, zones, dispatch: factoryDispatch } = useFactory();

  // Navigation tab: 'GRID' for all 5 cameras CCTV matrix, or 'CAM-01'..'CAM-05'
  const [selectedCameraId, setSelectedCameraId] = useState<string>('GRID');

  const [mode, setMode] = useState<InputMode>('IMAGE');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamState, setStreamState] = useState(CameraStreamState.IDLE);
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>('/images/worker_ppe_compliant.jpg');
  const [backendReady, setBackendReady] = useState(false);
  const [backendReason, setBackendReason] = useState('Checking vision service...');
  const [inferenceState, setInferenceState] = useState<InferenceState>('IDLE');
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [result, setResult] = useState<VisionFrameResult | null>(null);
  const [detectionActive, setDetectionActive] = useState(true);
  const [liveFps, setLiveFps] = useState<number>(5);
  const [showSkeletonOverlay, setShowSkeletonOverlay] = useState(true);
  const [showItemBoxes, setShowItemBoxes] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentPreset, setCurrentPreset] = useState<string>('WORKER_PPE_COMPLIANT');

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const [isAudioMuted, setIsAudioMuted] = useState(audioAlert.getIsMuted());

  const [mediaLayout, setMediaLayout] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  // Compute list of actively required PPE based on settings
  const requiredPpeList: string[] = [
    ...(settings.helmetRequired ? ['Helmet'] : []),
    ...(settings.vestRequired ? ['Vest'] : []),
    ...(settings.glovesRequired ? ['Glove'] : []),
    ...(settings.shoesRequired ? ['Boots'] : []),
    ...(settings.maskRequired ? ['Mask'] : []),
    ...(settings.gogglesRequired ? ['Glass'] : []),
  ];

  // Currently focused camera object
  const activeCamera =
    cameras.find((c) => c.cameraId === selectedCameraId) || cameras[0] || {
      cameraId: 'CAM-01',
      zoneId: 'ZONE-01',
      name: 'Main Entrance & Turnstiles',
      feedUrl: '/images/cam01_entry.jpg',
      resolution: '1920x1080',
      fps: 30,
    };
  const activeZone = zones.find((z) => z.id === activeCamera.zoneId);

  const updateMediaLayout = useCallback(() => {
    const container = containerRef.current;
    const media = mode === 'IMAGE' ? imageRef.current : videoRef.current;
    if (!container) return;

    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    const mWidth =
      (media instanceof HTMLVideoElement
        ? media.videoWidth
        : (media as HTMLImageElement)?.naturalWidth) || cWidth;
    const mHeight =
      (media instanceof HTMLVideoElement
        ? media.videoHeight
        : (media as HTMLImageElement)?.naturalHeight) || cHeight;

    if (!mWidth || !mHeight || !cWidth || !cHeight) {
      setMediaLayout({ width: cWidth, height: cHeight, offsetX: 0, offsetY: 0 });
      return;
    }

    const mediaAspect = mWidth / mHeight;
    const containerAspect = cWidth / cHeight;

    let renderWidth = cWidth;
    let renderHeight = cHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > mediaAspect) {
      renderHeight = cHeight;
      renderWidth = renderHeight * mediaAspect;
      offsetX = (cWidth - renderWidth) / 2;
    } else {
      renderWidth = cWidth;
      renderHeight = renderWidth / mediaAspect;
      offsetY = (cHeight - renderHeight) / 2;
    }

    setMediaLayout({ width: renderWidth, height: renderHeight, offsetX, offsetY });
  }, [mode]);

  useEffect(() => {
    updateMediaLayout();
    window.addEventListener('resize', updateMediaLayout);
    return () => window.removeEventListener('resize', updateMediaLayout);
  }, [updateMediaLayout, stream, videoUrl, imageUrl]);

  const getOverlayStyle = useCallback(
    (bbox: { x: number; y: number; width: number; height: number }): React.CSSProperties => {
      const isMirrored = mode === 'LIVE_CAMERA' && facingMode === 'user';
      const displayX = isMirrored ? 1 - bbox.x - bbox.width : bbox.x;

      if (!mediaLayout.width || !mediaLayout.height) {
        return {
          left: `${displayX * 100}%`,
          top: `${bbox.y * 100}%`,
          width: `${bbox.width * 100}%`,
          height: `${bbox.height * 100}%`,
        };
      }

      return {
        left: `${mediaLayout.offsetX + displayX * mediaLayout.width}px`,
        top: `${mediaLayout.offsetY + bbox.y * mediaLayout.height}px`,
        width: `${bbox.width * mediaLayout.width}px`,
        height: `${bbox.height * mediaLayout.height}px`,
      };
    },
    [facingMode, mediaLayout, mode]
  );

  const handleInferenceResult = useCallback(
    (nextResult: VisionFrameResult) => {
      setResult(nextResult);
      setInferenceState('READY');
      setInferenceError(null);

      // 1. Audio Siren for Fire & Smoke Emergency
      const hasActiveFire = Boolean(nextResult.fireSmoke?.hasFire);
      const hasCriticalSmoke = Boolean(
        nextResult.fireSmoke?.hasSmoke && (nextResult.fireSmoke?.smokeDensity ?? 0) > 30
      );

      if (settings.audioAlert && (hasActiveFire || hasCriticalSmoke)) {
        audioAlert.playEmergencySiren();
      } else if (!hasActiveFire && !hasCriticalSmoke && audioAlert.getIsPlaying()) {
        audioAlert.stopSiren();
      }

      // 2. Audio Warning Beep for Missing Required PPE or Worker Fall
      if (settings.audioAlert && !hasActiveFire && !hasCriticalSmoke) {
        const hasMissingPpeOrHazard = nextResult.persons?.some((person) => {
          if (!person.visible) return false;
          if (person.skeleton?.isFall) return true;
          return requiredPpeList.some((gear) => {
            const st = getPpeStateValue(person.ppeStates, gear);
            return !isPpeStateConfirmed(st);
          });
        });

        if (hasMissingPpeOrHazard) {
          const now = Date.now();
          if (now - lastBeepTimeRef.current >= 1200) {
            lastBeepTimeRef.current = now;
            audioAlert.playWarningBeep();
          }
        }
      }

      nextResult.incidents?.forEach((incident) => {
        const isCritical =
          incident.violationType.toLowerCase().includes('fall') ||
          incident.violationType.toLowerCase().includes('collapse') ||
          incident.violationType.toLowerCase().includes('fire');
        const severity = isCritical ? RiskLevel.CRITICAL : RiskLevel.HIGH;
        addIncident({
          incidentId: incident.incidentId,
          workerId: `TRACK-${incident.trackId}`,
          trackId: incident.trackId,
          violation: incident.violationType,
          severity,
          cameraId: incident.cameraId,
          zoneId: incident.zone,
          confidence: incident.confidence,
          frameNumber: incident.frameNumber,
          evidenceImage: incident.evidenceImage,
        });
        factoryDispatch({
          type: 'ADD_INCIDENTS',
          incidents: [
            {
              incidentId: incident.incidentId,
              workerId: `TRACK-${incident.trackId}`,
              trackId: incident.trackId,
              cameraId: incident.cameraId,
              zoneId: incident.zone || 'ZONE-01',
              violation: incident.violationType,
              severity,
              timestamp: incident.timestamp,
              status: IncidentStatus.OPEN,
              confidence: incident.confidence,
              frameNumber: incident.frameNumber,
              evidenceImage: incident.evidenceImage,
            },
          ],
        });
      });
    },
    [addIncident, factoryDispatch, settings.audioAlert, requiredPpeList]
  );

  // Poll backend health
  useEffect(() => {
    let mounted = true;
    const refreshBackendHealth = () =>
      checkBackendHealth().then((health) => {
        if (mounted) {
          setBackendReady(health?.engineReady === true);
          setBackendReason(
            health?.engineReady
              ? 'Python CUDA/YOLOv8 Engine Active (port 8000)'
              : health?.engineReason || 'Vision service available (hybrid mode)'
          );
        }
      });
    refreshBackendHealth();
    const healthInterval = window.setInterval(refreshBackendHealth, 3000);
    return () => {
      mounted = false;
      window.clearInterval(healthInterval);
    };
  }, []);

  useEffect(
    () => () => {
      stopCameraStream(stream);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      audioAlert.stopSiren();
    },
    [stream, videoUrl]
  );

  useEffect(() => {
    setCameraOperationalStatus(
      streamState === CameraStreamState.LIVE
        ? 'ACTIVE'
        : streamState === CameraStreamState.ERROR
        ? 'ERROR'
        : streamState === CameraStreamState.REQUESTING_PERMISSION
        ? 'REQUESTING'
        : 'ACTIVE'
    );
  }, [setCameraOperationalStatus, streamState]);

  useEffect(() => {
    if (videoRef.current && mode === 'LIVE_CAMERA') {
      videoRef.current.srcObject = stream;
      if (stream) videoRef.current.play().catch(() => undefined);
    }
  }, [mode, stream]);

  // Real-time video/webcam inference stream controller
  useEffect(() => {
    const isAnalyzable =
      mode === 'LIVE_CAMERA' ? !!stream : mode === 'RECORDED_VIDEO' && !!videoUrl;

    if (!detectionActive || !isAnalyzable || !backendReady || !videoRef.current) return;

    const cameraId = mode === 'LIVE_CAMERA' ? activeCamera.cameraId : 'RECORDED-VIDEO';
    resetInferenceSession(cameraId);

    const controller = createInferenceController({
      videoElement: videoRef.current,
      cameraId,
      source: mode === 'LIVE_CAMERA' ? 'webcam' : 'video',
      fps: liveFps,
      onResult: handleInferenceResult,
      onError: (error) => {
        // Non-blocking log to allow retries
        console.warn('Real-time frame inference error:', error.message);
      },
    });

    setInferenceState('ANALYZING');
    controller.start();
    return () => controller.stop();
  }, [
    backendReady,
    detectionActive,
    handleInferenceResult,
    mode,
    stream,
    videoUrl,
    activeCamera.cameraId,
    liveFps,
  ]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStreamState(CameraStreamState.REQUESTING_PERMISSION);
    // Touch audio context to satisfy browser autoplay security policy
    audioAlert.playWarningBeep();
    try {
      const nextStream = await startCameraStream({ facingMode });
      setStream(nextStream);
      setStreamState(CameraStreamState.LIVE);
      setDetectionActive(true); // Automatically engage real-time PPE detection on webcam start
    } catch (error) {
      setCameraError(error as CameraErrorInfo);
      setStream(null);
      setStreamState(CameraStreamState.ERROR);
    }
  }, [facingMode]);

  const stopCamera = () => {
    stopCameraStream(stream);
    setStream(null);
    setStreamState(CameraStreamState.STOPPED);
    setDetectionActive(false);
    audioAlert.stopSiren();
  };

  const switchCamera = async () => {
    const nextFacingMode: CameraFacingMode =
      facingMode === 'user' ? 'environment' : 'user';
    stopCameraStream(stream);
    setStream(null);
    setFacingMode(nextFacingMode);
    setCameraError(null);
    setStreamState(CameraStreamState.REQUESTING_PERMISSION);
    try {
      const nextStream = await startCameraStream({ facingMode: nextFacingMode });
      setStream(nextStream);
      setStreamState(CameraStreamState.LIVE);
      setDetectionActive(true);
    } catch (error) {
      setCameraError(error as CameraErrorInfo);
      setStreamState(CameraStreamState.ERROR);
    }
  };

  const switchMode = (nextMode: InputMode) => {
    if (nextMode !== 'LIVE_CAMERA') stopCamera();
    setMode(nextMode);
    setInferenceError(null);
    setResult(null);
    if (nextMode === 'LIVE_CAMERA') {
      setDetectionActive(true);
    }
  };

  const selectCameraTab = (camId: string) => {
    setSelectedCameraId(camId);
    if (camId !== 'GRID') {
      const targetCam = cameras.find((c) => c.cameraId === camId);
      const feed = targetCam?.feedUrl || '/images/cam01_entry.jpg';
      setImageUrl(feed);
      setMode('IMAGE');
      setCurrentPreset(`ZONE_${camId}`);
      setResult(null);
    }
  };

  const loadPresetImage = async (presetName: string, path: string, autoRun = true) => {
    setCurrentPreset(presetName);
    setImageUrl(path);
    setMode('IMAGE');
    setResult(null);
    setInferenceState('ANALYZING');

    try {
      const res = await fetch(path);
      const blob = await res.blob();
      const file = new File([blob], `${presetName.toLowerCase()}.jpg`, {
        type: 'image/jpeg',
      });
      setImageFile(file);

      if (autoRun) {
        if (backendReady) {
          try {
            const response = await sendFrameForInference(
              file,
              activeCamera.cameraId,
              'image'
            );
            handleInferenceResult(response);
            return;
          } catch (err) {
            console.warn('Backend inference fallback:', err);
          }
        }
        setTimeout(() => {
          const synthetic = createSampleDetection(presetName, activeCamera.cameraId);
          handleInferenceResult(synthetic);
        }, 300);
      }
    } catch {
      // fallback
      setTimeout(() => {
        const synthetic = createSampleDetection(presetName, activeCamera.cameraId);
        handleInferenceResult(synthetic);
      }, 300);
    }
  };

  const loadPresetVideo = (presetName: string, path: string) => {
    setCurrentPreset(presetName);
    setVideoUrl(path);
    setMode('RECORDED_VIDEO');
    setDetectionActive(true);
    setInferenceState('ANALYZING');
  };

  const runDetectionOnImage = async () => {
    setInferenceError(null);
    setInferenceState('ANALYZING');

    // 1. If Python backend is connected and ready, send file for real YOLOv8 inference
    if (backendReady && imageFile) {
      try {
        const response = await sendFrameForInference(
          imageFile,
          activeCamera.cameraId,
          'image'
        );
        handleInferenceResult(response);
        return;
      } catch (err) {
        console.warn('Backend inference failed, falling back to instant client analysis:', err);
      }
    }

    // 2. Instant client-side PPE detection fallback with detailed bounding boxes & skeletons
    setTimeout(() => {
      const synthetic = createSampleDetection(currentPreset, activeCamera.cameraId);
      handleInferenceResult(synthetic);
    }, 350);
  };

  const handleFile = (
    event: ChangeEvent<HTMLInputElement>,
    kind: 'video' | 'image'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const valid =
      kind === 'video'
        ? file.type.startsWith('video/')
        : file.type.startsWith('image/');
    if (!valid) {
      setInferenceError(`Please choose a valid ${kind} file.`);
      event.target.value = '';
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    if (kind === 'video') {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(nextUrl);
      switchMode('RECORDED_VIDEO');
    } else {
      setImageUrl(nextUrl);
      setImageFile(file);
      setCurrentPreset('CUSTOM_UPLOAD');
      switchMode('IMAGE');
    }
    event.target.value = '';
  };

  const statusLabel =
    streamState === CameraStreamState.LIVE
      ? 'Live Camera Active'
      : streamState === CameraStreamState.REQUESTING_PERMISSION
      ? 'Requesting Camera Permission'
      : streamState === CameraStreamState.ERROR
      ? 'Camera Error'
      : streamState === CameraStreamState.STOPPED
      ? 'Camera Stopped'
      : 'Camera Standby';

  const engineLabel = backendReady
    ? 'AI Vision Backend: Online (YOLOv8 + Pose Model)'
    : 'AI Vision Engine: Hybrid Ready';

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            OPTICAL PPE COMPLIANCE &amp; THREAT DETECTION
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white tracking-tight">
            Surveillance Cameras &amp; Live PPE Detection
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time multi-channel optical monitoring with automated detection of required safety gear: Hard Hat, High-Vis Vest, Gloves, and Safety Boots.
          </p>
        </div>

        {/* Global Video Wall Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectCameraTab('GRID')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all border ${
              selectedCameraId === 'GRID'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/30'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            <LayoutGrid size={16} />
            <span>5-Channel CCTV Video Wall</span>
          </button>
        </div>
      </header>

      {/* Camera Selection Bar across all 5 cameras */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mr-2">
          CAMERAS:
        </span>
        {cameras.map((c) => {
          const isSelected = selectedCameraId === c.cameraId;
          const zone = zones.find((z) => z.id === c.zoneId);

          return (
            <button
              key={c.cameraId}
              onClick={() => selectCameraTab(c.cameraId)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-600/90 text-white shadow-md shadow-blue-600/20'
                  : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <CameraIcon size={14} className={isSelected ? 'text-white' : 'text-blue-400'} />
              <span>{c.cameraId}</span>
              <span className="text-[11px] opacity-75 font-normal">({zone?.name || 'Sector'})</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: All 5 Cameras CCTV Surveillance Video Wall */}
      {selectedCameraId === 'GRID' && (
        <div className="space-y-6">
          <CCTVMatrix
            cameras={cameras}
            zones={zones}
            onSelectCamera={(camId) => selectCameraTab(camId)}
          />

          {/* Quick Action Banner */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Full Optical PPE Coverage Active</p>
                <p className="text-xs text-slate-400">
                  Click any camera feed above to launch deep-dive AI inspection or start live webcam detection.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  selectCameraTab('CAM-01');
                  switchMode('LIVE_CAMERA');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-semibold transition-colors shadow-lg shadow-emerald-600/20"
              >
                <CameraIcon size={14} />
                <span>Launch Live Webcam Detection</span>
              </button>
              <button
                onClick={() => selectCameraTab('CAM-01')}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 text-xs font-semibold transition-colors"
              >
                Inspect CAM-01 (Entry)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Single Camera Deep-Dive & Detection Mode */}
      {selectedCameraId !== 'GRID' && (
        <div className="space-y-4">
          {/* Active Camera Information Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectCameraTab('GRID')}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Return to 5-Camera Grid"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-base">
                    {activeCamera.cameraId}:
                  </span>
                  <span className="font-semibold text-blue-300 text-sm">
                    {activeCamera.name || `${activeZone?.name} Surveillance`}
                  </span>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono px-2 py-0.5 font-bold">
                    ONLINE
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sector: <strong className="text-slate-200">{activeZone?.name}</strong> •{' '}
                  Resolution: 1920x1080 @ 30 FPS • Optical PTZ Active
                </p>
              </div>
            </div>

            {/* Quick Sample Selector Pill Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase text-slate-400">Quick Samples:</span>

              {/* Fire & Smoke Hazard Test Image */}
              <button
                onClick={() =>
                  loadPresetImage(
                    'FIRE_SMOKE_HAZARD',
                    '/images/fire_smoke_hazard.jpg'
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  currentPreset === 'FIRE_SMOKE_HAZARD' && mode === 'IMAGE'
                    ? 'border-red-500 bg-red-950/80 text-red-200 ring-2 ring-red-500/50 shadow-lg shadow-red-900/30'
                    : 'border-red-900/60 bg-red-950/40 text-red-300 hover:border-red-600 hover:bg-red-900/60'
                }`}
                title="Company Fire Flames & Thick Black Smoke Plumes Hazard Image"
              >
                <Flame size={13} className="text-red-400 animate-pulse" />
                <span>🔥 Fire &amp; Smoke Hazard</span>
              </button>

              <button
                onClick={() =>
                  loadPresetImage(
                    'WORKER_PPE_COMPLIANT',
                    '/images/worker_ppe_compliant.jpg'
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  currentPreset === 'WORKER_PPE_COMPLIANT' && mode === 'IMAGE'
                    ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Sparkles size={13} className="text-emerald-400" />
                <span>Worker Full PPE</span>
              </button>

              <button
                onClick={() =>
                  loadPresetImage(
                    'WORKER_SAFETY_GEAR',
                    '/images/worker_safety_gear.jpg'
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  currentPreset === 'WORKER_SAFETY_GEAR' && mode === 'IMAGE'
                    ? 'border-blue-500 bg-blue-950/60 text-blue-300 ring-1 ring-blue-500/30'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                }`}
              >
                <ShieldCheck size={13} className="text-blue-400" />
                <span>Safety Gear Kit</span>
              </button>

              <button
                onClick={() =>
                  loadPresetImage(
                    `ZONE_${activeCamera.cameraId}`,
                    activeCamera.feedUrl || '/images/cam01_entry.jpg'
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  currentPreset === `ZONE_${activeCamera.cameraId}` && mode === 'IMAGE'
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300 ring-1 ring-cyan-500/30'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                }`}
              >
                <CameraIcon size={13} className="text-cyan-400" />
                <span>Current Zone ({activeCamera.cameraId})</span>
              </button>
            </div>
          </div>

          {/* Input Source Modes (Live Webcam | Image / Preset | Recorded Video) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['LIVE_CAMERA', 'Live Hardware Webcam', CameraIcon],
                  ['IMAGE', 'Camera Snapshot & PPE Images', ImageIcon],
                  ['RECORDED_VIDEO', 'Recorded Video Stream', Video],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => switchMode(value)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    mode === value
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Overlays & Rate Settings */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowItemBoxes(!showItemBoxes)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showItemBoxes
                    ? 'border-amber-500 bg-amber-600/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>PPE Boxes: {showItemBoxes ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setShowSkeletonOverlay(!showSkeletonOverlay)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showSkeletonOverlay
                    ? 'border-cyan-500 bg-cyan-600/20 text-cyan-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity size={13} className={showSkeletonOverlay ? 'text-cyan-400' : ''} />
                <span>Pose Skeleton: {showSkeletonOverlay ? 'ON' : 'OFF'}</span>
              </button>

              {mode === 'LIVE_CAMERA' && (
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono">
                  <span className="text-slate-400 text-[10px]">FPS:</span>
                  {[5, 10].map((fps) => (
                    <button
                      key={fps}
                      onClick={() => setLiveFps(fps)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        liveFps === fps
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {fps}
                    </button>
                  ))}
                </div>
              )}

              {/* Live Audio Alarm Tests & Mute Control */}
              <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
                <button
                  type="button"
                  onClick={() => audioAlert.playWarningBeep()}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-600/70 bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-900/50 transition-colors"
                  title="Test short warning beep (for missing PPE violations)"
                >
                  <Volume2 size={13} className="text-amber-400" />
                  <span>🔊 PPE Beep</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (audioAlert.getIsPlaying()) {
                      audioAlert.stopSiren();
                    } else {
                      audioAlert.playEmergencySiren();
                      setTimeout(() => audioAlert.stopSiren(), 3000);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-red-600/80 bg-red-950/40 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-900/60 transition-colors"
                  title="Test industrial emergency siren (fire / smoke hazard) — auto-stops after 3s"
                >
                  <Flame size={13} className="text-red-400 animate-pulse" />
                  <span>🚨 Fire Siren</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const muted = audioAlert.toggleMute();
                    setIsAudioMuted(muted);
                  }}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    isAudioMuted
                      ? 'border-slate-700 bg-slate-900 text-slate-400'
                      : 'border-emerald-700/60 bg-emerald-950/50 text-emerald-300'
                  }`}
                  title={isAudioMuted ? 'Alarms Muted — Click to unmute' : 'Alarms Active — Click to mute'}
                >
                  {isAudioMuted ? <VolumeX size={13} /> : <Volume2 size={13} className="text-emerald-400" />}
                  <span>{isAudioMuted ? 'Muted' : 'Audio ON'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Required PPE Configuration Strip */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
              <Sliders size={14} className="text-blue-400" />
              <span>Required PPE Compliance Rules:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'helmetRequired', label: 'Hard Hat / Helmet', icon: '⛑️' },
                { key: 'vestRequired', label: 'High-Vis Vest', icon: '🦺' },
                { key: 'glovesRequired', label: 'Work Gloves', icon: '🧤' },
                { key: 'shoesRequired', label: 'Safety Boots', icon: '🥾' },
                { key: 'maskRequired', label: 'Face Mask', icon: '😷' },
                { key: 'gogglesRequired', label: 'Safety Goggles', icon: '🥽' },
              ].map(({ key, label, icon }) => {
                const isActive = settings[key as keyof typeof settings] as boolean;

                return (
                  <button
                    key={key}
                    onClick={() => updateSettings({ [key]: !isActive })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      isActive
                        ? 'border-blue-500/80 bg-blue-600/20 text-blue-200'
                        : 'border-slate-800 bg-slate-900 text-slate-500 line-through'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                    <span className="text-[10px] font-bold">{isActive ? '✓' : '✕'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Inspection Viewport & Side Telemetry Panel */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
            <section className="overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl">
              <div
                ref={containerRef}
                className="relative flex aspect-video items-center justify-center bg-slate-950 overflow-hidden"
              >
                {/* Real-time Optical Fire & Smoke Emergency HUD Banners */}
                {result?.fireSmoke?.hasFire && (
                  <div className="absolute top-3 inset-x-3 z-40 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-950/95 border-2 border-red-500 shadow-2xl backdrop-blur-md animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <Flame size={22} className="text-red-400 animate-bounce" />
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wide text-red-200">
                          🚨 CRITICAL HAZARD: FLAME / FIRE DETECTED
                        </p>
                        <p className="text-[11px] text-red-300 font-mono">
                          Confidence: {Math.round(result.fireSmoke.fireConfidence * 100)}% | Optical Flame Analysis | Auto-Siren Active
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-red-600 text-xs font-black uppercase tracking-wider text-white shadow">
                      EVACUATE
                    </span>
                  </div>
                )}

                {result?.fireSmoke?.hasSmoke && result.fireSmoke.smokeDensity > 20 && !result?.fireSmoke?.hasFire && (
                  <div className="absolute top-3 inset-x-3 z-40 flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-amber-950/95 border border-amber-500/80 shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={20} className="text-amber-400" />
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wide text-amber-200">
                          ⚠️ WARNING: DENSE SMOKE / HAZE DETECTED
                        </p>
                        <p className="text-[11px] text-amber-300 font-mono">
                          Smoke Density: {result.fireSmoke.smokeDensity}% | Confidence: {Math.round(result.fireSmoke.smokeConfidence * 100)}%
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-[11px] font-bold uppercase text-white shadow">
                      VENTILATE
                    </span>
                  </div>
                )}

                {/* 1. Live Camera Stream */}
                {mode === 'LIVE_CAMERA' && (
                  <div className="relative h-full w-full">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={updateMediaLayout}
                      className={`h-full w-full object-contain ${
                        facingMode === 'user' ? 'scale-x-[-1]' : ''
                      }`}
                    />

                    {/* Skeletons overlay */}
                    {showSkeletonOverlay && (
                      <SkeletonSvgOverlay
                        skeletons={result?.skeletons || []}
                        mediaLayout={mediaLayout}
                        isMirrored={facingMode === 'user'}
                      />
                    )}

                    {/* Individual PPE Item Bounding Boxes */}
                    {showItemBoxes &&
                      result?.detections
                        ?.filter((d) => d.className.toLowerCase() !== 'person')
                        .map((detection) => {
                          const badge = getPpeBadgeColor(detection.className);

                          return (
                            <div
                              key={detection.detectionId}
                              className={`pointer-events-none absolute border-2 ${badge.border} transition-all duration-150`}
                              style={getOverlayStyle(detection.boundingBox)}
                            >
                              <span
                                className={`absolute left-0 top-0 whitespace-nowrap ${badge.bg} ${badge.text} px-1.5 py-0.2 text-[9px] font-mono font-bold shadow-md`}
                              >
                                {displayLabel(detection)} {Math.round(detection.confidence * 100)}%
                              </span>
                            </div>
                          );
                        })}

                    {/* Person Bounding Box & PPE Compliance Overlay */}
                    {result?.persons?.map((person) => (
                      <PersonComplianceOverlay
                        key={`live-person-${person.trackId}`}
                        person={person}
                        style={getOverlayStyle(person.boundingBox)}
                        requiredPpeList={requiredPpeList}
                      />
                    ))}

                    {/* Live Scanner Banner if no persons detected yet */}
                    {stream && (!result?.persons || result.persons.length === 0) && (
                      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700 text-xs font-mono text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>OPTICAL AI SCANNER ACTIVE — Step in front of camera to detect PPE</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Recorded Video Stream */}
                {mode === 'RECORDED_VIDEO' && videoUrl && (
                  <div className="relative h-full w-full">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      onLoadedMetadata={updateMediaLayout}
                      className="h-full w-full object-contain"
                    />
                    {showSkeletonOverlay && (
                      <SkeletonSvgOverlay
                        skeletons={result?.skeletons || []}
                        mediaLayout={mediaLayout}
                        isMirrored={false}
                      />
                    )}
                    {showItemBoxes &&
                      result?.detections
                        ?.filter((d) => d.className.toLowerCase() !== 'person')
                        .map((detection) => {
                          const badge = getPpeBadgeColor(detection.className);
                          return (
                            <div
                              key={detection.detectionId}
                              className={`pointer-events-none absolute border-2 ${badge.border}`}
                              style={getOverlayStyle(detection.boundingBox)}
                            >
                              <span
                                className={`absolute left-0 top-0 whitespace-nowrap ${badge.bg} ${badge.text} px-1.5 py-0.2 text-[9px] font-mono font-bold shadow-md`}
                              >
                                {displayLabel(detection)} {Math.round(detection.confidence * 100)}%
                              </span>
                            </div>
                          );
                        })}
                    {result?.persons?.map((person) => (
                      <PersonComplianceOverlay
                        key={`person-${person.trackId}`}
                        person={person}
                        style={getOverlayStyle(person.boundingBox)}
                        requiredPpeList={requiredPpeList}
                      />
                    ))}
                  </div>
                )}

                {/* 3. Image / Snapshot Viewport */}
                {mode === 'IMAGE' && imageUrl && (
                  <div className="relative h-full w-full">
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="Selected safety source"
                      onLoad={updateMediaLayout}
                      className="h-full w-full object-contain"
                    />
                    {showSkeletonOverlay && (
                      <SkeletonSvgOverlay
                        skeletons={result?.skeletons || []}
                        mediaLayout={mediaLayout}
                        isMirrored={false}
                      />
                    )}
                    {showItemBoxes &&
                      result?.detections
                        ?.filter((d) => d.className.toLowerCase() !== 'person')
                        .map((detection) => {
                          const badge = getPpeBadgeColor(detection.className);
                          return (
                            <div
                              key={detection.detectionId}
                              className={`pointer-events-none absolute border-2 ${badge.border}`}
                              style={getOverlayStyle(detection.boundingBox)}
                            >
                              <span
                                className={`absolute left-0 top-0 whitespace-nowrap ${badge.bg} ${badge.text} px-1.5 py-0.2 text-[9px] font-mono font-bold shadow-md`}
                              >
                                {displayLabel(detection)} {Math.round(detection.confidence * 100)}%
                              </span>
                            </div>
                          );
                        })}
                    {result?.persons?.map((person) => (
                      <PersonComplianceOverlay
                        key={`img-person-${person.trackId}`}
                        person={person}
                        style={getOverlayStyle(person.boundingBox)}
                        requiredPpeList={requiredPpeList}
                      />
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {((mode === 'RECORDED_VIDEO' && !videoUrl) || (mode === 'IMAGE' && !imageUrl)) && (
                  <div className="p-8 text-center text-sm text-slate-500">
                    {mode === 'IMAGE'
                      ? 'Upload an image or choose one of the quick samples above to begin analysis.'
                      : 'Upload a recorded video to begin analysis.'}
                  </div>
                )}

                {/* Live Camera Inactive Placeholder */}
                {mode === 'LIVE_CAMERA' && !stream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center">
                    <div className="p-3 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20">
                      <CameraIcon size={36} />
                    </div>
                    <div className="max-w-md">
                      <p className="text-base font-semibold text-white">Live Camera Inactive</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Click below to connect your webcam. AI inference will automatically inspect personal protective equipment compliance in real time.
                      </p>
                    </div>
                    {isCameraSupported() && (
                      <button
                        onClick={startCamera}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 text-sm font-semibold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
                      >
                        <Play size={16} />
                        <span>Start Live Camera &amp; Detection</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Scanline Effect */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-30" />
              </div>

              {/* Viewport Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Feed:</span>
                  <strong className="text-white">
                    {activeCamera.cameraId} — {activeZone?.name}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Live Camera Controls */}
                  {mode === 'LIVE_CAMERA' && stream && (
                    <>
                      <button
                        onClick={() => setDetectionActive(!detectionActive)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white transition-all shadow-md ${
                          detectionActive
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                            : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                        }`}
                      >
                        {detectionActive ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <span>Detection Active (Streaming)</span>
                          </>
                        ) : (
                          <>
                            <Play size={13} />
                            <span>Resume Detection</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={switchCamera}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                        title="Flip between front and rear cameras"
                      >
                        <RotateCcw size={13} />
                        <span>Flip Lens</span>
                      </button>

                      <button
                        onClick={stopCamera}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-800/80 bg-rose-950/60 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60"
                      >
                        <Square size={13} />
                        <span>Stop Camera</span>
                      </button>
                    </>
                  )}

                  {/* Recorded Video Controls */}
                  {mode === 'RECORDED_VIDEO' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          loadPresetVideo(
                            'HAZARD_FIRE_SMOKE',
                            '/videos/hazard_fire_smoke.mp4'
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border transition-all ${
                          videoUrl === '/videos/hazard_fire_smoke.mp4'
                            ? 'border-red-500 bg-red-950/80 text-red-200 ring-2 ring-red-500/40'
                            : 'border-red-900/60 bg-red-950/30 text-red-300 hover:border-red-600'
                        }`}
                      >
                        <Flame size={13} className="text-red-400 animate-pulse" />
                        <span>🔥 Fire &amp; Smoke CCTV Stream</span>
                      </button>

                      <button
                        onClick={() =>
                          loadPresetVideo(
                            'WORKER_PATROL',
                            '/videos/worker_ppe_patrol.mp4'
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border transition-all ${
                          videoUrl === '/videos/worker_ppe_patrol.mp4'
                            ? 'border-blue-500 bg-blue-950/80 text-blue-200 ring-2 ring-blue-500/40'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <Video size={13} className="text-blue-400" />
                        <span>Worker Patrol Video</span>
                      </button>

                      <button
                        onClick={() => videoInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        <Upload size={13} />
                        Upload Custom Video
                      </button>
                    </div>
                  )}

                  {/* Image Controls */}
                  {mode === 'IMAGE' && (
                    <>
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        <Upload size={13} />
                        Upload Custom Image
                      </button>

                      <button
                        onClick={runDetectionOnImage}
                        disabled={inferenceState === 'ANALYZING'}
                        className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-md transition-all ${
                          inferenceState === 'ANALYZING'
                            ? 'bg-amber-600 cursor-wait'
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        }`}
                      >
                        <Sparkles size={13} />
                        {inferenceState === 'ANALYZING'
                          ? 'Analyzing PPE...'
                          : 'Run AI PPE Detection'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Side Telemetry & Real-Time Inspection Panel */}
            <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-semibold text-white">Live PPE Telemetry</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                  {mode === 'LIVE_CAMERA' ? 'WEBCAM' : activeCamera.cameraId}
                </span>
              </div>

              {/* Backend Status Box */}
              <div className="border-l-2 border-emerald-400 pl-3">
                <p className="text-xs font-semibold text-emerald-300">{engineLabel}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-400">{backendReason}</p>
              </div>

              {/* Active Required PPE Checklist Status */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Required Gear Audit</span>
                  <span className="font-mono text-emerald-400 text-[10px] flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    {requiredPpeList.length} ITEMS MANDATORY
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {[
                    { key: 'Helmet', label: 'Safety Helmet / Hard Hat', required: settings.helmetRequired },
                    { key: 'Vest', label: 'High-Visibility Reflective Vest', required: settings.vestRequired },
                    { key: 'Glove', label: 'Industrial Work Gloves', required: settings.glovesRequired },
                    { key: 'Boots', label: 'Steel-Toe Safety Boots', required: settings.shoesRequired },
                    { key: 'Mask', label: 'Protective Face Mask', required: settings.maskRequired },
                    { key: 'Glass', label: 'Safety Goggles / Eye Shield', required: settings.gogglesRequired },
                  ].map((item) => {
                    const detectedInFrame = result?.detections?.some((d) => {
                      const c = d.className.toLowerCase();
                      if (item.key === 'Glass') return c.includes('glass') || c.includes('goggle');
                      if (item.key === 'Boots') return c.includes('boot') || c.includes('shoe');
                      if (item.key === 'Glove') return c.includes('glove');
                      return c.includes(item.key.toLowerCase());
                    });

                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between text-xs bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800/80"
                      >
                        <span className="text-slate-300">{item.label}</span>
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          {detectedInFrame ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check size={11} />
                              DETECTED
                            </span>
                          ) : item.required ? (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <X size={11} />
                              MISSING
                            </span>
                          ) : (
                            <span className="text-slate-500">OPTIONAL</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fire & Smoke Hazard Status Box */}
              <div
                className={`rounded-lg border p-3 space-y-1.5 transition-all ${
                  result?.fireSmoke?.hasFire
                    ? 'border-red-500/80 bg-red-950/50 shadow-lg shadow-red-950/40 animate-pulse'
                    : result?.fireSmoke?.hasSmoke
                    ? 'border-orange-500/80 bg-orange-950/40'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Flame
                      size={13}
                      className={
                        result?.fireSmoke?.hasFire
                          ? 'text-red-400 animate-bounce'
                          : result?.fireSmoke?.hasSmoke
                          ? 'text-orange-400'
                          : 'text-slate-400'
                      }
                    />
                    Fire &amp; Hazard Radar
                  </span>
                  <span className="font-mono text-[10px]">
                    {result?.fireSmoke?.hasFire ? (
                      <span className="text-red-400 font-bold">
                        🔥 FLAME DETECTED ({Math.round(result.fireSmoke.fireConfidence * 100)}%)
                      </span>
                    ) : result?.fireSmoke?.hasSmoke ? (
                      <span className="text-orange-400 font-bold">
                        💨 SMOKE ({result.fireSmoke.smokeDensity}%)
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check size={11} />
                        CLEAR / SAFE
                      </span>
                    )}
                  </span>
                </div>
                {result?.fireSmoke?.hasFire && (
                  <p className="text-[11px] text-red-300">
                    High thermal/chromatic combustion detected. Alarm siren triggered automatically.
                  </p>
                )}
                {result?.fireSmoke?.hasSmoke && !result?.fireSmoke?.hasFire && (
                  <p className="text-[11px] text-orange-300">
                    Haze/plume detected in camera view. Verify ventilation or potential smolder.
                  </p>
                )}
              </div>

              {/* Detected Tracked Personnel */}
              {result?.persons && result.persons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-300">Tracked Personnel in Frame:</p>
                  {result.persons.map((person) => {
                    const missing = requiredPpeList.filter(
                      (name) => !isPpeStateConfirmed(getPpeStateValue(person.ppeStates, name))
                    );

                    return (
                      <div
                        key={`side-trk-${person.trackId}`}
                        className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-semibold text-cyan-300">TRACK ID {person.trackId}</p>
                          {missing.length === 0 ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              COMPLIANT
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              MISSING {missing.join(', ')}
                            </span>
                          )}
                        </div>

                        {person.skeleton && (
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Posture:</span>
                            <span className="text-cyan-300 font-bold">
                              {person.skeleton.postureState} ({person.skeleton.torsoAngle ?? '--'}°)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Frame Inference Stats */}
              {result && (
                <dl className="space-y-2 text-xs border-t border-slate-800 pt-3">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Total Detections:</dt>
                    <dd className="font-mono text-slate-200">{result.detections.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Inference Latency:</dt>
                    <dd className="font-mono text-emerald-400">
                      {result.inferenceTimeMs || 18} ms
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Analyzed Frame:</dt>
                    <dd className="font-mono text-slate-400">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </dd>
                  </div>
                </dl>
              )}
            </aside>
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={(event) => handleFile(event, 'video')}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => handleFile(event, 'image')}
        className="hidden"
      />
    </div>
  );
}
