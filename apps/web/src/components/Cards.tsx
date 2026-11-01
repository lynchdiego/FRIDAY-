import type { Card } from '@friday/shared';
import { chat, currentTz, type ActionCard } from '../state/chat';

const time = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone: currentTz(), hour: '2-digit', minute: '2-digit', hour12: false });
const when = (iso: string) => new Date(iso).toLocaleString('es-MX', { timeZone: currentTz(), weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/** Tarjetas esmeriladas para resultados: eventos, correos, borradores, acciones… */
export function Cards({ cards }: { cards: Card[] }) {
  if (!cards.length) return null;
  return <div className="cards">{cards.map((c, i) => <CardView key={i} c={c} />)}</div>;
}

function CardView({ c }: { c: Card }) {
  switch (c.type) {
    case 'events':
      return (
        <section className="rcard frosted card">
          <p className="label">Agenda</p>
          {c.items.length ? <ol className="daylist">{c.items.map((e) => (
            <li key={e.id}><span className="title">{time(e.start)}</span><span>{e.title}</span><span className="label">{e.location ?? ''}</span></li>
          ))}</ol> : <p className="muted">Sin eventos.</p>}
        </section>
      );
    case 'emails':
      return (
        <section className="rcard frosted card">
          <p className="label">Correo</p>
          <ul className="maillist">{c.items.map((m) => (
            <li key={m.id}><span className={m.unread ? 'dot on' : 'dot'} aria-label={m.unread ? 'Sin leer' : undefined} />
              <span className="mail-from">{m.from.replace(/<.*>/, '').trim()}</span><span className="mail-subj">{m.subject}</span></li>
          ))}</ul>
        </section>
      );
    case 'email':
      return (
        <section className="rcard frosted card">
          <p className="label">{c.from}</p>
          <p className="rcard-title">{c.subject}</p>
          {c.warning && <p className="warn">{c.warning}</p>}
          <p className="rcard-body">{c.body.replace(/<!--[\s\S]*?-->/g, '[contenido oculto]')}</p>
        </section>
      );
    case 'draft':
      return (
        <section className="rcard frosted card">
          <p className="label">Borrador guardado en Gmail · no enviado</p>
          <p className="rcard-title">{c.subject}</p>
          <p className="label">Para {c.to}</p>
          <p className="rcard-body">{c.body}</p>
        </section>
      );
    case 'action':
      return (
        <section className="rcard frosted card">
          <p className="label">Necesita tu sí</p>
          <p className="rcard-title">{c.title}</p>
          {c.fields.slice(0, 2).map((f) => <p key={f.label} className="label">{f.label}: {f.value}</p>)}
          {c.token ? <button className="btn btn-primary rcard-btn" onClick={() => chat.openAction(c as ActionCard)}>Revisar y confirmar</button>
            : <p className="label">Esta confirmación ya no está activa.</p>}
        </section>
      );
    case 'task':
      return <section className="rcard frosted card"><p className="label">Pendiente anotado</p><p className="rcard-title">{c.title}</p>{c.due && <p className="label">Para {when(c.due)}</p>}</section>;
    case 'tasks':
      return (
        <section className="rcard frosted card">
          <p className="label">Pendientes</p>
          {c.items.length ? <ul className="plainlist">{c.items.map((t) => <li key={t.id}>{t.title}{t.due && <span className="label"> · {when(t.due)}</span>}</li>)}</ul> : <p className="muted">Nada pendiente.</p>}
        </section>
      );
    case 'reminder':
      return <section className="rcard frosted card"><p className="label">Recordatorio · {when(c.at)}</p><p className="rcard-title">{c.text}</p></section>;
    case 'message':
      return (
        <section className="rcard frosted card">
          <p className="label">Mensaje para {c.to} · listo para enviar</p>
          <p className="rcard-body">{c.text}</p>
          <a className="btn btn-primary rcard-btn" href={c.url} target="_blank" rel="noreferrer">Abrir en WhatsApp</a>
        </section>
      );
    case 'notice':
      return <p className={c.tone === 'error' ? 'notice error' : 'notice'}>{c.text}</p>;
  }
}
