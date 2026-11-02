import { useEffect, useState } from 'react';
import { SKILLS, NEVER_RULES, GROUP_LABEL, PERMISSION_LABEL, type Skill, type SkillGroup } from '@friday/shared';
import { chat, useChat } from '../state/chat';
import { usePushStatus, enablePush, disablePush, testPush, PUSH_LABEL } from '../state/notices';

/**
 * Pantalla 5: Habilidades y permisos. Se dibuja desde la misma lista que usa el servidor
 * para decidir qué puede hacer FRIDAY (packages/shared/src/skills.ts).
 */
interface GoogleStatus { configured: boolean; connected: boolean; email: string | null; mode: string }

export function Skills({ onBack }: { onBack: () => void }) {
  const { mode } = useChat();
  const [skills, setSkills] = useState<Skill[]>(SKILLS);
  const [never, setNever] = useState<string[]>(NEVER_RULES);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [llm, setLlm] = useState<{ model: string; llm: string; voz?: string } | null>(null);
  const [push, setPush] = usePushStatus();
  const activate = async () => {
    try { const st = await enablePush(); setPush(st); if (st === 'activo') { await testPush(); chat.notify('Avisos activados. Te mandé uno de prueba.'); } }
    catch { chat.notify('No pude activar los avisos en este dispositivo.'); }
  };

  const load = () => {
    if (mode !== 'server') return;
    fetch('/api/skills').then((r) => r.json()).then((d) => { setSkills(d.skills); setNever(d.never); }).catch(() => {});
    fetch('/api/google/status').then((r) => r.json()).then(setGoogle).catch(() => {});
    fetch('/api/settings').then((r) => r.json()).then(setLlm).catch(() => {});
  };
  useEffect(load, [mode]);

  const disconnect = async () => { await fetch('/api/google/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); load(); };
  const groups = Object.keys(GROUP_LABEL) as SkillGroup[];

  return (
    <main className="skills">
      <header className="skills-head">
        <button className="btn clear" onClick={onBack}>Inicio</button>
      </header>
      <h1 className="title skills-title">Habilidades y permisos</h1>
      <p className="label skills-sub">Lo que FRIDAY puede hacer y con qué permiso. Nada que actúe en tu nombre sale sin tu sí.</p>

      <section className="frosted card conn" aria-label="Conexiones">
        <div className="conn-row">
          <div><p>Google</p><p className="label">{googleText(mode, google)}</p></div>
          {mode === 'server' && google?.configured && (google.connected
            ? <button className="btn clear" onClick={disconnect}>Desconectar</button>
            : <a className="btn btn-primary" href="/api/google/connect">Conectar</a>)}
        </div>
        <div className="conn-row">
          <div><p>Claude</p><p className="label">{mode !== 'server' ? 'Demostración' : llm ? (llm.llm === 'mock' ? 'Simulado (sin llave todavía)' : llm.model) : '…'}</p></div>
        </div>
        <div className="conn-row">
          <div><p>Voz</p><p className="label">{mode !== 'server' ? 'Voz del navegador' : llm?.voz === 'elevenlabs' ? 'ElevenLabs · voz original' : 'Voz del navegador (sin ElevenLabs todavía)'}</p></div>
        </div>
        <div className="conn-row">
          <div><p>Avisos</p><p className="label">{push ? PUSH_LABEL[push] : '…'} · Recordatorios y resumen de las 7:30</p></div>
          {mode === 'server' && push === 'apagado' && <button className="btn btn-primary" onClick={activate}>Activar</button>}
          {mode === 'server' && push === 'activo' && <button className="btn clear" onClick={async () => setPush(await disablePush())}>Desactivar</button>}
        </div>
      </section>

      {groups.map((g) => (
        <section key={g} className="skill-group">
          <h2 className="title skill-group-title">{GROUP_LABEL[g]}</h2>
          <ul className="skill-list">
            {skills.filter((s) => s.group === g).map((s) => (
              <li key={s.id} className={s.status === 'pronto' ? 'soon' : ''}>
                <div>
                  <p className="skill-name">{s.name}{s.status === 'pronto' && <span className="label"> · Pronto</span>}</p>
                  <p className="label skill-desc">{s.help}</p>
                </div>
                <span className={`perm perm-${s.permission}`}>{PERMISSION_LABEL[s.permission]}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="blur never" aria-label="Nunca">
        <span className="perm perm-NUNCA">Nunca</span>
        <ul>{never.map((n) => <li key={n}>{n}</li>)}</ul>
        <p className="label">Reglas fijas: no existe ninguna herramienta que las haga.</p>
      </section>
    </main>
  );
}

function googleText(mode: string, g: GoogleStatus | null) {
  if (mode !== 'server') return 'Demostración con datos ficticios';
  if (!g) return '…';
  if (g.mode === 'mock') return 'Datos ficticios (Google aún no configurado en el servidor)';
  if (!g.configured) return 'Falta configurar Google en el servidor';
  return g.connected ? `Conectado${g.email ? ` · ${g.email}` : ''}` : 'Sin conectar';
}
