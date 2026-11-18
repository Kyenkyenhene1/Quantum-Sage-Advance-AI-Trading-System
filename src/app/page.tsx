
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/quantumsage/AppHeader';
import { StrategyControlCard } from '@/components/quantumsage/StrategyControlCard';
import { RiskManagementCard } from '@/components/quantumsage/RiskManagementCard';
import { MlModelStatusCard } from '@/components/quantumsage/MlModelStatusCard';
import { AccountDetailsCard } from '@/components/quantumsage/AccountDetailsCard';
import LazyChartDisplay from '@/components/quantumsage/LazyChartDisplay';
import LazyTechnicalIndicatorsCard from '@/components/quantumsage/LazyTechnicalIndicatorsCard';
import LazyTradingSignalsCard from '@/components/quantumsage/LazyTradingSignalsCard';
import LazyActiveTradesCard from '@/components/quantumsage/LazyActiveTradesCard';
import LazyNewsEventsCard from '@/components/quantumsage/LazyNewsEventsCard';
import LazySystemLogsCard from '@/components/quantumsage/LazySystemLogsCard';
import { format } from 'date-fns';

// --- Types ---
interface User {
  displayName: string;
  photoURL: string;
}

interface ActiveTrade {
  id: string;
  pair: string;
  type: 'Buy' | 'Sell';
  entryPrice: string;
  entryTime: Date;
  lotSize: number;
  pnlPercentage: number;
  pnlCurrency: number;
  stopLoss: string;
  takeProfit: string;
  progress: number;
  reason: string;
}

interface PnlSummary {
  todayPL: number;
  weekPL: number;
  winRate: string;
}

interface LogEntry {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: string;
}


// --- Initial Mock Data ---
const initialMockActiveTrades: ActiveTrade[] = [
  { id: '#12345', pair: 'EURUSD', type: 'Buy', entryPrice: '1.12345', entryTime: new Date(Date.now() - 1000 * 60 * 30), lotSize: 0.5, pnlPercentage: 1.2, pnlCurrency: 60.00, stopLoss: '1.12012', takeProfit: '1.12878', progress: 45, reason: 'ML Confidence: 84%' },
  { id: '#12346', pair: 'GBPUSD', type: 'Sell', entryPrice: '1.30872', entryTime: new Date(Date.now() - 1000 * 60 * 120), lotSize: 0.2, pnlPercentage: -0.8, pnlCurrency: -32.00, stopLoss: '1.31245', takeProfit: '1.30200', progress: 80, reason: 'Order Block Confirmed' },
  { id: '#12347', pair: 'XAUUSD', type: 'Buy', entryPrice: '1956.42', entryTime: new Date(Date.now() - 1000 * 60 * 60 * 3), lotSize: 0.1, pnlPercentage: 2.1, pnlCurrency: 210.00, stopLoss: '1942.00', takeProfit: '1978.50', progress: 65, reason: 'FVG + RSI Divergence' },
];

const initialPnlSummary: PnlSummary = {
  todayPL: 342.50,
  weekPL: -125.80,
  winRate: "72.4%",
};

const initialLogs: LogEntry[] = [
  { type: 'info', message: 'System check: All components nominal.', timestamp: format(new Date(), 'HH:mm:ss') },
  { type: 'warning', message: 'News filter activated (US NFP in 2 hours)', timestamp: format(new Date(Date.now() - 1000 * 5), 'HH:mm:ss') },
  { type: 'success', message: 'Trade opened: #12347 BUY 0.1L XAUUSD @ 1956.42', timestamp: format(new Date(Date.now() - 1000 * 12), 'HH:mm:ss') },
];

const potentialNewLogs = [
    { type: 'info', message: 'Scanning for new opportunities...' },
    { type: 'info', message: 'ML Model confidence low, holding position.' },
    { type: 'success', message: 'EURUSD SL moved to Breakeven.' },
    { type: 'warning', message: 'High market volatility detected for JPY pairs.' },
    { type: 'error', message: 'Failed to fetch latest price data for NAS100.' },
    { type: 'info', message: 'Royal Structure: Bearish MSS confirmed on H4.' },
    { type: 'info', message: 'Kyenkyenhene Hybrid: Liquidity sweep detected on BTCUSD.' },
];


export default function QuantumSagePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuthState, setLoadingAuthState] = useState(true);

  // --- Dashboard State ---
  const [activeChartPair, setActiveChartPair] = useState('EURUSD');
  const [botSelectedPairs, setBotSelectedPairs] = useState<string[]>(['EURUSD']);
  const [activeTimeframe, setActiveTimeframe] = useState('D1');

  // --- Global Trading State ---
  const [isLiveTradingActive, setIsLiveTradingActive] = useState<boolean>(false);
  const [isDemoTradingActive, setIsDemoTradingActive] = useState<boolean>(false);
  
  // --- Centrally Managed Dynamic Data ---
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>(initialMockActiveTrades);
  const [pnlSummary, setPnlSummary] = useState<PnlSummary>(initialPnlSummary);
  const [systemLogs, setSystemLogs] = useState<LogEntry[]>(initialLogs);
  
  const tradesRef = useRef<ActiveTrade[]>(initialMockActiveTrades);

  useEffect(() => {
    const checkAuth = () => {
      setLoadingAuthState(true);
      const storedUser = sessionStorage.getItem('quantumsage_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        router.push('/login');
      }
      setLoadingAuthState(false);
    };
    checkAuth();
  }, [router]);
  
  // Centralized interval management for dynamic data simulation
  useEffect(() => {
    // Interval for updating active trades P&L
    const tradesInterval = setInterval(() => {
      const updatedTrades = tradesRef.current.map(trade => {
        const pnlChange = (Math.random() - 0.5) * 0.1;
        const currencyChange = (Math.random() - 0.5) * 5;
        const newPnlPercentage = parseFloat((trade.pnlPercentage + pnlChange).toFixed(2));
        const newPnlCurrency = parseFloat((trade.pnlCurrency + currencyChange).toFixed(2));
        const newProgress = Math.min(100, Math.max(0, trade.progress + Math.floor(Math.random() * 6) - 3));
        return {
          ...trade,
          pnlPercentage: newPnlPercentage,
          pnlCurrency: newPnlCurrency,
          progress: newProgress,
        };
      });
      tradesRef.current = updatedTrades;
      setActiveTrades(updatedTrades);

      const summaryPnlChange = (Math.random() - 0.5) * 10;
       setPnlSummary(prev => ({...prev, todayPL: parseFloat((prev.todayPL + summaryPnlChange).toFixed(2))}));
    }, 3000);

    // Interval for adding new system logs
    const logsInterval = setInterval(() => {
      const newLog = potentialNewLogs[Math.floor(Math.random() * potentialNewLogs.length)];
      setSystemLogs(prevLogs => [
        { ...newLog, timestamp: format(new Date(), 'HH:mm:ss') },
        ...prevLogs,
      ].slice(0, 50));
    }, 7000);

    // Cleanup function to clear intervals when the component unmounts
    return () => {
      clearInterval(tradesInterval);
      clearInterval(logsInterval);
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('quantumsage_user');
    setUser(null);
    router.push('/login');
  };

  const handleBotSelectedPairsChange = (newPairs: string[]) => {
    setBotSelectedPairs(newPairs);
    if (newPairs.length > 0 && !newPairs.includes(activeChartPair)) {
      setActiveChartPair(newPairs[0]);
    } else if (newPairs.length === 0) {
      setActiveChartPair('EURUSD'); // Default
    }
  };

  if (loadingAuthState || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <p className="text-primary text-lg">Loading QuantumSage Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-background text-foreground dark">
      <AppHeader
        user={user}
        onLogout={handleLogout}
        isLiveTradingActive={isLiveTradingActive}
        setIsLiveTradingActive={setIsLiveTradingActive}
        isDemoTradingActive={isDemoTradingActive}
        setIsDemoTradingActive={setIsDemoTradingActive}
      />
      <main className="container mx-auto px-2 sm:px-4 py-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            <StrategyControlCard
              selectedPairs={botSelectedPairs}
              onSelectedPairsChange={handleBotSelectedPairsChange}
              selectedTimeframe={activeTimeframe}
              onTimeframeChange={setActiveTimeframe}
              isGloballyLiveTrading={isLiveTradingActive}
              isGloballyDemoTrading={isDemoTradingActive}
            />
            <RiskManagementCard />
            <MlModelStatusCard />
            <AccountDetailsCard />
          </div>

          {/* Middle Column */}
          <div className="lg:col-span-2 space-y-6">
            <LazyChartDisplay
              currentPair={activeChartPair}
              currentTimeframe={activeTimeframe}
              botMonitoredPairs={botSelectedPairs}
              onSelectChartPair={setActiveChartPair}
            />
            <LazyTechnicalIndicatorsCard />
            <LazyTradingSignalsCard />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6">
            <LazyActiveTradesCard 
              activeTrades={activeTrades}
              pnlSummary={pnlSummary}
            />
            <LazyNewsEventsCard />
            <LazySystemLogsCard logs={systemLogs} setLogs={setSystemLogs} />
          </div>
        </div>
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground border-t">
        QuantumSage &copy; {new Date().getFullYear()} - Advanced AI Trading System
      </footer>
    </div>
  );
}
