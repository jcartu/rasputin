'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface OAuthConnectFlowProps {
  integrationName: string;
  authUrl: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

type FlowState = 'idle' | 'redirecting' | 'waiting' | 'success' | 'error';

export function OAuthConnectFlow({
  integrationName,
  authUrl,
  open,
  onClose,
  onSuccess,
  onError,
}: OAuthConnectFlowProps) {
  const [state, setState] = useState<FlowState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);

  const handleConnect = useCallback(() => {
    if (!authUrl) return;

    setState('redirecting');

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      `oauth_${integrationName}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (popup) {
      setPopupWindow(popup);
      setState('waiting');
    } else {
      window.location.href = authUrl;
    }
  }, [authUrl, integrationName]);

  useEffect(() => {
    if (!popupWindow) return;

    const checkClosed = setInterval(() => {
      if (popupWindow.closed) {
        clearInterval(checkClosed);
        setState('success');
        onSuccess();
      }
    }, 500);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_callback') {
        if (event.data.success) {
          setState('success');
          onSuccess();
        } else {
          setState('error');
          setErrorMessage(event.data.error || 'Authentication failed');
          onError(event.data.error || 'Authentication failed');
        }
        popupWindow.close();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
    };
  }, [popupWindow, onSuccess, onError]);

  useEffect(() => {
    if (!open) {
      setState('idle');
      setErrorMessage('');
      setPopupWindow(null);
    }
  }, [open]);

  const stateContent = {
    idle: (
      <div className="text-center py-6">
        <p className="text-muted-foreground mb-6">
          Click below to connect your {integrationName} account. You&apos;ll be redirected to authorize access.
        </p>
        <Button onClick={handleConnect} disabled={!authUrl}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Connect with {integrationName}
        </Button>
      </div>
    ),
    redirecting: (
      <div className="text-center py-6">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Opening {integrationName} authorization...</p>
      </div>
    ),
    waiting: (
      <div className="text-center py-6">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="font-medium mb-2">Waiting for authorization...</p>
        <p className="text-sm text-muted-foreground">
          Complete the sign-in process in the popup window.
        </p>
      </div>
    ),
    success: (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-6"
      >
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <p className="font-medium text-lg mb-2">Connected!</p>
        <p className="text-sm text-muted-foreground mb-4">
          Your {integrationName} account has been successfully connected.
        </p>
        <Button onClick={onClose}>Done</Button>
      </motion.div>
    ),
    error: (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-6"
      >
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="font-medium text-lg mb-2">Connection Failed</p>
        <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConnect}>Try Again</Button>
        </div>
      </motion.div>
    ),
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Connect {integrationName}</DialogTitle>
        </DialogHeader>
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {stateContent[state]}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
