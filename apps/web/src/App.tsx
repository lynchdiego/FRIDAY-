import { useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { Workshop } from './hud/Workshop';
import { Chat } from './screens/Chat';
import { Login } from './screens/Login';
import { Skills } from './screens/Skills';
import { Settings } from './screens/Settings';
import { ConfirmSheet } from './components/ConfirmSheet';
import { Simulator } from './components/Simulator';
import { useTalkShortcut } from './components/Controls';
import { chat, useChat, type ActionCard } from './state/chat';
import { mock } from './data/mock';
import { useInAppNotices } from './state/notices';

const VIEWS = ['inicio', 'hoy', 'conversacion', 'habilidades', 'ajustes'];
const initial = () => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'inicio'; };

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
      history.replaceState(null, '', location.pathname + (location.hash === '#habilidades' ? '#ajustes' : location.hash));
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
  const home = () => setView('inicio');
  const skills = () => setView('habilidades');
  const settings = () => setView('ajustes');

  if (mode === 'checking') return <Workshop />;
  if (mode === 'server' && !authed) return <><Workshop /><Login /></>;

  return (
    <>
      <Workshop />
      {view === 'conversacion' ? <Chat onBack={home} />
        : view === 'habilidades' ? <Skills onBack={settings} />
        : view === 'ajustes' ? <Settings onBack={home} onSkills={skills} />
        : <Home onAsk={ask} onSettings={settings} />}
      {action && <ConfirmSheet key={action.id + action.token} action={action} />}
      {toast && <div className="toast blur" role="status">{toast}</div>}
      {/* Modo de prueba: solo en desarrollo y en la vista previa (demostración), nunca con el servidor real */}
      {(import.meta.env.DEV || mode === 'demo') && <Simulator view={view} setView={setView} onConfirm={() => chat.openAction(demoAction)} />}
    </>
  );
}
