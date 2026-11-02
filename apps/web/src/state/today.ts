import { useEffect, useState } from 'react';
import type { TodayData } from '@friday/shared';
import { useChat, currentTz } from './chat';
import { mock } from '../data/mock';

/** Lo que muestran Inicio y Resumen del día. Viene de /api/today (o de datos ficticios en demostración). */
export interface TodayView {
  priority: string | null;
  summary: string;
  next: { kind: string; text: string; meta: string; ask: string }[];
  stats: { value: string; label: string }[];
  day: { time: string; title: string; place: string }[];
  /** Eventos crudos para el reloj del día del núcleo. */
  events: { start: string; end: string; allDay?: boolean; title: string }[];
  emailCount: number;
  errors: string[];
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone: currentTz(), hour: '2-digit', minute: '2-digit', hour12: false });

export function toView(d: TodayData): TodayView {
  const upcoming = d.events.filter((e) => Date.parse(e.end) > Date.now());
  const ev = upcoming[0];
  const mail = d.emails[0];
  const rem = d.reminders[0];
  const task = d.tasks[0];
  const next: TodayView['next'] = [];
  next.push(ev ? { kind: 'Evento', text: ev.title, meta: ev.allDay ? 'Todo el día' : hhmm(ev.start), ask: '¿Qué sigue en mi agenda?' }
    : { kind: 'Evento', text: 'Nada más en la agenda hoy', meta: '', ask: '¿Qué tengo mañana?' });
  next.push(mail ? { kind: 'Correo', text: mail.subject, meta: `${d.emails.length} sin leer`, ask: '¿Qué correos importantes tengo?' }
    : { kind: 'Correo', text: 'Bandeja al día', meta: '', ask: '¿Qué correos importantes tengo?' });
  if (rem) next.push({ kind: 'Recordatorio', text: rem.text, meta: hhmm(rem.at), ask: '¿Qué recordatorios tengo?' });
  else if (task) next.push({ kind: 'Pendiente', text: task.title, meta: `${d.tasks.length} abiertos`, ask: '¿Qué pendientes tengo?' });
  const n = d.events.length;
  return {
    priority: d.priority,
    summary: n === 0 ? 'Hoy no tienes eventos en la agenda.' : n === 1 ? 'Tienes un compromiso hoy.' : `Tienes ${n} compromisos hoy.`,
    next,
    stats: [
      { value: String(n), label: 'Eventos' },
      { value: String(d.emails.length), label: 'Correos sin leer' },
      { value: String(d.tasks.length), label: 'Pendientes' },
      { value: String(d.reminders.length), label: 'Recordatorios' },
    ],
    day: d.events.map((e) => ({ time: e.allDay ? 'Día' : hhmm(e.start), title: e.title, place: e.location ?? '' })),
    events: d.events.map(({ start, end, allDay, title }) => ({ start, end, allDay, title })),
    emailCount: d.emails.length,
    errors: d.errors,
  };
}

function demoData(): TodayData {
  const date = new Date().toLocaleDateString('en-CA', { timeZone: currentTz() });
  const at = (t: string) => `${date}T${t}:00-05:00`;
  return {
    date, errors: [], priority: mock.priority,
    events: mock.day.map((e, i) => ({ id: `d${i}`, title: e.title, start: at(e.time), end: at(e.time), location: e.place })).map((e, i, a) => ({ ...e, end: a[i + 1]?.start ?? at('23:00') })),
    emails: [
      { id: 'm1', from: 'Julio Pérez', subject: '¿Cotización del rodaje en Tulum?', date: at('08:12'), snippet: '', unread: true },
      { id: 'm2', from: 'Ana Ruiz', subject: 'Agenda para la comida', date: at('07:40'), snippet: '', unread: true },
      { id: 'm3', from: 'Renta de Equipo MX', subject: 'Factura pendiente', date: at('07:00'), snippet: '', unread: true },
    ],
    tasks: [{ id: 't1', title: 'Respaldar el material de ayer' }, { id: 't2', title: 'Revisar propuesta premium de NODO' }],
    reminders: [{ text: 'Respaldar el material de ayer', at: at('18:00') }],
  };
}

export function useToday() {
  const { mode, authed } = useChat();
  const [view, setView] = useState<TodayView>(() => toView(demoData()));
  useEffect(() => {
    if (mode !== 'server' || !authed) { setView(toView(demoData())); return; }
    let alive = true;
    const load = () => fetch('/api/today', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setView(toView(d)); }).catch(() => {});
    load();
    const i = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(i); };
  }, [mode, authed]);
  return view;
}
