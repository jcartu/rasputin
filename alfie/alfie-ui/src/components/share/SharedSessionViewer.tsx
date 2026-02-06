'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  MessageSquare,
  User,
  Bot,
  Clock,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { shareApi, type ShareAccessResult, type ShareCheckResult } from '@/lib/shareApi';

interface SharedSessionViewerProps {
  token: string;
  embedded?: boolean;
}

export function SharedSessionViewer({ token, embedded = false }: SharedSessionViewerProps) {
  const [status, setStatus] = useState<'loading' | 'password' | 'ready' | 'error'>('loading');
  const [shareInfo, setShareInfo] = useState<ShareCheckResult | null>(null);
  const [accessResult, setAccessResult] = useState<ShareAccessResult | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const accessShare = useCallback(async (pwd?: string) => {
    setVerifying(true);
    try {
      const result = await shareApi.access(token, { password: pwd });
      
      if (!result.valid) {
        if (result.requiresPassword) {
          setStatus('password');
          setError(result.error || 'Password required');
        } else {
          setError(result.error || 'Access denied');
          setStatus('error');
        }
        return;
      }

      setAccessResult(result);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access share');
      setStatus('error');
    } finally {
      setVerifying(false);
    }
  }, [token]);

  const checkShare = useCallback(async () => {
    try {
      const info = await shareApi.check(token);
      setShareInfo(info);

      if (info.isExpired) {
        setError('This share link has expired');
        setStatus('error');
        return;
      }

      if (info.isMaxViewsReached) {
        setError('This share link has reached its maximum views');
        setStatus('error');
        return;
      }

      if (info.requiresPassword) {
        setStatus('password');
      } else {
        await accessShare();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share not found');
      setStatus('error');
    }
  }, [token, accessShare]);

  useEffect(() => {
    checkShare();
  }, [checkShare]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      accessShare(password);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'loading') {
    return (
      <div className={cn('flex items-center justify-center', embedded ? 'h-full' : 'min-h-screen')}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">Loading shared session...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={cn('flex items-center justify-center', embedded ? 'h-full' : 'min-h-screen')}>
        <div className="text-center max-w-md p-6">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-xl font-bold mt-4">Unable to Access</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
          {!embedded && (
            <Button className="mt-4" onClick={() => window.history.back()}>
              Go Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'password') {
    return (
      <div className={cn('flex items-center justify-center', embedded ? 'h-full' : 'min-h-screen')}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-6"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{shareInfo?.title || 'Protected Session'}</h2>
            <p className="text-muted-foreground mt-1">
              This session is password protected
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={verifying}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && status === 'password' && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={!password || verifying}>
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Unlock Session'
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (!accessResult?.session) {
    return null;
  }

  const { share, session } = accessResult;

  return (
    <div className={cn('flex flex-col', embedded ? 'h-full' : 'min-h-screen')}>
      {!embedded && (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="font-semibold">{share?.title}</h1>
              {share?.description && (
                <p className="text-sm text-muted-foreground">{share.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="w-4 h-4" />
              <span>{share?.viewCount} views</span>
              {share?.viewOnly && (
                <span className="px-2 py-0.5 bg-muted rounded text-xs">View Only</span>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={cn('flex-1 overflow-auto', !embedded && 'max-w-4xl mx-auto w-full')}>
        <div className="p-4 space-y-4">
          {session.messages.map((message, index) => (
            <motion.div
              key={message.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                'flex gap-3',
                message.role === 'user' && 'flex-row-reverse'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              
              <div className={cn(
                'flex-1 max-w-[80%] rounded-lg p-3',
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground ml-auto' 
                  : 'bg-muted'
              )}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {share?.allowCopy ? (
                    <div className="relative group">
                      <pre className="whitespace-pre-wrap break-words text-sm">
                        {message.content}
                      </pre>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 h-6 w-6"
                        onClick={() => handleCopy(message.content)}
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm select-none">
                      {message.content}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs opacity-60">
                  <Clock className="w-3 h-3" />
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {!embedded && (
        <footer className="border-t bg-muted/30 py-3">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>{session.messages.length} messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Shared via ALFIE</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default SharedSessionViewer;
