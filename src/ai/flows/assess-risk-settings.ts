
'use server';
/**
 * @fileOverview Provides an AI-driven assessment of user-defined trading risk settings.
 *
 * - assessRiskSettings - A function that takes risk settings and returns an AI assessment.
 */

import {ai} from '@/ai/genkit';
import { AssessRiskSettingsInputSchema, AssessRiskSettingsOutputSchema, type AssessRiskSettingsInput, type AssessRiskSettingsOutput } from '@/ai/types';
import { retry } from '@/ai/utils';
import { recordAICallStart, recordAICallEnd } from '@/lib/aiMetrics';
import { aiCacheGetAuto, aiCacheSetAuto } from '@/lib/aiCache'
import { rateLimit } from '@/lib/rateLimit'
import { withAIConcurrency } from '@/lib/aiConcurrency'
import { initServerSentry } from '@/lib/sentry.server'

initServerSentry()

export async function assessRiskSettings(input: AssessRiskSettingsInput): Promise<AssessRiskSettingsOutput> {
  return assessRiskSettingsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assessRiskSettingsPrompt',
  input: {schema: AssessRiskSettingsInputSchema},
  output: {schema: AssessRiskSettingsOutputSchema},
  prompt: `You are an expert trading risk manager. Analyze the following trading risk settings and provide a concise, qualitative assessment. Consider the interplay between the parameters.

Risk Settings:
- Risk Per Trade: {{riskPerTrade}}%
- Max Daily Trades: {{maxDailyTrades}}
- Stop Loss Type: "{{stopLossType}}"
- Take Profit Ratio: "{{takeProfitRatio}}"
{{#if currentMarketVolatility}}
- Current Market Volatility: {{currentMarketVolatility}}
{{/if}}

Assessment Guidelines:
- Comment on the overall risk profile (e.g., conservative, moderate, aggressive).
- Highlight any potential conflicts or areas of concern (e.g., high risk per trade with a very tight SL method might lead to frequent small losses).
- If market volatility is provided, comment on how well the settings might perform in such conditions.
- Provide 1-2 actionable suggestions if applicable. If the settings seem well-balanced, state that.
- The assessment should be brief, 2-3 sentences. Suggestions can be bullet points if needed.

Your output MUST be in the specified JSON format.`,
});

const assessRiskSettingsFlow = ai.defineFlow(
  {
    name: 'assessRiskSettingsFlow',
    inputSchema: AssessRiskSettingsInputSchema,
    outputSchema: AssessRiskSettingsOutputSchema,
  },
  async input => {
    const ctx = recordAICallStart('assessRiskSettings', process.env.AI_MODEL_VERSION)
    const rl = await rateLimit('ai-global', Number(process.env.AI_GLOBAL_RATE_LIMIT || '200'), 60)
    if (!rl.allowed) throw new Error('AI rate limit exceeded')
    try {
      AssessRiskSettingsInputSchema.parse(input);
      const cacheKey = `assessRiskSettings:${JSON.stringify(input)}`
      const cached = await aiCacheGetAuto<AssessRiskSettingsOutput>(cacheKey)
      if (cached) {
        recordAICallEnd(ctx)
        return cached as AssessRiskSettingsOutput
      }
      const { output } = await withAIConcurrency(() => retry(() => prompt(input)));
      if (!output) {
        throw new Error('AI failed to provide an assessment.');
      }
      await aiCacheSetAuto(cacheKey, output)
      recordAICallEnd(ctx)
      return output;
    } catch (err) {
      recordAICallEnd(ctx, err)
      // eslint-disable-next-line no-console
      console.error('assessRiskSettingsFlow error', err);
      throw err;
    }
  }
);
