
'use server';

/**
 * @fileOverview Explains the reasoning behind a specific trading signal.
 *
 * - explainTradingSignal - A function that takes a trading signal and returns an explanation.
 */

import {ai} from '@/ai/genkit';
import { ExplainTradingSignalInputSchema, ExplainTradingSignalOutputSchema, type ExplainTradingSignalInput, type ExplainTradingSignalOutput } from '@/ai/types';
import { retry } from '@/ai/utils';
import { recordAICallStart, recordAICallEnd } from '@/lib/aiMetrics';
import { aiCacheGetAuto, aiCacheSetAuto } from '@/lib/aiCache'
import { rateLimit } from '@/lib/rateLimit'
import { withAIConcurrency } from '@/lib/aiConcurrency'
import { initServerSentry } from '@/lib/sentry.server'

initServerSentry()


export async function explainTradingSignal(
  input: ExplainTradingSignalInput
): Promise<ExplainTradingSignalOutput> {
  return explainTradingSignalFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainTradingSignalPrompt',
  input: {schema: ExplainTradingSignalInputSchema},
  output: {schema: ExplainTradingSignalOutputSchema},
  prompt: `You are an expert financial analyst explaining trading signals.

You will receive details about a trading signal and must provide a clear and concise explanation of why the signal was generated. Consider all available information to provide a comprehensive justification. Focus on the factors that contributed to the signal and their potential impact on the asset.

When providing the explanation, also consider common advanced trade management techniques. For example, if the signal is strong, you might mention that a trader could manage such a position by:
1.  Implementing layered entries: Opening additional positions if the trade moves into profit by specific pip amounts (e.g., scaling in at +30 pips, +50 pips, +70 pips, and +100 pips from the initial entry). There would be up to 4 additional layers after the initial entry.
2.  Dynamic stop loss: Moving the stop loss for any given position to its entry point (break-even) once that position has secured a certain amount of profit (e.g., +20 pips).
This context should be woven into your explanation naturally if relevant to the signal's strength, the asset's typical behavior, or the provided reason.

Trading Signal Details:
Type: {{signalType}}
Asset: {{asset}}
Reason: {{reason}}
{{#if confidence}}Confidence: {{confidence}}%{{/if}}
{{#if additionalContext}}Additional Context: {{additionalContext}}{{/if}}

Explanation:`,
});

const explainTradingSignalFlow = ai.defineFlow(
  {
    name: 'explainTradingSignalFlow',
    inputSchema: ExplainTradingSignalInputSchema,
    outputSchema: ExplainTradingSignalOutputSchema,
  },
  async input => {
    const ctx = recordAICallStart('explainTradingSignal', process.env.AI_MODEL_VERSION)
    const rl = await rateLimit('ai-global', Number(process.env.AI_GLOBAL_RATE_LIMIT || '200'), 60)
    if (!rl.allowed) throw new Error('AI rate limit exceeded')
    try {
      ExplainTradingSignalInputSchema.parse(input);
      const cacheKey = `explainTradingSignal:${JSON.stringify(input)}`
      const cached = await aiCacheGetAuto<ExplainTradingSignalOutput>(cacheKey)
      if (cached) {
        recordAICallEnd(ctx)
        return cached as ExplainTradingSignalOutput
      }
      const { output } = await withAIConcurrency(() => retry(() => prompt(input)));
      if (output) await aiCacheSetAuto(cacheKey, output)
      recordAICallEnd(ctx)
      return output!;
    } catch (err) {
      recordAICallEnd(ctx, err)
      // eslint-disable-next-line no-console
      console.error('explainTradingSignalFlow error', err);
      throw err;
    }
  }
);
