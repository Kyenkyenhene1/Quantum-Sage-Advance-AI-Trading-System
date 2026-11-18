
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Newspaper, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription as UIDialogAlertDescription } from '@/components/ui/alert';
import { analyzeTradingNews } from '@/ai/flows/analyze-trading-news';
import type { AnalyzeTradingNewsInput, AnalyzeTradingNewsOutput } from '@/ai/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface NewsEvent {
  id: string;
  title: string;
  time: string;
  impact: 'Critical' | 'High' | 'Medium';
  details: string;
  aiInput: AnalyzeTradingNewsInput;
}

const mockNewsEvents: NewsEvent[] = [
  {
    id: '1', title: 'US NFP Data', time: 'Today, 12:30 UTC', impact: 'Critical', details: 'Expected impact on USD pairs',
    aiInput: { newsHeadline: 'US Non-Farm Payroll Data Release', newsContent: 'The US Bureau of Labor Statistics is set to release Non-Farm Payroll data, a key indicator of economic health. Expectations are for 180K new jobs.', currentPositions: 'EURUSD Buy 0.5 lots, USDJPY Sell 0.2 lots' }
  },
  {
    id: '2', title: 'ECB Rate Decision', time: 'Tomorrow, 12:45 UTC', impact: 'High', details: 'Potential EUR volatility',
    aiInput: { newsHeadline: 'European Central Bank Interest Rate Decision', newsContent: 'The ECB will announce its latest monetary policy decisions, including interest rates and forward guidance. Market anticipates a hawkish stance.', currentPositions: 'EURGBP Buy 1.0 lot' }
  },
  {
    id: '3', title: 'UK CPI Data', time: 'Jul 18, 08:00 UTC', impact: 'Medium', details: 'GBP pairs may be affected',
    aiInput: { newsHeadline: 'UK Consumer Price Index Data', newsContent: 'The Office for National Statistics will release the latest inflation figures for the UK. CPI is expected to show a slight decrease.', currentPositions: 'GBPUSD Sell 0.3 lots' }
  },
];

export function NewsEventsCard() {
  const [analysis, setAnalysis] = useState<AnalyzeTradingNewsOutput | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalyzeNews = async (newsInput: AnalyzeTradingNewsInput) => {
    setIsLoadingAnalysis(true);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const result = await analyzeTradingNews(newsInput);
      setAnalysis(result);
    } catch (error) {
      console.error("Error analyzing news:", error);
      const errorMessage = "Could not retrieve analysis for the news event. Please try again.";
      setAnalysisError(errorMessage);
      toast({
        variant: "destructive",
        title: "AI Analysis Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const getImpactBadgeVariant = (impact: NewsEvent['impact']): "destructive" | "default" | "secondary" => {
    switch (impact) {
      case 'Critical': return 'destructive';
      case 'High': return 'default'; 
      case 'Medium': return 'secondary';
      default: return 'secondary';
    }
  };

  const getImpactContainerStyles = (impact: NewsEvent['impact']): string => {
    switch (impact) {
      case 'Critical': return 'border-l-destructive bg-destructive/10'; 
      case 'High': return 'border-l-primary bg-primary/10';
      case 'Medium': return 'border-l-blue-500 bg-blue-500/10';
      default: return 'border-l-gray-500 bg-gray-500/10';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Newspaper className="mr-2 text-primary" />
          News & Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mockNewsEvents.map(event => (
          <div key={event.id} className={cn('p-3 rounded-lg border-l-4', getImpactContainerStyles(event.impact))}>
            <div className="flex justify-between items-start">
              <div className="font-medium">{event.title}</div>
              <Badge
                variant={getImpactBadgeVariant(event.impact)}
              >
                {event.impact}
              </Badge>
            </div>
            <div className="text-sm mt-1 text-muted-foreground">{event.time}</div>
            <div className="text-xs text-muted-foreground/80 mt-1">{event.details}</div>
            <Dialog onOpenChange={(open) => { if (!open) { setAnalysis(null); setAnalysisError(null); }}}>
              <DialogTrigger asChild>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 p-0 h-auto text-xs text-primary hover:text-primary/80"
                  onClick={() => handleAnalyzeNews(event.aiInput)}
                >
                  <Sparkles /> Analyze with AI
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>AI Analysis: {event.title}</DialogTitle>
                </DialogHeader>
                {isLoadingAnalysis && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Generating analysis...</span>
                  </div>
                )}
                {analysisError && !isLoadingAnalysis && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <UIDialogAlertDescription>{analysisError}</UIDialogAlertDescription>
                  </Alert>
                )}
                {analysis && !isLoadingAnalysis && !analysisError && (
                  <div className="mt-2 space-y-2 text-sm">
                    <p><strong>Summary:</strong> {analysis.summary}</p>
                    <p><strong>Potential Impact:</strong> {analysis.potentialImpact}</p>
                    <p><strong>Affected Pairs:</strong> {analysis.affectedPairs}</p>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
