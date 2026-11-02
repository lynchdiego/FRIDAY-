import { MobiusView } from '../mobius/MobiusView';
import { mock, greeting, shortDay, clock } from '../data/mock';
import { useToday } from '../state/today';
import { speak, unlockAudio } from '../voice/voice';
import { usePresence, STATE_LABEL } from '../mobius/presence';
import { TalkButton, WriteButton, MuteButton, AskField, useNow } from '../components/Controls';
import { Speaker, Sliders } from '../components/icons';

/** Pantalla 2: resumen del día (pantalla amplia). */
export function Today({ onAsk, onSkills }: { onAsk: (text: string) => void; onSkills: () => void }) {
  const now = useNow();
  const t = useToday();
  const { state } = usePresence();
  const { wd, dd } = shortDay(now);
  return (
    <main className="today">
      <nav className="today-bar" aria-label="Secciones">
        <button className="btn btn-primary" aria-current="page">Hoy</button>
        <button className="btn clear" onClick={() => onAsk('¿Qué tengo esta semana en la agenda?')}>Agenda</button>
        <button className="btn clear" onClick={() => onAsk('¿Qué correos importantes tengo?')}>Correo</button>
        <button className="btn clear" onClick={() => onAsk('¿Qué pendientes tengo?')}>Pendientes</button>
        <AskField id="ask-today" material="frosted" className="today-search" />
        <span className="btn btn-circle clear hide-touch" title="⌥ + espacio para hablar">⌥</span>
        <button className="btn btn-circle clear" aria-label="Habilidades y permisos" onClick={onSkills}><Sliders /></button>
      </nav>

      <section className="today-hero">
        <h1 className="display today-date"><span>{wd}</span> {dd}</h1>
        <div className="today-intro">
          <p className="today-greet">{greeting(now)}, {mock.name}. {t.summary}</p>
          <p className="label">Prioridad única</p>
          <p className="today-priority">{t.priority ?? 'Nada urgente. Buen día para crear.'}</p>
          <p className="label">{clock(now)} · {STATE_LABEL[state]}</p>
        </div>
      </section>

      <div className="today-stage">
        <MobiusView className="today-mobius" distance={7.3} />
        <div className="today-dock frosted" role="toolbar" aria-label="Controles de voz">
        <TalkButton />
        <WriteButton onClick={() => document.getElementById('ask-today')?.focus()} />
        <button className="btn clear" onClick={() => { unlockAudio(); speak(`${greeting(now)}, ${mock.name}. ${t.summary} ${t.priority ? `Tu prioridad: ${t.priority}` : ''}`); }}><Speaker /> Leer en voz alta</button>
          <MuteButton />
        </div>
      </div>

      <footer className="today-foot">
        <dl className="stats">
          {t.stats.map((s) => <div key={s.label}><dt className="label">{s.label}</dt><dd className="title">{s.value}</dd></div>)}
        </dl>
        <ol className="daylist">
          {t.day.map((d) => (
            <li key={d.time}><span className="title">{d.time}</span><span>{d.title}</span><span className="label">{d.place}</span></li>
          ))}
        </ol>
      </footer>
    </main>
  );
}
