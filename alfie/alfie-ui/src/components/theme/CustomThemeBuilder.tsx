'use client';

import { useState, useCallback, useId } from 'react';
import { ArrowLeft, Copy, Save, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { 
  Theme, 
  ThemeColors, 
  useTheme, 
  createDefaultCustomColors,
  hslStringToHex,
  hexToHslString,
} from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CustomThemeBuilderProps {
  editTheme?: Theme | null;
  onClose: () => void;
}

interface ColorFieldProps {
  label: string;
  colorKey: keyof ThemeColors;
  value: string;
  onChange: (key: keyof ThemeColors, value: string) => void;
}

function ColorField({ label, colorKey, value, onChange }: ColorFieldProps) {
  const hexValue = hslStringToHex(value);
  const colorInputId = useId();
  const hexInputId = useId();
  
  const handleHexChange = (hex: string) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(colorKey, hexToHslString(hex));
    }
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            id={colorInputId}
            type="color"
            value={hexValue}
            onChange={(e) => handleHexChange(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border border-border overflow-hidden"
            style={{ padding: 0 }}
            aria-label={`${label} color picker`}
          />
        </div>
        <Input
          id={hexInputId}
          value={hexValue}
          onChange={(e) => handleHexChange(e.target.value)}
          className="w-24 font-mono text-xs"
          placeholder="#000000"
          aria-label={`${label} hex value`}
        />
      </div>
    </div>
  );
}

const colorGroups = [
  {
    name: 'Base',
    colors: [
      { key: 'background' as const, label: 'Background' },
      { key: 'foreground' as const, label: 'Foreground' },
    ],
  },
  {
    name: 'Cards & Popovers',
    colors: [
      { key: 'card' as const, label: 'Card' },
      { key: 'cardForeground' as const, label: 'Card Text' },
      { key: 'popover' as const, label: 'Popover' },
      { key: 'popoverForeground' as const, label: 'Popover Text' },
    ],
  },
  {
    name: 'Brand Colors',
    colors: [
      { key: 'primary' as const, label: 'Primary' },
      { key: 'primaryForeground' as const, label: 'Primary Text' },
      { key: 'secondary' as const, label: 'Secondary' },
      { key: 'secondaryForeground' as const, label: 'Secondary Text' },
      { key: 'accent' as const, label: 'Accent' },
      { key: 'accentForeground' as const, label: 'Accent Text' },
    ],
  },
  {
    name: 'Muted',
    colors: [
      { key: 'muted' as const, label: 'Muted' },
      { key: 'mutedForeground' as const, label: 'Muted Text' },
    ],
  },
  {
    name: 'Status',
    colors: [
      { key: 'destructive' as const, label: 'Destructive' },
      { key: 'destructiveForeground' as const, label: 'Destructive Text' },
      { key: 'success' as const, label: 'Success' },
      { key: 'warning' as const, label: 'Warning' },
      { key: 'info' as const, label: 'Info' },
    ],
  },
  {
    name: 'UI Elements',
    colors: [
      { key: 'border' as const, label: 'Border' },
      { key: 'input' as const, label: 'Input' },
      { key: 'ring' as const, label: 'Focus Ring' },
    ],
  },
  {
    name: 'Effects',
    colors: [
      { key: 'glowPrimary' as const, label: 'Primary Glow' },
      { key: 'glowAccent' as const, label: 'Accent Glow' },
    ],
  },
];

export function CustomThemeBuilder({ editTheme, onClose }: CustomThemeBuilderProps) {
  const { createCustomTheme, updateCustomTheme, setActiveTheme } = useTheme();
  
  const nameInputId = useId();
  const descInputId = useId();
  
  const [name, setName] = useState(editTheme?.name || 'My Custom Theme');
  const [description, setDescription] = useState(editTheme?.description || 'A custom theme');
  const [isDark, setIsDark] = useState(editTheme?.isDark ?? true);
  const [colors, setColors] = useState<ThemeColors>(
    editTheme?.colors || createDefaultCustomColors()
  );
  const [showPreview, setShowPreview] = useState(true);

  const handleColorChange = useCallback((key: keyof ThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = () => {
    setColors(createDefaultCustomColors());
    setName('My Custom Theme');
    setDescription('A custom theme');
    setIsDark(true);
  };

  const handleSave = () => {
    if (editTheme && !editTheme.isBuiltIn) {
      updateCustomTheme(editTheme.id, {
        name,
        description,
        colors,
        isDark,
      });
    } else {
      const newId = createCustomTheme(name, description, colors, isDark);
      setActiveTheme(newId);
    }
    onClose();
  };

  const handleDuplicate = () => {
    const newId = createCustomTheme(
      `${name} (Copy)`,
      description,
      colors,
      isDark
    );
    setActiveTheme(newId);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            Preview
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label htmlFor={nameInputId} className="text-sm font-medium">Theme Name</label>
              <Input
                id={nameInputId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Custom Theme"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor={descInputId} className="text-sm font-medium">Description</label>
              <Input
                id={descInputId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Theme Type</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDark(true)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    isDark 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setIsDark(false)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    !isDark 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Light
                </button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-6">
              {colorGroups.map((group) => (
                <div key={group.name}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                    {group.name}
                  </h4>
                  <div className="space-y-1 border rounded-lg p-3 bg-card/50">
                    {group.colors.map((color) => (
                      <ColorField
                        key={color.key}
                        label={color.label}
                        colorKey={color.key}
                        value={colors[color.key]}
                        onChange={handleColorChange}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {showPreview && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Live Preview</h4>
            <div 
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: `hsl(${colors.background})` }}
            >
              <div 
                className="p-4 border-b"
                style={{ 
                  backgroundColor: `hsl(${colors.card})`,
                  borderColor: `hsl(${colors.border})`
                }}
              >
                <div 
                  className="h-4 w-32 rounded"
                  style={{ backgroundColor: `hsl(${colors.foreground})` }}
                />
                <div 
                  className="h-3 w-24 rounded mt-2 opacity-60"
                  style={{ backgroundColor: `hsl(${colors.mutedForeground})` }}
                />
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex gap-2">
                  <div 
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ 
                      backgroundColor: `hsl(${colors.primary})`,
                      color: `hsl(${colors.primaryForeground})`
                    }}
                  >
                    Primary
                  </div>
                  <div 
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ 
                      backgroundColor: `hsl(${colors.secondary})`,
                      color: `hsl(${colors.secondaryForeground})`
                    }}
                  >
                    Secondary
                  </div>
                  <div 
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ 
                      backgroundColor: `hsl(${colors.accent})`,
                      color: `hsl(${colors.accentForeground})`
                    }}
                  >
                    Accent
                  </div>
                </div>
                
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `hsl(${colors.muted})` }}
                >
                  <div 
                    className="text-sm"
                    style={{ color: `hsl(${colors.mutedForeground})` }}
                  >
                    Muted content area
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <div 
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: `hsl(${colors.success})` }}
                  />
                  <div 
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: `hsl(${colors.warning})` }}
                  />
                  <div 
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: `hsl(${colors.info})` }}
                  />
                  <div 
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: `hsl(${colors.destructive})` }}
                  />
                </div>
                
                <div 
                  className="p-3 rounded-lg border"
                  style={{ 
                    borderColor: `hsl(${colors.border})`,
                    backgroundColor: `hsl(${colors.input})`
                  }}
                >
                  <div 
                    className="text-sm opacity-50"
                    style={{ color: `hsl(${colors.foreground})` }}
                  >
                    Input field placeholder
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t">
        {editTheme && !editTheme.isBuiltIn ? (
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {editTheme && !editTheme.isBuiltIn ? 'Update Theme' : 'Create Theme'}
          </Button>
        </div>
      </div>
    </div>
  );
}
