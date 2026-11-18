
'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useState, useEffect } from 'react';
import { Bot, Zap, LogIn, Link as LinkIcon, CheckCircle2, Play, User as UserIcon, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';


interface Broker {
  id: string;
  name: string;
  loginUrl: string;
}

const brokers: Broker[] = [
  { id: 'amega', name: 'Amega Finance', loginUrl: 'https://client.amega.finance' },
  { id: 'vtmarkets', name: 'VT Markets', loginUrl: 'https://myaccount.vtmarkets.com/liveAccount' },
  { id: 'icmarkets', name: 'IC Markets', loginUrl: 'https://www.icmarkets.com/login' },
  { id: 'pepperstone', name: 'Pepperstone', loginUrl: 'https://pepperstone.com/en/login' },
  { id: 'oanda', name: 'OANDA', loginUrl: 'https://www.oanda.com/apply/login' },
];

// --- API Placeholder Functions ---
async function linkMt5AccountAPI(brokerId: string, accountDetails: any): Promise<{ success: boolean, accountId?: string, message?: string }> {
  console.log(`API_CALL_PLACEHOLDER: Linking MT5 account for broker ${brokerId} with details:`, accountDetails);
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (Math.random() > 0.2) {
    return { success: true, accountId: "931616" };
  } else {
    return { success: false, message: "Failed to link MT5 account. Please try again." };
  }
}

async function startLiveTradingAPI(brokerId: string, accountId: string): Promise<{ success: boolean, message?: string }> {
  console.log(`API_CALL_PLACEHOLDER: Starting live trading for broker ${brokerId}, account ${accountId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true, message: `Live trading started on account ${accountId} with ${brokerId}.` };
}

async function stopLiveTradingAPI(): Promise<{ success: boolean, message?: string }> {
  console.log(`API_CALL_PLACEHOLDER: Stopping live trading.`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true, message: "Live trading stopped." };
}

async function startDemoTradingAPI(): Promise<{ success: boolean, message?: string }> {
  console.log(`API_CALL_PLACEHOLDER: Starting demo trading.`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true, message: "Demo trading started." };
}

async function stopDemoTradingAPI(): Promise<{ success: boolean, message?: string }> {
  console.log(`API_CALL_PLACEHOLDER: Stopping demo trading.`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true, message: "Demo trading stopped." };
}
// --- End API Placeholder Functions ---


export interface AppHeaderProps {
  user: { displayName: string, photoURL: string } | null;
  onLogout: () => void;
  isLiveTradingActive: boolean;
  setIsLiveTradingActive: Dispatch<SetStateAction<boolean>>;
  isDemoTradingActive: boolean;
  setIsDemoTradingActive: Dispatch<SetStateAction<boolean>>;
}

export function AppHeader({
  user,
  onLogout,
  isLiveTradingActive,
  setIsLiveTradingActive,
  isDemoTradingActive,
  setIsDemoTradingActive,
}: AppHeaderProps) {
  const { toast } = useToast();

  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('');
  const [linkedAccount, setLinkedAccount] = useState<string | null>(null);
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState<boolean>(false);

  const selectedBroker = brokers.find(b => b.id === selectedBrokerId);
  const isAnyTradingActive = isLiveTradingActive || isDemoTradingActive;

  useEffect(() => {
    // When broker selection changes, reset account linking state and stop live trading if it's active.
    setLinkedAccount(null);
    setHasAttemptedLogin(false);
    
    if (isLiveTradingActive) {
      stopLiveTradingAPI().then(result => {
          setIsLiveTradingActive(false);
          toast({ title: "Trading Update", description: result.message || "Live trading stopped due to broker change." });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrokerId]);

  const handleLinkAccount = async (brokerId: string, brokerName: string) => {
    if (!brokerId) return;
    toast({ title: "Linking Account...", description: `Attempting to link MT5 account with ${brokerName}.` });
    const result = await linkMt5AccountAPI(brokerId, { mockDetail: "some_credential_or_token_from_popup_interaction" });
    if (result.success && result.accountId) {
      setLinkedAccount(result.accountId);
      toast({ title: "Account Linked", description: `MT5 Account ${result.accountId} has been successfully linked with ${brokerName}.` });
    } else {
      toast({ variant: "destructive", title: "Linking Failed", description: result.message || "Could not link MT5 account." });
    }
  };

  const handleTradingToggle = async () => {
    if (isLiveTradingActive) {
      const result = await stopLiveTradingAPI();
      if (result.success) {
        setIsLiveTradingActive(false);
        toast({ title: "Live Trading Stopped", description: result.message });
      }
    } else if (isDemoTradingActive) {
      const result = await stopDemoTradingAPI();
      if (result.success) {
        setIsDemoTradingActive(false);
        toast({ title: "Demo Trading Stopped", description: result.message });
      }
    } else {
      // Logic to start trading
      if (user && selectedBroker && linkedAccount) { // Condition to start LIVE
        const result = await startLiveTradingAPI(selectedBroker.id, linkedAccount);
        if (result.success) {
          setIsLiveTradingActive(true);
          toast({ title: "Live Trading Started", description: result.message });
        }
      } else { // Fallback to start DEMO
        const result = await startDemoTradingAPI();
        if (result.success) {
          setIsDemoTradingActive(true);
          toast({ title: "Demo Trading Started", description: result.message });
        }
      }
    }
  };

  const handleBrokerLogin = () => {
    if (selectedBroker) {
      window.open(selectedBroker.loginUrl, 'brokerLoginPopup', 'width=800,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
      setHasAttemptedLogin(true);
      toast({ title: "Broker Login Initiated", description: `Please log in to ${selectedBroker.name} in the pop-up window, then click "Link MT5 Account".` });
    }
  };

  const handleInternalLinkAccount = () => {
    if (selectedBroker) {
      handleLinkAccount(selectedBroker.id, selectedBroker.name);
    }
  };
  
  const handleManageAccount = () => {
    if (linkedAccount && selectedBroker) {
       toast({ title: "Manage Account", description: `Managing account ${linkedAccount} with ${selectedBroker.name}. (Feature not yet implemented)`});
    }
  };

  // Determine Trading Button appearance
  const getTradingButtonState = () => {
    if (isLiveTradingActive) {
      return {
        text: "Live On",
        Icon: Zap,
        className: "bg-profit text-black hover:bg-profit/90",
        ariaLabel: "Live Trading Status: Active. Click to stop Live Trading.",
      };
    }
    if (isDemoTradingActive) {
      return {
        text: "Demo On",
        Icon: Zap,
        className: "bg-blue-600 text-white hover:bg-blue-700",
        ariaLabel: "Demo Trading Status: Active. Click to stop Demo Trading.",
      };
    }
    // If stopped
    const canStartLive = user && selectedBroker && linkedAccount;
    return {
      text: canStartLive ? "Start Live" : "Start Demo",
      Icon: Play,
      className: "bg-primary text-primary-foreground",
      ariaLabel: `Trading Status: Stopped. Click to start ${canStartLive ? 'Live' : 'Demo'} Trading.`,
    };
  };

  const tradingButtonState = getTradingButtonState();

  return (
    <header className="bg-card text-card-foreground shadow-md sticky top-0 z-40 border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/" className="flex items-center space-x-3" aria-label="QuantumSage Home">
            <Bot size={32} className="text-primary" />
            <div>
              <h1 className="text-xl font-bold text-primary">QuantumSage</h1>
              <p className="text-xs text-muted-foreground">Advanced AI Trading System</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3">
            {user && (
              <>
                 <Tooltip>
                    <TooltipTrigger asChild>
                       <span tabIndex={isAnyTradingActive ? 0 : -1}> 
                          <Select
                            value={selectedBrokerId}
                            onValueChange={setSelectedBrokerId}
                            disabled={isAnyTradingActive}
                          >
                          <SelectTrigger
                              className="rounded-full text-xs font-semibold shadow-sm h-9 px-3 w-auto min-w-[140px] sm:min-w-[160px] border-input focus:ring-primary/90 focus:ring-offset-0 data-[state=open]:ring-2 data-[state=open]:ring-primary/90 data-[disabled]:opacity-100"
                              aria-label="Select Broker"
                          >
                              <SelectValue placeholder="Select Broker..." />
                          </SelectTrigger>
                          <SelectContent>
                              {brokers.map((broker) => (
                              <SelectItem key={broker.id} value={broker.id}>
                                  {broker.name}
                              </SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                       </span>
                    </TooltipTrigger>
                    {isAnyTradingActive && (
                      <TooltipContent>
                        <p>Broker selection disabled while trading is active.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  
                  {selectedBroker && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={isAnyTradingActive ? -1 : 0}>
                          {!linkedAccount ? (
                            !hasAttemptedLogin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs font-semibold"
                                onClick={handleBrokerLogin}
                                disabled={isAnyTradingActive}
                                aria-label={`Login to ${selectedBroker.name} to link account`}
                              >
                                <LogIn /> Login to {selectedBroker.name}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="rounded-full text-xs font-semibold"
                                onClick={handleInternalLinkAccount}
                                disabled={isAnyTradingActive}
                                aria-label={`Link MT5 account for ${selectedBroker.name}`}
                              >
                                <LinkIcon /> Link MT5 Account
                              </Button>
                            )
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="rounded-full text-xs font-semibold"
                              onClick={handleManageAccount}
                              disabled={isAnyTradingActive}
                              aria-label={`Account ${linkedAccount} linked. Click to manage.`}
                            >
                              <CheckCircle2 /> Acc: {linkedAccount}
                            </Button>
                          )}
                        </span>
                      </TooltipTrigger>
                      {isAnyTradingActive && (
                        <TooltipContent>
                          <p>Account management disabled while trading is active.</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}
              </>
            )}

            <Button
              size="sm"
              className={cn("rounded-full text-xs font-semibold shadow-sm", tradingButtonState.className)}
              aria-label={tradingButtonState.ariaLabel}
              onClick={handleTradingToggle}
            >
              <tradingButtonState.Icon />
              {tradingButtonState.text}
            </Button>
            
            {user ? (
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.photoURL} alt={user.displayName} />
                      <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        Logged In
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <UserIcon className="mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login" passHref>
                <Button size="sm" variant="outline" className="rounded-full text-xs font-semibold">
                  <LogIn />
                  Login / Sign Up
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
