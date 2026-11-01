import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { vertexShader, fragmentShader, finishShader } from './shaders';

/** Los cuatro estados de la presencia. */
export type PresenceState = 'calm' | 'listen' | 'think' | 'speak';

type Params = {
  amp: number; speak: number; spd: number; think: number; gain: number; react: number;
  scale: number; lean: number; flash: number;
};

// Parámetros objetivo por estado.
// amp = deformación · speak = intensidad del flujo de luz · spd = velocidad (ciclos/s)
// think = destello · gain = brillo general · react = cuánto influye el audio real
// scale = tamaño · lean = cuánto se inclina hacia ti · flash = velocidad del destello
const TARGETS: Record<PresenceState, Params> = {
  calm:   { amp: 0.22, speak: 0.0,  spd: 1 / 11,  think: 0,   gain: 0.85, react: 0, scale: 1.0,  lean: 0,   flash: 1.2 },
  listen: { amp: 0.42, speak: 0.25, spd: 1 / 4.5, think: 0,   gain: 1.15, react: 1, scale: 1.08, lean: 1,   flash: 1.2 },
  think:  { amp: 0.16, speak: 0.05, spd: 1 / 7,   think: 1.5, gain: 0.7,  react: 0, scale: 0.93, lean: 0,   flash: 3.6 },
  speak:  { amp: 0.36, speak: 0.55, spd: 1 / 3.5, think: 0,   gain: 1.1,  react: 1, scale: 1.03, lean: 0.4, flash: 1.2 },
};

// Niveles de calidad: se baja de nivel solo si el equipo no mantiene ~50 fps.
const TIERS = [
  { pr: 2, nu: 900, nv: 36, bloomScale: 1 },
  { pr: 1.5, nu: 640, nv: 28, bloomScale: 0.75 },
  { pr: 1, nu: 420, nv: 20, bloomScale: 0.5 },
];

export class Mobius {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private finish: ShaderPass;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private grp = new THREE.Group();
  private mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private U = {
    T: { value: 0 }, LT: { value: 0 }, amp: { value: 0.26 }, speak: { value: 0 },
    think: { value: 0 }, head: { value: 0 }, gain: { value: 1 },
  };
  private cur: Params = { ...TARGETS.calm };
  private state: PresenceState = 'calm';
  private target = 0; // nivel de audio de entrada 0..1
  private level = 0; // nivel suavizado
  private phase = 0;
  private headPhase = 0;
  private time = 0;
  private last = performance.now();
  private raf = 0;
  private tier: number;
  private frames: number[] = [];
  private ro: ResizeObserver;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private host: HTMLElement, opts: { distance?: number } = {}) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.tier = coarse ? 1 : 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 1);
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });

    this.cam.position.set(0, 0, opts.distance ?? 7.3);
    this.mat = new THREE.ShaderMaterial({ uniforms: this.U, vertexShader, fragmentShader, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.buildGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.grp.add(this.mesh);
    this.scene.add(this.grp);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.2);
    this.composer.addPass(this.bloom);
    this.finish = new ShaderPass(finishShader);
    this.composer.addPass(this.finish);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setState(s: PresenceState) { this.state = s; }
  /** Volumen de audio 0..1 (micrófono o voz de FRIDAY). */
  setLevel(v: number) { this.target = Math.min(1, Math.max(0, v)); }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private buildGeometry() {
    const { nu, nv } = TIERS[this.tier];
    const uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) uv.push(i / nu, (j / nv) * 2 - 1);
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((uv.length / 2) * 3), 3));
    g.setAttribute('suv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    const t = TIERS[this.tier];
    const pr = Math.min(window.devicePixelRatio || 1, t.pr);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * t.bloomScale, h * t.bloomScale);
    this.cam.aspect = w / h;
    // En pantallas verticales alejamos la cámara para que la cinta quepa a lo ancho.
    this.cam.fov = w / h < 1 ? 2 * Math.atan(Math.tan((30 * Math.PI) / 360) / (w / h)) * (180 / Math.PI) : 30;
    this.cam.updateProjectionMatrix();
    this.finish.uniforms.aspect.value = w / h;
  }

  private adaptQuality(dt: number) {
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.frames = [];
    if (avg > 0.021 && this.tier < TIERS.length - 1) {
      this.tier++;
      this.mesh.geometry.dispose();
      this.mesh.geometry = this.buildGeometry();
      this.resize();
    }
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) { this.last = now; return; }
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.adaptQuality(dt);

    const reduced = this.reduced.matches;
    const tgt = TARGETS[this.state];
    // Transición suave entre estados (nunca saltos).
    const k = 1 - Math.exp(-dt * 2.2);
    for (const key of Object.keys(tgt) as (keyof Params)[]) this.cur[key] += (tgt[key] - this.cur[key]) * k;

    // Nivel de audio: sube rápido, baja despacio, como un medidor real.
    const lk = 1 - Math.exp(-dt * (this.target > this.level ? 14 : 5));
    this.level += (this.target - this.level) * lk;
    const e = this.level * this.cur.react * (reduced ? 0.3 : 1);

    const motion = reduced ? 0.35 : 1;
    this.phase += dt * Math.PI * 2 * this.cur.spd * (1 + e * 0.6) * motion;
    this.time += dt * motion;
    const T = this.phase;

    this.U.T.value = T;
    this.U.LT.value = this.time * ((Math.PI * 2) / 9);
    this.headPhase = (this.headPhase + dt * this.cur.flash * motion) % (Math.PI * 2);
    this.U.amp.value = this.cur.amp + e * 0.6;
    this.U.speak.value = this.cur.speak + e * 1.2;
    this.U.think.value = this.cur.think;
    this.U.head.value = this.headPhase;
    this.U.gain.value = this.cur.gain + e * 0.45;

    // Flota y se mece despacio (sin giros rápidos).
    const s = this.time * ((Math.PI * 2) / 12);
    this.grp.rotation.x = -0.8 + 0.07 * Math.sin(s) + this.cur.lean * 0.22;
    this.grp.scale.setScalar(this.cur.scale * (1 + e * 0.04));
    this.grp.rotation.y = 0.16 * Math.sin(s + 0.7);
    this.grp.rotation.z = 0.25 + 0.12 * Math.sin(s);
    this.grp.position.y = 0.05 * Math.sin(s * 1.3) * motion;
    this.mesh.rotation.z = 0.4 * Math.sin(s) + e * 0.12 * Math.sin(4 * T);

    this.finish.uniforms.time.value = this.time;
    this.composer.render(dt);
  }
}
