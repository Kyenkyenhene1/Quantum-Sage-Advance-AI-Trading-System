
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Info } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  progress: number; // Percentage towards TP (if PNL > 0) or SL (if PNL < 0)
  reason: string;
}

interface PnlSummary {
  todayPL: number;
  weekPL: number;
  winRate: string;
}

interface ActiveTradesCardProps {
    activeTrades: ActiveTrade[];
    pnlSummary: PnlSummary | null;
}

export function ActiveTradesCard({ activeTrades, pnlSummary }: ActiveTradesCardProps) {
  const [isLoading, setIsLoading] = useState(activeTrades.length === 0);

  const getPnlTextColorClass = (pnlValue: number) => {
    if (pnlValue < 0) return 'text-loss';
    if (pnlValue > 0) return 'text-profit';
    return 'text-foreground';
  };
  
  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <ArrowRightLeft className="mr-2 text-primary" />
          Active Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Skeleton className="h-5 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
             <div className="mt-6 pt-4 border-t border-border space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {activeTrades.map(trade => (
                <Dialog key={trade.id}>
                  <DialogTrigger asChild>
                    <div
                      className="border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${trade.pair} ${trade.type} trade`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={cn('font-medium', trade.type === 'Buy' ? 'text-profit' : 'text-loss')}>
                            {trade.pair} {trade.type}
                          </span>
                          <div className="text-xs text-muted-foreground">{trade.id} | {trade.lotSize.toFixed(2)} Lots</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-lg">{formatCurrency(trade.pnlCurrency)}</div>
                          <div className={cn('text-xs font-semibold', getPnlTextColorClass(trade.pnlPercentage))}>
                            {trade.pnlPercentage >= 0 ? '+' : ''}{trade.pnlPercentage}%
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <div>SL: {trade.stopLoss}</div>
                        <div>TP: {trade.takeProfit}</div>
                      </div>
                      <Progress
                        value={trade.progress}
                        className="h-1.5 mt-2 bg-muted" 
                        indicatorClassName={trade.pnlPercentage >= 0 ? 'bg-profit' : 'bg-loss'}
                      />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center">
                          <Info className="mr-2 text-primary" /> Trade Details: {trade.pair} {trade.type}
                        </DialogTitle>
                        <DialogDescription>
                            Reviewing trade ID {trade.id}
                        </DialogDescription>
                      </DialogHeader>
                      
                        <div className="space-y-3 text-sm mt-2">
                            <div className="grid grid-cols-2 gap-2">
                                <span><strong>Asset:</strong></span> <span>{trade.pair}</span>
                                <span><strong>Type:</strong></span> <span className={trade.type === 'Buy' ? 'text-profit' : 'text-loss'}>{trade.type}</span>
                                <span><strong>Lot Size:</strong></span> <span>{trade.lotSize.toFixed(2)}</span>
                                <span><strong>Entry Price:</strong></span> <span>{trade.entryPrice}</span>
                                <span><strong>Entry Time:</strong></span> <span>{format(trade.entryTime, "yyyy-MM-dd HH:mm:ss")}</span>
                            </div>
                            <div className="border-t pt-3 mt-3 grid grid-cols-2 gap-2">
                                <span><strong>Stop Loss:</strong></span> <span>{trade.stopLoss}</span>
                                <span><strong>Take Profit:</strong></span> <span>{trade.takeProfit}</span>
                            </div>
                            <div className="border-t pt-3 mt-3 grid grid-cols-2 gap-2">
                                <span><strong>Reason:</strong></span> <span>{trade.reason}</span>
                                <span><strong>Current P&L:</strong></span> <span className={getPnlTextColorClass(trade.pnlPercentage)}>{trade.pnlPercentage >= 0 ? '+' : ''}{trade.pnlPercentage}% ({formatCurrency(trade.pnlCurrency)})</span>
                            </div>
                        </div>
                  </DialogContent>
                </Dialog>
              ))}
              {activeTrades.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">No active trades at the moment.</p>
              )}
            </div>

            {pnlSummary && (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Today's P&L:</span>
                  <span className={cn('font-medium', getPnlTextColorClass(pnlSummary.todayPL))}>{formatCurrency(pnlSummary.todayPL)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-muted-foreground">This Week:</span>
                  <span className={cn('font-medium', getPnlTextColorClass(pnlSummary.weekPL))}>{formatCurrency(pnlSummary.weekPL)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span className="font-medium">{pnlSummary.winRate}</span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
