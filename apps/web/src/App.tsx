import { useEffect, useState } from 'react';
import { Compact } from './screens/Compact';
import { Today } from './screens/Today';
import { Chat } from './screens/Chat';
import { Login } from './screens/Login';
import { ConfirmSheet } from './components/ConfirmSheet';
import { Simulator } from './components/Simulator';
import { useTalkShortcut } from './components/Controls';
import { chat, useChat, type ActionCard } from './state/chat';
import { mock } from './data/mock';

const VIEWS = ['inicio', 'hoy', 'conversacion'];
const initial = () => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : innerWidth > 900 ? 'hoy' : 'inicio'; };

// Tarjeta de ejemplo para revisar el diseño de la confirmación desde el simulador.
const demoAction: ActionCard = {
  type: 'action', id: 'demo', token: 'demo', tool: 'gmail_send', title: '¿Envío este correo?', verbalOk: true,
  expiresAt: new Date(Date.now() + 3e5).toISOString(),
  fields: [{ label: 'Para', value: mock.draft.to }, { label: 'Asunto', value: mock.draft.subject }], preview: mock.draft.body,
};

export function App() {
  const [view, setViewState] = useState(initial);
  const { mode, authed, action, toast } = useChat();
  useTalkShortcut();
  useEffect(() => { chat.init(); }, []);
  useEffect(() => {
    const on = () => setViewState(initial());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => chat.clearToast(), 3500); return () => clearTimeout(t); }, [toast]);
  const setView = (v: string) => { location.hash = v; setViewState(v); };
  const ask = (text: string) => { setView('conversacion'); chat.send(text); };

  if (mode === 'checking') return null;
  if (mode === 'server' && !authed) return <Login />;

  return (
    <>
      {view === 'conversacion' ? <Chat onBack={() => setView(innerWidth > 900 ? 'hoy' : 'inicio')} />
        : view === 'hoy' ? <Today onOpenItem={() => ask('¿Qué correos importantes tengo?')} />
        : <div className="compact-stage"><Compact onOpenItem={() => ask('¿Qué correos importantes tengo?')} /></div>}
      {action && <ConfirmSheet key={action.id + action.token} action={action} />}
      {toast && <div className="toast blur" role="status">{toast}</div>}
      <Simulator view={view} setView={setView} onConfirm={() => chat.openAction(demoAction)} />
    </>
  );
}
