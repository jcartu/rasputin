import { z } from "zod";

export const LocaleSchema = z.enum([
  "en",
  "zh",
  "ru",
  "ja",
  "vi",
  "hi",
  "ar",
  "ko",
  "th",
  "id",
  "ms",
  "tr",
  "pt",
  "es",
  "fr",
  "de",
]);
export type Locale = z.infer<typeof LocaleSchema>;

export const CountryCodeSchema = z.enum([
  "CN",
  "RU",
  "IN",
  "AE",
  "JP",
  "VN",
  "KR",
  "SG",
  "ID",
  "MY",
  "TH",
  "PH",
  "TR",
  "SA",
  "EG",
  "BR",
  "MX",
  "DE",
  "FR",
  "GB",
  "US",
]);
export type CountryCode = z.infer<typeof CountryCodeSchema>;

export const AdminLevelSchema = z.enum(["country", "region", "city"]);
export type AdminLevel = z.infer<typeof AdminLevelSchema>;

export const RssSourceSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  language: LocaleSchema,
  category: z.enum(["business", "politics", "economy", "trade", "general"]),
  country: CountryCodeSchema.optional(),
});
export type RssSource = z.infer<typeof RssSourceSchema>;

export const GeoDataSourceSchema = z.object({
  country: CountryCodeSchema,
  level: AdminLevelSchema,
  url: z.string().url(),
  propertyMappings: z.object({
    name: z.string(),
    nameLocal: z.string().optional(),
    code: z.string().optional(),
  }),
});
export type GeoDataSource = z.infer<typeof GeoDataSourceSchema>;

export const TargetingRuleSchema = z.object({
  locale: LocaleSchema,
  targetCountry: CountryCodeSchema,
  homeCountry: CountryCodeSchema,
});
export type TargetingRule = z.infer<typeof TargetingRuleSchema>;

export const FeatureFlagsSchema = z.object({
  enable3DGlobe: z.boolean().default(true),
  enableRssFeed: z.boolean().default(true),
  enableCalendar: z.boolean().default(true),
  enableOrganizations: z.boolean().default(true),
  enableLaws: z.boolean().default(true),
  enableInvestMap: z.boolean().default(true),
  enableAnimations: z.boolean().default(true),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

export const BrandingSchema = z.object({
  name: z.string(),
  tagline: z.record(z.string(), z.string()).optional(),
  primaryColor: z.string().default("#1E40AF"),
  secondaryColor: z.string().default("#3B82F6"),
  accentColor: z.string().default("#F59E0B"),
  logoUrl: z.string().optional(),
});
export type Branding = z.infer<typeof BrandingSchema>;

export const CountryPairSchema = z.object({
  countryA: CountryCodeSchema,
  countryB: CountryCodeSchema,
  locales: z.array(LocaleSchema).min(1),
  defaultLocale: LocaleSchema,
  targetingRules: z.array(TargetingRuleSchema),
});
export type CountryPair = z.infer<typeof CountryPairSchema>;

export const RegionDataInputSchema = z.object({
  name: z.string(),
  nameLocal: z.string().optional(),
  gdp: z.string(),
  population: z.string(),
  industries: z.array(z.string()),
  industriesLocal: z.array(z.string()).optional(),
  sezCount: z.number().default(0),
  taxBenefits: z.array(z.string()).optional(),
  overview: z.string(),
  overviewLocal: z.string().optional(),
  targetSectors: z.array(z.string()).optional(),
  majorCities: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        population: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  notableEntrepreneurs: z
    .array(
      z.object({
        name: z.string(),
        nameLocal: z.string().optional(),
        company: z.string(),
        industry: z.string(),
        netWorth: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
});
export type RegionDataInput = z.infer<typeof RegionDataInputSchema>;

export const PortalScaffoldConfigSchema = z.object({
  projectName: z.string().min(1).max(50),
  outputPath: z.string(),
  countryPair: CountryPairSchema,
  branding: BrandingSchema,
  features: FeatureFlagsSchema.optional().default({
    enable3DGlobe: true,
    enableRssFeed: true,
    enableCalendar: true,
    enableOrganizations: true,
    enableLaws: true,
    enableInvestMap: true,
    enableAnimations: true,
  }),
  geoDataSources: z.array(GeoDataSourceSchema).default([]),
  rssSources: z.array(RssSourceSchema).default([]),
  database: z.enum(["postgresql", "mysql", "sqlite"]).default("postgresql"),
  customRegionData: z
    .object({
      countryA: z.record(z.string(), RegionDataInputSchema).optional(),
      countryB: z.record(z.string(), RegionDataInputSchema).optional(),
    })
    .optional(),
  customEvents: z
    .array(
      z.object({
        title: z.string(),
        titleLocal: z.string().optional(),
        date: z.string(),
        location: z.string(),
        country: CountryCodeSchema,
        category: z.string(),
        url: z.string().optional(),
      })
    )
    .optional(),
});
export type PortalScaffoldConfig = z.infer<typeof PortalScaffoldConfigSchema>;

export const COUNTRY_INFO: Record<
  CountryCode,
  {
    name: string;
    nativeName: string;
    primaryLocale: Locale;
    flag: string;
    currency: string;
    currencySymbol: string;
  }
> = {
  CN: {
    name: "China",
    nativeName: "中国",
    primaryLocale: "zh",
    flag: "🇨🇳",
    currency: "CNY",
    currencySymbol: "¥",
  },
  RU: {
    name: "Russia",
    nativeName: "Россия",
    primaryLocale: "ru",
    flag: "🇷🇺",
    currency: "RUB",
    currencySymbol: "₽",
  },
  IN: {
    name: "India",
    nativeName: "भारत",
    primaryLocale: "hi",
    flag: "🇮🇳",
    currency: "INR",
    currencySymbol: "₹",
  },
  AE: {
    name: "United Arab Emirates",
    nativeName: "الإمارات",
    primaryLocale: "ar",
    flag: "🇦🇪",
    currency: "AED",
    currencySymbol: "د.إ",
  },
  JP: {
    name: "Japan",
    nativeName: "日本",
    primaryLocale: "ja",
    flag: "🇯🇵",
    currency: "JPY",
    currencySymbol: "¥",
  },
  VN: {
    name: "Vietnam",
    nativeName: "Việt Nam",
    primaryLocale: "vi",
    flag: "🇻🇳",
    currency: "VND",
    currencySymbol: "₫",
  },
  KR: {
    name: "South Korea",
    nativeName: "대한민국",
    primaryLocale: "ko",
    flag: "🇰🇷",
    currency: "KRW",
    currencySymbol: "₩",
  },
  SG: {
    name: "Singapore",
    nativeName: "新加坡",
    primaryLocale: "en",
    flag: "🇸🇬",
    currency: "SGD",
    currencySymbol: "S$",
  },
  ID: {
    name: "Indonesia",
    nativeName: "Indonesia",
    primaryLocale: "id",
    flag: "🇮🇩",
    currency: "IDR",
    currencySymbol: "Rp",
  },
  MY: {
    name: "Malaysia",
    nativeName: "Malaysia",
    primaryLocale: "ms",
    flag: "🇲🇾",
    currency: "MYR",
    currencySymbol: "RM",
  },
  TH: {
    name: "Thailand",
    nativeName: "ประเทศไทย",
    primaryLocale: "th",
    flag: "🇹🇭",
    currency: "THB",
    currencySymbol: "฿",
  },
  PH: {
    name: "Philippines",
    nativeName: "Pilipinas",
    primaryLocale: "en",
    flag: "🇵🇭",
    currency: "PHP",
    currencySymbol: "₱",
  },
  TR: {
    name: "Turkey",
    nativeName: "Türkiye",
    primaryLocale: "tr",
    flag: "🇹🇷",
    currency: "TRY",
    currencySymbol: "₺",
  },
  SA: {
    name: "Saudi Arabia",
    nativeName: "السعودية",
    primaryLocale: "ar",
    flag: "🇸🇦",
    currency: "SAR",
    currencySymbol: "﷼",
  },
  EG: {
    name: "Egypt",
    nativeName: "مصر",
    primaryLocale: "ar",
    flag: "🇪🇬",
    currency: "EGP",
    currencySymbol: "E£",
  },
  BR: {
    name: "Brazil",
    nativeName: "Brasil",
    primaryLocale: "pt",
    flag: "🇧🇷",
    currency: "BRL",
    currencySymbol: "R$",
  },
  MX: {
    name: "Mexico",
    nativeName: "México",
    primaryLocale: "es",
    flag: "🇲🇽",
    currency: "MXN",
    currencySymbol: "$",
  },
  DE: {
    name: "Germany",
    nativeName: "Deutschland",
    primaryLocale: "de",
    flag: "🇩🇪",
    currency: "EUR",
    currencySymbol: "€",
  },
  FR: {
    name: "France",
    nativeName: "France",
    primaryLocale: "fr",
    flag: "🇫🇷",
    currency: "EUR",
    currencySymbol: "€",
  },
  GB: {
    name: "United Kingdom",
    nativeName: "United Kingdom",
    primaryLocale: "en",
    flag: "🇬🇧",
    currency: "GBP",
    currencySymbol: "£",
  },
  US: {
    name: "United States",
    nativeName: "United States",
    primaryLocale: "en",
    flag: "🇺🇸",
    currency: "USD",
    currencySymbol: "$",
  },
};

export const GEOJSON_SOURCES: Partial<
  Record<
    CountryCode,
    { url: string; propertyMappings: GeoDataSource["propertyMappings"] }
  >
> = {
  CN: {
    url: "https://cdn.jsdelivr.net/npm/cn-atlas@0.1.2/provinces.json",
    propertyMappings: { name: "name", nameLocal: "name", code: "id" },
  },
  RU: {
    url: "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/russia.geojson",
    propertyMappings: { name: "name", code: "id" },
  },
  IN: {
    url: "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson",
    propertyMappings: { name: "NAME_1", code: "ID_1" },
  },
  JP: {
    url: "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson",
    propertyMappings: { name: "nam", nameLocal: "nam_ja", code: "id" },
  },
  VN: {
    url: "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/vietnam.geojson",
    propertyMappings: { name: "name", code: "id" },
  },
  ID: {
    url: "https://raw.githubusercontent.com/superpikar/indonesia-geojson/master/indonesia-provinces.geojson",
    propertyMappings: { name: "Propinsi", code: "ID" },
  },
  AE: {
    url: "https://raw.githubusercontent.com/AhmedSamyFekry/uae-geojson/master/uae.geojson",
    propertyMappings: { name: "name", code: "id" },
  },
  TR: {
    url: "https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json",
    propertyMappings: { name: "name", code: "number" },
  },
  BR: {
    url: "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson",
    propertyMappings: { name: "name", code: "id" },
  },
  DE: {
    url: "https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/master/2_bundeslaender/1_sehr_hoch.geo.json",
    propertyMappings: { name: "NAME_1", code: "ID_1" },
  },
  FR: {
    url: "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions.geojson",
    propertyMappings: { name: "nom", code: "code" },
  },
  GB: {
    url: "https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/administrative/gb/lad.json",
    propertyMappings: { name: "LAD13NM", code: "LAD13CD" },
  },
  KR: {
    url: "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json",
    propertyMappings: { name: "name", nameLocal: "name_eng", code: "code" },
  },
  TH: {
    url: "https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json",
    propertyMappings: { name: "name", code: "id" },
  },
  MY: {
    url: "https://raw.githubusercontent.com/xzammy/malaysia-geojson/master/states/malaysia-states.geojson",
    propertyMappings: { name: "name", code: "code" },
  },
  EG: {
    url: "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/egypt.geojson",
    propertyMappings: { name: "name", code: "id" },
  },
  SA: {
    url: "https://raw.githubusercontent.com/homaily/Saudi-Arabia-Regions-Cities-CSV/master/regions.geojson",
    propertyMappings: { name: "name", nameLocal: "name_ar", code: "id" },
  },
};

export const RSS_SOURCES_BY_COUNTRY: Partial<Record<CountryCode, RssSource[]>> =
  {
    CN: [
      {
        name: "Xinhua English",
        url: "https://www.news.cn/english/rss/economy.xml",
        language: "en",
        category: "economy",
        country: "CN",
      },
      {
        name: "China Daily Business",
        url: "https://www.chinadaily.com.cn/rss/business_rss.xml",
        language: "en",
        category: "business",
        country: "CN",
      },
      {
        name: "Global Times",
        url: "https://www.globaltimes.cn/rss/outbrain.xml",
        language: "en",
        category: "general",
        country: "CN",
      },
      {
        name: "SCMP China Economy",
        url: "https://www.scmp.com/rss/91/feed",
        language: "en",
        category: "economy",
        country: "CN",
      },
    ],
    RU: [
      {
        name: "TASS English",
        url: "https://tass.com/rss/v2.xml",
        language: "en",
        category: "general",
        country: "RU",
      },
      {
        name: "RT Business",
        url: "https://www.rt.com/rss/business/",
        language: "en",
        category: "business",
        country: "RU",
      },
      {
        name: "Interfax Russia",
        url: "https://www.interfax.ru/rss.asp",
        language: "ru",
        category: "business",
        country: "RU",
      },
    ],
    IN: [
      {
        name: "Economic Times",
        url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
        language: "en",
        category: "economy",
        country: "IN",
      },
      {
        name: "Business Standard",
        url: "https://www.business-standard.com/rss/home_page_top_stories.rss",
        language: "en",
        category: "business",
        country: "IN",
      },
      {
        name: "Mint Markets",
        url: "https://www.livemint.com/rss/markets",
        language: "en",
        category: "economy",
        country: "IN",
      },
    ],
    AE: [
      {
        name: "Gulf News Business",
        url: "https://gulfnews.com/business/rss",
        language: "en",
        category: "business",
        country: "AE",
      },
      {
        name: "Khaleej Times Business",
        url: "https://www.khaleejtimes.com/rss/business",
        language: "en",
        category: "business",
        country: "AE",
      },
      {
        name: "Arabian Business",
        url: "https://www.arabianbusiness.com/rss",
        language: "en",
        category: "business",
        country: "AE",
      },
    ],
    JP: [
      {
        name: "Japan Times Business",
        url: "https://www.japantimes.co.jp/feed/",
        language: "en",
        category: "business",
        country: "JP",
      },
      {
        name: "Nikkei Asia",
        url: "https://asia.nikkei.com/rss/feed/nar",
        language: "en",
        category: "economy",
        country: "JP",
      },
    ],
    VN: [
      {
        name: "VnExpress International",
        url: "https://e.vnexpress.net/rss/business.rss",
        language: "en",
        category: "business",
        country: "VN",
      },
      {
        name: "Vietnam Investment Review",
        url: "https://vir.com.vn/rss/business.rss",
        language: "en",
        category: "economy",
        country: "VN",
      },
    ],
    SG: [
      {
        name: "Straits Times Business",
        url: "https://www.straitstimes.com/news/business/rss.xml",
        language: "en",
        category: "business",
        country: "SG",
      },
      {
        name: "Business Times SG",
        url: "https://www.businesstimes.com.sg/rss/latest",
        language: "en",
        category: "business",
        country: "SG",
      },
    ],
    ID: [
      {
        name: "Jakarta Post Business",
        url: "https://www.thejakartapost.com/news/feed",
        language: "en",
        category: "business",
        country: "ID",
      },
    ],
    KR: [
      {
        name: "Korea Herald Business",
        url: "http://www.koreaherald.com/rss/028000000000.xml",
        language: "en",
        category: "business",
        country: "KR",
      },
      {
        name: "Yonhap News Economy",
        url: "https://en.yna.co.kr/RSS/economy.xml",
        language: "en",
        category: "economy",
        country: "KR",
      },
    ],
    TR: [
      {
        name: "Daily Sabah Business",
        url: "https://www.dailysabah.com/rssFeed/business",
        language: "en",
        category: "business",
        country: "TR",
      },
      {
        name: "Hurriyet Daily News",
        url: "https://www.hurriyetdailynews.com/rss.aspx?c=13",
        language: "en",
        category: "economy",
        country: "TR",
      },
    ],
    BR: [
      {
        name: "Brazil Journal",
        url: "https://braziljournal.com/feed",
        language: "en",
        category: "business",
        country: "BR",
      },
    ],
    SA: [
      {
        name: "Arab News Business",
        url: "https://www.arabnews.com/rss.xml",
        language: "en",
        category: "business",
        country: "SA",
      },
    ],
  };

export const CHINA_RUSSIA_PRESET: Partial<PortalScaffoldConfig> = {
  countryPair: {
    countryA: "CN",
    countryB: "RU",
    locales: ["en", "zh", "ru"],
    defaultLocale: "en",
    targetingRules: [
      { locale: "ru", targetCountry: "CN", homeCountry: "RU" },
      { locale: "zh", targetCountry: "RU", homeCountry: "CN" },
      { locale: "en", targetCountry: "CN", homeCountry: "RU" },
    ],
  },
  geoDataSources: [
    {
      country: "CN",
      level: "region",
      url: "https://cdn.jsdelivr.net/npm/cn-atlas@0.1.2/provinces.json",
      propertyMappings: { name: "name", nameLocal: "name", code: "id" },
    },
    {
      country: "RU",
      level: "region",
      url: "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/russia.geojson",
      propertyMappings: { name: "name", code: "id" },
    },
  ],
  rssSources: [
    ...(RSS_SOURCES_BY_COUNTRY.CN || []),
    ...(RSS_SOURCES_BY_COUNTRY.RU || []),
  ],
};

export function createChinaRussiaConfig(
  projectName: string,
  outputPath: string,
  overrides?: Partial<PortalScaffoldConfig>
): PortalScaffoldConfig {
  return PortalScaffoldConfigSchema.parse({
    projectName,
    outputPath,
    ...CHINA_RUSSIA_PRESET,
    branding: {
      name: projectName,
      primaryColor: "#DC2626",
      secondaryColor: "#FBBF24",
      accentColor: "#1E40AF",
      ...overrides?.branding,
    },
    ...overrides,
  });
}

export function createBilateralConfig(
  projectName: string,
  outputPath: string,
  countryA: CountryCode,
  countryB: CountryCode,
  overrides?: Partial<PortalScaffoldConfig>
): PortalScaffoldConfig {
  const infoA = COUNTRY_INFO[countryA];
  const infoB = COUNTRY_INFO[countryB];
  const geoA = GEOJSON_SOURCES[countryA];
  const geoB = GEOJSON_SOURCES[countryB];

  const locales: Locale[] = ["en"];
  if (infoA.primaryLocale !== "en") locales.push(infoA.primaryLocale);
  if (
    infoB.primaryLocale !== "en" &&
    infoB.primaryLocale !== infoA.primaryLocale
  ) {
    locales.push(infoB.primaryLocale);
  }

  const targetingRules: TargetingRule[] = [
    { locale: "en", targetCountry: countryA, homeCountry: countryB },
  ];
  if (infoA.primaryLocale !== "en") {
    targetingRules.push({
      locale: infoA.primaryLocale,
      targetCountry: countryB,
      homeCountry: countryA,
    });
  }
  if (
    infoB.primaryLocale !== "en" &&
    infoB.primaryLocale !== infoA.primaryLocale
  ) {
    targetingRules.push({
      locale: infoB.primaryLocale,
      targetCountry: countryA,
      homeCountry: countryB,
    });
  }

  const geoDataSources: GeoDataSource[] = [];
  if (geoA) {
    geoDataSources.push({
      country: countryA,
      level: "region",
      url: geoA.url,
      propertyMappings: geoA.propertyMappings,
    });
  }
  if (geoB) {
    geoDataSources.push({
      country: countryB,
      level: "region",
      url: geoB.url,
      propertyMappings: geoB.propertyMappings,
    });
  }

  const rssSources: RssSource[] = [
    ...(RSS_SOURCES_BY_COUNTRY[countryA] || []),
    ...(RSS_SOURCES_BY_COUNTRY[countryB] || []),
  ];

  return PortalScaffoldConfigSchema.parse({
    projectName,
    outputPath,
    countryPair: {
      countryA,
      countryB,
      locales,
      defaultLocale: "en",
      targetingRules,
    },
    branding: {
      name: projectName,
      primaryColor: "#1E40AF",
      secondaryColor: "#3B82F6",
      accentColor: "#F59E0B",
      ...overrides?.branding,
    },
    geoDataSources,
    rssSources,
    ...overrides,
  });
}

export function getCountryName(code: CountryCode, locale?: Locale): string {
  const info = COUNTRY_INFO[code];
  if (!info) return code;
  if (locale && locale !== "en" && info.primaryLocale === locale) {
    return info.nativeName;
  }
  return info.name;
}

export function getLocalesForCountryPair(
  countryA: CountryCode,
  countryB: CountryCode
): Locale[] {
  const infoA = COUNTRY_INFO[countryA];
  const infoB = COUNTRY_INFO[countryB];
  const locales: Locale[] = ["en"];
  if (infoA?.primaryLocale && infoA.primaryLocale !== "en") {
    locales.push(infoA.primaryLocale);
  }
  if (
    infoB?.primaryLocale &&
    infoB.primaryLocale !== "en" &&
    infoB.primaryLocale !== infoA?.primaryLocale
  ) {
    locales.push(infoB.primaryLocale);
  }
  return locales;
}
