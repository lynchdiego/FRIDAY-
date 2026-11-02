import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/base.css';
import './styles/screens.css';
import { registerServiceWorker } from './state/notices';

createRoot(document.getElementById('root')!).render(<App />);
registerServiceWorker();

// Diagnóstico solo en desarrollo (no existe en la versión publicada).
if (import.meta.env.DEV) {
  import('./mobius/presence').then(({ presence, liveLevel }) => { (window as any).__friday = { presence, liveLevel }; });
}
