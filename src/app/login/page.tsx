
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Bot, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        toast({ title: "Login Failed", description: "Check your username and password.", variant: "destructive" });
        return;
      }

      toast({ title: "Login Successful", description: "Redirecting to dashboard..." });
      router.push('/');
    } catch {
      toast({ title: "Login Failed", description: "Authentication is unavailable. Please try again.", variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 dark">
       <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center space-x-3">
              <Bot size={40} className="text-primary" />
              <h1 className="text-3xl font-bold text-primary">QuantumSage</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Advanced AI Trading System</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoggingIn}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoggingIn}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              <LogIn className="mr-2 h-4 w-4" />
              {isLoggingIn ? 'Logging In...' : 'Login'}
            </Button>
          </form>
           <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Button variant="link" className="p-0 h-auto" disabled>
              Sign up
            </Button>
            <p className="text-xs text-muted-foreground mt-2">(Sign-up is disabled for this demo)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
