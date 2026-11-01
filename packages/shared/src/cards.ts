// Tarjetas que el servidor manda a la interfaz junto con la respuesta de FRIDAY.
export interface EventItem { id: string; title: string; start: string; end: string; location?: string }
export interface EmailItem { id: string; from: string; subject: string; date: string; snippet: string; unread: boolean }

export type Card =
  | { type: 'events'; items: EventItem[] }
  | { type: 'emails'; items: EmailItem[] }
  | { type: 'email'; from: string; subject: string; date: string; body: string; warning?: string }
  | { type: 'draft'; to: string; subject: string; body: string }
  | { type: 'action'; id: string; token: string; tool: string; title: string; fields: { label: string; value: string }[]; preview?: string; expiresAt: string; verbalOk: boolean }
  | { type: 'task'; title: string; due?: string }
  | { type: 'tasks'; items: { id: number; title: string; due?: string }[] }
  | { type: 'reminder'; text: string; at: string }
  | { type: 'message'; to: string; text: string; url: string }
  | { type: 'notice'; tone: 'info' | 'error'; text: string };

export interface ChatReply {
  conversationId: string;
  text: string;
  cards: Card[];
  mode: 'normal' | 'basico';
  model?: string;
}
