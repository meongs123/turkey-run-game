// Gobble Run — procedural audio. One AudioContext, one master gain, every
// sound synthesized with oscillators and filtered noise. No audio files.
export class ProceduralAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.ambienceOn = false;
    this._noiseBuffer = null;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
      const len = this.context.sampleRate;
      this._noiseBuffer = this.context.createBuffer(1, len, this.context.sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  _tone(type, from, to, duration, volume, delay = 0) {
    if (!this.context || !this.master) return;
    const t0 = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  _noise(duration, filterType, from, to, volume, delay = 0) {
    if (!this.context || !this.master || !this._noiseBuffer) return;
    const t0 = this.context.currentTime + delay;
    const src = this.context.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  gobble() {
    if (!this.ensure()) return;
    for (let i = 0; i < 4; i += 1) {
      this._tone('sawtooth', 300 - i * 25, 175, 0.09, 0.16, i * 0.1);
    }
  }

  step() {
    this._noise(0.05, 'lowpass', 420, 300, 0.05);
  }

  whoosh() {
    this._noise(0.3, 'bandpass', 2000, 300, 0.22);
  }

  sting() {
    this._tone('square', 220, 218, 0.4, 0.14);
    this._tone('square', 233, 231, 0.4, 0.14, 0.02);
    this._noise(0.2, 'lowpass', 900, 200, 0.12);
  }

  ovenWarn() {
    // Rising heat hiss: a climbing tone under filtered noise, 0.5 s,
    // with a second blip a fifth up so it reads as a warning, not a drone.
    this._tone('sawtooth', 180, 520, 0.5, 0.12);
    this._tone('sawtooth', 270, 780, 0.4, 0.08, 0.15);
    this._noise(0.5, 'bandpass', 900, 2400, 0.1);
  }

  ovenBlast() {
    // Whoomph: a low thump plus a burst of hot noise.
    this._tone('sine', 140, 45, 0.4, 0.4);
    this._noise(0.5, 'bandpass', 1600, 200, 0.3);
  }

  hit() {
    this._tone('sine', 120, 40, 0.25, 0.4);
    this._noise(0.15, 'lowpass', 700, 150, 0.3);
  }

  pickup() {
    this._tone('sine', 880, 1320, 0.12, 0.18);
  }

  fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((note, i) => this._tone('triangle', note, note, 0.35, 0.2, i * 0.13));
  }

  startAmbience() {
    if (!this.ensure() || this.ambienceOn || !this.context) return;
    this.ambienceOn = true;
    const src = this.context.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.context.createGain();
    gain.gain.value = 0.035;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }
}
