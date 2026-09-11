// ─────────────────────────────────────────────
// X-Guardian — Header Bar
// ─────────────────────────────────────────────

import { Activity } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { useEffect, useState } from 'react';
import { checkBackendHealth } from '../services/visionService';

export default function Header() {
  const { systemSafetyStatus } = useSafety();
  const [time, setTime] = useState(new Date());
  const [modelConnected, setModelConnected] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((health) => {
      if (mounted) setModelConnected(health?.engineReady === true);
    });
    return () => { mounted = false; };
  }, []);

  const overallStatus = { label: systemSafetyStatus, color: 'text-slate-300', bg: 'bg-slate-800 border-slate-700', dot: 'bg-slate-400' };

  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="lg:hidden w-10" /> {/* spacer for mobile menu button */}
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          <span className="text-sm text-slate-400">
            AI Safety Monitoring
          </span>
          <span className="text-xs text-slate-600 hidden sm:inline">|</span>
          <span className="text-xs text-slate-500 hidden sm:inline">{modelConnected ? 'Model connected' : 'Model not connected'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* System status badge */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${overallStatus.bg}`}>
          <div className={`w-2 h-2 rounded-full ${overallStatus.dot} animate-pulse`} />
          <span className={`text-xs font-semibold tracking-wide ${overallStatus.color}`}>
            {overallStatus.label}
          </span>
        </div>

        {/* Clock */}
        <div className="text-xs text-slate-500 font-mono hidden md:block">
          {time.toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </div>
    </header>
  );
}
