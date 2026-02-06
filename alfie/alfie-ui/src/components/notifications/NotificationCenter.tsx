'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  X,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Volume2,
  VolumeX,
  Moon,
  Clock,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  useNotificationStore,
  type Notification,
  type NotificationType,
  type ToastNotification,
} from '@/lib/notificationStore';

const typeConfig: Record<NotificationType, { icon: typeof Info; color: string; bgColor: string }> = {
  info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  error: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  success: { icon: CheckCircle, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function Toast({ toast, onDismiss }: { toast: ToastNotification; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const config = typeConfig[toast.type];
  const Icon = config.icon;
  
  useEffect(() => {
    if (!toast.showProgress) return;
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [toast.duration, toast.showProgress]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      className={cn(
        'relative w-80 rounded-lg border bg-card shadow-lg overflow-hidden',
        config.bgColor
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5', config.color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{toast.title}</p>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {toast.message}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {toast.showProgress && (
        <div className="h-1 bg-muted">
          <motion.div
            className={cn('h-full', config.color.replace('text-', 'bg-'))}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore();
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
  onDismiss: () => void;
}) {
  const config = typeConfig[notification.type];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors',
        !notification.read && 'bg-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0', config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('font-medium text-sm', !notification.read && 'text-foreground')}>
              {notification.title}
            </p>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatTimeAgo(notification.createdAt)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        </div>
      </div>
      
      <div className="flex justify-end gap-1 mt-2">
        {!notification.read && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onMarkAsRead}>
            <Check className="w-3 h-3 mr-1" />
            Mark read
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onDismiss}>
          <X className="w-3 h-3 mr-1" />
          Dismiss
        </Button>
      </div>
    </motion.div>
  );
}

function NotificationDropdown() {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    getUnreadCount,
    setCenterOpen,
    setPreferencesOpen,
    isDoNotDisturbActive,
  } = useNotificationStore();
  
  const unreadCount = getUnreadCount();
  const isDND = isDoNotDisturbActive();
  const visibleNotifications = notifications.filter((n) => !n.dismissed).slice(0, 10);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          {isDND ? (
            <BellOff className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllAsRead}>
                      <CheckCheck className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark all as read</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreferencesOpen(true)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preferences</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        {isDND && (
          <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2 text-sm text-muted-foreground">
            <Moon className="w-4 h-4" />
            <span>Do Not Disturb is on</span>
          </div>
        )}
        
        <ScrollArea className="max-h-80">
          {visibleNotifications.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {visibleNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onDismiss={() => dismissNotification(notification.id)}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          )}
        </ScrollArea>
        
        {visibleNotifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={clearAll}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear all
              </Button>
              {notifications.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setCenterOpen(true)}
                >
                  View all
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PreferencesSheet() {
  const {
    preferences,
    updatePreferences,
    enableDoNotDisturb,
    disableDoNotDisturb,
    setDoNotDisturbSchedule,
    clearDoNotDisturbSchedule,
    desktopPermission,
    requestDesktopPermission,
    preferencesOpen,
    setPreferencesOpen,
    isDoNotDisturbActive,
  } = useNotificationStore();
  
  const isDND = isDoNotDisturbActive();
  const [dndDuration, setDndDuration] = useState<number | null>(null);
  const [scheduleStart, setScheduleStart] = useState('22:00');
  const [scheduleEnd, setScheduleEnd] = useState('07:00');
  
  const handleDNDToggle = (enabled: boolean) => {
    if (enabled) {
      if (dndDuration) {
        enableDoNotDisturb(dndDuration);
      } else {
        enableDoNotDisturb();
      }
    } else {
      disableDoNotDisturb();
    }
  };
  
  const handleScheduleSet = () => {
    const [startH, startM] = scheduleStart.split(':').map(Number);
    const [endH, endM] = scheduleEnd.split(':').map(Number);
    setDoNotDisturbSchedule(startH * 60 + startM, endH * 60 + endM);
  };
  
  return (
    <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
      <SheetContent className="w-96">
        <SheetHeader>
          <SheetTitle>Notification Preferences</SheetTitle>
          <SheetDescription>
            Configure how you receive notifications
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Moon className="w-4 h-4" />
              Do Not Disturb
            </h4>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Enable DND</p>
                <p className="text-xs text-muted-foreground">
                  Only urgent notifications will alert you
                </p>
              </div>
              <Switch checked={isDND} onCheckedChange={handleDNDToggle} />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Quick DND duration</p>
              <div className="flex gap-2">
                {[30, 60, 120, 480].map((mins) => (
                  <Button
                    key={mins}
                    variant={dndDuration === mins ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDndDuration(mins);
                      enableDoNotDisturb(mins);
                    }}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Schedule</p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="bg-muted px-2 py-1 rounded text-sm"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input
                  type="time"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="bg-muted px-2 py-1 rounded text-sm"
                />
                <Button size="sm" variant="outline" onClick={handleScheduleSet}>
                  <Clock className="w-3 h-3 mr-1" />
                  Set
                </Button>
              </div>
              {preferences.doNotDisturbSchedule && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={clearDoNotDisturbSchedule}
                >
                  Clear schedule
                </Button>
              )}
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Sound
            </h4>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Sound notifications</p>
                <p className="text-xs text-muted-foreground">Play sound for new notifications</p>
              </div>
              <Switch
                checked={preferences.soundEnabled}
                onCheckedChange={(enabled) => updatePreferences({ soundEnabled: enabled })}
              />
            </div>
            
            {preferences.soundEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Volume</span>
                  <span>{Math.round(preferences.soundVolume * 100)}%</span>
                </div>
                <Slider
                  value={preferences.soundVolume * 100}
                  onValueChange={(value) => updatePreferences({ soundVolume: value / 100 })}
                  max={100}
                  step={5}
                />
              </div>
            )}
          </div>
          
          <DropdownMenuSeparator />
          
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Alerts
            </h4>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Toast notifications</p>
                <p className="text-xs text-muted-foreground">Show pop-up toasts</p>
              </div>
              <Switch
                checked={preferences.toastEnabled}
                onCheckedChange={(enabled) => updatePreferences({ toastEnabled: enabled })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Desktop notifications</p>
                <p className="text-xs text-muted-foreground">
                  {desktopPermission === 'granted'
                    ? 'System notifications enabled'
                    : desktopPermission === 'denied'
                    ? 'Blocked by browser'
                    : 'Click to enable'}
                </p>
              </div>
              {desktopPermission === 'granted' ? (
                <Switch
                  checked={preferences.desktopEnabled}
                  onCheckedChange={(enabled) => updatePreferences({ desktopEnabled: enabled })}
                />
              ) : desktopPermission === 'denied' ? (
                <Badge variant="outline" className="text-muted-foreground">Blocked</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={requestDesktopPermission}>
                  Enable
                </Button>
              )}
            </div>
            
            {preferences.toastEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Toast duration</span>
                  <span>{preferences.toastDuration / 1000}s</span>
                </div>
                <Slider
                  value={preferences.toastDuration / 1000}
                  onValueChange={(value) => updatePreferences({ toastDuration: value * 1000 })}
                  min={2}
                  max={10}
                  step={1}
                />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function NotificationCenter() {
  const { setDesktopPermission } = useNotificationStore();
  
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopPermission(Notification.permission);
    }
  }, [setDesktopPermission]);
  
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <NotificationDropdown />
            </div>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ToastContainer />
      <PreferencesSheet />
    </>
  );
}

export default NotificationCenter;
