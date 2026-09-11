// ─────────────────────────────────────────────
// X-Guardian — Factory State Hook
// Central state management for Workers, Zones, Cameras, Incidents & Emergency Alerts
// ─────────────────────────────────────────────

import { useReducer, useCallback, useMemo } from 'react';
import {
  Worker,
  Zone,
  Camera,
  Incident,
  DashboardStats,
  RiskLevel,
  EmergencyAlert,
  IncidentStatus,
} from '../types';
import { initialWorkers } from '../data/workers';
import { initialZones } from '../data/zones';
import { initialCameras } from '../data/cameras';
import { initialIncidents } from '../data/incidents';
import { assessWorkerSafety, assessZoneSafety } from '../services/safetyEngine';
import { generateIncidents } from '../services/incidentEngine';
import { audioAlert } from '../utils/audioAlert';

// ── State ──

interface FactoryState {
  workers: Worker[];
  zones: Zone[];
  cameras: Camera[];
  incidents: Incident[];
  emergencyAlert: EmergencyAlert | null;
  activeHazardSimulation: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'NONE';
}

// ── Actions ──

type FactoryAction =
  | { type: 'SET_WORKERS'; workers: Worker[] }
  | { type: 'ADD_INCIDENTS'; incidents: Incident[] }
  | { type: 'TICK'; workers: Worker[] }
  | {
      type: 'TRIGGER_HAZARD';
      hazard: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'ALL_CLEAR';
      targetZoneId?: string;
    }
  | { type: 'ORDER_EVACUATION'; zoneId: string }
  | { type: 'ACKNOWLEDGE_ALERT'; alertId: string }
  | { type: 'DISMISS_ALERT' };

function reducer(state: FactoryState, action: FactoryAction): FactoryState {
  switch (action.type) {
    case 'SET_WORKERS':
      return { ...state, workers: action.workers };

    case 'ADD_INCIDENTS':
      return {
        ...state,
        incidents: [...action.incidents, ...state.incidents].slice(0, 60),
      };

    case 'TICK': {
      // If an active hazard simulation is running, preserve hazard state
      const updatedWorkers = action.workers.map((w) => {
        const zone = state.zones.find((z) => z.id === w.zoneId);
        if (!zone) return w;
        const assessment = assessWorkerSafety(w, zone);
        return {
          ...w,
          riskLevel: assessment.riskLevel,
          riskScore: assessment.riskScore,
          violations: assessment.violations,
        };
      });

      const updatedZones = state.zones.map((z) => {
        const zoneWorkers = updatedWorkers.filter((w) => w.zoneId === z.id);
        const baseStatus = assessZoneSafety(zoneWorkers, z);
        const finalStatus =
          z.hasActiveFire || z.hasActiveSmoke ? RiskLevel.CRITICAL : baseStatus;

        return {
          ...z,
          workerCount: zoneWorkers.length,
          safetyStatus: finalStatus,
        };
      });

      const newIncidents: Incident[] = [];
      for (const w of updatedWorkers) {
        const zone = updatedZones.find((z) => z.id === w.zoneId);
        if (!zone) continue;
        const generated = generateIncidents(w, zone, state.incidents);
        newIncidents.push(...generated);
      }

      return {
        ...state,
        workers: updatedWorkers,
        zones: updatedZones,
        incidents: [...newIncidents, ...state.incidents].slice(0, 60),
      };
    }

    case 'TRIGGER_HAZARD': {
      const nowIso = new Date().toISOString();

      if (action.hazard === 'ALL_CLEAR') {
        audioAlert.stopSiren();
        // Restore all zones and workers to safe
        const safeZones = state.zones.map((z) => ({
          ...z,
          hasActiveFire: false,
          hasActiveSmoke: false,
          evacuationOrdered: false,
          safetyStatus: z.isRestricted ? RiskLevel.MEDIUM : RiskLevel.LOW,
        }));

        const safeWorkers = state.workers.map((w) => ({
          ...w,
          ppe: { helmet: true, vest: true, gloves: true, shoes: true },
          riskLevel: RiskLevel.LOW,
          riskScore: 0,
          violations: [],
        }));

        return {
          ...state,
          zones: safeZones,
          workers: safeWorkers,
          emergencyAlert: null,
          activeHazardSimulation: 'NONE',
        };
      }

      if (action.hazard === 'FIRE') {
        audioAlert.playEmergencySiren();
        const targetZone = state.zones.find((z) => z.id === 'ZONE-03') || state.zones[2];

        const updatedZones = state.zones.map((z) =>
          z.id === targetZone.id
            ? { ...z, hasActiveFire: true, safetyStatus: RiskLevel.CRITICAL }
            : z
        );

        const alert: EmergencyAlert = {
          alertId: `ALERT-FIRE-${Date.now().toString().slice(-4)}`,
          hazardType: 'FIRE',
          severity: RiskLevel.CRITICAL,
          zoneId: targetZone.id,
          zoneName: targetZone.name,
          cameraId: targetZone.cameraId,
          title: `CRITICAL: Thermal Flare & Fire Outbreak in ${targetZone.name}`,
          description: `Optical AI sensor on ${targetZone.cameraId} detected sustained flame flare with 96.4% confidence adjacent to flammable manifold.`,
          timestamp: nowIso,
          confidence: 0.964,
          recommendedAction:
            'Activate Sector C foam suppression, engage halon ventilation dampers, and evacuate immediate zone.',
          evacuationRequired: true,
          dispatchedPersonnel: [
            {
              role: 'Industrial Fire Marshal',
              name: 'Capt. R. Sharma',
              status: 'DISPATCHED',
              channel: 'RADIO',
              timestamp: nowIso,
            },
            {
              role: 'Safety Officer',
              name: 'A. Patel',
              status: 'NOTIFIED',
              channel: 'SMS',
              timestamp: nowIso,
            },
            {
              role: 'Emergency Response Team',
              name: 'Squad Beta',
              status: 'DISPATCHED',
              channel: 'AUTOMATED_DISPATCH',
              timestamp: nowIso,
            },
            {
              role: 'Floor Supervisor',
              name: 'M. Jenkins',
              status: 'NOTIFIED',
              channel: 'PA_SYSTEM',
              timestamp: nowIso,
            },
          ],
        };

        const incident: Incident = {
          incidentId: `INC-FIRE-${Date.now().toString().slice(-4)}`,
          workerId: 'ALL-SECTOR-WORKERS',
          cameraId: targetZone.cameraId,
          zoneId: targetZone.id,
          violation: 'Active Industrial Fire Outbreak',
          severity: RiskLevel.CRITICAL,
          timestamp: nowIso,
          status: IncidentStatus.OPEN,
        };

        return {
          ...state,
          zones: updatedZones,
          emergencyAlert: alert,
          activeHazardSimulation: 'FIRE',
          incidents: [incident, ...state.incidents].slice(0, 60),
        };
      }

      if (action.hazard === 'SMOKE') {
        audioAlert.playEmergencySiren();
        const targetZone = state.zones.find((z) => z.id === 'ZONE-04') || state.zones[3];

        const updatedZones = state.zones.map((z) =>
          z.id === targetZone.id
            ? { ...z, hasActiveSmoke: true, safetyStatus: RiskLevel.CRITICAL }
            : z
        );

        const alert: EmergencyAlert = {
          alertId: `ALERT-SMOKE-${Date.now().toString().slice(-4)}`,
          hazardType: 'SMOKE',
          severity: RiskLevel.CRITICAL,
          zoneId: targetZone.id,
          zoneName: targetZone.name,
          cameraId: targetZone.cameraId,
          title: `HAZARD: Dense Smoke Plume Detected in ${targetZone.name}`,
          description: `Rapid smoke plume accumulation and atmospheric haziness (Density: 78%) identified on ${targetZone.cameraId} above chemical inventory.`,
          timestamp: nowIso,
          confidence: 0.885,
          recommendedAction:
            'Engage high-velocity smoke exhaust fans, seal chemical conduit gates, and begin partial sector evacuation.',
          evacuationRequired: true,
          dispatchedPersonnel: [
            {
              role: 'Hazmat Safety Lead',
              name: 'Dr. V. Rao',
              status: 'DISPATCHED',
              channel: 'AUTOMATED_DISPATCH',
              timestamp: nowIso,
            },
            {
              role: 'Ventilation Engineering',
              name: 'Unit 4 Ops',
              status: 'DISPATCHED',
              channel: 'RADIO',
              timestamp: nowIso,
            },
            {
              role: 'Floor Supervisor',
              name: 'M. Jenkins',
              status: 'NOTIFIED',
              channel: 'PA_SYSTEM',
              timestamp: nowIso,
            },
          ],
        };

        const incident: Incident = {
          incidentId: `INC-SMK-${Date.now().toString().slice(-4)}`,
          workerId: 'ALL-SECTOR-WORKERS',
          cameraId: targetZone.cameraId,
          zoneId: targetZone.id,
          violation: 'Dense Chemical Smoke Accumulation',
          severity: RiskLevel.CRITICAL,
          timestamp: nowIso,
          status: IncidentStatus.OPEN,
        };

        return {
          ...state,
          zones: updatedZones,
          emergencyAlert: alert,
          activeHazardSimulation: 'SMOKE',
          incidents: [incident, ...state.incidents].slice(0, 60),
        };
      }

      if (action.hazard === 'PPE_VIOLATION') {
        audioAlert.playWarningBeep();
        // Set worker 1 and 2 to non-compliant
        const modifiedWorkers = state.workers.map((w, idx) => {
          if (idx === 0) {
            return {
              ...w,
              ppe: { ...w.ppe, helmet: false, vest: false },
              riskLevel: RiskLevel.HIGH,
              riskScore: 70,
              violations: ['Helmet Missing', 'Vest Missing'],
            };
          }
          if (idx === 1) {
            return {
              ...w,
              ppe: { ...w.ppe, gloves: false, shoes: false },
              riskLevel: RiskLevel.HIGH,
              riskScore: 50,
              violations: ['Gloves Missing', 'Safety Shoes Missing'],
            };
          }
          return w;
        });

        const targetZone = state.zones[0];
        const alert: EmergencyAlert = {
          alertId: `ALERT-PPE-${Date.now().toString().slice(-4)}`,
          hazardType: 'PPE_VIOLATION',
          severity: RiskLevel.HIGH,
          zoneId: targetZone.id,
          zoneName: targetZone.name,
          cameraId: targetZone.cameraId,
          title: `PPE VIOLATION: Missing Hard Hat & High-Vis Vest`,
          description: `Automated vision AI identified 2 operators without mandatory protective gear in ${targetZone.name}.`,
          timestamp: nowIso,
          confidence: 0.942,
          recommendedAction:
            'Issue direct radio reprimand, mandate gear donning before line entry.',
          evacuationRequired: false,
          dispatchedPersonnel: [
            {
              role: 'Floor Safety Inspector',
              name: 'T. Vance',
              status: 'NOTIFIED',
              channel: 'SMS',
              timestamp: nowIso,
            },
            {
              role: 'Shift Lead',
              name: 'K. Gomez',
              status: 'NOTIFIED',
              channel: 'RADIO',
              timestamp: nowIso,
            },
          ],
        };

        return {
          ...state,
          workers: modifiedWorkers,
          emergencyAlert: alert,
          activeHazardSimulation: 'PPE_VIOLATION',
        };
      }

      return state;
    }

    case 'ORDER_EVACUATION': {
      const updatedZones = state.zones.map((z) =>
        z.id === action.zoneId ? { ...z, evacuationOrdered: true } : z
      );
      return { ...state, zones: updatedZones };
    }

    case 'ACKNOWLEDGE_ALERT': {
      if (!state.emergencyAlert) return state;
      return {
        ...state,
        emergencyAlert: {
          ...state.emergencyAlert,
          dispatchedPersonnel: state.emergencyAlert.dispatchedPersonnel.map((p) => ({
            ...p,
            status: 'DISPATCHED',
          })),
        },
      };
    }

    case 'DISMISS_ALERT': {
      audioAlert.stopSiren();
      return { ...state, emergencyAlert: null };
    }

    default:
      return state;
  }
}

// ── Initial state computation ──

function computeInitialState(): FactoryState {
  const zones = initialZones.map((z) => {
    const zoneWorkers = initialWorkers.filter((w) => w.zoneId === z.id);
    return {
      ...z,
      workerCount: zoneWorkers.length,
      hasActiveFire: false,
      hasActiveSmoke: false,
      evacuationOrdered: false,
    };
  });

  const workers = initialWorkers.map((w) => {
    const zone = zones.find((z) => z.id === w.zoneId)!;
    const assessment = assessWorkerSafety(w, zone);
    return {
      ...w,
      riskLevel: assessment.riskLevel,
      riskScore: assessment.riskScore,
      violations: assessment.violations,
    };
  });

  const finalZones = zones.map((z) => {
    const zoneWorkers = workers.filter((w) => w.zoneId === z.id);
    return { ...z, safetyStatus: assessZoneSafety(zoneWorkers, z) };
  });

  return {
    workers,
    zones: finalZones,
    cameras: initialCameras,
    incidents: initialIncidents,
    emergencyAlert: null,
    activeHazardSimulation: 'NONE',
  };
}

// ── Hook ──

export function useFactoryState() {
  const [state, dispatch] = useReducer(reducer, null, computeInitialState);

  const tick = useCallback((workers: Worker[]) => {
    dispatch({ type: 'TICK', workers });
  }, []);

  const triggerHazard = useCallback(
    (hazard: 'FIRE' | 'SMOKE' | 'PPE_VIOLATION' | 'ALL_CLEAR', targetZoneId?: string) => {
      dispatch({ type: 'TRIGGER_HAZARD', hazard, targetZoneId });
    },
    []
  );

  const orderEvacuation = useCallback((zoneId: string) => {
    dispatch({ type: 'ORDER_EVACUATION', zoneId });
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    dispatch({ type: 'ACKNOWLEDGE_ALERT', alertId });
  }, []);

  const dismissAlert = useCallback(() => {
    dispatch({ type: 'DISMISS_ALERT' });
  }, []);

  /** Dashboard statistics derived from state */
  const stats: DashboardStats = useMemo(() => {
    const safeWorkers = state.workers.filter((w) => w.riskLevel === RiskLevel.LOW).length;
    const activeViolations = state.workers.reduce((sum, w) => sum + w.violations.length, 0);
    const criticalAlerts =
      state.workers.filter((w) => w.riskLevel === RiskLevel.CRITICAL).length +
      state.zones.filter((z) => z.hasActiveFire || z.hasActiveSmoke).length;

    return {
      workersMonitored: state.workers.length,
      safeWorkers,
      activeViolations,
      criticalAlerts,
    };
  }, [state.workers, state.zones]);

  return {
    ...state,
    stats,
    tick,
    triggerHazard,
    orderEvacuation,
    acknowledgeAlert,
    dismissAlert,
    dispatch,
  };
}
