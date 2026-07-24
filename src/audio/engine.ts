/**
 * Moteur audio généré en temps réel via Web Audio API.
 * Musique rythmée multi-pistes + effets sonores riches.
 */

type OscType = OscillatorType;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private beat = 0;

  musicOn = true;
  sfxOn = true;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.75;
      this.master.connect(ctx.destination);

      // Reverb/delay léger en parallèle
      const delay = ctx.createDelay(0.6);
      delay.delayTime.value = 0.22;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.22;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 1800;

      // Musique
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 1 : 0;
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.55;

      this.filter = ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 2600;
      this.filter.Q.value = 0.8;

      this.musicBus.connect(this.filter);
      this.filter.connect(this.musicGain);
      this.musicGain.connect(this.master);
      // delay parallèle
      this.musicBus.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(delayGain);
      delayGain.connect(this.master);

      // SFX
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
      this.sfxBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ensure();
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.15);
    }
  }

  setSfxOn(on: boolean) {
    this.sfxOn = on;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.08);
    }
  }

  private now() {
    return this.ctx?.currentTime ?? 0;
  }

  startMusic() {
    if (this.musicTimer != null) return;
    this.ensure();
    if (!this.ctx || !this.musicBus) return;

    const BPM = 124;
    const STEP = (60 / BPM) / 4 * 1000; // 16e

    const scale = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66];
    const bassPattern = [0, -1, 0, 2, 0, 3, 0, -1];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus || !this.musicGain) return;
      const t = this.now() + 0.04;
      const step = this.beat;
      const isKick = step % 4 === 0;
      const isSnare = step % 8 === 4;
      const isHat = step % 2 === 1;

      // Kick
      if (isKick) this.kick(t);
      // Snare
      if (isSnare) this.snare(t);
      // Hi-hat
      if (isHat) this.hat(t);

      // Basse
      const bi = bassPattern[step % bassPattern.length];
      if (bi >= 0) {
        const f = scale[bi] / 2;
        this.bass(f, t, 0.32);
      }

      // Arpège mélodique
      if (step % 2 === 0) {
        const idx = (Math.floor(step / 2) + step) % scale.length;
        this.musicNote(scale[idx], t, 0.16, "triangle", 0.13, true);
      }

      // Accents synthés
      if (step % 8 === 6 || step % 16 === 14) {
        const chord = [523.25, 659.25, 783.99];
        chord.forEach((f, i) =>
          this.musicNote(f, t + i * 0.03, 0.3, "sine", 0.055, true),
        );
      }

      this.beat = (this.beat + 1) % 64;
    }, STEP);
  }

  stopMusic() {
    if (this.musicTimer != null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Effets sonores                                                   */
  /* ---------------------------------------------------------------- */

  playEat() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || !this.sfxOn) return;
    const t = this.now();
    this.sweep(720, 1240, t, 0.07, "sine", 0.22);
    this.sweep(1240, 1860, t + 0.06, 0.08, "triangle", 0.14);
    this.noiseHit(t + 0.03, 0.04, 0.06);
  }

  playDie() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || !this.sfxOn) return;
    const t = this.now();
    this.sweep(440, 55, t, 0.6, "sawtooth", 0.28);
    this.sweep(220, 40, t + 0.08, 0.55, "square", 0.14);
    this.noiseHit(t, 0.45, 0.22);
  }

  playLevelUp() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || !this.sfxOn) return;
    const t = this.now();
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.note(f, t + i * 0.10, 0.28, "triangle", 0.19, this.sfxBus!);
    });
    this.noiseHit(t, 0.25, 0.08);
  }

  playVictory() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || !this.sfxOn) return;
    const t = this.now();
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      this.note(f, t + i * 0.11, 0.45, "triangle", 0.2, this.sfxBus!);
    });
    [0, 0.22, 0.44, 0.66].forEach((d) => this.noiseHit(t + d, 0.15, 0.06));
  }

  playClick() {
    if (!this.ctx || !this.sfxBus || !this.sfxOn) return;
    this.note(990, this.now(), 0.04, "sine", 0.11, this.sfxBus);
  }

  playPause() {
    if (!this.ctx || !this.sfxBus || !this.sfxOn) return;
    const t = this.now();
    this.note(440, t, 0.07, "sine", 0.13, this.sfxBus);
    this.note(330, t + 0.09, 0.12, "sine", 0.13, this.sfxBus);
  }

  /* ---------------------------------------------------------------- */
  /* Primitives                                                       */
  /* ---------------------------------------------------------------- */

  private kick(t: number) {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private snare(t: number) {
    if (!this.ctx || !this.musicBus) return;
    this.noiseBurst(t, 0.12, 0.45, this.musicBus);
  }

  private hat(t: number) {
    if (!this.ctx || !this.musicBus) return;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    this.noiseBurst(t, 0.05, 0.3, g);
    g.connect(hp);
    hp.connect(this.musicBus!);
  }

  private bass(freq: number, t: number, dur: number) {
    this.musicNote(freq, t, dur, "square", 0.14, false);
  }

  private musicNote(
    freq: number,
    when: number,
    dur: number,
    type: OscType,
    gain: number,
    sharp: boolean,
  ) {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.005);
    if (sharp) {
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    } else {
      g.gain.setTargetAtTime(0.0001, when + dur * 0.6, dur * 0.25);
    }
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private note(
    freq: number,
    when: number,
    dur: number,
    type: OscType,
    gain: number,
    dest: AudioNode,
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private sweep(
    from: number,
    to: number,
    when: number,
    dur: number,
    type: OscType,
    gain: number,
  ) {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + dur);
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private noiseBurst(
    when: number,
    dur: number,
    gain: number,
    dest: AudioNode,
  ) {
    if (!this.ctx) return;
    const bufSize = this.ctx.sampleRate * dur * 1.5;
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(g);
    g.connect(dest);
    src.start(when);
  }

  private noiseHit(when: number, dur: number, gain: number) {
    if (!this.ctx || !this.sfxBus) return;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    this.noiseBurst(when, dur, gain, hp);
    hp.connect(this.sfxBus);
  }
}

export const audio = new AudioEngine();
