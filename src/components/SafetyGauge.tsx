// ─────────────────────────────────────────────
// X-Guardian — Safety Gauge (SVG arc)
// ─────────────────────────────────────────────

import { useMemo } from 'react';
import { RiskLevel } from '../types';
import { RISK_COLORS } from '../utils/constants';

interface SafetyGaugeProps {
  /** 0–100 overall safety score (100 = fully safe) */
  score: number;
  level: RiskLevel;
}

export default function SafetyGauge({ score, level }: SafetyGaugeProps) {
  const color = RISK_COLORS[level];
  const clampedScore = Math.max(0, Math.min(100, score));

  const { d, dashArray, dashOffset } = useMemo(() => {
    const r = 70;
    const cx = 80;
    const cy = 85;
    const startAngle = Math.PI;
    const endAngle = 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy - r * Math.sin(endAngle);

    const arcPath = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
    const circumference = Math.PI * r;
    const offset = circumference * (1 - clampedScore / 100);

    return { d: arcPath, dashArray: circumference, dashOffset: offset };
  }, [clampedScore]);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 160 100" className="w-48 h-auto">
        {/* Background arc */}
        <path d={d} fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
        {/* Center text */}
        <text x="80" y="78" textAnchor="middle" className="fill-white text-2xl font-bold" fontSize="28">
          {clampedScore}%
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {level}
        </span>
      </div>
    </div>
  );
}
