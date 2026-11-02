import type { PresenceState } from '../mobius/presence';

/**
 * Núcleo de luz de FRIDAY (estilo A · HUD).
 * - Anillos segmentados que giran a distintas velocidades y "respiran".
 * - Reloj del día: tus eventos reales como arcos de luz y una aguja en la hora actual.
 * - Escucha / habla: espectro alrededor del núcleo que sigue el volumen real.
 * - Piensa: barrido de escaneo. Necesita tu sí: ámbar. Error: rojo breve.
 * Dibujo en 2D con dos lienzos: uno nítido y otro pequeño desenfocado encima (resplandor barato).
 */
export interface HudEvent { start: string; end: string; allDay?: boolean; title: string }
export type HudAlert = 'none' | 'confirm' | 'error';

const CYAN = [127, 231, 255], AMBER = [255, 181, 71], RED = [255, 96, 96];
type P = { speed: number; spread: number; sweep: number; bright: number; spectrum: number };
const TARGET: Record<PresenceState, P> = {
  calm:   { speed: 1, spread: 1, sweep: 0, bright: 0.85, spectrum: 0 },
  listen: { speed: 1.6, spread: 1.04, sweep: 0, bright: 1.05, spectrum: 1 },
  think:  { speed: 3.2, spread: 0.97, sweep: 1, bright: 1, spectrum: 0 },
  speak:  { speed: 1.8, spread: 1.02, sweep: 0, bright: 1.1, spectrum: 1 },
};

export class HudCore {
  private crisp = document.createElement('canvas');
  private glow = document.createElement('canvas');
  private g = this.crisp.getContext('2d')!;
  private gg = this.glow.getContext('2d')!;
  private raf = 0;
  private last = performance.now();
  private t = 0;
  private cur: P = { ...TARGET.calm };
  private col = [...CYAN];
  private state: PresenceState = 'calm';
  private alert: HudAlert = 'none';
  private level = 0; private target = 0;
  private events: HudEvent[] = [];
  private bars = new Float32Array(120);
  private rot = [0, 0, 0, 0, 0, 0];
  private sweepA = 0;
  private dust = Array.from({ length: 36 }, () => ({ a: Math.random() * 6.283, d: 0.35 + Math.random() * 1.4, s: 0.02 + Math.random() * 0.05, z: Math.random() }));
  private w = 1; private h = 1; private dpr = 1;
  private frames: number[] = []; private lowQuality = false;
  private ro: ResizeObserver;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private host: HTMLElement, private opts: { labels?: boolean; tz?: () => string } = {}) {
    for (const c of [this.crisp, this.glow]) Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    Object.assign(this.glow.style, { filter: 'blur(10px)', mixBlendMode: 'screen', opacity: '0.9' });
    host.append(this.crisp, this.glow);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  setState(s: PresenceState) { this.state = s; }
  setLevel(v: number) { this.target = Math.max(0, Math.min(1, v)); }
  setEvents(e: HudEvent[]) { this.events = e; }
  setAlert(a: HudAlert) { this.alert = a; }
  dispose() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.crisp.remove(); this.glow.remove(); }

  private resize() {
    this.w = Math.max(1, this.host.clientWidth); this.h = Math.max(1, this.host.clientHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.lowQuality ? 1 : 2);
    this.crisp.width = this.w * this.dpr; this.crisp.height = this.h * this.dpr;
    // el resplandor se dibuja a un cuarto de resolución: barato y se ve suave
    this.glow.width = Math.ceil(this.w / 4); this.glow.height = Math.ceil(this.h / 4);
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) { this.last = now; return; }
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    this.quality(dt);
    const motion = this.reduced.matches ? 0.2 : 1;
    this.t += dt * motion;
    // transiciones suaves (nunca saltos)
    const k = 1 - Math.exp(-dt * 3);
    const tg = TARGET[this.state];
    (Object.keys(tg) as (keyof P)[]).forEach((key) => { this.cur[key] += (tg[key] - this.cur[key]) * k; });
    const goal = this.alert === 'confirm' ? AMBER : this.alert === 'error' ? RED : CYAN;
    for (let i = 0; i < 3; i++) this.col[i] += (goal[i] - this.col[i]) * (1 - Math.exp(-dt * 5));
    this.level += (this.target - this.level) * (1 - Math.exp(-dt * (this.target > this.level ? 16 : 6)));
    const speeds = [0.25, -0.12, 0.18, -0.3, 0.07, 0.02];
    this.rot = this.rot.map((r, i) => r + speeds[i] * this.cur.speed * dt * motion * (1 + this.level * 0.8));
    this.sweepA += dt * 2.4 * motion;
    // espectro: cada barra persigue un valor que depende del volumen real y de su "frecuencia"
    for (let i = 0; i < this.bars.length; i++) {
      const f = Math.abs(Math.sin(i * 0.37 + this.t * 3.1) * Math.sin(i * 0.11 - this.t * 1.7));
      const v = this.level * this.cur.spectrum * (0.25 + 0.75 * f) * (0.7 + 0.3 * Math.random());
      this.bars[i] += (v - this.bars[i]) * 0.35;
    }
    this.draw();
  };

  /** Si el equipo no mantiene ~50 fps, baja la resolución del dibujo. */
  private quality(dt: number) {
    if (this.lowQuality) return;
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.frames = [];
    if (avg > 0.022) { this.lowQuality = true; this.resize(); }
  }

  private rgba(a: number) { return `rgba(${this.col[0] | 0},${this.col[1] | 0},${this.col[2] | 0},${Math.max(0, Math.min(1, a))})`; }

  private draw() {
    const { g, w, h } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    const cx = w / 2, cy = h / 2;
    const labels = this.opts.labels && w > 420;
    const R = Math.min(w, h) * (labels ? 0.31 : 0.42) * this.cur.spread * (1 + this.level * 0.03);
    const B = this.cur.bright * (this.alert === 'error' ? 0.75 + 0.25 * Math.sin(this.t * 30) : 1);
    const breathe = 0.92 + 0.08 * Math.sin(this.t * 1.3);

    // centro
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45);
    core.addColorStop(0, this.rgba(0.85 * B * breathe)); core.addColorStop(0.22, this.rgba(0.3 * B)); core.addColorStop(1, this.rgba(0));
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, R * 0.45, 0, 6.2832); g.fill();

    // anillos segmentados
    const rings: [number, number, number, number][] = [[0.26, 2, 6, 0.9], [0.34, 1, 1, 0.5], [0.44, 3, 12, 0.7], [0.55, 0.8, 1, 0.35], [0.66, 1.4, 36, 0.5]];
    rings.forEach(([rr, lw, segs, a], i) => {
      const span = 6.2832 / segs, gap = segs > 1 ? span * (segs > 20 ? 0.45 : 0.12) : 0;
      g.lineWidth = lw; g.strokeStyle = this.rgba(a * B);
      for (let s = 0; s < segs; s++) { g.beginPath(); g.arc(cx, cy, R * rr, this.rot[i] + s * span + gap / 2, this.rot[i] + (s + 1) * span - gap / 2); g.stroke(); }
    });
    // marcas de minutos
    g.lineWidth = 1;
    for (let k = 0; k < 120; k++) {
      const a = (k / 120) * 6.2832 + this.rot[5]; const r1 = R * 0.75, r2 = r1 + (k % 10 === 0 ? 8 : 3.5);
      g.strokeStyle = this.rgba((k % 10 === 0 ? 0.55 : 0.2) * B);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    }

    // reloj del día (eventos reales)
    const tz = this.opts.tz?.() ?? 'America/Cancun';
    const hourOf = (iso: string) => { const d = new Date(iso); const p = d.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).split(':'); return +p[0] + +p[1] / 60; };
    const now = hourOf(new Date().toISOString());
    const ANG = (hr: number) => (hr / 24) * 6.2832 - Math.PI / 2;
    const RD = R * 0.92;
    g.lineWidth = 1; g.strokeStyle = this.rgba(0.16); g.beginPath(); g.arc(cx, cy, RD, 0, 6.2832); g.stroke();
    g.font = `10px 'IBM Plex Mono', monospace`; g.textAlign = 'center';
    for (const hr of [0, 6, 12, 18]) { const a = ANG(hr); g.fillStyle = this.rgba(0.35); g.fillText(String(hr).padStart(2, '0'), cx + Math.cos(a) * (RD - 15), cy + Math.sin(a) * (RD - 15) + 3); }
    g.lineCap = 'round';
    for (const ev of this.events) {
      if (ev.allDay) continue;
      const s = hourOf(ev.start), e = Math.max(s + 0.25, hourOf(ev.end) || s + 0.5);
      const past = e < now, current = s <= now && now < e;
      g.lineWidth = current ? 6 : 4.5; g.strokeStyle = this.rgba((past ? 0.28 : current ? 1 : 0.8) * B);
      g.beginPath(); g.arc(cx, cy, RD, ANG(s) + 0.012, ANG(e) - 0.012); g.stroke();
      if (labels) {
        const a = ANG(s); const x = cx + Math.cos(a) * (RD + 24), y = cy + Math.sin(a) * (RD + 24);
        g.textAlign = Math.cos(a) < -0.1 ? 'right' : Math.cos(a) > 0.1 ? 'left' : 'center';
        g.fillStyle = this.rgba(past ? 0.35 : 0.85);
        const hh = new Date(ev.start).toLocaleTimeString('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
        g.fillText(`${hh}  ${ev.title.split(/[—·(]/)[0].trim().slice(0, 18)}`, x, y + 4);
      }
    }
    g.lineCap = 'butt';
    const an = ANG(now);
    g.lineWidth = 1.3; g.strokeStyle = this.rgba(0.9);
    g.beginPath(); g.moveTo(cx + Math.cos(an) * R * 0.5, cy + Math.sin(an) * R * 0.5); g.lineTo(cx + Math.cos(an) * (RD + 9), cy + Math.sin(an) * (RD + 9)); g.stroke();
    g.fillStyle = this.rgba(1); g.beginPath(); g.arc(cx + Math.cos(an) * RD, cy + Math.sin(an) * RD, 3.5, 0, 6.2832); g.fill();

    // espectro de voz (escucha / habla)
    if (this.cur.spectrum > 0.02) {
      g.lineWidth = 2;
      for (let i = 0; i < this.bars.length; i++) {
        const v = this.bars[i]; if (v < 0.01) continue;
        const a = (i / this.bars.length) * 6.2832 - Math.PI / 2; const r1 = R * 1.05, r2 = r1 + 4 + v * R * 0.32;
        g.strokeStyle = this.rgba(0.35 + v * 0.65);
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
      }
    }
    // barrido de escaneo (piensa)
    if (this.cur.sweep > 0.02) {
      const sw = g.createConicGradient(this.sweepA, cx, cy);
      sw.addColorStop(0, this.rgba(0)); sw.addColorStop(0.1, this.rgba(0.3 * this.cur.sweep)); sw.addColorStop(0.102, this.rgba(0)); sw.addColorStop(1, this.rgba(0));
      g.fillStyle = sw; g.beginPath(); g.arc(cx, cy, R * 0.9, 0, 6.2832); g.fill();
    }
    // polvo de luz
    for (const p of this.dust) {
      p.a += p.s * 0.016 * this.cur.speed;
      const x = cx + Math.cos(p.a) * R * p.d, y = cy + Math.sin(p.a) * R * p.d * 0.7 - Math.sin(this.t * 0.2 + p.z * 6) * 6;
      g.fillStyle = this.rgba(0.15 + 0.25 * p.z); g.fillRect(x, y, 1.4, 1.4);
    }
    g.globalCompositeOperation = 'source-over';

    // resplandor: copia reducida del dibujo, desenfocada por CSS
    if (!this.lowQuality) {
      this.gg.clearRect(0, 0, this.glow.width, this.glow.height);
      this.gg.drawImage(this.crisp, 0, 0, this.glow.width, this.glow.height);
    }
  }
}
