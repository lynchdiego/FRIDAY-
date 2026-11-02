import { HudCoreView } from '../hud/HudCoreView';
import { mock, greeting, longDate, clock } from '../data/mock';
import { useToday } from '../state/today';
import { getTz } from '../state/tz';
import { speak, unlockAudio } from '../voice/voice';
import { usePresence, STATE_LABEL } from '../mobius/presence';
import { useChat } from '../state/chat';
import { TalkButton, MuteButton, AskField, useNow } from '../components/Controls';
import { Sliders } from '../components/icons';

/**
 * Inicio (estilo A · HUD). Mac: saludo a la izquierda, núcleo con el reloj de tu día al centro,
 * panel "A continuación" inclinado a la derecha. iPhone: todo apilado, controles abajo.
 */
export function Home({ onAsk, onSettings }: { onAsk: (text: string) => void; onSettings: () => void }) {
  const now = useNow();
  const t = useToday();
  const { state } = usePresence();
  const { action } = useChat();
  const status = action ? 'Necesita tu sí' : STATE_LABEL[state];
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone: getTz(), hour: '2-digit', minute: '2-digit', hour12: false });
  const upcoming = t.events.map((e, i) => ({ ...e, place: t.day[i]?.place ?? '' })).filter((e) => !e.allDay && Date.parse(e.end) > Date.now());
  const sub = [
    upcoming.length === 0 ? 'Agenda libre' : `${upcoming.length} ${upcoming.length === 1 ? 'compromiso' : 'compromisos'} más`,
    t.emailCount ? `${t.emailCount} ${t.emailCount === 1 ? 'correo' : 'correos'} sin leer` : 'Bandeja al día',
  ].join(' · ');
  const readAloud = () => { unlockAudio(); speak(`${greeting(now)}, ${mock.name}. ${t.summary} ${t.priority ? `Tu prioridad: ${t.priority}` : ''}`); };
  const mail = t.next.find((n) => n.kind === 'Correo');
  const task = t.next.find((n) => n.kind === 'Pendiente' || n.kind === 'Recordatorio');

  return (
    <main className="home">
      <header className="hud-top">
        <span className="brand">FRIDAY</span>
        <span className="hud-status"><span className="hide-phone">{longDate(now)} · </span>{clock(now)} · <span className={action ? 'warn' : ''}>{status}</span></span>
        <button className="btn btn-circle clear" aria-label="Ajustes" onClick={onSettings}><Sliders /></button>
      </header>

      <section className="home-greet">
        <h1 className="hud-display">{greeting(now)},<br />{mock.name}.</h1>
        <p className="hud-sub">{sub}</p>
        <div className="home-prio"><span className="hud-label accent">Prioridad</span><p>{t.priority ?? 'Nada urgente. Buen día para crear.'}</p></div>
      </section>

      <HudCoreView className="home-core" events={t.events} labels />

      <aside className="home-panel hud-panel" aria-label="A continuación">
        <h3 className="hud-label"><span>A continuación</span><span>Hoy</span></h3>
        {upcoming.slice(0, 3).map((e) => (
          <button key={e.start + e.title} className="hud-row" onClick={() => onAsk('¿Qué sigue en mi agenda?')}>
            <span className="hud-time">{hhmm(e.start)}</span><span>{e.title}<small>{e.place}</small></span>
          </button>
        ))}
        {upcoming.length === 0 && <p className="hud-row muted">Nada más en la agenda hoy.</p>}
        {mail && <button className="hud-row" onClick={() => onAsk('¿Qué correos importantes tengo?')}><span className="hud-time">Correo</span><span>{mail.text}<small>{mail.meta}</small></span></button>}
        {task && <button className="hud-row" onClick={() => onAsk('¿Qué pendientes tengo?')}><span className="hud-time">{task.kind === 'Pendiente' ? 'Tarea' : 'Aviso'}</span><span>{task.text}<small>{task.meta}</small></span></button>}
      </aside>

      <div className="home-dock">
        <div className="hud-bar">
          <TalkButton />
          <AskField id="ask-home" className="grow" />
          <button className="btn clear hide-phone" aria-label="Leer mi día en voz alta" onClick={readAloud}>Leer día</button>
          <MuteButton />
        </div>
        <p className="hud-hint hide-touch">Mantén ⌥ + espacio para hablar</p>
      </div>
    </main>
  );
}
