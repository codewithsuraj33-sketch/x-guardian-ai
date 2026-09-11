import { Link } from 'react-router-dom';
import { AlertTriangle, Camera, Clock3, ShieldCheck } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const { incidents, systemSafetyStatus } = useSafety();
  const today = new Date().toDateString();
  const todayCount = incidents.filter((incident) => new Date(incident.timestamp).toDateString() === today).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">X-GUARDIAN</p>
        <h1 className="mt-2 text-3xl font-bold text-white">AI Safety Monitoring</h1>
        <p className="mt-1 text-sm text-slate-400">A clear view of your inputs, detection readiness, and safety history.</p>
      </header>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Camera} label="Active Camera" value="Not active" color="blue" />
        <StatCard icon={AlertTriangle} label="Active Violations" value={incidents.length} color="amber" />
        <StatCard icon={Clock3} label="Today's Incidents" value={todayCount} color="green" />
        <StatCard icon={ShieldCheck} label="Safety Status" value={systemSafetyStatus} color="purple" />
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-5 flex aspect-video items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-center">
            <div>
              <Camera className="mx-auto text-slate-600" size={32} />
              <p className="mt-3 text-sm text-slate-500">No active camera input</p>
              <p className="mt-1 text-xs text-slate-600">Select Live Camera, Recorded Video, or Image in Cameras.</p>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Detection status</p>
          <h2 className="mt-2 text-xl font-semibold text-white">AI Detection Ready - Model Not Connected</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Camera, recorded video, and image inputs are available. Results will appear here after a trained vision model is connected.</p>
          <Link to="/cameras" className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Open Cameras</Link>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-white">Recent incidents</h2>
          {incidents.length === 0 ? <p className="mt-6 text-sm text-slate-500">No incidents detected</p> : <div className="mt-4 space-y-3">{incidents.slice(0, 4).map((incident) => <div key={incident.incidentId} className="flex items-center justify-between border-b border-slate-800 pb-3 text-sm"><span className="text-slate-200">{incident.violation}</span><span className="text-xs text-slate-500">{new Date(incident.timestamp).toLocaleTimeString()}</span></div>)}</div>}
          <Link to="/history" className="mt-5 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300">View history</Link>
        </div>
      </section>
    </div>
  );
}
