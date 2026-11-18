
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, addDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface MLModelStatus {
    modelName: string;
    pythonBridgeActive: boolean;
    lastTrainingDate: string; // YYYY-MM-DD
    lastTrainingAccuracy: number; // Percentage
    nextScheduledTraining: string; // YYYY-MM-DD
}

// --- API Placeholder Functions ---
async function fetchMlModelStatusAPI(): Promise<MLModelStatus> {
    console.log("API_CALL_PLACEHOLDER: Fetching ML model status.");
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
    const today = new Date();
    return {
        modelName: "XGBoost v2.4.1",
        pythonBridgeActive: Math.random() > 0.1, // 90% chance active
        lastTrainingDate: format(subDays(today, Math.floor(Math.random() * 7) + 1), 'yyyy-MM-dd'),
        lastTrainingAccuracy: parseFloat((85 + Math.random() * 5).toFixed(1)), // 85-90%
        nextScheduledTraining: format(addDays(today, Math.floor(Math.random() * 7) + 7), 'yyyy-MM-dd'),
    };
}

async function triggerModelRetrainingAPI(): Promise<{ success: boolean, message?: string, newStatus?: MLModelStatus }> {
    console.log("API_CALL_PLACEHOLDER: Triggering model retraining.");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate retraining time
    const success = Math.random() > 0.3; // 70% chance of success
    if (success) {
        const today = new Date();
        const newStatus: MLModelStatus = {
            modelName: "XGBoost v2.4.2", // Simulate version bump
            pythonBridgeActive: true,
            lastTrainingDate: format(today, 'yyyy-MM-dd'),
            lastTrainingAccuracy: parseFloat((86 + Math.random() * 6).toFixed(1)), // Slightly better accuracy
            nextScheduledTraining: format(addDays(today, 7), 'yyyy-MM-dd'),
        };
        return { success: true, message: "Model retraining successful and updated.", newStatus };
    } else {
        return { success: false, message: "An error occurred during model retraining. Please check system logs." };
    }
}
// --- End API Placeholder Functions ---


export function MlModelStatusCard() {
  const { toast } = useToast();
  const [isRetraining, setIsRetraining] = useState(false);
  const [modelStatus, setModelStatus] = useState<MLModelStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);


  useEffect(() => {
    const loadStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const status = await fetchMlModelStatusAPI();
        setModelStatus(status);
      } catch (error) {
        console.error("Failed to load ML model status:", error);
        toast({
          variant: "destructive",
          title: "Loading Error",
          description: "Could not fetch ML model status.",
        });
        // Optionally, set a default/error state for modelStatus if needed
      } finally {
        setIsLoadingStatus(false);
      }
    };
    loadStatus();
  }, [toast]); // toast dependency is for error display

  const handleRetrain = async () => {
    setIsRetraining(true);
    try {
      const result = await triggerModelRetrainingAPI();
      if (result.success && result.newStatus) {
        setModelStatus(result.newStatus);
        toast({
          title: "Model Retraining Successful",
          description: result.message || "The ML model has been updated with the latest data.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Retraining Failed",
          description: result.message || "An error occurred during model retraining.",
        });
      }
    } catch (error) {
        console.error("Error triggering retraining:", error);
        toast({
          variant: "destructive",
          title: "Retraining Error",
          description: "Failed to trigger model retraining.",
        });
    } finally {
        setIsRetraining(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Brain className="mr-2 text-primary" />
          ML Model Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoadingStatus || !modelStatus ? (
          <>
            <div className="flex justify-between items-center text-sm">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex justify-between items-center text-sm">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <div className="flex justify-between items-center text-sm">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex justify-between items-center text-sm">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-10 w-full mt-4" />
          </>
        ) : (
          <>
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-muted-foreground">Model:</span>
              <span className="text-foreground">{modelStatus.modelName}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-muted-foreground">Python Bridge:</span>
              <span className="flex items-center text-foreground">
                <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${modelStatus.pythonBridgeActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                {modelStatus.pythonBridgeActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-muted-foreground">Last Training:</span>
              <span className="text-foreground">{modelStatus.lastTrainingDate} (Accuracy: {modelStatus.lastTrainingAccuracy}%)</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-muted-foreground">Next Training:</span>
              <span className="text-foreground">{modelStatus.nextScheduledTraining} (Scheduled)</span>
            </div>
            
            <Button onClick={handleRetrain} className="w-full text-sm mt-4" disabled={isRetraining || isLoadingStatus}>
              {isRetraining ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Retraining...
                </>
              ) : (
                <>
                  <RefreshCw size={16} className="mr-2" />
                  Retrain Model Now
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
