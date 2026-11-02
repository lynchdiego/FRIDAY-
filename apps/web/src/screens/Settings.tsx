import { useEffect, useState } from 'react';
import { chat, useChat } from '../state/chat';
import { useVoice, voice } from '../voice/voice';
import { usePushStatus, enablePush, disablePush, testPush, PUSH_LABEL } from '../state/notices';

/**
 * Pantalla 6: Ajustes. Conexiones (Google, voz, avisos), modelo, voz encendida/apagada,
 * costos del día y del mes, actividad reciente, exportar o borrar memoria.
 */
interface GoogleStatus { configured: boolean; connected: boolean; email: string | null; mode: string }
interface SettingsData {
  model: string; modelHeavy: string; llm: string; integraciones: string; voz: string; limiteDiarioUsd: number;
  costo: { today: number; month: number; tokensToday: number };
  desglose: { servicio: string; usd: number }[];
}
interface AuditRow { at: string; event: string; tool: string | null }

const usd = (n: number) => `US$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
const EVENT: Record<string, string> = { propuesta: 'Propuso', confirmada: 'Confirmaste', ejecutada: 'Hecho', cancelada: 'Cancelaste', fallida: 'Falló', rechazada: 'Bloqueado', limite: 'Límite de gasto', error: 'Error', herramienta: 'Consultó' };
const TOOL: Record<string, string> = { gmail_send: 'enviar correo', event_create: 'crear evento', event_update: 'cambiar evento', calendar_list: 'agenda', gmail_search: 'correo', gmail_read: 'leer correo', gmail_draft: 'borrador', tasks_list: 'pendientes', task_add: 'anotar pendiente', reminder_add: 'recordatorio', google_connect: 'conectar Google', google_disconnect: 'desconectar Google', resumen_programado: 'resumen del día', voz_tts: 'voz', voz_stt: 'transcripción', memory_save: 'memoria', memory_search: 'memoria', message_prepare: 'mensaje WhatsApp' };

export function Settings({ onBack, onSkills }: { onBack: () => void; onSkills: () => void }) {
  const { mode } = useChat();
  const { on: voiceOn } = useVoice();
  const [push, setPush] = usePushStatus();
  const [data, setData] = useState<SettingsData | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [activity, setActivity] = useState<AuditRow[]>([]);
  const [confirmDelete, setConfirmDelete] = useState('');
  const server = mode === 'server';

  const load = () => {
    if (!server) return;
    fetch('/api/settings').then((r) => r.json()).then(setData).catch(() => {});
    fetch('/api/google/status').then((r) => r.json()).then(setGoogle).catch(() => {});
    fetch('/api/audit').then((r) => r.json()).then((rows: AuditRow[]) => setActivity(rows.filter((a) => a.event !== 'herramienta').slice(0, 8))).catch(() => {});
  };
  useEffect(load, [mode]);

  const post = (url: string, body: unknown = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const activatePush = async () => {
    try { const st = await enablePush(); setPush(st); if (st === 'activo') { await testPush(); chat.notify('Avisos activados. Te mandé uno de prueba.'); } }
    catch { chat.notify('No pude activar los avisos en este dispositivo.'); }
  };
  const exportMemory = async () => {
    const json = await fetch('/api/memory/export').then((r) => r.text());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `friday-memoria-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const deleteMemory = async () => {
    const r = await post('/api/memory/delete', { confirm: confirmDelete });
    setConfirmDelete('');
    chat.notify(r.ok ? 'Memoria borrada.' : 'No se borró nada.');
  };
  const logout = async () => { await post('/api/logout'); location.reload(); };

  const used = data ? Math.min(1, data.costo.today / data.limiteDiarioUsd) : 0;

  return (
    <main className="skills settings">
      <header className="skills-head"><button className="btn clear" onClick={onBack}>Inicio</button></header>
      <h1 className="title skills-title">Ajustes</h1>

      <section aria-label="Costos">
        <dl className="stats cost-stats">
          <div><dt className="label">Hoy</dt><dd className="title">{data ? usd(data.costo.today) : server ? '…' : '—'}</dd></div>
          <div><dt className="label">Este mes</dt><dd className="title">{data ? usd(data.costo.month) : server ? '…' : '—'}</dd></div>
          <div><dt className="label">Límite diario</dt><dd className="title">{data ? usd(data.limiteDiarioUsd) : '—'}</dd></div>
        </dl>
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={used} aria-label="Gasto de hoy contra el límite"><span style={{ width: `${used * 100}%` }} /></div>
        {data && data.desglose.length > 0 && <p className="label">{data.desglose.map((d) => `${d.servicio} ${usd(d.usd)}`).join(' · ')} (este mes)</p>}
        {!server && <p className="label">Demostración: los costos aparecen con el servidor conectado.</p>}
      </section>

      <section className="frosted card conn" aria-label="Conexiones">
        <div className="conn-row">
          <div><p>Google</p><p className="label">{googleText(server, google)}</p></div>
          {server && google?.configured && (google.connected
            ? <button className="btn clear" onClick={async () => { await post('/api/google/disconnect'); load(); }}>Desconectar</button>
            : <a className="btn btn-primary" href="/api/google/connect">Conectar</a>)}
        </div>
        <div className="conn-row">
          <div><p>Modelo</p><p className="label">{!server ? 'Demostración' : data ? (data.llm === 'mock' ? 'Claude simulado (sin llave todavía)' : `${data.model} · ${data.modelHeavy} para tareas pesadas`) : '…'}</p></div>
        </div>
        <div className="conn-row">
          <div><p>Voz de FRIDAY</p><p className="label">{voiceOn ? (data?.voz === 'elevenlabs' ? 'Encendida · ElevenLabs' : 'Encendida · voz del navegador') : 'Apagada: solo texto'}</p></div>
          <button className={voiceOn ? 'btn clear' : 'btn btn-primary'} onClick={() => voice.toggle()}>{voiceOn ? 'Apagar' : 'Encender'}</button>
        </div>
        <div className="conn-row">
          <div><p>Avisos</p><p className="label">{push ? PUSH_LABEL[push] : '…'}</p></div>
          {server && push === 'apagado' && <button className="btn btn-primary" onClick={activatePush}>Activar</button>}
          {server && push === 'activo' && <button className="btn clear" onClick={async () => setPush(await disablePush())}>Desactivar</button>}
        </div>
      </section>

      <button className="btn frosted settings-link" onClick={onSkills}>Habilidades y permisos</button>

      {activity.length > 0 && (
        <section aria-label="Actividad reciente">
          <h2 className="title skill-group-title">Actividad reciente</h2>
          <ul className="skill-list">
            {activity.map((a, i) => (
              <li key={i}><span>{EVENT[a.event] ?? a.event}{a.tool ? ` · ${TOOL[a.tool] ?? a.tool}` : ''}</span>
                <span className="label">{new Date(a.at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Memoria">
        <h2 className="title skill-group-title">Memoria</h2>
        <p className="label">Lo que FRIDAY recuerda de ti, tus pendientes y recordatorios.</p>
        <div className="row settings-actions">
          <button className="btn frosted" onClick={exportMemory} disabled={!server}>Exportar</button>
        </div>
        <div className="row settings-actions">
          <input className="field clear settings-confirm" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="Escribe BORRAR" aria-label="Escribe BORRAR para borrar la memoria" disabled={!server} />
          <button className="btn clear" onClick={deleteMemory} disabled={confirmDelete !== 'BORRAR'}>Borrar memoria</button>
        </div>
      </section>

      {server && <button className="btn clear settings-link" onClick={logout}>Cerrar sesión</button>}
    </main>
  );
}

function googleText(server: boolean, g: GoogleStatus | null) {
  if (!server) return 'Demostración con datos ficticios';
  if (!g) return '…';
  if (g.mode === 'mock') return 'Datos ficticios (Google aún no configurado en el servidor)';
  if (!g.configured) return 'Falta configurar Google en el servidor';
  return g.connected ? `Conectado${g.email ? ` · ${g.email}` : ''}` : 'Sin conectar';
}
