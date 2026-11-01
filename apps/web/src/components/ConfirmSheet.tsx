import { useEffect, useRef, useState } from 'react';
import type { ActionCard } from '../state/chat';
import { chat } from '../state/chat';

/**
 * Pantalla 4: confirmación. Enviar manda al servidor el token de un solo uso;
 * solo el servidor ejecuta. Editar permite corregir el contenido antes de confirmar.
 */
const VERB: Record<string, string> = { gmail_send: 'Enviar', event_create: 'Crear', event_update: 'Guardar cambio' };
const SAY: Record<string, string> = { gmail_send: '«sí, envíalo»', event_create: '«sí, agéndalo»', event_update: '«sí»' };

export function ConfirmSheet({ action }: { action: ActionCard }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(action.preview ?? '');
  const [sending, setSending] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const close = () => chat.closeAction();
  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  const confirm = async () => {
    setSending(true);
    const field = action.tool === 'gmail_send' ? 'body' : 'description';
    await chat.confirm(action, body !== (action.preview ?? '') ? { [field]: body } : undefined);
  };

  return (
    <div className="confirm-backdrop" onClick={close}>
      <section className="confirm blur panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <span className="tag clear">Necesita tu sí</span>
        <h2 id="confirm-title" className="title confirm-title">{action.title}</h2>
        <dl className="confirm-fields">
          {action.fields.map((f) => <div key={f.label}><dt className="label">{f.label}</dt><dd>{f.value}</dd></div>)}
        </dl>
        {editing
          ? <textarea className="confirm-body editing" value={body} onChange={(e) => setBody(e.target.value)} rows={8} autoFocus />
          : body && <p className="confirm-body">{body}</p>}
        <div className="confirm-actions">
          <button ref={first} className="btn btn-primary" onClick={confirm} disabled={sending}>{sending ? 'Un momento…' : VERB[action.tool] ?? 'Confirmar'}</button>
          {action.preview !== undefined && <button className="btn frosted" onClick={() => setEditing(!editing)}>{editing ? 'Listo' : 'Editar'}</button>}
          <button className="btn clear" onClick={() => chat.cancel(action)}>Cancelar</button>
        </div>
        <p className="label confirm-note">{action.verbalOk ? `O di ${SAY[action.tool] ?? '«sí»'}. ` : 'Por seguridad, esta se confirma solo aquí. '}Nada sale sin tu confirmación.</p>
      </section>
    </div>
  );
}
