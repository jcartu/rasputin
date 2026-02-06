'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Link as LinkIcon,
  Calendar,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { MeetingIntegration as MeetingIntegrationType } from '@/types/meeting';

interface MeetingIntegrationProps {
  integration?: MeetingIntegrationType;
  onConnect?: (integration: MeetingIntegrationType) => void;
  onDisconnect?: () => void;
}

const INTEGRATION_CONFIGS = {
  zoom: {
    name: 'Zoom',
    color: '#2D8CFF',
    icon: '🎦',
    urlPattern: /zoom\.us\/j\/(\d+)/,
    oauthUrl: 'https://zoom.us/oauth/authorize',
  },
  google_meet: {
    name: 'Google Meet',
    color: '#00897B',
    icon: '📹',
    urlPattern: /meet\.google\.com\/([a-z-]+)/,
    oauthUrl: 'https://accounts.google.com/o/oauth2/auth',
  },
  teams: {
    name: 'Microsoft Teams',
    color: '#6264A7',
    icon: '👥',
    urlPattern: /teams\.microsoft\.com\/l\/meetup-join/,
    oauthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  },
  webex: {
    name: 'Webex',
    color: '#00BCF2',
    icon: '🌐',
    urlPattern: /webex\.com\/meet/,
    oauthUrl: 'https://webexapis.com/v1/authorize',
  },
} as const;

export function MeetingIntegration({
  integration,
  onConnect,
  onDisconnect,
}: MeetingIntegrationProps) {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectPlatform = useCallback((url: string): MeetingIntegrationType['type'] | null => {
    if (INTEGRATION_CONFIGS.zoom.urlPattern.test(url)) return 'zoom';
    if (INTEGRATION_CONFIGS.google_meet.urlPattern.test(url)) return 'google_meet';
    if (INTEGRATION_CONFIGS.teams.urlPattern.test(url)) return 'teams';
    if (INTEGRATION_CONFIGS.webex.urlPattern.test(url)) return 'webex';
    return null;
  }, []);

  const extractMeetingId = useCallback((url: string, type: MeetingIntegrationType['type']): string | null => {
    if (type === 'manual') return null;
    const config = INTEGRATION_CONFIGS[type as keyof typeof INTEGRATION_CONFIGS];
    if (!config) return null;
    
    const match = url.match(config.urlPattern);
    return match ? match[1] : null;
  }, []);

  const handleConnect = useCallback(async () => {
    if (!meetingUrl.trim()) {
      setError('Please enter a meeting URL');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const platform = detectPlatform(meetingUrl);
      
      if (!platform) {
        setError('Unsupported meeting platform. Supported: Zoom, Google Meet, Teams, Webex');
        setIsConnecting(false);
        return;
      }

      const meetingId = extractMeetingId(meetingUrl, platform);
      
      const newIntegration: MeetingIntegrationType = {
        type: platform,
        meetingId: meetingId || undefined,
        joinUrl: meetingUrl,
      };

      onConnect?.(newIntegration);
      setMeetingUrl('');
    } catch (err) {
      setError('Failed to connect to meeting');
    } finally {
      setIsConnecting(false);
    }
  }, [meetingUrl, detectPlatform, extractMeetingId, onConnect]);

  const handleCopyUrl = useCallback(() => {
    if (integration?.joinUrl) {
      navigator.clipboard.writeText(integration.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [integration?.joinUrl]);

  const handleOAuthConnect = useCallback(async (platform: keyof typeof INTEGRATION_CONFIGS) => {
    const config = INTEGRATION_CONFIGS[platform];
    window.open(config.oauthUrl, '_blank', 'width=600,height=700');
  }, []);

  if (integration) {
    const config = integration.type !== 'manual' ? INTEGRATION_CONFIGS[integration.type] : null;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg border bg-card"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: config?.color || '#666', color: 'white' }}
            >
              {config?.icon || '📞'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {config?.name || 'Manual Recording'}
                </span>
                <Badge variant="outline" className="text-xs">
                  Connected
                </Badge>
              </div>
              {integration.meetingId && (
                <p className="text-sm text-muted-foreground">
                  ID: {integration.meetingId}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {integration.joinUrl && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyUrl}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy URL</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                    >
                      <a href={integration.joinUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open meeting</TooltipContent>
                </Tooltip>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>

        {integration.scheduledStart && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(integration.scheduledStart).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(integration.scheduledStart).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(INTEGRATION_CONFIGS) as Array<keyof typeof INTEGRATION_CONFIGS>).map((platform) => {
          const config = INTEGRATION_CONFIGS[platform];
          return (
            <Button
              key={platform}
              variant="outline"
              className="h-auto py-3 justify-start"
              onClick={() => handleOAuthConnect(platform)}
            >
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-sm mr-3"
                style={{ backgroundColor: config.color, color: 'white' }}
              >
                {config.icon}
              </div>
              <span>{config.name}</span>
            </Button>
          );
        })}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or paste meeting URL
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Paste Zoom, Meet, Teams, or Webex URL..."
            value={meetingUrl}
            onChange={(e) => {
              setMeetingUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleConnect} disabled={isConnecting || !meetingUrl.trim()}>
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Video className="w-4 h-4 mr-2" />
              Connect
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Connect to your video call to automatically capture audio for transcription.
        Audio will be processed locally or via secure API.
      </p>
    </div>
  );
}
