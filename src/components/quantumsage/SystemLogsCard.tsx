
'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

type LogType = 'info' | 'success' | 'error' | 'warning';

interface LogEntry {
  type: LogType;
  message: string;
  timestamp: string;
}

interface SystemLogsCardProps {
    logs: LogEntry[];
    setLogs: Dispatch<SetStateAction<LogEntry[]>>;
}


export function SystemLogsCard({ logs, setLogs }: SystemLogsCardProps) {
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);


  const handleExportLogs = () => {
    if (logs.length === 0) {
      toast({ variant: 'destructive', title: "No Logs to Export", description: "There are no logs to download." });
      return;
    }
    const logContent = logs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantumsage-logs-${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Logs Exported", description: "System logs have been downloaded." });
  };

  const handleClearLogs = () => {
    setLogs([]);
    toast({ title: "Logs Cleared", description: "Displayed system logs have been cleared." });
  };
  
  const getLogTextColorClass = (type: LogType) => {
    switch (type) {
      case 'success': return 'text-profit';
      case 'error': return 'text-loss';
      case 'warning': return 'text-yellow-500 dark:text-yellow-400';
      case 'info':
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Terminal className="mr-2 text-primary" />
          System Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-3" ref={scrollAreaRef}>
          <div className="text-xs font-mono space-y-1">
            {logs.length > 0 ? logs.map((log, index) => (
              <div key={index} className={cn(getLogTextColorClass(log.type))}>
                <span className="opacity-70">[{log.timestamp}]</span> {log.message}
              </div>
            )) : (
              <div className="text-center text-muted-foreground pt-4">No log entries.</div>
            )}
          </div>
        </ScrollArea>
        
        <div className="mt-4 flex space-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleExportLogs} className="text-xs">
                <Download /> Export Logs
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download system logs</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleClearLogs} className="text-xs">
                <Trash2 /> Clear
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear displayed system logs</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
