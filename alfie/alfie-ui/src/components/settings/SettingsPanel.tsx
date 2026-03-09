'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Globe,
  Clock,
  MessageSquare,
  Bot,
  Thermometer,
  Hash,
  Mic,
  Volume2,
  Bell,
  BellOff,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Code,
  Terminal,
  Beaker,
  Download,
  Upload,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Zap,
  Database,
  Timer,
  Accessibility,
  User,
  LogOut,
  KeyRound,
  Mail,
  BadgeCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  usePreferencesStore,
  availableModels,
  availableVoices,
  commonTimezones,
  type TTSVoice,
} from '@/lib/preferences';
import { useLocaleStore } from '@/lib/i18n';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import { AccessibilityPanel } from './AccessibilityPanel';
import { useAuthStore } from '@/lib/authStore';
import { apiFetch } from '@/lib/apiClient';

type SettingsTab = 'profile' | 'general' | 'chat' | 'voice' | 'notifications' | 'privacy' | 'accessibility' | 'advanced';

const localeOptions = locales.map((locale) => ({
  value: locale,
  label: `${localeFlags[locale]} ${localeNames[locale]}`,
}));

export function SettingsPanel() {
  const t = useTranslations('settings');
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'general', label: t('tabs.general'), icon: Settings },
    { id: 'chat', label: t('tabs.chat'), icon: MessageSquare },
    { id: 'voice', label: t('tabs.voice'), icon: Mic },
    { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
    { id: 'privacy', label: t('tabs.privacy'), icon: Shield },
    { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
    { id: 'advanced', label: t('tabs.advanced'), icon: Code },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{t('title')}</h2>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <nav className="w-56 border-r border-border p-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  'hover:bg-accent/50',
                  isActive && 'bg-primary/10 text-primary'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1 text-left">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="settings-tab-indicator"
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'profile' && <ProfileSettings />}
                {activeTab === 'general' && <GeneralSettings />}
                {activeTab === 'chat' && <ChatSettings />}
                {activeTab === 'voice' && <VoiceSettings />}
                {activeTab === 'notifications' && <NotificationSettings />}
                {activeTab === 'privacy' && <PrivacySettings />}
                {activeTab === 'accessibility' && <AccessibilityPanel />}
                {activeTab === 'advanced' && <AdvancedSettings />}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ProfileSettings() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateError, setUpdateError] = useState('');

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || newUsername === user?.username) return;
    setIsUpdating(true);
    setUpdateMessage('');
    setUpdateError('');
    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update username');
      }
      setUpdateMessage('Username updated successfully');
      const stored = localStorage.getItem('alfie_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.username = newUsername.trim();
        localStorage.setItem('alfie_user', JSON.stringify(parsed));
      }
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setUpdateError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setUpdateError('Password must be at least 6 characters');
      return;
    }
    setIsUpdating(true);
    setUpdateMessage('');
    setUpdateError('');
    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to change password');
      }
      setUpdateMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <SettingSection title="Account" description="Your account information">
        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-lg">{user?.username || 'Unknown'}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                {user?.email || 'No email'}
              </div>
            </div>
            {user?.isVerified && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <BadgeCheck className="w-3.5 h-3.5" />
                Verified
              </div>
            )}
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Roles</span>
              <p className="font-medium mt-0.5">{user?.roles?.join(', ') || 'user'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium mt-0.5">{user?.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Update Username">
        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">Username</Label>
              <p className="text-xs text-muted-foreground">Change your display name</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="New username"
              className="flex-1"
            />
            <Button
              onClick={handleUpdateUsername}
              disabled={isUpdating || !newUsername.trim() || newUsername === user?.username}
              className="px-6"
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Change Password">
        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">Password</Label>
              <p className="text-xs text-muted-foreground">Update your account password</p>
            </div>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
            <Button
              onClick={handleChangePassword}
              disabled={isUpdating || !currentPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {isUpdating ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </div>
      </SettingSection>

      {(updateMessage || updateError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-3 rounded-lg text-sm mb-4',
            updateMessage ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
          )}
        >
          {updateMessage || updateError}
        </motion.div>
      )}

      <SettingSection title="Sign Out">
        <Button
          variant="outline"
          onClick={logout}
          className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
        >
          <LogOut className="w-4 h-4" />
          Sign out of ALFIE
        </Button>
      </SettingSection>
    </>
  );
}

function SettingSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, children }: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </motion.div>
  );
}

function GeneralSettings() {
  const t = useTranslations('settings.general');
  const { general, updateGeneral } = usePreferencesStore();
  const { locale, setLocale } = useLocaleStore();

  return (
    <>
      <SettingSection title={t('appearance')} description={t('appearanceDesc')}>
        <SettingRow icon={Monitor} label={t('theme')} description={t('themeDesc')}>
          <div className="flex gap-2">
            {[
              { value: 'light', icon: Sun, label: t('light') },
              { value: 'dark', icon: Moon, label: t('dark') },
              { value: 'system', icon: Monitor, label: t('system') },
            ].map((theme) => {
              const ThemeIcon = theme.icon;
              const isActive = general.theme === theme.value;
              return (
                <button
                  type="button"
                  key={theme.value}
                  onClick={() => updateGeneral({ theme: theme.value as 'light' | 'dark' | 'system' })}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  <ThemeIcon className="w-4 h-4" />
                  {theme.label}
                </button>
              );
            })}
          </div>
        </SettingRow>

        <SettingRow icon={Sparkles} label={t('reducedMotion')} description={t('reducedMotionDesc')}>
          <Switch
            checked={general.reducedMotion}
            onCheckedChange={(checked) => updateGeneral({ reducedMotion: checked })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('localization')} description={t('localizationDesc')}>
        <SettingRow icon={Globe} label={t('language')} description={t('languageDesc')}>
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
            options={localeOptions}
            className="w-48"
          />
        </SettingRow>

        <SettingRow icon={Clock} label={t('timezone')} description={t('timezoneDesc')}>
          <Select
            value={general.timezone}
            onValueChange={(value) => updateGeneral({ timezone: value })}
            options={commonTimezones}
            className="w-48"
          />
        </SettingRow>

        <SettingRow icon={Clock} label={t('timeFormat')} description={t('timeFormatDesc')}>
          <div className="flex gap-2">
            {['12h', '24h'].map((format) => (
              <button
                type="button"
                key={format}
                onClick={() => updateGeneral({ dateFormat: format as '12h' | '24h' })}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  general.dateFormat === format
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {format === '12h' ? t('12hour') : t('24hour')}
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingSection>
    </>
  );
}

function ChatSettings() {
  const t = useTranslations('settings.chatSettings');
  const { chat, updateChat } = usePreferencesStore();

  return (
    <>
      <SettingSection title={t('modelConfig')} description={t('modelConfigDesc')}>
        <SettingRow icon={Bot} label={t('model')} description={t('modelDesc')}>
          <Select
            value={chat.model}
            onValueChange={(value) => updateChat({ model: value })}
            options={availableModels}
            className="w-48"
          />
        </SettingRow>

        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Thermometer className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('temperature')}</Label>
              <p className="text-xs text-muted-foreground">{t('temperatureDesc')}</p>
            </div>
            <span className="text-sm font-mono text-muted-foreground w-12 text-right">{chat.temperature}</span>
          </div>
          <Slider
            value={chat.temperature}
            onValueChange={(value) => updateChat({ temperature: value })}
            min={0}
            max={2}
            step={0.1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('precise')}</span>
            <span>{t('balanced')}</span>
            <span>{t('creative')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Hash className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('maxTokens')}</Label>
              <p className="text-xs text-muted-foreground">{t('maxTokensDesc')}</p>
            </div>
            <span className="text-sm font-mono text-muted-foreground w-16 text-right">{chat.maxTokens}</span>
          </div>
          <Slider
            value={chat.maxTokens}
            onValueChange={(value) => updateChat({ maxTokens: value })}
            min={256}
            max={8192}
            step={256}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>256</span>
            <span>4096</span>
            <span>8192</span>
          </div>
        </div>
      </SettingSection>

      <SettingSection title={t('chatBehavior')} description={t('chatBehaviorDesc')}>
        <SettingRow icon={Zap} label={t('streamResponses')} description={t('streamResponsesDesc')}>
          <Switch
            checked={chat.streamResponses}
            onCheckedChange={(checked) => updateChat({ streamResponses: checked })}
          />
        </SettingRow>

        <SettingRow icon={Eye} label={t('showThinking')} description={t('showThinkingDesc')}>
          <Switch
            checked={chat.showThinking}
            onCheckedChange={(checked) => updateChat({ showThinking: checked })}
          />
        </SettingRow>

        <SettingRow icon={Code} label={t('codeHighlighting')} description={t('codeHighlightingDesc')}>
          <Switch
            checked={chat.codeHighlighting}
            onCheckedChange={(checked) => updateChat({ codeHighlighting: checked })}
          />
        </SettingRow>

        <SettingRow icon={ChevronRight} label={t('autoScroll')} description={t('autoScrollDesc')}>
          <Switch
            checked={chat.autoScroll}
            onCheckedChange={(checked) => updateChat({ autoScroll: checked })}
          />
        </SettingRow>
      </SettingSection>
    </>
  );
}

function VoiceSettings() {
  const t = useTranslations('settings.voiceSettings');
  const { voice, updateVoice } = usePreferencesStore();

  return (
    <>
      <SettingSection title={t('tts')} description={t('ttsDesc')}>
        <SettingRow icon={Volume2} label={t('enableTts')} description={t('enableTtsDesc')}>
          <Switch
            checked={voice.enabled}
            onCheckedChange={(checked) => updateVoice({ enabled: checked })}
          />
        </SettingRow>

        <SettingRow icon={Mic} label={t('voice')} description={t('voiceDesc')}>
          <Select
            value={voice.ttsVoice}
            onValueChange={(value) => updateVoice({ ttsVoice: value as TTSVoice })}
            options={availableVoices}
            className="w-40"
            disabled={!voice.enabled}
          />
        </SettingRow>

        <div className={cn('p-4 rounded-xl border border-border bg-card/50 space-y-4', !voice.enabled && 'opacity-50')}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Zap className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('speechSpeed')}</Label>
              <p className="text-xs text-muted-foreground">{t('speechSpeedDesc')}</p>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{voice.ttsSpeed}x</span>
          </div>
          <Slider
            value={voice.ttsSpeed}
            onValueChange={(value) => updateVoice({ ttsSpeed: value })}
            min={0.5}
            max={2}
            step={0.1}
            disabled={!voice.enabled}
          />
        </div>

        <div className={cn('p-4 rounded-xl border border-border bg-card/50 space-y-4', !voice.enabled && 'opacity-50')}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('volume')}</Label>
              <p className="text-xs text-muted-foreground">{t('volumeDesc')}</p>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{Math.round(voice.ttsVolume * 100)}%</span>
          </div>
          <Slider
            value={voice.ttsVolume * 100}
            onValueChange={(value) => updateVoice({ ttsVolume: value / 100 })}
            min={0}
            max={100}
            step={5}
            disabled={!voice.enabled}
          />
        </div>
      </SettingSection>

      <SettingSection title={t('stt')} description={t('sttDesc')}>
        <SettingRow icon={Mic} label={t('enableStt')} description={t('enableSttDesc')}>
          <Switch
            checked={voice.sttEnabled}
            onCheckedChange={(checked) => updateVoice({ sttEnabled: checked })}
          />
        </SettingRow>

        <SettingRow icon={Mic} label={t('autoListen')} description={t('autoListenDesc')}>
          <Switch
            checked={voice.autoListen}
            onCheckedChange={(checked) => updateVoice({ autoListen: checked })}
            disabled={!voice.sttEnabled}
          />
        </SettingRow>
      </SettingSection>
    </>
  );
}

function NotificationSettings() {
  const t = useTranslations('settings.notificationSettings');
  const { notifications, updateNotifications } = usePreferencesStore();

  return (
    <SettingSection title={t('title')} description={t('titleDesc')}>
      <SettingRow icon={Bell} label={t('enable')} description={t('enableDesc')}>
        <Switch
          checked={notifications.enabled}
          onCheckedChange={(checked) => updateNotifications({ enabled: checked })}
        />
      </SettingRow>

      <div className={cn('space-y-4', !notifications.enabled && 'opacity-50 pointer-events-none')}>
        <SettingRow icon={Volume2} label={t('sound')} description={t('soundDesc')}>
          <Switch
            checked={notifications.sound}
            onCheckedChange={(checked) => updateNotifications({ sound: checked })}
          />
        </SettingRow>

        <SettingRow icon={Monitor} label={t('desktop')} description={t('desktopDesc')}>
          <Switch
            checked={notifications.desktop}
            onCheckedChange={(checked) => updateNotifications({ desktop: checked })}
          />
        </SettingRow>

        <Separator className="my-4" />

        <p className="text-sm font-medium text-muted-foreground">{t('notifyAbout')}</p>

        <SettingRow icon={MessageSquare} label={t('newMessage')} description={t('newMessageDesc')}>
          <Switch
            checked={notifications.newMessage}
            onCheckedChange={(checked) => updateNotifications({ newMessage: checked })}
          />
        </SettingRow>

        <SettingRow icon={Zap} label={t('taskComplete')} description={t('taskCompleteDesc')}>
          <Switch
            checked={notifications.taskComplete}
            onCheckedChange={(checked) => updateNotifications({ taskComplete: checked })}
          />
        </SettingRow>

        <SettingRow icon={BellOff} label={t('errors')} description={t('errorsDesc')}>
          <Switch
            checked={notifications.errors}
            onCheckedChange={(checked) => updateNotifications({ errors: checked })}
          />
        </SettingRow>
      </div>
    </SettingSection>
  );
}

function PrivacySettings() {
  const t = useTranslations('settings.privacySettings');
  const { privacy, updatePrivacy } = usePreferencesStore();

  return (
    <>
      <SettingSection title={t('dataPrivacy')} description={t('dataPrivacyDesc')}>
        <SettingRow icon={Database} label={t('saveHistory')} description={t('saveHistoryDesc')}>
          <Switch
            checked={privacy.saveHistory}
            onCheckedChange={(checked) => updatePrivacy({ saveHistory: checked })}
          />
        </SettingRow>

        <SettingRow icon={Eye} label={t('shareAnalytics')} description={t('shareAnalyticsDesc')}>
          <Switch
            checked={privacy.shareAnalytics}
            onCheckedChange={(checked) => updatePrivacy({ shareAnalytics: checked })}
          />
        </SettingRow>

        <SettingRow icon={EyeOff} label={t('showOnlineStatus')} description={t('showOnlineStatusDesc')}>
          <Switch
            checked={privacy.showOnlineStatus}
            onCheckedChange={(checked) => updatePrivacy({ showOnlineStatus: checked })}
          />
        </SettingRow>

        <SettingRow icon={Trash2} label={t('clearOnExit')} description={t('clearOnExitDesc')}>
          <Switch
            checked={privacy.clearOnExit}
            onCheckedChange={(checked) => updatePrivacy({ clearOnExit: checked })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('dangerZone')}>
        <div className="p-4 rounded-xl border border-destructive/50 bg-destructive/5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t('clearAllData')}</p>
              <p className="text-xs text-muted-foreground">{t('clearAllDataDesc')}</p>
            </div>
            <Button variant="destructive" size="sm">
              {t('clearDataButton')}
            </Button>
          </div>
        </div>
      </SettingSection>
    </>
  );
}

function AdvancedSettings() {
  const t = useTranslations('settings.advancedSettings');
  const { advanced, updateAdvanced, exportSettings, importSettings, resetToDefaults } = usePreferencesStore();
  const tCommon = useTranslations('common');
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    const json = exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alfie-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const success = importSettings(content);
        if (!success) {
          setImportError(t('importError'));
          setTimeout(() => setImportError(null), 3000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <>
      <SettingSection title={t('developerOptions')} description={t('developerOptionsDesc')}>
        <SettingRow icon={Terminal} label={t('developerMode')} description={t('developerModeDesc')}>
          <Switch
            checked={advanced.developerMode}
            onCheckedChange={(checked) => updateAdvanced({ developerMode: checked })}
          />
        </SettingRow>

        <SettingRow icon={Code} label={t('showDebugInfo')} description={t('showDebugInfoDesc')}>
          <Switch
            checked={advanced.showDebugInfo}
            onCheckedChange={(checked) => updateAdvanced({ showDebugInfo: checked })}
            disabled={!advanced.developerMode}
          />
        </SettingRow>

        <SettingRow icon={Beaker} label={t('experimentalFeatures')} description={t('experimentalFeaturesDesc')}>
          <Switch
            checked={advanced.experimentalFeatures}
            onCheckedChange={(checked) => updateAdvanced({ experimentalFeatures: checked })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('apiConfig')} description={t('apiConfigDesc')}>
        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('apiEndpoint')}</Label>
              <p className="text-xs text-muted-foreground">{t('apiEndpointDesc')}</p>
            </div>
          </div>
          <Input
            value={advanced.apiEndpoint}
            onChange={(e) => updateAdvanced({ apiEndpoint: e.target.value })}
            placeholder={t('apiEndpointPlaceholder')}
            className="font-mono text-sm"
          />
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Database className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('maxContextLength')}</Label>
              <p className="text-xs text-muted-foreground">{t('maxContextLengthDesc')}</p>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{advanced.maxContextLength.toLocaleString()}</span>
          </div>
          <Slider
            value={advanced.maxContextLength}
            onValueChange={(value) => updateAdvanced({ maxContextLength: value })}
            min={4096}
            max={200000}
            step={4096}
          />
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Timer className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('requestTimeout')}</Label>
              <p className="text-xs text-muted-foreground">{t('requestTimeoutDesc')}</p>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{advanced.requestTimeout}s</span>
          </div>
          <Slider
            value={advanced.requestTimeout}
            onValueChange={(value) => updateAdvanced({ requestTimeout: value })}
            min={10}
            max={300}
            step={10}
          />
        </div>
      </SettingSection>

      <SettingSection title={t('systemPrompt')}>
        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-medium">{t('customSystemPrompt')}</Label>
              <p className="text-xs text-muted-foreground">{t('customSystemPromptDesc')}</p>
            </div>
          </div>
          <textarea
            value={advanced.customSystemPrompt}
            onChange={(e) => updateAdvanced({ customSystemPrompt: e.target.value })}
            placeholder={t('systemPromptPlaceholder')}
            className="w-full h-32 px-3 py-2 rounded-lg border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </SettingSection>

      <SettingSection title={t('backupRestore')}>
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            {tCommon('export')}
          </Button>
          <Button variant="outline" onClick={handleImport} className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {tCommon('import')}
          </Button>
          <Button variant="outline" onClick={resetToDefaults} className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            {tCommon('reset')}
          </Button>
        </div>
        {importError && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-destructive mt-2"
          >
            {importError}
          </motion.p>
        )}
      </SettingSection>
    </>
  );
}
