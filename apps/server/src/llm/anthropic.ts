import Anthropic from '@anthropic-ai/sdk';
import type { Llm, LlmRequest, LlmResponse } from './types';
import { LlmUnavailableError } from './types';

/**
 * Proveedor real: SDK oficial de Anthropic.
 * - Caché de prompts: herramientas + instrucciones fijas se cachean (más barato).
 * - fallbacks "default": si un clasificador de seguridad rechaza por error, el servidor de
 *   Anthropic reintenta con otro modelo en la misma llamada.
 */
export function createAnthropicLlm(apiKey: string): Llm {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  return {
    name: 'anthropic',
    async create(req: LlmRequest): Promise<LlmResponse> {
      try {
        const res = await client.beta.messages.create({
          model: req.model,
          max_tokens: req.maxTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: req.effort },
          cache_control: { type: 'ephemeral' },
          system: req.system,
          tools: req.tools,
          messages: req.messages,
        });
        const u = res.usage;
        return {
          model: res.model,
          content: res.content,
          stopReason: res.stop_reason,
          usage: { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 },
        };
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) throw new LlmUnavailableError('La llave de Claude no es válida.');
        if (err instanceof Anthropic.RateLimitError) throw new LlmUnavailableError('Claude está saturado en este momento.');
        if (err instanceof Anthropic.APIConnectionError) throw new LlmUnavailableError('No hay conexión con Claude.');
        if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) throw new LlmUnavailableError('Claude tuvo una falla temporal.');
        throw err;
      }
    },
  };
}
