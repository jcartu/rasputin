'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ExternalLink, Shield, Clock, Settings, Webhook,
  CheckCircle, XCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Integration, ConnectedIntegration } from '@/lib/integrationStore';

interface IntegrationDetailsProps {
  integration: Integration;
  connected?: ConnectedIntegration;
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshToken?: () => void;
}

const integrationIcons: Record<string, string> = {
  slack: '💬',
  discord: '🎮',
  github: '🐙',
  gitlab: '🦊',
  linear: '📐',
  jira: '🎫',
  notion: '📝',
  'google-drive': '📁',
  dropbox: '📦',
};

const statusConfig = {
  connected: { icon: CheckCircle, color: 'text-green-500', label: 'Connected' },
  error: { icon: XCircle, color: 'text-red-500', label: 'Connection Error' },
  expired: { icon: AlertCircle, color: 'text-yellow-500', label: 'Token Expired' },
};

export function IntegrationDetails({
  integration,
  connected,
  open,
  onClose,
  onConnect,
  onDisconnect,
  onRefreshToken,
}: IntegrationDetailsProps) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const icon = integrationIcons[integration.id] || integration.icon || '🔌';
  const status = connected?.status;
  const StatusIcon = status ? statusConfig[status].icon : null;

  const handleDisconnect = () => {
    setShowDisconnectConfirm(false);
    onDisconnect();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="text-5xl">{icon}</div>
            <div>
              <DialogTitle className="text-xl">{integration.name}</DialogTitle>
              <p className="text-sm text-muted-foreground capitalize">
                {integration.category.replace('-', ' ')}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          {connected && status && StatusIcon && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${statusConfig[status].color}`} />
                <span className="font-medium">{statusConfig[status].label}</span>
              </div>
              {connected.connectedAt && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(connected.connectedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="font-medium mb-2">About</h4>
            <p className="text-sm text-muted-foreground">{integration.description}</p>
          </div>

          {/* Features */}
          {integration.features && integration.features.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <div className="flex flex-wrap gap-2">
                {integration.features.map((feature) => (
                  <Badge key={feature} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Permissions/Scopes */}
          {integration.scopes && integration.scopes.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Required Permissions
              </h4>
              <div className="space-y-1">
                {integration.scopes.map((scope) => (
                  <div key={scope} className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {scope}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected Settings */}
          {connected && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Enable notifications</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-sync</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              {/* Webhook info */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Webhooks
                </h4>
                <p className="text-sm text-muted-foreground">
                  Webhook endpoint configured for real-time updates.
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex gap-3">
            {connected ? (
              <>
                {(status === 'expired' || status === 'error') && onRefreshToken && (
                  <Button variant="outline" className="flex-1" onClick={onRefreshToken}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Token
                  </Button>
                )}
                <AnimatePresence mode="wait">
                  {showDisconnectConfirm ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-2 flex-1"
                    >
                      <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                        Confirm
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowDisconnectConfirm(false)}>
                        Cancel
                      </Button>
                    </motion.div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="text-destructive hover:text-destructive flex-1"
                      onClick={() => setShowDisconnectConfirm(true)}
                    >
                      Disconnect
                    </Button>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <Button className="flex-1" onClick={onConnect}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect with {integration.name}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
