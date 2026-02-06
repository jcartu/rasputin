import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  const locale: Locale = defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
