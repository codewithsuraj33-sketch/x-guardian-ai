// ─────────────────────────────────────────────
// X-Guardian — Incidents & Forensic Evidence Log
// Audit trail of safety gear compliance, worker falls, fire outbreaks, and smoke hazards
// with high-resolution snapshot photos and multi-source camera tracking
// ─────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSafety } from '../context/SafetyContext';
import { useFactory } from '../context/FactoryContext';
import { IncidentStatus, RiskLevel, Incident } from '../types';
import { formatTimestamp, getIncidentStatusClass } from '../utils/formatters';
import { RISK_BG_CLASSES } from '../utils/constants';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Flame,
  CloudFog,
  Download,
  Eye,
  Radio,
  Camera,
  Video,
  FileImage,
  RefreshCw,
  X,
  ExternalLink,
  ShieldAlert,
  Search,
  Filter,
  Maximize2,
  Check,
} from 'lucide-react';

interface CameraSourceInfo {
  label: string;
  sublabel: string;
  sourceType: 'IP_WEBCAM' | 'LAPTOP_WEBCAM' | 'CCTV' | 'VIDEO' | 'IMAGE' | 'UNKNOWN';
  badgeClass: string;
  icon: typeof Radio;
}

function resolveCameraSource(cameraId?: string, zoneId?: string): CameraSourceInfo {
  const cid = (cameraId || '').toUpperCase();
  if (cid.includes('CAM-06') || cid.includes('IP') || cid.includes('MOBILE') || cid.includes('RTSP') || cid.includes('8080')) {
    return {
      label: 'IP Webcam / Mobile',
      sublabel: cameraId || 'CAM-06',
      sourceType: 'IP_WEBCAM',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      icon: Radio,
    };
  }
  if (cid.includes('CAM-01') || cid.includes('LAPTOP') || cid.includes('WEBCAM')) {
    return {
      label: 'Laptop Camera / Entry',
      sublabel: 'CAM-01',
      sourceType: 'LAPTOP_WEBCAM',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Camera,
    };
  }
  if (cid.includes('RECORDED') || cid.includes('VIDEO') || cid.startsWith('VID')) {
    return {
      label: 'Video Footage / CCTV',
      sublabel: cameraId || 'RECORDED',
      sourceType: 'VIDEO',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      icon: Video,
    };
  }
  if (cid.includes('IMAGE') || cid.includes('IMG') || cid.includes('PHOTO')) {
    return {
      label: 'Image Inspection',
      sublabel: cameraId || 'UPLOAD',
      sourceType: 'IMAGE',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      icon: FileImage,
    };
  }
  if (cid === 'CAM-02') {
    return {
      label: 'Main Assembly Line',
      sublabel: 'CAM-02',
      sourceType: 'CCTV',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      icon: Video,
    };
  }
  if (cid === 'CAM-03') {
    return {
      label: 'High-Temp Welding Cell',
      sublabel: 'CAM-03',
      sourceType: 'CCTV',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      icon: Flame,
    };
  }
  if (cid === 'CAM-04') {
    return {
      label: 'Warehouse Logistics',
      sublabel: 'CAM-04',
      sourceType: 'CCTV',
      badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      icon: Video,
    };
  }
  if (cid === 'CAM-05') {
    return {
      label: 'Hazard Restricted Zone',
      sublabel: 'CAM-05',
      sourceType: 'CCTV',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      icon: AlertOctagon,
    };
  }
  return {
    label: `Camera ${cameraId || 'LIVE'}`,
    sublabel: cameraId || 'LIVE',
    sourceType: 'UNKNOWN',
    badgeClass: 'bg-slate-700/50 text-slate-300 border-slate-600',
    icon: Video,
  };
}

export default function Incidents() {
  const { incidents: safetyIncidents, updateIncidentStatus } = useSafety();
  const { incidents: factoryIncidents, dispatch: factoryDispatch } = useFactory();

  const [dbIncidents, setDbIncidents] = useState<Incident[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');

  // Fetch verified incidents from SQLite backend
  const fetchDbIncidents = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('http://127.0.0.1:8000/api/v1/incidents?limit=100');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDbIncidents(data);
        }
      }
    } catch (err) {
      // Backend temporarily unreachable, fall back to React contexts
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Poll DB on mount and every 4 seconds
  useEffect(() => {
    fetchDbIncidents();
    const interval = setInterval(fetchDbIncidents, 4000);
    return () => clearInterval(interval);
  }, [fetchDbIncidents]);

  // Combine and deduplicate incidents from SQLite DB and local contexts
  const combinedIncidents = useMemo(() => {
    const map = new Map<string, Incident>();

    // 1. Base factory context incidents
    factoryIncidents.forEach((inc) => map.set(inc.incidentId, inc));

    // 2. Safety context incidents (contains local state & localStorage)
    safetyIncidents.forEach((inc) => {
      const existing = map.get(inc.incidentId);
      map.set(inc.incidentId, {
        ...existing,
        ...inc,
        evidenceImage: inc.evidenceImage || existing?.evidenceImage,
      });
    });

    // 3. Database records (highest source of truth from backend YOLOv8 inference)
    dbIncidents.forEach((inc) => {
      const existing = map.get(inc.incidentId);
      map.set(inc.incidentId, {
        ...existing,
        ...inc,
        evidenceImage: inc.evidenceImage || existing?.evidenceImage,
      });
    });

    const list = Array.from(map.values());
    // Sort by timestamp newest first
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  }, [dbIncidents, safetyIncidents, factoryIncidents]);

  // Filter incidents
  const filtered = useMemo(() => {
    return combinedIncidents.filter((i) => {
      // Status filter
      if (statusFilter !== 'ALL' && i.status !== statusFilter) return false;

      // Severity filter
      if (severityFilter !== 'ALL' && i.severity !== severityFilter) return false;

      // Event type filter
      const vLower = (i.violation || '').toLowerCase();
      const isFire = vLower.includes('fire');
      const isSmoke = vLower.includes('smoke');
      const isFall = vLower.includes('fall') || vLower.includes('collapse');
      const isPPE = !isFire && !isSmoke && !isFall;

      if (typeFilter === 'FIRE' && !isFire) return false;
      if (typeFilter === 'SMOKE' && !isSmoke) return false;
      if (typeFilter === 'FALL' && !isFall) return false;
      if (typeFilter === 'PPE' && !isPPE) return false;

      // Camera channel filter
      const camInfo = resolveCameraSource(i.cameraId, i.zoneId);
      if (channelFilter === 'IP_WEBCAM' && camInfo.sourceType !== 'IP_WEBCAM') return false;
      if (channelFilter === 'LAPTOP_WEBCAM' && camInfo.sourceType !== 'LAPTOP_WEBCAM') return false;
      if (channelFilter === 'CCTV' && camInfo.sourceType !== 'CCTV') return false;
      if (channelFilter === 'MEDIA' && camInfo.sourceType !== 'VIDEO' && camInfo.sourceType !== 'IMAGE') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          i.incidentId.toLowerCase().includes(query) ||
          (i.violation || '').toLowerCase().includes(query) ||
          (i.workerId || '').toLowerCase().includes(query) ||
          (i.zoneId || '').toLowerCase().includes(query) ||
          (i.cameraId || '').toLowerCase().includes(query) ||
          camInfo.label.toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [combinedIncidents, statusFilter, severityFilter, typeFilter, channelFilter, searchQuery]);

  const openCount = combinedIncidents.filter((i) => i.status === IncidentStatus.OPEN).length;
  const ackCount = combinedIncidents.filter((i) => i.status === IncidentStatus.ACKNOWLEDGED).length;
  const resolvedCount = combinedIncidents.filter((i) => i.status === IncidentStatus.RESOLVED).length;
  const snapshotsCount = combinedIncidents.filter((i) => !!i.evidenceImage).length;

  const handleStatusChange = (incidentId: string, nextStatus: IncidentStatus) => {
    updateIncidentStatus(incidentId, nextStatus);
    factoryDispatch({
      type: 'ADD_INCIDENTS',
      incidents: combinedIncidents.map((i) =>
        i.incidentId === incidentId ? { ...i, status: nextStatus } : i
      ),
    });
    setDbIncidents((prev) =>
      prev.map((i) => (i.incidentId === incidentId ? { ...i, status: nextStatus } : i))
    );
    if (selectedIncident && selectedIncident.incidentId === incidentId) {
      setSelectedIncident({ ...selectedIncident, status: nextStatus });
    }
  };

  const exportAuditReport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Incident ID,Violation,Worker,Sector,Camera ID,Camera Source,Severity,Timestamp,Status,Has Snapshot']
        .concat(
          filtered.map((i) => {
            const camInfo = resolveCameraSource(i.cameraId, i.zoneId);
            return `${i.incidentId},"${i.violation}",${i.workerId || 'N/A'},${i.zoneId || 'ZONE-01'},${i.cameraId},"${camInfo.label}",${i.severity},${i.timestamp},${i.status},${i.evidenceImage ? 'YES' : 'NO'}`;
          })
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `x-guardian-safety-audit-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono tracking-wider text-cyan-400 uppercase font-semibold">
              PS-06 Multi-Camera Forensic Audit Log & Evidence Vault
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Safety Incidents & Evidence Snapshots
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Live AI-detected violations with high-res bounding-box photo evidence across Laptop Cam, IP Webcam, CCTV & Uploaded Footage
          </p>
        </div>

        {/* Live Sync Status & Export Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchDbIncidents}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono transition-all disabled:opacity-50"
            title="Poll SQLite Database for latest live-stream incidents"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-cyan-400' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Database'}</span>
          </button>

          <button
            onClick={exportAuditReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all"
            title="Export CSV Audit Report for Factory Regulators"
          >
            <Download size={13} />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-rose-400 uppercase tracking-wider">Open Violations</p>
            <p className="text-2xl font-bold text-rose-200 mt-1">{openCount}</p>
          </div>
          <AlertOctagon size={24} className="text-rose-400" />
        </div>

        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">Acknowledged</p>
            <p className="text-2xl font-bold text-amber-200 mt-1">{ackCount}</p>
          </div>
          <Clock size={24} className="text-amber-400" />
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Resolved</p>
            <p className="text-2xl font-bold text-emerald-200 mt-1">{resolvedCount}</p>
          </div>
          <CheckCircle2 size={24} className="text-emerald-400" />
        </div>

        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">Snapshots Saved</p>
            <p className="text-2xl font-bold text-cyan-200 mt-1">{snapshotsCount}</p>
          </div>
          <Camera size={24} className="text-cyan-400" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by incident ID, violation, worker, camera, or sector..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Camera Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Camera Feeds</option>
            <option value="IP_WEBCAM">📱 IP Webcam / Mobile Stream</option>
            <option value="LAPTOP_WEBCAM">💻 Laptop Camera / Main Gate</option>
            <option value="CCTV">🏭 Industrial CCTV (CAM 02-05)</option>
            <option value="MEDIA">🎬 Uploaded Video / Image</option>
          </select>

          {/* Event Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Event Types</option>
            <option value="PPE">⚠️ PPE Gear Non-Compliance</option>
            <option value="FALL">🚨 Worker Fall / Collapse</option>
            <option value="FIRE">🔥 Fire Outbreak</option>
            <option value="SMOKE">💨 Smoke Hazard</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value={IncidentStatus.OPEN}>OPEN</option>
            <option value={IncidentStatus.ACKNOWLEDGED}>ACKNOWLEDGED</option>
            <option value={IncidentStatus.RESOLVED}>RESOLVED</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value={RiskLevel.CRITICAL}>CRITICAL</option>
            <option value={RiskLevel.HIGH}>HIGH</option>
            <option value={RiskLevel.MEDIUM}>MEDIUM</option>
            <option value={RiskLevel.LOW}>LOW</option>
          </select>

          {(statusFilter !== 'ALL' || severityFilter !== 'ALL' || typeFilter !== 'ALL' || channelFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setSeverityFilter('ALL');
                setTypeFilter('ALL');
                setChannelFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 underline font-mono"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Incident Log Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="py-3.5 px-3 font-semibold text-center w-20">Snapshot</th>
                <th className="py-3.5 px-4 font-semibold">Incident ID</th>
                <th className="py-3.5 px-4 font-semibold">Detected Event / Violation</th>
                <th className="py-3.5 px-4 font-semibold">Camera Source</th>
                <th className="py-3.5 px-4 font-semibold">Worker & Sector</th>
                <th className="py-3.5 px-4 font-semibold">Severity</th>
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 italic">
                    <ShieldAlert size={28} className="mx-auto mb-2 opacity-30" />
                    No safety incidents matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => {
                  const vLower = (inc.violation || '').toLowerCase();
                  const isFire = vLower.includes('fire');
                  const isSmoke = vLower.includes('smoke');
                  const isFall = vLower.includes('fall') || vLower.includes('collapse');

                  const camSource = resolveCameraSource(inc.cameraId, inc.zoneId);
                  const CamIcon = camSource.icon;

                  return (
                    <tr
                      key={inc.incidentId}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedIncident(inc)}
                    >
                      {/* Evidence Photo Thumbnail */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => { e.stopPropagation(); setSelectedIncident(inc); }}>
                        {inc.evidenceImage ? (
                          <div className="relative inline-block group/thumb">
                            <img
                              src={inc.evidenceImage}
                              alt="Forensic Evidence"
                              className="w-14 h-10 object-cover rounded-md border border-slate-700 group-hover/thumb:border-cyan-400 transition-all shadow-sm"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye size={12} className="text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-10 mx-auto rounded-md border border-dashed border-slate-800 bg-slate-950 flex items-center justify-center text-slate-600">
                            <Camera size={14} />
                          </div>
                        )}
                      </td>

                      {/* Incident ID */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-300">
                        <span className="text-cyan-400">{inc.incidentId}</span>
                      </td>

                      {/* Violation & Event */}
                      <td className="py-3 px-4 font-medium text-slate-100">
                        <div className="flex items-center gap-2">
                          {isFire ? (
                            <Flame size={15} className="text-rose-500 animate-pulse flex-shrink-0" />
                          ) : isSmoke ? (
                            <CloudFog size={15} className="text-purple-400 flex-shrink-0" />
                          ) : isFall ? (
                            <AlertOctagon size={15} className="text-red-500 animate-bounce flex-shrink-0" />
                          ) : (
                            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold">{inc.violation}</p>
                            {inc.confidence && (
                              <p className="text-[10px] text-slate-500 font-mono">
                                AI Confidence: {(inc.confidence * 100).toFixed(1)}%
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Camera Source Badge */}
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium ${camSource.badgeClass}`}>
                          <CamIcon size={12} className="flex-shrink-0" />
                          <span>{camSource.label}</span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          ID: {inc.cameraId}
                        </p>
                      </td>

                      {/* Worker & Sector */}
                      <td className="py-3 px-4 text-slate-300">
                        <span className="font-mono text-blue-400 font-semibold">{inc.workerId || 'W-UNKNOWN'}</span>
                        <span className="text-slate-500 mx-1">•</span>
                        <span className="text-slate-300 font-medium">{inc.zoneId || 'ZONE-01'}</span>
                      </td>

                      {/* Severity */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${RISK_BG_CLASSES[inc.severity] || 'bg-slate-800 text-slate-400'}`}
                        >
                          {inc.severity}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        <p className="text-slate-200">{formatTimestamp(inc.timestamp)}</p>
                        <p className="text-[10px] font-mono text-slate-500">
                          {new Date(inc.timestamp).toLocaleTimeString()}
                        </p>
                      </td>

                      {/* Action / Status */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {inc.status === IncidentStatus.OPEN && (
                            <button
                              onClick={() => handleStatusChange(inc.incidentId, IncidentStatus.ACKNOWLEDGED)}
                              className="px-2 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[10px] font-semibold transition-all"
                            >
                              Ack
                            </button>
                          )}
                          {inc.status !== IncidentStatus.RESOLVED && (
                            <button
                              onClick={() => handleStatusChange(inc.incidentId, IncidentStatus.RESOLVED)}
                              className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold transition-all"
                            >
                              Resolve
                            </button>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getIncidentStatusClass(
                              inc.status
                            )}`}
                          >
                            {inc.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forensic Evidence Inspection Modal */}
      {selectedIncident && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Evidence Inspection: {selectedIncident.incidentId}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${RISK_BG_CLASSES[selectedIncident.severity]}`}
                    >
                      {selectedIncident.severity}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    High-resolution neural network visual evidence with timestamps and tracking tags
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Snapshot Viewport */}
              <div className="md:col-span-7 flex flex-col justify-center">
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black shadow-inner">
                  {selectedIncident.evidenceImage ? (
                    <img
                      src={selectedIncident.evidenceImage}
                      alt="AI Visual Evidence"
                      className="w-full h-auto max-h-[460px] object-contain mx-auto"
                    />
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-600 gap-2">
                      <Camera size={40} className="opacity-40" />
                      <p className="text-xs">No visual snapshot attached to this incident</p>
                    </div>
                  )}

                  {/* Watermark badge on photo */}
                  <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-2 py-1 rounded text-[10px] font-mono text-slate-300">
                    {selectedIncident.cameraId} • EVIDENCE SNAPSHOT
                  </div>
                </div>

                {selectedIncident.evidenceImage && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Timestamp: {new Date(selectedIncident.timestamp).toISOString()}
                    </span>
                    <a
                      href={selectedIncident.evidenceImage}
                      download={`x-guardian-evidence-${selectedIncident.incidentId}.jpg`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 transition-colors"
                    >
                      <Download size={13} />
                      <span>Download Photo Evidence</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Forensic Details Card */}
              <div className="md:col-span-5 space-y-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Forensic Incident Details
                  </h4>

                  <div>
                    <p className="text-[11px] text-slate-500">Detected Violation</p>
                    <p className="text-sm font-bold text-white mt-0.5">{selectedIncident.violation}</p>
                  </div>

                  {/* Camera Channel Identification */}
                  <div>
                    <p className="text-[11px] text-slate-500">Camera Source & Channel</p>
                    {(() => {
                      const camInfo = resolveCameraSource(selectedIncident.cameraId, selectedIncident.zoneId);
                      const CamIcon = camInfo.icon;
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${camInfo.badgeClass}`}>
                            <CamIcon size={14} />
                            <span>{camInfo.label}</span>
                          </div>
                          <span className="text-xs font-mono text-slate-400">({selectedIncident.cameraId})</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-[11px] text-slate-500">Worker ID</p>
                      <p className="text-xs font-mono font-semibold text-blue-400 mt-0.5">
                        {selectedIncident.workerId || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Factory Sector</p>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5">
                        {selectedIncident.zoneId || 'ZONE-01'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-[11px] text-slate-500">Confidence Score</p>
                      <p className="text-xs font-mono font-semibold text-emerald-400 mt-0.5">
                        {selectedIncident.confidence ? `${(selectedIncident.confidence * 100).toFixed(1)}%` : '92.5%'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Detection Frame</p>
                      <p className="text-xs font-mono text-slate-300 mt-0.5">
                        #{selectedIncident.frameNumber || 1}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1">
                    <p className="text-[11px] text-slate-500">Detection Time</p>
                    <p className="text-xs text-slate-200 mt-0.5">
                      {new Date(selectedIncident.timestamp).toLocaleString()} ({formatTimestamp(selectedIncident.timestamp)})
                    </p>
                  </div>

                  {/* Compliance Forensic Assessment */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <p className="text-[11px] text-slate-500">Compliance Forensic Assessment</p>
                    <div className="flex items-center justify-between text-xs bg-slate-900/90 px-2.5 py-1.5 rounded border border-rose-500/40">
                      <span className="text-rose-300 font-semibold text-[11px]">Primary Non-Compliance:</span>
                      <span className="text-rose-400 font-bold font-mono text-[11px]">{selectedIncident.violation}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Audit Mandate:</span>
                      <span className="text-amber-300 font-semibold text-[10px] uppercase tracking-wider">
                        Mandatory PPE Inspection
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Workflow Controls */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400 uppercase">Current Status</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${getIncidentStatusClass(
                        selectedIncident.status
                      )}`}
                    >
                      {selectedIncident.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {selectedIncident.status === IncidentStatus.OPEN && (
                      <button
                        onClick={() => handleStatusChange(selectedIncident.incidentId, IncidentStatus.ACKNOWLEDGED)}
                        className="flex-1 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Clock size={14} />
                        <span>Acknowledge</span>
                      </button>
                    )}
                    {selectedIncident.status !== IncidentStatus.RESOLVED && (
                      <button
                        onClick={() => handleStatusChange(selectedIncident.incidentId, IncidentStatus.RESOLVED)}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Resolved</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
