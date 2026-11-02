import { useEffect, useState } from 'react';
import { Compact } from './screens/Compact';
import { Today } from './screens/Today';
import { Chat } from './screens/Chat';
import { Login } from './screens/Login';
import { Skills } from './screens/Skills';
import { ConfirmSheet } from './components/ConfirmSheet';
import { Simulator } from './components/Simulator';
import { useTalkShortcut } from './components/Controls';
import { chat, useChat, type ActionCard } from './state/chat';
import { mock } from './data/mock';
import { useInAppNotices } from './state/notices';

const VIEWS = ['inicio', 'hoy', 'conversacion', 'habilidades'];
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
  useInAppNotices();
  useEffect(() => {
    chat.init();
    // Regreso de la conexión con Google: ?google=ok|cancelado|vencido|error
    const g = new URLSearchParams(location.search).get('google');
    if (g) {
      const msg: Record<string, string> = { ok: 'Google conectado.', cancelado: 'Conexión con Google cancelada.', vencido: 'La conexión tardó demasiado. Intenta de nuevo.', error: 'No se pudo conectar Google. Revisa que marcaste todos los permisos.' };
      chat.notify(msg[g] ?? 'Listo.');
      history.replaceState(null, '', location.pathname + location.hash);
    }
  }, []);
  useEffect(() => {
    const on = () => setViewState(initial());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => chat.clearToast(), 3500); return () => clearTimeout(t); }, [toast]);
  const setView = (v: string) => { location.hash = v; setViewState(v); };
  const ask = (text: string) => { setView('conversacion'); chat.send(text); };
  const home = () => setView(innerWidth > 900 ? 'hoy' : 'inicio');
  const skills = () => setView('habilidades');

  if (mode === 'checking') return null;
  if (mode === 'server' && !authed) return <Login />;

  return (
    <>
      {view === 'conversacion' ? <Chat onBack={home} />
        : view === 'habilidades' ? <Skills onBack={home} />
        : view === 'hoy' ? <Today onAsk={ask} onSkills={skills} />
        : <div className="compact-stage"><Compact onAsk={ask} onSkills={skills} /></div>}
      {action && <ConfirmSheet key={action.id + action.token} action={action} />}
      {toast && <div className="toast blur" role="status">{toast}</div>}
      <Simulator view={view} setView={setView} onConfirm={() => chat.openAction(demoAction)} />
    </>
  );
}
