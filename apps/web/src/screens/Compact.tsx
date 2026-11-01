import { MobiusView } from '../mobius/MobiusView';
import { usePresence, STATE_LABEL } from '../mobius/presence';
import { mock, greeting, longDate, clock } from '../data/mock';
import { TalkButton, WriteButton, MuteButton, AskField, useNow } from '../components/Controls';

/**
 * Pantalla 1: inicio.
 * Mac: panel compacto ~420×660 (futura barra de menú).
 * iPhone: pantalla que fluye; los controles quedan fijos abajo, al alcance del pulgar.
 */
export function Compact({ onOpenItem }: { onOpenItem: () => void }) {
  const now = useNow();
  const { state } = usePresence();
  return (
    <main className="compact">
      <header className="compact-head">
        <span className="brand">FRIDAY</span>
        <span className="tag clear hide-touch">⌥ espacio</span>
      </header>
      <MobiusView className="compact-mobius" distance={6.6} />
      <section className="compact-body">
        <div>
          <h1 className="title compact-greet">{greeting(now)}, {mock.name}.</h1>
          <p className="label">{longDate(now)} · {clock(now)} · {STATE_LABEL[state]}</p>
        </div>
        <div className="compact-priority only-phone">
          <p className="label">Prioridad única</p>
          <p className="today-priority">{mock.priority}</p>
        </div>
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
        <section className="only-phone" aria-label="Tu día">
          <p className="label">Tu día</p>
          <ol className="daylist">
            {mock.day.map((d) => (
              <li key={d.time}><span className="title">{d.time}</span><span>{d.title}</span><span className="label">{d.place}</span></li>
            ))}
          </ol>
        </section>
      </section>
      <div className="compact-dock">
        <div className="row">
          <TalkButton className="grow" />
          <WriteButton className="grow" onClick={() => document.getElementById('ask-compact')?.focus()} />
          <MuteButton />
        </div>
        <AskField id="ask-compact" />
      </div>
    </main>
  );
}
