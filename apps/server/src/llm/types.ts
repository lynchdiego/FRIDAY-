import type Anthropic from '@anthropic-ai/sdk';

export type MessageParam = Anthropic.Beta.BetaMessageParam;
export type ContentBlock = Anthropic.Beta.BetaContentBlock;
export type Tool = Anthropic.Beta.BetaTool;
export type SystemBlock = Anthropic.Beta.BetaTextBlockParam;

export interface LlmRequest {
  model: string;
  effort: 'low' | 'medium' | 'high';
  system: SystemBlock[];
  tools: Tool[];
  messages: MessageParam[];
  maxTokens: number;
}
export interface LlmUsage { input: number; output: number; cacheRead: number; cacheWrite: number }
export interface LlmResponse { model: string; content: ContentBlock[]; stopReason: string | null; usage: LlmUsage }

/** Cualquier proveedor de modelo (Anthropic hoy; otros para comparar en NODO). */
export interface Llm { name: string; create(req: LlmRequest): Promise<LlmResponse> }

export class LlmUnavailableError extends Error {}
