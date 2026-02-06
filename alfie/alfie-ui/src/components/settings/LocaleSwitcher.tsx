'use client';

import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { useLocaleStore } from '@/lib/i18n';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

const localeOptions = locales.map((locale) => ({
  value: locale,
  label: `${localeFlags[locale]} ${localeNames[locale]}`,
}));

interface LocaleSwitcherProps {
  showIcon?: boolean;
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const t = useTranslations('settings.general');
  const { locale, setLocale } = useLocaleStore();

  return (
    <div className={className}>
      <Select
        value={locale}
        onValueChange={(value) => setLocale(value as Locale)}
        options={localeOptions}
        className="w-48"
      />
    </div>
  );
}

export function LocaleSwitcherRow() {
  const t = useTranslations('settings.general');
  const { locale, setLocale } = useLocaleStore();

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Globe className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <span className="text-sm font-medium">{t('language')}</span>
          <p className="text-xs text-muted-foreground mt-0.5">{t('languageDesc')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={locale}
          onValueChange={(value) => setLocale(value as Locale)}
          options={localeOptions}
          className="w-48"
        />
      </div>
    </div>
  );
}
