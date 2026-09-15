// ─────────────────────────────────────────────
// X-Guardian — Sidebar Navigation
// PS06 Hackathon Prototype — Focused Navigation
// ─────────────────────────────────────────────

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  Factory,
  Users,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  History,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const iconMap = {
  LayoutDashboard,
  Camera,
  Factory,
  Users,
  AlertTriangle,
  BarChart3,
  History,
  Settings,
} as const;

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' as const },
  { path: '/cameras', label: 'Cameras', icon: 'Camera' as const },
  { path: '/factory', label: 'Virtual Factory', icon: 'Factory' as const },
  { path: '/workers', label: 'Personnel', icon: 'Users' as const },
  { path: '/incidents', label: 'Incidents Log', icon: 'AlertTriangle' as const },
  { path: '/analytics', label: 'Analytics', icon: 'BarChart3' as const },
  { path: '/history', label: 'History', icon: 'History' as const },
  { path: '/settings', label: 'Settings', icon: 'Settings' as const },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 p-2 rounded-lg border border-slate-700"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle navigation"
      >
        {collapsed ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900/95 backdrop-blur border-r border-slate-800 z-40 transition-all duration-300 flex flex-col
          ${collapsed ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-64'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">X-Guardian</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Safety Control</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setCollapsed(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-slate-500">System Online</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">AI safety monitoring</p>
        </div>
      </aside>
    </>
  );
}
