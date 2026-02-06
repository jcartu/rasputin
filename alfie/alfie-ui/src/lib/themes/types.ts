export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  glowPrimary: string;
  glowAccent: string;
  success: string;
  warning: string;
  info: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  isDark: boolean;
  isBuiltIn: boolean;
}

export interface CustomTheme extends Theme {
  isBuiltIn: false;
  createdAt: Date;
  updatedAt: Date;
}

export type ThemeId = 
  | 'dark' 
  | 'light' 
  | 'synthwave' 
  | 'nord' 
  | 'dracula' 
  | 'solarized-dark'
  | 'solarized-light'
  | string;

export interface ThemePreferences {
  activeThemeId: ThemeId;
  customThemes: CustomTheme[];
  systemPreference: boolean;
  transitionsEnabled: boolean;
}

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}
