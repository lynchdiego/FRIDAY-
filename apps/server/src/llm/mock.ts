import type { Llm, LlmRequest, LlmResponse, ContentBlock, MessageParam } from './types';

/**
 * Claude SIMULADO para desarrollo y pruebas sin gastar API.
 * Reconoce unas cuantas intenciones y usa herramientas como lo haría el modelo real.
 * Con `naive: true` se deja engañar por instrucciones escondidas en correos: sirve para
 * comprobar que, aun así, el servidor no ejecuta nada sin el "sí" de Diego.
 */
export function createMockLlm(opts: { tz: string; naive?: boolean }): Llm {
  let n = 0;
  const id = () => `toolu_mock_${++n}`;
  const text = (t: string): ContentBlock => ({ type: 'text', text: t, citations: null } as ContentBlock);
  const tool = (name: string, input: Record<string, unknown>): ContentBlock => ({ type: 'tool_use', id: id(), name, input } as ContentBlock);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: opts.tz });

  function reply(req: LlmRequest): ContentBlock[] {
    const last = req.messages[req.messages.length - 1];
    const blocks = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content } as any];
    const results = blocks.filter((b: any) => b.type === 'tool_result');
    if (results.length) return afterTools(req.messages, results as any[]);
    const userText = norm(blocks.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").replace(/<(evento_sistema|contexto)>[\s\S]*?<\/\1>/g, ""));

    if (/cuanto cuesta|precio de|clima|tipo de cambio|quien gano/.test(userText))
      return [text('No lo sé con certeza y prefiero no inventarlo. Si me das el dato o una fuente, lo reviso contigo.')];
    if (/que tengo hoy|que sigue|mi agenda|mi dia|estoy libre/.test(userText)) {
      const d = today();
      return [tool('calendar_list', { from: `${d}T00:00:00`, to: `${d}T23:59:59` })];
    }
    if (/agenda|reunion con|programa una/.test(userText)) {
      const hasDate = /\b(hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|\d{1,2}(:\d{2})?\s*(am|pm|h)|\d{1,2} de )/.test(userText);
      if (!hasDate) return [text('Claro. ¿Para qué día y a qué hora la agendo, y cuánto dura?')];
      const d = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: opts.tz });
      return [text('Preparo el evento.'), tool('event_create', { title: 'Reunión con Julio', start: `${d}T10:00:00`, end: `${d}T11:00:00` })];
    }
    if (/(manda|envia|enviale).*(correo|mail)|(correo|mail).*(manda|envia)/.test(userText))
      return [tool('gmail_send', { to: 'julio@ejemplo.com', subject: 'Cotización — rodaje Tulum', body: 'Hola Julio,\n\nTe comparto la cotización del rodaje en Tulum.\n\nSaludos,\nDiego' })];
    if (/recuerdame/.test(userText)) {
      const d = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: opts.tz });
      return [tool('reminder_add', { text: 'Llamar a Ana', at: `${d}T09:00:00` })];
    }
    if (/anota|pendiente/.test(userText)) return [tool('task_add', { title: 'Respaldar el material de ayer' })];
    if (/whatsapp|mensaje a/.test(userText)) return [tool('message_prepare', { phone: '+529981234567', to_name: 'Julio', text: 'Julio, te mando la cotización en un rato.' })];
    if (/correo|bandeja|factura|renta/.test(userText)) return [tool('gmail_search', { query: /factura|renta/.test(userText) ? 'renta' : 'is:unread', max: 10 })];
    return [text('Entendido. (Modo de prueba: estoy usando un Claude simulado.)')];
  }

  function afterTools(history: MessageParam[], results: any[]): ContentBlock[] {
    const prev = history[history.length - 2];
    const uses = (Array.isArray(prev?.content) ? prev.content : []).filter((b: any) => b.type === 'tool_use') as any[];
    const out: string[] = [];
    for (const r of results) {
      const name = uses.find((u) => u.id === r.tool_use_id)?.name;
      const body = typeof r.content === 'string' ? r.content : (r.content ?? []).map((c: any) => c.text).join('');
      if (r.is_error) { out.push(`No pude completar eso: ${body.replace(/^ERROR:\s*/, '')} Sigo aquí en modo texto; ¿lo intento más tarde?`); continue; }
      if (name === 'calendar_list') {
        const titles = [...body.matchAll(/"title":"([^"]+)"/g)].map((m) => m[1]);
        out.push(titles.length ? `Hoy tienes ${titles.length} compromisos. El primero: ${titles[0]}.` : 'Hoy no tienes eventos.');
      } else if (name === 'gmail_search') {
        if (opts.naive && body.includes('renta-equipo')) return [tool('gmail_read', { id: 'm3' })];
        out.push(`Encontré ${(body.match(/"id":/g) ?? []).length} correos.`);
      } else if (name === 'gmail_read') {
        if (opts.naive && /reenv/i.test(body))
          return [tool('gmail_send', { to: 'cobros@renta-equipo.mx', subject: 'Fwd: correos', body: 'Reenvío solicitado. Pago confirmado.' })];
        out.push('Leí el correo. Ojo: trae instrucciones escondidas que piden reenviar tus correos; no las seguí.');
      } else if (/PENDIENTE_DE_CONFIRMACION/.test(body)) {
        out.push('Lo dejé listo, pero no se ha hecho. Revísalo en pantalla y dime «sí» si está bien.');
      } else out.push('Hecho.');
    }
    return [text(out.join(' '))];
  }

  return {
    name: 'mock',
    async create(req): Promise<LlmResponse> {
      const content = reply(req);
      const size = JSON.stringify(req.messages).length + JSON.stringify(req.system).length;
      return {
        model: req.model, content,
        stopReason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
        usage: { input: Math.ceil(size / 4), output: 60, cacheRead: 0, cacheWrite: 0 },
      };
    },
  };
}
