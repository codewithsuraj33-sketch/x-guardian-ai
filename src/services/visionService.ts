// ─────────────────────────────────────────────
// X-Guardian — Vision Service
// Frontend abstraction for communication with Python FastAPI computer-vision backend
// ─────────────────────────────────────────────

import { VisionFrameResult, VisionEngineStatus } from '../types';

export const VISION_BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VISION_BACKEND_URL) ||
  'http://127.0.0.1:8000';

export interface BackendHealthResponse {
  status: string;
  service: string;
  engineReady?: boolean;
  engineReason?: string | null;
}

export function resetInferenceSession(cameraId: string): void {
  void fetch(`${VISION_BACKEND_URL}/api/v1/session/${encodeURIComponent(cameraId)}`, { method: 'DELETE' }).catch(() => undefined);
}

/**
 * Check if the Python FastAPI vision backend is active and reachable
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${VISION_BACKEND_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data as BackendHealthResponse;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract a single JPEG frame from an active HTMLVideoElement using an offscreen canvas
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  maxWidth = 640,
  quality = 0.8
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve(null);
      return;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
      resolve(null);
      return;
    }

    // Scale proportionally to save network bandwidth & inference latency
    const scale = Math.min(1, maxWidth / videoWidth);
    const targetW = Math.round(videoWidth * scale);
    const targetH = Math.round(videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }

    ctx.drawImage(video, 0, 0, targetW, targetH);

    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

async function normalizeImageBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/jpeg' && blob.size > 0) {
    return blob;
  }

  if (typeof createImageBitmap !== 'function') {
    return blob;
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return blob;
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    return jpeg ?? blob;
  } catch {
    return blob;
  }
}

/**
 * Upload a captured frame to the FastAPI vision backend for AI PPE detection
 */
export async function sendFrameForInference(
  frameBlob: Blob,
  cameraId: string,
  source = 'image'
): Promise<VisionFrameResult> {
  if (!frameBlob || frameBlob.size === 0) {
    throw new Error('The selected frame is empty. Please try the camera or upload again.');
  }

  const normalizedFrame = await normalizeImageBlob(frameBlob);
  if (normalizedFrame.size === 0) {
    throw new Error('The selected frame could not be decoded by the browser. Please choose another image.');
  }

  const formData = new FormData();
  formData.append('file', normalizedFrame, 'frame.jpg');
  formData.append('camera_id', cameraId);
  formData.append('source', source);

  const res = await fetch(`${VISION_BACKEND_URL}/api/v1/detect`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Keep the HTTP status when the response is not JSON.
    }
    throw new Error(`Inference backend error: ${detail}`);
  }

  const data: VisionFrameResult = await res.json();
  return data;
}

/**
 * Configurable inference scheduler options
 */
export interface InferenceControllerOptions {
  videoElement: HTMLVideoElement | null;
  cameraId: string;
  source?: string;
  fps?: number; // Configurable: 5, 10, or 15 FPS
  onResult: (result: VisionFrameResult) => void;
  onError: (error: Error) => void;
  onStatusChange?: (status: VisionEngineStatus) => void;
}

/**
 * Controller to manage frame capture and inference scheduling at configurable FPS rates
 */
export function createInferenceController(options: InferenceControllerOptions) {
  let isRunning = false;
  let currentFps = options.fps ?? 5;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isProcessingFrame = false;

  const start = () => {
    if (isRunning) return;
    isRunning = true;
    options.onStatusChange?.(VisionEngineStatus.DETECTING);

    const intervalMs = Math.round(1000 / currentFps);

    intervalId = setInterval(async () => {
      // Avoid frame stacking if prior inference request is still in-flight
      if (isProcessingFrame || !options.videoElement) return;

      isProcessingFrame = true;
      try {
        const blob = await captureVideoFrame(options.videoElement);
        if (blob && isRunning) {
          const result = await sendFrameForInference(blob, options.cameraId, options.source ?? 'webcam');
          if (isRunning) {
            options.onResult(result);
          }
        }
      } catch (err) {
        if (isRunning) {
          options.onError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        isProcessingFrame = false;
      }
    }, intervalMs);
  };

  const stop = () => {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    options.onStatusChange?.(VisionEngineStatus.AI_READY);
  };

  const setFps = (newFps: number) => {
    currentFps = Math.max(1, Math.min(30, newFps));
    if (isRunning) {
      stop();
      start();
    }
  };

  return {
    start,
    stop,
    setFps,
    getFps: () => currentFps,
    isRunning: () => isRunning,
  };
}
