
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel as ShadDropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings, Brain, Castle, Play, Square, Loader2, AlertTriangle, ChevronDown, Layers } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


interface TradingPair {
  value: string;
  label: string;
}

interface TradingPairCategory {
  label: string;
  pairs: TradingPair[];
}

const categorizedTradingPairs: TradingPairCategory[] = [
  {
    label: "Forex Majors",
    pairs: [
      { value: "EURUSD", label: "EUR/USD" }, { value: "GBPUSD", label: "GBP/USD" },
      { value: "USDJPY", label: "USD/JPY" }, { value: "USDCHF", label: "USD/CHF" },
      { value: "AUDUSD", label: "AUD/USD" }, { value: "USDCAD", label: "USD/CAD" },
      { value: "NZDUSD", label: "NZD/USD" },
    ]
  },
  {
    label: "Forex Minors",
    pairs: [
      { value: "EURGBP", label: "EUR/GBP" }, { value: "EURAUD", label: "EUR/AUD" },
      { value: "EURJPY", label: "EUR/JPY" }, { value: "GBPJPY", label: "GBP/JPY" },
      { value: "AUDJPY", label: "AUD/JPY" }, { value: "CADJPY", label: "CAD/JPY" },
    ]
  },
  {
    label: "Metals",
    pairs: [
      { value: "XAUUSD", label: "Gold (XAU/USD)" }, { value: "XAGUSD", label: "Silver (XAG/USD)" },
    ]
  },
  {
    label: "Indices",
    pairs: [
      { value: "US30", label: "Dow Jones 30 (US30)" }, { value: "NAS100", label: "Nasdaq 100 (NAS100)" },
    ]
  },
  {
    label: "Cryptocurrencies",
    pairs: [
      { value: "BTCUSD", label: "Bitcoin (BTC/USD)" }, { value: "ETHUSD", label: "Ethereum (ETH/USD)" },
    ]
  }
];

const timeframes = ["M1", "M5", "M15", "H1", "H4", "D1", "W1", "MN1"];
const MAX_SELECTED_PAIRS = 20;

interface StrategyControlCardProps {
  selectedPairs: string[];
  onSelectedPairsChange: (pairs: string[]) => void;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  isGloballyLiveTrading: boolean;
  isGloballyDemoTrading: boolean;
}

type OperationMode = 'ml' | 'royal' | 'nexus';
type BotStatus = 'stopped' | 'running' | 'error' | 'starting' | 'stopping';

interface BotControlResponse {
  success: boolean;
  message: string;
  botStatus?: BotStatus;
}

// --- API Placeholder Functions ---
async function startBotAPI(config: { operationModes: OperationMode[]; pairs: string[]; timeframe: string; newsFilter: boolean; volumeSpike: boolean }): Promise<BotControlResponse> {
  console.log("API_CALL_PLACEHOLDER: Starting bot with config:", config);
  await new Promise(resolve => setTimeout(resolve, 1500)); 

  if (config.pairs.length === 0) return { success: false, message: "Cannot start bot: No trading pairs selected.", botStatus: 'error' };
  if (config.operationModes.length === 0) return { success: false, message: "Cannot start bot: No operation mode selected.", botStatus: 'error' };

  if (Math.random() > 0.2) { 
    return { success: true, message: `Bot started on ${config.pairs.length} pairs using ${config.operationModes.join(' + ')} mode.`, botStatus: 'running' };
  } else {
    return { success: false, message: `Failed to start bot. Check system logs.`, botStatus: 'error' };
  }
}

async function stopBotAPI(): Promise<BotControlResponse> {
  console.log("API_CALL_PLACEHOLDER: Stopping bot.");
  await new Promise(resolve => setTimeout(resolve, 1000)); 
  return { success: true, message: `Bot stopped successfully.`, botStatus: 'stopped' };
}
// --- End API Placeholder Functions ---


export function StrategyControlCard({
  selectedPairs,
  onSelectedPairsChange,
  selectedTimeframe,
  onTimeframeChange,
  isGloballyLiveTrading,
  isGloballyDemoTrading,
}: StrategyControlCardProps) {
  const [mlEnabled, setMlEnabled] = useState(true);
  const [royalEnabled, setRoyalEnabled] = useState(false);
  const [nexusEnabled, setNexusEnabled] = useState(false);
  const [newsFilterEnabled, setNewsFilterEnabled] = useState(true);
  const [volumeSpikeDetection, setVolumeSpikeDetection] = useState(false);
  const [botRunningStatus, setBotRunningStatus] = useState<BotStatus>('stopped');
  const { toast } = useToast();

  const isOverallTradingActive = isGloballyLiveTrading || isGloballyDemoTrading;

  useEffect(() => {
    if (!isOverallTradingActive && botRunningStatus === 'running') {
      setBotRunningStatus('stopped');
      toast({ title: "Bot Control", description: `Strategy bot stopped due to global trading halt.` });
    }
  }, [isOverallTradingActive, botRunningStatus, toast]);


  const handleStartBot = async () => {
    const operationModes: OperationMode[] = [];
    if (mlEnabled) operationModes.push('ml');
    if (royalEnabled) operationModes.push('royal');
    if (nexusEnabled) operationModes.push('nexus');

    if (operationModes.length === 0) {
      toast({ variant: "destructive", title: "Bot Control Error", description: "Please select at least one operation mode." });
      return;
    }
    
    if (!isOverallTradingActive) {
      toast({ variant: "destructive", title: "Bot Control Error", description: "Global trading (Live/Demo) must be active to start the bot." });
      return;
    }
    if (selectedPairs.length === 0) {
      toast({ variant: "destructive", title: "Bot Control Error", description: "Please select at least one trading pair." });
      return;
    }

    setBotRunningStatus('starting');
    const response = await startBotAPI({
      operationModes,
      pairs: selectedPairs,
      timeframe: selectedTimeframe,
      newsFilter: newsFilterEnabled,
      volumeSpike: volumeSpikeDetection,
    });
    setBotRunningStatus(response.botStatus || 'error');
    toast({
      title: response.success ? "Bot Started" : "Bot Error",
      description: response.message,
      variant: response.success ? "default" : "destructive",
    });
  };

  const handleStopBot = async () => {
    setBotRunningStatus('stopping');
    const response = await stopBotAPI(); 
    setBotRunningStatus(response.botStatus || 'error');
    toast({
        title: response.success ? "Bot Stopped" : "Bot Error",
        description: response.message,
        variant: response.success ? "default" : "destructive",
    });
  };

  const handlePairSelection = (pairValue: string) => {
    onSelectedPairsChange(
        selectedPairs.includes(pairValue)
        ? selectedPairs.filter(p => p !== pairValue)
        : selectedPairs.length < MAX_SELECTED_PAIRS
            ? [...selectedPairs, pairValue]
            : selectedPairs
    );
    if (selectedPairs.length >= MAX_SELECTED_PAIRS && !selectedPairs.includes(pairValue)) {
        toast({
            variant: "destructive",
            title: "Pair Limit Reached",
            description: `You can select a maximum of ${MAX_SELECTED_PAIRS} pairs.`,
        });
    }
  };
  
  const handleSelectCategory = (category: TradingPairCategory) => {
    const categoryValues = category.pairs.map(p => p.value);
    const allSelected = categoryValues.every(v => selectedPairs.includes(v));
    
    let newSelectedPairs = [...selectedPairs];
    if (allSelected) {
      newSelectedPairs = newSelectedPairs.filter(p => !categoryValues.includes(p));
    } else {
      const toAdd = categoryValues.filter(v => !newSelectedPairs.includes(v));
      if (newSelectedPairs.length + toAdd.length > MAX_SELECTED_PAIRS) {
         toast({ variant: "destructive", title: "Pair Limit Reached", description: `Cannot select all ${category.label}.` });
         return;
      }
      newSelectedPairs.push(...toAdd);
    }
    onSelectedPairsChange([...new Set(newSelectedPairs)]);
  };

  const getSelectedPairsText = () => {
    if (selectedPairs.length === 0) return "Select Pairs...";
    if (selectedPairs.length === 1) return categorizedTradingPairs.flatMap(cat => cat.pairs).find(p => p.value === selectedPairs[0])?.label || selectedPairs[0];
    return `${selectedPairs.length} Pairs Selected`;
  };

  const isBotBusy = botRunningStatus === 'starting' || botRunningStatus === 'stopping';
  const controlsDisabled = isBotBusy || botRunningStatus === 'running';
  
  const getStatusIndicator = () => {
    let text = "Status: Stopped", colorClass = "text-muted-foreground", dotColorClass = "bg-gray-400", Icon = null;
    switch (botRunningStatus) {
      case 'running':
        text = `Status: Running on ${selectedPairs.length} pairs`; colorClass = "text-profit"; dotColorClass = "bg-profit"; break;
      case 'starting':
        text = `Status: Starting...`; colorClass = "text-yellow-500"; dotColorClass = "bg-yellow-500 animate-pulse"; Icon = <Loader2 className="inline-block animate-spin mr-1 h-3 w-3" />; break;
      case 'stopping':
         text = `Status: Stopping...`; colorClass = "text-yellow-500"; dotColorClass = "bg-yellow-500 animate-pulse"; Icon = <Loader2 className="inline-block animate-spin mr-1 h-3 w-3" />; break;
      case 'error':
        text = `Status: Error`; colorClass = "text-loss"; dotColorClass = "bg-loss"; Icon = <AlertTriangle className="inline-block mr-1 h-3 w-3" />; break;
    }
    return (
        <div className="flex items-center justify-center text-xs mt-2">
            <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${dotColorClass}`}></div>
            <span className={colorClass}>{Icon}{text}</span>
        </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Settings className="mr-2 text-primary" />
          Strategy Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="block text-sm font-medium mb-2">Operation Mode</Label>
           <div className="grid grid-cols-1 gap-2 border rounded-lg p-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn("rounded-md p-2 flex items-center space-x-2 cursor-pointer", controlsDisabled && "cursor-not-allowed opacity-50")} onClick={() => !controlsDisabled && setMlEnabled(!mlEnabled)}>
                    <Checkbox id="opmode-ml" checked={mlEnabled} disabled={controlsDisabled} />
                    <Label htmlFor="opmode-ml" className={cn("flex items-center gap-2", controlsDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                      <Brain /> ML Core
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>Use machine learning models for trade signals.</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn("rounded-md p-2 flex items-center space-x-2 cursor-pointer", controlsDisabled && "cursor-not-allowed opacity-50")} onClick={() => !controlsDisabled && setRoyalEnabled(!royalEnabled)}>
                    <Checkbox id="opmode-royal" checked={royalEnabled} disabled={controlsDisabled} />
                    <Label htmlFor="opmode-royal" className={cn("flex items-center gap-2", controlsDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                      <Castle /> Royal Structure
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>Use market structure and order blocks for signals.</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn("rounded-md p-2 flex items-center space-x-2 cursor-pointer", controlsDisabled && "cursor-not-allowed opacity-50")} onClick={() => !controlsDisabled && setNexusEnabled(!nexusEnabled)}>
                    <Checkbox id="opmode-nexus" checked={nexusEnabled} disabled={controlsDisabled} />
                    <Label htmlFor="opmode-nexus" className={cn("flex items-center gap-2", controlsDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                      <Layers /> Kyenkyenhene Hybrid
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>A hybrid strategy combining order blocks, fair value gaps, liquidity, and market structure shifts.</p></TooltipContent>
              </Tooltip>
          </div>
        </div>

        <div>
          <Label htmlFor="trading-pairs-trigger" className="block text-sm font-medium mb-2">Trading Pairs (Max {MAX_SELECTED_PAIRS})</Label>
          <Tooltip>
            <TooltipTrigger asChild>
                <span tabIndex={controlsDisabled ? 0 : -1}>
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={controlsDisabled}>
                        <Button variant="outline" id="trading-pairs-trigger" className="w-full justify-between data-[disabled]:opacity-50">
                        <span className="truncate pr-2">{getSelectedPairsText()}</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-80 overflow-y-auto">
                        {categorizedTradingPairs.map((category, index) => (
                        <DropdownMenuGroup key={category.label}>
                            <div className="flex items-center justify-between sticky top-0 bg-popover z-10 px-2 py-1">
                                <ShadDropdownMenuLabel className="p-0">{category.label}</ShadDropdownMenuLabel>
                                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={(e) => { e.stopPropagation(); handleSelectCategory(category); }}>Select All</Button>
                            </div>
                            {category.pairs.map(pair => (
                            <DropdownMenuCheckboxItem
                                key={pair.value}
                                checked={selectedPairs.includes(pair.value)}
                                onCheckedChange={() => handlePairSelection(pair.value)}
                                onSelect={(e) => e.preventDefault()}
                                disabled={!selectedPairs.includes(pair.value) && selectedPairs.length >= MAX_SELECTED_PAIRS}
                            >
                                {pair.label}
                            </DropdownMenuCheckboxItem>
                            ))}
                            {index < categorizedTradingPairs.length - 1 && <DropdownMenuSeparator />}
                        </DropdownMenuGroup>
                        ))}
                    </DropdownMenuContent>
                    </DropdownMenu>
                </span>
            </TooltipTrigger>
            {controlsDisabled && <TooltipContent><p>Stop the bot to change settings.</p></TooltipContent>}
          </Tooltip>
        </div>

        <div>
          <Label htmlFor="timeframe" className="block text-sm font-medium mb-2">Timeframe</Label>
          <Tooltip>
            <TooltipTrigger asChild>
                <span tabIndex={controlsDisabled ? 0 : -1}>
                    <Select value={selectedTimeframe} onValueChange={onTimeframeChange} disabled={controlsDisabled}>
                        <SelectTrigger id="timeframe" className="data-[disabled]:opacity-50"><SelectValue placeholder="Select timeframe" /></SelectTrigger>
                        <SelectContent>{timeframes.map(tf => (<SelectItem key={tf} value={tf}>{tf}</SelectItem>))}</SelectContent>
                    </Select>
                </span>
            </TooltipTrigger>
            {controlsDisabled && <TooltipContent><p>Stop the bot to change settings.</p></TooltipContent>}
          </Tooltip>
        </div>

        <div className="space-y-3">
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2" tabIndex={controlsDisabled ? 0 : -1}>
                        <Checkbox id="news-filter" checked={newsFilterEnabled} onCheckedChange={(c) => setNewsFilterEnabled(Boolean(c))} disabled={controlsDisabled} aria-labelledby="news-filter-label" />
                        <Label htmlFor="news-filter" id="news-filter-label" className={cn("text-sm font-normal", controlsDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>Enable News Filter</Label>
                    </div>
                </TooltipTrigger>
                {controlsDisabled && <TooltipContent><p>Stop the bot to change settings.</p></TooltipContent>}
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2" tabIndex={controlsDisabled ? 0 : -1}>
                        <Checkbox id="volume-spike" checked={volumeSpikeDetection} onCheckedChange={(c) => setVolumeSpikeDetection(Boolean(c))} disabled={controlsDisabled} aria-labelledby="volume-spike-label" />
                        <Label htmlFor="volume-spike" id="volume-spike-label" className={cn("text-sm font-normal", controlsDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>Enable Volume Spike Detection</Label>
                    </div>
                </TooltipTrigger>
                {controlsDisabled && <TooltipContent><p>Stop the bot to change settings.</p></TooltipContent>}
            </Tooltip>
        </div>

        <div className="flex space-x-2">
          {botRunningStatus !== 'running' ? (
              <Button size="sm" className="flex-1" onClick={handleStartBot} disabled={isBotBusy || !isOverallTradingActive || selectedPairs.length === 0 || (!mlEnabled && !royalEnabled && !nexusEnabled)}>
                  {isBotBusy ? <Loader2 className="animate-spin" /> : <Play />}
                  {isBotBusy ? 'Starting...' : 'Start Bot'}
              </Button>
          ) : (
              <Button variant="destructive" size="sm" className="flex-1" onClick={handleStopBot} disabled={isBotBusy}>
                  {isBotBusy ? <Loader2 className="animate-spin" /> : <Square />}
                  {isBotBusy ? 'Stopping...' : 'Stop Bot'}
              </Button>
          )}
        </div>

        {getStatusIndicator()}

      </CardContent>
    </Card>
  );
}
