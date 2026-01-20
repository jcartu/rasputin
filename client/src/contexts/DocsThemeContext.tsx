import React, { createContext, useContext, useEffect, useState } from "react";

export type DocsTheme =
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

interface DocsThemeContextType {
  theme: DocsTheme;
  setTheme: (theme: DocsTheme) => void;
}

const DocsThemeContext = createContext<DocsThemeContextType | undefined>(
  undefined
);

interface DocsThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: DocsTheme;
}

export function DocsThemeProvider({
  children,
  defaultTheme = "cyber-blue",
}: DocsThemeProviderProps) {
  const [theme, setThemeState] = useState<DocsTheme>(() => {
    const stored = localStorage.getItem("rasputin-docs-theme");
    return (stored as DocsTheme) || defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    const themeClasses = [
      "docs-theme-cyber-blue",
      "docs-theme-code-red",
      "docs-theme-matrix-green",
      "docs-theme-void-purple",
      "docs-theme-solar-gold",
      "docs-theme-ice-white",
      "docs-theme-stealth-obsidian",
      "docs-theme-neon-pink",
      "docs-theme-radioactive-orange",
      "docs-theme-deep-ocean",
    ];
    themeClasses.forEach(cls => root.classList.remove(cls));
    root.classList.add(`docs-theme-${theme}`);
    localStorage.setItem("rasputin-docs-theme", theme);
  }, [theme]);

  const setTheme = (newTheme: DocsTheme) => {
    setThemeState(newTheme);
  };

  return (
    <DocsThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </DocsThemeContext.Provider>
  );
}

export function useDocsTheme() {
  const context = useContext(DocsThemeContext);
  if (!context) {
    throw new Error("useDocsTheme must be used within DocsThemeProvider");
  }
  return context;
}
