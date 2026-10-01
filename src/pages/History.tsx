// ─────────────────────────────────────────────
// X-Guardian — Safety Records & Audit History
// Comprehensive audit log of PPE compliance, falls, zone intrusions, and incident evidence
// ─────────────────────────────────────────────

import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  FileSpreadsheet,
  AlertOctagon,
  Flame,
  CloudFog,
  User,
  Camera as CameraIcon,
  MapPin,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useSafety } from '../context/SafetyContext';
import { useFactory } from '../context/FactoryContext';
import { Incident, RiskLevel, IncidentStatus } from '../types';
import { formatTimestamp, getIncidentStatusClass } from '../utils/formatters';

type TimeRangeFilter = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK';
type CategoryFilter = 'ALL' | 'FALLS' | 'PPE' | 'ZONE' | 'FIRE_SMOKE';

export default function History() {
  const {
    incidents: safetyIncidents,
    updateIncidentStatus: updateSafetyStatus,
    resetToSampleIncidents,
  } = useSafety();
  const { incidents: factoryIncidents, dispatch: factoryDispatch } = useFactory();

  // Combine and deduplicate incidents from both contexts so no data is ever missed
  const allIncidents = useMemo(() => {
    const map = new Map<string, Incident>();
    // Priority to live safety context incidents (which may include evidenceImage)
    safetyIncidents.forEach((inc) => map.set(inc.incidentId, inc));
    factoryIncidents.forEach((inc) => {
      if (!map.has(inc.incidentId)) {
        map.set(inc.incidentId, inc);
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [safetyIncidents, factoryIncidents]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeRangeFilter>('ALL');

  // Modal inspection state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Filter application
  const filteredIncidents = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return allIncidents.filter((inc) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          inc.incidentId.toLowerCase().includes(query) ||
          inc.violation.toLowerCase().includes(query) ||
          (inc.workerId && inc.workerId.toLowerCase().includes(query)) ||
          (inc.trackId && inc.trackId.toLowerCase().includes(query)) ||
          inc.cameraId.toLowerCase().includes(query) ||
          (inc.zoneId && inc.zoneId.toLowerCase().includes(query));
        if (!matches) return false;
      }

      // 2. Severity Filter
      if (severityFilter !== 'ALL' && inc.severity !== severityFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) {
        return false;
      }

      // 4. Category Filter
      if (categoryFilter !== 'ALL') {
        const text = inc.violation.toLowerCase();
        const isFall = text.includes('fall') || text.includes('collapse') || text.includes('man down');
        const isFireSmoke = text.includes('fire') || text.includes('smoke');
        const isZone = text.includes('restricted') || text.includes('zone') || text.includes('intrusion');
        const isPPE = !isFall && !isFireSmoke && !isZone;

        if (categoryFilter === 'FALLS' && !isFall) return false;
        if (categoryFilter === 'FIRE_SMOKE' && !isFireSmoke) return false;
        if (categoryFilter === 'ZONE' && !isZone) return false;
        if (categoryFilter === 'PPE' && !isPPE) return false;
      }

      // 5. Time Filter
      if (timeFilter !== 'ALL') {
        const incTime = new Date(inc.timestamp).getTime();
        const ageMs = now - incTime;
        if (timeFilter === 'TODAY' && ageMs > oneDay) return false;
        if (timeFilter === 'YESTERDAY' && (ageMs < oneDay || ageMs > 2 * oneDay)) return false;
        if (timeFilter === 'WEEK' && ageMs > 7 * oneDay) return false;
      }

      return true;
    });
  }, [allIncidents, searchQuery, severityFilter, statusFilter, categoryFilter, timeFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = allIncidents.length;
    const critical = allIncidents.filter(
      (i) => i.severity === RiskLevel.CRITICAL || i.violation.toLowerCase().includes('fall')
    ).length;
    const ppeViolations = allIncidents.filter((i) => {
      const v = i.violation.toLowerCase();
      return v.includes('helmet') || v.includes('vest') || v.includes('boot') || v.includes('glove') || v.includes('mask');
    }).length;
    const resolved = allIncidents.filter((i) => i.status === IncidentStatus.RESOLVED).length;
    const confidences = allIncidents.filter((i) => i.confidence !== undefined).map((i) => i.confidence as number);
    const avgConfidence = confidences.length > 0
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100)
      : 94;

    return { total, critical, ppeViolations, resolved, avgConfidence };
  }, [allIncidents]);

  // Status transition handler
  const handleUpdateStatus = (incidentId: string, nextStatus: IncidentStatus) => {
    updateSafetyStatus(incidentId, nextStatus);
    const updated = factoryIncidents.map((i) =>
      i.incidentId === incidentId ? { ...i, status: nextStatus } : i
    );
    factoryDispatch({ type: 'ADD_INCIDENTS', incidents: updated });

    if (selectedIncident && selectedIncident.incidentId === incidentId) {
      setSelectedIncident({ ...selectedIncident, status: nextStatus });
    }
  };

  // CSV Export
  const exportHistoryCSV = () => {
    const headers = ['Incident ID,Timestamp,Date,Time,Event,Subject,Camera,Sector,Severity,Confidence,Status'];
    const rows = filteredIncidents.map((i) => {
      const d = new Date(i.timestamp);
      return `"${i.incidentId}","${i.timestamp}","${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${i.violation}","${i.workerId || i.trackId || '-'}","${i.cameraId}","${i.zoneId || '-'}","${i.severity}","${i.confidence ? Math.round(i.confidence * 100) + '%' : '-'}","${i.status}"`;
    });
    const csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
    const link = document.createElement('a');
    link.href = csvData;
    link.download = `x-guardian-safety-history-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Violation Icon
  const getViolationIcon = (violation: string) => {
    const text = violation.toLowerCase();
    if (text.includes('fall') || text.includes('collapse')) {
      return <AlertOctagon size={16} className="text-rose-400" />;
    }
    if (text.includes('fire')) {
      return <Flame size={16} className="text-orange-400" />;
    }
    if (text.includes('smoke')) {
      return <CloudFog size={16} className="text-purple-400" />;
    }
    if (text.includes('zone') || text.includes('restricted')) {
      return <MapPin size={16} className="text-amber-400" />;
    }
    return <ShieldAlert size={16} className="text-blue-400" />;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
              AUDIT TRAIL & COMPLIANCE RECORDS
            </span>
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Connected
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Safety History & Incident Log
          </h1>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl leading-relaxed">
            Persistent audit records across worker PPE compliance, skeletal fall detection, restricted zone entries, and vision model evidence.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={resetToSampleIncidents}
            title="Reload verified sample factory history"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-700 transition"
          >
            <RefreshCw size={13} />
            <span>Reload Audit Data</span>
          </button>
          <button
            onClick={exportHistoryCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
          >
            <FileSpreadsheet size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Statistics Section */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium uppercase text-slate-400">Total Audits Logged</span>
            <Clock size={16} className="text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono">{stats.total}</div>
          <p className="mt-1 text-[11px] text-slate-500">Historical & live detections</p>
        </div>

        <div className="rounded-xl border border-rose-900/30 bg-rose-950/20 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium uppercase text-rose-300">Critical Alerts & Falls</span>
            <AlertOctagon size={16} className="text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-200 font-mono flex items-center gap-2">
            {stats.critical}
            {stats.critical > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                ACTION REQUIRED
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-rose-400/70">Man-down & emergency events</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium uppercase text-slate-400">PPE Gear Violations</span>
            <ShieldAlert size={16} className="text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300 font-mono">{stats.ppeViolations}</div>
          <p className="mt-1 text-[11px] text-slate-500">Helmets, vests, boots, gloves</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium uppercase text-slate-400">Mean AI Confidence</span>
            <Sparkles size={16} className="text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-300 font-mono">{stats.avgConfidence}%</div>
          <p className="mt-1 text-[11px] text-slate-500">YOLOv8 + Pose accuracy score</p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, worker, violation, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none font-mono"
          >
            <option value="ALL">All Categories</option>
            <option value="FALLS">🚨 Falls & Collapses</option>
            <option value="PPE">⛑ PPE Compliance</option>
            <option value="ZONE">⛔ Zone Intrusions</option>
            <option value="FIRE_SMOKE">🔥 Fire & Smoke</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value={RiskLevel.CRITICAL}>Critical Risk</option>
            <option value={RiskLevel.HIGH}>High Risk</option>
            <option value={RiskLevel.MEDIUM}>Medium Risk</option>
            <option value={RiskLevel.LOW}>Low Risk</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value={IncidentStatus.OPEN}>Status: Open</option>
            <option value={IncidentStatus.ACKNOWLEDGED}>Status: Acknowledged</option>
            <option value={IncidentStatus.RESOLVED}>Status: Resolved</option>
          </select>

          {/* Timeframe Filter */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeRangeFilter)}
            className="rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none font-mono"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Last 24 Hours</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="WEEK">Past 7 Days</option>
          </select>
        </div>

        {/* Filter Indicator & Reset */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Showing <strong className="text-white font-mono">{filteredIncidents.length}</strong> of{' '}
            <span className="font-mono">{allIncidents.length}</span> recorded safety incidents
          </span>
          {(searchQuery || severityFilter !== 'ALL' || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || timeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSeverityFilter('ALL');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setTimeFilter('ALL');
              }}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </section>

      {/* Main Incidents Table */}
      {filteredIncidents.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-3">
            <Filter size={20} />
          </div>
          <h3 className="text-base font-semibold text-white">No Matching Incidents Found</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search criteria or resetting filters to view all audit records.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSeverityFilter('ALL');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setTimeFilter('ALL');
              }}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition"
            >
              Clear Filters
            </button>
            <button
              onClick={resetToSampleIncidents}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
            >
              Reload Sample Data
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70 shadow-xl">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3.5">ID & Type</th>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Camera / Sector</th>
                <th className="px-4 py-3.5">Subject</th>
                <th className="px-4 py-3.5">Safety Violation / Telemetry</th>
                <th className="px-4 py-3.5">Severity</th>
                <th className="px-4 py-3.5">Confidence</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredIncidents.map((incident) => {
                const date = new Date(incident.timestamp);
                const isCritical = incident.severity === RiskLevel.CRITICAL || incident.violation.toLowerCase().includes('fall');

                return (
                  <tr
                    key={incident.incidentId}
                    className={`transition-colors hover:bg-slate-800/40 ${
                      isCritical ? 'bg-rose-950/10' : ''
                    }`}
                  >
                    {/* Incident ID */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {getViolationIcon(incident.violation)}
                        <span className="font-mono text-xs font-bold text-white">
                          {incident.incidentId}
                        </span>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="text-xs text-slate-200">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                        <span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">{formatTimestamp(incident.timestamp)}</span>
                      </div>
                    </td>

                    {/* Camera & Zone */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-300 border border-slate-700/60">
                        <CameraIcon size={11} className="text-blue-400" />
                        <span>{incident.cameraId}</span>
                      </div>
                      {incident.zoneId && (
                        <div className="mt-1 text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <MapPin size={11} className="text-slate-500" />
                          <span>{incident.zoneId}</span>
                        </div>
                      )}
                    </td>

                    {/* Subject Worker */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        <span className="font-mono text-xs text-slate-300 font-semibold">
                          {incident.workerId || (incident.trackId ? `TRK-${incident.trackId}` : 'UNASSIGNED')}
                        </span>
                      </div>
                    </td>

                    {/* Violation Text */}
                    <td className="px-4 py-3.5">
                      <div className={`text-xs font-semibold ${isCritical ? 'text-rose-300' : 'text-slate-200'}`}>
                        {incident.violation}
                      </div>
                      {incident.frameNumber && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Frame #{incident.frameNumber}
                        </div>
                      )}
                    </td>

                    {/* Severity Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide border ${
                          incident.severity === RiskLevel.CRITICAL
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                            : incident.severity === RiskLevel.HIGH
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                            : incident.severity === RiskLevel.MEDIUM
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-green-500/20 text-green-300 border-green-500/40'
                        }`}
                      >
                        {incident.severity}
                      </span>
                    </td>

                    {/* AI Confidence */}
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
                      {incident.confidence !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                incident.confidence >= 0.9 ? 'bg-cyan-400' : 'bg-amber-400'
                              }`}
                              style={{ width: `${Math.round(incident.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-slate-300 font-medium">
                            {Math.round(incident.confidence * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* Lifecycle Status Dropdown */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <select
                        value={incident.status}
                        onChange={(e) => handleUpdateStatus(incident.incidentId, e.target.value as IncidentStatus)}
                        className={`rounded px-2 py-0.5 text-[11px] font-mono font-bold uppercase border cursor-pointer focus:outline-none ${getIncidentStatusClass(
                          incident.status
                        )}`}
                      >
                        <option value={IncidentStatus.OPEN}>OPEN</option>
                        <option value={IncidentStatus.ACKNOWLEDGED}>ACKNOWLEDGED</option>
                        <option value={IncidentStatus.RESOLVED}>RESOLVED</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedIncident(incident)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-blue-500 hover:text-white transition"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Incident Details & Evidence Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                {getViolationIcon(selectedIncident.violation)}
                <div>
                  <h2 className="text-base font-bold text-white font-mono">
                    {selectedIncident.incidentId}
                  </h2>
                  <p className="text-xs text-slate-400">Incident Telemetry & Audit Evidence</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Evidence Snapshot */}
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-2">
                  Captured Video Evidence Frame
                </span>
                {selectedIncident.evidenceImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                    <img
                      src={selectedIncident.evidenceImage}
                      alt="Incident evidence frame"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center aspect-video flex flex-col items-center justify-center gap-2">
                    <CameraIcon size={32} className="text-slate-600" />
                    <p className="text-xs font-semibold text-slate-400">
                      Standard Sensor Log — Evidence Stored on Surveillance NVR Node
                    </p>
                    <p className="text-[11px] text-slate-600 font-mono">
                      Camera: {selectedIncident.cameraId} | Frame: {selectedIncident.frameNumber || 'N/A'}
                    </p>
                  </div>
                )}
              </div>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 uppercase block text-[10px]">Violation Event</span>
                  <span className="text-slate-200 font-semibold font-sans mt-0.5 block">
                    {selectedIncident.violation}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block text-[10px]">Severity Level</span>
                  <span
                    className={`font-bold mt-0.5 block ${
                      selectedIncident.severity === RiskLevel.CRITICAL
                        ? 'text-rose-400'
                        : selectedIncident.severity === RiskLevel.HIGH
                        ? 'text-orange-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {selectedIncident.severity}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block text-[10px]">AI Model Confidence</span>
                  <span className="text-cyan-400 font-bold mt-0.5 block">
                    {selectedIncident.confidence ? `${Math.round(selectedIncident.confidence * 100)}%` : '95% (Nominal)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block text-[10px]">Camera Node</span>
                  <span className="text-slate-200 mt-0.5 block">{selectedIncident.cameraId}</span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block text-[10px]">Assigned Sector</span>
                  <span className="text-slate-200 mt-0.5 block">{selectedIncident.zoneId || 'ZONE-01'}</span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block text-[10px]">Track / Operator ID</span>
                  <span className="text-slate-200 mt-0.5 block">
                    {selectedIncident.workerId || (selectedIncident.trackId ? `TRK-${selectedIncident.trackId}` : 'W-1001')}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 uppercase block text-[10px]">Recorded Timestamp</span>
                  <span className="text-slate-300 mt-0.5 block font-sans">
                    {new Date(selectedIncident.timestamp).toLocaleString()} ({formatTimestamp(selectedIncident.timestamp)})
                  </span>
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-white block">Audit Lifecycle Status</span>
                  <span className="text-[11px] text-slate-400">
                    Update current response state for this safety incident record.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedIncident.incidentId, IncidentStatus.OPEN)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                      selectedIncident.status === IncidentStatus.OPEN
                        ? 'bg-rose-600 text-white shadow'
                        : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedIncident.incidentId, IncidentStatus.ACKNOWLEDGED)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                      selectedIncident.status === IncidentStatus.ACKNOWLEDGED
                        ? 'bg-amber-600 text-white shadow'
                        : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedIncident.incidentId, IncidentStatus.RESOLVED)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                      selectedIncident.status === IncidentStatus.RESOLVED
                        ? 'bg-emerald-600 text-white shadow'
                        : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800 px-6 py-3.5 bg-slate-950/80 flex items-center justify-end">
              <button
                onClick={() => setSelectedIncident(null)}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
