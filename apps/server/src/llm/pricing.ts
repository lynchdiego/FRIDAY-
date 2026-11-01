import type { LlmUsage } from './types';

// Precios por millón de tokens (USD). Verificados 2026-11: Sonnet 5.5 $2/$10, Opus 5.5 $4/$20,
// lectura de caché $0.20. Escritura de caché ≈ 1.25× la entrada. Actualizar si cambian.
const PRICES: Record<string, { in: number; out: number; cacheRead: number }> = {
  'claude-sonnet-5-5': { in: 2, out: 10, cacheRead: 0.2 },
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cacheRead: 0.01 },
};
const FALLBACK = { in: 4, out: 20, cacheRead: 0.4 }; // modelo desconocido: estimación conservadora

export function estimateCost(model: string, u: LlmUsage) {
  const p = PRICES[model] ?? FALLBACK;
  return (u.input * p.in + u.output * p.out + u.cacheRead * p.cacheRead + u.cacheWrite * p.in * 1.25) / 1e6;
}
