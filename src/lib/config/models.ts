// Tiered AI model configuration for the Application Studio pipeline

export const MODELS = {
  /** Fast classification, extraction, scoring — Haiku */
  fast: 'claude-haiku-4-5-20251001',
  /** Complex reasoning, matching, quality review — Sonnet */
  standard: 'claude-sonnet-4-6',
  /** Highest quality generation (resume, cover letter) — Opus */
  premium: 'claude-opus-4-6',
} as const;

export type ModelTier = keyof typeof MODELS;

// Approximate cost per 1K tokens (USD)
export const MODEL_COSTS = {
  fast:     { input: 0.001, output: 0.005 },
  standard: { input: 0.003, output: 0.015 },
  premium:  { input: 0.015, output: 0.075 },
} as const;

export function estimateCost(
  model: ModelTier,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COSTS[model];
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}
