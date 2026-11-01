import { MobiusView } from '../mobius/MobiusView';
import { mock, greeting, shortDay, clock } from '../data/mock';
import { usePresence, STATE_LABEL } from '../mobius/presence';
import { TalkButton, WriteButton, MuteButton, AskField, useNow } from '../components/Controls';
import { Speaker } from '../components/icons';

/** Pantalla 2: resumen del día (pantalla amplia). */
export function Today({ onOpenItem }: { onOpenItem: () => void }) {
  const now = useNow();
  const { state } = usePresence();
  const { wd, dd } = shortDay(now);
  return (
    <main className="today">
      <nav className="today-bar" aria-label="Secciones">
        <button className="btn btn-primary" aria-current="page">Hoy</button>
        <button className="btn clear">Agenda</button>
        <button className="btn clear" onClick={onOpenItem}>Correo</button>
        <button className="btn clear">Pendientes</button>
        <AskField id="ask-today" material="frosted" className="today-search" />
        <span className="btn btn-circle clear" title="⌥ + espacio para hablar">⌥</span>
      </nav>

      <section className="today-hero">
        <h1 className="display today-date"><span>{wd}</span> {dd}</h1>
        <div className="today-intro">
          <p className="today-greet">{greeting(now)}, {mock.name}. Tienes cuatro compromisos y un día manejable.</p>
          <p className="label">Prioridad única</p>
          <p className="today-priority">{mock.priority}</p>
          <p className="label">{clock(now)} · {STATE_LABEL[state]}</p>
        </div>
      </section>

      <div className="today-stage">
        <MobiusView className="today-mobius" distance={7.3} />
        <div className="today-dock frosted" role="toolbar" aria-label="Controles de voz">
        <TalkButton />
        <WriteButton onClick={() => document.getElementById('ask-today')?.focus()} />
        <button className="btn clear"><Speaker /> Leer en voz alta</button>
          <MuteButton />
        </div>
      </div>

      <footer className="today-foot">
        <dl className="stats">
          {mock.stats.map((s) => <div key={s.label}><dt className="label">{s.label}</dt><dd className="title">{s.value}</dd></div>)}
        </dl>
        <ol className="daylist">
          {mock.day.map((d) => (
            <li key={d.time}><span className="title">{d.time}</span><span>{d.title}</span><span className="label">{d.place}</span></li>
          ))}
        </ol>
      </footer>
    </main>
  );
}
