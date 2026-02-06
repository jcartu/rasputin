import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Theme, CustomTheme, ThemeColors, ThemeId } from './types';
import { builtInThemes, getThemeById, createDefaultCustomColors } from './themes';
import { applyThemeToDocument, generateThemeId } from './utils';

interface ThemeState {
  activeThemeId: ThemeId;
  customThemes: CustomTheme[];
  transitionsEnabled: boolean;
  activeTheme: Theme | null;
  allThemes: Theme[];
  
  setActiveTheme: (themeId: ThemeId) => void;
  createCustomTheme: (name: string, description: string, colors: ThemeColors, isDark: boolean) => string;
  updateCustomTheme: (themeId: string, updates: Partial<Omit<CustomTheme, 'id' | 'isBuiltIn' | 'createdAt'>>) => void;
  deleteCustomTheme: (themeId: string) => void;
  duplicateTheme: (themeId: string, newName: string) => string | null;
  setTransitionsEnabled: (enabled: boolean) => void;
  applyCurrentTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activeThemeId: 'dark',
      customThemes: [],
      transitionsEnabled: true,
      
      get activeTheme() {
        const state = get();
        return getThemeById(state.activeThemeId, state.customThemes) || builtInThemes[0];
      },
      
      get allThemes() {
        return [...builtInThemes, ...get().customThemes];
      },
      
      setActiveTheme: (themeId) => {
        const theme = getThemeById(themeId, get().customThemes);
        if (theme) {
          set({ activeThemeId: themeId });
          if (typeof window !== 'undefined') {
            applyThemeToDocument(theme.colors);
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(theme.isDark ? 'dark' : 'light');
          }
        }
      },
      
      createCustomTheme: (name, description, colors, isDark) => {
        const id = generateThemeId();
        const now = new Date();
        const newTheme: CustomTheme = {
          id,
          name,
          description,
          colors,
          isDark,
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
        };
        
        set((state) => ({
          customThemes: [...state.customThemes, newTheme],
        }));
        
        return id;
      },
      
      updateCustomTheme: (themeId, updates) => {
        set((state) => ({
          customThemes: state.customThemes.map((theme) =>
            theme.id === themeId
              ? { ...theme, ...updates, updatedAt: new Date() }
              : theme
          ),
        }));
        
        if (get().activeThemeId === themeId) {
          get().applyCurrentTheme();
        }
      },
      
      deleteCustomTheme: (themeId) => {
        const { activeThemeId, customThemes } = get();
        
        if (activeThemeId === themeId) {
          get().setActiveTheme('dark');
        }
        
        set({
          customThemes: customThemes.filter((t) => t.id !== themeId),
        });
      },
      
      duplicateTheme: (themeId, newName) => {
        const theme = getThemeById(themeId, get().customThemes);
        if (!theme) return null;
        
        return get().createCustomTheme(
          newName,
          `Duplicated from ${theme.name}`,
          { ...theme.colors },
          theme.isDark
        );
      },
      
      setTransitionsEnabled: (enabled) => {
        set({ transitionsEnabled: enabled });
        if (typeof window !== 'undefined') {
          document.documentElement.classList.toggle('theme-transitions', enabled);
        }
      },
      
      applyCurrentTheme: () => {
        const { activeThemeId, customThemes } = get();
        const theme = getThemeById(activeThemeId, customThemes);
        if (theme && typeof window !== 'undefined') {
          applyThemeToDocument(theme.colors);
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(theme.isDark ? 'dark' : 'light');
        }
      },
    }),
    {
      name: 'alfie-theme-storage',
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        customThemes: state.customThemes,
        transitionsEnabled: state.transitionsEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== 'undefined') {
          state.applyCurrentTheme();
          if (state.transitionsEnabled) {
            document.documentElement.classList.add('theme-transitions');
          }
        }
      },
    }
  )
);

export function useTheme() {
  const store = useThemeStore();
  const activeTheme = getThemeById(store.activeThemeId, store.customThemes) || builtInThemes[0];
  const allThemes = [...builtInThemes, ...store.customThemes];
  
  return {
    ...store,
    activeTheme,
    allThemes,
    builtInThemes,
  };
}
