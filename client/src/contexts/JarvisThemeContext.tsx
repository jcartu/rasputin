import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = 
  | "cyber-blue" 
  | "code-red" 
  | "matrix-green" 
  | "void-purple" 
  | "solar-gold" 
  | "ice-white" 
  | "stealth-obsidian" 
  | "neon-pink" 
  | "radioactive-orange" 
  | "deep-ocean";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "cyber-blue",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("rasputin-theme");
    return (stored as Theme) || defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all existing theme classes
    root.classList.remove(
      "theme-cyber-blue",
      "theme-code-red",
      "theme-matrix-green",
      "theme-void-purple",
      "theme-solar-gold",
      "theme-ice-white",
      "theme-stealth-obsidian",
      "theme-neon-pink",
      "theme-radioactive-orange",
      "theme-deep-ocean"
    );
    
    // Add new theme class
    root.classList.add(`theme-${theme}`);
    
    // Persist to local storage
    localStorage.setItem("rasputin-theme", theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
