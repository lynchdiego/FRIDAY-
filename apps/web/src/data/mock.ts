// Datos ficticios para la etapa 2. Se reemplazan por Google en la etapa 4.
export const mock = {
  name: 'Diego',
  priority: 'Enviar la cotización del rodaje en Tulum antes de las 14:00.',
  next: [
    { kind: 'Evento', text: 'Llamada con Julio — guion de la campaña', meta: '10:30' },
    { kind: 'Correo', text: '3 correos importantes sin responder', meta: '12 nuevos' },
    { kind: 'Recordatorio', text: 'Respaldar el material de ayer', meta: '18:00' },
  ],
  stats: [
    { value: '4', label: 'Eventos' },
    { value: '12', label: 'Correos nuevos' },
    { value: '3', label: 'Importantes' },
    { value: '5', label: 'Pendientes' },
  ],
  day: [
    { time: '09:00', title: 'Revisión de color — NAVUA', place: 'Estudio' },
    { time: '10:30', title: 'Llamada con Julio — guion de la campaña', place: 'Meet' },
    { time: '13:00', title: 'Comida con Ana (NODO)', place: 'Puerto Cancún' },
    { time: '16:30', title: 'Scouting de locación', place: 'Tulum' },
  ],
  draft: {
    to: 'Julio Pérez <julio@ejemplo.com>',
    subject: 'Cotización — rodaje Tulum',
    body: 'Hola Julio,\n\nTe comparto la cotización del rodaje en Tulum: dos días de grabación, equipo de cinco personas y entrega del corte final en diez días hábiles.\n\nSi te funciona, apartamos fechas esta semana.\n\nSaludos,\nDiego',
  },
};

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function shortDay(d = new Date()) {
  const wd = cap(d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''));
  return { wd, dd: String(d.getDate()).padStart(2, '0') };
}
export function longDate(d = new Date()) {
  return cap(d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }));
}
export function clock(d = new Date()) {
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}
