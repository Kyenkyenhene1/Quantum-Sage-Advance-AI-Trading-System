
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, BarChart3, DraftingCompass, ChevronDown, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { generateChartImage } from '@/ai/flows/generate-chart-image';


interface ChartDisplayProps {
  currentPair: string;
  currentTimeframe: string;
  botMonitoredPairs: string[];
  onSelectChartPair: (pair: string) => void;
}

interface PriceData {
  bid: string;
  ask: string;
  spread: string;
}

// --- API Placeholder Functions ---
async function fetchPriceDataAPI(pair: string): Promise<PriceData> {
  console.log(`API_CALL_PLACEHOLDER: Fetching price data for ${pair}.`);
  await new Promise(resolve => setTimeout(resolve, 300)); 
  if (pair.includes("JPY")) {
    return { bid: "150.123", ask: "150.128", spread: "0.5 pips" };
  } else if (pair.startsWith("XAU")) {
     return { bid: "2035.50", ask: "2035.80", spread: "30 cents" };
  }
  return { bid: "1.12345", ask: "1.12358", spread: "1.3 pips" };
}
// --- End API Placeholder Functions ---


export function ChartDisplay({ currentPair, currentTimeframe, botMonitoredPairs, onSelectChartPair }: ChartDisplayProps) {
  const [chartType, setChartType] = useState<'line' | 'candlestick'>('candlestick');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [chartSvg, setChartSvg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const loadChartData = async () => {
    setIsLoading(true);
    setImageError(null);
    setChartSvg(null);
    try {
      const newPriceData = await fetchPriceDataAPI(currentPair);
      setPriceData(newPriceData);
      
      const chartResult = await generateChartImage({
        pair: currentPair,
        timeframe: currentTimeframe,
        chartType: chartType,
      });

      if (chartResult.svg) {
        setChartSvg(chartResult.svg);
      } else {
        throw new Error("Generated SVG is empty.");
      }

    } catch (error: any) {
      console.error("Failed to load chart data:", error);
      const errorMessage = "Could not generate or fetch supporting chart data.";
      setImageError(errorMessage);
      toast({
        variant: "destructive",
        title: "Chart Data Failed",
        description: errorMessage,
      });
      setChartSvg(null); 
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (currentPair && currentTimeframe) {
      loadChartData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPair, currentTimeframe, chartType]);

  const renderPairDisplay = () => {
    const displayLabel = `${currentPair} - ${currentTimeframe}`;
    if (botMonitoredPairs && botMonitoredPairs.length > 1) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="text-lg font-semibold px-1 py-0 h-auto justify-start hover:bg-accent/10 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 flex items-center"
              aria-label={`Currently displaying chart for ${currentPair} on ${currentTimeframe}. Click to switch to another monitored pair.`}
            >
              {displayLabel}
              <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {botMonitoredPairs.map(pair => (
              <DropdownMenuItem
                key={pair}
                onClick={() => onSelectChartPair(pair)}
                disabled={pair === currentPair}
              >
                {pair}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return (
      <h2 className="text-lg font-semibold" aria-label={`Displaying chart for ${currentPair} on ${currentTimeframe}.`}>
        {displayLabel}
      </h2>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          {renderPairDisplay()}
          <div className="flex space-x-2">
            <Button
              variant={chartType === 'line' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setChartType('line')}
              aria-label="Switch to Line Chart"
            >
              <LineChart />
            </Button>
            <Button
              variant={chartType === 'candlestick' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setChartType('candlestick')}
              aria-label="Switch to Candlestick Chart"
            >
              <BarChart3 />
            </Button>
            <Button
              variant={activeTool === 'ruler' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setActiveTool(activeTool === 'ruler' ? null : 'ruler')}
              aria-label="Toggle Measurement Tools"
            >
              <DraftingCompass />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] bg-muted/30 dark:bg-muted/50 rounded-md relative flex items-center justify-center p-2 sm:p-4">
          {isLoading && <Skeleton className="absolute inset-0" />}
          
          {!isLoading && imageError && (
             <div className="text-center text-destructive">
                <BarChart3 size={40} className="mx-auto mb-2" />
                <p className="font-semibold">Error Loading Chart</p>
                <p className="text-xs max-w-sm mx-auto">{imageError}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={loadChartData}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
          )}

          {!isLoading && !imageError && chartSvg && (
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: chartSvg }}
              />
          )}

           {(isLoading || imageError) && (
             <div className={cn(
                "absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none -z-10",
                isLoading ? "opacity-50" : "opacity-100"
             )}>
                <div className="text-center bg-background/70 p-2 rounded">
                <LineChart size={40} className="mx-auto mb-2" />
                <p>Live Price Chart Area</p>
                <p className="text-sm">({isLoading ? "Loading chart..." : "Waiting for data..."})</p>
                </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4 items-center mt-4 text-sm">
          {!priceData || isLoading ? (
            <>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </>
          ) : (
            <>
              <div className="text-center"><span className="font-medium text-muted-foreground">Bid:</span> {priceData.bid}</div>
              <div className="text-center"><span className="font-medium text-muted-foreground">Ask:</span> {priceData.ask}</div>
              <div className="text-center"><span className="font-medium text-muted-foreground">Spread:</span> {priceData.spread}</div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
