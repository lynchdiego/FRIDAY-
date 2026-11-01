import { useEffect, useRef, useState } from 'react';
import { mock } from '../data/mock';

/**
 * Pantalla 4: confirmación. En la etapa 3 el botón Enviar mandará al servidor
 * el token de un solo uso; aquí todo es simulado y nada sale.
 */
export function ConfirmSheet({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(mock.draft.body);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <section className="confirm blur panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <span className="tag clear">Necesita tu sí</span>
        <h2 id="confirm-title" className="title confirm-title">¿Envío este correo?</h2>
        <dl className="confirm-fields">
          <div><dt className="label">Para</dt><dd>{mock.draft.to}</dd></div>
          <div><dt className="label">Asunto</dt><dd>{mock.draft.subject}</dd></div>
        </dl>
        {editing
          ? <textarea className="confirm-body editing" value={body} onChange={(e) => setBody(e.target.value)} rows={8} autoFocus />
          : <p className="confirm-body">{body}</p>}
        <div className="confirm-actions">
          <button ref={first} className="btn btn-primary" onClick={() => onDone('Simulación: el correo no se envió (datos ficticios).')}>Enviar</button>
          <button className="btn frosted" onClick={() => setEditing(!editing)}>{editing ? 'Listo' : 'Editar'}</button>
          <button className="btn clear" onClick={onClose}>Cancelar</button>
        </div>
        <p className="label confirm-note">O di «sí, envíalo». Nada sale sin tu confirmación.</p>
      </section>
    </div>
  );
}
