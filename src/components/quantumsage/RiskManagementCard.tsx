
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Shield, Save, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription as UIDialogAlertDescription } from '@/components/ui/alert';
import { assessRiskSettings } from '@/ai/flows/assess-risk-settings';
import type { AssessRiskSettingsInput, AssessRiskSettingsOutput } from '@/ai/types';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { proposeOrder } from '@/lib/trade'

const stopLossTypes = [
  "ATR Based (e.g., 2x ATR14)", 
  "Structure Based (Support/Resistance)", 
  "Fixed Pips (e.g., 30 pips)",
  "Moving Average (e.g., 20 EMA)",
  "Percentage of Balance (e.g., 1%)",
  "Previous Candle High/Low (e.g., H1)",
  "Time-Based (e.g., End of Session)"
];
const takeProfitRatios = [
  "1:1", "1:1.5", "1:2", "1:2.5", "1:3", "1:4", "1:5",
  "1:10", "1:20", "1:50", "1:100", "1:200", "1:300", "1:400", "1:500", "1:1000",
  "Trailing TP", "Dynamic (ML)"
];

interface RiskSettings {
  riskPerTrade: number;
  maxDailyTrades: number;
  stopLossType: string;
  takeProfitRatio: string;
  dynamicStopLoss: boolean;
}

// --- API Placeholder Functions ---
async function fetchRiskSettingsAPI(): Promise<RiskSettings> {
  console.log("API_CALL_PLACEHOLDER: Fetching risk settings.");
  await new Promise(resolve => setTimeout(resolve, 400)); 
  return {
    riskPerTrade: 2,
    maxDailyTrades: 10,
    stopLossType: "Structure Based (Support/Resistance)",
    takeProfitRatio: "1:2",
    dynamicStopLoss: true,
  };
}

async function saveRiskSettingsAPI(settings: RiskSettings): Promise<{success: boolean, message: string}> {
  console.log("API_CALL_PLACEHOLDER: Saving risk settings:", settings);
  await new Promise(resolve => setTimeout(resolve, 700)); 
  return { success: true, message: "Risk settings saved successfully." };
}

// This is now a simplified placeholder for the dynamic SL type switching effect
async function getNextDynamicStopLossType(currentType: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500)); // random delay
    const currentIndex = stopLossTypes.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % stopLossTypes.length;
    return stopLossTypes[nextIndex];
}
// --- End API Placeholder Functions ---


export function RiskManagementCard() {
  const [riskPerTrade, setRiskPerTrade] = useState([2]);
  const [maxDailyTrades, setMaxDailyTrades] = useState(10);
  const [stopLossType, setStopLossType] = useState("Structure Based (Support/Resistance)");
  const [takeProfitRatio, setTakeProfitRatio] = useState("1:2");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [isDynamicStopLoss, setIsDynamicStopLoss] = useState(true);
  const [dynamicSlDisplay, setDynamicSlDisplay] = useState<string>("Detecting...");

  // State for AI Assessment Dialog
  const [aiAssessment, setAiAssessment] = useState<AssessRiskSettingsOutput | null>(null);
  const [isLoadingAiAssessment, setIsLoadingAiAssessment] = useState(false);
  const [aiAssessmentError, setAiAssessmentError] = useState<string | null>(null);
  // Simulation state
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Simulation input defaults
  const [simPair, setSimPair] = useState('EURUSD');
  const [simDirection, setSimDirection] = useState<'Buy' | 'Sell'>('Buy');
  const [simEntryPrice, setSimEntryPrice] = useState<number>(1.1000);
  const [simStopLossPips, setSimStopLossPips] = useState<number>(50);
  const [simPipValuePerLot, setSimPipValuePerLot] = useState<number>(10);
  const [simConfidence, setSimConfidence] = useState<number>(85);
  const [simThreshold, setSimThreshold] = useState<number>(80);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const settings = await fetchRiskSettingsAPI();
        setRiskPerTrade([settings.riskPerTrade]);
        setMaxDailyTrades(settings.maxDailyTrades);
        setStopLossType(settings.stopLossType);
        setTakeProfitRatio(settings.takeProfitRatio);
        setIsDynamicStopLoss(settings.dynamicStopLoss);
      } catch (error) {
        console.error("Failed to load risk settings:", error);
        toast({ variant: "destructive", title: "Loading Error", description: "Could not fetch risk settings." });
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [toast]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isDynamicStopLoss && !isLoading) {
      const cycleSlTypes = async () => {
        setDynamicSlDisplay(prev => getNextDynamicStopLossType(prev).then(newType => {
          setDynamicSlDisplay(newType);
          return newType;
        }).catch(() => "Error") as any);
      };
      
      // Initial fetch
      getNextDynamicStopLossType(stopLossType).then(setDynamicSlDisplay);
      
      // Start cycling
      intervalId = setInterval(cycleSlTypes, 3000); // Cycle every 3 seconds
    } else {
      setDynamicSlDisplay("Disabled");
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isDynamicStopLoss, isLoading, stopLossType]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const currentSettings: RiskSettings = {
      riskPerTrade: riskPerTrade[0],
      maxDailyTrades,
      stopLossType,
      takeProfitRatio,
      dynamicStopLoss: isDynamicStopLoss,
    };
    try {
        const result = await saveRiskSettingsAPI(currentSettings);
        if (result.success) {
          toast({ title: "Settings Saved", description: result.message });
        } else {
          toast({ variant: "destructive", title: "Save Failed", description: result.message });
        }
    } catch (error) {
        console.error("Error saving risk settings:", error);
        toast({ variant: "destructive", title: "Save Error", description: "Could not save risk settings." });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAssessRisk = async () => {
    setIsLoadingAiAssessment(true);
    setAiAssessment(null);
    setAiAssessmentError(null);

    const currentSettings: AssessRiskSettingsInput = {
      riskPerTrade: riskPerTrade[0],
      maxDailyTrades,
      stopLossType: isDynamicStopLoss ? `Dynamic (${dynamicSlDisplay})` : stopLossType,
      takeProfitRatio,
      currentMarketVolatility: 'Medium', // Example value
    };

    try {
      const result = await assessRiskSettings(currentSettings);
      setAiAssessment(result);
    } catch (error) {
      console.error("Error assessing risk settings:", error);
      const errorMessage = "Could not retrieve AI risk assessment. Please try again.";
      setAiAssessmentError(errorMessage);
    } finally {
      setIsLoadingAiAssessment(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Shield className="mr-2 text-primary" />
          Risk Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3 mb-2" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-3 w-full mt-1" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
             <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-6 w-12" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full mt-4" />
            <Skeleton className="h-10 w-full mt-2" />
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="risk-per-trade" className="block mb-2 text-sm font-medium">Risk per Trade ({riskPerTrade[0]}%)</Label>
              <Slider
                id="risk-per-trade"
                min={0.5}
                max={5}
                step={0.5}
                value={riskPerTrade}
                onValueChange={setRiskPerTrade}
                className="w-full"
                disabled={isSaving}
                aria-label={`Risk per trade, current value ${riskPerTrade[0]} percent`}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0.5%</span>
                <span>5%</span>
              </div>
            </div>
            
            <div>
              <Label htmlFor="max-daily-trades" className="block mb-2 text-sm font-medium">Max Daily Trades</Label>
              <Input
                id="max-daily-trades"
                type="number"
                min="1"
                max="50"
                value={maxDailyTrades}
                onChange={(e) => setMaxDailyTrades(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full"
                disabled={isSaving}
              />
            </div>
             <div className="flex items-center justify-between">
                <Label htmlFor="dynamic-sl-switch" className="text-sm font-medium cursor-pointer">Dynamic Stop Loss</Label>
                <Switch
                    id="dynamic-sl-switch"
                    checked={isDynamicStopLoss}
                    onCheckedChange={setIsDynamicStopLoss}
                    disabled={isSaving}
                    aria-label="Toggle dynamic stop loss"
                />
            </div>
            
            <div>
              <Label htmlFor="stop-loss-type" className="block mb-2 text-sm font-medium">Stop Loss Type</Label>
              <div className={cn(!isDynamicStopLoss ? "block" : "hidden")}>
                <Select value={stopLossType} onValueChange={setStopLossType} disabled={isSaving || isDynamicStopLoss}>
                    <SelectTrigger id="stop-loss-type">
                    <SelectValue placeholder="Select SL type" />
                    </SelectTrigger>
                    <SelectContent>
                    {stopLossTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
              </div>
              <div className={cn("text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border transition-all duration-300", isDynamicStopLoss ? "block" : "hidden")}>
                  <span className="font-semibold text-foreground">Auto-Selected:</span> 
                  <span className="inline-flex items-center ml-2">
                    {dynamicSlDisplay === "Detecting..." ? <Loader2 className="inline-block h-4 w-4 animate-spin mr-2" /> : null}
                    {dynamicSlDisplay}
                  </span>
              </div>
            </div>
            
            <div>
              <Label htmlFor="take-profit-ratio" className="block mb-2 text-sm font-medium">Take Profit Ratio</Label>
              <Select value={takeProfitRatio} onValueChange={setTakeProfitRatio} disabled={isSaving}>
                <SelectTrigger id="take-profit-ratio">
                  <SelectValue placeholder="Select TP ratio" />
                </SelectTrigger>
                <SelectContent>
                  {takeProfitRatios.map(ratio => (
                    <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button onClick={handleSaveSettings} className="w-full" disabled={isSaving || isLoading}>
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="secondary" className="w-full" disabled={isSaving || isLoading}>
                            Simulate Order
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                        <DialogTitle>Simulate Order & Sizing</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input value={simPair} onChange={e => setSimPair(e.target.value)} aria-label="Pair" />
                            <Select value={simDirection} onValueChange={(v: any) => setSimDirection(v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Buy">Buy</SelectItem>
                                <SelectItem value="Sell">Sell</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input type="number" value={simEntryPrice} onChange={e => setSimEntryPrice(parseFloat(e.target.value || '0'))} />
                            <Input type="number" value={simStopLossPips} onChange={e => setSimStopLossPips(parseInt(e.target.value || '0'))} />
                            <Input type="number" value={simPipValuePerLot} onChange={e => setSimPipValuePerLot(parseFloat(e.target.value || '0'))} />
                            <Input type="number" value={riskPerTrade[0]} onChange={e => setRiskPerTrade([parseFloat(e.target.value || '0')])} />
                          </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input type="number" value={simConfidence} onChange={e => setSimConfidence(parseInt(e.target.value || '0'))} aria-label="Confidence" />
                              <Input type="number" value={simThreshold} onChange={e => setSimThreshold(parseInt(e.target.value || '0'))} aria-label="Threshold" />
                              <div className="self-center text-xs text-muted-foreground">
                                Live execution is handled by a trusted server-side EA.
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={async () => {
                                    setSimLoading(true); setSimError(null); setSimResult(null);
                                    try {
                                      const req = {
                                        pair: simPair,
                                        direction: simDirection,
                                        entryPrice: simEntryPrice,
                                        accountBalance: 10000,
                                        stopLossPips: simStopLossPips,
                                        pipValuePerLot: simPipValuePerLot,
                                        confidence: simConfidence,
                                        confidenceThreshold: simThreshold,
                                        autoExecute: false,
                                        layerConfig: { layers: 5, spacingPips: 25 },
                                      }
                                      const r = await fetch('/api/signal-execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
                                      const body = await r.json()
                                      setSimResult(body)
                                    } catch (err: any) {
                                      setSimError(String(err?.message || err))
                                    } finally { setSimLoading(false) }
                                  }}
                                  disabled={simLoading}
                                >
                                  {simLoading ? 'Simulating...' : 'Run Simulation'}
                                </Button>
                                <Button variant="ghost" onClick={() => { setSimResult(null); setSimError(null) }}>Reset</Button>
                              </div>
                            </div>

                          <div>
                            {simLoading && <div className="text-sm">Running simulation...</div>}
                            {simError && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><UIDialogAlertDescription>{simError}</UIDialogAlertDescription></Alert>}
                            {simResult && (
                              <div className="mt-2 space-y-2 text-sm">
                                <div><strong>Pair:</strong> {simResult.pair} ({simResult.direction})</div>
                                <div><strong>Base Lots:</strong> {simResult.baseLots}</div>
                                <div><strong>Total Lots:</strong> {simResult.totalLots}</div>
                                <div><strong>Total Risk:</strong> ${simResult.totalRisk}</div>
                                <div className="mt-2">
                                  <p className="font-semibold">Layers</p>
                                  <ul className="list-disc pl-5">
                                    {simResult.layers.map((l: any) => (
                                      <li key={l.index}>Layer {l.index}: {l.lots} lots, risk ${l.riskAmount}, offset {l.priceOffsetPips} pips</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="mt-2">
                                  <p className="font-semibold">Signal</p>
                                  <div>Confidence: {simResult.confidence}%</div>
                                  <div className="mt-3 text-xs text-muted-foreground">
                                    This dashboard only calculates proposals. Submit live orders from a trusted server-side EA using the configured execution key.
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={handleAssessRisk}
                        disabled={isSaving || isLoading}
                        >
                        <Sparkles /> Assess with AI
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                        <DialogTitle>AI Risk Assessment</DialogTitle>
                        </DialogHeader>
                        {isLoadingAiAssessment && (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="ml-2">Generating assessment...</span>
                        </div>
                        )}
                        {aiAssessmentError && !isLoadingAiAssessment && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <UIDialogAlertDescription>{aiAssessmentError}</UIDialogAlertDescription>
                        </Alert>
                        )}
                        {aiAssessment && !isLoadingAiAssessment && !aiAssessmentError && (
                        <DialogDescription asChild>
                            <div className="mt-2 space-y-3 text-sm">
                            <div>
                                <p className="font-semibold">Assessment:</p>
                                <p>{aiAssessment.assessment}</p>
                            </div>
                            {aiAssessment.suggestions && aiAssessment.suggestions.length > 0 && (
                                <div>
                                <p className="font-semibold mt-3">Suggestions:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    {aiAssessment.suggestions.map((suggestion, index) => (
                                    <li key={index}>{suggestion}</li>
                                    ))}
                                </ul>
                                </div>
                            )}
                            </div>
                        </DialogDescription>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
