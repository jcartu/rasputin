import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultLocale, locales, type Locale, getDirection } from '@/i18n/config';

interface LocaleState {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
  detectLocale: () => void;
}

function getBrowserLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  
  const browserLang = navigator.language.split('-')[0];
  if (locales.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }
  return defaultLocale;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      direction: 'ltr',
      
      setLocale: (locale: Locale) => {
        const direction = getDirection(locale);
        set({ locale, direction });
        
        if (typeof document !== 'undefined') {
          document.documentElement.lang = locale;
          document.documentElement.dir = direction;
        }
      },
      
      detectLocale: () => {
        const detectedLocale = getBrowserLocale();
        const direction = getDirection(detectedLocale);
        set({ locale: detectedLocale, direction });
        
        if (typeof document !== 'undefined') {
          document.documentElement.lang = detectedLocale;
          document.documentElement.dir = direction;
        }
      },
    }),
    {
      name: 'alfie-locale',
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          document.documentElement.lang = state.locale;
          document.documentElement.dir = state.direction;
        }
      },
    }
  )
);
