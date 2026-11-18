
'use server';

/**
 * @fileOverview Analyzes financial news and events to provide summaries and assess their potential impact on trading positions.
 *
 * - analyzeTradingNews - A function that analyzes trading news.
 */

import {ai} from '@/ai/genkit';
import { AnalyzeTradingNewsInputSchema, AnalyzeTradingNewsOutputSchema, type AnalyzeTradingNewsInput, type AnalyzeTradingNewsOutput } from '@/ai/types';
import { retry } from '@/ai/utils';
import { recordAICallStart, recordAICallEnd } from '@/lib/aiMetrics';
import { aiCacheGetAuto, aiCacheSetAuto } from '@/lib/aiCache'
import { rateLimit } from '@/lib/rateLimit'
import { withAIConcurrency } from '@/lib/aiConcurrency'
import { initServerSentry } from '@/lib/sentry.server'

initServerSentry()

export async function analyzeTradingNews(input: AnalyzeTradingNewsInput): Promise<AnalyzeTradingNewsOutput> {
  return analyzeTradingNewsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeTradingNewsPrompt',
  input: {schema: AnalyzeTradingNewsInputSchema},
  output: {schema: AnalyzeTradingNewsOutputSchema},
  prompt: `You are an expert financial analyst. Your task is to analyze financial news and events and assess their potential impact on trading positions.

  News Headline: {{{newsHeadline}}}
  News Content: {{{newsContent}}}

  {{#if currentPositions}}
  Current Positions: {{{currentPositions}}}
  {{/if}}

  Based on the news and any current positions, provide:
  - A concise summary of the financial news.
  - An assessment of the potential impact of the news on the user's trading positions. Consider factors like volatility and direction.
    If 'currentPositions' are provided, also consider how the news might affect advanced management of these positions, such as:
    * Profit layering strategies: Incrementally opening up to 4 additional positions if an initial trade moves into profit by defined pip amounts (e.g., scaling in at +30 pips, +50 pips, +70 pips, +100 pips from the initial entry). The news might alter the likelihood of reaching these layers or change the risk profile of scaling in.
    * Dynamic stop-loss adjustments: Moving the stop loss of any given position to its entry point (break-even) once that position has secured a profit (e.g., +20 pips). News-induced volatility might trigger break-even stops prematurely or, conversely, quickly move trades past the break-even threshold.
  - Identify the trading pairs most likely to be affected by this news.
  `,
});

const analyzeTradingNewsFlow = ai.defineFlow(
  {
    name: 'analyzeTradingNewsFlow',
    inputSchema: AnalyzeTradingNewsInputSchema,
    outputSchema: AnalyzeTradingNewsOutputSchema,
  },
  async input => {
    const ctx = recordAICallStart('analyzeTradingNews', process.env.AI_MODEL_VERSION)
    const rl = await rateLimit('ai-global', Number(process.env.AI_GLOBAL_RATE_LIMIT || '200'), 60)
    if (!rl.allowed) throw new Error('AI rate limit exceeded')
    try {
      AnalyzeTradingNewsInputSchema.parse(input);
      // cache key based on prompt name + input
      const cacheKey = `analyzeTradingNews:${JSON.stringify(input)}`
      const cached = await aiCacheGetAuto<AnalyzeTradingNewsOutput>(cacheKey)
      if (cached) {
        recordAICallEnd(ctx)
        return cached as AnalyzeTradingNewsOutput;
      }
      const { output } = await withAIConcurrency(() => retry(() => prompt(input)));
      if (output) await aiCacheSetAuto(cacheKey, output)
      recordAICallEnd(ctx)
      return output!;
    } catch (err) {
      recordAICallEnd(ctx, err)
      // eslint-disable-next-line no-console
      console.error('analyzeTradingNewsFlow error', err);
      throw err;
    }
  }
);
