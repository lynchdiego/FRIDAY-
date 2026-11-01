import { useEffect, useState } from 'react';
import { Compact } from './screens/Compact';
import { Today } from './screens/Today';
import { ConfirmSheet } from './components/ConfirmSheet';
import { Simulator } from './components/Simulator';
import { useTalkShortcut } from './components/Controls';
import { presence } from './mobius/presence';

const initial = () => (location.hash.slice(1) || (innerWidth > 900 ? 'hoy' : 'inicio'));

export function App() {
  const [view, setViewState] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');
  useTalkShortcut();
  const setView = (v: string) => { location.hash = v; setViewState(v); };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);
  const open = () => setConfirm(true);

  return (
    <>
      {view === 'hoy' ? <Today onOpenItem={open} /> : <div className="compact-stage"><Compact onOpenItem={open} /></div>}
      {confirm && <ConfirmSheet onClose={() => setConfirm(false)} onDone={(m) => { setConfirm(false); setToast(m); presence.set({ state: 'calm' }); }} />}
      {toast && <div className="toast blur" role="status">{toast}</div>}
      <Simulator view={view} setView={setView} onConfirm={open} />
    </>
  );
}
