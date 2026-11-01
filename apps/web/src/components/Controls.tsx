import { useEffect, useState } from 'react';
import { Mic, Pen, Mute, ArrowUp } from './icons';
import { presence, simulateReply, startListening, usePresence } from '../mobius/presence';

/** Botón Hablar: mantener presionado para hablar (ratón, dedo o teclado). */
export function TalkButton({ className = '' }: { className?: string }) {
  const { state } = usePresence();
  const down = (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); startListening(); };
  const up = () => { if (presence.get().state === 'listen') simulateReply(); };
  return (
    <button className={`btn btn-primary ${className}`} onPointerDown={down} onPointerUp={up} onPointerCancel={up}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startListening(); }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') up(); }}
      aria-pressed={state === 'listen'}>
      <Mic /> {state === 'listen' ? 'Te escucho' : 'Hablar'}
    </button>
  );
}

export function WriteButton({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  return <button className={`btn frosted ${className}`} onClick={onClick}><Pen /> Escribir</button>;
}

export function MuteButton() {
  const [muted, setMuted] = useState(false);
  return (
    <button className="btn btn-circle clear" aria-pressed={muted} aria-label={muted ? 'Activar voz' : 'Silenciar voz'}
      title={muted ? 'Voz desactivada: solo texto' : 'Silenciar'} onClick={() => setMuted(!muted)}>
      <Mute />
    </button>
  );
}

export function AskField({ id, className = '', material = 'clear' }: { id?: string; className?: string; material?: 'clear' | 'frosted' }) {
  const [v, setV] = useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!v.trim()) return; setV(''); simulateReply(); };
  return (
    <form className={`field ${material} ${className}`} onSubmit={submit}>
      <input id={id} value={v} onChange={(e) => setV(e.target.value)} placeholder="Pregúntame lo que sea" aria-label="Pregúntame lo que sea" />
      <button className="send" aria-label="Enviar"><ArrowUp /></button>
    </form>
  );
}

/** ⌥ + espacio: mantener para hablar mientras la app tiene el foco. */
export function useTalkShortcut() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'Space') { e.preventDefault(); if (!e.repeat) startListening(); }
    };
    const up = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === 'Alt') && presence.get().state === 'listen') simulateReply();
    };
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
