import { Incident, RiskLevel } from '../types';
import { audioAlert } from '../utils/audioAlert';

export interface AlertOptions {
  audioEnabled: boolean;
  browserNotificationEnabled: boolean;
}

export class AlertManager {
  notify(incident: Pick<Incident, 'violation' | 'cameraId' | 'severity'>, options: AlertOptions): void {
    if (options.audioEnabled) {
      if (incident.severity === RiskLevel.CRITICAL) {
        audioAlert.playEmergencySiren();
        window.setTimeout(() => audioAlert.stopSiren(), 3000);
      } else {
        audioAlert.playWarningBeep();
      }
    }

    if (options.browserNotificationEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('X-Guardian Safety Alert', {
        body: `${incident.violation} on ${incident.cameraId} (${incident.severity})`,
        icon: '/vite.svg',
      });
    }
  }
}

export const alertManager = new AlertManager();
