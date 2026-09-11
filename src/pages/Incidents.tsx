// ─────────────────────────────────────────────
// X-Guardian — Incidents & Emergency Event Log
// Audit trail of safety gear compliance, fire outbreaks, and smoke hazard alerts
// ─────────────────────────────────────────────

import { useState } from 'react';
import { useFactory } from '../context/FactoryContext';
import { IncidentStatus, RiskLevel, Incident } from '../types';
import { formatTimestamp, getIncidentStatusClass } from '../utils/formatters';
import { RISK_BG_CLASSES } from '../utils/constants';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Flame,
  CloudFog,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

export default function Incidents() {
  const { incidents, dispatch } = useFactory();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const filtered = incidents.filter((i) => {
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    const matchesSeverity = severityFilter === 'ALL' || i.severity === severityFilter;
    const isFire = i.violation.toLowerCase().includes('fire');
    const isSmoke = i.violation.toLowerCase().includes('smoke');
    const isPPE = !isFire && !isSmoke;

    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'FIRE' && isFire) ||
      (typeFilter === 'SMOKE' && isSmoke) ||
      (typeFilter === 'PPE' && isPPE);

    return matchesStatus && matchesSeverity && matchesType;
  });

  const openCount = incidents.filter((i) => i.status === IncidentStatus.OPEN).length;
  const ackCount = incidents.filter((i) => i.status === IncidentStatus.ACKNOWLEDGED).length;
  const resolvedCount = incidents.filter((i) => i.status === IncidentStatus.RESOLVED).length;

  const exportAuditReport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Incident ID,Violation,Worker,Sector,Camera,Severity,Timestamp,Status']
        .concat(
          filtered.map(
            (i) =>
              `${i.incidentId},"${i.violation}",${i.workerId},${i.zoneId},${i.cameraId},${i.severity},${i.timestamp},${i.status}`
          )
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

  const handleStatusUpdate = (incidentId: string, newStatus: IncidentStatus) => {
    const updated = incidents.map((i) =>
      i.incidentId === incidentId ? { ...i, status: newStatus } : i
    );
    dispatch({ type: 'ADD_INCIDENTS', incidents: updated });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-xs font-mono tracking-wider text-amber-400 uppercase">
              PS6 Incident Audit & Location Evidence
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Safety Incidents & Hazard Records
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated location-specific logs for safety gear violations, fire presence, and smoke hazards
          </p>
        </div>

        {/* Filters & Export Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="ALL">All Event Types</option>
            <option value="FIRE">🔥 Fire Outbreaks</option>
            <option value="SMOKE">💨 Smoke Hazards</option>
            <option value="PPE">⚠️ PPE Gear Non-Compliance</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value={IncidentStatus.OPEN}>OPEN</option>
            <option value={IncidentStatus.ACKNOWLEDGED}>ACKNOWLEDGED</option>
            <option value={IncidentStatus.RESOLVED}>RESOLVED</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value={RiskLevel.CRITICAL}>CRITICAL</option>
            <option value={RiskLevel.HIGH}>HIGH</option>
            <option value={RiskLevel.MEDIUM}>MEDIUM</option>
            <option value={RiskLevel.LOW}>LOW</option>
          </select>

          <button
            onClick={exportAuditReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all"
            title="Export CSV Audit Report for Compliance Regulators"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Quick Status Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-rose-400 uppercase">Open Incidents</p>
            <p className="text-2xl font-bold text-rose-200 mt-1">{openCount}</p>
          </div>
          <AlertOctagon size={24} className="text-rose-400" />
        </div>

        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-amber-400 uppercase">Acknowledged</p>
            <p className="text-2xl font-bold text-amber-200 mt-1">{ackCount}</p>
          </div>
          <Clock size={24} className="text-amber-400" />
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-emerald-400 uppercase">Resolved</p>
            <p className="text-2xl font-bold text-emerald-200 mt-1">{resolvedCount}</p>
          </div>
          <CheckCircle2 size={24} className="text-emerald-400" />
        </div>
      </div>

      {/* Incident Log Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Incident ID</th>
                <th className="py-3.5 px-4 font-semibold">Detected Event / Violation</th>
                <th className="py-3.5 px-4 font-semibold">Worker & Sector</th>
                <th className="py-3.5 px-4 font-semibold">Camera Source</th>
                <th className="py-3.5 px-4 font-semibold">Severity</th>
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    No incidents matching selected filters
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => {
                  const isFire = inc.violation.toLowerCase().includes('fire');
                  const isSmoke = inc.violation.toLowerCase().includes('smoke');

                  return (
                    <tr key={inc.incidentId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-300">
                        {inc.incidentId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-100 flex items-center gap-2">
                        {isFire ? (
                          <Flame size={15} className="text-rose-500 animate-pulse flex-shrink-0" />
                        ) : isSmoke ? (
                          <CloudFog size={15} className="text-purple-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                        )}
                        <span>{inc.violation}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="font-mono text-blue-400">{inc.workerId}</span>
                        <span className="text-slate-500 mx-1">•</span>
                        <span className="text-slate-400 font-semibold">{inc.zoneId}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {inc.cameraId}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${RISK_BG_CLASSES[inc.severity]}`}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {formatTimestamp(inc.timestamp)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inc.status === IncidentStatus.OPEN && (
                            <button
                              onClick={() => handleStatusUpdate(inc.incidentId, IncidentStatus.ACKNOWLEDGED)}
                              className="px-2 py-0.5 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[10px] font-semibold"
                            >
                              Ack
                            </button>
                          )}
                          {inc.status !== IncidentStatus.RESOLVED && (
                            <button
                              onClick={() => handleStatusUpdate(inc.incidentId, IncidentStatus.RESOLVED)}
                              className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold"
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
    </div>
  );
}
