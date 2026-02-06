export const locales = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const rtlLocales: Locale[] = [];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Espanol',
  fr: 'Francais',
  de: 'Deutsch',
  zh: '中文',
  ja: '日本語',
  ru: 'Русский',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ru: '🇷🇺',
};

export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}
