// ─────────────────────────────────────────────
// X-Guardian — Camera Service
// Browser MediaDevices API abstraction for webcam & mobile camera access
// ─────────────────────────────────────────────

import { CameraDeviceInfo, CameraErrorInfo, CameraFacingMode } from '../types';

export interface CameraStreamOptions {
  deviceId?: string;
  facingMode?: CameraFacingMode;
  idealWidth?: number;
  idealHeight?: number;
}

/**
 * Check if the browser supports camera access (MediaDevices API)
 */
export function isCameraSupported(): boolean {
  return typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';
}

/**
 * Check if running in a secure context (HTTPS or localhost)
 */
export function isSecureEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
}

/**
 * Enumerate available video input hardware devices (webcams, mobile front/back cameras)
 */
export async function getVideoDevices(): Promise<CameraDeviceInfo[]> {
  if (!isCameraSupported()) {
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');

    return videoInputs.map((device, idx) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${idx + 1}`,
      groupId: device.groupId,
    }));
  } catch (error) {
    console.warn('[X-Guardian CameraService] Failed to enumerate devices:', error);
    return [];
  }
}

/**
 * Request camera access and start the video stream.
 * NOTE: audio is strictly disabled. Only video is requested.
 */
export async function startCameraStream(options: CameraStreamOptions = {}): Promise<MediaStream> {
  if (!isSecureEnvironment()) {
    throw {
      code: 'INSECURE_CONTEXT',
      message: 'Camera access requires a secure context (HTTPS or localhost).',
    } as CameraErrorInfo;
  }

  if (!isCameraSupported()) {
    throw {
      code: 'NOT_SUPPORTED',
      message: 'Your browser does not support the MediaDevices camera API.',
    } as CameraErrorInfo;
  }

  // Build constraints prioritizing specific deviceId or facingMode
  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: options.idealWidth ?? 1280 },
    height: { ideal: options.idealHeight ?? 720 },
  };

  if (options.deviceId) {
    videoConstraints.deviceId = { exact: options.deviceId };
  } else if (options.facingMode) {
    videoConstraints.facingMode = { ideal: options.facingMode };
  }

  const constraints: MediaStreamConstraints = {
    video: videoConstraints,
    audio: false, // Explicitly no microphone access
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err: unknown) {
    throw mapCameraError(err);
  }
}

/**
 * Cleanly stop all active video tracks in a MediaStream
 */
export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return;

  try {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  } catch (err) {
    console.warn('[X-Guardian CameraService] Error stopping stream tracks:', err);
  }
}

/**
 * Switch camera by cleanly stopping existing stream and requesting a new one
 */
export async function switchCameraStream(
  currentStream: MediaStream | null,
  options: CameraStreamOptions
): Promise<MediaStream> {
  stopCameraStream(currentStream);
  return await startCameraStream(options);
}

/**
 * Convert standard browser DOMExceptions into human-readable, structured error info
 */
export function mapCameraError(err: unknown): CameraErrorInfo {
  if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
    return err as CameraErrorInfo;
  }

  if (err instanceof DOMException || (typeof err === 'object' && err !== null && 'name' in err)) {
    const domErr = err as { name: string; message: string };

    switch (domErr.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
          code: 'PERMISSION_DENIED',
          message: 'Camera permission was denied. Please allow camera access in your browser settings.',
          details: domErr.message,
        };

      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          code: 'NOT_FOUND',
          message: 'No camera hardware found on this device.',
          details: domErr.message,
        };

      case 'NotReadableError':
      case 'TrackStartError':
        return {
          code: 'IN_USE',
          message: 'The camera is already in use by another application or tab.',
          details: domErr.message,
        };

      case 'OverconstrainedError':
        return {
          code: 'NOT_SUPPORTED',
          message: 'The requested camera resolution or facingMode is not supported by this device.',
          details: domErr.message,
        };

      case 'SecurityError':
        return {
          code: 'INSECURE_CONTEXT',
          message: 'Camera access blocked due to security restrictions (non-HTTPS).',
          details: domErr.message,
        };

      default:
        return {
          code: 'UNKNOWN',
          message: domErr.message || 'An unexpected error occurred while accessing the camera.',
          details: domErr.name,
        };
    }
  }

  return {
    code: 'UNKNOWN',
    message: String(err) || 'Failed to initialize camera stream.',
  };
}
