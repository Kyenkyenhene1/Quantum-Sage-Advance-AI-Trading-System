
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface AccountDetail {
  label: string;
  value: string | number;
  isCurrency?: boolean;
  isPercentage?: boolean;
}

interface AccountSnapshot {
  accountNumber: string;
  accountType: string;
  broker: string;
  leverage: string;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
}

const baseAccountData: AccountSnapshot = {
  accountNumber: '931616',
  accountType: 'Demo ECN',
  broker: 'VT Markets',
  leverage: '1:500',
  balance: 10000.00,
  equity: 10342.50,
  marginUsed: 250.00,
  freeMargin: 10092.50,
  marginLevel: 4137.00,
};

const reportPeriods = [
  { value: 'current', label: 'Current Details' },
  { value: 'today', label: "Today's Summary" },
  { value: 'yesterday', label: "Yesterday's Summary" },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_15_days', label: 'Last 15 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_45_days', label: 'Last 45 Days' },
  { value: 'last_60_days', label: 'Last 60 Days' },
];

const formatCurrency = (value: number) => {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const transformSnapshotToDetails = (snapshot: AccountSnapshot): AccountDetail[] => [
  { label: 'Account Number', value: snapshot.accountNumber },
  { label: 'Account Type', value: snapshot.accountType },
  { label: 'Broker', value: snapshot.broker },
  { label: 'Leverage', value: snapshot.leverage },
  { label: 'Balance', value: formatCurrency(snapshot.balance), isCurrency: true },
  { label: 'Equity', value: formatCurrency(snapshot.equity), isCurrency: true },
  { label: 'Margin Used', value: formatCurrency(snapshot.marginUsed), isCurrency: true },
  { label: 'Free Margin', value: formatCurrency(snapshot.freeMargin), isCurrency: true },
  { label: 'Margin Level', value: snapshot.marginLevel.toFixed(2), isPercentage: true },
];


// --- API Placeholder Functions ---
async function fetchCurrentAccountDetailsAPI(): Promise<AccountSnapshot> {
  console.log("API_CALL_PLACEHOLDER: Fetching current account details.");
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
  return { ...baseAccountData };
}

async function fetchHistoricalAccountDetailsAPI(period: string): Promise<AccountSnapshot> {
  console.log(`API_CALL_PLACEHOLDER: Fetching historical account details for period: ${period}.`);
  await new Promise(resolve => setTimeout(resolve, 700)); // Simulate API delay
  
  const mockHistoricalData = { ...baseAccountData };
  // Simple variation based on period string length to simulate different data
  const balanceVariation = 0.9 + (period.length % 10) * 0.02; 
  const equityVariation = 0.9 + ((period.length + 3) % 10) * 0.02;
  
  mockHistoricalData.balance = baseAccountData.balance * balanceVariation;
  mockHistoricalData.equity = baseAccountData.equity * equityVariation;
  mockHistoricalData.freeMargin = mockHistoricalData.equity - mockHistoricalData.marginUsed; // Recalculate based on new equity
  mockHistoricalData.marginLevel = mockHistoricalData.marginUsed > 0 ? (mockHistoricalData.equity / mockHistoricalData.marginUsed) * 100 : 0; // Recalculate

  return mockHistoricalData;
}
// --- End API Placeholder Functions ---

export function AccountDetailsCard() {
  const [selectedPeriod, setSelectedPeriod] = useState(reportPeriods[0].value);
  const [accountData, setAccountData] = useState<AccountSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadDetails = async () => {
      setIsLoading(true);
      try {
        let data;
        if (selectedPeriod === 'current') {
          data = await fetchCurrentAccountDetailsAPI();
        } else {
          data = await fetchHistoricalAccountDetailsAPI(selectedPeriod);
        }
        setAccountData(data);
      } catch (error) {
        console.error("Failed to fetch account details:", error);
        toast({
            variant: "destructive",
            title: "Account Data Error",
            description: "Could not fetch account details. Showing default data.",
        });
        setAccountData(baseAccountData); 
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [selectedPeriod, toast]); 

  const displayedDetails = accountData ? transformSnapshotToDetails(accountData) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Wallet className="mr-2 text-primary" />
          Account Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="account-period-select" className="text-sm font-medium mb-1 block">Report Period</Label>
          <Select 
            value={selectedPeriod} 
            onValueChange={setSelectedPeriod}
            name="account-period-select" 
            aria-label="Select report period for account details"
            disabled={isLoading}
          >
            <SelectTrigger id="account-period-select">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {reportPeriods.map(period => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {isLoading || !accountData ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          displayedDetails.map((detail) => (
            <div key={detail.label} className="flex justify-between items-center text-sm">
              <span className="font-medium text-muted-foreground">{detail.label}:</span>
              <span className="text-foreground">
                {detail.isCurrency && '$'}
                {String(detail.value)} 
                {detail.isPercentage && '%'}
              </span>
            </div>
          ))
        )}
        <div className="pt-3 mt-3 border-t border-border text-xs text-muted-foreground">
          Note: Data shown is illustrative. Live updates would require broker API integration.
        </div>
      </CardContent>
    </Card>
  );
}
