/**
 * Model pricing lookup table.
 * Rates are in USD per 1,000,000 tokens (input / output).
 */
export interface ModelRates {
  /** USD per 1M input tokens */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  /** Short display label */
  label: string;
}

export const MODEL_PRICING: Record<string, ModelRates> = {
  'claude-haiku-4-5': {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    label: 'Haiku 4.5',
  },
  'claude-sonnet-4-5': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    label: 'Sonnet 4.5',
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    label: 'Sonnet 4.6',
  },
  'claude-opus-4-7': {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    label: 'Opus 4.7',
  },
};

/**
 * Return rates for a model, or null if unknown.
 */
export function getRatesForModel(model: string | null | undefined): ModelRates | null {
  if (!model) return null;
  return MODEL_PRICING[model] ?? null;
}

/**
 * Estimate session cost in USD given cumulative token counts.
 * cacheCreation tokens are billed at input rate;
 * cacheRead tokens are billed at 10% of input rate.
 */
export function estimateCost(
  rates: ModelRates,
  cumulative: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  },
): { input: number; output: number; cache: number; total: number } {
  const input = (cumulative.inputTokens / 1_000_000) * rates.inputPerMillion;
  const output = (cumulative.outputTokens / 1_000_000) * rates.outputPerMillion;
  const cache =
    (cumulative.cacheCreationTokens / 1_000_000) * rates.inputPerMillion +
    (cumulative.cacheReadTokens / 1_000_000) * rates.inputPerMillion * 0.1;
  return { input, output, cache, total: input + output + cache };
}

/**
 * Format a cost in USD for display, e.g. "$0.45".
 */
export function formatCostUSD(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
