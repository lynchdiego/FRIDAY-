import { startListening, stopListening, unlockAudio, VoiceError } from './voice';
import { chat } from '../state/chat';
import { presence, simulateReply } from '../mobius/presence';

/**
 * Mantener para hablar (botón Hablar o ⌥ + espacio).
 * Al soltar: transcribe y manda lo que dijiste a FRIDAY por el canal "voz".
 */
let active = false;
let simulated = false;

export async function pressTalk() {
  if (active) return;
  active = true;
  simulated = false;
  unlockAudio();
  try {
    await startListening();
  } catch (e) {
    if (chat.get().mode === 'demo') {
      // Vista previa sin micrófono: se simula la escucha para revisar el diseño.
      simulated = true;
      presence.set({ state: 'listen' });
      return;
    }
    active = false;
    chat.notify((e as Error).message);
    focusInput();
  }
}

export async function releaseTalk() {
  if (!active) return;
  active = false;
  if (simulated) { simulateReply(); return; }
  try {
    const text = await stopListening();
    if (!text) {
      presence.set({ state: 'calm' });
      chat.notify('No te escuché. Mantén presionado mientras hablas.');
      return;
    }
    if (location.hash !== '#conversacion') location.hash = 'conversacion';
    chat.send(text, 'voz');
  } catch (e) {
    presence.set({ state: 'calm' });
    chat.notify(e instanceof VoiceError ? e.message : 'La voz falló. Sigo por texto.');
    focusInput();
  }
}

function focusInput() {
  (document.querySelector('input[aria-label="Pregúntame lo que sea"]') as HTMLInputElement | null)?.focus();
}
