// ─────────────────────────────────────────────
// X-Guardian — Stat Card
// ─────────────────────────────────────────────

import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: string; // tailwind color token, e.g. 'blue', 'purple', etc.
  subtitle?: string;
}

export default function StatCard({ label, value, icon: Icon, color, subtitle }: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', iconBg: 'bg-blue-500/20' },
    green: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', iconBg: 'bg-amber-500/20' },
    red: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', iconBg: 'bg-rose-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', iconBg: 'bg-purple-500/20' },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5 flex items-start justify-between`}>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${c.text}`}>{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2.5 rounded-lg ${c.iconBg}`}>
        <Icon size={22} className={c.text} />
      </div>
    </div>
  );
}
