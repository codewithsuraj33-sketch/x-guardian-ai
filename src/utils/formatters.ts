// ─────────────────────────────────────────────
// X-Guardian — Formatting Utilities
// ─────────────────────────────────────────────

import { RiskLevel, CameraStatus, IncidentStatus, WorkerStatus } from '../types';
import { RISK_COLORS } from './constants';

/** Format an ISO timestamp to a human-readable string */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Get hex color for a risk level */
export function getRiskColor(level: RiskLevel): string {
  return RISK_COLORS[level];
}

/** Get a human-readable label for camera status */
export function getCameraStatusLabel(status: CameraStatus): string {
  return status === CameraStatus.ONLINE ? '● Online' : '○ Offline';
}

/** Get a CSS class string for incident status badges */
export function getIncidentStatusClass(status: IncidentStatus): string {
  switch (status) {
    case IncidentStatus.OPEN:
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case IncidentStatus.ACKNOWLEDGED:
      return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case IncidentStatus.RESOLVED:
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
  }
}

/** Get a CSS class string for worker status badges */
export function getWorkerStatusClass(status: WorkerStatus): string {
  switch (status) {
    case WorkerStatus.ACTIVE:
      return 'bg-green-500/20 text-green-400';
    case WorkerStatus.IDLE:
      return 'bg-slate-500/20 text-slate-400';
    case WorkerStatus.BREAK:
      return 'bg-amber-500/20 text-amber-400';
    case WorkerStatus.OFFLINE:
      return 'bg-red-500/20 text-red-400';
  }
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
