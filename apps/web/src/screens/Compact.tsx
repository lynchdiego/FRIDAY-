import { MobiusView } from '../mobius/MobiusView';
import { usePresence, STATE_LABEL } from '../mobius/presence';
import { mock, greeting, longDate, clock } from '../data/mock';
import { TalkButton, WriteButton, MuteButton, AskField, useNow } from '../components/Controls';

/** Pantalla 1: inicio / panel compacto (~420×660, futura barra de menú). */
export function Compact({ onOpenItem }: { onOpenItem: () => void }) {
  const now = useNow();
  const { state } = usePresence();
  return (
    <main className="compact">
      <header className="compact-head">
        <span className="brand">FRIDAY</span>
        <span className="tag clear">⌥ espacio</span>
      </header>
      <MobiusView className="compact-mobius" distance={6.6} />
      <section className="compact-body">
        <h1 className="title compact-greet">{greeting(now)}, {mock.name}.</h1>
        <p className="label">{longDate(now)} · {clock(now)} · {STATE_LABEL[state]}</p>
        <ul className="next frosted card">
          {mock.next.map((n) => (
            <li key={n.kind}>
              <button onClick={n.kind === 'Correo' ? onOpenItem : undefined}>
                <span className="label">{n.kind}</span>
                <span className="next-text">{n.text}</span>
                <span className="label next-meta">{n.meta}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <TalkButton className="grow" />
          <WriteButton className="grow" onClick={() => document.getElementById('ask-compact')?.focus()} />
          <MuteButton />
        </div>
        <AskField id="ask-compact" />
      </section>
    </main>
  );
}
