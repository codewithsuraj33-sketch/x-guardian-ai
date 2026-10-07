// ─────────────────────────────────────────────
// X-Guardian — Core Type Definitions
// ─────────────────────────────────────────────

/** Risk severity levels for worker safety assessment */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Camera operational status */
export enum CameraStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

/** Incident lifecycle status */
export enum IncidentStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

/** Worker operational status */
export enum WorkerStatus {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  BREAK = 'BREAK',
  OFFLINE = 'OFFLINE',
}

/** Personal Protective Equipment compliance for a single worker */
export interface PPEStatus {
  helmet: boolean;
  vest: boolean;
  gloves: boolean;
  shoes: boolean;
  mask?: boolean;
}

/** A worker tracked inside the factory */
export interface Worker {
  id: string;
  name: string;
  zoneId: string;
  trackerId: string;
  ppe: PPEStatus;
  riskLevel: RiskLevel;
  riskScore: number;
  status: WorkerStatus;
  violations: string[];
}

/** A physical zone within the factory */
export interface Zone {
  id: string;
  name: string;
  cameraId: string;
  safetyStatus: RiskLevel;
  workerCount: number;
  description: string;
  color: string;
  isRestricted: boolean;
  hasActiveFire?: boolean;
  hasActiveSmoke?: boolean;
  evacuationOrdered?: boolean;
}

/** A surveillance camera */
export interface Camera {
  cameraId: string;
  zoneId: string;
  status: CameraStatus;
  name?: string;
  feedUrl?: string;
  resolution?: string;
  fps?: number;
}

/** A safety incident recorded by the system */
export interface Incident {
  incidentId: string;
  workerId?: string;
  trackId?: string;
  cameraId: string;
  zoneId?: string;
  violation: string;
  severity: RiskLevel;
  timestamp: string;
  status: IncidentStatus;
  confidence?: number;
  frameNumber?: number;
  evidenceImage?: string;
}

/** System Configuration Settings */
export interface SystemSettings {
  helmetRequired: boolean;
  vestRequired: boolean;
  glovesRequired: boolean;
  shoesRequired: boolean;
  maskRequired?: boolean;
  confidenceThreshold: number;
  audioAlert: boolean;
  browserNotification: boolean;
  cameraName: string;
  sourceType: 'LIVE_CAMERA' | 'RECORDED_VIDEO' | 'IMAGE' | 'RTSP_STREAM';
}

/** Result of the safety engine's assessment of a worker */
export interface SafetyAssessment {
  riskLevel: RiskLevel;
  riskScore: number;
  violations: string[];
}

/** Dashboard summary statistics */
export interface DashboardStats {
  workersMonitored: number;
  safeWorkers: number;
  activeViolations: number;
  criticalAlerts: number;
}

// ─────────────────────────────────────────────
// Phase 2A: Live Video & Camera Types
// ─────────────────────────────────────────────

/** Lifecycle state of the live camera stream */
export enum CameraStreamState {
  IDLE = 'IDLE',
  REQUESTING_PERMISSION = 'REQUESTING_PERMISSION',
  LIVE = 'LIVE',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
}

/** Camera lens facing mode for mobile & webcams */
export type CameraFacingMode = 'user' | 'environment';

/** Available hardware camera device */
export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  groupId?: string;
}

/** Structured camera error for user-friendly UI display */
export interface CameraErrorInfo {
  code: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'IN_USE' | 'NOT_SUPPORTED' | 'INSECURE_CONTEXT' | 'UNKNOWN';
  message: string;
  details?: string;
}

// ─────────────────────────────────────────────
// Phase 2B: AI Computer Vision & PPE Detection Types
// ─────────────────────────────────────────────

/** Bounding box coordinates normalized or pixel-based */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Individual object detection result from the vision model */
export interface Detection {
  detectionId: string;
  className: 'person' | 'helmet' | 'vest' | 'gloves' | 'shoes' | string;
  confidence: number;
  boundingBox: BoundingBox;
  trackId?: string;
  timestamp: string;
  source?: string;
}

/** Aggregated PPE compliance detected for a person */
export interface PPEDetection {
  person: boolean;
  helmet: boolean;
  vest: boolean;
  gloves: boolean;
  shoes: boolean;
  mask?: boolean;
  confidences?: {
    helmet?: number;
    vest?: number;
    gloves?: number;
    shoes?: number;
    mask?: number;
    person?: number;
  };
}

/** Fire and Smoke detection analysis */
export interface FireSmokeDetection {
  hasFire: boolean;
  fireConfidence: number;
  fireBbox?: BoundingBox;
  hasSmoke: boolean;
  smokeConfidence: number;
  smokeBbox?: BoundingBox;
  smokeDensity: number; // 0 to 100%
}

/** Human joint keypoint in normalized coordinates (0.0 to 1.0) */
export interface Keypoint {
  x: number;
  y: number;
  confidence: number;
  name?: string;
}

/** Worker posture classification */
export type PostureState = 'STANDING' | 'BENDING' | 'SITTING' | 'CROUCHING' | 'FALLEN' | 'LYING_DOWN';

/** Human skeletal pose and posture dynamics */
export interface SkeletonPose {
  trackId?: string;
  keypoints: Keypoint[];
  postureState: PostureState;
  torsoAngle?: number;
  isFall?: boolean;
  isAbnormalPosture?: boolean;
  dropVelocity?: number;
  poseChange?: number;
  postureTransition?: string;
  ergonomicRisk?: 'LOW' | 'MODERATE' | 'HIGH';
}

/** Full frame inference response from vision backend */
export interface VisionFrameResult {
  timestamp: string;
  cameraId: string;
  source?: string;
  detections: Detection[];
  ppeSummary?: PPEDetection;
  fireSmoke?: FireSmokeDetection;
  inferenceTimeMs?: number;
  persons?: PersonSafety[];
  skeletons?: SkeletonPose[];
  incidents?: VisionIncident[];
}

export interface PersonSafety {
  trackId: string;
  boundingBox: BoundingBox;
  visible: boolean;
  ppeStates: Record<string, 'UNKNOWN' | 'DETECTED' | 'CONFIRMED' | 'MISSING_CANDIDATE' | 'VIOLATION' | 'COMPLIANT'>;
  violationTypes: string[];
  skeleton?: SkeletonPose;
}

export interface VisionIncident {
  incidentId: string;
  trackId: string;
  violationType: string;
  requiredPpe: string;
  timestamp: string;
  frameNumber: number;
  confidence?: number;
  cameraId: string;
  zone: string;
  evidenceImage?: string;
}

/** Lifecycle state of the AI vision inference engine */
export enum VisionEngineStatus {
  DISCONNECTED = 'DISCONNECTED',
  AI_INITIALIZING = 'AI_INITIALIZING',
  AI_READY = 'AI_READY',
  DETECTING = 'DETECTING',
  VIOLATION_DETECTED = 'VIOLATION_DETECTED',
  FIRE_DETECTED = 'FIRE_DETECTED',
  SMOKE_DETECTED = 'SMOKE_DETECTED',
  ERROR = 'ERROR',
}

// ─────────────────────────────────────────────
// PS6 Hackathon: Fire, Smoke, Emergency Alert & Video Feed Types
// ─────────────────────────────────────────────

export type HazardType = 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'RESTRICTED_ACCESS';

export type VideoFeedMode = 'WEBCAM' | 'RECORDED_FOOTAGE' | 'FILE_UPLOAD';

export interface RecordedFootagePreset {
  id: string;
  title: string;
  zoneId: string;
  cameraId: string;
  description: string;
  hazardType: HazardType | 'COMPLIANT';
  tag: string;
  imageSrc?: string;
}

export interface DispatchedPersonnel {
  role: string;
  name: string;
  status: 'NOTIFIED' | 'DISPATCHED' | 'STANDBY';
  channel: 'SMS' | 'PA_SYSTEM' | 'RADIO' | 'AUTOMATED_DISPATCH';
  timestamp: string;
}

export interface EmergencyAlert {
  alertId: string;
  hazardType: HazardType;
  severity: RiskLevel;
  zoneId: string;
  zoneName: string;
  cameraId: string;
  title: string;
  description: string;
  timestamp: string;
  confidence: number;
  recommendedAction: string;
  evacuationRequired: boolean;
  dispatchedPersonnel: DispatchedPersonnel[];
}

export interface SafetyGearComplianceStats {
  overallRate: number;
  helmetRate: number;
  vestRate: number;
  glovesRate: number;
  shoesRate: number;
  totalInspected: number;
  fireThreatLevel: 'NORMAL' | 'WARNING' | 'CRITICAL';
  smokeThreatLevel: 'NORMAL' | 'WARNING' | 'CRITICAL';
}
