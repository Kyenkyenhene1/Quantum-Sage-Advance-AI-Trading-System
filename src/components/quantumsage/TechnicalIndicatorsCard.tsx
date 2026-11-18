
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Indicator {
  name: string;
  value: string;
  description: string;
}

const indicators: Indicator[] = [
  { name: "EMA(20)", value: "1.12034", description: "Exponential Moving Average (20 periods)" },
  { name: "EMA(50)", value: "1.11876", description: "Exponential Moving Average (50 periods)" },
  { name: "EMA(200)", value: "1.11542", description: "Exponential Moving Average (200 periods)" },
  { name: "RSI(14)", value: "58.4", description: "Relative Strength Index (14 periods)" },
  { name: "MACD", value: "+0.0012", description: "Moving Average Convergence Divergence" },
  { name: "Stoch", value: "72/65", description: "Stochastic Oscillator (K%/D%)" },
  { name: "ATR(14)", value: "0.0034", description: "Average True Range (14 periods)" },
  { name: "Volume", value: "↑ 124%", description: "Trading Volume vs Average" },
];

export function TechnicalIndicatorsCard() {
  const [activeIndicator, setActiveIndicator] = useState<string | null>(null); // Can be null if none is "active"

  const handleIndicatorInteraction = (indicatorName: string) => {
    // Toggle behavior: if already active, deactivate. Otherwise, activate.
    setActiveIndicator(prev => prev === indicatorName ? null : indicatorName);
    // Potential future action: e.g., highlight this indicator on the main chart or show more details
    console.log(`Indicator ${indicatorName} selected/toggled.`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <BarChart2 className="mr-2 text-primary" />
          Technical Indicators
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {indicators.map(indicator => (
            <Tooltip key={indicator.name}>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleIndicatorInteraction(indicator.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleIndicatorInteraction(indicator.name);
                      e.preventDefault(); // Prevent page scroll on space
                    }
                  }}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer text-center transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    activeIndicator === indicator.name ? "ring-2 ring-primary shadow-md bg-primary/10" : "hover:bg-muted/50"
                  )}
                  aria-pressed={activeIndicator === indicator.name}
                  aria-label={`Select indicator: ${indicator.description}`}
                >
                  <div className="text-sm font-medium">{indicator.name}</div>
                  <div className="text-xs text-muted-foreground">{indicator.value}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{indicator.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
