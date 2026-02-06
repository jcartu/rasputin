'use client';

import { motion } from 'framer-motion';
import { 
  MessageSquare, GitBranch, FileText, HardDrive, Puzzle,
  CheckCircle, XCircle, AlertCircle, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Integration, ConnectedIntegration } from '@/lib/integrationStore';

interface IntegrationCardProps {
  integration: Integration;
  connected?: ConnectedIntegration;
  onConnect: () => void;
  onManage: () => void;
  onDisconnect: () => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  communication: MessageSquare,
  'project-management': FileText,
  'version-control': GitBranch,
  storage: HardDrive,
  custom: Puzzle,
};

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
  connected: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Connected' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Error' },
  expired: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Expired' },
};

export function IntegrationCard({ 
  integration, 
  connected, 
  onConnect, 
  onManage, 
  onDisconnect 
}: IntegrationCardProps) {
  const CategoryIcon = categoryIcons[integration.category] || Puzzle;
  const status = connected?.status;
  const StatusIcon = status ? statusConfig[status].icon : null;
  const icon = integrationIcons[integration.id] || integration.icon || '🔌';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 h-full flex flex-col hover:shadow-lg transition-shadow border-border/50 hover:border-primary/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{icon}</div>
            <div>
              <h3 className="font-semibold text-foreground">{integration.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CategoryIcon className="h-3 w-3" />
                <span className="capitalize">{integration.category.replace('-', ' ')}</span>
              </div>
            </div>
          </div>
          
          {status && StatusIcon && (
            <Badge variant="outline" className={`${statusConfig[status].bg} ${statusConfig[status].color} border-0`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[status].label}
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2">
          {integration.description}
        </p>

        {integration.features && integration.features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {integration.features.slice(0, 3).map((feature) => (
              <Badge key={feature} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
            {integration.features.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{integration.features.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-auto">
          {connected ? (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={onManage}>
                Manage
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" className="flex-1" onClick={onConnect}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
