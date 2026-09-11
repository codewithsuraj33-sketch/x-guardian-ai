// ─────────────────────────────────────────────
// X-Guardian — Safety Context
// Manages real safety incidents, system settings, evidence records, and live status
// Zero simulated/fabricated metrics — strictly real input & results
// ─────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Incident, SystemSettings, RiskLevel, IncidentStatus } from '../types';
import { alertManager } from '../services/alertManager';

export const DEFAULT_SETTINGS: SystemSettings = {
  helmetRequired: true,
  vestRequired: true,
  glovesRequired: true,
  shoesRequired: true,
  confidenceThreshold: 0.75,
  audioAlert: true,
  browserNotification: false,
  cameraName: 'Live Camera 01',
  sourceType: 'LIVE_CAMERA',
};

const STORAGE_KEY_SETTINGS = 'xguardian_settings_v1';
const STORAGE_KEY_INCIDENTS = 'xguardian_incidents_v1';

interface SafetyContextValue {
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  incidents: Incident[];
  addIncident: (incident: {
    incidentId?: string;
    workerId?: string;
    trackId?: string;
    violation: string;
    severity: RiskLevel;
    cameraId: string;
    zoneId?: string;
    confidence?: number;
    frameNumber?: number;
    evidenceImage?: string;
  }) => void;
  clearIncidents: () => void;
  activeInputMode: 'LIVE_CAMERA' | 'RECORDED_VIDEO' | 'IMAGE';
  setActiveInputMode: (mode: 'LIVE_CAMERA' | 'RECORDED_VIDEO' | 'IMAGE') => void;
  cameraOperationalStatus: 'OFFLINE' | 'ACTIVE' | 'STOPPED' | 'REQUESTING' | 'ERROR';
  setCameraOperationalStatus: (status: 'OFFLINE' | 'ACTIVE' | 'STOPPED' | 'REQUESTING' | 'ERROR') => void;
  systemSafetyStatus: 'AWAITING AI' | 'SAFE' | 'WARNING' | 'HIGH RISK' | 'CRITICAL';
}

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ children }: { children: ReactNode }) {
  // 1. Settings state with localStorage persistence
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // 2. Real incidents state with localStorage persistence (starts EMPTY, zero fake incidents)
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INCIDENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  // 3. Active input channel & status
  const [activeInputMode, setActiveInputMode] = useState<'LIVE_CAMERA' | 'RECORDED_VIDEO' | 'IMAGE'>('LIVE_CAMERA');
  const [cameraOperationalStatus, setCameraOperationalStatus] = useState<
    'OFFLINE' | 'ACTIVE' | 'STOPPED' | 'REQUESTING' | 'ERROR'
  >('OFFLINE');

  // Save settings on update
  const updateSettings = useCallback((newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  // Record an incident
  const addIncident = useCallback(
    (incidentData: {
      incidentId?: string;
      workerId?: string;
      trackId?: string;
      violation: string;
      severity: RiskLevel;
      cameraId: string;
      zoneId?: string;
      confidence?: number;
      frameNumber?: number;
      evidenceImage?: string;
    }) => {
      const newIncident: Incident = {
        incidentId: incidentData.incidentId || `INC-${Date.now().toString().slice(-5)}`,
        timestamp: new Date().toISOString(),
        status: IncidentStatus.OPEN,
        ...incidentData,
      };

      setIncidents((prev) => {
        const updated = [newIncident, ...prev].slice(0, 100);
        try {
          localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      alertManager.notify(incidentData, {
        audioEnabled: settings.audioAlert,
        browserNotificationEnabled: settings.browserNotification,
      });
    },
    [settings.audioAlert, settings.browserNotification]
  );

  // Clear all incidents
  const clearIncidents = useCallback(() => {
    setIncidents([]);
    try {
      localStorage.removeItem(STORAGE_KEY_INCIDENTS);
    } catch {
      // ignore
    }
  }, []);

  // Calculate current system safety status based purely on open incidents
  const recentCritical = incidents.some((i) => i.severity === RiskLevel.CRITICAL && i.status === IncidentStatus.OPEN);
  const recentHigh = incidents.some((i) => i.severity === RiskLevel.HIGH && i.status === IncidentStatus.OPEN);
  const recentMedium = incidents.some((i) => i.severity === RiskLevel.MEDIUM && i.status === IncidentStatus.OPEN);

  const systemSafetyStatus: 'AWAITING AI' | 'SAFE' | 'WARNING' | 'HIGH RISK' | 'CRITICAL' = incidents.length === 0
    ? 'AWAITING AI'
    : recentCritical
    ? 'CRITICAL'
    : recentHigh
    ? 'HIGH RISK'
    : recentMedium
    ? 'WARNING'
    : 'SAFE';

  return (
    <SafetyContext.Provider
      value={{
        settings,
        updateSettings,
        incidents,
        addIncident,
        clearIncidents,
        activeInputMode,
        setActiveInputMode,
        cameraOperationalStatus,
        setCameraOperationalStatus,
        systemSafetyStatus,
      }}
    >
      {children}
    </SafetyContext.Provider>
  );
}

export function useSafety(): SafetyContextValue {
  const ctx = useContext(SafetyContext);
  if (!ctx) throw new Error('useSafety must be used within <SafetyProvider>');
  return ctx;
}
