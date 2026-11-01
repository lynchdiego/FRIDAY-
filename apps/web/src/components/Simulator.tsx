import { presence, usePresence, STATE_LABEL } from '../mobius/presence';
import type { PresenceState } from '../mobius/Mobius';

/** Panel de prueba de la etapa 2: cambia de estado y simula el volumen del audio. */
export function Simulator({ view, setView, onConfirm }: { view: string; setView: (v: string) => void; onConfirm: () => void }) {
  const p = usePresence();
  const states: PresenceState[] = ['calm', 'listen', 'think', 'speak'];
  return (
    <details className="sim blur card" open={!window.matchMedia('(max-width: 599px)').matches}>
      <summary>Simulador</summary>
      <div className="sim-row">
        <span className="label">Pantalla</span>
        <div className="seg">
          {[['inicio', 'Inicio'], ['hoy', 'Resumen'], ['conversacion', 'Conversación']].map(([k, l]) =>
            <button key={k} className={`chip ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>{l}</button>)}
          <button className="chip" onClick={onConfirm}>Confirmación</button>
        </div>
      </div>
      <div className="sim-row">
        <span className="label">Estado</span>
        <div className="seg">
          {states.map((s) => <button key={s} className={`chip ${p.state === s ? 'on' : ''}`} onClick={() => presence.set({ state: s })}>{STATE_LABEL[s]}</button>)}
        </div>
      </div>
      <div className="sim-row">
        <span className="label">Volumen</span>
        <input type="range" min={0} max={1} step={0.01} value={p.level} disabled={p.auto}
          onChange={(e) => presence.set({ level: +e.target.value })} aria-label="Volumen simulado" />
        <label className="label sim-auto"><input type="checkbox" checked={p.auto} onChange={(e) => presence.set({ auto: e.target.checked })} /> Voz simulada</label>
      </div>
    </details>
  );
}
