// Contratos de las integraciones. En la etapa 4 se agrega la versión real de Google
// con la misma forma, sin tocar el cerebro.
export interface CalendarEvent { id: string; title: string; start: string; end: string; allDay?: boolean; location?: string; attendees?: string[]; description?: string }
export interface TaskItem { id: string; title: string; due?: string; notes?: string }
export interface EmailSummary { id: string; from: string; subject: string; date: string; snippet: string; unread: boolean }
export interface Email extends EmailSummary { to: string; body: string }
export interface NewEvent { title: string; start: string; end: string; location?: string; attendees?: string[]; description?: string }
export interface OutgoingEmail { to: string; subject: string; body: string; replyToId?: string }

export interface Calendar {
  list(fromIso: string, toIso: string): Promise<CalendarEvent[]>;
  create(e: NewEvent): Promise<CalendarEvent>;
  update(id: string, patch: Partial<NewEvent>): Promise<CalendarEvent>;
}
export interface Mail {
  search(query: string, max: number): Promise<EmailSummary[]>;
  read(id: string): Promise<Email>;
  draft(m: OutgoingEmail): Promise<{ draftId: string }>;
  send(m: OutgoingEmail): Promise<{ messageId: string }>;
}
export interface Tasks {
  list(): Promise<TaskItem[]>;
  add(title: string, dueIso?: string, notes?: string): Promise<TaskItem>;
  complete(id: string): Promise<void>;
}
export interface Integrations { calendar: Calendar; mail: Mail; tasks: Tasks; name: string }

export type Service = 'Google' | 'Google Calendar' | 'Gmail' | 'Google Tasks';
export class IntegrationError extends Error {
  constructor(public service: Service, message: string) { super(message); }
}
