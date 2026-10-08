// ─────────────────────────────────────────────
// X-Guardian — Streamlined Sidebar Navigation
// Clean, focused navigation for industrial safety monitoring
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
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const MAIN_NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/cameras', label: 'Cameras', icon: Camera },
  { path: '/factory', label: 'Virtual Factory', icon: Factory },
  { path: '/workers', label: 'Personnel', icon: Users },
  { path: '/incidents', label: 'Incidents Log', icon: AlertTriangle },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile menu toggle */}
      <button
        className="fixed top-3.5 left-4 z-50 lg:hidden bg-slate-800 p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle navigation"
      >
        {collapsed ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900/95 backdrop-blur border-r border-slate-800 z-40 transition-all duration-300 flex flex-col
          ${collapsed ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-64'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">X-Guardian</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Safety Command</p>
          </div>
        </div>

        {/* Primary Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {MAIN_NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => setCollapsed(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}

          {/* Configuration separator */}
          <div className="pt-3 mt-3 border-t border-slate-800/80">
            <NavLink
              to="/settings"
              onClick={() => setCollapsed(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`
              }
            >
              <Settings size={17} className="shrink-0" />
              <span>Settings</span>
            </NavLink>
          </div>
        </nav>

        {/* Status Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-mono font-medium">System Online</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">YOLOv8 AI Active • 30 FPS</p>
        </div>
      </aside>
    </>
  );
}
