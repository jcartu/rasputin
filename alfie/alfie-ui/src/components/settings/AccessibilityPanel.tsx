'use client';

import { motion } from 'framer-motion';
import {
  Eye,
  Type,
  MousePointer2,
  Volume2,
  Keyboard,
  Contrast,
  ScanEye,
  Link2,
  Target,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  useAccessibilityStore,
  fontSizeScale,
  type FontSize,
  type ContrastMode,
  type FocusIndicator,
} from '@/lib/accessibility';

const fontSizeOptions: { value: FontSize; label: string; description: string }[] = [
  { value: 'small', label: 'Small', description: '87.5%' },
  { value: 'medium', label: 'Medium', description: '100%' },
  { value: 'large', label: 'Large', description: '112.5%' },
  { value: 'extra-large', label: 'Extra Large', description: '125%' },
];

const contrastOptions: { value: ContrastMode; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'Default contrast' },
  { value: 'high', label: 'High', description: 'Increased contrast' },
  { value: 'highest', label: 'Maximum', description: 'Black & white' },
];

const focusOptions: { value: FocusIndicator; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Standard browser focus' },
  { value: 'enhanced', label: 'Enhanced', description: 'More visible outline' },
  { value: 'high-visibility', label: 'High Visibility', description: 'Large glow effect' },
];

function SettingSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8" aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="mb-4">
        <h3 id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`} className="text-lg font-semibold">
          {title}
        </h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SettingRow({ icon: Icon, label, description, children, id }: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center" aria-hidden="true">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <Label id={id ? `${id}-label` : undefined} className="text-sm font-medium">{label}</Label>
          {description && <p id={id ? `${id}-desc` : undefined} className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </motion.div>
  );
}

export function AccessibilityPanel() {
  const {
    fontSize,
    contrastMode,
    reducedMotion,
    reducedTransparency,
    focusIndicator,
    focusHighlightColor,
    announceMessages,
    announceToolCalls,
    verboseDescriptions,
    enableKeyboardNavigation,
    showKeyboardShortcuts,
    dyslexicFont,
    underlineLinks,
    largeClickTargets,
    setFontSize,
    setContrastMode,
    setReducedMotion,
    setFocusIndicator,
    updatePreference,
    resetToDefaults,
  } = useAccessibilityStore();

  return (
    <section aria-label="Accessibility Settings">
      <SettingSection title="Vision" description="Adjust visual settings for better readability">
        <SettingRow icon={Type} label="Font Size" description="Adjust text size throughout the app" id="font-size">
          <fieldset className="flex gap-1" aria-label="Font size options">
            {fontSizeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFontSize(option.value)}
                aria-pressed={fontSize === option.value}
                aria-describedby={`font-${option.value}-desc`}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  fontSize === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {option.label}
                <span id={`font-${option.value}-desc`} className="sr-only">
                  {option.description}
                </span>
              </button>
            ))}
          </fieldset>
        </SettingRow>

        <SettingRow icon={Contrast} label="Contrast Mode" description="Increase color contrast for better visibility" id="contrast">
          <fieldset className="flex gap-1" aria-label="Contrast mode options">
            {contrastOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setContrastMode(option.value)}
                aria-pressed={contrastMode === option.value}
                aria-describedby={`contrast-${option.value}-desc`}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  contrastMode === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {option.label}
                <span id={`contrast-${option.value}-desc`} className="sr-only">
                  {option.description}
                </span>
              </button>
            ))}
          </fieldset>
        </SettingRow>

        <SettingRow icon={Eye} label="Dyslexia-Friendly Font" description="Use OpenDyslexic font for easier reading" id="dyslexic">
          <Switch
            checked={dyslexicFont}
            onCheckedChange={(checked) => updatePreference('dyslexicFont', checked)}
            aria-describedby="dyslexic-desc"
          />
        </SettingRow>

        <SettingRow icon={Link2} label="Underline Links" description="Always show underlines on links" id="underline-links">
          <Switch
            checked={underlineLinks}
            onCheckedChange={(checked) => updatePreference('underlineLinks', checked)}
            aria-describedby="underline-links-desc"
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Motion" description="Control animations and transitions">
        <SettingRow icon={Sparkles} label="Reduced Motion" description="Minimize animations and transitions" id="reduced-motion">
          <Switch
            checked={reducedMotion}
            onCheckedChange={setReducedMotion}
            aria-describedby="reduced-motion-desc"
          />
        </SettingRow>

        <SettingRow icon={Eye} label="Reduced Transparency" description="Remove blur effects and transparency" id="reduced-transparency">
          <Switch
            checked={reducedTransparency}
            onCheckedChange={(checked) => updatePreference('reducedTransparency', checked)}
            aria-describedby="reduced-transparency-desc"
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Focus & Navigation" description="Customize keyboard navigation and focus indicators">
        <SettingRow icon={ScanEye} label="Focus Indicator" description="How focus is shown on interactive elements" id="focus-indicator">
          <fieldset className="flex gap-1" aria-label="Focus indicator options">
            {focusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFocusIndicator(option.value)}
                aria-pressed={focusIndicator === option.value}
                aria-describedby={`focus-${option.value}-desc`}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-all',
                  focusIndicator === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {option.label}
                <span id={`focus-${option.value}-desc`} className="sr-only">
                  {option.description}
                </span>
              </button>
            ))}
          </fieldset>
        </SettingRow>

        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center" aria-hidden="true">
              <MousePointer2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label htmlFor="focus-color" className="text-sm font-medium">Focus Color</Label>
              <p className="text-xs text-muted-foreground">Choose focus highlight color</p>
            </div>
            <input
              id="focus-color"
              type="color"
              value={focusHighlightColor}
              onChange={(e) => updatePreference('focusHighlightColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              aria-label="Focus highlight color picker"
            />
          </div>
        </div>

        <SettingRow icon={Keyboard} label="Keyboard Navigation" description="Enable full keyboard navigation" id="keyboard-nav">
          <Switch
            checked={enableKeyboardNavigation}
            onCheckedChange={(checked) => updatePreference('enableKeyboardNavigation', checked)}
            aria-describedby="keyboard-nav-desc"
          />
        </SettingRow>

        <SettingRow icon={Keyboard} label="Show Keyboard Shortcuts" description="Display keyboard shortcut hints" id="show-shortcuts">
          <Switch
            checked={showKeyboardShortcuts}
            onCheckedChange={(checked) => updatePreference('showKeyboardShortcuts', checked)}
            aria-describedby="show-shortcuts-desc"
          />
        </SettingRow>

        <SettingRow icon={Target} label="Large Click Targets" description="Increase size of buttons and links (48px minimum)" id="large-targets">
          <Switch
            checked={largeClickTargets}
            onCheckedChange={(checked) => updatePreference('largeClickTargets', checked)}
            aria-describedby="large-targets-desc"
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Screen Reader" description="Configure screen reader announcements">
        <SettingRow icon={Volume2} label="Announce Messages" description="Announce new chat messages to screen readers" id="announce-messages">
          <Switch
            checked={announceMessages}
            onCheckedChange={(checked) => updatePreference('announceMessages', checked)}
            aria-describedby="announce-messages-desc"
          />
        </SettingRow>

        <SettingRow icon={Volume2} label="Announce Tool Calls" description="Announce when AI tools are being used" id="announce-tools">
          <Switch
            checked={announceToolCalls}
            onCheckedChange={(checked) => updatePreference('announceToolCalls', checked)}
            aria-describedby="announce-tools-desc"
          />
        </SettingRow>

        <SettingRow icon={Volume2} label="Verbose Descriptions" description="Provide more detailed descriptions for screen readers" id="verbose">
          <Switch
            checked={verboseDescriptions}
            onCheckedChange={(checked) => updatePreference('verboseDescriptions', checked)}
            aria-describedby="verbose-desc"
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Reset">
        <div className="p-4 rounded-xl border border-border bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reset Accessibility Settings</p>
              <p className="text-xs text-muted-foreground">Restore all accessibility options to defaults</p>
            </div>
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="flex items-center gap-2"
              aria-label="Reset all accessibility settings to default values"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>
      </SettingSection>
    </section>
  );
}
