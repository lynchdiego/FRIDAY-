import { useState } from 'react';
import { HudCoreView } from '../hud/HudCoreView';
import { chat } from '../state/chat';
import { ArrowUp } from '../components/icons';

export function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { await chat.login(pw); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <main className="login">
      <HudCoreView className="login-core" />
      <h1 className="title login-title">FRIDAY</h1>
      <form className="field clear login-field" onSubmit={submit}>
        <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Contraseña" aria-label="Contraseña" autoFocus />
        <button className="send" aria-label="Entrar"><ArrowUp /></button>
      </form>
      <p className="label" role="alert">{err}</p>
    </main>
  );
}
