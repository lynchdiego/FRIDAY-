import { useSyncExternalStore } from 'react';
/** Los cuatro estados de la presencia. (Ámbar y rojo se derivan de lo que pasa: confirmación pendiente o error.) */
export type PresenceState = 'calm' | 'listen' | 'think' | 'speak';

// Estado global de la presencia (calma / escucha / piensa / habla) y nivel de audio.
// En la etapa 2 el nivel viene del simulador; en la etapa 5 vendrá del micrófono
// y de la voz de FRIDAY a través de un analizador de audio.
type Snapshot = { state: PresenceState; level: number; auto: boolean };
let snap: Snapshot = { state: 'calm', level: 0.5, auto: true };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const presence = {
  get: () => snap,
  set(p: Partial<Snapshot>) { snap = { ...snap, ...p }; emit(); },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};

export const usePresence = () => useSyncExternalStore(presence.subscribe, presence.get);

/**
 * Nivel de audio REAL (micrófono o voz de FRIDAY), 0..1. Se actualiza ~60 veces por segundo,
 * así que no avisa a React: la Möbius lo lee directamente en cada cuadro.
 * null = no hay audio real; se usa el simulador.
 */
let live: number | null = null;
let errorUntil = 0;
/** Destello rojo breve cuando algo falla. */
export const alertFlash = { error: () => { errorUntil = performance.now() + 2500; }, isError: () => performance.now() < errorUntil };
export const liveLevel = { get: () => live, set: (v: number | null) => { live = v; } };

export const STATE_LABEL: Record<PresenceState, string> = {
  calm: 'En línea', listen: 'Escuchando', think: 'Procesando', speak: 'Hablando',
};

/** Envolvente sintética que imita una voz (para simular sin micrófono). */
export function syntheticVoice(t: number) {
  const syll = Math.max(0, Math.sin(t * 9.1) * 0.5 + Math.sin(t * 13.7 + 1) * 0.3 + Math.sin(t * 3.3 + 2) * 0.35);
  const phrase = 0.55 + 0.45 * Math.sin(t * 0.9);
  return Math.min(1, syll * phrase * 1.4);
}

/** Simula un turno completo: escucha → piensa → habla → calma. */
let timers: number[] = [];
export function simulateReply() {
  timers.forEach(clearTimeout);
  presence.set({ state: 'think' });
  timers = [
    window.setTimeout(() => presence.set({ state: 'speak' }), 1800),
    window.setTimeout(() => presence.set({ state: 'calm' }), 5200),
  ];
}
export function startListening() { timers.forEach(clearTimeout); presence.set({ state: 'listen' }); }
