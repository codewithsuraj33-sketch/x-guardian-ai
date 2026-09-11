// ─────────────────────────────────────────────
// X-Guardian — Simulation Timer Hook
// Drives the worker simulation at a fixed interval.
// ─────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { Worker, Zone } from '../types';
import { simulateTick } from '../services/workerSimulation';
import { SIMULATION } from '../utils/constants';

/**
 * Runs the worker simulation on a timer.
 * Calls `onTick` with the new worker array each interval.
 */
export function useSimulation(
  workers: Worker[],
  zones: Zone[],
  onTick: (workers: Worker[]) => void,
  enabled: boolean = true
) {
  const workersRef = useRef(workers);
  workersRef.current = workers;

  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      const next = simulateTick(workersRef.current, zonesRef.current);
      onTick(next);
    }, SIMULATION.MOVE_INTERVAL);

    return () => clearInterval(id);
  }, [onTick, enabled]);
}
