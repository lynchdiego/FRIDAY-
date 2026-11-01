import { useEffect, useRef } from 'react';
import { MobiusView } from '../mobius/MobiusView';
import { usePresence, STATE_LABEL } from '../mobius/presence';
import { useChat } from '../state/chat';
import { Cards } from '../components/Cards';
import { TalkButton, MuteButton, AskField } from '../components/Controls';

/** Pantalla 3: conversación. Historial minimalista; FRIDAY sin burbujas pesadas. */
export function Chat({ onBack }: { onBack: () => void }) {
  const { messages, busy, mode } = useChat();
  const { state } = usePresence();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, busy]);

  return (
    <main className="chat">
      <header className="chat-head">
        <button className="btn clear" onClick={onBack}>Inicio</button>
        <MobiusView className="chat-mobius" distance={6.4} />
        <span className="label chat-state">{STATE_LABEL[state]}{mode === 'demo' ? ' · demostración' : ''}</span>
      </header>
      <section className="chat-log" aria-live="polite">
        {!messages.length && <p className="chat-empty title">¿En qué te ayudo?</p>}
        {messages.map((m, i) => m.role === 'user'
          ? <p key={i} className="msg-user">{m.text}</p>
          : <div key={i} className="msg-friday"><p>{m.text}</p><Cards cards={m.cards} /></div>)}
        {busy && <p className="msg-friday label">Pensando…</p>}
        <div ref={end} />
      </section>
      <div className="chat-dock">
        <div className="row"><TalkButton className="grow" /><MuteButton /></div>
        <AskField id="ask-chat" autoFocus />
      </div>
    </main>
  );
}
