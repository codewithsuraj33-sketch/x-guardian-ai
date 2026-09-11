// ─────────────────────────────────────────────
// X-Guardian — Client-Side AI Vision & HUD Engine
// Real-time canvas overlay renderer for Safety Gear, Fire & Smoke Detection
// ─────────────────────────────────────────────

import {
  BoundingBox,
  Detection,
  FireSmokeDetection,
  PPEDetection,
  VisionFrameResult,
} from '../types';

export interface OverlayRenderOptions {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  detections: Detection[];
  ppeSummary?: PPEDetection;
  fireSmoke?: FireSmokeDetection;
  cameraId: string;
  zoneName: string;
  fps: number;
  inferenceMs?: number;
  facingMode?: string;
  isMirrored?: boolean;
}

/**
 * Render high-tech industrial HUD bounding boxes and detection overlays on canvas
 */
export function renderIndustrialHUD(options: OverlayRenderOptions) {
  const {
    canvas,
    video,
    detections,
    ppeSummary,
    fireSmoke,
    cameraId,
    zoneName,
    fps,
    inferenceMs = 28,
    isMirrored = false,
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Clear previous frame
  ctx.clearRect(0, 0, w, h);

  ctx.save();

  if (isMirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  // 1. Draw corner reticles and targeting crosshairs
  drawSensorGrid(ctx, w, h);

  // 2. Draw Object Detections (Person, Helmet, Vest, Gloves, Shoes)
  detections.forEach((det) => {
    drawDetectionBox(ctx, det, w, h, isMirrored);
  });

  // 3. Draw Fire Detection (if active)
  if (fireSmoke?.hasFire && fireSmoke.fireBbox) {
    drawFireBox(ctx, fireSmoke.fireBbox, fireSmoke.fireConfidence, w, h, isMirrored);
  }

  // 4. Draw Smoke Detection (if active)
  if (fireSmoke?.hasSmoke && fireSmoke.smokeBbox) {
    drawSmokeBox(ctx, fireSmoke.smokeBbox, fireSmoke.smokeConfidence, fireSmoke.smokeDensity, w, h, isMirrored);
  }

  ctx.restore();

  // 5. Draw HUD Telemetry Header & Bottom Bar (Always un-mirrored for readable text)
  drawHUDTelemetry(ctx, w, h, cameraId, zoneName, fps, inferenceMs, ppeSummary, fireSmoke);
}

function drawSensorGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;

  // Corner brackets
  const cornerSize = Math.min(w, h) * 0.05;
  const margin = 20;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(margin, margin + cornerSize);
  ctx.lineTo(margin, margin);
  ctx.lineTo(margin + cornerSize, margin);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(w - margin - cornerSize, margin);
  ctx.lineTo(w - margin, margin);
  ctx.lineTo(w - margin, margin + cornerSize);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(margin, h - margin - cornerSize);
  ctx.lineTo(margin, h - margin);
  ctx.lineTo(margin + cornerSize, h - margin);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(w - margin - cornerSize, h - margin);
  ctx.lineTo(w - margin, h - margin);
  ctx.lineTo(w - margin, h - margin - cornerSize);
  ctx.stroke();

  ctx.restore();
}

function drawDetectionBox(
  ctx: CanvasRenderingContext2D,
  det: Detection,
  w: number,
  h: number,
  isMirrored: boolean
) {
  const { className, confidence, boundingBox } = det;
  const bx = boundingBox.x * w;
  const by = boundingBox.y * h;
  const bw = boundingBox.width * w;
  const bh = boundingBox.height * h;

  ctx.save();

  let strokeColor = '#3b82f6';
  let fillColor = 'rgba(59, 130, 246, 0.12)';
  let labelText = `${className.toUpperCase()} ${Math.round(confidence * 100)}%`;

  if (className === 'person') {
    strokeColor = '#38bdf8';
    fillColor = 'rgba(56, 189, 248, 0.08)';
    labelText = `OPERATOR [${det.trackId || 'TRK-01'}] • ${Math.round(confidence * 100)}%`;
  } else if (className === 'helmet') {
    strokeColor = '#10b981';
    fillColor = 'rgba(16, 185, 129, 0.15)';
    labelText = `HARD HAT [PASS] • ${Math.round(confidence * 100)}%`;
  } else if (className === 'vest') {
    strokeColor = '#10b981';
    fillColor = 'rgba(16, 185, 129, 0.15)';
    labelText = `HI-VIS VEST [PASS] • ${Math.round(confidence * 100)}%`;
  } else if (className === 'gloves') {
    strokeColor = '#10b981';
    fillColor = 'rgba(16, 185, 129, 0.15)';
    labelText = `GLOVES [PASS] • ${Math.round(confidence * 100)}%`;
  } else if (className === 'shoes') {
    strokeColor = '#10b981';
    fillColor = 'rgba(16, 185, 129, 0.15)';
    labelText = `SAFETY BOOTS [PASS] • ${Math.round(confidence * 100)}%`;
  } else if (className === 'fire') {
    strokeColor = '#ef4444';
    fillColor = 'rgba(239, 68, 68, 0.25)';
    labelText = `CRITICAL FIRE • ${Math.round(confidence * 100)}%`;
  } else if (className === 'smoke') {
    strokeColor = '#a855f7';
    fillColor = 'rgba(168, 85, 247, 0.2)';
    labelText = `HAZARD SMOKE • ${Math.round(confidence * 100)}%`;
  }

  // Draw bounding rect
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillRect(bx, by, bw, bh);

  // Small corner ticks
  const tickLen = Math.min(10, bw * 0.2, bh * 0.2);
  ctx.lineWidth = 3;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(bx, by + tickLen);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + tickLen, by);
  ctx.stroke();

  // Label tag above or inside box
  ctx.font = 'bold 11px monospace';
  const textWidth = ctx.measureText(labelText).width;
  const tagH = 18;
  const tagY = Math.max(0, by - tagH);

  ctx.fillStyle = strokeColor;
  ctx.fillRect(bx, tagY, textWidth + 10, tagH);

  ctx.fillStyle = '#000000';
  ctx.fillText(labelText, bx + 5, tagY + 13);

  ctx.restore();
}

function drawFireBox(
  ctx: CanvasRenderingContext2D,
  bbox: BoundingBox,
  conf: number,
  w: number,
  h: number,
  isMirrored: boolean
) {
  const bx = bbox.x * w;
  const by = bbox.y * h;
  const bw = bbox.width * w;
  const bh = bbox.height * h;

  ctx.save();

  // Pulsing flame glow animation
  const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;

  // Outer danger glow
  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 20 * pulse;

  ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.setLineDash([]);

  // Gradient fill for fire area
  const grad = ctx.createLinearGradient(bx, by + bh, bx, by);
  grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
  grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.3)');
  grad.addColorStop(1, 'rgba(234, 179, 8, 0.15)');
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw, bh);

  // Label Tag
  const label = `🔥 CRITICAL: FIRE OUTBREAK (${Math.round(conf * 100)}%)`;
  ctx.font = 'bold 12px monospace';
  const textW = ctx.measureText(label).width;
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(bx, Math.max(0, by - 22), textW + 12, 22);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, bx + 6, Math.max(0, by - 22) + 15);

  ctx.restore();
}

function drawSmokeBox(
  ctx: CanvasRenderingContext2D,
  bbox: BoundingBox,
  conf: number,
  density: number,
  w: number,
  h: number,
  isMirrored: boolean
) {
  const bx = bbox.x * w;
  const by = bbox.y * h;
  const bw = bbox.width * w;
  const bh = bbox.height * h;

  ctx.save();

  // Smoke plume boundary
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.setLineDash([]);

  // Haze fill
  ctx.fillStyle = 'rgba(168, 85, 247, 0.18)';
  ctx.fillRect(bx, by, bw, bh);

  // Label Tag
  const label = `💨 HAZARD: SMOKE PLUME (${Math.round(conf * 100)}% • Density ${Math.round(density)}%)`;
  ctx.font = 'bold 11px monospace';
  const textW = ctx.measureText(label).width;
  ctx.fillStyle = '#7e22ce';
  ctx.fillRect(bx, Math.max(0, by - 20), textW + 12, 20);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, bx + 6, Math.max(0, by - 20) + 14);

  ctx.restore();
}

function drawHUDTelemetry(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cameraId: string,
  zoneName: string,
  fps: number,
  inferenceMs: number,
  ppeSummary?: PPEDetection,
  fireSmoke?: FireSmokeDetection
) {
  ctx.save();

  // Top Left Watermark Banner
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.fillRect(16, 16, 260, 48);
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, 260, 48);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`AI SENSOR • ${cameraId} • ${zoneName.toUpperCase()}`, 26, 34);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.fillText(`STREAM: 30 FPS  |  AI INFERENCE: ~${inferenceMs}ms`, 26, 52);

  // Top Right Hazard Status Badge
  const hasCriticalHazard = fireSmoke?.hasFire || (fireSmoke?.hasSmoke && fireSmoke.smokeDensity > 50);
  if (hasCriticalHazard) {
    const bannerW = 240;
    ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
    ctx.fillRect(w - bannerW - 16, 16, bannerW, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    const alertMsg = fireSmoke?.hasFire ? '🚨 CRITICAL: FIRE OUTBREAK' : '⚠️ HEAVY SMOKE DETECTED';
    ctx.fillText(alertMsg, w - bannerW - 4, 38);
  }

  // Bottom Gear Compliance Strip (if PPE summary exists)
  if (ppeSummary) {
    const stripY = h - 38;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(16, stripY, w - 32, 28);
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.strokeRect(16, stripY, w - 32, 28);

    const items = [
      { name: 'HELMET', ok: ppeSummary.helmet },
      { name: 'HI-VIS VEST', ok: ppeSummary.vest },
      { name: 'SAFETY BOOTS', ok: ppeSummary.shoes },
      { name: 'GLOVES', ok: ppeSummary.gloves },
    ];

    let startX = 26;
    items.forEach((item) => {
      ctx.fillStyle = item.ok ? '#10b981' : '#f43f5e';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${item.ok ? '✓' : '✗'} ${item.name}: ${item.ok ? 'PASS' : 'MISSING'}`, startX, stripY + 18);
      startX += 145;
    });
  }

  ctx.restore();
}

/**
 * Generate synthetic realistic detection frame for demonstration or testing
 */
export function generateSyntheticFrameDetections(
  cameraId: string,
  activeHazard: 'NONE' | 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' = 'NONE'
): VisionFrameResult {
  const nowIso = new Date().toISOString();
  const detections: Detection[] = [];

  const isCompliant = activeHazard !== 'PPE_VIOLATION';
  const hasFire = activeHazard === 'FIRE';
  const hasSmoke = activeHazard === 'SMOKE';

  // Primary worker
  detections.push({
    detectionId: `worker-1`,
    className: 'person',
    confidence: 0.96,
    boundingBox: { x: 0.32, y: 0.16, width: 0.36, height: 0.74 },
    trackId: 'TRK-101',
    timestamp: nowIso,
  });

  // Helmet
  if (isCompliant) {
    detections.push({
      detectionId: `helmet-1`,
      className: 'helmet',
      confidence: 0.93,
      boundingBox: { x: 0.43, y: 0.16, width: 0.14, height: 0.12 },
      trackId: 'TRK-101',
      timestamp: nowIso,
    });
  }

  // Vest
  if (isCompliant) {
    detections.push({
      detectionId: `vest-1`,
      className: 'vest',
      confidence: 0.91,
      boundingBox: { x: 0.38, y: 0.28, width: 0.24, height: 0.28 },
      trackId: 'TRK-101',
      timestamp: nowIso,
    });
  }

  // Footwear
  detections.push({
    detectionId: `shoes-1`,
    className: 'shoes',
    confidence: 0.89,
    boundingBox: { x: 0.40, y: 0.82, width: 0.20, height: 0.08 },
    trackId: 'TRK-101',
    timestamp: nowIso,
  });

  // Gloves
  if (isCompliant) {
    detections.push({
      detectionId: `gloves-1`,
      className: 'gloves',
      confidence: 0.87,
      boundingBox: { x: 0.33, y: 0.54, width: 0.08, height: 0.07 },
      trackId: 'TRK-101',
      timestamp: nowIso,
    });
  }

  // Fire detection if triggered
  if (hasFire) {
    detections.push({
      detectionId: 'fire-1',
      className: 'fire',
      confidence: 0.96,
      boundingBox: { x: 0.70, y: 0.35, width: 0.24, height: 0.38 },
      timestamp: nowIso,
    });
  }

  // Smoke detection if triggered
  if (hasSmoke) {
    detections.push({
      detectionId: 'smoke-1',
      className: 'smoke',
      confidence: 0.88,
      boundingBox: { x: 0.15, y: 0.08, width: 0.65, height: 0.42 },
      timestamp: nowIso,
    });
  }

  return {
    timestamp: nowIso,
    cameraId,
    detections,
    ppeSummary: {
      person: true,
      helmet: isCompliant,
      vest: isCompliant,
      gloves: isCompliant,
      shoes: true,
      confidences: {
        helmet: isCompliant ? 0.93 : 0.0,
        vest: isCompliant ? 0.91 : 0.0,
        gloves: isCompliant ? 0.87 : 0.0,
        shoes: 0.89,
        person: 0.96,
      },
    },
    fireSmoke: {
      hasFire,
      fireConfidence: hasFire ? 0.96 : 0.0,
      fireBbox: hasFire ? { x: 0.70, y: 0.35, width: 0.24, height: 0.38 } : undefined,
      hasSmoke,
      smokeConfidence: hasSmoke ? 0.88 : 0.0,
      smokeBbox: hasSmoke ? { x: 0.15, y: 0.08, width: 0.65, height: 0.42 } : undefined,
      smokeDensity: hasSmoke ? 76.5 : 0.0,
    },
    inferenceTimeMs: 24,
  };
}
