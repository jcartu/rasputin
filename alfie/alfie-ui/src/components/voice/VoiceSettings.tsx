'use client';

import { motion } from 'framer-motion';
import { Volume2, Mic, Gauge, Play, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVoiceStore, ELEVENLABS_VOICES } from '@/lib/store';

interface VoiceSettingsProps {
  className?: string;
}

export function VoiceSettings({ className }: VoiceSettingsProps) {
  const {
    selectedVoiceId,
    speed,
    autoPlay,
    voiceEnabled,
    setSelectedVoice,
    setSpeed,
    setAutoPlay,
    setVoiceEnabled,
  } = useVoiceStore();

  const selectedVoice = ELEVENLABS_VOICES.find(v => v.id === selectedVoiceId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-6', className)}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
          <Settings2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Voice Settings</h3>
          <p className="text-xs text-muted-foreground">Configure JARVIS-like voice interface</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-primary" />
            <div>
              <span className="text-sm font-medium">Voice Output</span>
              <p className="text-xs text-muted-foreground">Enable text-to-speech</p>
            </div>
          </div>
          <ToggleSwitch enabled={voiceEnabled} onChange={setVoiceEnabled} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <Play className="w-4 h-4 text-primary" />
            <div>
              <span className="text-sm font-medium">Auto-Play</span>
              <p className="text-xs text-muted-foreground">Speak responses automatically</p>
            </div>
          </div>
          <ToggleSwitch enabled={autoPlay} onChange={setAutoPlay} disabled={!voiceEnabled} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Voice Selection</span>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {ELEVENLABS_VOICES.map((voice) => (
            <motion.button
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!voiceEnabled}
              className={cn(
                'p-3 rounded-xl text-left transition-all border',
                voice.id === selectedVoiceId
                  ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/30'
                  : 'bg-card border-border hover:border-primary/30',
                !voiceEnabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-start gap-2">
                {voice.name === 'Daniel' && (
                  <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="text-sm font-medium block truncate">{voice.name}</span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {voice.description}
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
        {selectedVoice && (
          <p className="text-xs text-muted-foreground">
            Selected: <span className="text-primary font-medium">{selectedVoice.name}</span>
            {selectedVoice.name === 'Daniel' && (
              <span className="ml-1 text-amber-500">(JARVIS-like)</span>
            )}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Speed</span>
          </div>
          <span className="text-sm text-muted-foreground font-mono">{speed.toFixed(1)}x</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            disabled={!voiceEnabled}
            className={cn(
              'w-full h-2 rounded-full appearance-none cursor-pointer',
              'bg-gradient-to-r from-primary/20 via-primary/40 to-accent/20',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:w-4',
              '[&::-webkit-slider-thumb]:h-4',
              '[&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-primary',
              '[&::-webkit-slider-thumb]:shadow-lg',
              '[&::-webkit-slider-thumb]:shadow-primary/30',
              '[&::-webkit-slider-thumb]:cursor-pointer',
              '[&::-webkit-slider-thumb]:transition-transform',
              '[&::-webkit-slider-thumb]:hover:scale-110',
              !voiceEnabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">Slow</span>
            <span className="text-[10px] text-muted-foreground">Normal</span>
            <span className="text-[10px] text-muted-foreground">Fast</span>
          </div>
        </div>
      </div>

      <motion.div
        className="p-4 rounded-xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border border-primary/10"
        animate={{
          borderColor: ['hsl(var(--primary) / 0.1)', 'hsl(var(--primary) / 0.3)', 'hsl(var(--primary) / 0.1)'],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">JARVIS Mode</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Experience AI assistance like Tony Stark. Enable voice output and auto-play for the full 
          JARVIS experience. Try the Daniel voice for the most authentic feel.
        </p>
      </motion.div>
    </motion.div>
  );
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled }: ToggleSwitchProps) {
  return (
    <motion.button
      onClick={() => !disabled && onChange(!enabled)}
      className={cn(
        'relative w-12 h-6 rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-muted',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
        animate={{ left: enabled ? '1.75rem' : '0.25rem' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.button>
  );
}

export function VoiceSettingsCompact() {
  const { voiceEnabled, autoPlay, setVoiceEnabled, setAutoPlay } = useVoiceStore();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setVoiceEnabled(!voiceEnabled)}
        className={cn(
          'h-8 w-8 rounded-lg',
          voiceEnabled ? 'text-primary bg-primary/10' : 'text-muted-foreground'
        )}
      >
        <Volume2 className="w-4 h-4" />
      </Button>
      {voiceEnabled && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAutoPlay(!autoPlay)}
          className={cn(
            'h-8 w-8 rounded-lg',
            autoPlay ? 'text-primary bg-primary/10' : 'text-muted-foreground'
          )}
        >
          <Play className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
