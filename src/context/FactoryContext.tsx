// ─────────────────────────────────────────────
// X-Guardian — Factory Context
// Provides factory state, emergency alerts & simulation controls to the entire app tree.
// ─────────────────────────────────────────────

import { createContext, useContext, type ReactNode } from 'react';
import {
  Worker,
  Zone,
  Camera,
  Incident,
  DashboardStats,
  EmergencyAlert,
} from '../types';
import { useFactoryState } from '../hooks/useFactoryState';
import { useSimulation } from '../hooks/useSimulation';

interface FactoryContextValue {
  workers: Worker[];
  zones: Zone[];
  cameras: Camera[];
  incidents: Incident[];
  stats: DashboardStats;
  emergencyAlert: EmergencyAlert | null;
  activeHazardSimulation: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'NONE';
  triggerHazard: (
    hazard: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'ALL_CLEAR',
    targetZoneId?: string
  ) => void;
  orderEvacuation: (zoneId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
  dismissAlert: () => void;
  dispatch: (action: any) => void;
}

const FactoryContext = createContext<FactoryContextValue | null>(null);

export function FactoryProvider({ children }: { children: ReactNode }) {
  const {
    workers,
    zones,
    cameras,
    incidents,
    stats,
    emergencyAlert,
    activeHazardSimulation,
    tick,
    triggerHazard,
    orderEvacuation,
    acknowledgeAlert,
    dismissAlert,
    dispatch,
  } = useFactoryState();

  // Simulation disabled for real data integrity
  useSimulation(workers, zones, tick, false);

  return (
    <FactoryContext.Provider
      value={{
        workers,
        zones,
        cameras,
        incidents,
        stats,
        emergencyAlert,
        activeHazardSimulation,
        triggerHazard,
        orderEvacuation,
        acknowledgeAlert,
        dismissAlert,
        dispatch,
      }}
    >
      {children}
    </FactoryContext.Provider>
  );
}

export function useFactory(): FactoryContextValue {
  const ctx = useContext(FactoryContext);
  if (!ctx) throw new Error('useFactory must be used within <FactoryProvider>');
  return ctx;
}
