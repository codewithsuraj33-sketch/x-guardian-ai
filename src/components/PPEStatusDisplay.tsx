// ─────────────────────────────────────────────
// X-Guardian — PPE Status Display
// ─────────────────────────────────────────────

import { PPEStatus } from '../types';
import { HardHat, Shirt, Hand, Footprints } from 'lucide-react';

interface PPEStatusDisplayProps {
  ppe: PPEStatus;
  compact?: boolean;
}

const PPE_ITEMS: { key: keyof PPEStatus; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'helmet', label: 'Helmet', Icon: HardHat },
  { key: 'vest', label: 'Vest', Icon: Shirt },
  { key: 'gloves', label: 'Gloves', Icon: Hand },
  { key: 'shoes', label: 'Shoes', Icon: Footprints },
];

export default function PPEStatusDisplay({ ppe, compact = false }: PPEStatusDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {PPE_ITEMS.map(({ key, label, Icon }) => (
          <div
            key={key}
            title={`${label}: ${ppe[key] ? 'Compliant' : 'Missing'}`}
            className={`p-1 rounded ${ppe[key] ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}
          >
            <Icon size={14} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {PPE_ITEMS.map(({ key, label, Icon }) => (
        <div
          key={key}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            ppe[key]
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          <Icon size={16} />
          <span className="text-xs font-medium">{label}</span>
          <span className="ml-auto text-sm">{ppe[key] ? '✓' : '✕'}</span>
        </div>
      ))}
    </div>
  );
}
