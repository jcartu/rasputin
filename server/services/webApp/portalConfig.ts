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
  "AR",
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
  AR: {
    name: "Argentina",
    nativeName: "Argentina",
    primaryLocale: "es",
    flag: "🇦🇷",
    currency: "ARS",
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

// ============================================================================
// COUNTRY-SPECIFIC LEGAL DATA
// ============================================================================

export interface BilateralAgreement {
  id: string;
  title: string;
  titleLocal?: string;
  date: string;
  category: "agreements";
  description: string;
  url?: string;
}

export interface VisaInfo {
  id: string;
  title: string;
  category: "visas";
  description: string;
  requirements: string[];
}

export interface EntityType {
  id: string;
  title: string;
  titleLocal?: string;
  category: "entities";
  description: string;
  timeline: string;
  minCapital: string;
}

export interface Organization {
  id: string;
  name: string;
  nameLocal?: string;
  nameZh?: string;
  nameRu?: string;
  level: "national" | "regional" | "municipal";
  website: string;
  description: string;
  descriptionZh?: string;
  descriptionRu?: string;
}

export interface TradeEvent {
  id: string;
  title: string;
  titleZh?: string;
  titleRu?: string;
  date: string;
  endDate?: string;
  location: string;
  locationZh?: string;
  locationRu?: string;
  description: string;
  descriptionZh?: string;
  descriptionRu?: string;
  url?: string;
  country: CountryCode;
}

// Bilateral agreements indexed by country pair key (e.g., "CN-RU", "IN-AE")
export const BILATERAL_AGREEMENTS: Record<string, BilateralAgreement[]> = {
  "CN-RU": [
    {
      id: "1",
      title: "Treaty of Good-Neighborliness and Friendly Cooperation",
      titleLocal: "中俄睦邻友好合作条约",
      date: "2001-07-16",
      category: "agreements",
      description:
        "Foundation treaty establishing strategic partnership, mutual respect for sovereignty, and commitment to peaceful resolution of disputes. Renewed for 5 years in 2021.",
      url: "http://www.npc.gov.cn/wxzl/gongbao/2001-08/27/content_5277986.htm",
    },
    {
      id: "2",
      title: "Joint Statement on New Era Comprehensive Strategic Partnership",
      titleLocal: "新时代全面战略协作伙伴关系联合声明",
      date: "2023-03-21",
      category: "agreements",
      description:
        'Upgraded bilateral relations to "new era comprehensive strategic partnership of coordination." Covers political, economic, security, and humanitarian cooperation.',
      url: "http://kremlin.ru/supplement/5920",
    },
    {
      id: "3",
      title: "Agreement on Avoidance of Double Taxation",
      titleLocal: "中俄避免双重征税协定",
      date: "2014-10-13",
      category: "agreements",
      description:
        "Tax treaty covering income and capital, with withholding tax rates of 5-10% on dividends, 0% on interest, and 6% on royalties.",
      url: "https://www.chinatax.gov.cn/n810341/n810770/index.html",
    },
    {
      id: "4",
      title: "Bilateral Investment Treaty (BIT)",
      titleLocal: "中俄双边投资保护协定",
      date: "2006-11-09",
      category: "agreements",
      description:
        "Provides legal protection for investors, including fair treatment, protection against expropriation, and free transfer of capital.",
      url: "https://investmentpolicy.unctad.org/international-investment-agreements/treaties/bilateral-investment-treaties/1010/china---russian-federation-bit-2006-",
    },
    {
      id: "5",
      title: "Agreement on Customs Cooperation and Mutual Assistance",
      titleLocal: "中俄海关合作与互助协定",
      date: "2018-06-08",
      category: "agreements",
      description:
        "Streamlines customs procedures, enables data sharing, and establishes joint risk management for cross-border trade facilitation.",
      url: "http://www.customs.gov.cn/",
    },
    {
      id: "6",
      title: "E-Commerce Cooperation Agreement",
      titleLocal: "中俄电子商务合作协议",
      date: "2019-06-05",
      category: "agreements",
      description:
        "Framework for cross-border e-commerce development, digital payments integration, and consumer protection standards.",
      url: "http://www.mofcom.gov.cn/",
    },
  ],
  "IN-AE": [
    {
      id: "1",
      title: "Comprehensive Economic Partnership Agreement (CEPA)",
      titleLocal: "شراكة اقتصادية شاملة",
      date: "2022-02-18",
      category: "agreements",
      description:
        "Historic free trade agreement eliminating tariffs on 80% of products. Expected to increase bilateral trade to $100B by 2030.",
      url: "https://www.indembassyuae.gov.in/cepa.php",
    },
    {
      id: "2",
      title: "Bilateral Investment Treaty",
      date: "2013-12-12",
      category: "agreements",
      description:
        "Protects investments from both countries, ensuring fair treatment and compensation in case of expropriation.",
      url: "https://investmentpolicy.unctad.org",
    },
    {
      id: "3",
      title: "MoU on Infrastructure Investment",
      date: "2024-02-13",
      category: "agreements",
      description:
        "UAE commits $75 billion for infrastructure development in India across renewable energy, ports, and technology sectors.",
    },
    {
      id: "4",
      title: "Local Currency Settlement Agreement",
      date: "2023-07-15",
      category: "agreements",
      description:
        "Enables trade settlement in INR and AED, reducing dependency on USD and lowering transaction costs for businesses.",
    },
  ],
  "DE-FR": [
    {
      id: "1",
      title: "Treaty of Aachen (Aix-la-Chapelle Treaty)",
      titleLocal: "Traité d'Aix-la-Chapelle / Aachener Vertrag",
      date: "2019-01-22",
      category: "agreements",
      description:
        "Supplementing the Élysée Treaty, strengthens Franco-German cooperation in foreign policy, defense, economy, and cross-border regions.",
      url: "https://www.diplomatie.gouv.fr/en/country-files/germany/france-and-germany/",
    },
    {
      id: "2",
      title: "Élysée Treaty",
      titleLocal: "Traité de l'Élysée / Élysée-Vertrag",
      date: "1963-01-22",
      category: "agreements",
      description:
        "Foundation treaty of Franco-German reconciliation and cooperation. Established regular consultations and youth exchange programs.",
    },
    {
      id: "3",
      title: "EU Single Market Framework",
      date: "1993-01-01",
      category: "agreements",
      description:
        "Free movement of goods, services, capital, and people between all EU member states including France and Germany.",
    },
    {
      id: "4",
      title: "Franco-German Business Council Agreement",
      date: "2020-05-18",
      category: "agreements",
      description:
        "Framework for joint industrial policy, particularly in battery production, AI, and hydrogen technology.",
    },
  ],
  "JP-VN": [
    {
      id: "1",
      title: "Japan-Vietnam Economic Partnership Agreement (JVEPA)",
      titleLocal: "日越経済連携協定",
      date: "2009-10-01",
      category: "agreements",
      description:
        "Comprehensive EPA covering trade in goods and services, investment, and movement of natural persons. Eliminates 92% of tariffs.",
      url: "https://www.mofa.go.jp/policy/economy/fta/vietnam.html",
    },
    {
      id: "2",
      title: "RCEP (Regional Comprehensive Economic Partnership)",
      date: "2022-01-01",
      category: "agreements",
      description:
        "World's largest free trade agreement covering 15 Asia-Pacific nations. Simplifies rules of origin for manufacturing supply chains.",
    },
    {
      id: "3",
      title: "Bilateral Investment Treaty",
      date: "2003-12-14",
      category: "agreements",
      description:
        "Protects Japanese investments in Vietnam with provisions for fair treatment, dispute resolution, and free transfer of returns.",
    },
  ],
  "BR-AR": [
    {
      id: "1",
      title: "MERCOSUR Common Market",
      titleLocal: "Mercado Común del Sur",
      date: "1991-03-26",
      category: "agreements",
      description:
        "Customs union and free trade area. Eliminates tariffs between member states and establishes common external tariff.",
      url: "https://www.mercosur.int/",
    },
    {
      id: "2",
      title: "Bilateral Investment Protocol (MERCOSUR Colonia Protocol)",
      date: "1994-01-17",
      category: "agreements",
      description:
        "Framework for investment protection within MERCOSUR, ensuring national treatment and dispute resolution mechanisms.",
    },
    {
      id: "3",
      title: "Automotive Trade Agreement",
      date: "2019-07-01",
      category: "agreements",
      description:
        "Managed trade regime for automotive sector with flex quotas and local content requirements.",
    },
  ],
};

// Visa information indexed by country code
export const VISA_INFO: Record<CountryCode, VisaInfo[]> = {
  CN: [
    {
      id: "v1",
      title: "Business Visa (M Visa)",
      category: "visas",
      description:
        "For business activities, trade fairs, and investment. Valid 30-90 days, single/multiple entry. Requires invitation letter from Chinese company.",
      requirements: [
        "Valid passport (6+ months)",
        "Invitation letter",
        "Company registration",
        "Photo 33x48mm",
      ],
    },
    {
      id: "v2",
      title: "Work Visa (Z Visa)",
      category: "visas",
      description:
        "Required for employment. Must obtain work permit before visa application. Converts to residence permit after arrival.",
      requirements: [
        "Work permit notification",
        "Health certificate",
        "Degree authentication",
        "Background check",
      ],
    },
  ],
  RU: [
    {
      id: "v1",
      title: "Business Visa",
      category: "visas",
      description:
        "Single/double/multiple entry for business purposes. Requires visa support letter from Russian organization.",
      requirements: [
        "Valid passport (6+ months)",
        "Visa invitation",
        "Migration card",
        "Photo 35x45mm",
      ],
    },
    {
      id: "v2",
      title: "Highly Qualified Specialist (HQS)",
      category: "visas",
      description:
        "Simplified work permit for specialists with salary above threshold. 3-year validity with expedited processing.",
      requirements: [
        "Employment contract",
        "Salary above 167,000 RUB/month",
        "Employer petition",
        "No quota required",
      ],
    },
  ],
  IN: [
    {
      id: "v1",
      title: "Business Visa",
      category: "visas",
      description:
        "For business meetings, conferences, and establishing ventures. Multiple entry valid for 1-10 years.",
      requirements: [
        "Valid passport (6+ months)",
        "Business letter",
        "Proof of financial means",
        "Return ticket",
      ],
    },
    {
      id: "v2",
      title: "Employment Visa",
      category: "visas",
      description:
        "For skilled professionals. Minimum salary requirement of $25,000/year. Company must be registered.",
      requirements: [
        "Employment contract",
        "Educational certificates",
        "Company registration",
        "PCC from home country",
      ],
    },
  ],
  AE: [
    {
      id: "v1",
      title: "Business/Visit Visa",
      category: "visas",
      description:
        "Short-term visa for business meetings. 30-90 days validity. Can be sponsored by UAE company or obtained on arrival for many nationalities.",
      requirements: [
        "Valid passport (6+ months)",
        "Sponsor letter or hotel booking",
        "Return ticket",
        "Proof of funds",
      ],
    },
    {
      id: "v2",
      title: "Investor Visa (Golden Visa)",
      category: "visas",
      description:
        "Long-term residency (5-10 years) for investors. Minimum investment of AED 2 million in property or AED 500,000 in approved fund.",
      requirements: [
        "Proof of investment",
        "Valid passport",
        "Health insurance",
        "Clean criminal record",
      ],
    },
  ],
  JP: [
    {
      id: "v1",
      title: "Short-term Business Visa",
      category: "visas",
      description:
        "Up to 90 days for business meetings, market research, and contract signing. Many countries visa-exempt.",
      requirements: [
        "Valid passport",
        "Invitation letter",
        "Itinerary",
        "Proof of funds",
      ],
    },
    {
      id: "v2",
      title: "Investor/Business Manager Visa",
      category: "visas",
      description:
        "For establishing and managing a business in Japan. Minimum investment of JPY 5 million or employing 2+ full-time staff.",
      requirements: [
        "Business plan",
        "Office lease agreement",
        "Capital proof (JPY 5M+)",
        "Relevant experience",
      ],
    },
  ],
  VN: [
    {
      id: "v1",
      title: "Business Visa (DN)",
      category: "visas",
      description:
        "For business activities with Vietnamese enterprises. Valid 3-12 months, single or multiple entry.",
      requirements: [
        "Invitation from Vietnamese company",
        "Valid passport (6+ months)",
        "Visa application form",
        "Passport photos",
      ],
    },
    {
      id: "v2",
      title: "Work Permit + Temporary Residence Card",
      category: "visas",
      description:
        "Required for employment. Work permit valid 2 years. TRC allows multiple re-entries.",
      requirements: [
        "Employment contract",
        "Health certificate",
        "Police clearance",
        "Degree legalization",
      ],
    },
  ],
  DE: [
    {
      id: "v1",
      title: "Schengen Business Visa",
      category: "visas",
      description:
        "Short-stay visa for business activities in Germany and Schengen area. Maximum 90 days in 180-day period.",
      requirements: [
        "Valid passport",
        "Invitation letter",
        "Travel insurance",
        "Proof of accommodation",
      ],
    },
    {
      id: "v2",
      title: "Self-Employment Residence Permit",
      category: "visas",
      description:
        "For entrepreneurs establishing business in Germany. Requires viable business plan and sufficient funds.",
      requirements: [
        "Business plan",
        "Proof of financing",
        "Professional qualifications",
        "Health insurance",
      ],
    },
  ],
  FR: [
    {
      id: "v1",
      title: "Schengen Business Visa",
      category: "visas",
      description:
        "Short-stay visa for business activities. Valid for 90 days within 180-day period in Schengen area.",
      requirements: [
        "Valid passport",
        "Business letter",
        "Travel insurance",
        "Financial guarantee",
      ],
    },
    {
      id: "v2",
      title: "French Tech Visa / Talent Passport",
      category: "visas",
      description:
        "4-year renewable visa for entrepreneurs, investors, and skilled workers. Fast-track processing for tech founders.",
      requirements: [
        "Innovative project or investment (€30K+)",
        "Degree or experience",
        "Valid passport",
        "Health coverage",
      ],
    },
  ],
  BR: [
    {
      id: "v1",
      title: "Business Visa (VITEM II)",
      category: "visas",
      description:
        "For business meetings, negotiations, and conferences. Valid 90 days, extendable once.",
      requirements: [
        "Invitation from Brazilian company",
        "Valid passport",
        "Proof of funds",
        "Return ticket",
      ],
    },
    {
      id: "v2",
      title: "Investor Visa (VIPER)",
      category: "visas",
      description:
        "Permanent residence for investors. Minimum investment of BRL 500,000 in productive activity.",
      requirements: [
        "Investment plan",
        "Proof of investment source",
        "No criminal record",
        "Business registration",
      ],
    },
  ],
  AR: [
    {
      id: "v1",
      title: "Business Visa",
      category: "visas",
      description:
        "For commercial and professional activities. Many nationalities visa-exempt for short stays.",
      requirements: [
        "Valid passport",
        "Business letter",
        "Proof of economic means",
        "Return ticket",
      ],
    },
    {
      id: "v2",
      title: "Investor Residency",
      category: "visas",
      description:
        "Temporary residency for foreign investors. Must demonstrate investment in Argentine enterprise.",
      requirements: [
        "Investment documentation",
        "Business plan",
        "Clean criminal record",
        "Health certificate",
      ],
    },
  ],
  KR: [
    {
      id: "v1",
      title: "Short-term Business (C-3-4)",
      category: "visas",
      description:
        "Up to 90 days for market research, business meetings, and contract discussions.",
      requirements: [
        "Valid passport",
        "Business documents",
        "Proof of funds",
        "Return ticket",
      ],
    },
    {
      id: "v2",
      title: "Corporate Investment (D-8)",
      category: "visas",
      description:
        "For establishing and managing foreign-invested company. Minimum investment KRW 100 million.",
      requirements: [
        "Investment certificate",
        "Business registration",
        "Office lease",
        "Capital proof",
      ],
    },
  ],
  SG: [
    {
      id: "v1",
      title: "Business Visit Pass",
      category: "visas",
      description:
        "Up to 90 days for business meetings. Many nationalities visa-exempt. Cannot engage in employment.",
      requirements: [
        "Valid passport (6+ months)",
        "Return ticket",
        "Proof of funds",
        "Hotel booking",
      ],
    },
    {
      id: "v2",
      title: "EntrePass",
      category: "visas",
      description:
        "For entrepreneurs starting innovative businesses in Singapore. Must meet innovation criteria.",
      requirements: [
        "Innovative business plan",
        "Funding or IP ownership",
        "Registered company",
        "Valid passport",
      ],
    },
  ],
  ID: [
    {
      id: "v1",
      title: "Business Visa (B211A)",
      category: "visas",
      description:
        "Single entry visa for business meetings and conferences. Valid 60 days, extendable.",
      requirements: [
        "Sponsor letter",
        "Valid passport (6+ months)",
        "Return ticket",
        "Passport photos",
      ],
    },
    {
      id: "v2",
      title: "Investor KITAS",
      category: "visas",
      description:
        "Stay permit for foreign investors. Requires minimum investment of IDR 10 billion.",
      requirements: [
        "Investment approval (BKPM)",
        "Company registration",
        "Domicile letter",
        "Valid passport",
      ],
    },
  ],
  MY: [
    {
      id: "v1",
      title: "Professional Visit Pass",
      category: "visas",
      description:
        "For short-term professional activities. Valid up to 12 months. Cannot receive local remuneration.",
      requirements: [
        "Sponsor letter",
        "Valid passport",
        "Return ticket",
        "Professional credentials",
      ],
    },
  ],
  TH: [
    {
      id: "v1",
      title: "Business Visa (Non-B)",
      category: "visas",
      description:
        "For business activities and employment. Single entry 90 days, multiple entry 1 year.",
      requirements: [
        "Business letter",
        "Valid passport (6+ months)",
        "Financial proof",
        "Passport photos",
      ],
    },
  ],
  PH: [
    {
      id: "v1",
      title: "9(d) Treaty Trader Visa",
      category: "visas",
      description:
        "For nationals of treaty countries conducting substantial trade or investment.",
      requirements: [
        "Proof of trade/investment",
        "Valid passport",
        "Business documents",
        "Financial capacity",
      ],
    },
  ],
  TR: [
    {
      id: "v1",
      title: "Business Visa",
      category: "visas",
      description:
        "For business meetings and commercial activities. E-Visa available for many nationalities.",
      requirements: [
        "Valid passport (6+ months)",
        "Invitation letter",
        "Proof of accommodation",
        "Financial means",
      ],
    },
  ],
  SA: [
    {
      id: "v1",
      title: "Business Visit Visa",
      category: "visas",
      description:
        "For business meetings and negotiations. E-Visa now available for many nationalities.",
      requirements: [
        "Company invitation",
        "Valid passport",
        "Hotel reservation",
        "Return ticket",
      ],
    },
  ],
  EG: [
    {
      id: "v1",
      title: "Business Visa",
      category: "visas",
      description:
        "For commercial and professional visits. Single or multiple entry available.",
      requirements: [
        "Business letter",
        "Valid passport (6+ months)",
        "Passport photos",
        "Application form",
      ],
    },
  ],
  MX: [
    {
      id: "v1",
      title: "Business Visitor Permit",
      category: "visas",
      description:
        "For business activities without remuneration. Up to 180 days. Many nationalities visa-exempt.",
      requirements: [
        "Valid passport",
        "Business letter",
        "Proof of funds",
        "Return ticket",
      ],
    },
  ],
  GB: [
    {
      id: "v1",
      title: "Standard Visitor Visa (Business)",
      category: "visas",
      description:
        "For business meetings, training, and conferences. Up to 6 months. Cannot work or receive payment.",
      requirements: [
        "Valid passport",
        "Invitation letter",
        "Proof of funds",
        "Accommodation details",
      ],
    },
    {
      id: "v2",
      title: "Innovator Founder Visa",
      category: "visas",
      description:
        "For experienced entrepreneurs with innovative business ideas endorsed by approved body.",
      requirements: [
        "Endorsement letter",
        "Business plan",
        "Proof of funds (£1,270+)",
        "English proficiency",
      ],
    },
  ],
  US: [
    {
      id: "v1",
      title: "B-1 Business Visa",
      category: "visas",
      description:
        "For business activities including meetings, conferences, and contract negotiation. Cannot engage in employment.",
      requirements: [
        "DS-160 form",
        "Valid passport",
        "Business letter",
        "Proof of ties to home country",
      ],
    },
    {
      id: "v2",
      title: "E-2 Treaty Investor Visa",
      category: "visas",
      description:
        "For nationals of treaty countries investing substantial capital in US business.",
      requirements: [
        "Substantial investment",
        "Business plan",
        "Source of funds proof",
        "Treaty nationality",
      ],
    },
  ],
};

// Business entity types by country
export const ENTITY_TYPES: Record<CountryCode, EntityType[]> = {
  CN: [
    {
      id: "e1",
      title: "Wholly Foreign-Owned Enterprise (WFOE)",
      titleLocal: "外商独资企业",
      category: "entities",
      description:
        "100% foreign ownership. Most common for manufacturing and trading. Requires registered capital (industry-dependent) and business scope approval.",
      timeline: "2-3 months",
      minCapital: "Industry dependent",
    },
    {
      id: "e2",
      title: "Representative Office",
      titleLocal: "代表处",
      category: "entities",
      description:
        "Liaison office for market research and coordination. Cannot engage in direct business activities or generate revenue in China.",
      timeline: "1-2 months",
      minCapital: "None required",
    },
  ],
  RU: [
    {
      id: "e1",
      title: "Limited Liability Company (OOO)",
      titleLocal: "ООО",
      category: "entities",
      description:
        "Most common entity type. Minimum 10,000 RUB capital. Liability limited to contribution. Simple registration process.",
      timeline: "3-5 business days",
      minCapital: "10,000 RUB",
    },
    {
      id: "e2",
      title: "Joint Stock Company (AO)",
      titleLocal: "АО",
      category: "entities",
      description:
        "For larger enterprises. Public (PAO) or private (NAO). Can issue shares. Stricter reporting requirements.",
      timeline: "2-4 weeks",
      minCapital: "100,000 RUB (PAO: 100M RUB)",
    },
  ],
  IN: [
    {
      id: "e1",
      title: "Private Limited Company",
      category: "entities",
      description:
        "Most popular for foreign investors. Limited liability, easy to incorporate. Minimum 2 directors, 2 shareholders.",
      timeline: "2-3 weeks",
      minCapital: "INR 1 lakh",
    },
    {
      id: "e2",
      title: "Liaison Office",
      category: "entities",
      description:
        "Represent parent company for market research and coordination. Cannot conduct commercial activities.",
      timeline: "4-6 weeks",
      minCapital: "None required",
    },
  ],
  AE: [
    {
      id: "e1",
      title: "Free Zone Company",
      category: "entities",
      description:
        "100% foreign ownership. Tax-free operations. Limited to activities within free zone unless partnering with local distributor.",
      timeline: "1-2 weeks",
      minCapital: "AED 50,000+",
    },
    {
      id: "e2",
      title: "Mainland LLC",
      category: "entities",
      description:
        "Now allows 100% foreign ownership in most sectors. Can trade anywhere in UAE. Subject to corporate tax (9%).",
      timeline: "2-4 weeks",
      minCapital: "Activity dependent",
    },
  ],
  JP: [
    {
      id: "e1",
      title: "Kabushiki Kaisha (K.K.)",
      titleLocal: "株式会社",
      category: "entities",
      description:
        "Joint stock company. Most prestigious structure. Can issue stock. Minimum 1 director, no residency requirement.",
      timeline: "2-3 weeks",
      minCapital: "JPY 1 (min JPY 5M for visa)",
    },
    {
      id: "e2",
      title: "Godo Kaisha (G.K.)",
      titleLocal: "合同会社",
      category: "entities",
      description:
        "LLC equivalent. Lower setup costs, simpler structure. Good for small businesses and subsidiaries.",
      timeline: "1-2 weeks",
      minCapital: "JPY 1",
    },
  ],
  VN: [
    {
      id: "e1",
      title: "Limited Liability Company",
      category: "entities",
      description:
        "Most common for FDI. Single-member or multi-member. Requires Investment Registration Certificate.",
      timeline: "1-3 months",
      minCapital: "Project dependent",
    },
    {
      id: "e2",
      title: "Representative Office",
      category: "entities",
      description:
        "For market research and liaison. Cannot conduct profit-generating activities.",
      timeline: "2-4 weeks",
      minCapital: "None required",
    },
  ],
  DE: [
    {
      id: "e1",
      title: "GmbH (Gesellschaft mit beschränkter Haftung)",
      category: "entities",
      description:
        "Limited liability company. Most popular for SMEs. Minimum EUR 25,000 capital (half paid upfront).",
      timeline: "2-4 weeks",
      minCapital: "EUR 25,000",
    },
    {
      id: "e2",
      title: "Branch Office (Zweigniederlassung)",
      category: "entities",
      description:
        "Extension of foreign parent company. No separate legal entity. Parent liable for all obligations.",
      timeline: "2-3 weeks",
      minCapital: "None required",
    },
  ],
  FR: [
    {
      id: "e1",
      title: "SARL (Société à responsabilité limitée)",
      category: "entities",
      description:
        "Private limited company. Suitable for SMEs. 2-100 shareholders. Minimum EUR 1 capital.",
      timeline: "1-2 weeks",
      minCapital: "EUR 1",
    },
    {
      id: "e2",
      title: "SAS (Société par actions simplifiée)",
      category: "entities",
      description:
        "Simplified joint stock company. Flexible structure, popular for startups and foreign investors.",
      timeline: "1-2 weeks",
      minCapital: "EUR 1",
    },
  ],
  BR: [
    {
      id: "e1",
      title: "Ltda (Sociedade Limitada)",
      category: "entities",
      description:
        "Limited liability company. Most common for foreign investment. Requires local representative.",
      timeline: "30-60 days",
      minCapital: "None required",
    },
    {
      id: "e2",
      title: "S.A. (Sociedade Anônima)",
      category: "entities",
      description:
        "Corporation for large enterprises. Can be publicly traded. Stricter governance requirements.",
      timeline: "60-90 days",
      minCapital: "None specified",
    },
  ],
  AR: [
    {
      id: "e1",
      title: "S.R.L. (Sociedad de Responsabilidad Limitada)",
      category: "entities",
      description:
        "Limited liability company. Up to 50 partners. Simple structure for SMEs.",
      timeline: "30-45 days",
      minCapital: "ARS 100,000",
    },
    {
      id: "e2",
      title: "S.A. (Sociedad Anónima)",
      category: "entities",
      description:
        "Corporation. Minimum 2 shareholders. Suitable for larger investments.",
      timeline: "45-60 days",
      minCapital: "ARS 100,000",
    },
  ],
  KR: [
    {
      id: "e1",
      title: "Yuhan Hoesa (유한회사)",
      category: "entities",
      description:
        "Limited company. Simple structure, limited liability. Popular for foreign SME subsidiaries.",
      timeline: "2-3 weeks",
      minCapital: "KRW 100 million",
    },
  ],
  SG: [
    {
      id: "e1",
      title: "Private Limited Company (Pte Ltd)",
      category: "entities",
      description:
        "Most common. 100% foreign ownership allowed. At least 1 local director required.",
      timeline: "1-2 days",
      minCapital: "SGD 1",
    },
  ],
  ID: [
    {
      id: "e1",
      title: "PT PMA (Foreign Investment Company)",
      category: "entities",
      description:
        "Foreign-owned limited liability company. Subject to Negative Investment List restrictions.",
      timeline: "1-3 months",
      minCapital: "IDR 10 billion",
    },
  ],
  MY: [
    {
      id: "e1",
      title: "Sdn Bhd (Private Limited)",
      category: "entities",
      description:
        "Private company limited by shares. 100% foreign ownership in most sectors.",
      timeline: "1-2 weeks",
      minCapital: "MYR 1",
    },
  ],
  TH: [
    {
      id: "e1",
      title: "Company Limited",
      category: "entities",
      description:
        "Most common for FDI. Thai majority shareholding required unless BOI promoted.",
      timeline: "1-2 months",
      minCapital: "THB 2 million for work permit",
    },
  ],
  PH: [
    {
      id: "e1",
      title: "Domestic Corporation",
      category: "entities",
      description:
        "Standard corporation. 40% foreign ownership limit in most sectors.",
      timeline: "2-4 weeks",
      minCapital: "PHP 5,000",
    },
  ],
  TR: [
    {
      id: "e1",
      title: "Limited Şirket (Ltd. Şti.)",
      category: "entities",
      description:
        "Limited liability company. 100% foreign ownership allowed. Most popular for SMEs.",
      timeline: "1-2 weeks",
      minCapital: "TRY 50,000",
    },
  ],
  SA: [
    {
      id: "e1",
      title: "Limited Liability Company (LLC)",
      category: "entities",
      description:
        "100% foreign ownership now allowed. Requires SAGIA license.",
      timeline: "2-4 weeks",
      minCapital: "SAR 100,000",
    },
  ],
  EG: [
    {
      id: "e1",
      title: "Limited Liability Company",
      category: "entities",
      description:
        "100% foreign ownership allowed. Minimum 2 shareholders required.",
      timeline: "2-4 weeks",
      minCapital: "None specified",
    },
  ],
  MX: [
    {
      id: "e1",
      title: "S.A. de C.V.",
      category: "entities",
      description:
        "Variable capital corporation. 100% foreign ownership allowed in most sectors.",
      timeline: "2-4 weeks",
      minCapital: "MXN 50,000",
    },
  ],
  GB: [
    {
      id: "e1",
      title: "Private Limited Company (Ltd)",
      category: "entities",
      description:
        "Most common structure. Limited liability, separate legal entity. Online registration available.",
      timeline: "24 hours",
      minCapital: "GBP 1",
    },
  ],
  US: [
    {
      id: "e1",
      title: "LLC (Limited Liability Company)",
      category: "entities",
      description:
        "Flexible structure combining corporation and partnership benefits. Pass-through taxation.",
      timeline: "1-2 weeks",
      minCapital: "State dependent",
    },
    {
      id: "e2",
      title: "C-Corporation",
      category: "entities",
      description:
        "Standard corporation. Double taxation but preferred by VCs. Can issue stock.",
      timeline: "1-2 weeks",
      minCapital: "None required",
    },
  ],
};

// Organizations by country
export const ORGANIZATIONS: Record<CountryCode, Organization[]> = {
  CN: [
    {
      id: "1",
      name: "Ministry of Commerce (MOFCOM)",
      nameLocal: "商务部",
      nameZh: "商务部",
      nameRu: "Министерство коммерции КНР (MOFCOM)",
      level: "national",
      website: "http://www.mofcom.gov.cn",
      description:
        "Central government ministry formulating trade policies, managing foreign investment, and overseeing international economic cooperation.",
      descriptionZh:
        "负责制定贸易政策、管理外商投资和监督国际经济合作的中央政府部委。",
      descriptionRu:
        "Центральное правительственное министерство, формирующее торговую политику, управляющее иностранными инвестициями и курирующее международное экономическое сотрудничество.",
    },
    {
      id: "2",
      name: "China Council for Promotion of International Trade (CCPIT)",
      nameLocal: "中国国际贸易促进委员会",
      nameZh: "中国国际贸易促进委员会",
      nameRu: "Китайский совет по содействию международной торговле (CCPIT)",
      level: "national",
      website: "http://www.ccpit.org",
      description:
        "China's largest trade promotion organization. Issues certificates of origin, organizes trade delegations.",
      descriptionZh: "中国最大的贸易促进组织。颁发原产地证书，组织贸易代表团。",
      descriptionRu:
        "Крупнейшая организация Китая по содействию торговле. Выдаёт сертификаты происхождения, организует торговые делегации.",
    },
    {
      id: "3",
      name: "China Chamber of International Commerce (CCOIC)",
      nameLocal: "中国国际商会",
      nameZh: "中国国际商会",
      nameRu: "Китайская палата международной торговли (CCOIC)",
      level: "national",
      website: "http://www.ccoic.cn",
      description:
        "National business organization representing Chinese enterprises in international trade.",
      descriptionZh: "代表中国企业参与国际贸易的全国性商业组织。",
      descriptionRu:
        "Национальная бизнес-организация, представляющая китайские предприятия в международной торговле.",
    },
  ],
  RU: [
    {
      id: "1",
      name: "Ministry of Economic Development",
      nameLocal: "Минэкономразвития России",
      nameZh: "俄罗斯经济发展部",
      nameRu: "Министерство экономического развития России",
      level: "national",
      website: "https://economy.gov.ru",
      description:
        "Federal ministry for economic strategy, investment climate, and special economic zones.",
      descriptionZh: "负责经济战略、投资环境和经济特区的联邦部委。",
      descriptionRu:
        "Федеральное министерство по экономической стратегии, инвестиционному климату и особым экономическим зонам.",
    },
    {
      id: "2",
      name: "Russian Export Center (REC)",
      nameLocal: "Российский экспортный центр",
      nameZh: "俄罗斯出口中心",
      nameRu: "Российский экспортный центр (РЭЦ)",
      level: "national",
      website: "https://exportcenter.ru",
      description:
        "State institution providing export financing, insurance, and support services.",
      descriptionZh: "提供出口融资、保险和支持服务的国家机构。",
      descriptionRu:
        "Государственный институт, предоставляющий экспортное финансирование, страхование и услуги поддержки.",
    },
    {
      id: "3",
      name: "Russian Direct Investment Fund (RDIF)",
      nameLocal: "РФПИ",
      nameZh: "俄罗斯直接投资基金",
      nameRu: "Российский фонд прямых инвестиций (РФПИ)",
      level: "national",
      website: "https://rdif.ru",
      description:
        "Russia's sovereign wealth fund co-investing with foreign partners.",
      descriptionZh: "与外国合作伙伴共同投资的俄罗斯主权财富基金。",
      descriptionRu:
        "Суверенный фонд России, осуществляющий совместные инвестиции с иностранными партнёрами.",
    },
  ],
  IN: [
    {
      id: "1",
      name: "Ministry of Commerce and Industry",
      nameLocal: "वाणिज्य और उद्योग मंत्रालय",
      level: "national",
      website: "https://commerce.gov.in",
      description:
        "Central ministry overseeing trade policy, export promotion, and foreign investment.",
    },
    {
      id: "2",
      name: "Invest India",
      level: "national",
      website: "https://www.investindia.gov.in",
      description:
        "National investment promotion agency providing facilitation services to investors.",
    },
    {
      id: "3",
      name: "FICCI (Federation of Indian Chambers of Commerce)",
      level: "national",
      website: "https://ficci.in",
      description:
        "Largest and oldest business organization in India representing industry interests.",
    },
  ],
  AE: [
    {
      id: "1",
      name: "Ministry of Economy",
      nameLocal: "وزارة الاقتصاد",
      level: "national",
      website: "https://www.moec.gov.ae",
      description:
        "Federal ministry responsible for economic policies and business environment.",
    },
    {
      id: "2",
      name: "Dubai Chamber of Commerce",
      level: "regional",
      website: "https://www.dubaichamber.com",
      description:
        "Key business support organization for Dubai's private sector.",
    },
    {
      id: "3",
      name: "Abu Dhabi Investment Office (ADIO)",
      level: "regional",
      website: "https://www.investinabudhabi.ae",
      description: "Investment promotion agency for Abu Dhabi emirate.",
    },
  ],
  JP: [
    {
      id: "1",
      name: "METI (Ministry of Economy, Trade and Industry)",
      nameLocal: "経済産業省",
      level: "national",
      website: "https://www.meti.go.jp",
      description: "Ministry overseeing industrial policy, trade, and energy.",
    },
    {
      id: "2",
      name: "JETRO (Japan External Trade Organization)",
      nameLocal: "日本貿易振興機構",
      level: "national",
      website: "https://www.jetro.go.jp",
      description:
        "Government organization promoting trade and investment between Japan and the world.",
    },
  ],
  VN: [
    {
      id: "1",
      name: "Ministry of Planning and Investment",
      nameLocal: "Bộ Kế hoạch và Đầu tư",
      level: "national",
      website: "http://www.mpi.gov.vn",
      description:
        "Ministry managing FDI, economic planning, and development zones.",
    },
    {
      id: "2",
      name: "Vietnam Chamber of Commerce and Industry (VCCI)",
      level: "national",
      website: "https://www.vcci.com.vn",
      description:
        "National organization representing business interests and promoting trade.",
    },
  ],
  DE: [
    {
      id: "1",
      name: "Federal Ministry for Economic Affairs",
      nameLocal: "Bundesministerium für Wirtschaft",
      level: "national",
      website: "https://www.bmwk.de",
      description:
        "Ministry responsible for economic policy, SME support, and foreign trade.",
    },
    {
      id: "2",
      name: "Germany Trade & Invest (GTAI)",
      level: "national",
      website: "https://www.gtai.de",
      description:
        "Federal agency for foreign trade and inward investment promotion.",
    },
    {
      id: "3",
      name: "DIHK (Association of German Chambers of Commerce)",
      nameLocal: "Deutscher Industrie- und Handelskammertag",
      level: "national",
      website: "https://www.dihk.de",
      description:
        "Umbrella organization of 79 German Chambers of Commerce and Industry.",
    },
  ],
  FR: [
    {
      id: "1",
      name: "Ministry of Economy and Finance",
      nameLocal: "Ministère de l'Économie",
      level: "national",
      website: "https://www.economie.gouv.fr",
      description: "Ministry overseeing economic policy, budget, and trade.",
    },
    {
      id: "2",
      name: "Business France",
      level: "national",
      website: "https://www.businessfrance.fr",
      description:
        "National agency supporting international development of French businesses and foreign investment.",
    },
    {
      id: "3",
      name: "CCI France (Chambers of Commerce)",
      level: "national",
      website: "https://www.cci.fr",
      description:
        "Network of French chambers of commerce providing business support services.",
    },
  ],
  BR: [
    {
      id: "1",
      name: "Ministry of Economy",
      nameLocal: "Ministério da Economia",
      level: "national",
      website: "https://www.gov.br/economia",
      description:
        "Ministry responsible for economic policy, trade, and investment.",
    },
    {
      id: "2",
      name: "ApexBrasil",
      level: "national",
      website: "https://www.apexbrasil.com.br",
      description: "Brazilian Trade and Investment Promotion Agency.",
    },
  ],
  AR: [
    {
      id: "1",
      name: "Ministry of Economy",
      nameLocal: "Ministerio de Economía",
      level: "national",
      website: "https://www.argentina.gob.ar/economia",
      description: "Ministry overseeing economic policy and trade.",
    },
    {
      id: "2",
      name: "Argentina Investment Agency",
      level: "national",
      website: "https://www.inversionycomercio.ar",
      description: "National agency promoting foreign direct investment.",
    },
  ],
  KR: [
    {
      id: "1",
      name: "Ministry of Trade, Industry and Energy",
      nameLocal: "산업통상자원부",
      level: "national",
      website: "https://www.motie.go.kr",
      description:
        "Ministry overseeing trade policy and industrial development.",
    },
    {
      id: "2",
      name: "KOTRA (Korea Trade-Investment Promotion Agency)",
      nameLocal: "대한무역투자진흥공사",
      level: "national",
      website: "https://www.kotra.or.kr",
      description:
        "Government agency promoting Korean exports and attracting FDI.",
    },
  ],
  SG: [
    {
      id: "1",
      name: "Ministry of Trade and Industry",
      level: "national",
      website: "https://www.mti.gov.sg",
      description:
        "Ministry responsible for trade policy and economic development.",
    },
    {
      id: "2",
      name: "Economic Development Board (EDB)",
      level: "national",
      website: "https://www.edb.gov.sg",
      description:
        "Lead agency for attracting foreign investment to Singapore.",
    },
  ],
  ID: [
    {
      id: "1",
      name: "Investment Coordinating Board (BKPM)",
      nameLocal: "Badan Koordinasi Penanaman Modal",
      level: "national",
      website: "https://www.bkpm.go.id",
      description: "Government agency for investment licensing and promotion.",
    },
  ],
  MY: [
    {
      id: "1",
      name: "Malaysian Investment Development Authority (MIDA)",
      level: "national",
      website: "https://www.mida.gov.my",
      description:
        "Premier agency for promotion of manufacturing and services sectors.",
    },
  ],
  TH: [
    {
      id: "1",
      name: "Board of Investment (BOI)",
      level: "national",
      website: "https://www.boi.go.th",
      description:
        "Government agency offering tax incentives and investment promotion.",
    },
  ],
  PH: [
    {
      id: "1",
      name: "Board of Investments",
      level: "national",
      website: "https://boi.gov.ph",
      description: "Lead investment promotion agency of the Philippines.",
    },
  ],
  TR: [
    {
      id: "1",
      name: "Investment Office of the Presidency",
      level: "national",
      website: "https://www.invest.gov.tr",
      description: "Official investment promotion agency of Turkey.",
    },
  ],
  SA: [
    {
      id: "1",
      name: "Ministry of Investment (MISA)",
      nameLocal: "وزارة الاستثمار",
      level: "national",
      website: "https://www.misa.gov.sa",
      description: "Ministry responsible for investment policy and promotion.",
    },
  ],
  EG: [
    {
      id: "1",
      name: "General Authority for Investment (GAFI)",
      level: "national",
      website: "https://www.gafi.gov.eg",
      description: "Main body for regulating and promoting investment.",
    },
  ],
  MX: [
    {
      id: "1",
      name: "Ministry of Economy",
      nameLocal: "Secretaría de Economía",
      level: "national",
      website: "https://www.gob.mx/se",
      description: "Ministry responsible for trade and investment policy.",
    },
  ],
  GB: [
    {
      id: "1",
      name: "Department for Business and Trade",
      level: "national",
      website:
        "https://www.gov.uk/government/organisations/department-for-business-and-trade",
      description:
        "Government department responsible for trade policy and business environment.",
    },
  ],
  US: [
    {
      id: "1",
      name: "Department of Commerce",
      level: "national",
      website: "https://www.commerce.gov",
      description:
        "Federal department promoting economic growth, trade, and technological competitiveness.",
    },
    {
      id: "2",
      name: "SelectUSA",
      level: "national",
      website: "https://www.selectusa.gov",
      description:
        "Federal program facilitating business investment in the United States.",
    },
  ],
};

// Trade events by country
export const TRADE_EVENTS: Record<CountryCode, TradeEvent[]> = {
  CN: [
    {
      id: "1",
      title: "Canton Fair (Spring)",
      titleZh: "广交会（春季）",
      titleRu: "Кантонская ярмарка (весна)",
      date: "2026-04-15",
      endDate: "2026-05-05",
      location: "Guangzhou",
      locationZh: "广州",
      locationRu: "Гуанчжоу",
      description:
        "China Import and Export Fair - the largest trade fair in China with over 25,000 exhibitors.",
      descriptionZh:
        "中国进出口商品交易会——中国最大的贸易展会，参展商超过25,000家。",
      descriptionRu:
        "Китайская ярмарка импортных и экспортных товаров — крупнейшая торговая ярмарка в Китае с более чем 25 000 экспонентов.",
      url: "https://www.cantonfair.org.cn",
      country: "CN",
    },
    {
      id: "2",
      title: "China International Import Expo (CIIE)",
      titleZh: "中国国际进口博览会",
      titleRu: "Китайская международная импортная выставка (CIIE)",
      date: "2026-11-05",
      endDate: "2026-11-10",
      location: "Shanghai",
      locationZh: "上海",
      locationRu: "Шанхай",
      description:
        "World's first import-themed national expo. Platform for foreign companies to access Chinese market.",
      descriptionZh:
        "世界首个以进口为主题的国家级博览会。外国企业进入中国市场的平台。",
      descriptionRu:
        "Первая в мире национальная выставка, посвящённая импорту. Платформа для иностранных компаний для выхода на китайский рынок.",
      url: "https://www.ciie.org",
      country: "CN",
    },
    {
      id: "3",
      title: "Boao Forum for Asia",
      titleZh: "博鳌亚洲论坛",
      titleRu: "Боаоский азиатский форум",
      date: "2026-03-26",
      endDate: "2026-03-29",
      location: "Hainan",
      locationZh: "海南",
      locationRu: "Хайнань",
      description:
        "Asia's Davos - premier forum for Asian economic integration.",
      descriptionZh: "亚洲的达沃斯——亚洲经济一体化的首要论坛。",
      descriptionRu:
        "Азиатский Давос — ведущий форум по азиатской экономической интеграции.",
      url: "https://www.boaoforum.org",
      country: "CN",
    },
  ],
  RU: [
    {
      id: "1",
      title: "St. Petersburg International Economic Forum (SPIEF)",
      titleZh: "圣彼得堡国际经济论坛",
      titleRu: "Петербургский международный экономический форум (ПМЭФ)",
      date: "2026-06-17",
      endDate: "2026-06-20",
      location: "Saint Petersburg",
      locationZh: "圣彼得堡",
      locationRu: "Санкт-Петербург",
      description:
        "Premier annual Russian business forum since 1997. 15,000+ participants from 130+ countries.",
      descriptionZh:
        "自1997年以来的俄罗斯首要年度商业论坛。来自130多个国家的15,000多名参与者。",
      descriptionRu:
        "Ведущий ежегодный российский бизнес-форум с 1997 года. Более 15 000 участников из 130+ стран.",
      url: "https://forumspb.com",
      country: "RU",
    },
    {
      id: "2",
      title: "Eastern Economic Forum (EEF)",
      titleZh: "东方经济论坛",
      titleRu: "Восточный экономический форум (ВЭФ)",
      date: "2026-09-09",
      endDate: "2026-09-12",
      location: "Vladivostok",
      locationZh: "符拉迪沃斯托克",
      locationRu: "Владивосток",
      description:
        "Annual forum promoting development of Russian Far East and Asia-Pacific cooperation.",
      descriptionZh: "促进俄罗斯远东发展和亚太合作的年度论坛。",
      descriptionRu:
        "Ежегодный форум, способствующий развитию Дальнего Востока России и сотрудничеству в Азиатско-Тихоокеанском регионе.",
      url: "https://forumvostok.ru",
      country: "RU",
    },
    {
      id: "3",
      title: "INNOPROM Industrial Trade Fair",
      titleZh: "叶卡捷琳堡国际工业展",
      titleRu: "ИННОПРОМ",
      date: "2026-07-06",
      endDate: "2026-07-09",
      location: "Ekaterinburg",
      locationZh: "叶卡捷琳堡",
      locationRu: "Екатеринбург",
      description:
        "Russia's main industrial exhibition showcasing manufacturing and Industry 4.0 technologies.",
      descriptionZh: "俄罗斯主要的工业展览，展示制造业和工业4.0技术。",
      descriptionRu:
        "Главная промышленная выставка России, демонстрирующая производство и технологии Индустрии 4.0.",
      url: "https://innoprom.com",
      country: "RU",
    },
  ],
  IN: [
    {
      id: "1",
      title: "Vibrant Gujarat Global Summit",
      date: "2026-01-10",
      endDate: "2026-01-12",
      location: "Gandhinagar",
      description:
        "Biennial business summit attracting global investors and industry leaders.",
      url: "https://www.vibrantgujarat.com",
      country: "IN",
    },
    {
      id: "2",
      title: "India Economic Conclave",
      date: "2026-02-15",
      endDate: "2026-02-16",
      location: "New Delhi",
      description:
        "Annual forum discussing India's economic policy and investment climate.",
      country: "IN",
    },
  ],
  AE: [
    {
      id: "1",
      title: "World Government Summit",
      date: "2026-02-09",
      endDate: "2026-02-11",
      location: "Dubai",
      description:
        "Premier gathering of global leaders discussing the future of government.",
      url: "https://www.worldgovernmentsummit.org",
      country: "AE",
    },
    {
      id: "2",
      title: "Abu Dhabi International Petroleum Exhibition (ADIPEC)",
      date: "2026-11-09",
      endDate: "2026-11-12",
      location: "Abu Dhabi",
      description: "One of the world's largest oil and gas exhibitions.",
      url: "https://www.adipec.com",
      country: "AE",
    },
  ],
  JP: [
    {
      id: "1",
      title: "CEATEC Japan",
      date: "2026-10-20",
      endDate: "2026-10-23",
      location: "Tokyo (Makuhari)",
      description: "Cutting Edge IT & Electronics Comprehensive Exhibition.",
      url: "https://www.ceatec.com",
      country: "JP",
    },
  ],
  VN: [
    {
      id: "1",
      title: "Vietnam Expo",
      date: "2026-04-08",
      endDate: "2026-04-11",
      location: "Hanoi",
      description: "Vietnam's largest international trade fair.",
      country: "VN",
    },
  ],
  DE: [
    {
      id: "1",
      title: "Hannover Messe",
      date: "2026-04-13",
      endDate: "2026-04-17",
      location: "Hannover",
      description: "World's leading trade fair for industrial technology.",
      url: "https://www.hannovermesse.de",
      country: "DE",
    },
    {
      id: "2",
      title: "Automechanika Frankfurt",
      date: "2026-09-08",
      endDate: "2026-09-12",
      location: "Frankfurt",
      description:
        "World's largest automotive trade fair for aftermarket and OEM.",
      url: "https://automechanika.messefrankfurt.com",
      country: "DE",
    },
  ],
  FR: [
    {
      id: "1",
      title: "VivaTech",
      date: "2026-06-11",
      endDate: "2026-06-14",
      location: "Paris",
      description: "Europe's largest startup and tech event.",
      url: "https://vivatechnology.com",
      country: "FR",
    },
    {
      id: "2",
      title: "Paris Air Show (Le Bourget)",
      date: "2027-06-21",
      endDate: "2027-06-27",
      location: "Paris (Le Bourget)",
      description:
        "World's oldest and largest aerospace industry trade show (biennial, odd years).",
      url: "https://www.siae.fr",
      country: "FR",
    },
  ],
  BR: [
    {
      id: "1",
      title: "FIESP Brazil Investment Forum",
      date: "2026-05-20",
      endDate: "2026-05-21",
      location: "Sao Paulo",
      description:
        "Major investment forum hosted by Sao Paulo's Industry Federation.",
      country: "BR",
    },
  ],
  AR: [
    {
      id: "1",
      title: "Expo Rural Buenos Aires",
      date: "2026-07-18",
      endDate: "2026-07-27",
      location: "Buenos Aires",
      description: "Argentina's largest agricultural and livestock exhibition.",
      country: "AR",
    },
  ],
  KR: [
    {
      id: "1",
      title: "Korea Electronics Show (KES)",
      date: "2026-10-06",
      endDate: "2026-10-09",
      location: "Seoul",
      description: "Korea's largest electronics and IT exhibition.",
      country: "KR",
    },
  ],
  SG: [
    {
      id: "1",
      title: "Singapore FinTech Festival",
      date: "2026-11-11",
      endDate: "2026-11-13",
      location: "Singapore",
      description: "World's largest fintech event.",
      url: "https://www.fintechfestival.sg",
      country: "SG",
    },
  ],
  ID: [
    {
      id: "1",
      title: "Trade Expo Indonesia",
      date: "2026-10-21",
      endDate: "2026-10-25",
      location: "Jakarta",
      description: "Indonesia's largest trade exhibition.",
      country: "ID",
    },
  ],
  MY: [
    {
      id: "1",
      title: "MIHAS (Malaysia International Halal Showcase)",
      date: "2026-09-17",
      endDate: "2026-09-20",
      location: "Kuala Lumpur",
      description: "World's largest halal trade exhibition.",
      country: "MY",
    },
  ],
  TH: [
    {
      id: "1",
      title: "Thailand Investment Fair",
      date: "2026-06-15",
      endDate: "2026-06-17",
      location: "Bangkok",
      description: "Major investment promotion event by BOI Thailand.",
      country: "TH",
    },
  ],
  PH: [
    {
      id: "1",
      title: "Philippine Business Expo",
      date: "2026-03-18",
      endDate: "2026-03-20",
      location: "Manila",
      description: "Annual business and trade exhibition.",
      country: "PH",
    },
  ],
  TR: [
    {
      id: "1",
      title: "Istanbul Economy Summit",
      date: "2026-05-14",
      endDate: "2026-05-15",
      location: "Istanbul",
      description:
        "Major economic forum bringing together regional business leaders.",
      country: "TR",
    },
  ],
  SA: [
    {
      id: "1",
      title: "Future Investment Initiative (FII)",
      date: "2026-10-25",
      endDate: "2026-10-27",
      location: "Riyadh",
      description: "Annual investment forum known as 'Davos in the Desert'.",
      url: "https://futureinvestmentinitiative.com",
      country: "SA",
    },
  ],
  EG: [
    {
      id: "1",
      title: "Egypt Energy Show",
      date: "2026-02-16",
      endDate: "2026-02-18",
      location: "Cairo",
      description: "North Africa's largest energy conference and exhibition.",
      country: "EG",
    },
  ],
  MX: [
    {
      id: "1",
      title: "Mexico Business Summit",
      date: "2026-10-25",
      endDate: "2026-10-27",
      location: "Guadalajara",
      description: "Annual gathering of business and government leaders.",
      country: "MX",
    },
  ],
  GB: [
    {
      id: "1",
      title: "London Tech Week",
      date: "2026-06-08",
      endDate: "2026-06-12",
      location: "London",
      description: "Europe's largest tech festival.",
      url: "https://londontechweek.com",
      country: "GB",
    },
  ],
  US: [
    {
      id: "1",
      title: "CES (Consumer Electronics Show)",
      date: "2026-01-06",
      endDate: "2026-01-09",
      location: "Las Vegas",
      description: "World's largest consumer technology trade show.",
      url: "https://www.ces.tech",
      country: "US",
    },
    {
      id: "2",
      title: "SelectUSA Investment Summit",
      date: "2026-06-22",
      endDate: "2026-06-25",
      location: "Washington, D.C.",
      description:
        "Premier event promoting foreign direct investment into the United States.",
      url: "https://www.selectusasummit.us",
      country: "US",
    },
  ],
};

// Helper function to get bilateral agreement key
export function getBilateralKey(
  countryA: CountryCode,
  countryB: CountryCode
): string {
  // Sort alphabetically to ensure consistent key regardless of order
  const sorted = [countryA, countryB].sort();
  return `${sorted[0]}-${sorted[1]}`;
}

// Helper function to get agreements for a country pair
export function getAgreementsForPair(
  countryA: CountryCode,
  countryB: CountryCode
): BilateralAgreement[] {
  const key = getBilateralKey(countryA, countryB);
  return BILATERAL_AGREEMENTS[key] || [];
}

// Helper function to get visa info for both countries in a pair
export function getVisaInfoForPair(
  countryA: CountryCode,
  countryB: CountryCode
): { countryA: VisaInfo[]; countryB: VisaInfo[] } {
  return {
    countryA: VISA_INFO[countryA] || [],
    countryB: VISA_INFO[countryB] || [],
  };
}

// Helper function to get entity types for both countries in a pair
export function getEntityTypesForPair(
  countryA: CountryCode,
  countryB: CountryCode
): { countryA: EntityType[]; countryB: EntityType[] } {
  return {
    countryA: ENTITY_TYPES[countryA] || [],
    countryB: ENTITY_TYPES[countryB] || [],
  };
}

// Helper function to get organizations for both countries
export function getOrganizationsForPair(
  countryA: CountryCode,
  countryB: CountryCode
): { countryA: Organization[]; countryB: Organization[] } {
  return {
    countryA: ORGANIZATIONS[countryA] || [],
    countryB: ORGANIZATIONS[countryB] || [],
  };
}

// Helper function to get events for both countries
export function getEventsForPair(
  countryA: CountryCode,
  countryB: CountryCode
): TradeEvent[] {
  const eventsA = TRADE_EVENTS[countryA] || [];
  const eventsB = TRADE_EVENTS[countryB] || [];
  // Combine and sort by date
  return [...eventsA, ...eventsB].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
