import { Link } from 'react-router-dom';
import { AlertTriangle, Camera, Clock3, ShieldCheck, Eye, LayoutGrid } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { useFactory } from '../context/FactoryContext';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const { incidents, systemSafetyStatus } = useSafety();
  const { cameras } = useFactory();
  const today = new Date().toDateString();
  const todayCount = incidents.filter(
    (incident) => new Date(incident.timestamp).toDateString() === today
  ).length;

  const onlineCount = cameras.filter((c) => c.status === 'ONLINE').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">X-GUARDIAN</p>
        <h1 className="mt-2 text-3xl font-bold text-white tracking-tight">AI Safety Monitoring Command Center</h1>
        <p className="mt-1 text-sm text-slate-400">
          Real-time optical surveillance feeds across 5 industrial plant sectors with automated PPE compliance auditing.
        </p>
      </header>

      {/* KPI Stat Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Camera}
          label="Active Surveillance"
          value={`${onlineCount || 5} Cameras Online`}
          color="blue"
        />
        <StatCard icon={AlertTriangle} label="Active Violations" value={incidents.length} color="amber" />
        <StatCard icon={Clock3} label="Today's Incidents" value={todayCount} color="green" />
        <StatCard icon={ShieldCheck} label="Safety Status" value={systemSafetyStatus} color="purple" />
      </section>

      {/* Main Surveillance Feeds Preview & Recent Incidents */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col justify-between">
          <div>
            {/* 5-Camera Preview Thumbnails Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { id: 'CAM-01', label: 'Entry Sector', img: '/images/cam01_entry.jpg' },
                { id: 'CAM-02', label: 'Assembly Line', img: '/images/cam02_assembly.jpg' },
                { id: 'CAM-03', label: 'Welding Bay', img: '/images/cam03_welding.jpg' },
                { id: 'CAM-04', label: 'Storage Area', img: '/images/cam04_storage.jpg' },
                { id: 'CAM-05', label: 'Restricted Zone', img: '/images/cam05_restricted.jpg' },
                { id: 'PPE-AUDIT', label: 'Worker Full PPE', img: '/images/worker_ppe_compliant.jpg' },
              ].map((item) => (
                <Link
                  key={item.id}
                  to="/cameras"
                  className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 hover:border-blue-500 transition-all group bg-slate-950"
                >
                  <img
                    src={item.img}
                    alt={item.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[9px] font-mono text-white">
                    <span className="font-bold">{item.id}</span>
                    <span className="text-emerald-400">● LIVE</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Surveillance Matrix Status
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  5 Optical Feeds Streaming &amp; Ready
                </h2>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                30 FPS SYNCHRONIZED
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              CCTV cameras are active across Entry, Assembly, Welding, Storage, and Restricted chemical sectors.
              Worker PPE compliance checking (Helmets, High-Vis Vests, Gloves, Safety Boots) is available with real-time detection overlays.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/cameras"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
            >
              <LayoutGrid size={16} />
              <span>Launch 5-Channel CCTV Video Wall</span>
            </Link>
            <Link
              to="/factory"
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Eye size={16} />
              <span>Virtual Factory Map</span>
            </Link>
          </div>
        </div>

        {/* Recent Incidents Panel */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent Safety Incidents</h2>
            {incidents.length === 0 ? (
              <div className="mt-6 p-6 rounded-lg border border-dashed border-slate-800 text-center text-sm text-slate-500">
                <ShieldCheck size={28} className="mx-auto text-emerald-400 mb-2 opacity-80" />
                No active safety incidents detected. All monitored sectors are compliant.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {incidents.slice(0, 5).map((incident) => (
                  <div
                    key={incident.incidentId}
                    className="flex items-center justify-between border-b border-slate-800 pb-3 text-sm"
                  >
                    <div>
                      <span className="text-slate-200 font-medium">{incident.violation}</span>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {incident.cameraId} • {incident.workerId || 'UNTAGGED'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(incident.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/history"
            className="mt-5 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Full Incident History &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
