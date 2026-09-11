// ─────────────────────────────────────────────
// X-Guardian — Web Audio Siren Synthesizer
// Zero external dependency industrial alarm sound generator
// ─────────────────────────────────────────────

class AudioAlertManager {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private isMuted = false;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Start high-priority pulsing emergency siren (Fire / Smoke / Evacuation)
   */
  public playEmergencySiren() {
    if (this.isPlaying || this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      this.isPlaying = true;
      const now = this.ctx.currentTime;

      // Primary sweeping frequency oscillator
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';

      // Secondary warble oscillator for industrial depth
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'sine';

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.12, now); // comfortable volume

      // Frequency sweep between 650Hz and 950Hz
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(1.5, now); // 1.5 sweeps per sec
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(150, now);
      lfo.connect(lfoGain);

      this.osc1.frequency.setValueAtTime(750, now);
      lfoGain.connect(this.osc1.frequency);

      this.osc2.frequency.setValueAtTime(450, now);

      this.osc1.connect(this.gainNode);
      this.osc2.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      lfo.start(now);
      this.osc1.start(now);
      this.osc2.start(now);
    } catch (e) {
      console.warn('[AudioAlert] Could not initialize emergency siren:', e);
    }
  }

  /**
   * Short warning beep for PPE violations
   */
  public playWarningBeep() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch (e) {
      console.warn('[AudioAlert] Warning beep failed:', e);
    }
  }

  /**
   * Stop active siren
   */
  public stopSiren() {
    if (!this.isPlaying) return;
    try {
      if (this.osc1) {
        this.osc1.stop();
        this.osc1.disconnect();
        this.osc1 = null;
      }
      if (this.osc2) {
        this.osc2.stop();
        this.osc2.disconnect();
        this.osc2 = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
    } catch {
      // ignore
    } finally {
      this.isPlaying = false;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSiren();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const audioAlert = new AudioAlertManager();
