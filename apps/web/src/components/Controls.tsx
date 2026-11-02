import { useEffect, useState } from 'react';
import { Mic, Pen, Mute, ArrowUp, Speaker } from './icons';
import { presence } from '../mobius/presence';
import { chat, useChat } from '../state/chat';
import { useVoice, voice } from '../voice/voice';
import { pressTalk, releaseTalk } from '../voice/ptt';

/** Botón Hablar: mantener presionado para hablar (ratón, dedo o teclado). */
export function TalkButton({ className = '' }: { className?: string }) {
  const { listening } = useVoice();
  const down = (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); pressTalk(); };
  return (
    <button className={`btn btn-primary ${className}`} onPointerDown={down} onPointerUp={releaseTalk} onPointerCancel={releaseTalk}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); pressTalk(); } }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') releaseTalk(); }}
      aria-pressed={listening || presence.get().state === 'listen'}>
      <Mic /> {listening ? 'Te escucho' : 'Hablar'}
    </button>
  );
}

export function WriteButton({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  return <button className={`btn frosted ${className}`} onClick={onClick}><Pen /> Escribir</button>;
}

/** Silencio: apaga la voz de FRIDAY (solo texto). Se recuerda en este dispositivo. */
export function MuteButton() {
  const { on } = useVoice();
  return (
    <button className="btn btn-circle clear" aria-pressed={!on} aria-label={on ? 'Silenciar voz' : 'Activar voz'}
      title={on ? 'Silenciar: solo texto' : 'Voz desactivada: toca para activarla'} onClick={() => voice.toggle()}>
      {on ? <Speaker /> : <Mute />}
    </button>
  );
}

export function AskField({ id, className = '', material = 'clear', autoFocus }: { id?: string; className?: string; material?: 'clear' | 'frosted'; autoFocus?: boolean }) {
  const [v, setV] = useState('');
  const { busy } = useChat();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.trim() || busy) return;
    const text = v; setV('');
    if (location.hash !== '#conversacion') location.hash = 'conversacion';
    chat.send(text);
  };
  return (
    <form className={`field ${material} ${className}`} onSubmit={submit}>
      <input id={id} value={v} onChange={(e) => setV(e.target.value)} placeholder="Pregúntame lo que sea" aria-label="Pregúntame lo que sea" autoFocus={autoFocus} enterKeyHint="send" />
      <button className="send" aria-label="Enviar mensaje" disabled={busy}><ArrowUp /></button>
    </form>
  );
}

/** ⌥ + espacio: mantener para hablar mientras la app tiene el foco. */
export function useTalkShortcut() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'Space') { e.preventDefault(); if (!e.repeat) pressTalk(); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Alt') releaseTalk(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
}

export function useNow(ms = 15000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}
