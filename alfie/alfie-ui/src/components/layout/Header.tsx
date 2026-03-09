'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  Loader2, 
  PanelRightOpen, 
  PanelRightClose,
  Activity,
  Menu,
  Sparkles,
  Keyboard,
  Palette,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import ShareDialog from '@/components/share/ShareDialog';
import { SearchPanel } from '@/components/search/SearchPanel';
import { ThemeSelector, QuickThemeToggle } from '@/components/theme';
import { ModelSelector } from '@/components/chat/ModelSelector';

import { MediaToolbar, ScreenRecorder, ScreenshotCapture, RecordingControls } from '@/components/media';
import { useUIStore, useSystemStore, useChatStore } from '@/lib/store';
import { useMobileContext } from '@/components/shared/MobileProvider';
import { cn } from '@/lib/utils';

export function Header() {
  const t = useTranslations('header');
  const tCommon = useTranslations('common');
  const { isMobile, isTablet } = useMobileContext();
  const [shareOpen, setShareOpen] = useState(false);
  const { rightPanelOpen, toggleRightPanel, setMobileMenuOpen, setMobilePanelOpen, setShortcutsHelpOpen } = useUIStore();
  const { connectionStatus } = useSystemStore();
  const { currentPhase, isStreaming, activeSessionId } = useChatStore();

  const connectionIcons = {
    connected: Wifi,
    disconnected: WifiOff,
    connecting: Loader2,
  };

  const connectionColors = {
    connected: 'text-emerald-500',
    disconnected: 'text-destructive',
    connecting: 'text-amber-500 animate-spin',
  };

  const ConnectionIcon = connectionIcons[connectionStatus];

  const handleMenuClick = () => {
    setMobileMenuOpen(true);
  };

  const handlePanelClick = () => {
    if (isMobile) {
      setMobilePanelOpen(true);
    } else {
      toggleRightPanel();
    }
  };

  return (
    <TooltipProvider>
      <header 
        className={cn(
          'h-14 border-b border-border/50 bg-gradient-to-r from-card/80 via-card/90 to-card/80 backdrop-blur-xl flex items-center justify-between px-4 shadow-[0_1px_20px_hsl(var(--foreground)/0.03)]',
          'safe-area-top',
          isMobile && 'h-[var(--mobile-header-height)]'
        )}
        data-tutorial="header"
      >
        <div className="flex items-center gap-2 md:gap-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMenuClick}
              className="rounded-xl min-w-touch min-h-touch -ml-2"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}

          {isMobile && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm gradient-text">{tCommon('alfie')}</span>
            </div>
          )}

          {!isMobile && (
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50',
                    connectionColors[connectionStatus]
                  )}>
                    <ConnectionIcon className="w-4 h-4" />
                    <span className="text-xs font-medium capitalize hidden sm:inline">{t(connectionStatus)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {t('websocketStatus', { status: t(connectionStatus) })}
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {currentPhase !== 'idle' && !isMobile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <PhaseIndicator phase={currentPhase} compact={isTablet} />
            </motion.div>
          )}

          {isStreaming && (
            <Badge 
              variant="outline" 
              className={cn(
                'bg-primary/10 text-primary border-primary/20',
                isMobile && 'text-xs px-2'
              )}
            >
              <Activity className="w-3 h-3 mr-1 animate-pulse" />
              {!isMobile && t('streaming')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {!isMobile && <SearchPanel />}
          {!isMobile && <ModelSelector />}

          {isMobile && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50',
              connectionColors[connectionStatus]
            )}>
              <ConnectionIcon className="w-3 h-3" />
            </div>
          )}

          {!isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShortcutsHelpOpen(true)}
                  className="rounded-xl min-w-touch min-h-touch"
                >
                  <Keyboard className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('keyboardShortcuts')}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareOpen(true)}
                className="rounded-xl min-w-touch min-h-touch"
                disabled={!activeSessionId}
                aria-label="Share conversation"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Share conversation
            </TooltipContent>
          </Tooltip>

          {!isMobile && <MediaToolbar />}
          {isMobile && <MediaToolbar compact />}

          {isMobile ? (
            <QuickThemeToggle />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div data-tutorial="theme-toggle">
                  <ThemeSelector
                    trigger={
                      <Button variant="ghost" size="icon" className="rounded-xl min-w-touch min-h-touch">
                        <Palette className="w-5 h-5" />
                      </Button>
                    }
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {t('toggleTheme', { mode: '' })}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePanelClick}
                className="rounded-xl min-w-touch min-h-touch"
                data-tutorial="panel-toggle"
              >
                {rightPanelOpen && !isMobile ? (
                  <PanelRightClose className="w-5 h-5" />
                ) : (
                  <PanelRightOpen className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {rightPanelOpen ? t('hidePanel') : t('showPanel')}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
      
      <ScreenRecorder />
      <ScreenshotCapture />
      <RecordingControls />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} sessionId={activeSessionId || undefined} />
    </TooltipProvider>
  );
}

interface PhaseIndicatorProps {
  phase: 'think' | 'act' | 'observe';
  compact?: boolean;
}

function PhaseIndicator({ phase, compact }: PhaseIndicatorProps) {
  const t = useTranslations('header');
  
  const phaseConfig = {
    think: { label: t('thinking'), color: 'bg-amber-500', textColor: 'text-amber-500' },
    act: { label: t('acting'), color: 'bg-emerald-500', textColor: 'text-emerald-500' },
    observe: { label: t('observing'), color: 'bg-cyan-500', textColor: 'text-cyan-500' },
  };

  const config = phaseConfig[phase];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className={cn('w-2 h-2 rounded-full', config.color)}
      />
      {!compact && (
        <span className={cn('text-xs font-medium', config.textColor)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
