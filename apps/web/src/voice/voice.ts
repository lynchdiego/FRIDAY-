import { useSyncExternalStore } from 'react';
import { presence, liveLevel } from '../mobius/presence';

/**
 * Voz de FRIDAY en el navegador.
 * - Escuchar: micrófono → analizador de audio → la Möbius sigue el volumen real.
 *   Transcripción con ElevenLabs (vía servidor) o, sin llave, con el reconocimiento del navegador.
 * - Hablar: audio de ElevenLabs que llega por partes (streaming) → analizador → la Möbius
 *   sigue la voz de FRIDAY. Sin llave: voz del navegador.
 * - Si algo falla, FRIDAY sigue por texto.
 */
type Engine = 'elevenlabs' | 'browser';
interface VoiceState { on: boolean; tts: Engine; stt: Engine; listening: boolean; speaking: boolean }
const KEY = 'friday.voz';
const readOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
let s: VoiceState = { on: readOn(), tts: 'browser', stt: 'browser', listening: false, speaking: false };
const subs = new Set<() => void>();
const set = (p: Partial<VoiceState>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const useVoice = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => s);

export class VoiceError extends Error {}

// ---------- Audio compartido ----------
let ctx: AudioContext | null = null;
let player: HTMLAudioElement | null = null;
let playerAnalyser: AnalyserNode | null = null;
let meterRaf = 0;

/** Medio segundo de silencio en WAV válido (para "desbloquear" el audio en iPhone). */
function silentWav() {
  const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let bin = ''; new Uint8Array(buf).forEach((b) => { bin += String.fromCharCode(b); });
  return `data:audio/wav;base64,${btoa(bin)}`;
}

function audioCtx() {
  ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Crea (una vez) el reproductor conectado al analizador, para medir la voz de FRIDAY. */
function ensurePlayer() {
  if (player) return player;
  const c = audioCtx();
  player = new Audio();
  player.preload = 'auto';
  (player as any).playsInline = true;
  const src = c.createMediaElementSource(player);
  playerAnalyser = c.createAnalyser();
  playerAnalyser.fftSize = 1024;
  src.connect(playerAnalyser).connect(c.destination);
  return player;
}

let unlocked = false;
/**
 * iPhone solo permite reproducir audio si se "desbloquea" durante un toque.
 * Se llama al presionar Hablar o Leer en voz alta; el truco del silencio se hace UNA sola vez
 * (repetirlo pausaría la voz de FRIDAY).
 */
export function unlockAudio() {
  try {
    audioCtx();
    const p = ensurePlayer();
    if (unlocked) return;
    unlocked = true;
    p.src = silentWav();
    p.play().then(() => { if (p.src.startsWith('data:')) p.pause(); }).catch(() => {});
  } catch { /* sin audio: se sigue por texto */ }
}

function startMeter(analyser: AnalyserNode, gain = 6) {
  cancelAnimationFrame(meterRaf);
  const buf = new Float32Array(analyser.fftSize);
  const loop = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    liveLevel.set(Math.min(1, Math.sqrt(sum / buf.length) * gain));
    meterRaf = requestAnimationFrame(loop);
  };
  loop();
}
function stopMeter() { cancelAnimationFrame(meterRaf); liveLevel.set(null); }

export const voice = {
  async loadConfig(server: boolean) {
    if (!server) return;
    try {
      const c = await fetch('/api/voice/config').then((r) => r.json());
      set({ tts: c.tts, stt: c.stt });
    } catch { /* se queda con el navegador */ }
  },
  toggle() {
    const on = !s.on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* opcional */ }
    if (!on) voice.stopSpeaking();
    set({ on });
  },
  get: () => s,
  stopSpeaking: () => stopSpeaking(),
};

// ---------- Escuchar ----------
let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let recog: any = null;
let finalText = '';
let startedAt = 0;

export async function startListening() {
  if (s.listening) return;
  voice.stopSpeaking();
  presence.set({ state: 'listen' });
  set({ listening: true });
  startedAt = performance.now();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new VoiceError('Este navegador no permite usar el micrófono. Escríbeme.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const c = audioCtx();
    const an = c.createAnalyser(); an.fftSize = 1024;
    c.createMediaStreamSource(stream).connect(an);
    startMeter(an, 7);

    if (s.stt === 'elevenlabs') {
      chunks = [];
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t));
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.start(250);
    } else {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) throw new VoiceError('Este navegador no reconoce voz. Prueba en Chrome o Safari, o escríbeme.');
      finalText = '';
      recog = new SR();
      recog.lang = 'es-MX';
      recog.continuous = true;
      recog.interimResults = true;
      recog.onresult = (e: any) => {
        let t = '';
        for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
        if (t) finalText = t;
        else finalText = finalText || Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join('');
      };
      recog.start();
    }
  } catch (err) {
    cleanupMic();
    set({ listening: false });
    presence.set({ state: 'calm' });
    const name = (err as any)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new VoiceError('No tengo permiso para usar el micrófono. Actívalo en los ajustes del navegador, o escríbeme.');
    throw err instanceof VoiceError ? err : new VoiceError('No pude usar el micrófono. Sigo por texto.');
  }
}

/** Devuelve lo que dijiste (vacío si fue un toque muy corto). */
export async function stopListening(): Promise<string> {
  if (!s.listening) return '';
  const held = performance.now() - startedAt;
  set({ listening: false });
  stopMeter();
  try {
    if (recorder) {
      const r = recorder;
      const done = new Promise<void>((res) => { r.onstop = () => res(); });
      r.stop();
      await done;
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      cleanupMic();
      if (held < 400 || blob.size < 1000) return '';
      const res = await fetch('/api/voice/stt', { method: 'POST', headers: { 'Content-Type': blob.type.split(';')[0], 'X-Duration': String(Math.round(held / 1000)) }, body: blob });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new VoiceError(data.error ?? 'No pude transcribir. Escríbemelo, por favor.');
      return data.text ?? '';
    }
    if (recog) {
      const r = recog;
      const done = new Promise<void>((res) => { r.onend = () => res(); setTimeout(res, 1500); });
      r.stop();
      await done;
      cleanupMic();
      return held < 400 ? '' : finalText.trim();
    }
    cleanupMic();
    return '';
  } catch (err) {
    cleanupMic();
    throw err instanceof VoiceError ? err : new VoiceError('No pude entender el audio. Escríbemelo, por favor.');
  }
}

function cleanupMic() {
  stopMeter();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null; recorder = null; recog = null;
}

// ---------- Hablar ----------
let speakToken = 0;

/** FRIDAY habla. Resuelve cuando termina (o de inmediato si la voz está apagada). */
export async function speak(text: string): Promise<void> {
  if (!s.on || !text.trim()) return;
  const my = ++speakToken;
  presence.set({ state: 'speak' });
  set({ speaking: true });
  const finish = () => {
    if (my !== speakToken) return;
    stopMeter();
    set({ speaking: false });
    if (presence.get().state === 'speak') presence.set({ state: 'calm' });
  };
  try {
    if (s.tts === 'elevenlabs') await speakEleven(text, () => my === speakToken);
    else await speakBrowser(text);
  } catch (err) {
    console.warn('[voz] falló la voz de FRIDAY:', err);
    // Si ElevenLabs falla, intenta con la voz del navegador; si tampoco, queda el texto en pantalla.
    if (s.tts === 'elevenlabs' && my === speakToken) await speakBrowser(text).catch((e) => console.warn('[voz] tampoco hay voz del navegador:', e));
  } finally { finish(); }
}

async function speakEleven(text: string, current: () => boolean) {
  const r = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!r.ok) throw new VoiceError('voz no disponible');
  const { url } = await r.json();
  if (!current()) return;
  const p = ensurePlayer();
  p.src = url; // el navegador reproduce mientras el audio sigue llegando
  if (playerAnalyser) startMeter(playerAnalyser, 5);
  await new Promise<void>((res, rej) => {
    p.onended = () => res();
    p.onerror = () => rej(new VoiceError('error de audio'));
    p.play().catch(rej);
  });
}

function speakBrowser(text: string) {
  return new Promise<void>((res, rej) => {
    const synth = window.speechSynthesis;
    if (!synth) return rej(new VoiceError('sin voz'));
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, 'el enlace en pantalla').replace(/[*_#`]/g, ''));
    u.lang = 'es-MX';
    const voices = synth.getVoices();
    u.voice = voices.find((v) => v.lang === 'es-MX') ?? voices.find((v) => v.lang.startsWith('es-US')) ?? voices.find((v) => v.lang.startsWith('es')) ?? null;
    u.rate = 1.02;
    // La voz del navegador no deja medir su volumen: la Möbius usa una envolvente simulada.
    liveLevel.set(null);
    presence.set({ auto: true });
    u.onend = () => res();
    u.onerror = () => rej(new VoiceError('error de voz'));
    synth.speak(u);
  });
}

export function stopSpeaking() {
  speakToken++;
  try { player?.pause(); } catch { /* nada */ }
  try { window.speechSynthesis?.cancel(); } catch { /* nada */ }
  stopMeter();
  if (s.speaking) set({ speaking: false });
}
