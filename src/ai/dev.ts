
import { config } from 'dotenv';
config();

import '@/ai/flows/explain-trading-signal.ts';
import '@/ai/flows/analyze-trading-news.ts';
import '@/ai/flows/assess-risk-settings.ts';
import '@/ai/flows/generate-chart-image.ts';
