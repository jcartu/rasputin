'use client';

import { useEffect, useState, useMemo } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useLocaleStore } from '@/lib/i18n';
import { defaultLocale, type Locale } from '@/i18n/config';

const messageImports: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('@/messages/en.json'),
  es: () => import('@/messages/es.json'),
  fr: () => import('@/messages/fr.json'),
  de: () => import('@/messages/de.json'),
  zh: () => import('@/messages/zh.json'),
  ja: () => import('@/messages/ja.json'),
  ru: () => import('@/messages/ru.json'),
};

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const { locale, detectLocale } = useLocaleStore();
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedLocale = localStorage.getItem('alfie-locale');
    if (!storedLocale) {
      detectLocale();
    }
  }, [detectLocale]);

  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const importFn = messageImports[locale] || messageImports[defaultLocale];
        const msgs = await importFn();
        setMessages(msgs.default);
      } catch (error) {
        console.error('Failed to load messages for locale:', locale, error);
        const fallback = await messageImports[defaultLocale]();
        setMessages(fallback.default);
      }
      setIsLoading(false);
    };

    loadMessages();
  }, [locale]);

  const timeZone = useMemo(() => {
    if (typeof Intl !== 'undefined') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return 'UTC';
  }, []);

  if (isLoading || !messages) {
    return null;
  }

  return (
    <NextIntlClientProvider 
      locale={locale} 
      messages={messages}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}
