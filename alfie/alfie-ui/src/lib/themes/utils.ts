import { HSLColor, RGBColor, ThemeColors } from './types';

export function parseHSL(hslString: string): HSLColor {
  const parts = hslString.split(' ');
  return {
    h: parseFloat(parts[0]) || 0,
    s: parseFloat(parts[1]?.replace('%', '')) || 0,
    l: parseFloat(parts[2]?.replace('%', '')) || 0,
  };
}

export function hslToString(hsl: HSLColor): string {
  return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`;
}

export function hslToRgb(hsl: HSLColor): RGBColor {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function rgbToHsl(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

export function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function rgbToHex(rgb: RGBColor): string {
  return `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
}

export function hslStringToHex(hslString: string): string {
  const hsl = parseHSL(hslString);
  const rgb = hslToRgb(hsl);
  return rgbToHex(rgb);
}

export function hexToHslString(hex: string): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  return hslToString(hsl);
}

export function applyThemeToDocument(colors: ThemeColors): void {
  const root = document.documentElement;
  
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--card-foreground', colors.cardForeground);
  root.style.setProperty('--popover', colors.popover);
  root.style.setProperty('--popover-foreground', colors.popoverForeground);
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-foreground', colors.accentForeground);
  root.style.setProperty('--destructive', colors.destructive);
  root.style.setProperty('--destructive-foreground', colors.destructiveForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input', colors.input);
  root.style.setProperty('--ring', colors.ring);
  root.style.setProperty('--glow-primary', colors.glowPrimary);
  root.style.setProperty('--glow-accent', colors.glowAccent);
  root.style.setProperty('--success', colors.success);
  root.style.setProperty('--warning', colors.warning);
  root.style.setProperty('--info', colors.info);
}

export function removeThemeFromDocument(): void {
  const root = document.documentElement;
  const props = [
    '--background', '--foreground', '--card', '--card-foreground',
    '--popover', '--popover-foreground', '--primary', '--primary-foreground',
    '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
    '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
    '--border', '--input', '--ring', '--glow-primary', '--glow-accent',
    '--success', '--warning', '--info'
  ];
  
  for (const prop of props) {
    root.style.removeProperty(prop);
  }
}

export function generateThemeId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isValidThemeColors(colors: unknown): colors is ThemeColors {
  if (!colors || typeof colors !== 'object') return false;
  
  const requiredKeys: (keyof ThemeColors)[] = [
    'background', 'foreground', 'card', 'cardForeground',
    'popover', 'popoverForeground', 'primary', 'primaryForeground',
    'secondary', 'secondaryForeground', 'muted', 'mutedForeground',
    'accent', 'accentForeground', 'destructive', 'destructiveForeground',
    'border', 'input', 'ring', 'glowPrimary', 'glowAccent',
    'success', 'warning', 'info'
  ];
  
  return requiredKeys.every(key => 
    key in colors && typeof (colors as Record<string, unknown>)[key] === 'string'
  );
}
