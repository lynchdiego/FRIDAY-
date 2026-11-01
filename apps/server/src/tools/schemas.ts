import { z } from 'zod';
import type { Tool } from '../llm/types';
import { activeSkills } from '@friday/shared';

// Esquemas de entrada de cada herramienta. Sirven dos veces: se le describen al modelo
// y el servidor valida con ellos todo lo que el modelo pide (nunca se confía a ciegas).
const iso = z.string().min(10).describe('Fecha y hora ISO 8601, hora local de Diego si no lleva zona');
export const SCHEMAS = {
  calendar_list: z.object({ from: iso, to: iso }),
  event_create: z.object({ title: z.string().min(1), start: iso, end: iso, location: z.string().optional(), attendees: z.array(z.string().email()).optional(), description: z.string().optional() }),
  event_update: z.object({ id: z.string(), title: z.string().optional(), start: iso.optional(), end: iso.optional(), location: z.string().optional() }),
  gmail_search: z.object({ query: z.string().describe('Búsqueda estilo Gmail, p. ej. "is:unread" o "from:julio"'), max: z.number().int().min(1).max(20).optional() }),
  gmail_read: z.object({ id: z.string() }),
  gmail_draft: z.object({ to: z.string(), subject: z.string(), body: z.string(), reply_to_id: z.string().optional() }),
  gmail_send: z.object({ to: z.string().email(), subject: z.string().min(1), body: z.string().min(1), reply_to_id: z.string().optional() }),
  tasks_list: z.object({}),
  task_add: z.object({ title: z.string().min(1), due: iso.optional().describe('Fecha límite (Google Tasks guarda solo el día)'), notes: z.string().optional() }),
  task_complete: z.object({ id: z.string() }),
  reminder_add: z.object({ text: z.string().min(1), at: iso }),
  memory_search: z.object({ query: z.string() }),
  memory_save: z.object({ kind: z.enum(['perfil', 'preferencia', 'persona', 'proyecto', 'dato']), subject: z.string().min(1), content: z.string().min(1) }),
  message_prepare: z.object({ to_name: z.string(), phone: z.string().optional().describe('Teléfono con lada internacional, si se conoce'), text: z.string().min(1) }),
} as const;
export type ToolName = keyof typeof SCHEMAS;

/** Herramientas que se le ofrecen al modelo: solo las activas y nunca las NUNCA. Orden fijo (caché). */
export function toolDefinitions(): Tool[] {
  return activeSkills()
    .filter((s) => s.id in SCHEMAS)
    .map((s) => {
      const schema = z.toJSONSchema(SCHEMAS[s.id as ToolName]) as any;
      delete schema.$schema;
      const tag = s.permission === 'ACTUA' ? ' [Requiere confirmación de Diego]' : '';
      return { name: s.id, description: s.description + tag, input_schema: schema } as Tool;
    });
}
