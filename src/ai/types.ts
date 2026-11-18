
/**
 * @fileOverview Shared types and schemas for AI flows.
 */

import {z} from 'genkit';

// === Schemas and Types for `analyze-trading-news` flow ===
export const AnalyzeTradingNewsInputSchema = z.object({
  newsHeadline: z.string().describe('The headline of the financial news.'),
  newsContent: z.string().describe('The content of the financial news article.'),
  currentPositions: z.string().optional().describe('A summary of the user\'s current trading positions, including the pair traded (e.g., EURUSD), direction (Buy/Sell), lot size, and entry price. These positions might be managed with layering and dynamic stop losses.'),
});
export type AnalyzeTradingNewsInput = z.infer<typeof AnalyzeTradingNewsInputSchema>;

export const AnalyzeTradingNewsOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the financial news.'),
  potentialImpact: z.string().describe('An assessment of the potential impact of the news on the user\'s trading positions, considering factors like volatility, direction, and advanced trade management techniques if applicable.'),
  affectedPairs: z.string().describe('The trading pairs most likely to be affected by this news (e.g., EURUSD, GBPUSD).'),
});
export type AnalyzeTradingNewsOutput = z.infer<typeof AnalyzeTradingNewsOutputSchema>;


// === Schemas and Types for `assess-risk-settings` flow ===
export const AssessRiskSettingsInputSchema = z.object({
  riskPerTrade: z
    .number()
    .describe('The percentage of account balance to risk per trade (e.g., 1 for 1%, 2.5 for 2.5%).'),
  maxDailyTrades: z
    .number()
    .int()
    .describe('The maximum number of trades allowed in a single day.'),
  stopLossType: z
    .string()
    .describe('The methodology used for setting stop loss (e.g., "ATR Based", "Fixed Pips", "Structure Based").'),
  takeProfitRatio: z
    .string()
    .describe('The desired risk-to-reward ratio for trades (e.g., "1:1", "1:2", "Trailing TP").'),
  currentMarketVolatility: z
    .enum(['Low', 'Medium', 'High'])
    .optional()
    .describe('Optional: Current perceived market volatility for a more contextual assessment.'),
});
export type AssessRiskSettingsInput = z.infer<typeof AssessRiskSettingsInputSchema>;

export const AssessRiskSettingsOutputSchema = z.object({
  assessment: z
    .string()
    .describe('A qualitative assessment of the provided risk settings, considering their balance, potential aggressiveness, and suitability for different market conditions if provided.'),
  suggestions: z
    .array(z.string())
    .optional()
    .describe('Optional: Specific suggestions for improving or reconsidering the risk settings.')
});
export type AssessRiskSettingsOutput = z.infer<typeof AssessRiskSettingsOutputSchema>;


// === Schemas and Types for `explain-trading-signal` flow ===
export const ExplainTradingSignalInputSchema = z.object({
  signalType: z
    .string()
    .describe('The type of trading signal (e.g., Buy, Sell).'),
  asset: z.string().describe('The trading pair or asset (e.g., EURUSD).'),
  reason: z.string().describe('The primary reason for the signal.'),
  confidence: z
    .number()
    .describe('The confidence level of the signal (0-100).')
    .optional(),
  additionalContext: z
    .string()
    .describe(
      'Any additional context or data that influenced the trading signal.'
    )
    .optional(),
});
export type ExplainTradingSignalInput = z.infer<
  typeof ExplainTradingSignalInputSchema
>;

export const ExplainTradingSignalOutputSchema = z.object({
  explanation: z
    .string()
    .describe(
      'A detailed explanation of the factors that led to the trading signal, potentially including how advanced trade management techniques might apply.'
    ),
});
export type ExplainTradingSignalOutput = z.infer<
  typeof ExplainTradingSignalOutputSchema
>;


// === Schemas and Types for `generate-chart-image` flow ===
export const GenerateChartImageInputSchema = z.object({
  pair: z.string().describe('The trading pair for the chart (e.g., EURUSD).'),
  timeframe: z.string().describe('The timeframe for the chart (e.g., H4, D1).'),
  chartType: z.enum(['candlestick', 'line']).describe('The type of chart to generate.'),
});
export type GenerateChartImageInput = z.infer<typeof GenerateChartImageInputSchema>;

export const GenerateChartImageOutputSchema = z.object({
  svg: z.string().describe('The generated chart as an SVG string.'),
});
export type GenerateChartImageOutput = z.infer<typeof GenerateChartImageOutputSchema>;
