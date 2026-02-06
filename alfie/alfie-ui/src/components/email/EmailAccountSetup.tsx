'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Mail,
  Loader2,
  ExternalLink,
  Server,
  Lock,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { emailApi, type EmailProvider } from '@/lib/emailApi';

interface EmailAccountSetupProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function EmailAccountSetup({ onClose, onSuccess }: EmailAccountSetupProps) {
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'oauth' | 'imap'>('oauth');
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const [imapConfig, setImapConfig] = useState({
    email: '',
    password: '',
    imapHost: '',
    imapPort: '993',
    smtpHost: '',
    smtpPort: '587',
    useTls: true,
  });
  const [imapConnecting, setImapConnecting] = useState(false);

  useEffect(() => {
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProviders = async () => {
    try {
      const { providers } = await emailApi.getProviders();
      setProviders(providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthConnect = async (providerId: string) => {
    setOauthLoading(providerId);
    setError(null);

    try {
      const redirectUri = `${window.location.origin}/api/email/oauth/callback`;
      const { url } = await emailApi.getAuthUrl(providerId, redirectUri);
      
      const popup = window.open(url, 'oauth', 'width=600,height=700,popup=true');
      
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'oauth-callback') {
          window.removeEventListener('message', handleMessage);
          popup?.close();
          
          if (event.data.error) {
            setError(event.data.error);
          } else {
            try {
              await emailApi.handleOAuthCallback(
                providerId,
                event.data.code,
                event.data.state,
                redirectUri
              );
              onSuccess();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'OAuth failed');
            }
          }
          setOauthLoading(null);
        }
      };

      window.addEventListener('message', handleMessage);

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleMessage);
          setOauthLoading(null);
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth');
      setOauthLoading(null);
    }
  };

  const handleImapConnect = async () => {
    setImapConnecting(true);
    setError(null);

    try {
      await emailApi.connectImap({
        email: imapConfig.email,
        password: imapConfig.password,
        imapHost: imapConfig.imapHost,
        imapPort: parseInt(imapConfig.imapPort),
        smtpHost: imapConfig.smtpHost || imapConfig.imapHost,
        smtpPort: parseInt(imapConfig.smtpPort),
        useTls: imapConfig.useTls,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IMAP connection failed');
    } finally {
      setImapConnecting(false);
    }
  };

  const oauthProviders = providers.filter(p => p.oauth);
  const imapProvider = providers.find(p => !p.oauth);

  const providerIcons: Record<string, string> = {
    gmail: '/icons/gmail.svg',
    outlook: '/icons/outlook.svg',
  };

  const providerColors: Record<string, string> = {
    gmail: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20',
    outlook: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Connect Email Account
          </DialogTitle>
          <DialogDescription>
            Connect your email account to send and receive emails from ALFIE.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'oauth' | 'imap')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oauth">Quick Connect</TabsTrigger>
              <TabsTrigger value="imap">IMAP/SMTP</TabsTrigger>
            </TabsList>

            <TabsContent value="oauth" className="space-y-4 pt-4">
              <div className="grid gap-3">
                {oauthProviders.map((provider) => (
                  <button
                    type="button"
                    key={provider.id}
                    onClick={() => handleOAuthConnect(provider.id)}
                    disabled={!provider.configured || oauthLoading !== null}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg border transition-colors',
                      provider.configured
                        ? providerColors[provider.id] || 'bg-muted/50 hover:bg-muted border-border'
                        : 'bg-muted/30 border-border opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                      {providerIcons[provider.id] ? (
                        <Mail className="w-6 h-6" />
                      ) : (
                        <Mail className="w-6 h-6" />
                      )}
                    </div>
                    
                    <div className="flex-1 text-left">
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {provider.configured ? 'Click to connect' : 'Not configured'}
                      </p>
                    </div>

                    {oauthLoading === provider.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : provider.configured ? (
                      <ExternalLink className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>

              {oauthProviders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No OAuth providers configured.</p>
                  <p className="text-sm">Contact your administrator or use IMAP.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="imap" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={imapConfig.email}
                    onChange={(e) => setImapConfig({ ...imapConfig, email: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password or App Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={imapConfig.password}
                    onChange={(e) => setImapConfig({ ...imapConfig, password: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="imapHost">IMAP Server</Label>
                    <Input
                      id="imapHost"
                      placeholder="imap.example.com"
                      value={imapConfig.imapHost}
                      onChange={(e) => setImapConfig({ ...imapConfig, imapHost: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imapPort">IMAP Port</Label>
                    <Input
                      id="imapPort"
                      placeholder="993"
                      value={imapConfig.imapPort}
                      onChange={(e) => setImapConfig({ ...imapConfig, imapPort: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="smtpHost">SMTP Server</Label>
                    <Input
                      id="smtpHost"
                      placeholder="smtp.example.com"
                      value={imapConfig.smtpHost}
                      onChange={(e) => setImapConfig({ ...imapConfig, smtpHost: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smtpPort">SMTP Port</Label>
                    <Input
                      id="smtpPort"
                      placeholder="587"
                      value={imapConfig.smtpPort}
                      onChange={(e) => setImapConfig({ ...imapConfig, smtpPort: e.target.value })}
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleImapConnect}
                  disabled={imapConnecting || !imapConfig.email || !imapConfig.password || !imapConfig.imapHost}
                >
                  {imapConnecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Server className="w-4 h-4 mr-2" />
                  )}
                  Connect via IMAP
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
