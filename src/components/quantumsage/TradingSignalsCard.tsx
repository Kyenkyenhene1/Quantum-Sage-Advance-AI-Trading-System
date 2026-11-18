
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, ArrowUp, ArrowDown, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription as UIDialogAlertDescription } from '@/components/ui/alert'; // Renamed AlertDescription to avoid conflict
import { explainTradingSignal } from '@/ai/flows/explain-trading-signal';
import type { ExplainTradingSignalInput, ExplainTradingSignalOutput } from '@/ai/types';
import { useToast } from '@/hooks/use-toast';

interface Signal {
  id: string;
  type: 'Buy' | 'Sell';
  asset: string;
  price: string;
  reason: string; 
  timestamp: string;
  aiInput: ExplainTradingSignalInput;
}

const mockSignals: Signal[] = [
  { 
    id: '1', type: 'Buy', asset: 'EURUSD', price: '1.12345', reason: 'ML Confidence: 84%', timestamp: '2 mins ago',
    aiInput: { signalType: 'Buy', asset: 'EURUSD', reason: 'Strong bullish momentum detected by ML model with high confidence.', confidence: 84, additionalContext: 'Price broke above key resistance level.' }
  },
  { 
    id: '2', type: 'Sell', asset: 'GBPUSD', price: '1.30872', reason: 'Order Block Confirmed', timestamp: '15 mins ago',
    aiInput: { signalType: 'Sell', asset: 'GBPUSD', reason: 'Confirmation of a bearish order block on H1 timeframe.', additionalContext: 'Coupled with bearish divergence on RSI.' }
  },
  { 
    id: '3', type: 'Buy', asset: 'XAUUSD', price: '1956.42', reason: 'FVG + RSI Divergence', timestamp: '1 hour ago',
    aiInput: { signalType: 'Buy', asset: 'XAUUSD', reason: 'Price entered a Fair Value Gap (FVG) with bullish RSI divergence.', additionalContext: 'Volume supporting the bullish move.' }
  },
];

export function TradingSignalsCard() {
  const [signals, setSignals] = useState<Signal[]>(mockSignals);
  const [explanation, setExplanation] = useState<ExplainTradingSignalOutput | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExplainSignal = async (signalInput: ExplainTradingSignalInput) => {
    setIsLoadingExplanation(true);
    setExplanation(null); // Clear previous explanation
    setExplanationError(null); // Clear previous error
    try {
      const result = await explainTradingSignal(signalInput);
      setExplanation(result);
    } catch (error) {
      console.error("Error explaining signal:", error);
      const errorMessage = "Could not retrieve explanation for the signal. Please try again.";
      setExplanationError(errorMessage);
      toast({ // Toast the error for general feedback
        variant: "destructive",
        title: "AI Explanation Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Bell className="mr-2 text-primary" />
          Trading Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map(signal => (
          <div 
            key={signal.id}
            className={`p-3 rounded-lg border-l-4 ${
              signal.type === 'Buy' ? 'bg-profit/10 border-profit' : 'bg-loss/10 border-loss'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white mr-3 shrink-0 ${
                  signal.type === 'Buy' ? 'bg-profit' : 'bg-loss'
                }`}>
                  {signal.type === 'Buy' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
                </div>
                <div>
                  <div className="font-medium">{signal.type} Signal</div>
                  <div className="text-xs text-muted-foreground">{signal.reason}</div>
                </div>
              </div>
              <div className="text-right ml-2">
                <div className="text-sm font-semibold">{signal.asset} @ {signal.price}</div>
                <div className="text-xs text-muted-foreground">{signal.timestamp}</div>
              </div>
            </div>
            <Dialog onOpenChange={(open) => { if (!open) { setExplanation(null); setExplanationError(null); }}}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2 text-xs text-primary hover:text-primary/80"
                  onClick={() => handleExplainSignal(signal.aiInput)}
                >
                  <Sparkles /> Explain with AI
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>AI Explanation for {signal.asset} {signal.type} Signal</DialogTitle>
                </DialogHeader>
                {isLoadingExplanation && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Generating explanation...</span>
                  </div>
                )}
                {explanationError && !isLoadingExplanation && (
                   <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <UIDialogAlertDescription>{explanationError}</UIDialogAlertDescription>
                  </Alert>
                )}
                {explanation && !isLoadingExplanation && !explanationError && (
                  <DialogDescription className="mt-2 text-sm whitespace-pre-wrap">
                    {explanation.explanation}
                  </DialogDescription>
                )}
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
