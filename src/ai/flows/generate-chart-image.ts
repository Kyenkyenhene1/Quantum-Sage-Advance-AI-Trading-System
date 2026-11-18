
'use server';
/**
 * @fileOverview Generates a technical analysis chart image using an AI model.
 *
 * - generateChartImage - A function that takes chart parameters and returns an SVG image string.
 */

import {ai} from '@/ai/genkit';
import { GenerateChartImageInputSchema, GenerateChartImageOutputSchema, type GenerateChartImageInput, type GenerateChartImageOutput } from '@/ai/types';
import { retry } from '@/ai/utils';
import { recordAICallStart, recordAICallEnd } from '@/lib/aiMetrics';
import { aiCacheGetAuto, aiCacheSetAuto } from '@/lib/aiCache'
import { rateLimit } from '@/lib/rateLimit'
import { withAIConcurrency } from '@/lib/aiConcurrency'
import { initServerSentry } from '@/lib/sentry.server'

initServerSentry()

export async function generateChartImage(input: GenerateChartImageInput): Promise<GenerateChartImageOutput> {
  return generateChartImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChartImagePrompt',
  input: { schema: GenerateChartImageInputSchema },
  output: { schema: GenerateChartImageOutputSchema },
  prompt: `You are an expert in financial chart generation. Your task is to create a detailed and realistic SVG representation of a financial chart based on the provided parameters.

Parameters:
- Trading Pair: {{pair}}
- Timeframe: {{timeframe}}
- Chart Type: {{chartType}}

Instructions:
1.  Generate a valid SVG string. The SVG should have a dark theme background (e.g., #1A202C).
2.  The SVG must include realistic price action for the specified chart type (candlestick or line). Bullish elements should be a shade of green (e.g., #48BB78), and bearish elements should be a shade of red (e.g., #F56565).
3.  Include representations of common technical indicators:
    - Moving Averages (e.g., two different colored lines like blue and yellow).
    - An RSI (Relative Strength Index) indicator in a separate panel below the main chart.
    - A MACD (Moving Average Convergence Divergence) indicator, also in a separate panel below the main chart.
4.  The SVG must include axis labels for price (Y-axis) and time (X-axis). The labels should be a light color (e.g., #A0AEC0).
5.  Do not include any text that says "sample," "example," or "placeholder." The chart should appear as if it is from a real trading application.
6.  The entire output must be a single JSON object containing the SVG string in the "svg" field. Do not include any other text or explanations outside the JSON structure.

Example SVG structure:
<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style="background-color: #1A202C; color: #A0AEC0; font-family: sans-serif; font-size: 12px;">
  <!-- Main chart area -->
  <g id="main-chart">
    <!-- Candlesticks or line path here -->
  </g>
  <!-- RSI panel -->
  <g id="rsi-panel" transform="translate(0, 300)">
    <!-- RSI line path here -->
  </g>
  <!-- MACD panel -->
  <g id="macd-panel" transform="translate(0, 350)">
    <!-- MACD histogram and lines here -->
  </g>
  <!-- Axes -->
  <g id="y-axis">
    <!-- Price labels and lines -->
  </g>
  <g id="x-axis">
    <!-- Time labels and lines -->
  </g>
</svg>
`,
});

const generateChartImageFlow = ai.defineFlow(
  {
    name: 'generateChartImageFlow',
    inputSchema: GenerateChartImageInputSchema,
    outputSchema: GenerateChartImageOutputSchema,
  },
  async (input) => {
    const ctx = recordAICallStart('generateChartImage', process.env.AI_MODEL_VERSION)
    const rl = await rateLimit('ai-global', Number(process.env.AI_GLOBAL_RATE_LIMIT || '200'), 60)
    if (!rl.allowed) throw new Error('AI rate limit exceeded')
    try {
      GenerateChartImageInputSchema.parse(input);
      const cacheKey = `generateChartImage:${JSON.stringify(input)}`
      const cached = await aiCacheGetAuto<GenerateChartImageOutput>(cacheKey)
      if (cached) {
        recordAICallEnd(ctx)
        return cached as GenerateChartImageOutput
      }
      const { output } = await withAIConcurrency(() => retry(() => prompt(input)));
      if (!output) {
        throw new Error('AI failed to generate a chart SVG.');
      }
      await aiCacheSetAuto(cacheKey, output)
      recordAICallEnd(ctx)
      return output;
    } catch (err) {
      recordAICallEnd(ctx, err)
      // eslint-disable-next-line no-console
      console.error('generateChartImageFlow error', err);
      throw err;
    }
  }
);
