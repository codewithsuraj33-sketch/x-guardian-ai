// ─────────────────────────────────────────────
// X-Guardian — Safety Engine
// Deterministic risk scoring for workers.
// Designed to be replaceable by real AI in later phases.
// ─────────────────────────────────────────────

import { Worker, Zone, SafetyAssessment, RiskLevel, PPEStatus } from '../types';
import { PPE_PENALTIES, RESTRICTED_ZONE_PENALTY, RISK_THRESHOLDS } from '../utils/constants';

/** Calculate PPE violation score */
function calcPPEScore(ppe: PPEStatus): { score: number; violations: string[] } {
  let score = 0;
  const violations: string[] = [];

  if (!ppe.helmet) {
    score += PPE_PENALTIES.helmet;
    violations.push('Helmet Missing');
  }
  if (!ppe.vest) {
    score += PPE_PENALTIES.vest;
    violations.push('Vest Missing');
  }
  if (!ppe.gloves) {
    score += PPE_PENALTIES.gloves;
    violations.push('Gloves Missing');
  }
  if (!ppe.shoes) {
    score += PPE_PENALTIES.shoes;
    violations.push('Safety Shoes Missing');
  }

  return { score, violations };
}

/** Convert a numeric risk score to a risk level */
function scoreToLevel(score: number): RiskLevel {
  for (const threshold of RISK_THRESHOLDS) {
    if (score <= threshold.max) return threshold.level;
  }
  return RiskLevel.CRITICAL;
}

/**
 * Assess the safety status of a single worker in a given zone.
 * This is a pure function — no side effects.
 */
export function assessWorkerSafety(worker: Worker, zone: Zone): SafetyAssessment {
  const { score: ppeScore, violations } = calcPPEScore(worker.ppe);

  let totalScore = ppeScore;

  if (zone.isRestricted) {
    totalScore += RESTRICTED_ZONE_PENALTY;
    violations.push('Restricted Zone Entry');
  }

  return {
    riskScore: totalScore,
    riskLevel: scoreToLevel(totalScore),
    violations,
  };
}

/** Assess overall zone safety based on workers present */
export function assessZoneSafety(workers: Worker[], zone: Zone): RiskLevel {
  if (workers.length === 0) return RiskLevel.LOW;

  const maxScore = Math.max(
    ...workers.map((w) => assessWorkerSafety(w, zone).riskScore)
  );

  return scoreToLevel(maxScore);
}
