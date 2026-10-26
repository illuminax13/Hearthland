type Seasonish = "spring" | "summer" | "autumn" | "winter";

const MUTE_KEY = "hearthland-mute";

export class Soundboard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextNote = 0;
  private step = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.muted) this.master?.gain.setValueAtTime(0, this.ctx?.currentTime ?? 0);
    else this.master?.gain.setValueAtTime(0.22, this.ctx?.currentTime ?? 0);
    return this.muted;
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  update(season: Seasonish): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.nextNote === 0) this.nextNote = now + 0.05;
    const scale = season === "winter" ? [262, 311, 349, 392, 466] : season === "autumn" ? [294, 330, 392, 440, 494] : [262, 294, 330, 392, 440];
    while (this.nextNote < now + 0.4) {
      const freq = scale[this.step % scale.length]! / (this.step % 7 === 0 ? 2 : 1);
      this.tone(freq, this.nextNote, 0.55, "sine", 0.045);
      if (this.step % 4 === 0) this.tone(freq / 2, this.nextNote, 0.8, "triangle", 0.03);
      this.nextNote += season === "summer" ? 0.72 : 0.84;
      this.step++;
    }
  }

  play(name: string): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (name === "hoe") this.noise(t, 0.08, 0.08);
    else if (name === "water") this.tone(520, t, 0.12, "sine", 0.05);
    else if (name === "plant") this.tone(660, t, 0.08, "triangle", 0.05);
    else if (name === "harvest") {
      this.tone(523, t, 0.1, "triangle", 0.06);
      this.tone(659, t + 0.07, 0.12, "triangle", 0.05);
      this.tone(784, t + 0.14, 0.16, "sine", 0.05);
    } else if (name === "coin") {
      this.tone(880, t, 0.08, "square", 0.03);
      this.tone(1174, t + 0.06, 0.1, "square", 0.025);
    } else if (name === "chime") {
      this.tone(523, t, 0.2, "sine", 0.06);
      this.tone(784, t + 0.08, 0.25, "sine", 0.05);
    } else if (name === "night") {
      this.tone(196, t, 0.4, "sine", 0.05);
      this.tone(247, t + 0.05, 0.45, "triangle", 0.04);
    } else this.tone(420, t, 0.05, "sine", 0.04);
  }

  private tone(freq: number, when: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private noise(when: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(when);
  }
}
