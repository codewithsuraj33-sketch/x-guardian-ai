// ─────────────────────────────────────────────
// X-Guardian — Constants & Configuration
// ─────────────────────────────────────────────

import { RiskLevel } from '../types';

/** PPE violation penalty scores (used by safety engine) */
export const PPE_PENALTIES = {
  helmet: 30,
  vest: 20,
  gloves: 20,
  shoes: 10,
} as const;

/** Penalty for being in a restricted zone */
export const RESTRICTED_ZONE_PENALTY = 25;

/** Risk score thresholds mapped to risk levels */
export const RISK_THRESHOLDS: { max: number; level: RiskLevel }[] = [
  { max: 30, level: RiskLevel.LOW },
  { max: 60, level: RiskLevel.MEDIUM },
  { max: 80, level: RiskLevel.HIGH },
  { max: Infinity, level: RiskLevel.CRITICAL },
];

/** Worker simulation settings */
export const SIMULATION = {
  /** Interval between worker movements (ms) */
  MOVE_INTERVAL: 6000,
  /** Chance a worker moves during a tick (0–1) */
  MOVE_CHANCE: 0.35,
  /** Chance PPE state toggles during a tick (0–1) */
  PPE_TOGGLE_CHANCE: 0.08,
} as const;

/** Color palette for risk levels */
export const RISK_COLORS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: '#22c55e',
  [RiskLevel.MEDIUM]: '#f59e0b',
  [RiskLevel.HIGH]: '#f97316',
  [RiskLevel.CRITICAL]: '#ef4444',
};

/** Tailwind-compatible classes for risk levels */
export const RISK_BG_CLASSES: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [RiskLevel.MEDIUM]: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  [RiskLevel.HIGH]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  [RiskLevel.CRITICAL]: 'bg-red-500/20 text-red-400 border-red-500/30',
};

/** Zone color palette (for factory map) */
export const ZONE_COLORS = {
  'ZONE-01': '#3b82f6',
  'ZONE-02': '#22c55e',
  'ZONE-03': '#f59e0b',
  'ZONE-04': '#8b5cf6',
  'ZONE-05': '#ef4444',
} as const;

/** Navigation items */
export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/factory', label: 'Factory', icon: 'Factory' },
  { path: '/cameras', label: 'Cameras', icon: 'Camera' },
  { path: '/workers', label: 'Workers', icon: 'Users' },
  { path: '/incidents', label: 'Incidents', icon: 'AlertTriangle' },
  { path: '/analytics', label: 'Analytics', icon: 'BarChart3' },
] as const;
