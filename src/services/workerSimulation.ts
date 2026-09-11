// ─────────────────────────────────────────────
// X-Guardian — Worker Simulation
// Timer-based worker movement & PPE state changes.
// ─────────────────────────────────────────────

import { Worker, Zone } from '../types';
import { SIMULATION } from '../utils/constants';

const PPE_KEYS = ['helmet', 'vest', 'gloves', 'shoes'] as const;

/** Pick a random element from an array */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Simulate one tick of worker movement and PPE changes.
 * Returns a new workers array (immutable update).
 */
export function simulateTick(workers: Worker[], zones: Zone[]): Worker[] {
  return workers.map((worker) => {
    let updated = { ...worker, ppe: { ...worker.ppe } };

    // Possibly move to a different zone
    if (Math.random() < SIMULATION.MOVE_CHANCE) {
      const otherZones = zones.filter((z) => z.id !== worker.zoneId);
      if (otherZones.length > 0) {
        updated.zoneId = pickRandom(otherZones).id;
      }
    }

    // Possibly toggle a random PPE item
    if (Math.random() < SIMULATION.PPE_TOGGLE_CHANCE) {
      const key = pickRandom([...PPE_KEYS]);
      updated.ppe[key] = !updated.ppe[key];
    }

    return updated;
  });
}
