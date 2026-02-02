import * as fs from "fs";
import * as path from "path";
import {
  PortalScaffoldConfig,
  PortalScaffoldConfigSchema,
  Locale,
  CountryCode,
  CountryPair,
  COUNTRY_INFO,
  getAgreementsForPair,
  getVisaInfoForPair,
  getEntityTypesForPair,
  getOrganizationsForPair,
  getEventsForPair,
} from "./portalConfig";

export interface ScaffoldResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  error?: string;
}

function writeFile(
  projectPath: string,
  relativePath: string,
  content: string,
  filesCreated: string[]
): void {
  const fullPath = path.join(projectPath, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, "utf-8");
  filesCreated.push(relativePath);
}

function getCountryName(code: CountryCode, locale: Locale): string {
  const names: Record<string, Record<string, string>> = {
    CN: {
      zh: "中国",
      ru: "Китай",
      en: "China",
      ja: "中国",
      vi: "Trung Quốc",
      hi: "चीन",
      ar: "الصين",
      ko: "중국",
      th: "จีน",
      id: "Tiongkok",
      ms: "China",
      tr: "Çin",
      pt: "China",
      es: "China",
      fr: "Chine",
      de: "China",
    },
    RU: {
      zh: "俄罗斯",
      ru: "Россия",
      en: "Russia",
      ja: "ロシア",
      vi: "Nga",
      hi: "रूस",
      ar: "روسيا",
      ko: "러시아",
      th: "รัสเซีย",
      id: "Rusia",
      ms: "Rusia",
      tr: "Rusya",
      pt: "Rússia",
      es: "Rusia",
      fr: "Russie",
      de: "Russland",
    },
    IN: {
      en: "India",
      hi: "भारत",
      zh: "印度",
      ru: "Индия",
      ja: "インド",
      vi: "Ấn Độ",
      ar: "الهند",
      ko: "인도",
      th: "อินเดีย",
      id: "India",
      ms: "India",
      tr: "Hindistan",
      pt: "Índia",
      es: "India",
      fr: "Inde",
      de: "Indien",
    },
    AE: {
      en: "UAE",
      ar: "الإمارات",
      zh: "阿联酋",
      ru: "ОАЭ",
      ja: "UAE",
      vi: "UAE",
      hi: "संयुक्त अरब अमीरात",
      ko: "UAE",
      th: "สหรัฐอาหรับเอมิเรตส์",
      id: "UEA",
      ms: "UAE",
      tr: "BAE",
      pt: "EAU",
      es: "EAU",
      fr: "EAU",
      de: "VAE",
    },
    JP: {
      en: "Japan",
      ja: "日本",
      zh: "日本",
      ru: "Япония",
      vi: "Nhật Bản",
      hi: "जापान",
      ar: "اليابان",
      ko: "일본",
      th: "ญี่ปุ่น",
      id: "Jepang",
      ms: "Jepun",
      tr: "Japonya",
      pt: "Japão",
      es: "Japón",
      fr: "Japon",
      de: "Japan",
    },
    VN: {
      en: "Vietnam",
      vi: "Việt Nam",
      zh: "越南",
      ru: "Вьетнам",
      ja: "ベトナム",
      hi: "वियतनाम",
      ar: "فيتنام",
      ko: "베트남",
      th: "เวียดนาม",
      id: "Vietnam",
      ms: "Vietnam",
      tr: "Vietnam",
      pt: "Vietnã",
      es: "Vietnam",
      fr: "Vietnam",
      de: "Vietnam",
    },
    KR: {
      en: "South Korea",
      ko: "대한민국",
      zh: "韩国",
      ru: "Южная Корея",
      ja: "韓国",
      vi: "Hàn Quốc",
      hi: "दक्षिण कोरिया",
      ar: "كوريا الجنوبية",
      th: "เกาหลีใต้",
      id: "Korea Selatan",
      ms: "Korea Selatan",
      tr: "Güney Kore",
      pt: "Coreia do Sul",
      es: "Corea del Sur",
      fr: "Corée du Sud",
      de: "Südkorea",
    },
    SG: {
      en: "Singapore",
      zh: "新加坡",
      ru: "Сингапур",
      ja: "シンガポール",
      vi: "Singapore",
      hi: "सिंगापुर",
      ar: "سنغافورة",
      ko: "싱가포르",
      th: "สิงคโปร์",
      id: "Singapura",
      ms: "Singapura",
      tr: "Singapur",
      pt: "Singapura",
      es: "Singapur",
      fr: "Singapour",
      de: "Singapur",
    },
    ID: {
      en: "Indonesia",
      id: "Indonesia",
      zh: "印度尼西亚",
      ru: "Индонезия",
      ja: "インドネシア",
      vi: "Indonesia",
      hi: "इंडोनेशिया",
      ar: "إندونيسيا",
      ko: "인도네시아",
      th: "อินโดนีเซีย",
      ms: "Indonesia",
      tr: "Endonezya",
      pt: "Indonésia",
      es: "Indonesia",
      fr: "Indonésie",
      de: "Indonesien",
    },
    TR: {
      en: "Turkey",
      tr: "Türkiye",
      zh: "土耳其",
      ru: "Турция",
      ja: "トルコ",
      vi: "Thổ Nhĩ Kỳ",
      hi: "तुर्की",
      ar: "تركيا",
      ko: "터키",
      th: "ตุรกี",
      id: "Turki",
      ms: "Turki",
      pt: "Turquia",
      es: "Turquía",
      fr: "Turquie",
      de: "Türkei",
    },
    SA: {
      en: "Saudi Arabia",
      ar: "السعودية",
      zh: "沙特阿拉伯",
      ru: "Саудовская Аравия",
      ja: "サウジアラビア",
      vi: "Ả Rập Xê Út",
      hi: "सऊदी अरब",
      ko: "사우디아라비아",
      th: "ซาอุดีอาระเบีย",
      id: "Arab Saudi",
      ms: "Arab Saudi",
      tr: "Suudi Arabistan",
      pt: "Arábia Saudita",
      es: "Arabia Saudita",
      fr: "Arabie saoudite",
      de: "Saudi-Arabien",
    },
    BR: {
      en: "Brazil",
      pt: "Brasil",
      zh: "巴西",
      ru: "Бразилия",
      ja: "ブラジル",
      vi: "Brazil",
      hi: "ब्राज़ील",
      ar: "البرازيل",
      ko: "브라질",
      th: "บราซิล",
      id: "Brasil",
      ms: "Brazil",
      tr: "Brezilya",
      es: "Brasil",
      fr: "Brésil",
      de: "Brasilien",
    },
    DE: {
      en: "Germany",
      de: "Deutschland",
      zh: "德国",
      ru: "Германия",
      ja: "ドイツ",
      vi: "Đức",
      hi: "जर्मनी",
      ar: "ألمانيا",
      ko: "독일",
      th: "เยอรมนี",
      id: "Jerman",
      ms: "Jerman",
      tr: "Almanya",
      pt: "Alemanha",
      es: "Alemania",
      fr: "Allemagne",
    },
    FR: {
      en: "France",
      fr: "France",
      zh: "法国",
      ru: "Франция",
      ja: "フランス",
      vi: "Pháp",
      hi: "फ्रांस",
      ar: "فرنسا",
      ko: "프랑스",
      th: "ฝรั่งเศส",
      id: "Prancis",
      ms: "Perancis",
      tr: "Fransa",
      pt: "França",
      es: "Francia",
      de: "Frankreich",
    },
    GB: {
      en: "United Kingdom",
      zh: "英国",
      ru: "Великобритания",
      ja: "イギリス",
      vi: "Anh",
      hi: "यूनाइटेड किंगडम",
      ar: "المملكة المتحدة",
      ko: "영국",
      th: "สหราชอาณาจักร",
      id: "Inggris",
      ms: "United Kingdom",
      tr: "Birleşik Krallık",
      pt: "Reino Unido",
      es: "Reino Unido",
      fr: "Royaume-Uni",
      de: "Vereinigtes Königreich",
    },
    US: {
      en: "United States",
      zh: "美国",
      ru: "США",
      ja: "アメリカ",
      vi: "Mỹ",
      hi: "संयुक्त राज्य अमेरिका",
      ar: "الولايات المتحدة",
      ko: "미국",
      th: "สหรัฐอเมริกา",
      id: "Amerika Serikat",
      ms: "Amerika Syarikat",
      tr: "Amerika Birleşik Devletleri",
      pt: "Estados Unidos",
      es: "Estados Unidos",
      fr: "États-Unis",
      de: "Vereinigte Staaten",
    },
    EG: {
      en: "Egypt",
      ar: "مصر",
      zh: "埃及",
      ru: "Египет",
      ja: "エジプト",
      vi: "Ai Cập",
      hi: "मिस्र",
      ko: "이집트",
      th: "อียิปต์",
      id: "Mesir",
      ms: "Mesir",
      tr: "Mısır",
      pt: "Egito",
      es: "Egipto",
      fr: "Égypte",
      de: "Ägypten",
    },
    MY: {
      en: "Malaysia",
      ms: "Malaysia",
      zh: "马来西亚",
      ru: "Малайзия",
      ja: "マレーシア",
      vi: "Malaysia",
      hi: "मलेशिया",
      ar: "ماليزيا",
      ko: "말레이시아",
      th: "มาเลเซีย",
      id: "Malaysia",
      tr: "Malezya",
      pt: "Malásia",
      es: "Malasia",
      fr: "Malaisie",
      de: "Malaysia",
    },
    TH: {
      en: "Thailand",
      th: "ประเทศไทย",
      zh: "泰国",
      ru: "Таиланд",
      ja: "タイ",
      vi: "Thái Lan",
      hi: "थाईलैंड",
      ar: "تايلاند",
      ko: "태국",
      id: "Thailand",
      ms: "Thailand",
      tr: "Tayland",
      pt: "Tailândia",
      es: "Tailandia",
      fr: "Thaïlande",
      de: "Thailand",
    },
    PH: {
      en: "Philippines",
      zh: "菲律宾",
      ru: "Филиппины",
      ja: "フィリピン",
      vi: "Philippines",
      hi: "फिलीपींस",
      ar: "الفلبين",
      ko: "필리핀",
      th: "ฟิลิปปินส์",
      id: "Filipina",
      ms: "Filipina",
      tr: "Filipinler",
      pt: "Filipinas",
      es: "Filipinas",
      fr: "Philippines",
      de: "Philippinen",
    },
    MX: {
      en: "Mexico",
      es: "México",
      zh: "墨西哥",
      ru: "Мексика",
      ja: "メキシコ",
      vi: "Mexico",
      hi: "मेक्सिको",
      ar: "المكسيك",
      ko: "멕시코",
      th: "เม็กซิโก",
      id: "Meksiko",
      ms: "Mexico",
      tr: "Meksika",
      pt: "México",
      fr: "Mexique",
      de: "Mexiko",
    },
    AR: {
      en: "Argentina",
      es: "Argentina",
      zh: "阿根廷",
      ru: "Аргентина",
      ja: "アルゼンチン",
      vi: "Argentina",
      hi: "अर्जेंटीना",
      ar: "الأرجنتين",
      ko: "아르헨티나",
      th: "อาร์เจนตินา",
      id: "Argentina",
      ms: "Argentina",
      tr: "Arjantin",
      pt: "Argentina",
      fr: "Argentine",
      de: "Argentinien",
    },
  };
  return names[code]?.[locale] || names[code]?.["en"] || code;
}

export async function scaffoldBusinessPortal(
  config: PortalScaffoldConfig
): Promise<ScaffoldResult> {
  const validatedConfig = PortalScaffoldConfigSchema.parse(config);
  const {
    projectName,
    outputPath,
    countryPair,
    branding,
    features,
    geoDataSources,
    rssSources,
    database,
  } = validatedConfig;

  const projectPath = path.join(outputPath, projectName);
  const filesCreated: string[] = [];

  try {
    const dirs = [
      "src/app/[locale]",
      "src/app/[locale]/laws",
      "src/app/[locale]/calendar",
      "src/app/[locale]/organizations",
      "src/app/[locale]/news",
      "src/app/[locale]/invest",
      "src/app/[locale]/invest/[regionId]",
      "src/app/[locale]/invest/[regionId]/[cityId]",
      "src/app/[locale]/contact",
      "src/app/api/rss",
      "src/app/api/regions",
      "src/app/api/events",
      "src/app/api/contact",
      "src/app/api/newsletter",
      "src/components/globe",
      "src/components/map",
      "src/components/ui",
      "src/components/layout",
      "src/components/widgets",
      "src/features/laws",
      "src/features/calendar",
      "src/features/organizations",
      "src/features/news",
      "src/features/invest",
      "src/features/contact",
      "src/lib/i18n",
      "src/lib/geo",
      "src/lib/rss",
      "src/lib/db",
      "src/content/ru",
      "src/content/zh",
      "src/content/en",
      "messages",
      "public/geo",
      "scripts",
      "types",
    ];

    dirs.forEach(dir => {
      const fullPath = path.join(projectPath, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });

    writeFile(
      projectPath,
      "package.json",
      generatePackageJson(projectName, features),
      filesCreated
    );
    writeFile(projectPath, "tsconfig.json", generateTsConfig(), filesCreated);
    writeFile(
      projectPath,
      "next.config.mjs",
      generateNextConfig(countryPair.locales),
      filesCreated
    );
    writeFile(
      projectPath,
      "tailwind.config.ts",
      generateTailwindConfig(branding),
      filesCreated
    );
    writeFile(
      projectPath,
      "postcss.config.js",
      generatePostCssConfig(),
      filesCreated
    );
    writeFile(projectPath, ".env.example", generateEnvExample(), filesCreated);
    writeFile(projectPath, ".gitignore", generateGitIgnore(), filesCreated);

    writeFile(
      projectPath,
      "src/middleware.ts",
      generateMiddleware(countryPair.locales, countryPair.defaultLocale),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/lib/i18n/config.ts",
      generateI18nConfig(countryPair),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/lib/i18n/request.ts",
      generateI18nRequest(),
      filesCreated
    );

    countryPair.locales.forEach(locale => {
      writeFile(
        projectPath,
        `messages/${locale}.json`,
        generateMessages(locale, branding, countryPair),
        filesCreated
      );
    });

    writeFile(
      projectPath,
      "src/app/[locale]/layout.tsx",
      generateRootLayout(branding, countryPair),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/app/[locale]/page.tsx",
      generateHomePage(branding, features),
      filesCreated
    );

    writeFile(
      projectPath,
      "src/components/layout/Header.tsx",
      generateHeader(branding, countryPair),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/layout/Footer.tsx",
      generateFooter(branding, countryPair),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/layout/LocaleSwitcher.tsx",
      generateLocaleSwitcher(countryPair.locales),
      filesCreated
    );

    if (features.enable3DGlobe) {
      writeFile(
        projectPath,
        "src/components/globe/Globe3D.tsx",
        generateGlobe3D(branding, geoDataSources, countryPair),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/components/globe/GlobeWrapper.tsx",
        generateGlobeWrapper(),
        filesCreated
      );
    }

    writeFile(
      projectPath,
      "src/components/map/RegionMap.tsx",
      generateRegionMap(branding, geoDataSources),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/map/CityMap.tsx",
      generateCityMap(branding),
      filesCreated
    );

    if (features.enableLaws) {
      writeFile(
        projectPath,
        "src/app/[locale]/laws/page.tsx",
        generateLawsPage(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/laws/LawsContent.tsx",
        generateLawsContent(countryPair),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/laws/BusinessGuide.tsx",
        generateBusinessGuide(),
        filesCreated
      );
    }

    if (features.enableCalendar) {
      writeFile(
        projectPath,
        "src/app/[locale]/calendar/page.tsx",
        generateCalendarPage(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/calendar/EventList.tsx",
        generateEventList(countryPair),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/calendar/EventCard.tsx",
        generateEventCard(),
        filesCreated
      );
    }

    if (features.enableOrganizations) {
      writeFile(
        projectPath,
        "src/app/[locale]/organizations/page.tsx",
        generateOrganizationsPage(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/organizations/OrgDirectory.tsx",
        generateOrgDirectory(countryPair),
        filesCreated
      );
    }

    if (features.enableRssFeed) {
      writeFile(
        projectPath,
        "src/app/[locale]/news/page.tsx",
        generateNewsPage(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/news/NewsFeed.tsx",
        generateNewsFeed(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/lib/rss/parser.ts",
        generateRssParser(rssSources),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/app/api/rss/route.ts",
        generateRssApiRoute(),
        filesCreated
      );
    }

    if (features.enableInvestMap) {
      writeFile(
        projectPath,
        "src/app/[locale]/invest/page.tsx",
        generateInvestPage(features),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/app/[locale]/invest/[regionId]/page.tsx",
        generateRegionPage(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/app/[locale]/invest/[regionId]/[cityId]/page.tsx",
        generateCityPage(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/invest/RegionDetail.tsx",
        generateRegionDetail(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/invest/CityDetail.tsx",
        generateCityDetail(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/features/invest/EconomicStats.tsx",
        generateEconomicStats(),
        filesCreated
      );
      writeFile(
        projectPath,
        "src/data/regionData.ts",
        generateRegionData(),
        filesCreated
      );
    }

    writeFile(
      projectPath,
      "src/lib/db/schema.ts",
      generateDbSchema(database),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/lib/db/client.ts",
      generateDbClient(database),
      filesCreated
    );
    writeFile(
      projectPath,
      "drizzle.config.ts",
      generateDrizzleConfig(database),
      filesCreated
    );
    writeFile(
      projectPath,
      "scripts/seed.ts",
      generateSeedScript(countryPair),
      filesCreated
    );

    writeFile(
      projectPath,
      "types/globe.gl.d.ts",
      generateGlobeTypes(),
      filesCreated
    );
    writeFile(
      projectPath,
      "types/react-simple-maps.d.ts",
      generateReactSimpleMapsTypes(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/app/globals.css",
      generateGlobalCss(branding),
      filesCreated
    );

    writeFile(
      projectPath,
      "src/components/widgets/NewsletterSignup.tsx",
      generateNewsletterSignup(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/widgets/SocialShare.tsx",
      generateSocialShare(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/widgets/BackToTop.tsx",
      generateBackToTop(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/widgets/Breadcrumbs.tsx",
      generateBreadcrumbs(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/widgets/LoadingSkeleton.tsx",
      generateLoadingSkeleton(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/widgets/RelatedRegions.tsx",
      generateRelatedRegions(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/components/widgets/SearchDialog.tsx",
      generateSearchDialog(),
      filesCreated
    );

    writeFile(
      projectPath,
      "src/app/[locale]/contact/page.tsx",
      generateContactPage(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/features/contact/ContactForm.tsx",
      generateContactForm(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/app/api/contact/route.ts",
      generateContactApiRoute(),
      filesCreated
    );
    writeFile(
      projectPath,
      "src/app/api/newsletter/route.ts",
      generateNewsletterApiRoute(),
      filesCreated
    );

    writeFile(
      projectPath,
      "README.md",
      generateReadme(projectName, countryPair),
      filesCreated
    );

    return { success: true, projectPath, filesCreated };
  } catch (error) {
    return {
      success: false,
      projectPath,
      filesCreated,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function generatePackageJson(
  name: string,
  features: PortalScaffoldConfig["features"]
): string {
  const deps: Record<string, string> = {
    next: "^14.2.0",
    react: "^18.3.0",
    "react-dom": "^18.3.0",
    "next-intl": "^3.20.0",
    "drizzle-orm": "^0.30.0",
    pg: "^8.11.0",
    zod: "^3.23.0",
    "lucide-react": "^0.400.0",
    clsx: "^2.1.0",
    "tailwind-merge": "^2.3.0",
  };

  if (features.enable3DGlobe) {
    deps["react-globe.gl"] = "^2.33.0";
  }

  if (features.enableAnimations) {
    deps["framer-motion"] = "^11.0.0";
  }

  if (features.enableInvestMap) {
    deps["react-simple-maps"] = "^3.0.0";
    deps["d3-geo"] = "^3.1.0";
  }

  if (features.enableRssFeed) {
    deps["rss-parser"] = "^3.13.0";
  }

  return JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
        "db:generate": "drizzle-kit generate",
        "db:migrate": "drizzle-kit migrate",
        "db:push": "drizzle-kit push",
        "db:seed": "tsx scripts/seed.ts",
      },
      dependencies: deps,
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        "@types/three": "0.137.0",
        "@types/d3-geo": "^3.1.0",
        "@types/pg": "^8.11.0",
        typescript: "^5",
        "drizzle-kit": "^0.21.0",
        tailwindcss: "^3.4.0",
        postcss: "^8.4.0",
        autoprefixer: "^10.4.0",
        tsx: "^4.15.0",
      },
    },
    null,
    2
  );
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./src/*"] },
      },
      include: [
        "next-env.d.ts",
        "**/*.ts",
        "**/*.tsx",
        ".next/types/**/*.ts",
        "types/**/*.d.ts",
      ],
      exclude: ["node_modules"],
    },
    null,
    2
  );
}

function generateNextConfig(_locales: Locale[]): string {
  return `import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default withNextIntl(nextConfig);
`;
}

function generateTailwindConfig(
  branding: PortalScaffoldConfig["branding"]
): string {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "${branding.primaryColor}",
          50: "${branding.primaryColor}10",
          100: "${branding.primaryColor}20",
          500: "${branding.primaryColor}",
          600: "${branding.primaryColor}",
          700: "${branding.primaryColor}",
        },
        secondary: {
          DEFAULT: "${branding.secondaryColor}",
          500: "${branding.secondaryColor}",
        },
        accent: {
          DEFAULT: "${branding.accentColor}",
          500: "${branding.accentColor}",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
        "globe-rotate": "globeRotate 60s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        globeRotate: {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
`;
}

function generatePostCssConfig(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

function generateEnvExample(): string {
  return `DATABASE_URL=postgresql://user:password@localhost:5432/portal
NEXT_PUBLIC_GA_ID=
`;
}

function generateGitIgnore(): string {
  return `node_modules
.next
.env
.env.local
*.log
.DS_Store
`;
}

function generateMiddleware(
  _locales: Locale[],
  _defaultLocale: Locale
): string {
  return `import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/lib/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  matcher: ['/', '/(ru|zh|en)/:path*'],
};
`;
}

function generateI18nConfig(
  countryPair: PortalScaffoldConfig["countryPair"]
): string {
  const { countryA, countryB } = countryPair;
  const infoA = COUNTRY_INFO[countryA];
  const infoB = COUNTRY_INFO[countryB];

  return `export const locales = ${JSON.stringify(countryPair.locales)} as const;
export const defaultLocale = "${countryPair.defaultLocale}" as const;
export type Locale = (typeof locales)[number];
export type CountryCode = "${countryA}" | "${countryB}";

export const targetingRules = ${JSON.stringify(countryPair.targetingRules, null, 2)} as const;

export const COUNTRY_INFO: Record<string, { name: string; nativeName: string; flag: string; currency: string }> = {
  "${countryA}": { name: "${infoA.name}", nativeName: "${infoA.nativeName}", flag: "${infoA.flag}", currency: "${infoA.currency}" },
  "${countryB}": { name: "${infoB.name}", nativeName: "${infoB.nativeName}", flag: "${infoB.flag}", currency: "${infoB.currency}" },
};

export function getTargetCountry(locale: Locale): CountryCode {
  const rule = targetingRules.find(r => r.locale === locale);
  return (rule?.targetCountry ?? "${countryA}") as CountryCode;
}

export function getHomeCountry(locale: Locale): CountryCode {
  const rule = targetingRules.find(r => r.locale === locale);
  return (rule?.homeCountry ?? "${countryB}") as CountryCode;
}

export function getCountryName(code: CountryCode, locale: Locale): string {
  const info = COUNTRY_INFO[code];
  if (!info) return code;
  if (locale !== "en" && info.nativeName) return info.nativeName;
  return info.name;
}
`;
}

function generateI18nRequest(): string {
  return `import { getRequestConfig } from 'next-intl/server';
import { locales, type Locale } from './config';

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) {
    return { messages: {} };
  }

  return {
    messages: (await import(\`../../../messages/\${locale}.json\`)).default,
  };
});
`;
}

function generateMessages(
  locale: Locale,
  branding: PortalScaffoldConfig["branding"],
  countryPair: PortalScaffoldConfig["countryPair"]
): string {
  const _countryAName = getCountryName(countryPair.countryA, locale);
  const _countryBName = getCountryName(countryPair.countryB, locale);
  const countryANameEn = getCountryName(countryPair.countryA, "en");
  const countryBNameEn = getCountryName(countryPair.countryB, "en");
  const countryANameRu = getCountryName(countryPair.countryA, "ru");
  const countryBNameRu = getCountryName(countryPair.countryB, "ru");
  const countryANameZh = getCountryName(countryPair.countryA, "zh");
  const countryBNameZh = getCountryName(countryPair.countryB, "zh");

  const messages: Record<string, Record<string, unknown>> = {
    ru: {
      meta: {
        title: `${branding.name} - Инвестиции и торговля`,
        description: `Ваш путеводитель по бизнесу между ${countryANameRu} и ${countryBNameRu}`,
      },
      nav: {
        home: "Главная",
        laws: "Законодательство",
        calendar: "Календарь",
        organizations: "Организации",
        news: "Новости",
        invest: "Куда инвестировать",
        contact: "Контакты",
      },
      home: {
        hero: {
          title: `Мост между ${countryANameRu} и ${countryBNameRu}`,
          subtitle: "Откройте для себя возможности инвестиций и торговли",
        },
        cta: "Начать исследование",
      },
      laws: {
        title: "Законодательство",
        agreements: "Торговые соглашения",
        visas: "Визы и разрешения",
        entities: "Юридические лица",
        guide: "Руководство для инвесторов",
      },
      calendar: {
        title: "Календарь мероприятий",
        upcoming: "Предстоящие события",
        past: "Прошедшие события",
      },
      organizations: {
        title: "Организации",
        national: "Федеральные",
        regional: "Региональные",
        municipal: "Муниципальные",
      },
      news: {
        title: "Новости",
        latest: "Последние новости",
        business: "Бизнес",
        trade: "Торговля",
      },
      invest: {
        title: "Куда инвестировать",
        selectRegion: "Выберите регион",
        gdp: "ВВП",
        population: "Население",
        industries: "Отрасли",
        sez: "Особые экономические зоны",
        taxBenefits: "Налоговые льготы",
        back: "Назад",
        mapTitle: "Интерактивная карта инвестиций",
        mapSelectRegion: "Выберите регион для изучения",
        mapRegions: "Регионы",
        mapInstructions: "Наведите на регион • Нажмите для подробностей",
        mapClickToExplore: "Нажмите для изучения инвестиционных возможностей",
        countryA: countryANameRu,
        countryB: countryBNameRu,
        opportunities: "Инвестиционные возможности",
        keyProjects: "Ключевые проекты",
        advantages: "Конкурентные преимущества",
        contact: "Контакты для инвестиций",
        majorCities: "Крупные города",
        agency: "Агентство",
        website: "Сайт",
        email: "Эл. почта",
        phone: "Телефон",
        visitWebsite: "Посетить сайт",
        partners: "Партнёры",
        target: "Срок",
        ongoing: "В процессе",
        priority: "Приоритет",
        active: "Активный",
        upcoming: "Ожидается",
        zones: "зон",
        years: "лет",
        cityOpportunitiesComingSoon:
          "Подробности об инвестиционных возможностях этого города скоро появятся.",
        viewRegionOpportunities: "Посмотреть возможности региона",
        featuredOpportunities: "Приоритетные инвестиционные возможности",
        allRegions: "Все регионы",
        searchRegions: "Поиск регионов по названию или отрасли...",
        noRegionsFound: "Регионы по вашему запросу не найдены.",
        relatedRegions: "Похожие регионы",
        whosWho: "Кто есть кто",
        notableEntrepreneurs: "Известные предприниматели и бизнес-лидеры",
        netWorth: "Состояние",
        viewProfile: "Профиль",
        clickToExplore: "Нажмите для изучения",
      },
      common: {
        learnMore: "Узнать больше",
        viewAll: "Смотреть все",
        loading: "Загрузка...",
        error: "Ошибка",
        back: "Назад",
        allRightsReserved: "Все права защищены",
        loadingMap: "Загрузка интерактивной карты...",
        viewOfficialSource: "Официальный источник",
        noNewsAvailable: "Новости пока недоступны.",
        backTo: "Назад к",
      },
      widgets: {
        currencyConverter: "Конвертер валют",
        amount: "Сумма",
        from: "Из",
        to: "В",
        result: "Результат",
        lastUpdated: "Обновлено",
        newsletter: "Рассылка",
        newsletterDesc: "Получайте новости об инвестициях",
        emailPlaceholder: "Введите email",
        subscribe: "Подписаться",
        subscribed: "Вы подписаны!",
        subscribeError: "Ошибка подписки",
        share: "Поделиться",
        copyLink: "Копировать ссылку",
        search: "Поиск",
        searchPlaceholder: "Поиск регионов, городов, возможностей...",
        noResults: "Ничего не найдено",
        searchHint: "Начните вводить для поиска",
      },
      contact: {
        title: "Связаться с нами",
        subtitle:
          "Готовы обсудить инвестиционные возможности? Свяжитесь с нашей командой.",
        name: "Имя",
        namePlaceholder: "Ваше имя",
        email: "Эл. почта",
        emailPlaceholder: "ваш@email.ru",
        company: "Компания",
        companyPlaceholder: "Название компании",
        subject: "Тема",
        subjectPlaceholder: "Тема обращения",
        message: "Сообщение",
        messagePlaceholder: "Расскажите о вашем инвестиционном интересе...",
        investmentRange: "Объём инвестиций",
        selectRange: "Выберите диапазон",
        submit: "Отправить",
        successTitle: "Сообщение отправлено!",
        successMessage: "Мы свяжемся с вами в ближайшее время.",
        sendAnother: "Отправить ещё",
        errorMessage: "Ошибка отправки. Попробуйте позже.",
        investmentRanges: {
          under1m: "Менее $1 млн",
          "1to10m": "$1 - $10 млн",
          "10to50m": "$10 - $50 млн",
          "50to100m": "$50 - $100 млн",
          over100m: "Более $100 млн",
        },
      },
      calendarRelative: {
        happeningNow: "Сейчас",
        endedToday: "Закончилось сегодня",
        endedYesterday: "Закончилось вчера",
        daysAgo: "{days} дн. назад",
        monthsAgo: "{months} мес. назад",
        startsToday: "Сегодня",
        startsTomorrow: "Завтра",
        inDays: "Через {days} дн.",
        inAboutMonth: "Примерно через месяц",
        inMonths: "Через {months} мес.",
      },
      lawsGuide: {
        comprehensiveGuide:
          "Полное руководство по двусторонним соглашениям, визовым требованиям и бизнес-регулированию",
        stepByStepGuide: "Пошаговое руководство по ведению бизнеса в {country}",
        step: "Шаг {number}",
        guideContent: "Содержание руководства...",
        items: "{count} элементов",
      },
      sectors: {
        "AI & Technology": "ИИ и технологии",
        "Logistics & Aviation": "Логистика и авиация",
        "Biotech & Pharmaceuticals": "Биотехнологии и фармацевтика",
        "Smart City & IoT": "Умный город и IoT",
        "Autonomous Vehicles": "Автономный транспорт",
        "Electric Vehicles": "Электромобили",
        "Culture & Entertainment": "Культура и развлечения",
        "Clean Energy & Environment": "Чистая энергетика и экология",
        "Aerospace & Satellite": "Аэрокосмическая отрасль",
        "Tourism & Entertainment": "Туризм и развлечения",
        "Infrastructure": "Инфраструктура",
        "International Trade": "Международная торговля",
        "Export Trade": "Экспортная торговля",
        "Technology": "Технологии",
        "Finance": "Финансы",
        "Manufacturing": "Производство",
        "Automotive": "Автомобилестроение",
        "Electronics": "Электроника",
        "Semiconductors": "Полупроводники",
        "Real Estate": "Недвижимость",
        "Tourism": "Туризм",
        "Retail": "Розничная торговля",
        "Healthcare": "Здравоохранение",
        "Energy": "Энергетика",
        "Mining": "Горнодобыча",
        "Agriculture": "Сельское хозяйство",
        "Logistics": "Логистика",
        "Fintech": "Финтех",
        "VR/AR": "Виртуальная/дополненная реальность",
        "Materials": "Материалы",
        "Petrochemicals": "Нефтехимия",
        "Aviation": "Авиация",
        "Shipbuilding": "Судостроение",
        "Food": "Пищевая промышленность",
        "Textiles": "Текстиль",
        "Chemicals": "Химическая промышленность",
        "Steel": "Сталелитейная промышленность",
        "Trade": "Торговля",
        "Sports": "Спорт",
        "Education": "Образование",
        "Tech": "Технологии",
        "Cloud": "Облачные технологии",
        "Port": "Портовая деятельность",
        "Hydrogen": "Водородная энергетика",
        "VR": "Виртуальная реальность",
        "E-commerce": "Электронная коммерция",
        "AI": "ИИ",
        "Biotech": "Биотехнологии",
        "Battery": "Батареи",
        "Software": "Программное обеспечение",
        "Gaming": "Игры",
        "Rail Transport": "Железнодорожный транспорт",
        "Rail": "Железные дороги",
        "Transport": "Транспорт",
        "Machinery": "Машиностроение",
        "Entertainment": "Развлечения",
        "Cold Chain": "Холодовая цепь",
        "AgTech": "Агротехнологии",
        "Optoelectronics": "Оптоэлектроника",
        "EV": "Электромобили",
        "Oil & Gas": "Нефть и газ",
        "IT": "ИТ",
        "Fishing": "Рыболовство",
        "LNG": "СПГ",
        "Space": "Космос",
        "Diamonds": "Алмазы",
        "Timber": "Древесина",
        "Gold": "Золото",
      },
      industries: {
        "Artificial Intelligence": "Искусственный интеллект",
        "Fintech": "Финтех",
        "Biotech & Pharmaceuticals": "Биотехнологии и фармацевтика",
        "New Energy Vehicles": "Электротранспорт",
        "Digital Economy": "Цифровая экономика",
        "Technology": "Технологии",
        "Finance": "Финансы",
        "Government Services": "Государственные услуги",
        "Healthcare": "Здравоохранение",
        "International Trade": "Международная торговля",
        "Manufacturing": "Производство",
        "Electronics": "Электроника",
        "Export Trade": "Экспортная торговля",
        "Textiles": "Текстиль",
        "Chemicals": "Химическая промышленность",
        "Petrochemicals": "Нефтехимия",
        "Agriculture": "Сельское хозяйство",
        "Heavy Industry": "Тяжёлая промышленность",
        "E-commerce": "Электронная коммерция",
        "Food Processing": "Пищевая промышленность",
        "Logistics": "Логистика",
        "Aerospace": "Аэрокосмическая отрасль",
        "Automotive": "Автомобилестроение",
        "Steel": "Сталь",
        "Optoelectronics": "Оптоэлектроника",
        "Construction Equipment": "Строительная техника",
        "Machinery": "Машиностроение",
        "New Materials": "Новые материалы",
        "Aviation": "Авиация",
        "Rare Earths": "Редкоземельные элементы",
        "Pharmaceuticals": "Фармацевтика",
        "Tourism": "Туризм",
        "Mining": "Горнодобыча",
        "Hydropower": "Гидроэнергетика",
        "Sugar Processing": "Сахарная промышленность",
        "Nonferrous Metals": "Цветные металлы",
        "ASEAN Trade": "Торговля с АСЕАН",
        "Coal Mining": "Угольная добыча",
        "New Energy": "Новая энергетика",
        "Energy": "Энергетика",
        "Dairy & Agriculture": "Молочная и сельскохозяйственная отрасль",
        "Border Trade": "Приграничная торговля",
        "Big Data": "Большие данные",
        "Liquor": "Алкогольная промышленность",
        "Oil & Gas": "Нефть и газ",
        "Cotton": "Хлопок",
        "Shipping": "Судоходство",
        "Forestry": "Лесная промышленность",
        "Free Trade Port": "Свободный порт",
        "Marine Industry": "Морская промышленность",
        "Tropical Agriculture": "Тропическое сельское хозяйство",
        "Coal Chemicals": "Углехимия",
        "Wine": "Виноделие",
        "Halal Food": "Халяльная еда",
        "Salt Lake Resources": "Ресурсы солёных озёр",
        "Traditional Crafts": "Традиционные ремёсла",
        "Professional Services": "Профессиональные услуги",
        "Gaming": "Игорный бизнес",
        "Services": "Услуги",
        "Trade": "Торговля",
        "IT": "ИТ",
        "Shipbuilding": "Судостроение",
        "Fishing": "Рыболовство",
        "Export": "Экспорт",
        "Government": "Государственное управление",
        "Defense": "Оборонная промышленность",
        "Construction Machinery": "Строительная техника",
        "Culture Media": "СМИ и культура",
        "Maritime Trade": "Морская торговля",
        "Home Appliances": "Бытовая техника",
        "AI": "ИИ",
        "Equipment Manufacturing": "Производство оборудования",
        "Media": "Медиа",
        "LNG": "СПГ",
        "Reindeer Herding": "Оленеводство",
        "Construction": "Строительство",
        "Gold Mining": "Золотодобыча",
        "Gold": "Золото",
        "Coal": "Уголь",
        "Nuclear": "Атомная промышленность",
        "Space": "Космическая отрасль",
        "Rail": "Железнодорожная отрасль",
        "Biotechnology": "Биотехнологии",
        "Arms Manufacturing": "Производство вооружений",
        "Electrical Equipment": "Электрооборудование",
        "Cables": "Кабельная продукция",
        "Lighting": "Светотехника",
        "Amber": "Янтарь",
        "Paper": "Целлюлозно-бумажная",
        "Glass": "Стекольная промышленность",
        "Printing": "Полиграфия",
        "Tires": "Шинное производство",
        "Rail Equipment": "Железнодорожное оборудование",
        "Dairy": "Молочная отрасль",
        "Diamonds": "Алмазы",
        "Jewelry": "Ювелирное дело",
        "Aluminum": "Алюминий",
        "Geothermal": "Геотермальная энергия",
        "Oil Refining": "Нефтепереработка",
        "Science": "Наука",
        "Education": "Образование",
        "Pharma": "Фармацевтика",
        "Biomedicine": "Биомедицина",
        "Cross-border Trade": "Трансграничная торговля",
        "Fashion & Textiles": "Мода и текстиль",
        "Smart Manufacturing": "Умное производство",
        "Cold Chain": "Холодовая цепь",
        "Electronics Assembly": "Сборка электроники",
        "Gaming & Entertainment": "Игры и развлечения",
        "Steel & Materials": "Сталь и материалы",
        "Rail Transport": "Железнодорожный транспорт",
        "Media & Entertainment": "Медиа и развлечения",
        "Biomass": "Биомасса",
        "IT Services": "ИТ-услуги",
        "Real Estate": "Недвижимость",
        "Consumer Goods": "Потребительские товары",
        "Venture Capital": "Венчурный капитал",
        "Software": "Программное обеспечение",
        "Government & Business": "Государственное управление и бизнес",
        "Natural Gas": "Природный газ",
      },
      units: {
        billion: "млрд",
        trillion: "трлн",
        million: "млн",
      },
      entrepreneurIndustries: {
        "E-commerce & Fintech": "Электронная коммерция и финтех",
        "Beverages & Pharma": "Напитки и фармацевтика",
        "Gaming & Music": "Игры и музыка",
        "Real Estate": "Недвижимость",
        "Internet & Gaming": "Интернет и игры",
        "EV & Technology": "Электромобили и технологии",
        "Social Media": "Социальные сети",
        "E-commerce & Cloud": "Электронная коммерция и облачные услуги",
        "Automotive": "Автомобилестроение",
        "Technology": "Технологии",
        "E-commerce": "Электронная коммерция",
        "Finance": "Финансы",
        "Retail": "Розничная торговля",
        "Manufacturing": "Производство",
        "Entertainment": "Развлечения",
        "Mining": "Горнодобыча",
        "Steel": "Сталь",
        "Oil & Gas": "Нефть и газ",
        "Chemicals": "Химическая промышленность",
        "Food & Beverage": "Продукты питания и напитки",
        "Agriculture": "Сельское хозяйство",
        "Electronics": "Электроника",
        "Mining & Metals": "Горнодобыча и металлургия",
        "Natural Gas": "Природный газ",
        "Venture Capital": "Венчурный капитал",
        "Software": "Программное обеспечение",
        "Government & Business": "Государственное управление и бизнес",
        "Petrochemicals": "Нефтехимия",
        "Energy": "Энергетика",
      },
    },
    zh: {
      meta: {
        title: `${branding.name} - 投资与贸易`,
        description: `${countryANameZh}${countryBNameZh}商业指南`,
      },
      nav: {
        home: "首页",
        laws: "法规",
        calendar: "日历",
        organizations: "组织机构",
        news: "新闻",
        invest: "投资指南",
        contact: "联系我们",
      },
      home: {
        hero: {
          title: `${countryANameZh}${countryBNameZh}商业桥梁`,
          subtitle: "发现投资与贸易机会",
        },
        cta: "开始探索",
      },
      laws: {
        title: "法规政策",
        agreements: "贸易协议",
        visas: "签证与许可",
        entities: "企业类型",
        guide: "投资者指南",
      },
      calendar: { title: "活动日历", upcoming: "即将举行", past: "已结束" },
      organizations: {
        title: "组织机构",
        national: "国家级",
        regional: "省级",
        municipal: "市级",
      },
      news: {
        title: "新闻资讯",
        latest: "最新消息",
        business: "商业",
        trade: "贸易",
      },
      invest: {
        title: "投资指南",
        selectRegion: "选择地区",
        gdp: "GDP",
        population: "人口",
        industries: "主要产业",
        sez: "经济特区",
        taxBenefits: "税收优惠",
        back: "返回",
        mapTitle: "互动投资地图",
        mapSelectRegion: "选择一个地区进行探索",
        mapRegions: "地区",
        mapInstructions: "悬停查看地区 • 点击了解详情",
        mapClickToExplore: "点击探索投资机会",
        countryA: countryANameZh,
        countryB: countryBNameZh,
        opportunities: "投资机会",
        keyProjects: "重点项目",
        advantages: "竞争优势",
        contact: "投资联系方式",
        majorCities: "主要城市",
        agency: "机构",
        website: "网站",
        email: "电子邮箱",
        phone: "电话",
        visitWebsite: "访问网站",
        partners: "合作伙伴",
        target: "目标",
        ongoing: "进行中",
        priority: "优先",
        active: "进行中",
        upcoming: "即将推出",
        zones: "个",
        years: "年",
        cityOpportunitiesComingSoon: "该城市的投资机会详情即将上线。",
        viewRegionOpportunities: "查看地区投资机会",
        featuredOpportunities: "重点投资机会",
        allRegions: "所有地区",
        searchRegions: "按名称或行业搜索地区...",
        noRegionsFound: "未找到符合搜索条件的地区。",
        relatedRegions: "相关地区",
        whosWho: "名人堂",
        notableEntrepreneurs: "知名企业家和商业领袖",
        netWorth: "净资产",
        viewProfile: "查看简介",
        clickToExplore: "点击探索",
      },
      common: {
        learnMore: "了解更多",
        viewAll: "查看全部",
        loading: "加载中...",
        error: "错误",
        back: "返回",
        allRightsReserved: "版权所有",
        loadingMap: "正在加载互动地图...",
        viewOfficialSource: "查看官方来源",
        noNewsAvailable: "暂无新闻。",
        backTo: "返回",
      },
      widgets: {
        currencyConverter: "货币转换器",
        amount: "金额",
        from: "从",
        to: "到",
        result: "结果",
        lastUpdated: "更新时间",
        newsletter: "邮件订阅",
        newsletterDesc: "获取最新投资资讯",
        emailPlaceholder: "输入邮箱",
        subscribe: "订阅",
        subscribed: "订阅成功！",
        subscribeError: "订阅失败",
        share: "分享",
        copyLink: "复制链接",
        search: "搜索",
        searchPlaceholder: "搜索地区、城市、投资机会...",
        noResults: "未找到结果",
        searchHint: "输入关键词开始搜索",
      },
      contact: {
        title: "联系我们",
        subtitle: "准备好探讨投资机会了吗？请与我们的团队联系。",
        name: "姓名",
        namePlaceholder: "您的姓名",
        email: "邮箱",
        emailPlaceholder: "您的邮箱@example.cn",
        company: "公司",
        companyPlaceholder: "公司名称",
        subject: "主题",
        subjectPlaceholder: "咨询主题",
        message: "留言",
        messagePlaceholder: "请描述您的投资意向...",
        investmentRange: "投资规模",
        selectRange: "选择范围",
        submit: "提交",
        successTitle: "提交成功！",
        successMessage: "我们会尽快与您联系。",
        sendAnother: "再次提交",
        errorMessage: "提交失败，请稍后重试。",
        investmentRanges: {
          under1m: "少于100万美元",
          "1to10m": "100万 - 1000万美元",
          "10to50m": "1000万 - 5000万美元",
          "50to100m": "5000万 - 1亿美元",
          over100m: "超过1亿美元",
        },
      },
      calendarRelative: {
        happeningNow: "正在进行",
        endedToday: "今日结束",
        endedYesterday: "昨日结束",
        daysAgo: "{days}天前",
        monthsAgo: "{months}个月前",
        startsToday: "今天开始",
        startsTomorrow: "明天开始",
        inDays: "{days}天后",
        inAboutMonth: "约1个月后",
        inMonths: "{months}个月后",
      },
      lawsGuide: {
        comprehensiveGuide: "双边协议、签证要求和商业法规综合指南",
        stepByStepGuide: "在{country}开展业务的分步指南",
        step: "第{number}步",
        guideContent: "指南内容...",
        items: "{count}项",
      },
      sectors: {
        "AI & Technology": "人工智能与科技",
        "Logistics & Aviation": "物流与航空",
        "Biotech & Pharmaceuticals": "生物技术与医药",
        "Smart City & IoT": "智慧城市与物联网",
        "Autonomous Vehicles": "自动驾驶汽车",
        "Electric Vehicles": "电动汽车",
        "Culture & Entertainment": "文化与娱乐",
        "Clean Energy & Environment": "清洁能源与环保",
        "Aerospace & Satellite": "航空航天与卫星",
        "Tourism & Entertainment": "旅游与娱乐",
        "Infrastructure": "基础设施",
        "International Trade": "国际贸易",
        "Export Trade": "出口贸易",
        "Technology": "科技",
        "Finance": "金融",
        "Manufacturing": "制造业",
        "Automotive": "汽车",
        "Electronics": "电子",
        "Semiconductors": "半导体",
        "Real Estate": "房地产",
        "Tourism": "旅游",
        "Retail": "零售",
        "Healthcare": "医疗健康",
        "Energy": "能源",
        "Mining": "采矿",
        "Agriculture": "农业",
        "Logistics": "物流",
        "Fintech": "金融科技",
        "VR/AR": "虚拟现实/增强现实",
        "Materials": "材料",
        "Petrochemicals": "石化",
        "Aviation": "航空",
        "Shipbuilding": "造船",
        "Food": "食品",
        "Textiles": "纺织",
        "Chemicals": "化工",
        "Steel": "钢铁",
        "Trade": "贸易",
        "Sports": "体育",
        "Education": "教育",
        "Tech": "科技",
        "Cloud": "云计算",
        "Port": "港口",
        "Hydrogen": "氢能",
        "VR": "虚拟现实",
        "E-commerce": "电子商务",
        "AI": "人工智能",
        "Biotech": "生物技术",
        "Battery": "电池",
        "Software": "软件",
        "Gaming": "游戏",
        "Rail Transport": "铁路运输",
        "Rail": "铁路",
        "Transport": "运输",
        "Machinery": "机械",
        "Entertainment": "娱乐",
        "Cold Chain": "冷链",
        "AgTech": "农业科技",
        "Optoelectronics": "光电子",
        "EV": "电动汽车",
        "Oil & Gas": "油气",
        "IT": "信息技术",
        "Fishing": "渔业",
        "LNG": "液化天然气",
        "Space": "航天",
        "Diamonds": "钻石",
        "Timber": "木材",
        "Gold": "黄金",
      },
      industries: {
        "Artificial Intelligence": "人工智能",
        "Fintech": "金融科技",
        "Biotech & Pharmaceuticals": "生物技术与医药",
        "New Energy Vehicles": "新能源汽车",
        "Digital Economy": "数字经济",
        "Technology": "科技",
        "Finance": "金融",
        "Government Services": "政府服务",
        "Healthcare": "医疗",
        "International Trade": "国际贸易",
        "Manufacturing": "制造业",
        "Electronics": "电子",
        "Export Trade": "出口贸易",
        "Textiles": "纺织",
        "Chemicals": "化工",
        "Petrochemicals": "石化",
        "Agriculture": "农业",
        "Heavy Industry": "重工业",
        "E-commerce": "电子商务",
        "Food Processing": "食品加工",
        "Logistics": "物流",
        "Aerospace": "航空航天",
        "Automotive": "汽车",
        "Steel": "钢铁",
        "Optoelectronics": "光电子",
        "Construction Equipment": "工程机械",
        "Machinery": "机械",
        "New Materials": "新材料",
        "Aviation": "航空",
        "Rare Earths": "稀土",
        "Pharmaceuticals": "医药",
        "Tourism": "旅游",
        "Mining": "采矿",
        "Hydropower": "水电",
        "Sugar Processing": "制糖",
        "Nonferrous Metals": "有色金属",
        "ASEAN Trade": "东盟贸易",
        "Coal Mining": "煤炭开采",
        "New Energy": "新能源",
        "Energy": "能源",
        "Dairy & Agriculture": "乳业与农业",
        "Border Trade": "边境贸易",
        "Big Data": "大数据",
        "Liquor": "白酒",
        "Oil & Gas": "油气",
        "Cotton": "棉花",
        "Shipping": "航运",
        "Forestry": "林业",
        "Free Trade Port": "自由贸易港",
        "Marine Industry": "海洋产业",
        "Tropical Agriculture": "热带农业",
        "Coal Chemicals": "煤化工",
        "Wine": "葡萄酒",
        "Halal Food": "清真食品",
        "Salt Lake Resources": "盐湖资源",
        "Traditional Crafts": "传统工艺",
        "Professional Services": "专业服务",
        "Gaming": "博彩",
        "Services": "服务业",
        "Trade": "贸易",
        "IT": "信息技术",
        "Shipbuilding": "造船",
        "Fishing": "渔业",
        "Export": "出口",
        "Government": "政府",
        "Defense": "国防工业",
        "Construction Machinery": "工程机械",
        "Culture Media": "文化传媒",
        "Maritime Trade": "海上贸易",
        "Home Appliances": "家电",
        "AI": "人工智能",
        "Equipment Manufacturing": "设备制造",
        "Media": "媒体",
        "LNG": "液化天然气",
        "Reindeer Herding": "驯鹿养殖",
        "Construction": "建筑",
        "Gold Mining": "金矿开采",
        "Gold": "黄金",
        "Coal": "煤炭",
        "Nuclear": "核工业",
        "Space": "航天",
        "Rail": "铁路",
        "Biotechnology": "生物技术",
        "Arms Manufacturing": "武器制造",
        "Electrical Equipment": "电气设备",
        "Cables": "电缆",
        "Lighting": "照明",
        "Amber": "琥珀",
        "Paper": "造纸",
        "Glass": "玻璃",
        "Printing": "印刷",
        "Tires": "轮胎",
        "Rail Equipment": "铁路设备",
        "Dairy": "乳业",
        "Diamonds": "钻石",
        "Jewelry": "珠宝",
        "Aluminum": "铝",
        "Geothermal": "地热",
        "Oil Refining": "石油精炼",
        "Science": "科学",
        "Education": "教育",
        "Pharma": "制药",
        "Biomedicine": "生物医药",
        "Cross-border Trade": "跨境贸易",
        "Fashion & Textiles": "时尚与纺织",
        "Smart Manufacturing": "智能制造",
        "Cold Chain": "冷链",
        "Electronics Assembly": "电子组装",
        "Gaming & Entertainment": "游戏与娱乐",
        "Steel & Materials": "钢铁与材料",
        "Rail Transport": "铁路运输",
        "Media & Entertainment": "传媒与娱乐",
        "Biomass": "生物质能",
        "Food": "食品",
        "IT Services": "信息技术服务",
        "Real Estate": "房地产",
        "Consumer Goods": "消费品",
        "Venture Capital": "风险投资",
        "Software": "软件",
        "Government & Business": "政府与商业",
        "Natural Gas": "天然气",
      },
      units: {
        billion: "亿",
        trillion: "万亿",
        million: "万",
      },
      entrepreneurIndustries: {
        "E-commerce & Fintech": "电子商务与金融科技",
        "Beverages & Pharma": "饮料与医药",
        "Gaming & Music": "游戏与音乐",
        "Real Estate": "房地产",
        "Internet & Gaming": "互联网与游戏",
        "EV & Technology": "电动汽车与科技",
        "Social Media": "社交媒体",
        "E-commerce & Cloud": "电子商务与云服务",
        "Automotive": "汽车",
        "Technology": "科技",
        "E-commerce": "电子商务",
        "Finance": "金融",
        "Retail": "零售",
        "Manufacturing": "制造业",
        "Entertainment": "娱乐",
        "Mining": "采矿",
        "Steel": "钢铁",
        "Oil & Gas": "油气",
        "Chemicals": "化工",
        "Food & Beverage": "食品饮料",
        "Agriculture": "农业",
        "Electronics": "电子",
        "Mining & Metals": "采矿与金属",
        "Natural Gas": "天然气",
        "Venture Capital": "风险投资",
        "Software": "软件",
        "Government & Business": "政府与商业",
        "Petrochemicals": "石化",
        "Energy": "能源",
      },
    },
    en: {
      meta: {
        title: `${branding.name} - Investment & Trade`,
        description: `Your guide to ${countryANameEn}-${countryBNameEn} business`,
      },
      nav: {
        home: "Home",
        laws: "Laws",
        calendar: "Calendar",
        organizations: "Organizations",
        news: "News",
        invest: "Where to Invest",
        contact: "Contact",
      },
      home: {
        hero: {
          title: `Bridge Between ${countryANameEn} and ${countryBNameEn}`,
          subtitle: "Discover investment and trade opportunities",
        },
        cta: "Start Exploring",
      },
      laws: {
        title: "Laws & Regulations",
        agreements: "Trade Agreements",
        visas: "Visas & Permits",
        entities: "Legal Entities",
        guide: "Investor Guide",
      },
      calendar: {
        title: "Event Calendar",
        upcoming: "Upcoming Events",
        past: "Past Events",
      },
      organizations: {
        title: "Organizations",
        national: "National",
        regional: "Regional",
        municipal: "Municipal",
      },
      news: {
        title: "News",
        latest: "Latest News",
        business: "Business",
        trade: "Trade",
      },
      invest: {
        title: "Where to Invest",
        selectRegion: "Select a Region",
        gdp: "GDP",
        population: "Population",
        industries: "Industries",
        sez: "Special Economic Zones",
        taxBenefits: "Tax Benefits",
        back: "Back",
        mapTitle: "Interactive Investment Map",
        mapSelectRegion: "Select a region to explore",
        mapRegions: "Regions",
        mapInstructions: "Hover over a region • Click to explore",
        mapClickToExplore: "Click to explore investment opportunities",
        countryA: countryANameEn,
        countryB: countryBNameEn,
        opportunities: "Investment Opportunities",
        keyProjects: "Key Projects",
        advantages: "Competitive Advantages",
        contact: "Investment Contact",
        majorCities: "Major Cities",
        agency: "Agency",
        website: "Website",
        email: "Email",
        phone: "Phone",
        visitWebsite: "Visit Website",
        partners: "Partners",
        target: "Target",
        ongoing: "Ongoing",
        priority: "Priority",
        active: "Active",
        upcoming: "Upcoming",
        zones: "zones",
        years: "years",
        cityOpportunitiesComingSoon:
          "Investment opportunity details for this city are coming soon.",
        viewRegionOpportunities: "View region opportunities",
        featuredOpportunities: "Featured Priority Opportunities",
        allRegions: "All Regions",
        searchRegions: "Search regions by name or industry...",
        noRegionsFound: "No regions found matching your search.",
        relatedRegions: "Similar Regions",
        whosWho: "Who's Who",
        notableEntrepreneurs: "Notable Entrepreneurs & Business Leaders",
        netWorth: "Net Worth",
        viewProfile: "View Profile",
        clickToExplore: "Click to explore",
      },
      common: {
        learnMore: "Learn More",
        viewAll: "View All",
        loading: "Loading...",
        error: "Error",
        back: "Back",
        allRightsReserved: "All rights reserved",
        loadingMap: "Loading interactive map...",
        viewOfficialSource: "View Official Source",
        noNewsAvailable: "No news available at the moment.",
        backTo: "Back to",
      },
      widgets: {
        currencyConverter: "Currency Converter",
        amount: "Amount",
        from: "From",
        to: "To",
        result: "Result",
        lastUpdated: "Last updated",
        newsletter: "Newsletter",
        newsletterDesc: "Get investment updates in your inbox",
        emailPlaceholder: "Enter your email",
        subscribe: "Subscribe",
        subscribed: "Successfully subscribed!",
        subscribeError: "Subscription failed",
        share: "Share",
        copyLink: "Copy link",
        search: "Search",
        searchPlaceholder: "Search regions, cities, opportunities...",
        noResults: "No results found",
        searchHint: "Start typing to search",
      },
      contact: {
        title: "Contact Us",
        subtitle:
          "Ready to discuss investment opportunities? Get in touch with our team.",
        name: "Name",
        namePlaceholder: "Your name",
        email: "Email",
        emailPlaceholder: "your@email.com",
        company: "Company",
        companyPlaceholder: "Company name",
        subject: "Subject",
        subjectPlaceholder: "Subject of inquiry",
        message: "Message",
        messagePlaceholder: "Tell us about your investment interest...",
        investmentRange: "Investment Range",
        selectRange: "Select range",
        submit: "Send Message",
        successTitle: "Message Sent!",
        successMessage: "We will get back to you shortly.",
        sendAnother: "Send Another",
        errorMessage: "Failed to send. Please try again later.",
        investmentRanges: {
          under1m: "< $1 Million",
          "1to10m": "$1 - $10 Million",
          "10to50m": "$10 - $50 Million",
          "50to100m": "$50 - $100 Million",
          over100m: "> $100 Million",
        },
      },
      calendarRelative: {
        happeningNow: "Happening now",
        endedToday: "Ended today",
        endedYesterday: "Ended yesterday",
        daysAgo: "{days} days ago",
        monthsAgo: "{months} months ago",
        startsToday: "Starts today",
        startsTomorrow: "Starts tomorrow",
        inDays: "In {days} days",
        inAboutMonth: "In about a month",
        inMonths: "In {months} months",
      },
      lawsGuide: {
        comprehensiveGuide:
          "Comprehensive guide to bilateral agreements, visa requirements, and business regulations",
        stepByStepGuide: "Step-by-step guide to doing business in {country}",
        step: "Step {number}",
        guideContent: "Guide content...",
        items: "{count} items",
      },
    },
  };
  return JSON.stringify(messages[locale] || messages.en, null, 2);
}

function generateRootLayout(
  _branding: PortalScaffoldConfig["branding"],
  _countryPair: PortalScaffoldConfig["countryPair"]
): string {
  return `import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter } from 'next/font/google';
import '../globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale} className="scroll-smooth">
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
`;
}

function generateHomePage(
  branding: PortalScaffoldConfig["branding"],
  features: PortalScaffoldConfig["features"]
): string {
  return `"use client";

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowRight, Scale, Calendar, Building2, Newspaper, MapPin } from 'lucide-react';

${
  features.enable3DGlobe
    ? `const GlobeWrapper = dynamic(() => import('@/components/globe/GlobeWrapper').then(m => m.GlobeWrapper), {
  ssr: false,
  loading: () => <div className="w-full h-[600px] flex items-center justify-center"><div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" /></div>,
});`
    : ""
}

const features = [
  { key: 'laws', icon: Scale, href: '/laws', color: 'from-blue-500 to-blue-600' },
  { key: 'calendar', icon: Calendar, href: '/calendar', color: 'from-green-500 to-green-600' },
  { key: 'organizations', icon: Building2, href: '/organizations', color: 'from-purple-500 to-purple-600' },
  { key: 'news', icon: Newspaper, href: '/news', color: 'from-orange-500 to-orange-600' },
  { key: 'invest', icon: MapPin, href: '/invest', color: 'from-red-500 to-red-600' },
];

export default function HomePage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-slate-900 z-10" />
        
        ${
          features.enable3DGlobe
            ? `{/* 3D Globe Background */}
        <div className="absolute inset-0 opacity-60">
          <GlobeWrapper />
        </div>`
            : ""
        }

        <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white"
          >
            {t('home.hero.title')}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-300 mb-10"
          >
            {t('home.hero.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Link
              href={\`/\${locale}/invest\`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary px-8 py-4 rounded-full text-white font-semibold text-lg hover:scale-105 transition-transform shadow-lg shadow-primary/25"
            >
              {t('home.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link
                  href={\`/\${locale}\${feature.href}\`}
                  className="group block p-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all hover:shadow-xl hover:shadow-primary/10"
                >
                  <div className={\`inline-flex p-3 rounded-xl bg-gradient-to-r \${feature.color} mb-4\`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-primary transition-colors">
                    {t(\`nav.\${feature.key}\`)}
                  </h3>
                  <p className="text-slate-400">
                    {t(\`\${feature.key}.title\`)}
                  </p>
                  <div className="mt-4 flex items-center text-primary text-sm font-medium">
                    {t('common.learnMore')}
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
`;
}

function generateHeader(
  branding: PortalScaffoldConfig["branding"],
  _countryPair: PortalScaffoldConfig["countryPair"]
): string {
  return `"use client";

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { LocaleSwitcher } from './LocaleSwitcher';
import { SearchDialog } from '@/components/widgets/SearchDialog';

const navItems = ['laws', 'calendar', 'organizations', 'news', 'invest', 'contact'];

export function Header() {
  const t = useTranslations('nav');
  const params = useParams();
  const pathname = usePathname();
  const locale = params.locale as string;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href={\`/\${locale}\`} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-sm">🌐</span>
            </div>
            <span className="text-xl font-bold text-white">${branding.name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.includes(\`/\${item}\`);
              return (
                <Link
                  key={item}
                  href={\`/\${locale}/\${item}\`}
                  className={\`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }\`}
                >
                  {t(item)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <SearchDialog />
            <LocaleSwitcher />
            
            <button
              className="md:hidden p-2 text-slate-300 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden py-4 border-t border-slate-800"
          >
            {navItems.map((item) => (
              <Link
                key={item}
                href={\`/\${locale}/\${item}\`}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                {t(item)}
              </Link>
            ))}
          </motion.nav>
        )}
      </div>
    </header>
  );
}
`;
}

function generateFooter(
  branding: PortalScaffoldConfig["branding"],
  countryPair: PortalScaffoldConfig["countryPair"]
): string {
  const flagA = COUNTRY_INFO[countryPair.countryA]?.flag || "🌍";
  const flagB = COUNTRY_INFO[countryPair.countryB]?.flag || "🌍";
  return `"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NewsletterSignup } from '@/components/widgets/NewsletterSignup';
import { BackToTop } from '@/components/widgets/BackToTop';

export function Footer() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  const socialLinks = [
    { name: 'Telegram', href: 'https://t.me/silkroadportal', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    )},
    { name: 'WeChat', href: '#', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 0 1 .176-.554c1.522-1.12 2.484-2.773 2.484-4.628 0-3.222-3.004-5.879-6.829-6.049-.065-.002-.13-.003-.194-.003-.065-.003-.13-.007-.196-.007l.177-.056zm-2.853 2.928c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.84 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
      </svg>
    )},
    { name: 'LinkedIn', href: 'https://linkedin.com/company/silkroadportal', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    )},
  ];

  const quickLinks = [
    { key: 'laws', href: \`/\${locale}/laws\` },
    { key: 'invest', href: \`/\${locale}/invest\` },
    { key: 'news', href: \`/\${locale}/news\` },
    { key: 'contact', href: \`/\${locale}/contact\` },
  ];

  return (
    <>
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">🌐</span>
                </div>
                <span className="text-xl font-bold text-white">${branding.name}</span>
              </div>
              <p className="text-slate-400 text-sm mb-4 max-w-md">
                {t('meta.description')}
              </p>
              <div className="flex items-center gap-3">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title={link.name}
                  >
                    {link.icon}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">{t('common.learnMore')}</h3>
              <ul className="space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      className="text-slate-400 hover:text-white text-sm transition-colors"
                    >
                      {t(\`nav.\${link.key}\`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <NewsletterSignup />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-slate-400 text-sm">
                © {new Date().getFullYear()} ${branding.name}. {t('common.allRightsReserved')}
              </div>
              <div className="flex items-center gap-4 text-slate-500 text-sm">
                <span>${flagA} 🤝 ${flagB}</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <BackToTop />
    </>
  );
}
`;
}

function generateLocaleSwitcher(locales: Locale[]): string {
  const localeDisplayNames: Record<Locale, string> = {
    en: "🇬🇧 ENG",
    zh: "🇨🇳 中文",
    ru: "🇷🇺 РУС",
    ja: "🇯🇵 日本語",
    vi: "🇻🇳 Tiếng Việt",
    hi: "🇮🇳 हिंदी",
    ar: "🇸🇦 العربية",
    ko: "🇰🇷 한국어",
    th: "🇹🇭 ไทย",
    id: "🇮🇩 Indonesia",
    ms: "🇲🇾 Melayu",
    tr: "🇹🇷 Türkçe",
    pt: "🇧🇷 Português",
    es: "🇲🇽 Español",
    fr: "🇫🇷 Français",
    de: "🇩🇪 Deutsch",
  };

  const localeNamesObj = locales.reduce(
    (acc, locale) => {
      acc[locale] = localeDisplayNames[locale] || locale.toUpperCase();
      return acc;
    },
    {} as Record<string, string>
  );

  return `"use client";

import { useParams, usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';

const localeNames: Record<string, string> = ${JSON.stringify(localeNamesObj, null, 2)};

export function LocaleSwitcher() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = params.locale as string;

  const switchLocale = (newLocale: string) => {
    const newPath = pathname.replace(\`/\${currentLocale}\`, \`/\${newLocale}\`);
    router.push(newPath);
  };

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
        <Globe className="w-4 h-4" />
        <span className="text-sm">{localeNames[currentLocale as keyof typeof localeNames] || currentLocale}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-slate-800 rounded-lg border border-slate-700 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        {${JSON.stringify(locales)}.map((locale) => (
          <button
            key={locale}
            onClick={() => switchLocale(locale)}
            className={\`block w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors \${
              locale === currentLocale ? 'text-primary' : 'text-slate-300'
            }\`}
          >
            {localeNames[locale as keyof typeof localeNames]}
          </button>
        ))}
      </div>
    </div>
  );
}
`;
}

function generateGlobe3D(
  branding: PortalScaffoldConfig["branding"],
  geoSources: PortalScaffoldConfig["geoDataSources"],
  countryPair: PortalScaffoldConfig["countryPair"]
): string {
  // Build dynamic GEO_URLS from geoDataSources
  const geoUrlEntries = geoSources
    .map(src => `  ${src.country}: '${src.url}'`)
    .join(",\n");

  // Build dynamic MAP_CONFIG - use reasonable defaults per country
  const mapConfigDefaults: Record<
    string,
    { viewBox: string; labelOffset: string }
  > = {
    CN: { viewBox: "'70 33 70 55'", labelOffset: "{ x: 0, y: 0 }" },
    RU: { viewBox: "'15 5 175 50'", labelOffset: "{ x: 0, y: 0 }" },
    DE: { viewBox: "'5 42 17 15'", labelOffset: "{ x: 0, y: 0 }" },
    FR: { viewBox: "'-6 38 20 18'", labelOffset: "{ x: 0, y: 0 }" },
    IN: { viewBox: "'65 5 40 40'", labelOffset: "{ x: 0, y: 0 }" },
    AE: { viewBox: "'50 20 15 12'", labelOffset: "{ x: 0, y: 0 }" },
    JP: { viewBox: "'125 25 25 25'", labelOffset: "{ x: 0, y: 0 }" },
    VN: { viewBox: "'100 5 15 30'", labelOffset: "{ x: 0, y: 0 }" },
    BR: { viewBox: "'-75 -35 50 45'", labelOffset: "{ x: 0, y: 0 }" },
    TR: { viewBox: "'25 34 22 12'", labelOffset: "{ x: 0, y: 0 }" },
    SA: { viewBox: "'35 15 25 20'", labelOffset: "{ x: 0, y: 0 }" },
    EG: { viewBox: "'23 20 15 15'", labelOffset: "{ x: 0, y: 0 }" },
    KR: { viewBox: "'124 32 10 10'", labelOffset: "{ x: 0, y: 0 }" },
    GB: { viewBox: "'-12 48 20 15'", labelOffset: "{ x: 0, y: 0 }" },
    US: { viewBox: "'-130 20 70 40'", labelOffset: "{ x: 0, y: 0 }" },
    ID: { viewBox: "'95 -12 50 25'", labelOffset: "{ x: 0, y: 0 }" },
    MY: { viewBox: "'98 -2 22 15'", labelOffset: "{ x: 0, y: 0 }" },
    TH: { viewBox: "'96 4 12 18'", labelOffset: "{ x: 0, y: 0 }" },
    SG: { viewBox: "'103 0 5 5'", labelOffset: "{ x: 0, y: 0 }" },
    PH: { viewBox: "'115 4 15 20'", labelOffset: "{ x: 0, y: 0 }" },
    MX: { viewBox: "'-120 12 40 25'", labelOffset: "{ x: 0, y: 0 }" },
  };

  const mapConfigEntries = geoSources
    .map(src => {
      const cfg = mapConfigDefaults[src.country] || {
        viewBox: "'0 0 360 180'",
        labelOffset: "{ x: 0, y: 0 }",
      };
      return `  ${src.country}: { viewBox: ${cfg.viewBox}, labelOffset: ${cfg.labelOffset} }`;
    })
    .join(",\n");

  const _countryA = countryPair.countryA;
  const _countryB = countryPair.countryB;

  return `"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { getTargetCountry, COUNTRY_INFO } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

interface GlobeProps {
  onRegionClick?: (regionId: string) => void;
}

const GEO_URLS: Record<string, string> = {
${geoUrlEntries}
};

const MAP_CONFIG: Record<string, { viewBox: string; labelOffset: { x: number; y: number } }> = {
${mapConfigEntries}
};

interface GeoFeature {
  type: string;
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any[];
  };
}

function projectPoint(lon: number, lat: number): [number, number] {
  const x = lon;
  const y = -lat + 90;
  return [x, y];
}

function coordsToPath(rings: number[][][]): string {
  return rings.map((ring, i) => {
    const points = ring.map((point) => {
      const [x, y] = projectPoint(point[0], point[1]);
      return \`\${x},\${y}\`;
    });
    return (i === 0 ? 'M' : 'M') + points.join('L') + 'Z';
  }).join(' ');
}

function geometryToPath(geometry: GeoFeature['geometry']): string {
  if (geometry.type === 'Polygon') {
    return coordsToPath(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(poly => coordsToPath(poly)).join(' ');
  }
  return '';
}

function getRegionCenter(geometry: GeoFeature['geometry']): [number, number] {
  let ring: number[][] = [];
  if (geometry.type === 'Polygon') {
    ring = geometry.coordinates[0] as number[][];
  } else if (geometry.type === 'MultiPolygon') {
    ring = geometry.coordinates[0][0] as number[][];
  }
  if (!ring.length) return [0, 0];
  
  const sumX = ring.reduce((a, point) => a + point[0], 0);
  const sumY = ring.reduce((a, point) => a + point[1], 0);
  return [sumX / ring.length, sumY / ring.length];
}

export function Globe3D({ onRegionClick }: GlobeProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [clickedRegion, setClickedRegion] = useState<string | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [geoData, setGeoData] = useState<GeoFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('invest');
  const locale = params.locale as Locale;
  const targetCountry = getTargetCountry(locale);
  const config = MAP_CONFIG[targetCountry];

  const playClickSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.info('Audio not supported');
    }
  }, []);

  useEffect(() => {
    fetch(GEO_URLS[targetCountry])
      .then(res => res.json())
      .then(data => {
        setGeoData(data.features || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load map data:', err);
        setLoading(false);
      });
  }, [targetCountry]);

  const getRegionName = useCallback((feature: GeoFeature): string => {
    return feature.properties?.name_latin ||
           feature.properties?.name_en ||
           feature.properties?.NAME ||
           feature.properties?.name || 
           feature.properties?.地名 || 
           'Unknown';
  }, []);

  const handleRegionClick = useCallback((feature: GeoFeature, event: React.MouseEvent) => {
    const name = getRegionName(feature);
    
    playClickSound();
    setClickedRegion(name);
    setClickPosition({ x: event.clientX, y: event.clientY });
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedRegionGeometry', JSON.stringify(feature.geometry));
      sessionStorage.setItem('selectedRegionName', name);
    }
    
    setTimeout(() => {
      if (onRegionClick) {
        onRegionClick(name);
      } else {
        router.push(\`/\${locale}/invest/\${encodeURIComponent(name)}\`);
      }
    }, 400);
  }, [locale, onRegionClick, router, getRegionName, playClickSound]);

  const hoveredFeature = geoData.find(f => getRegionName(f) === hoveredRegion);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      {/* Gorgeous gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{
              left: \`\${Math.random() * 100}%\`,
              top: \`\${Math.random() * 100}%\`,
            }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      {/* Glowing accent */}
      <motion.div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, ${branding.primaryColor}15 0%, transparent 70%)',
          left: '50%', 
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      {/* Map container */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
        {loading ? (
          <motion.div
            className="w-16 h-16 border-4 border-t-transparent rounded-full"
            style={{ borderColor: '${branding.primaryColor}' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full max-w-4xl"
          >
            <svg
              viewBox={config.viewBox}
              className="w-full h-full"
              style={{ filter: 'drop-shadow(0 0 40px ${branding.primaryColor}30)' }}
            >
              <defs>
                {/* Gradient for regions */}
                <linearGradient id="regionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="${branding.primaryColor}" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="${branding.primaryColor}" stopOpacity="0.6" />
                </linearGradient>
                
                {/* Hover gradient */}
                <linearGradient id="hoverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="${branding.secondaryColor}" />
                  <stop offset="100%" stopColor="${branding.primaryColor}" />
                </linearGradient>
                
                {/* Glow filter */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="0.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                {/* Strong glow for hover */}
                <filter id="glowStrong" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="1" result="blur" />
                  <feFlood floodColor="${branding.secondaryColor}" floodOpacity="0.8" />
                  <feComposite in2="blur" operator="in" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Render all regions */}
              {geoData.map((feature, index) => {
                const name = getRegionName(feature);
                const isHovered = hoveredRegion === name;
                const isClicked = clickedRegion === name;
                const path = geometryToPath(feature.geometry);
                
                return (
                  <g key={index}>
                    <motion.path
                      d={path}
                      fill={isClicked ? '#FFFFFF' : isHovered ? 'url(#hoverGradient)' : 'url(#regionGradient)'}
                      stroke={isClicked ? '#FFFFFF' : isHovered ? '${branding.secondaryColor}' : 'rgba(255,255,255,0.4)'}
                      strokeWidth={isClicked ? 0.3 : isHovered ? 0.15 : 0.08}
                      filter={isClicked ? 'url(#glowStrong)' : isHovered ? 'url(#glowStrong)' : 'url(#glow)'}
                      className="cursor-pointer"
                      initial={false}
                      animate={{
                        opacity: isClicked ? 1 : isHovered ? 1 : 0.85,
                        scale: isClicked ? 1.02 : 1,
                      }}
                      transition={{ duration: 0.15 }}
                      onMouseEnter={() => setHoveredRegion(name)}
                      onMouseLeave={() => setHoveredRegion(null)}
                      onClick={(e) => handleRegionClick(feature, e as unknown as React.MouseEvent)}
                    />
                  </g>
                );
              })}
            </svg>
          </motion.div>
        )}
      </div>

      {/* Click ripple effect */}
      <AnimatePresence>
        {clickPosition && clickedRegion && (
          <motion.div
            key={clickedRegion}
            className="fixed pointer-events-none z-50"
            style={{ left: clickPosition.x, top: clickPosition.y }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div 
              className="w-20 h-20 -ml-10 -mt-10 rounded-full"
              style={{ background: 'radial-gradient(circle, ${branding.secondaryColor} 0%, transparent 70%)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full screen flash on click */}
      <AnimatePresence>
        {clickedRegion && (
          <motion.div
            className="absolute inset-0 z-40 pointer-events-none"
            style={{ background: 'radial-gradient(circle at center, ${branding.secondaryColor}40, transparent 70%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Region info tooltip */}
      <AnimatePresence>
        {hoveredRegion && hoveredFeature && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30"
          >
            <div 
              className="px-6 py-4 rounded-2xl border shadow-2xl backdrop-blur-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
                borderColor: '${branding.primaryColor}40',
                boxShadow: '0 0 40px ${branding.primaryColor}20',
              }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})',
                    boxShadow: '0 0 20px ${branding.primaryColor}50',
                  }}
                >
                  <span className="text-2xl">📍</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl">{hoveredRegion}</h3>
                  <p className="text-slate-400 text-sm">{t('mapClickToExplore')}</p>
                </div>
                <motion.div
                  className="ml-4 text-white/60"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  →
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <div className="absolute top-6 left-6 z-30">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 
            className="text-3xl font-bold text-white mb-1"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
          >
            {COUNTRY_INFO[targetCountry]?.flag || '🌍'} {COUNTRY_INFO[targetCountry]?.name || targetCountry}
          </h2>
          <p className="text-slate-400">{t('mapSelectRegion')}</p>
        </motion.div>
      </div>

      {/* Stats badge */}
      <div className="absolute top-6 right-6 z-30">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-4 py-3 rounded-xl backdrop-blur-md border"
          style={{
            background: 'rgba(15,23,42,0.8)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <p className="text-slate-400 text-xs uppercase tracking-wider">{t('mapRegions')}</p>
          <p className="text-white text-2xl font-bold">{geoData.length}</p>
        </motion.div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-6 right-6 z-30">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-slate-500 text-sm"
        >
          {t('mapInstructions')}
        </motion.div>
      </div>
    </div>
  );
}
`;
}

function generateGlobeWrapper(): string {
  return `"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const Globe3D = dynamic(() => import('./Globe3D').then(m => m.Globe3D), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-slate-400 text-sm">Loading interactive map...</p>
      </div>
    </div>
  ),
});

export function GlobeWrapper() {
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <Globe3D />
    </Suspense>
  );
}
`;
}

function generateRegionMap(
  branding: PortalScaffoldConfig["branding"],
  geoSources: PortalScaffoldConfig["geoDataSources"]
): string {
  const geoUrlEntries = geoSources
    .map(src => `  ${src.country}: '${src.url}'`)
    .join(",\n");

  const mapConfigDefaults: Record<string, { center: string; scale: number }> = {
    CN: { center: "[105, 35]", scale: 300 },
    RU: { center: "[100, 62]", scale: 150 },
    DE: { center: "[10, 51]", scale: 2000 },
    FR: { center: "[2, 46]", scale: 1500 },
    IN: { center: "[78, 22]", scale: 600 },
    AE: { center: "[54, 24]", scale: 3000 },
    JP: { center: "[138, 36]", scale: 1000 },
    VN: { center: "[108, 16]", scale: 1200 },
    BR: { center: "[-55, -15]", scale: 400 },
    TR: { center: "[35, 39]", scale: 1200 },
    SA: { center: "[45, 24]", scale: 800 },
    EG: { center: "[30, 27]", scale: 1500 },
    KR: { center: "[128, 36]", scale: 3000 },
    GB: { center: "[-2, 54]", scale: 1500 },
    US: { center: "[-95, 38]", scale: 400 },
    ID: { center: "[118, -2]", scale: 600 },
    MY: { center: "[109, 4]", scale: 1200 },
    TH: { center: "[101, 15]", scale: 1500 },
    SG: { center: "[103.8, 1.35]", scale: 50000 },
    PH: { center: "[122, 12]", scale: 1200 },
    MX: { center: "[-102, 24]", scale: 600 },
  };

  const mapConfigEntries = geoSources
    .map(src => {
      const cfg = mapConfigDefaults[src.country] || {
        center: "[0, 0]",
        scale: 200,
      };
      return `  ${src.country}: { center: ${cfg.center} as [number, number], scale: ${cfg.scale} }`;
    })
    .join(",\n");

  return `"use client";

import { useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import { useParams, useRouter } from 'next/navigation';
import { getTargetCountry } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

interface RegionMapProps {
  onRegionClick?: (regionId: string) => void;
  selectedRegion?: string | null;
  cities?: Array<{ name: string; coordinates: [number, number] }>;
}

const MAP_CONFIG: Record<string, { center: [number, number]; scale: number }> = {
${mapConfigEntries}
};

const GEO_URLS: Record<string, string> = {
${geoUrlEntries}
};

export function RegionMap({ onRegionClick, selectedRegion, cities }: RegionMapProps) {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as Locale;
  const targetCountry = getTargetCountry(locale);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const { center, scale } = MAP_CONFIG[targetCountry];

  const handleClick = (geo: any) => {
    const name = geo.properties?.name_latin || geo.properties?.name_en || geo.properties?.name || geo.properties?.NAME || geo.properties?.地名;
    if (onRegionClick) {
      onRegionClick(String(name));
    } else {
      router.push(\`/\${locale}/invest/\${encodeURIComponent(String(name))}\`);
    }
  };

  return (
    <div className="w-full h-[700px] bg-slate-800/50 rounded-xl overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale }}
        className="w-full h-full"
      >
        <ZoomableGroup center={[0, 0]} minZoom={0.5} maxZoom={4}>
          <Geographies geography={GEO_URLS[targetCountry]}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = String(geo.properties?.name_latin || geo.properties?.name || geo.properties?.NAME || geo.properties?.地名 || '');
                const isHovered = hoveredRegion === name;
                const isSelected = selectedRegion === name;
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleClick(geo)}
                    onMouseEnter={() => name && setHoveredRegion(name)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    style={{
                      default: {
                        fill: isSelected ? '${branding.primaryColor}' : isHovered ? '${branding.secondaryColor}' : '#475569',
                        stroke: '#1e293b',
                        strokeWidth: 1,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      hover: {
                        fill: '${branding.secondaryColor}',
                        stroke: '#ffffff',
                        strokeWidth: 1.5,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: '${branding.primaryColor}',
                        stroke: '#ffffff',
                        strokeWidth: 1.5,
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
          
          {cities?.map((city) => (
            <Marker key={city.name} coordinates={city.coordinates}>
              <circle r={4} fill="${branding.accentColor}" stroke="#fff" strokeWidth={1} />
              <text
                textAnchor="middle"
                y={-10}
                style={{ fontSize: '8px', fill: '#fff', fontWeight: 'bold' }}
              >
                {city.name}
              </text>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
`;
}

function generateCityMap(_branding: PortalScaffoldConfig["branding"]): string {
  return `"use client";

interface CityMapProps {
  cityName: string;
  lat?: number;
  lng?: number;
}

export function CityMap({ cityName, lat, lng }: CityMapProps) {
  // Default to showing a map centered on the city name via Nominatim search
  // If coordinates are provided, use them directly
  const hasCoordinates = lat !== undefined && lng !== undefined;
  
  // OpenStreetMap embed URL
  const mapUrl = hasCoordinates
    ? \`https://www.openstreetmap.org/export/embed.html?bbox=\${lng - 0.1}%2C\${lat - 0.08}%2C\${lng + 0.1}%2C\${lat + 0.08}&layer=mapnik&marker=\${lat}%2C\${lng}\`
    : \`https://www.openstreetmap.org/export/embed.html?bbox=-180%2C-90%2C180%2C90&layer=mapnik\`;
  
  const fullMapUrl = hasCoordinates
    ? \`https://www.openstreetmap.org/?mlat=\${lat}&mlon=\${lng}#map=13/\${lat}/\${lng}\`
    : \`https://www.openstreetmap.org/search?query=\${encodeURIComponent(cityName)}\`;

  return (
    <div className="w-full h-[400px] bg-slate-800/50 rounded-xl overflow-hidden relative">
      {hasCoordinates ? (
        <>
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={mapUrl}
            style={{ border: 0 }}
            className="rounded-xl"
          />
          <a
            href={fullMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 bg-slate-900/80 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            View larger map
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">🏙️</div>
            <h3 className="text-xl font-semibold text-white">{cityName}</h3>
            <a
              href={fullMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline mt-2 inline-flex items-center gap-1"
            >
              View on OpenStreetMap
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

function generateLawsPage(): string {
  return `import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LawsContent } from '@/features/laws/LawsContent';
import { BusinessGuide } from '@/features/laws/BusinessGuide';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'laws' });
  return { title: t('title') };
}

export default function LawsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <LawsContent />
      <BusinessGuide />
    </div>
  );
}
`;
}

function generateLawsContent(countryPair: CountryPair): string {
  const { countryA, countryB } = countryPair;
  const countryAInfo = COUNTRY_INFO[countryA];
  const countryBInfo = COUNTRY_INFO[countryB];
  const countryAName = countryAInfo?.name || countryA;
  const countryBName = countryBInfo?.name || countryB;

  // Get country-specific data
  const agreements = getAgreementsForPair(countryA, countryB);
  const visaData = getVisaInfoForPair(countryA, countryB);
  const entityData = getEntityTypesForPair(countryA, countryB);

  // Combine visa info from both countries
  const visaInfo = [...visaData.countryA, ...visaData.countryB];
  // Combine entity types from both countries
  const entityTypes = [...entityData.countryA, ...entityData.countryB];

  // Serialize data for embedding in generated code
  const agreementsJson = JSON.stringify(agreements, null, 2);
  const visaInfoJson = JSON.stringify(visaInfo, null, 2);
  const entityTypesJson = JSON.stringify(entityTypes, null, 2);

  return `"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, FileText, Stamp, Building, ExternalLink, ChevronDown, ChevronUp, Calendar, Shield, Briefcase } from 'lucide-react';

// Bilateral agreements for ${countryAName}-${countryBName}
const agreements = ${agreementsJson};

// Visa information for ${countryAName} and ${countryBName}
const visaInfo = ${visaInfoJson};

// Business entity types in ${countryAName} and ${countryBName}
const entityTypes = ${entityTypesJson};

const sections = [
  { key: 'agreements', icon: FileText, color: 'from-blue-500 to-blue-600', data: agreements },
  { key: 'visas', icon: Stamp, color: 'from-green-500 to-green-600', data: visaInfo },
  { key: 'entities', icon: Building, color: 'from-purple-500 to-purple-600', data: entityTypes },
];

export function LawsContent() {
  const t = useTranslations('laws');
  const tc = useTranslations('common');
  const [expandedSection, setExpandedSection] = useState<string | null>('agreements');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const toggleSection = (key: string) => {
    setExpandedSection(expandedSection === key ? null : key);
    setExpandedItem(null);
  };

  const toggleItem = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 mb-6">
          <Scale className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">{t('title')}</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Comprehensive guide to bilateral agreements, visa requirements, and business entity formation for ${countryAName}-${countryBName} trade.
        </p>
      </motion.div>

      <div className="space-y-6">
        {sections.map((section, sectionIndex) => (
          <motion.div
            key={section.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 }}
            className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between p-6 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={\`inline-flex p-3 rounded-xl bg-gradient-to-r \${section.color}\`}>
                  <section.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-semibold text-white">{t(section.key)}</h3>
                  <p className="text-slate-400 text-sm">{section.data.length} items</p>
                </div>
              </div>
              {expandedSection === section.key ? (
                <ChevronUp className="w-6 h-6 text-slate-400" />
              ) : (
                <ChevronDown className="w-6 h-6 text-slate-400" />
              )}
            </button>

            <AnimatePresence>
              {expandedSection === section.key && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-slate-700"
                >
                  <div className="p-6 space-y-4">
                    {section.data.map((item, itemIndex) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: itemIndex * 0.05 }}
                        className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="w-full p-4 text-left hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="text-lg font-medium text-white">{item.title}</h4>
                              {'titleLocal' in item && item.titleLocal && (
                                <p className="text-slate-500 text-sm">{item.titleLocal}</p>
                              )}
                              {'date' in item && (
                                <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                                  <Calendar className="w-4 h-4" />
                                  {new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                              )}
                            </div>
                            {expandedItem === item.id ? (
                              <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            )}
                          </div>
                        </button>

                        <AnimatePresence>
                          {expandedItem === item.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-slate-700/50"
                            >
                              <div className="p-4 space-y-4">
                                <p className="text-slate-300">{item.description}</p>

                                {'requirements' in item && item.requirements && (
                                  <div>
                                    <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                      <Shield className="w-4 h-4" /> Requirements
                                    </h5>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {item.requirements.map((req, i) => (
                                        <li key={i} className="flex items-center gap-2 text-slate-400 text-sm">
                                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                          {req}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {'timeline' in item && (
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2 text-slate-400">
                                      <Calendar className="w-4 h-4" />
                                      <span>Timeline: {item.timeline}</span>
                                    </div>
                                    {'minCapital' in item && (
                                      <div className="flex items-center gap-2 text-slate-400">
                                        <Briefcase className="w-4 h-4" />
                                        <span>Min Capital: {item.minCapital}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {'url' in item && item.url && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm transition-colors"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    {tc('viewOfficialSource')}
                                  </a>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
`;
}

function generateBusinessGuide(): string {
  return `"use client";

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getTargetCountry, getCountryName } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

export function BusinessGuide() {
  const t = useTranslations('laws');
  const tGuide = useTranslations('lawsGuide');
  const params = useParams();
  const locale = params.locale as Locale;
  const targetCountry = getTargetCountry(locale);
  const countryName = getCountryName(targetCountry, locale);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-12 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl p-8 border border-primary/30"
    >
      <h2 className="text-2xl font-bold text-white mb-4">{t('guide')}</h2>
      <p className="text-slate-300 mb-6">
        {tGuide('stepByStepGuide', { country: countryName })}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="bg-slate-800/50 rounded-lg p-4">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold mb-3">
              {step}
            </div>
            <h4 className="text-white font-medium mb-1">{tGuide('step', { number: step })}</h4>
            <p className="text-slate-400 text-sm">{tGuide('guideContent')}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
`;
}

function generateCalendarPage(): string {
  return `import { getTranslations } from 'next-intl/server';
import { EventList } from '@/features/calendar/EventList';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'calendar' });
  return { title: t('title') };
}

export default function CalendarPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <EventList />
    </div>
  );
}
`;
}

function generateEventList(countryPair: CountryPair): string {
  const { countryA, countryB } = countryPair;
  const events = getEventsForPair(countryA, countryB);
  const eventsJson = JSON.stringify(events, null, 2);

  return `"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ExternalLink, Clock, CheckCircle } from 'lucide-react';
import { EventCard } from './EventCard';

const allEvents = ${eventsJson};

export function EventList() {
  const t = useTranslations('calendar');
  const [today, setToday] = useState(new Date());
  
  useEffect(() => {
    const checkDate = () => setToday(new Date());
    checkDate();
    const interval = setInterval(checkDate, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  const sortedEvents = [...allEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const upcomingEvents = sortedEvents.filter(e => {
    const eventEnd = e.endDate ? new Date(e.endDate) : new Date(e.date);
    return eventEnd >= today;
  });
  
  const pastEvents = sortedEvents.filter(e => {
    const eventEnd = e.endDate ? new Date(e.endDate) : new Date(e.date);
    return eventEnd < today;
  }).reverse();

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 mb-6">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">{t('title')}</h1>
        <p className="text-slate-400">
          {today.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </motion.div>

      {upcomingEvents.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-green-400" />
            <h2 className="text-2xl font-semibold text-white">{t('upcoming')}</h2>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-sm rounded-full">{upcomingEvents.length}</span>
          </div>
          <div className="space-y-4">
            {upcomingEvents.map((event, index) => (
              <EventCard key={event.id} event={event} index={index} today={today} />
            ))}
          </div>
        </div>
      )}

      {pastEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle className="w-5 h-5 text-slate-500" />
            <h2 className="text-2xl font-semibold text-slate-400">{t('past')}</h2>
            <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-sm rounded-full">{pastEvents.length}</span>
          </div>
          <div className="space-y-4 opacity-60">
            {pastEvents.slice(0, 5).map((event, index) => (
              <EventCard key={event.id} event={event} index={index} today={today} isPast />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

function generateEventCard(): string {
  return `"use client";

import { motion } from 'framer-motion';
import { Calendar, MapPin, ExternalLink, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

interface Event {
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
  url: string;
  country: string;
}

type Locale = 'en' | 'zh' | 'ru';

function getLocalizedField<T extends Record<string, unknown>>(
  obj: T, 
  field: string, 
  locale: Locale
): string {
  if (locale === 'zh' && obj[\`\${field}Zh\`]) return obj[\`\${field}Zh\`] as string;
  if (locale === 'ru' && obj[\`\${field}Ru\`]) return obj[\`\${field}Ru\`] as string;
  return obj[field] as string;
}

interface EventCardProps {
  event: Event;
  index: number;
  today: Date;
  isPast?: boolean;
}

function getRelativeTime(eventDate: Date, endDate: Date | null, today: Date, isPast?: boolean, t?: (key: string, params?: Record<string, number>) => string): { text: string; urgent: boolean } {
  const diffMs = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  const translate = (key: string, params?: Record<string, number>) => 
    t ? t(key, params) : key;
  
  if (endDate && today >= eventDate && today <= endDate) {
    return { text: translate('happeningNow'), urgent: true };
  }
  
  if (isPast || diffDays < 0) {
    const pastDays = Math.abs(diffDays);
    if (pastDays === 0) return { text: translate('endedToday'), urgent: false };
    if (pastDays === 1) return { text: translate('endedYesterday'), urgent: false };
    if (pastDays < 30) return { text: translate('daysAgo', { days: pastDays }), urgent: false };
    const months = Math.floor(pastDays / 30);
    return { text: translate('monthsAgo', { months }), urgent: false };
  }
  
  if (diffDays === 0) return { text: translate('startsToday'), urgent: true };
  if (diffDays === 1) return { text: translate('startsTomorrow'), urgent: true };
  if (diffDays <= 7) return { text: translate('inDays', { days: diffDays }), urgent: true };
  if (diffDays <= 30) return { text: translate('inDays', { days: diffDays }), urgent: false };
  if (diffDays <= 60) return { text: translate('inAboutMonth'), urgent: false };
  const months = Math.floor(diffDays / 30);
  return { text: translate('inMonths', { months }), urgent: false };
}

export function EventCard({ event, index, today, isPast }: EventCardProps) {
  const t = useTranslations('calendarRelative');
  const params = useParams();
  const locale = (params.locale as Locale) || 'en';
  const countryFlag = event.country === 'CN' ? '🇨🇳' : '🇷🇺';
  const eventDate = new Date(event.date);
  const endDate = event.endDate ? new Date(event.endDate) : null;
  const { text: relativeTime, urgent } = getRelativeTime(eventDate, endDate, today, isPast, t);
  
  const title = getLocalizedField(event as unknown as Record<string, unknown>, 'title', locale);
  const description = getLocalizedField(event as unknown as Record<string, unknown>, 'description', locale);
  const location = getLocalizedField(event as unknown as Record<string, unknown>, 'location', locale);
  
  const formatDateRange = () => {
    const start = eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (endDate) {
      const end = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return \`\${start} - \${end}\`;
    }
    return \`\${start}, \${eventDate.getFullYear()}\`;
  };

  return (
    <motion.a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={\`block bg-slate-800/50 rounded-xl p-6 border transition-all group \${isPast ? 'border-slate-700/50' : 'border-slate-700 hover:border-primary/50'}\`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-2xl">{countryFlag}</span>
            <h3 className={\`text-xl font-semibold transition-colors \${isPast ? 'text-slate-400' : 'text-white group-hover:text-primary'}\`}>
              {title}
            </h3>
            {!isPast && (
              <span className={\`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 \${urgent ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}\`}>
                <Clock className="w-3 h-3" />
                {relativeTime}
              </span>
            )}
          </div>
          <p className={\`mb-4 \${isPast ? 'text-slate-500' : 'text-slate-400'}\`}>{description}</p>
          <div className={\`flex flex-wrap items-center gap-4 text-sm \${isPast ? 'text-slate-600' : 'text-slate-500'}\`}>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDateRange()}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {location}
            </span>
          </div>
        </div>
        <ExternalLink className={\`w-5 h-5 transition-colors \${isPast ? 'text-slate-600' : 'text-slate-500 group-hover:text-primary'}\`} />
      </div>
    </motion.a>
  );
}
`;
}

function generateOrganizationsPage(): string {
  return `import { getTranslations } from 'next-intl/server';
import { OrgDirectory } from '@/features/organizations/OrgDirectory';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'organizations' });
  return { title: t('title') };
}

export default function OrganizationsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <OrgDirectory />
    </div>
  );
}
`;
}

function generateOrgDirectory(countryPair: CountryPair): string {
  const { countryA, countryB } = countryPair;
  const orgData = getOrganizationsForPair(countryA, countryB);
  const orgsAJson = JSON.stringify(orgData.countryA, null, 2);
  const orgsBJson = JSON.stringify(orgData.countryB, null, 2);

  return `"use client";

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, Globe, Phone, Mail, ExternalLink } from 'lucide-react';
import { getTargetCountry } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

type OrgLocale = 'en' | 'zh' | 'ru';

function getLocalizedOrgField<T extends Record<string, unknown>>(
  obj: T, 
  field: string, 
  locale: OrgLocale
): string {
  if (locale === 'zh' && obj[\`\${field}Zh\`]) return obj[\`\${field}Zh\`] as string;
  if (locale === 'ru' && obj[\`\${field}Ru\`]) return obj[\`\${field}Ru\`] as string;
  return obj[field] as string;
}

const orgsByCountry: Record<string, Array<{ id: string; name: string; nameLocal?: string; nameZh?: string; nameRu?: string; level: string; website: string; description: string; descriptionZh?: string; descriptionRu?: string }>> = {
  ${countryA}: ${orgsAJson},
  ${countryB}: ${orgsBJson},
};

export function OrgDirectory() {
  const t = useTranslations('organizations');
  const params = useParams();
  const locale = params.locale as Locale;
  const targetCountry = getTargetCountry(locale);
  const orgs = orgsByCountry[targetCountry] || [];

  const levels = ['national', 'regional', 'municipal'] as const;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 mb-6">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">{t('title')}</h1>
      </motion.div>

      {levels.map((level) => {
        const levelOrgs = orgs.filter(o => o.level === level);
        if (levelOrgs.length === 0) return null;

        return (
          <div key={level} className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 capitalize">{t(level)}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {levelOrgs.map((org, index) => (
                <motion.a
                  key={org.id}
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-purple-500/50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                        {getLocalizedOrgField(org, 'name', locale as OrgLocale)}
                      </h3>
                      {org.nameLocal && locale === 'en' && (
                        <p className="text-sm text-slate-500 mt-1">{org.nameLocal}</p>
                      )}
                      <p className="text-slate-400 text-sm mt-2">{getLocalizedOrgField(org, 'description', locale as OrgLocale)}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-purple-400 flex-shrink-0" />
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
`;
}

function generateNewsPage(): string {
  return `import { getTranslations } from 'next-intl/server';
import { NewsFeed } from '@/features/news/NewsFeed';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'news' });
  return { title: t('title') };
}

export default function NewsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <NewsFeed />
    </div>
  );
}
`;
}

function generateNewsFeed(): string {
  return `"use client";

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
}

export function NewsFeed() {
  const t = useTranslations('news');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rss')
      .then(res => res.json())
      .then(data => {
        setNews(data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 mb-6">
          <Newspaper className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">{t('title')}</h1>
        <p className="text-slate-400">{t('latest')}</p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {t('common.noNewsAvailable')}
        </div>
      ) : (
        <div className="space-y-4">
          {news.map((item, index) => (
            <motion.a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="block bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-orange-500/50 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-400 text-sm line-clamp-2 mb-3">{item.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.pubDate).toLocaleDateString()}
                    </span>
                    <span>{item.source}</span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-orange-400 flex-shrink-0" />
              </div>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

function generateRssParser(
  sources: PortalScaffoldConfig["rssSources"]
): string {
  return `import Parser from 'rss-parser';

const parser = new Parser();

export interface RssItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
}

const RSS_SOURCES = ${JSON.stringify(sources, null, 2)};

export async function fetchAllFeeds(): Promise<RssItem[]> {
  const items: RssItem[] = [];

  for (const source of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      
      for (const item of feed.items.slice(0, 10)) {
        items.push({
          id: \`\${source.name}-\${item.guid || item.link}\`,
          title: item.title || '',
          description: item.contentSnippet || item.content || '',
          link: item.link || '',
          pubDate: item.pubDate || new Date().toISOString(),
          source: source.name,
        });
      }
    } catch (error) {
      console.error(\`Failed to fetch \${source.name}:\`, error);
    }
  }

  return items.sort((a, b) => 
    new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );
}
`;
}

function generateRssApiRoute(): string {
  return `import { NextResponse } from 'next/server';
import { fetchAllFeeds } from '@/lib/rss/parser';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  try {
    const items = await fetchAllFeeds();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('RSS fetch error:', error);
    return NextResponse.json({ items: [], error: 'Failed to fetch news' }, { status: 500 });
  }
}
`;
}

function generateInvestPage(
  features: PortalScaffoldConfig["features"]
): string {
  return `"use client";

import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { MapPin, Search, Building2, TrendingUp, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CHINA_REGIONS, RUSSIA_REGIONS } from '@/data/regionData';
import { RegionCardSkeleton } from '@/components/widgets/LoadingSkeleton';

${
  features.enable3DGlobe
    ? `const GlobeWrapper = dynamic(() => import('@/components/globe/GlobeWrapper').then(m => m.GlobeWrapper), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex flex-col items-center justify-center bg-slate-800/30 rounded-2xl border border-slate-700">
      <div className="animate-spin w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full mb-4" />
      <p className="text-slate-400 text-sm">Loading interactive map...</p>
    </div>
  ),
});`
    : ""
}

export default function InvestPage() {
  const t = useTranslations('invest');
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  
  const regions = locale === 'zh' ? RUSSIA_REGIONS : CHINA_REGIONS;
  const targetCountry = locale === 'zh' ? 'Russia' : 'China';
  
  // Filter regions based on search
  const filteredRegions = useMemo(() => {
    if (!searchQuery) return Object.entries(regions);
    const query = searchQuery.toLowerCase();
    return Object.entries(regions).filter(([key, region]) => 
      key.toLowerCase().includes(query) || 
      region.name.toLowerCase().includes(query) ||
      region.industries.some(i => i.toLowerCase().includes(query))
    );
  }, [regions, searchQuery]);

  // Get top opportunities across all regions
  const featuredOpportunities = useMemo(() => {
    const allOpps: Array<{region: string; opp: any}> = [];
    Object.entries(regions).forEach(([key, region]) => {
      region.opportunities
        .filter(o => o.status === 'priority')
        .slice(0, 1)
        .forEach(opp => allOpps.push({ region: key, opp }));
    });
    return allOpps.slice(0, 4);
  }, [regions]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 mb-6">
          <MapPin className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">{t('title')}</h1>
        <p className="text-slate-400">{t('selectRegion')}</p>
      </motion.div>

      ${
        features.enable3DGlobe
          ? `{/* Interactive Map */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8 md:mb-12"
      >
        <h2 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {t('mapTitle')}
        </h2>
        <div className="h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] rounded-xl md:rounded-2xl overflow-hidden border border-slate-700 shadow-2xl shadow-primary/10">
          <GlobeWrapper />
        </div>
      </motion.div>`
          : ""
      }

      {/* Featured Priority Opportunities */}
      {featuredOpportunities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white">{t('featuredOpportunities')}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {featuredOpportunities.map(({ region, opp }) => (
              <Link
                key={opp.id}
                href={\`/\${locale}/invest/\${encodeURIComponent(region)}\`}
                className="group bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-5 border border-slate-700/50 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">{t('priority')}</span>
                  <span className="text-xs text-slate-500">{region}</span>
                </div>
                <h3 className="font-semibold text-white mb-2 group-hover:text-amber-400 transition-colors">
                  {locale === 'ru' && opp.titleRu ? opp.titleRu : locale === 'zh' && opp.titleZh ? opp.titleZh : opp.title}
                </h3>
                <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                  {locale === 'ru' && opp.descriptionRu ? opp.descriptionRu : locale === 'zh' && opp.descriptionZh ? opp.descriptionZh : opp.description}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-400">{opp.investmentRange}</span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Search and Region List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white">{t('allRegions')}</h2>
          <span className="text-sm text-slate-500">({filteredRegions.length})</span>
        </div>
        
        {/* Search Input */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchRegions')}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          />
        </div>
        
        {/* Region Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRegions.map(([key, region], index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.02 }}
            >
              <Link
                href={\`/\${locale}/invest/\${encodeURIComponent(key)}\`}
                className="block bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors">{locale === 'ru' ? (region.nameRu || region.name) : locale === 'zh' ? (region.nameZh || region.name) : region.name}</h3>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-medium text-emerald-400">{region.gdp}</span>
                    <span className="text-slate-600">GDP</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {region.industries.slice(0, 3).map((ind, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">{ind}</span>
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        
        {filteredRegions.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">{t('noRegionsFound')}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
`;
}

function generateRegionPage(): string {
  return `import { RegionDetail } from '@/features/invest/RegionDetail';

export default function RegionPage({ params }: { params: { locale: string; regionId: string } }) {
  return <RegionDetail regionId={decodeURIComponent(params.regionId)} />;
}
`;
}

function generateCityPage(): string {
  return `import { CityDetail } from '@/features/invest/CityDetail';

export default function CityPage({ params }: { params: { locale: string; regionId: string; cityId: string } }) {
  return (
    <CityDetail 
      regionId={decodeURIComponent(params.regionId)} 
      cityId={decodeURIComponent(params.cityId)} 
    />
  );
}
`;
}

function generateRegionDetail(): string {
  return `"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Users, Factory, Building, Gift, Target, Briefcase, Rocket, MapPin, Zap, GraduationCap, Shield, Globe, Package, Cpu, Phone, Mail, ExternalLink, Clock, DollarSign, CheckCircle, AlertCircle, Star, Award, Building2 } from 'lucide-react';
import Link from 'next/link';
import { getTargetCountry } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getRegionData, CHINA_REGIONS, RUSSIA_REGIONS, type MajorCity, type InvestmentOpportunity, type KeyProject, type CompetitiveAdvantage, type NotableEntrepreneur } from '@/data/regionData';
import { RelatedRegions } from '@/components/widgets/RelatedRegions';
import { SocialShare } from '@/components/widgets/SocialShare';
import { Breadcrumbs } from '@/components/widgets/Breadcrumbs';

interface RegionDetailProps {
  regionId: string;
}

function projectPoint(lon: number, lat: number): [number, number] {
  return [lon, -lat + 90];
}

function geometryToPath(geometry: any): string {
  const coordsToPath = (rings: number[][][]): string => {
    return rings.map((ring, i) => {
      const points = ring.map((point) => {
        const [x, y] = projectPoint(point[0], point[1]);
        return \`\${x},\${y}\`;
      });
      return 'M' + points.join('L') + 'Z';
    }).join(' ');
  };
  
  if (geometry.type === 'Polygon') {
    return coordsToPath(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((poly: number[][][]) => coordsToPath(poly)).join(' ');
  }
  return '';
}

function getGeometryBounds(geometry: any): { minX: number; maxX: number; minY: number; maxY: number } {
  let allCoords: number[][] = [];
  
  const extractCoords = (coords: any): void => {
    if (typeof coords[0] === 'number') {
      allCoords.push(coords);
    } else {
      coords.forEach((c: any) => extractCoords(c));
    }
  };
  
  extractCoords(geometry.coordinates);
  
  const xs = allCoords.map(c => c[0]);
  const ys = allCoords.map(c => -c[1] + 90);
  
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function RegionDetail({ regionId }: RegionDetailProps) {
  const t = useTranslations('invest');
  const params = useParams();
  const locale = params.locale as Locale;
  
  function getLocalizedField<T extends Record<string, unknown>>(
    obj: T, 
    field: string, 
    loc: Locale
  ): string {
    if (loc === 'zh' && obj[\`\${field}Zh\`]) return obj[\`\${field}Zh\`] as string;
    if (loc === 'ru' && obj[\`\${field}Ru\`]) return obj[\`\${field}Ru\`] as string;
    return obj[field] as string;
  }
  
  const tSectors = useTranslations('sectors');
  const tIndustries = useTranslations('industries');
  const tUnits = useTranslations('units');
  const tEntrepreneurIndustries = useTranslations('entrepreneurIndustries');
  
  function translateSector(sector: string): string {
    try {
      return tSectors(sector as any) || sector;
    } catch {
      return sector;
    }
  }
  
  function translateIndustry(industry: string): string {
    try {
      return tIndustries(industry as any) || industry;
    } catch {
      return industry;
    }
  }
  
  function translateEntrepreneurIndustry(industry: string): string {
    try {
      const translated = tEntrepreneurIndustries(industry as any);
      if (translated && translated !== industry) return translated;
      return tIndustries(industry as any) || industry;
    } catch {
      try {
        return tIndustries(industry as any) || industry;
      } catch {
        return industry;
      }
    }
  }
  
  function formatMoney(value: string): string {
    if (locale === 'en') return value;
    return value
      .replace(/Billion/gi, tUnits('billion'))
      .replace(/Trillion/gi, tUnits('trillion'))
      .replace(/Million/gi, tUnits('million'));
  }
  
  function formatTimeline(timeline: string): string {
    if (locale === 'en') return timeline;
    const yearsWord = locale === 'ru' ? 'лет' : locale === 'zh' ? '年' : 'years';
    return timeline.replace(/years?/gi, yearsWord);
  }
  
  const localeCountry = getTargetCountry(locale);
  const [pathData, setPathData] = useState<string>('');
  const [viewBox, setViewBox] = useState<string>('0 0 100 100');
  
  const ruData = getRegionData(regionId, 'RU');
  const cnData = getRegionData(regionId, 'CN');
  const regionData = ruData || cnData;
  const targetCountry = ruData ? 'RU' : (cnData ? 'CN' : localeCountry);
  const fallbackData = {
    name: regionId,
    nameRu: undefined as string | undefined,
    nameZh: undefined as string | undefined,
    gdp: '$50 Billion',
    population: '10 Million',
    industries: ['Manufacturing', 'Agriculture', 'Services', 'Trade'],
    industriesRu: undefined as string[] | undefined,
    industriesZh: undefined as string[] | undefined,
    sezCount: 1,
    taxBenefits: ['15% reduced corporate tax', 'VAT exemptions', 'Land use discounts'],
    taxBenefitsRu: undefined as string[] | undefined,
    taxBenefitsZh: undefined as string[] | undefined,
    majorCities: [{ id: 'city-1', name: 'Major City 1' }, { id: 'city-2', name: 'Major City 2' }, { id: 'city-3', name: 'Major City 3' }] as MajorCity[],
    overview: 'A dynamic region with diverse economic opportunities and strong growth potential.',
    overviewRu: undefined as string | undefined,
    overviewZh: undefined as string | undefined,
    targetSectors: ['Manufacturing', 'Technology', 'Services'],
    opportunities: [] as InvestmentOpportunity[],
    keyProjects: [] as KeyProject[],
    advantages: [] as CompetitiveAdvantage[],
    notableEntrepreneurs: [] as NotableEntrepreneur[],
    contactInfo: undefined as { investmentAgency: string; website: string; email?: string; phone?: string; } | undefined,
  };
  const data = regionData || fallbackData;

  const getAdvantageIcon = (icon: string) => {
    switch (icon) {
      case 'location': return <MapPin className="w-5 h-5" />;
      case 'infrastructure': return <Building className="w-5 h-5" />;
      case 'talent': return <GraduationCap className="w-5 h-5" />;
      case 'policy': return <Shield className="w-5 h-5" />;
      case 'market': return <TrendingUp className="w-5 h-5" />;
      case 'resources': return <Zap className="w-5 h-5" />;
      case 'logistics': return <Package className="w-5 h-5" />;
      case 'tech': return <Cpu className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'priority': return <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full flex items-center gap-1"><Star className="w-3 h-3" />{t('priority')}</span>;
      case 'active': return <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t('active')}</span>;
      case 'upcoming': return <span className="px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" />{t('upcoming')}</span>;
      default: return null;
    }
  };

  useEffect(() => {
    const storedGeometry = sessionStorage.getItem('selectedRegionGeometry');
    const storedName = sessionStorage.getItem('selectedRegionName');
    
    if (storedGeometry && storedName === regionId) {
      try {
        const geometry = JSON.parse(storedGeometry);
        setPathData(geometryToPath(geometry));
        
        const bounds = getGeometryBounds(geometry);
        const padding = 2;
        const width = bounds.maxX - bounds.minX + padding * 2;
        const height = bounds.maxY - bounds.minY + padding * 2;
        setViewBox(\`\${bounds.minX - padding} \${bounds.minY - padding} \${width} \${height}\`);
      } catch (e) {
        console.error('Failed to parse region geometry');
      }
    }
  }, [regionId]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Breadcrumbs />
      
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <Link
          href={\`/\${locale}/invest\`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('back')}
        </Link>
        <SocialShare title={locale === 'ru' ? (data.nameRu || regionId) : locale === 'zh' ? (data.nameZh || regionId) : regionId} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {pathData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
            className="lg:col-span-1 flex items-center justify-center"
          >
            <div className="relative w-64 h-64">
              <div 
                className="absolute inset-0 rounded-full blur-3xl opacity-30"
                style={{ background: 'radial-gradient(circle, #DC2626 0%, transparent 70%)' }}
              />
              <svg
                viewBox={viewBox}
                className="w-full h-full drop-shadow-2xl"
                style={{ filter: 'drop-shadow(0 0 30px #DC262660)' }}
              >
                <defs>
                  <linearGradient id="regionFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#DC2626" />
                    <stop offset="100%" stopColor="#FBBF24" />
                  </linearGradient>
                  <filter id="regionGlow">
                    <feGaussianBlur stdDeviation="1" result="blur" />
                    <feFlood floodColor="#FBBF24" floodOpacity="0.5" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <motion.path
                  d={pathData}
                  fill="url(#regionFill)"
                  stroke="white"
                  strokeWidth="0.5"
                  filter="url(#regionGlow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: 'easeInOut' }}
                />
              </svg>
            </div>
          </motion.div>
        )}
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={\`\${pathData ? 'lg:col-span-2' : 'lg:col-span-3'} flex flex-col justify-center\`}
        >
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">{locale === 'ru' ? (data.nameRu || regionId) : locale === 'zh' ? (data.nameZh || regionId) : regionId}</h1>
          <p className="text-slate-400 text-lg mb-4">{locale === 'ru' && data.overviewRu ? data.overviewRu : locale === 'zh' && data.overviewZh ? data.overviewZh : data.overview}</p>
          {data.targetSectors && data.targetSectors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.targetSectors.map((sector) => (
                <span key={sector} className="px-3 py-1 bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 rounded-full text-sm text-primary">
                  {translateIndustry(sector)}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span className="text-slate-400">{t('gdp')}</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatMoney(data.gdp)}</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
        >
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-slate-400">{t('population')}</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatMoney(data.population)}</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
        >
          <div className="flex items-center gap-3 mb-2">
            <Building className="w-5 h-5 text-purple-500" />
            <span className="text-slate-400">{t('sez')}</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.sezCount} {t('zones')}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
        >
          <div className="flex items-center gap-2 mb-4">
            <Factory className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-white">{t('industries')}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {(locale === 'ru' && data.industriesRu ? data.industriesRu : locale === 'zh' && data.industriesZh ? data.industriesZh : data.industries.map(i => translateIndustry(i))).map((industry, index) => (
              <span key={index} className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300">
                {industry}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl p-6 border border-primary/30"
        >
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white">{t('taxBenefits')}</h3>
          </div>
          <ul className="space-y-2">
            {(locale === 'ru' && data.taxBenefitsRu ? data.taxBenefitsRu : locale === 'zh' && data.taxBenefitsZh ? data.taxBenefitsZh : data.taxBenefits).map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {benefit}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Investment Opportunities Section */}
      {data.opportunities && data.opportunities.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white">{t('opportunities')}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.opportunities.map((opp, index) => (
              <motion.div
                key={opp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-green-500/50 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="px-2 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded">{translateSector(opp.sector)}</span>
                  {getStatusBadge(opp.status)}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{getLocalizedField(opp as unknown as Record<string, unknown>, 'title', locale)}</h3>
                <p className="text-slate-400 text-sm mb-4">{getLocalizedField(opp as unknown as Record<string, unknown>, 'description', locale)}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>{formatMoney(opp.investmentRange)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{formatTimeline(opp.timeline)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Key Projects Section */}
      {data.keyProjects && data.keyProjects.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white">{t('keyProjects')}</h2>
          </div>
          <div className="space-y-4">
            {data.keyProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + index * 0.05 }}
                className="bg-gradient-to-r from-slate-800/50 to-slate-800/30 rounded-xl p-6 border border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{getLocalizedField(project as unknown as Record<string, unknown>, 'name', locale)}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">{translateSector(project.sector)}</span>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">{getLocalizedField(project as unknown as Record<string, unknown>, 'description', locale)}</p>
                    {project.partners && project.partners.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{t('partners')}:</span>
                        {project.partners.map((partner, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-700 rounded text-slate-300">{partner}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-2xl font-bold text-green-400">{formatMoney(project.value)}</span>
                    {project.completionYear && (
                      <span className="text-sm text-slate-500">{t('target')}: {project.completionYear === 'Ongoing' ? t('ongoing') : project.completionYear}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Competitive Advantages Section */}
      {data.advantages && data.advantages.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white">{t('advantages')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.advantages.map((adv, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65 + index * 0.05 }}
                className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    {getAdvantageIcon(adv.icon)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{getLocalizedField(adv as unknown as Record<string, unknown>, 'title', locale)}</h3>
                    <p className="text-slate-400 text-sm">{getLocalizedField(adv as unknown as Record<string, unknown>, 'description', locale)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Who's Who - Notable Entrepreneurs */}
      {data.notableEntrepreneurs && data.notableEntrepreneurs.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">{t('whosWho')}</h2>
              <p className="text-sm text-slate-400">{t('notableEntrepreneurs')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.notableEntrepreneurs.map((entrepreneur, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.05 }}
                className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-amber-500/50 transition-all group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    {entrepreneur.image ? (
                      <img src={entrepreneur.image} alt={entrepreneur.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-amber-400">{entrepreneur.name.charAt(0)}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white mb-0.5">
                    {locale === 'zh' && entrepreneur.nameZh ? entrepreneur.nameZh : locale === 'ru' && entrepreneur.nameRu ? entrepreneur.nameRu : entrepreneur.name}
                  </h3>
                  {locale !== 'en' && (
                    <p className="text-xs text-slate-500 mb-2">{entrepreneur.name}</p>
                  )}
                  <div className="flex items-center gap-1 mb-2">
                    <Building2 className="w-3 h-3 text-slate-500" />
                    <span className="text-sm text-amber-400 font-medium">{entrepreneur.company}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-full mb-2">{translateEntrepreneurIndustry(entrepreneur.industry)}</span>
                  {entrepreneur.netWorth && (
                    <div className="flex items-center gap-1 text-green-400 text-sm font-semibold">
                      <DollarSign className="w-3 h-3" />
                      <span>{formatMoney(entrepreneur.netWorth)}</span>
                    </div>
                  )}
                  {entrepreneur.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {locale === 'ru' && entrepreneur.descriptionRu ? entrepreneur.descriptionRu : 
                       locale === 'zh' && entrepreneur.descriptionZh ? entrepreneur.descriptionZh : 
                       entrepreneur.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Contact Information */}
      {data.contactInfo && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="mt-8"
        >
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-6 border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-white">{t('contact')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">{t('agency')}</p>
                <p className="text-white font-medium">{locale === 'ru' && (data.contactInfo as any).investmentAgencyRu ? (data.contactInfo as any).investmentAgencyRu : locale === 'zh' && (data.contactInfo as any).investmentAgencyZh ? (data.contactInfo as any).investmentAgencyZh : data.contactInfo.investmentAgency}</p>
              </div>
              {data.contactInfo.website && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">{t('website')}</p>
                  <a href={data.contactInfo.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex items-center gap-1">
                    {t('visitWebsite')} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {data.contactInfo.email && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">{t('email')}</p>
                  <a href={\`mailto:\${data.contactInfo.email}\`} className="text-primary hover:text-primary/80 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {data.contactInfo.email}
                  </a>
                </div>
              )}
              {data.contactInfo.phone && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">{t('phone')}</p>
                  <a href={\`tel:\${data.contactInfo.phone}\`} className="text-white flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {data.contactInfo.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      )}

      {/* Major Cities Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="mt-8"
      >
        <h2 className="text-2xl font-semibold text-white mb-6">{t('majorCities')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.majorCities.map((city) => (
            <Link
              key={city.id}
              href={\`/\${locale}/invest/\${encodeURIComponent(regionId)}/\${encodeURIComponent(city.id)}\`}
              className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Building className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                    {locale === 'ru' && (city as any).nameRu ? (city as any).nameRu : locale === 'zh' && (city as any).nameZh ? (city as any).nameZh : city.name}
                  </h3>
                  <p className="text-sm text-slate-500">{city.population || t('clickToExplore')}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>

      <RelatedRegions 
        currentRegion={data} 
        allRegions={targetCountry === 'CN' ? CHINA_REGIONS : RUSSIA_REGIONS} 
      />
    </div>
  );
}
`;
}

function generateCityDetail(): string {
  return `"use client";

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, DollarSign, Sparkles, Building2, Target, MapPin } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { CityMap } from '@/components/map/CityMap';
import { getRegionData, type MajorCity, type InvestmentOpportunity } from '@/data/regionData';
import { getTargetCountry } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { SocialShare } from '@/components/widgets/SocialShare';

interface CityDetailProps {
  regionId: string;
  cityId: string;
}

export function CityDetail({ regionId, cityId }: CityDetailProps) {
  const t = useTranslations('invest');
  const params = useParams();
  const locale = params.locale as string;
  
  const targetCountry = getTargetCountry(locale as Locale);
  const regionData = getRegionData(regionId, targetCountry);
  
  // Find the city data
  const cityData = regionData?.majorCities.find(
    (c) => c.id === cityId || c.name.toLowerCase().replace(/\\s+/g, '-') === cityId.toLowerCase()
  );

  const statusColors = {
    priority: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  
  // Default fallback image
  const defaultImage = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&q=80';

  return (
    <div>
      {/* Hero Image Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative h-[40vh] min-h-[300px] max-h-[500px] w-full overflow-hidden"
      >
        <Image
          src={cityData?.image || defaultImage}
          alt={cityData?.name || cityId}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
        
        {/* Back button overlay */}
        <div className="absolute top-6 left-6 z-10">
          <Link
            href={\`/\${locale}/invest/\${encodeURIComponent(regionId)}\`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-sm rounded-full text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </Link>
        </div>
        
        {/* City info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 text-orange-400 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">{regionId}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{cityData?.name || cityId}</h1>
              <div className="flex items-center justify-between flex-wrap gap-4">
                {cityData?.population && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="w-5 h-5" />
                    <span className="text-lg">{t('population')}: {cityData.population}</span>
                  </div>
                )}
                <SocialShare title={cityData?.name || cityId} />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
      
      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Description */}
        {cityData?.description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-10 bg-gradient-to-r from-slate-800/80 to-slate-800/40 rounded-2xl p-8 border border-slate-700/50"
          >
            <p className="text-slate-300 text-lg leading-relaxed">{cityData.description}</p>
          </motion.div>
        )}

        {/* Map Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-10"
        >
          <CityMap cityName={cityData?.name || cityId} lat={cityData?.lat} lng={cityData?.lng} />
        </motion.div>

        {/* City Investment Opportunities */}
        {cityData?.opportunities && cityData.opportunities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white">{t('opportunities')}</h2>
          </div>
          
          <div className="grid gap-4">
            {cityData.opportunities.map((opp, index) => (
              <motion.div
                key={opp.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">{opp.sector}</span>
                      <span className={\`text-xs px-2 py-1 rounded-full border \${statusColors[opp.status]}\`}>
                        {t(opp.status)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      {locale === 'ru' && opp.titleRu ? opp.titleRu : locale === 'zh' && opp.titleZh ? opp.titleZh : opp.title}
                    </h3>
                  </div>
                </div>
                
                <p className="text-slate-400 mb-4">
                  {locale === 'ru' && opp.descriptionRu ? opp.descriptionRu : locale === 'zh' && opp.descriptionZh ? opp.descriptionZh : opp.description}
                </p>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                    <span>{opp.investmentRange}</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400">
                    <Clock className="w-4 h-4" />
                    <span>{opp.timeline}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
      
      {(!cityData?.opportunities || cityData.opportunities.length === 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/30 rounded-xl p-8 border border-slate-700/50 text-center"
        >
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{t('cityOpportunitiesComingSoon')}</p>
          <Link
            href={\`/\${locale}/invest/\${encodeURIComponent(regionId)}\`}
            className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {t('viewRegionOpportunities')}
          </Link>
        </motion.div>
      )}

      </div>
    </div>
  );
}
`;
}

function generateEconomicStats(): string {
  return `"use client";

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Factory, Gift, Building } from 'lucide-react';

const mockStats = {
  gdp: '$1.2 Trillion',
  population: '45.8 Million',
  industries: ['Technology', 'Manufacturing', 'Finance', 'Agriculture'],
  sezCount: 5,
  taxBenefits: ['15% reduced corporate tax', 'VAT exemptions', 'Land use discounts'],
};

export function EconomicStats() {
  const t = useTranslations('invest');

  const stats = [
    { key: 'gdp', value: mockStats.gdp, icon: TrendingUp, color: 'from-green-500 to-green-600' },
    { key: 'population', value: mockStats.population, icon: Users, color: 'from-blue-500 to-blue-600' },
    { key: 'sez', value: \`\${mockStats.sezCount} zones\`, icon: Building, color: 'from-purple-500 to-purple-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
          >
            <div className={\`inline-flex p-2 rounded-lg bg-gradient-to-r \${stat.color} mb-3\`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-slate-400 text-sm">{t(stat.key)}</p>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Industries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
      >
        <div className="flex items-center gap-2 mb-4">
          <Factory className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-white">{t('industries')}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {mockStats.industries.map((industry) => (
            <span
              key={industry}
              className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300"
            >
              {industry}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Tax Benefits */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl p-5 border border-primary/30"
      >
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">{t('taxBenefits')}</h3>
        </div>
        <ul className="space-y-2">
          {mockStats.taxBenefits.map((benefit, index) => (
            <li key={index} className="flex items-center gap-2 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {benefit}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
`;
}

function generateDbSchema(database: string): string {
  const tableType =
    database === "postgresql"
      ? "pgTable"
      : database === "mysql"
        ? "mysqlTable"
        : "sqliteTable";
  const serialType = database === "postgresql" ? "serial" : "int";
  const textType = database === "postgresql" ? "text" : "varchar";
  const timestampType = database === "postgresql" ? "timestamp" : "datetime";

  return `import {
  ${tableType} as createTable,
  ${serialType},
  ${textType},
  varchar,
  ${timestampType},
  integer,
  decimal,
  boolean,
  json,
  index,
} from "drizzle-orm/${database === "postgresql" ? "pg" : database}-core";
import { relations } from "drizzle-orm";
${database !== "postgresql" ? 'import { sql } from "drizzle-orm";' : ""}

export const regions = createTable("regions", {
  id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameLocal: varchar("name_local", { length: 255 }),
  country: varchar("country", { length: 10 }).notNull(),
  level: varchar("level", { length: 20 }).notNull(),
  parentId: integer("parent_id"),
  description: ${textType}("description"),
  population: integer("population"),
  gdp: decimal("gdp", { precision: 15, scale: 2 }),
  centerLat: decimal("center_lat", { precision: 10, scale: 6 }),
  centerLng: decimal("center_lng", { precision: 10, scale: 6 }),
  industries: json("industries").$type<string[]>().default([]),
  sezCount: integer("sez_count").default(0),
  taxBenefits: json("tax_benefits").$type<string[]>().default([]),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: ${timestampType}("created_at").${database === "postgresql" ? "defaultNow()" : "default(sql`CURRENT_TIMESTAMP`)"},
});

export const events = createTable("events", {
  id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
  title: varchar("title", { length: 255 }).notNull(),
  titleLocal: varchar("title_local", { length: 255 }),
  description: ${textType}("description"),
  descriptionLocal: ${textType}("description_local"),
  date: ${timestampType}("date").notNull(),
  endDate: ${timestampType}("end_date"),
  location: varchar("location", { length: 255 }),
  country: varchar("country", { length: 10 }),
  url: varchar("url", { length: 500 }),
  category: varchar("category", { length: 50 }),
  featured: boolean("featured").default(false),
  createdAt: ${timestampType}("created_at").${database === "postgresql" ? "defaultNow()" : "default(sql`CURRENT_TIMESTAMP`)"},
});

export const organizations = createTable("organizations", {
  id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
  name: varchar("name", { length: 255 }).notNull(),
  nameLocal: varchar("name_local", { length: 255 }),
  description: ${textType}("description"),
  descriptionLocal: ${textType}("description_local"),
  country: varchar("country", { length: 10 }).notNull(),
  level: varchar("level", { length: 20 }).notNull(),
  website: varchar("website", { length: 500 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: ${textType}("address"),
  regionId: integer("region_id"),
  createdAt: ${timestampType}("created_at").${database === "postgresql" ? "defaultNow()" : "default(sql`CURRENT_TIMESTAMP`)"},
});

export const newsItems = createTable("news_items", {
  id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
  externalId: varchar("external_id", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  description: ${textType}("description"),
  link: varchar("link", { length: 500 }).notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  language: varchar("language", { length: 10 }),
  category: varchar("category", { length: 50 }),
  pubDate: ${timestampType}("pub_date").notNull(),
  fetchedAt: ${timestampType}("fetched_at").${database === "postgresql" ? "defaultNow()" : "default(sql`CURRENT_TIMESTAMP`)"},
});

export const laws = createTable("laws", {
  id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  titleLocal: varchar("title_local", { length: 255 }),
  content: ${textType}("content"),
  contentLocal: ${textType}("content_local"),
  category: varchar("category", { length: 50 }).notNull(),
  targetCountry: varchar("target_country", { length: 10 }),
  effectiveDate: ${timestampType}("effective_date"),
  sourceUrl: varchar("source_url", { length: 500 }),
  sortOrder: integer("sort_order").default(0),
  createdAt: ${timestampType}("created_at").${database === "postgresql" ? "defaultNow()" : "default(sql`CURRENT_TIMESTAMP`)"},
});

export type Region = typeof regions.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type NewsItem = typeof newsItems.$inferSelect;
export type Law = typeof laws.$inferSelect;
`;
}

function generateDbClient(database: string): string {
  if (database === "postgresql") {
    return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
`;
  }
  return `import { drizzle } from "drizzle-orm/${database}2";
import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
`;
}

function generateDrizzleConfig(database: string): string {
  return `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "${database}",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`;
}

function generateSeedScript(
  _countryPair: PortalScaffoldConfig["countryPair"]
): string {
  return `import { db } from "../src/lib/db/client";
import { regions, events, organizations, laws } from "../src/lib/db/schema";

async function seed() {
  console.log("Seeding database...");

  // Seed regions
  const chinaRegions = [
    { slug: "beijing", name: "Beijing", nameLocal: "北京", country: "CN", level: "region", population: 21540000, gdp: "610000000000", centerLat: "39.9", centerLng: "116.4", industries: ["Technology", "Finance", "Government"], sezCount: 2 },
    { slug: "shanghai", name: "Shanghai", nameLocal: "上海", country: "CN", level: "region", population: 24280000, gdp: "670000000000", centerLat: "31.2", centerLng: "121.5", industries: ["Finance", "Trade", "Manufacturing"], sezCount: 3 },
    { slug: "guangdong", name: "Guangdong", nameLocal: "广东", country: "CN", level: "region", population: 126010000, gdp: "1960000000000", centerLat: "23.1", centerLng: "113.3", industries: ["Electronics", "Manufacturing", "Export"], sezCount: 5 },
  ];

  const russiaRegions = [
    { slug: "moscow", name: "Moscow", nameLocal: "Москва", country: "RU", level: "region", population: 12655000, gdp: "450000000000", centerLat: "55.8", centerLng: "37.6", industries: ["Finance", "Technology", "Services"], sezCount: 4 },
    { slug: "spb", name: "Saint Petersburg", nameLocal: "Санкт-Петербург", country: "RU", level: "region", population: 5384000, gdp: "120000000000", centerLat: "59.9", centerLng: "30.3", industries: ["Shipbuilding", "Technology", "Tourism"], sezCount: 2 },
    { slug: "primorsky", name: "Primorsky Krai", nameLocal: "Приморский край", country: "RU", level: "region", population: 1895000, gdp: "25000000000", centerLat: "44.0", centerLng: "133.0", industries: ["Shipping", "Fishing", "Trade"], sezCount: 3 },
  ];

  await db.insert(regions).values([...chinaRegions, ...russiaRegions]);
  console.log("Regions seeded");

  // Seed events
  await db.insert(events).values([
    { title: "China International Import Expo", titleLocal: "中国国际进口博览会", date: new Date("2026-03-05"), location: "Shanghai, China", country: "CN", url: "https://www.ciie.org", category: "trade", featured: true },
    { title: "St. Petersburg International Economic Forum", titleLocal: "ПМЭФ", date: new Date("2026-06-15"), location: "Saint Petersburg, Russia", country: "RU", url: "https://forumspb.com", category: "investment", featured: true },
  ]);
  console.log("Events seeded");

  // Seed organizations
  await db.insert(organizations).values([
    { name: "Ministry of Commerce", nameLocal: "商务部", country: "CN", level: "national", website: "http://www.mofcom.gov.cn" },
    { name: "Ministry of Economic Development", nameLocal: "Минэкономразвития", country: "RU", level: "national", website: "https://economy.gov.ru" },
  ]);
  console.log("Organizations seeded");

  // Seed laws
  await db.insert(laws).values([
    { slug: "bilateral-trade-agreement", title: "China-Russia Bilateral Trade Agreement", category: "agreements", targetCountry: "CN" },
    { slug: "company-registration", title: "Foreign Company Registration Guide", category: "entities", targetCountry: "CN" },
  ]);
  console.log("Laws seeded");

  console.log("Seeding complete!");
}

seed().catch(console.error);
`;
}

function generateGlobeTypes(): string {
  return `declare module 'globe.gl' {
  interface GlobeInstance {
    (element: HTMLElement): GlobeInstance;
    width(width?: number): GlobeInstance | number;
    height(height?: number): GlobeInstance | number;
    globeImageUrl(url?: string): GlobeInstance | string;
    bumpImageUrl(url?: string): GlobeInstance | string;
    backgroundImageUrl(url?: string): GlobeInstance | string;
    showAtmosphere(show?: boolean): GlobeInstance | boolean;
    atmosphereColor(color?: string): GlobeInstance | string;
    atmosphereAltitude(altitude?: number): GlobeInstance | number;
    pointOfView(pov?: { lat?: number; lng?: number; altitude?: number }, transitionMs?: number): GlobeInstance;
    polygonsData(data?: object[]): GlobeInstance | object[];
    polygonCapColor(fn?: (d: object) => string): GlobeInstance;
    polygonSideColor(fn?: (d: object) => string): GlobeInstance;
    polygonStrokeColor(fn?: (d: object) => string): GlobeInstance;
    polygonAltitude(alt?: number | ((d: object) => number)): GlobeInstance;
    polygonLabel(fn?: (d: object) => string): GlobeInstance;
    onPolygonClick(fn?: (polygon: object, event: MouseEvent) => void): GlobeInstance;
    onPolygonHover(fn?: (polygon: object | null, prevPolygon: object | null) => void): GlobeInstance;
    _destructor?(): void;
  }

  function Globe(): GlobeInstance;
  export default Globe;
}
`;
}

function generateReactSimpleMapsTypes(): string {
  return `declare module "react-simple-maps" {
  import { ComponentType, ReactNode, CSSProperties } from "react";

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: {
      rotate?: [number, number, number];
      scale?: number;
      center?: [number, number];
    };
    width?: number;
    height?: number;
    className?: string;
    children?: ReactNode;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Geography[] }) => ReactNode;
  }

  export interface Geography {
    rsmKey: string;
    properties: Record<string, unknown> & {
      name?: string;
      NAME?: string;
      ADMIN?: string;
      adcode?: string;
    };
  }

  export interface GeographyProps {
    geography: Geography;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
    children?: ReactNode;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
  export const Marker: ComponentType<MarkerProps>;
}
`;
}

function generateGlobalCss(branding: PortalScaffoldConfig["branding"]): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: ${branding.primaryColor};
  --secondary: ${branding.secondaryColor};
  --accent: ${branding.accentColor};
}

html {
  scroll-behavior: smooth;
}

body {
  @apply antialiased;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  @apply bg-slate-900;
}

::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-slate-600;
}

/* Globe container */
.globe-container canvas {
  outline: none !important;
}

/* Animation utilities */
@layer utilities {
  .animation-delay-200 {
    animation-delay: 200ms;
  }
  .animation-delay-400 {
    animation-delay: 400ms;
  }
}
`;
}

function generateRegionData(): string {
  return `export interface MajorCity {
  id: string;
  name: string;
  nameRu?: string;
  nameZh?: string;
  population?: string;
  description?: string;
  descriptionRu?: string;
  descriptionZh?: string;
  image?: string;
  lat?: number;
  lng?: number;
  opportunities?: InvestmentOpportunity[];
}

export interface InvestmentOpportunity {
  id: string;
  title: string;
  titleRu?: string;
  titleZh?: string;
  sector: string;
  description: string;
  descriptionRu?: string;
  descriptionZh?: string;
  investmentRange: string;
  timeline: string;
  status: 'active' | 'upcoming' | 'priority';
}

export interface KeyProject {
  id: string;
  name: string;
  nameRu?: string;
  nameZh?: string;
  value: string;
  sector: string;
  description: string;
  descriptionRu?: string;
  descriptionZh?: string;
  partners?: string[];
  completionYear?: string;
}

export interface CompetitiveAdvantage {
  icon: 'location' | 'infrastructure' | 'talent' | 'policy' | 'market' | 'resources' | 'logistics' | 'tech';
  title: string;
  titleRu?: string;
  titleZh?: string;
  description: string;
  descriptionRu?: string;
  descriptionZh?: string;
}

export interface NotableEntrepreneur {
  name: string;
  nameZh?: string;
  nameRu?: string;
  company: string;
  industry: string;
  netWorth?: string;
  image?: string;
  description?: string;
  descriptionRu?: string;
  descriptionZh?: string;
}

export interface RegionData {
  name: string;
  nameRu?: string;
  nameZh?: string;
  gdp: string;
  population: string;
  industries: string[];
  industriesRu?: string[];
  industriesZh?: string[];
  sezCount: number;
  taxBenefits: string[];
  taxBenefitsRu?: string[];
  taxBenefitsZh?: string[];
  majorCities: MajorCity[];
  description?: string;
  descriptionRu?: string;
  descriptionZh?: string;
  overview: string;
  overviewRu?: string;
  overviewZh?: string;
  opportunities: InvestmentOpportunity[];
  keyProjects: KeyProject[];
  advantages: CompetitiveAdvantage[];
  targetSectors: string[];
  targetSectorsRu?: string[];
  targetSectorsZh?: string[];
  notableEntrepreneurs?: NotableEntrepreneur[];
  contactInfo?: {
    investmentAgency: string;
    investmentAgencyRu?: string;
    investmentAgencyZh?: string;
    website: string;
    email?: string;
    phone?: string;
  };
}

export const CHINA_REGIONS: Record<string, RegionData> = {
  "Beijing": {
    name: "Beijing",
    nameRu: "Пекин",
    nameZh: "北京",
    gdp: "$610 Billion",
    population: "21.5 Million",
    industries: ["Technology", "Finance", "Government Services", "Healthcare"],
    industriesRu: ["Технологии", "Финансы", "Государственные услуги", "Здравоохранение"],
    industriesZh: ["科技", "金融", "政府服务", "医疗"],
    sezCount: 2,
    taxBenefits: ["15% CIT for high-tech enterprises", "R&D expense super-deduction", "Talent incentives"],
    taxBenefitsRu: ["15% налог на прибыль для высокотехнологичных предприятий", "Сверхвычет расходов на НИОКР", "Льготы для талантов"],
    taxBenefitsZh: ["高新技术企业15%企业所得税", "研发费用加计扣除", "人才激励政策"],
    majorCities: [
      { id: "haidian", name: "Haidian District", nameRu: "Район Хайдянь", nameZh: "海淀区", population: "3.5M", lat: 39.9593, lng: 116.2986, image: "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=1920&q=80", description: "China's Silicon Valley - home to Zhongguancun tech hub, Tsinghua University, Peking University, and 20,000+ high-tech companies. The epicenter of AI, software, and deeptech in China.", descriptionRu: "Китайская Кремниевая долина — здесь расположены технопарк Чжунгуаньцунь, Университет Цинхуа, Пекинский университет и более 20 000 высокотехнологичных компаний. Эпицентр ИИ, программного обеспечения и глубоких технологий в Китае.", descriptionZh: "中国的硅谷——中关村科技园区、清华大学、北京大学和20,000多家高科技企业的所在地。中国人工智能、软件和深科技的中心。", opportunities: [
        { id: "hd-1", title: "Zhongguancun Software Park JV", titleZh: "中关村软件园合资企业", titleRu: "СП в Технопарке Чжунгуаньцунь", sector: "Software", description: "Joint ventures with China's top software companies. Access to 30,000+ developers and government contracts.", descriptionZh: "与中国顶级软件公司成立合资企业。可接触30,000多名开发人员和政府合同。", descriptionRu: "Совместные предприятия с ведущими софтверными компаниями Китая. Доступ к 30 000+ разработчикам и государственным контрактам.", investmentRange: "$2M - $30M", timeline: "1-2 years", status: "active" },
        { id: "hd-2", title: "University Technology Transfer", titleZh: "大学技术转让", titleRu: "Трансфер университетских технологий", sector: "DeepTech", description: "Commercialize patents from Tsinghua and Peking University. AI, quantum computing, new materials focus.", descriptionZh: "将清华大学和北京大学的专利商业化。专注于人工智能、量子计算和新材料。", descriptionRu: "Коммерциализация патентов Университетов Цинхуа и Пекина. Фокус на ИИ, квантовых вычислениях и новых материалах.", investmentRange: "$1M - $20M", timeline: "2-3 years", status: "priority" },
        { id: "hd-3", title: "AI Research Lab Partnerships", titleZh: "人工智能研究实验室合作", titleRu: "Партнёрство с лабораториями ИИ", sector: "AI", description: "Co-develop AI solutions with Baidu, ByteDance, and state research institutes located in Haidian.", descriptionZh: "与百度、字节跳动及海淀区国家研究机构共同开发人工智能解决方案。", descriptionRu: "Совместная разработка ИИ-решений с Baidu, ByteDance и государственными НИИ в районе Хайдянь.", investmentRange: "$5M - $50M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "chaoyang", name: "Chaoyang District", nameRu: "Район Чаоян", nameZh: "朝阳区", population: "3.9M", lat: 39.9219, lng: 116.4435, image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1920&q=80", description: "Beijing's CBD and diplomatic center. Home to 170+ foreign embassies, Fortune 500 regional HQs, and luxury retail. The gateway for international business in China.", descriptionRu: "Деловой и дипломатический центр Пекина. Здесь расположены более 170 иностранных посольств, региональные штаб-квартиры компаний Fortune 500 и люксовая розничная торговля. Ворота для международного бизнеса в Китае.", descriptionZh: "北京的中央商务区和外交中心。拥有170多个外国大使馆、财富500强企业区域总部和奢侈品零售。中国国际商务的门户。", opportunities: [
        { id: "cy-1", title: "CBD Grade A Office Development", titleZh: "CBD甲级写字楼开发", titleRu: "Девелопмент офисов класса А в деловом центре", sector: "Real Estate", description: "Premium office towers in Beijing's financial district. Strong demand from Russian and Central Asian firms.", descriptionZh: "北京金融区优质写字楼。来自俄罗斯和中亚企业的强劲需求。", descriptionRu: "Премиальные офисные башни в финансовом районе Пекина. Высокий спрос со стороны российских и центральноазиатских компаний.", investmentRange: "$50M - $300M", timeline: "3-5 years", status: "active" },
        { id: "cy-2", title: "Russia-China Trade Service Center", titleRu: "Российско-китайский торговый сервисный центр", titleZh: "俄中贸易服务中心", sector: "Professional Services", description: "One-stop shop for bilateral trade: legal, accounting, consulting, and logistics coordination.", descriptionRu: "Универсальный центр для двусторонней торговли: юридические, бухгалтерские, консалтинговые и логистические услуги.", descriptionZh: "双边贸易一站式服务：法律、会计、咨询和物流协调。", investmentRange: "$2M - $10M", timeline: "1 year", status: "priority" },
        { id: "cy-3", title: "798 Art District Cultural Exchange", titleZh: "798艺术区文化交流", titleRu: "Культурный обмен в арт-районе 798", sector: "Culture & Tourism", description: "Russia-China cultural center, gallery spaces, and creative industry incubator in famous art zone.", descriptionZh: "在著名艺术区设立中俄文化中心、画廊空间和创意产业孵化器。", descriptionRu: "Российско-китайский культурный центр, галереи и инкубатор креативных индустрий в знаменитом арт-районе.", investmentRange: "$5M - $30M", timeline: "2-3 years", status: "upcoming" }
      ]},
      { id: "dongcheng", name: "Dongcheng District", nameRu: "Район Дунчэн", nameZh: "东城区", population: "0.8M", lat: 39.9282, lng: 116.4160, image: "https://images.unsplash.com/photo-1537002295-36f0c5c56c97?w=1920&q=80", description: "Historic heart of Beijing with the Forbidden City, government ministries, and cultural heritage. Premium location for tourism, hospitality, and government relations.", descriptionRu: "Историческое сердце Пекина с Запретным городом, правительственными министерствами и культурным наследием. Премиальное расположение для туризма, гостиничного бизнеса и связей с государственными органами.", descriptionZh: "北京的历史中心，拥有故宫、政府部委和文化遗产。旅游、酒店和政府关系的优质地段。", opportunities: [
        { id: "dc-1", title: "Heritage Hotel & Tourism", titleZh: "传统酒店与旅游", titleRu: "Исторические отели и туризм", sector: "Hospitality", description: "Boutique hotels in historic hutong areas. Growing Russian tourist segment seeking cultural experiences.", descriptionZh: "在历史胡同区开设精品酒店。俄罗斯游客群体不断增长，寻求文化体验。", descriptionRu: "Бутик-отели в исторических районах хутунов. Растущий сегмент российских туристов, ищущих культурный опыт.", investmentRange: "$10M - $50M", timeline: "2-3 years", status: "active" },
        { id: "dc-2", title: "Government Affairs Advisory", titleZh: "政府事务咨询", titleRu: "Консалтинг по работе с госорганами", sector: "Consulting", description: "Strategic advisory services for navigating China's regulatory landscape. Located near key ministries.", descriptionZh: "提供战略咨询服务，帮助企业应对中国监管环境。位于主要部委附近。", descriptionRu: "Стратегический консалтинг по навигации в регуляторной среде Китая. Расположение рядом с ключевыми министерствами.", investmentRange: "$1M - $5M", timeline: "6-12 months", status: "active" }
      ]}
    ],
    overview: "China's political and cultural capital, Beijing is a global hub for technology innovation, featuring Zhongguancun - Asia's Silicon Valley. The city leads in AI research, fintech, and biotech with unparalleled access to government resources and top universities.",
    overviewRu: "Политическая и культурная столица Китая, Пекин является мировым центром технологических инноваций с районом Чжунгуаньцунь — азиатской Кремниевой долиной. Город лидирует в исследованиях ИИ, финтехе и биотехнологиях с беспрецедентным доступом к государственным ресурсам и ведущим университетам.",
    overviewZh: "中国的政治和文化中心，北京是全球科技创新中心，拥有亚洲硅谷——中关村。该城市在人工智能研究、金融科技和生物技术方面处于领先地位，拥有无与伦比的政府资源和顶尖大学。",
    targetSectors: ["Artificial Intelligence", "Fintech", "Biotech & Pharmaceuticals", "New Energy Vehicles", "Digital Economy"],
    opportunities: [
      { id: "bj-1", title: "Zhongguancun AI Innovation Hub", titleZh: "中关村人工智能创新中心", titleRu: "Инновационный хаб ИИ Чжунгуаньцунь", sector: "AI & Technology", description: "Joint venture opportunities in China's premier tech district. Access to 20,000+ high-tech companies, Tsinghua and Peking University talent pipeline, and government AI development fund.", descriptionZh: "在中国首要科技园区的合资机会。可接触20,000多家高科技企业、清华北大人才渠道及政府人工智能发展基金。", descriptionRu: "Возможности СП в ведущем технологическом районе Китая. Доступ к 20 000+ высокотехнологичных компаний, кадровому резерву Цинхуа и Пекинского университетов и государственному фонду развития ИИ.", investmentRange: "$5M - $100M", timeline: "2-3 years", status: "active" },
      { id: "bj-2", title: "Beijing Daxing International Airport Economic Zone", titleZh: "北京大兴国际机场经济区", titleRu: "Экономическая зона аэропорта Дасин", sector: "Logistics & Aviation", description: "Duty-free retail, aircraft maintenance, and logistics hub development around the world's largest airport. Direct Russia cargo routes planned.", descriptionZh: "在世界最大机场周边开发免税零售、飞机维护和物流中心。计划开通直达俄罗斯的货运航线。", descriptionRu: "Развитие беспошлинной торговли, техобслуживания самолётов и логистического хаба вокруг крупнейшего аэропорта мира. Планируются прямые грузовые маршруты в Россию.", investmentRange: "$10M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "bj-3", title: "China-Russia Healthcare Innovation Center", titleRu: "Российско-китайский инновационный центр здравоохранения", titleZh: "中俄医疗创新中心", sector: "Biotech", description: "Bilateral medical technology development focusing on pharmaceuticals, medical devices, and telemedicine. Fast-track NMPA approval for Russian products.", descriptionRu: "Совместная разработка медицинских технологий: фармацевтика, медицинские изделия, телемедицина. Ускоренная регистрация российских продуктов в NMPA.", descriptionZh: "双边医疗技术开发，专注于制药、医疗器械和远程医疗。俄罗斯产品快速通过NMPA审批。", investmentRange: "$2M - $50M", timeline: "2-4 years", status: "active" },
      { id: "bj-4", title: "Smart City Infrastructure Program", titleZh: "智慧城市基础设施项目", titleRu: "Программа инфраструктуры умного города", sector: "Smart City", description: "IoT sensors, 5G infrastructure, and urban AI management systems deployment across Beijing's new districts.", descriptionZh: "在北京新区部署物联网传感器、5G基础设施和城市人工智能管理系统。", descriptionRu: "Развёртывание IoT-датчиков, 5G-инфраструктуры и систем городского ИИ-управления в новых районах Пекина.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "upcoming" }
    ],
    keyProjects: [
      { id: "bj-p1", name: "Beijing Universal Studios Phase 2", nameRu: "Пекинская Юниверсал Студиос Фаза 2", nameZh: "北京环球影城二期", value: "$3.2 Billion", sector: "Tourism & Entertainment", description: "Expansion of the theme park with new attractions and hotels, seeking technology and content partners.", descriptionRu: "Расширение тематического парка с новыми аттракционами и отелями, поиск партнёров по технологиям и контенту.", descriptionZh: "主题公园扩建，新增景点和酒店，寻求技术和内容合作伙伴。", partners: ["Comcast NBCUniversal", "Beijing Tourism Group"], completionYear: "2028" },
      { id: "bj-p2", name: "Beijing-Moscow High-Speed Rail Link", nameRu: "Высокоскоростная магистраль Пекин-Москва", nameZh: "北京-莫斯科高速铁路", value: "$242 Billion", sector: "Infrastructure", description: "7,000km high-speed rail connecting capitals through Kazakhstan. Equipment supply and construction partnerships available.", descriptionRu: "Высокоскоростная железная дорога протяжённостью 7000 км, соединяющая столицы через Казахстан. Доступны партнёрства по поставке оборудования и строительству.", descriptionZh: "7000公里高速铁路，途经哈萨克斯坦连接两国首都。可提供设备供应和建设合作机会。", partners: ["China Railway", "Russian Railways"], completionYear: "2035" },
      { id: "bj-p3", name: "Zhongguancun Forum Tech Transfer", nameRu: "Трансфер технологий Форума Чжунгуаньцунь", nameZh: "中关村论坛技术转让", value: "$500 Million", sector: "Technology", description: "Annual funding for international tech commercialization projects, priority given to Russia-China joint ventures.", descriptionRu: "Ежегодное финансирование международных проектов коммерциализации технологий, приоритет отдаётся российско-китайским совместным предприятиям.", descriptionZh: "国际技术商业化项目年度资金，优先支持中俄合资企业。", completionYear: "Ongoing" }
    ],
    advantages: [
      { icon: "policy", title: "Political Hub", titleRu: "Политический центр", titleZh: "政治中心", description: "Direct access to central government ministries and policy-making bodies. First city to implement new national policies.", descriptionRu: "Прямой доступ к центральным государственным министерствам и органам принятия политических решений. Первый город, внедряющий новую национальную политику.", descriptionZh: "直接接触中央政府部委和决策机构。首个实施新国家政策的城市。" },
      { icon: "talent", title: "Top Talent Pool", titleRu: "Лучший кадровый потенциал", titleZh: "顶尖人才库", description: "Home to 92 universities including Tsinghua and Peking. 40% of China's AI researchers based here.", descriptionRu: "92 университета, включая Цинхуа и Пекинский. Здесь работают 40% исследователей ИИ Китая.", descriptionZh: "拥有92所大学，包括清华和北大。中国40%的人工智能研究人员在此工作。" },
      { icon: "tech", title: "R&D Capital", titleRu: "Столица НИОКР", titleZh: "研发之都", description: "Highest R&D spending in China at 6.5% of GDP. 30,000+ high-tech enterprises in Zhongguancun alone.", descriptionRu: "Самые высокие расходы на НИОКР в Китае — 6,5% ВВП. Только в Чжунгуаньцуне более 30 000 высокотехнологичных предприятий.", descriptionZh: "中国研发支出最高，占GDP的6.5%。仅中关村就有30,000多家高科技企业。" },
      { icon: "infrastructure", title: "Global Connectivity", titleRu: "Глобальная связь", titleZh: "全球连通性", description: "Two international airports with direct flights to all Russian major cities. High-speed rail hub.", descriptionRu: "Два международных аэропорта с прямыми рейсами во все крупные города России. Высокоскоростной железнодорожный узел.", descriptionZh: "两个国际机场，直飞俄罗斯所有主要城市。高铁枢纽。" }
    ],
    notableEntrepreneurs: [
      { name: "Lei Jun", nameZh: "雷军", nameRu: "Лэй Цзюнь", company: "Xiaomi", industry: "Consumer Electronics", netWorth: "$13.5B", description: "Founder of Xiaomi, one of world's largest smartphone makers. Pioneer of internet-based hardware business model.", descriptionRu: "Основатель Xiaomi, одного из крупнейших производителей смартфонов в мире. Пионер бизнес-модели аппаратного обеспечения на базе интернета.", descriptionZh: "小米创始人，全球最大智能手机制造商之一。互联网硬件商业模式的先驱。" },
      { name: "Robin Li", nameZh: "李彦宏", nameRu: "Робин Ли", company: "Baidu", industry: "AI & Search", netWorth: "$6.5B", description: "Co-founder of Baidu, China's dominant search engine. Leading investor in autonomous driving and AI research.", descriptionRu: "Сооснователь Baidu, доминирующей поисковой системы Китая. Ведущий инвестор в автономное вождение и исследования ИИ.", descriptionZh: "百度联合创始人，中国主导的搜索引擎。自动驾驶和人工智能研究的领先投资者。" },
      { name: "Zhang Yiming", nameZh: "张一鸣", nameRu: "Чжан Имин", company: "ByteDance", industry: "Social Media", netWorth: "$49.5B", description: "Founder of ByteDance (TikTok, Douyin). Created the world's most valuable startup and revolutionized short-form video.", descriptionRu: "Основатель ByteDance (TikTok, Douyin). Создал самый дорогой стартап в мире и совершил революцию в коротких видео.", descriptionZh: "字节跳动（TikTok、抖音）创始人。创建了全球最有价值的初创企业，革新了短视频行业。" },
      { name: "Wang Xing", nameZh: "王兴", nameRu: "Ван Син", company: "Meituan", industry: "E-commerce", netWorth: "$10.2B", description: "Founder of Meituan, China's largest local services platform. Dominates food delivery, hotel booking, and ride-hailing.", descriptionRu: "Основатель Meituan, крупнейшей платформы локальных услуг Китая. Доминирует в доставке еды, бронировании отелей и такси.", descriptionZh: "美团创始人，中国最大的本地生活服务平台。主导外卖、酒店预订和网约车市场。" }
    ],
    contactInfo: { investmentAgency: "Beijing Investment Promotion Bureau", investmentAgencyRu: "Пекинское бюро содействия инвестициям", investmentAgencyZh: "北京市投资促进局", website: "http://www.investbeijing.gov.cn", email: "invest@beijing.gov.cn", phone: "+86-10-55568888" }
  },
  "Shanghai": {
    name: "Shanghai",
    nameRu: "Шанхай",
    nameZh: "上海",
    gdp: "$670 Billion",
    population: "24.3 Million",
    industries: ["Finance", "International Trade", "Manufacturing", "Shipping"],
    industriesRu: ["Финансы", "Международная торговля", "Производство", "Судоходство"],
    industriesZh: ["金融", "国际贸易", "制造业", "航运"],
    sezCount: 4,
    taxBenefits: ["Free Trade Zone benefits", "15% CIT for qualified enterprises", "Import duty exemptions"],
    taxBenefitsRu: ["Льготы зоны свободной торговли", "15% налог на прибыль для квалифицированных предприятий", "Освобождение от импортных пошлин"],
    taxBenefitsZh: ["自贸区优惠政策", "合格企业15%企业所得税", "进口关税减免"],
    majorCities: [
      { id: "pudong", name: "Pudong New Area", nameRu: "Новый район Пудун", nameZh: "浦东新区", population: "5.5M", lat: 31.2231, lng: 121.5440, image: "https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?w=1920&q=80", description: "China's financial powerhouse - home to Lujiazui financial district, Shanghai Stock Exchange, and Zhangjiang Hi-Tech Park. The Lingang Free Trade Zone offers unprecedented foreign investment openness.", descriptionRu: "Финансовый центр Китая — здесь расположены финансовый район Луцзяцзуй, Шанхайская фондовая биржа и Высокотехнологичный парк Чжанцзян. Зона свободной торговли Линьган предлагает беспрецедентную открытость для иностранных инвестиций.", descriptionZh: "中国的金融重镇——陆家嘴金融区、上海证券交易所和张江高科技园区所在地。临港自贸区为外国投资提供了前所未有的开放政策。", opportunities: [
        { id: "pd-1", title: "Lujiazui Financial Services", titleZh: "陆家嘴金融服务", titleRu: "Финансовые услуги Луцзяцзуй", sector: "Finance", description: "Establish securities, asset management, or insurance operations in China's Wall Street. Full foreign ownership now permitted.", descriptionZh: "在中国的华尔街设立证券、资产管理或保险业务。现已允许外资全资控股。", descriptionRu: "Создание операций по ценным бумагам, управлению активами или страхованию на китайской Уолл-стрит. Разрешено полное иностранное владение.", investmentRange: "$30M - $200M", timeline: "1-2 years", status: "priority" },
        { id: "pd-2", title: "Zhangjiang Semiconductor Hub", titleZh: "张江半导体中心", titleRu: "Полупроводниковый хаб Чжанцзян", sector: "Semiconductor", description: "IC design and manufacturing facilities with talent from SMIC, Huawei HiSilicon. Equipment import duty-free.", descriptionZh: "集成电路设计和制造设施，拥有来自中芯国际、华为海思的人才。设备进口免税。", descriptionRu: "Проектирование и производство ИС с талантами из SMIC и Huawei HiSilicon. Беспошлинный импорт оборудования.", investmentRange: "$50M - $500M", timeline: "2-4 years", status: "priority" },
        { id: "pd-3", title: "Lingang New Energy Vehicle Park", titleZh: "临港新能源汽车园区", titleRu: "Парк электромобилей Линьган", sector: "EV", description: "EV component manufacturing near Tesla Gigafactory. Supplier qualification assistance available.", descriptionZh: "靠近特斯拉超级工厂的电动汽车零部件制造。提供供应商资质认证协助。", descriptionRu: "Производство компонентов электромобилей рядом с гигафабрикой Tesla. Доступна помощь в квалификации поставщиков.", investmentRange: "$20M - $100M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "huangpu", name: "Huangpu District", nameRu: "Район Хуанпу", nameZh: "黄浦区", population: "0.7M", lat: 31.2304, lng: 121.4737, image: "https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=1920&q=80", description: "The historic Bund and Nanjing Road - Shanghai's most prestigious address. Premium retail, hospitality, and luxury brands. Shanghai's original commercial center.", descriptionRu: "Историческая набережная Банд и улица Нанкин — самый престижный адрес Шанхая. Премиальная розничная торговля, гостиничный бизнес и люксовые бренды. Исторический коммерческий центр Шанхая.", descriptionZh: "历史悠久的外滩和南京路——上海最负盛名的地段。高端零售、酒店业和奢侈品牌。上海最早的商业中心。", opportunities: [
        { id: "hp-1", title: "The Bund Luxury Retail", titleZh: "外滩奢侈品零售", titleRu: "Люксовый ритейл на набережной Банд", sector: "Retail", description: "Flagship stores on China's most famous shopping street. Russian luxury brands seeking China entry.", descriptionZh: "在中国最著名的购物街开设旗舰店。俄罗斯奢侈品牌寻求进入中国市场。", descriptionRu: "Флагманские магазины на самой известной торговой улице Китая. Российские люксовые бренды, стремящиеся выйти на китайский рынок.", investmentRange: "$10M - $50M", timeline: "1-2 years", status: "active" },
        { id: "hp-2", title: "Historic Building Hospitality", titleZh: "历史建筑酒店业", titleRu: "Гостиничный бизнес в исторических зданиях", sector: "Hospitality", description: "Boutique hotels and restaurants in protected heritage buildings. Premium tourism segment.", descriptionZh: "在受保护的历史建筑中开设精品酒店和餐厅。高端旅游市场。", descriptionRu: "Бутик-отели и рестораны в охраняемых исторических зданиях. Премиальный туристический сегмент.", investmentRange: "$20M - $80M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "jing-an", name: "Jing'an District", nameRu: "Район Цзинъань", nameZh: "静安区", population: "1.1M", image: "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=1920&q=80", description: "Shanghai's tech and creative hub - headquarters of many internet companies, creative agencies, and innovation centers. Excellent transport and lifestyle amenities.", descriptionRu: "Технологический и креативный центр Шанхая — штаб-квартиры многих интернет-компаний, креативных агентств и инновационных центров. Отличная транспортная доступность и инфраструктура для жизни.", descriptionZh: "上海的科技和创意中心——众多互联网公司、创意机构和创新中心的总部所在地。交通便利，生活设施完善。", opportunities: [
        { id: "ja-1", title: "Tech Company Regional HQ", titleZh: "科技公司区域总部", titleRu: "Региональная штаб-квартира техкомпании", sector: "Technology", description: "Establish Asia-Pacific headquarters for Russian tech companies. Access to China's digital ecosystem.", descriptionZh: "为俄罗斯科技公司设立亚太总部。接入中国数字生态系统。", descriptionRu: "Создание азиатско-тихоокеанских штаб-квартир для российских технологических компаний. Доступ к цифровой экосистеме Китая.", investmentRange: "$5M - $30M", timeline: "1 year", status: "active" },
        { id: "ja-2", title: "Creative Industry Incubator", titleZh: "创意产业孵化器", titleRu: "Инкубатор креативных индустрий", sector: "Creative", description: "Design, gaming, and digital content studios. Strong local talent pool and government subsidies.", descriptionZh: "设计、游戏和数字内容工作室。强大的本地人才库和政府补贴。", descriptionRu: "Студии дизайна, гейминга и цифрового контента. Сильный местный кадровый резерв и государственные субсидии.", investmentRange: "$2M - $15M", timeline: "1-2 years", status: "upcoming" }
      ]}
    ],
    overview: "China's financial capital and largest port city. Shanghai leads in international trade, financial services, and advanced manufacturing. The Lingang Free Trade Zone offers unprecedented openness for foreign investment with relaxed foreign ownership restrictions.",
    overviewRu: "Финансовая столица Китая и крупнейший портовый город. Шанхай лидирует в международной торговле, финансовых услугах и передовом производстве. Зона свободной торговли Линьган предлагает беспрецедентную открытость для иностранных инвестиций со смягчёнными ограничениями на иностранное владение.",
    overviewZh: "中国的金融中心和最大的港口城市。上海在国际贸易、金融服务和先进制造业方面处于领先地位。临港自贸区为外国投资提供了前所未有的开放政策，放宽了外资所有权限制。",
    targetSectors: ["Financial Services", "Semiconductor & IC", "Biomedicine", "Smart Manufacturing", "International Trade"],
    opportunities: [
      { id: "sh-1", title: "Lingang New Area Semiconductor Cluster", titleZh: "临港新片区半导体集群", titleRu: "Полупроводниковый кластер Линьган", sector: "Semiconductor", description: "Build fabs and IC design centers in China's most open semiconductor zone. Full foreign ownership allowed, 15% CIT for 5 years, equipment import duty-free.", descriptionZh: "在中国最开放的半导体区建设晶圆厂和集成电路设计中心。允许外资全资控股，5年15%企业所得税，设备进口免税。", descriptionRu: "Строительство фабов и центров проектирования ИС в самой открытой полупроводниковой зоне Китая. Разрешено полное иностранное владение, 15% налога на 5 лет, беспошлинный импорт оборудования.", investmentRange: "$100M - $2B", timeline: "3-5 years", status: "priority" },
      { id: "sh-2", title: "Shanghai International Financial Center", titleZh: "上海国际金融中心", titleRu: "Шанхайский международный финансовый центр", sector: "Finance", description: "Establish wholly foreign-owned securities, insurance, or asset management firms. Access to STAR Market listing, Cross-border RMB settlement, and Shanghai-London Stock Connect.", descriptionZh: "设立全外资证券、保险或资产管理公司。可上市科创板、跨境人民币结算和沪伦通。", descriptionRu: "Создание полностью иностранных компаний по ценным бумагам, страхованию или управлению активами. Доступ к листингу на STAR Market, трансграничным расчётам в юанях и Шанхай-Лондон Stock Connect.", investmentRange: "$50M - $500M", timeline: "1-2 years", status: "active" },
      { id: "sh-3", title: "Zhangjiang Biomedical Innovation Park", titleZh: "张江生物医药创新园", titleRu: "Биомедицинский инновационный парк Чжанцзян", sector: "Biotech", description: "R&D facilities for drug development with accelerated clinical trial approvals. 400+ biotech companies, CRO services, and hospital partnerships.", descriptionZh: "药物研发设施，享有临床试验加速审批。400多家生物技术公司、CRO服务和医院合作。", descriptionRu: "Объекты R&D для разработки лекарств с ускоренным одобрением клинических испытаний. 400+ биотехнологических компаний, CRO-услуги и партнёрства с больницами.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" },
      { id: "sh-4", title: "Yangshan Deep-Water Port Logistics", titleZh: "洋山深水港物流", titleRu: "Логистика глубоководного порта Яншань", sector: "Logistics", description: "Automated container terminal operations and cold chain logistics for Russia-China trade. Direct shipping lanes to Vladivostok and St. Petersburg.", descriptionZh: "自动化集装箱码头运营和中俄贸易冷链物流。直达符拉迪沃斯托克和圣彼得堡的航线。", descriptionRu: "Автоматизированные контейнерные терминалы и холодная логистика для российско-китайской торговли. Прямые судоходные линии во Владивосток и Санкт-Петербург.", investmentRange: "$20M - $300M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "sh-p1", name: "Tesla Gigafactory Shanghai Expansion", nameRu: "Расширение гигафабрики Tesla в Шанхае", nameZh: "特斯拉上海超级工厂扩建", value: "$1.2 Billion", sector: "EV Manufacturing", description: "Supplier opportunities for battery components, motors, and software systems.", descriptionRu: "Возможности для поставщиков аккумуляторных компонентов, двигателей и программных систем.", descriptionZh: "电池组件、电机和软件系统的供应商机会。", partners: ["Tesla", "CATL"], completionYear: "2026" },
      { id: "sh-p2", name: "Shanghai STAR Market Technology Fund", nameRu: "Шанхайский технологический фонд STAR Market", nameZh: "上海科创板科技基金", value: "$15 Billion", sector: "Venture Capital", description: "Government-backed fund for tech IPOs. Co-investment opportunities for qualified foreign investors.", descriptionRu: "Государственный фонд для технологических IPO. Возможности совместного инвестирования для квалифицированных иностранных инвесторов.", descriptionZh: "政府支持的科技IPO基金。为合格外国投资者提供共同投资机会。", completionYear: "Ongoing" },
      { id: "sh-p3", name: "China International Import Expo (CIIE) Permanent Platform", nameRu: "Постоянная платформа Китайской международной импортной выставки (CIIE)", nameZh: "中国国际进口博览会常设平台", value: "$2 Billion", sector: "Trade", description: "Year-round exhibition and trading platform for Russian exporters. Preferential customs and certification for CIIE participants.", descriptionRu: "Круглогодичная выставочная и торговая платформа для российских экспортёров. Преференциальное таможенное оформление и сертификация для участников CIIE.", descriptionZh: "为俄罗斯出口商提供的全年展览和贸易平台。进博会参展商享有优惠通关和认证。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "market", title: "Financial Hub", titleRu: "Финансовый центр", titleZh: "金融中心", description: "China's Wall Street with Shanghai Stock Exchange, 1,600+ financial institutions, and RMB internationalization center.", descriptionRu: "Китайская Уолл-стрит с Шанхайской фондовой биржей, более 1600 финансовых учреждений и центр интернационализации юаня.", descriptionZh: "中国的华尔街，拥有上海证券交易所、1600多家金融机构和人民币国际化中心。" },
      { icon: "logistics", title: "World's Busiest Port", titleRu: "Самый загруженный порт мира", titleZh: "世界最繁忙港口", description: "Shanghai Port handles 47 million TEU annually. Direct shipping to all Russian ports.", descriptionRu: "Шанхайский порт обрабатывает 47 миллионов TEU ежегодно. Прямые рейсы во все российские порты.", descriptionZh: "上海港年处理量达4700万标准箱。直达所有俄罗斯港口的航线。" },
      { icon: "policy", title: "Most Open FTZ", titleRu: "Самая открытая ЗСТ", titleZh: "最开放的自贸区", description: "Lingang allows full foreign ownership in more sectors than anywhere else in China.", descriptionRu: "Линьган разрешает полное иностранное владение в большем количестве секторов, чем где-либо ещё в Китае.", descriptionZh: "临港在更多行业允许外资全资控股，开放程度超过中国其他任何地区。" },
      { icon: "infrastructure", title: "Premium Infrastructure", titleRu: "Первоклассная инфраструктура", titleZh: "优质基础设施", description: "Maglev train, two airports, extensive metro, and 5G coverage throughout the city.", descriptionRu: "Поезд на магнитной подушке, два аэропорта, разветвлённое метро и покрытие 5G по всему городу.", descriptionZh: "磁悬浮列车、两座机场、发达的地铁网络和全城5G覆盖。" }
    ],
    notableEntrepreneurs: [
      { name: "Colin Huang", nameZh: "黄峥", nameRu: "Колин Хуан", company: "Pinduoduo", industry: "E-commerce", netWorth: "$38.9B", description: "Founder of Pinduoduo, revolutionized social e-commerce. China's third-largest online marketplace.", descriptionRu: "Основатель Pinduoduo, совершил революцию в социальной электронной коммерции. Третья по величине онлайн-площадка Китая.", descriptionZh: "拼多多创始人，革新了社交电商模式。中国第三大在线购物平台。" },
      { name: "Jiang Bin", nameZh: "蒋滨", nameRu: "Цзян Бинь", company: "QuantumScape", industry: "Battery Technology", netWorth: "$2.1B", description: "Pioneering solid-state battery technology for next-generation electric vehicles.", descriptionRu: "Пионер технологии твердотельных аккумуляторов для электромобилей нового поколения.", descriptionZh: "开创下一代电动汽车固态电池技术的先驱。" },
      { name: "Richard Liu", nameZh: "刘强东", nameRu: "Ричард Лю", company: "JD.com", industry: "E-commerce & Logistics", netWorth: "$12.8B", description: "Founder of JD.com, China's largest direct-sales retailer. Built world-class logistics infrastructure.", descriptionRu: "Основатель JD.com, крупнейшего в Китае ритейлера прямых продаж. Создал логистическую инфраструктуру мирового класса.", descriptionZh: "京东创始人，中国最大的直销零售商。建立了世界级的物流基础设施。" }
    ],
    contactInfo: { investmentAgency: "Shanghai Municipal Commission of Commerce", investmentAgencyRu: "Шанхайская муниципальная комиссия по торговле", investmentAgencyZh: "上海市商务委员会", website: "http://www.investment.gov.cn", email: "invest@shanghai.gov.cn", phone: "+86-21-62752200" }
  },
  "Guangdong": {
    name: "Guangdong",
    nameRu: "Гуандун",
    nameZh: "广东",
    gdp: "$1.96 Trillion",
    population: "126 Million",
    industries: ["Electronics", "Manufacturing", "Export Trade", "Technology"],
    industriesRu: ["Электроника", "Производство", "Экспортная торговля", "Технологии"],
    industriesZh: ["电子", "制造业", "出口贸易", "科技"],
    sezCount: 6,
    taxBenefits: ["Shenzhen SEZ incentives", "15% CIT for high-tech", "Greater Bay Area benefits"],
    taxBenefitsRu: ["Льготы ОЭЗ Шэньчжэнь", "15% налог на прибыль для высокотехнологичных предприятий", "Льготы района Большого залива"],
    taxBenefitsZh: ["深圳经济特区优惠", "高新技术企业15%企业所得税", "粤港澳大湾区优惠"],
    majorCities: [
      { id: "guangzhou", name: "Guangzhou", nameRu: "Гуанчжоу", nameZh: "广州", population: "18.7M", image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1920&q=80", description: "South China's commercial capital and Canton Fair host city. Major hub for automotive, trade, and logistics. Gateway to the Greater Bay Area with excellent connectivity.", opportunities: [
        { id: "gz-1", title: "Canton Fair Permanent Exhibition", titleZh: "广交会常设展馆", titleRu: "Постоянная выставка Кантонской ярмарки", sector: "Trade", description: "Year-round exhibition space at world's largest trade fair. Priority access for Russian exporters.", descriptionZh: "在世界最大贸易展会上的全年展览空间。俄罗斯出口商优先入驻。", descriptionRu: "Круглогодичное выставочное пространство на крупнейшей в мире торговой ярмарке. Приоритетный доступ для российских экспортёров.", investmentRange: "$5M - $30M", timeline: "1-2 years", status: "priority" },
        { id: "gz-2", title: "Guangzhou Auto Parts Cluster", titleZh: "广州汽车零部件集群", titleRu: "Кластер автокомпонентов Гуанчжоу", sector: "Automotive", description: "Tier 1/2 supplier facilities near GAC, Honda, Toyota, and Nissan assembly plants.", descriptionZh: "靠近广汽、本田、丰田和日产装配厂的一级/二级供应商设施。", descriptionRu: "Объекты поставщиков Tier 1/2 рядом со сборочными заводами GAC, Honda, Toyota и Nissan.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
        { id: "gz-3", title: "Nansha International Logistics Hub", titleZh: "南沙国际物流中心", titleRu: "Международный логистический хаб Наньша", sector: "Logistics", description: "Bonded warehousing and distribution center for Russia-China trade. Cold chain facilities available.", descriptionZh: "中俄贸易保税仓储和配送中心。提供冷链设施。", descriptionRu: "Таможенное складирование и распределительный центр для российско-китайской торговли. Доступны холодильные мощности.", investmentRange: "$15M - $100M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "shenzhen", name: "Shenzhen", nameRu: "Шэньчжэнь", nameZh: "深圳", population: "17.6M", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80", description: "Global hardware capital and home to Huawei, Tencent, BYD, and DJI. World-leading electronics manufacturing ecosystem with same-day prototyping capabilities. China's most innovative city.", opportunities: [
        { id: "sz-1", title: "Huaqiangbei Electronics Hub", titleZh: "华强北电子市场", titleRu: "Электронный хаб Хуацянбэй", sector: "Electronics", description: "World's largest electronics market - source components or establish trading operations. Instant access to any electronic part.", descriptionZh: "世界最大的电子市场——采购元器件或建立贸易业务。即时获取任何电子零部件。", descriptionRu: "Крупнейший в мире электронный рынок — закупка компонентов или торговые операции. Мгновенный доступ к любым электронным деталям.", investmentRange: "$1M - $20M", timeline: "6-12 months", status: "active" },
        { id: "sz-2", title: "Shenzhen Hardware Accelerator", titleZh: "深圳硬件加速器", titleRu: "Аппаратный акселератор Шэньчжэня", sector: "Hardware", description: "Bring hardware products from prototype to mass production. Access to 10,000+ component suppliers within 1 hour.", descriptionZh: "将硬件产品从原型推向量产。1小时内可接触10,000多家元器件供应商。", descriptionRu: "От прототипа до массового производства аппаратных продуктов. Доступ к 10 000+ поставщикам компонентов в радиусе 1 часа.", investmentRange: "$500K - $10M", timeline: "6-18 months", status: "priority" },
        { id: "sz-3", title: "Qianhai Fintech Zone", titleZh: "前海金融科技区", titleRu: "Финтех-зона Цяньхай", sector: "Fintech", description: "Cross-border fintech operations with RMB settlement capabilities. Blockchain and digital currency pilots.", descriptionZh: "跨境金融科技业务，支持人民币结算。区块链和数字货币试点。", descriptionRu: "Трансграничные финтех-операции с возможностью расчётов в юанях. Пилоты блокчейна и цифровых валют.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "sz-4", title: "BYD EV Supply Partnership", titleZh: "比亚迪电动汽车供应合作", titleRu: "Партнёрство с BYD по поставкам для электромобилей", sector: "EV", description: "Direct supplier partnerships with world's largest EV company. Battery, motors, and software components.", descriptionZh: "与全球最大电动汽车公司直接建立供应商合作关系。电池、电机和软件组件。", descriptionRu: "Прямое партнёрство с крупнейшим в мире производителем электромобилей. Аккумуляторы, моторы и программные компоненты.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" }
      ]},
      { id: "dongguan", name: "Dongguan", nameRu: "Дунгуань", nameZh: "东莞", population: "10.5M", image: "https://images.unsplash.com/photo-1553697388-94e804e2f0f6?w=1920&q=80", description: "World's factory floor - the manufacturing powerhouse producing everything from electronics to furniture. Undergoing Industry 4.0 transformation with government subsidies for automation.", opportunities: [
        { id: "dg-1", title: "Smart Factory Transformation", titleZh: "智能工厂升级改造", titleRu: "Трансформация в умные фабрики", sector: "Manufacturing", description: "Upgrade 10,000+ factories with robotics and IoT. Government subsidizes 30% of automation costs.", descriptionZh: "为10,000多家工厂进行机器人和物联网升级。政府补贴30%的自动化成本。", descriptionRu: "Модернизация 10 000+ фабрик с помощью робототехники и IoT. Государство субсидирует 30% затрат на автоматизацию.", investmentRange: "$2M - $30M", timeline: "1-2 years", status: "priority" },
        { id: "dg-2", title: "Contract Manufacturing Partnership", titleZh: "代工制造合作", titleRu: "Партнёрство по контрактному производству", sector: "Manufacturing", description: "OEM/ODM partnerships for consumer products. Furniture, toys, electronics, textiles expertise.", descriptionZh: "消费品OEM/ODM合作。家具、玩具、电子产品、纺织品专业制造。", descriptionRu: "OEM/ODM партнёрства по потребительским товарам. Экспертиза в мебели, игрушках, электронике, текстиле.", investmentRange: "$1M - $20M", timeline: "6-12 months", status: "active" },
        { id: "dg-3", title: "Huawei Songshan Lake Campus", titleZh: "华为松山湖园区", titleRu: "Кампус Huawei Суншань Лейк", sector: "Technology", description: "R&D facilities near Huawei's spectacular European-style headquarters. Tech supplier opportunities.", descriptionZh: "靠近华为壮观欧式总部的研发设施。科技供应商机会。", descriptionRu: "Объекты R&D рядом со впечатляющей европейской штаб-квартирой Huawei. Возможности для техно-поставщиков.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "China's richest province and the heart of the Greater Bay Area - a megalopolis rivaling Tokyo and New York. Shenzhen is the global hardware capital; Guangzhou is a trade hub; Dongguan is the world's factory floor. Combined, they form an unmatched manufacturing and innovation ecosystem.",
    overviewRu: "Богатейшая провинция Китая и сердце района Большого залива — мегаполиса, соперничающего с Токио и Нью-Йорком. Шэньчжэнь — мировая столица электроники; Гуанчжоу — торговый хаб; Дунгуань — мировая фабрика. Вместе они образуют непревзойдённую производственную и инновационную экосистему.",
    overviewZh: "中国最富裕的省份，也是粤港澳大湾区的核心——这个超级都市群可与东京和纽约媲美。深圳是全球硬件之都；广州是贸易中心；东莞是世界工厂。它们共同构成了无与伦比的制造和创新生态系统。",
    targetSectors: ["Consumer Electronics", "5G & Telecom", "Electric Vehicles", "Smart Manufacturing", "Cross-border E-commerce"],
    targetSectorsRu: ["Потребительская электроника", "5G и телекоммуникации", "Электромобили", "Умное производство", "Трансграничная электронная коммерция"],
    targetSectorsZh: ["消费电子", "5G与电信", "电动汽车", "智能制造", "跨境电商"],
    opportunities: [
      { id: "gd-1", title: "Greater Bay Area Tech Corridor", titleZh: "粤港澳大湾区科技走廊", titleRu: "Технологический коридор Большого залива", sector: "Technology", description: "R&D centers with access to Huawei, Tencent, BYD, and DJI ecosystems. Shenzhen-Hong Kong-Macau innovation triangle participation.", descriptionZh: "可接入华为、腾讯、比亚迪和大疆生态系统的研发中心。参与深港澳创新三角。", descriptionRu: "R&D-центры с доступом к экосистемам Huawei, Tencent, BYD и DJI. Участие в инновационном треугольнике Шэньчжэнь-Гонконг-Макао.", investmentRange: "$5M - $200M", timeline: "1-3 years", status: "priority" },
      { id: "gd-2", title: "Dongguan Smart Factory Transformation", titleZh: "东莞智能工厂转型", titleRu: "Трансформация умных фабрик Дунгуаня", sector: "Manufacturing", description: "Industry 4.0 upgrades for 10,000+ factories. Robotics, IoT, and AI integration opportunities. Government subsidizes 30% of upgrade costs.", descriptionZh: "为10,000多家工厂进行工业4.0升级。机器人、物联网和人工智能集成机会。政府补贴30%升级成本。", descriptionRu: "Модернизация Индустрии 4.0 для 10 000+ фабрик. Возможности интеграции робототехники, IoT и ИИ. Государство субсидирует 30% затрат.", investmentRange: "$2M - $50M", timeline: "1-2 years", status: "active" },
      { id: "gd-3", title: "Qianhai Shenzhen-Hong Kong Cooperation Zone", titleZh: "前海深港合作区", titleRu: "Зона сотрудничества Цяньхай Шэньчжэнь-Гонконг", sector: "Finance & Services", description: "Professional services, fintech, and cross-border business zone. HK-style tax regime (15% CIT), RMB cross-border lending.", descriptionZh: "专业服务、金融科技和跨境商务区。香港式税制（15%企业所得税），跨境人民币贷款。", descriptionRu: "Зона профессиональных услуг, финтеха и трансграничного бизнеса. Гонконгский налоговый режим (15% налога), трансграничное кредитование в юанях.", investmentRange: "$10M - $100M", timeline: "1-2 years", status: "active" },
      { id: "gd-4", title: "BYD EV Supply Chain Cluster", titleZh: "比亚迪电动汽车供应链集群", titleRu: "Кластер цепочки поставок электромобилей BYD", sector: "Electric Vehicles", description: "Tier 1/2 supplier opportunities for world's largest EV manufacturer. Battery materials, motors, electronics, and software.", descriptionZh: "为全球最大电动汽车制造商提供一级/二级供应商机会。电池材料、电机、电子设备和软件。", descriptionRu: "Возможности поставщиков Tier 1/2 для крупнейшего в мире производителя электромобилей. Материалы для батарей, моторы, электроника и ПО.", investmentRange: "$20M - $500M", timeline: "2-4 years", status: "priority" }
    ],
    keyProjects: [
      { id: "gd-p1", name: "Hong Kong-Zhuhai-Macau Bridge Economic Zone", nameRu: "Экономическая зона моста Гонконг-Чжухай-Макао", nameZh: "港珠澳大桥经济区", value: "$20 Billion", sector: "Infrastructure", description: "Development zones around the 55km sea bridge. Logistics, tourism, and tech park opportunities.", descriptionRu: "Зоны развития вокруг 55-километрового морского моста. Возможности в логистике, туризме и технопарках.", descriptionZh: "围绕55公里跨海大桥的开发区。物流、旅游和科技园区机会。", partners: ["HKSAR Government", "Macau SAR"], completionYear: "2030" },
      { id: "gd-p2", name: "Huawei Dongguan Campus Expansion", nameRu: "Расширение кампуса Huawei в Дунгуане", nameZh: "华为东莞园区扩建", value: "$1.5 Billion", sector: "Technology", description: "Supply chain and R&D partnership opportunities with Huawei's European-style headquarters.", descriptionRu: "Возможности партнёрства в цепочке поставок и R&D с европейской штаб-квартирой Huawei.", descriptionZh: "与华为欧式总部的供应链和研发合作机会。", partners: ["Huawei"], completionYear: "2026" },
      { id: "gd-p3", name: "Guangzhou Nansha International AI Island", nameRu: "Международный остров ИИ Наньша в Гуанчжоу", nameZh: "广州南沙国际人工智能岛", value: "$3 Billion", sector: "AI", description: "1,000-company AI cluster with compute infrastructure and talent programs.", descriptionRu: "Кластер из 1000 ИИ-компаний с вычислительной инфраструктурой и программами для талантов.", descriptionZh: "拥有计算基础设施和人才计划的1000家企业人工智能集群。", completionYear: "2028" }
    ],
    advantages: [
      { icon: "market", title: "China's Richest Province", titleRu: "Богатейшая провинция Китая", titleZh: "中国最富裕的省份", description: "GDP exceeds South Korea. 126 million consumers with highest disposable income in China.", descriptionRu: "ВВП превышает Южную Корею. 126 миллионов потребителей с самым высоким располагаемым доходом в Китае.", descriptionZh: "GDP超过韩国。1.26亿消费者拥有中国最高的可支配收入。" },
      { icon: "infrastructure", title: "Manufacturing Paradise", titleRu: "Производственный рай", titleZh: "制造业天堂", description: "Complete supply chain for electronics within 100km. Same-day prototyping in Shenzhen.", descriptionRu: "Полная цепочка поставок электроники в радиусе 100 км. Прототипирование в тот же день в Шэньчжэне.", descriptionZh: "100公里内完整的电子产品供应链。深圳当日原型制作。" },
      { icon: "logistics", title: "Export Gateway", titleRu: "Экспортные ворота", titleZh: "出口门户", description: "Guangzhou Port, Shenzhen Port, and Hong Kong Port handle 25% of China's trade.", descriptionRu: "Порты Гуанчжоу, Шэньчжэня и Гонконга обрабатывают 25% торговли Китая.", descriptionZh: "广州港、深圳港和香港港处理中国25%的贸易。" },
      { icon: "tech", title: "Innovation Powerhouse", titleRu: "Инновационный центр", titleZh: "创新强省", description: "Home to Huawei, Tencent, BYD, DJI, OPPO, Vivo. More PCT patents than most countries.", descriptionRu: "Родина Huawei, Tencent, BYD, DJI, OPPO, Vivo. Больше патентов PCT, чем у большинства стран.", descriptionZh: "华为、腾讯、比亚迪、大疆、OPPO、Vivo的总部所在地。PCT专利数量超过大多数国家。" }
    ],
    notableEntrepreneurs: [
      { name: "Ma Huateng (Pony Ma)", nameZh: "马化腾", nameRu: "Ма Хуатэн", company: "Tencent", industry: "Technology & Gaming", netWorth: "$39.5B", description: "Co-founder of Tencent, operator of WeChat and world's largest gaming company. Pioneer of China's internet ecosystem.", descriptionRu: "Сооснователь Tencent, оператора WeChat и крупнейшей в мире игровой компании. Пионер интернет-экосистемы Китая.", descriptionZh: "腾讯联合创始人，微信和全球最大游戏公司的运营者。中国互联网生态系统的先驱。" },
      { name: "Ren Zhengfei", nameZh: "任正非", nameRu: "Жэнь Чжэнфэй", company: "Huawei", industry: "Telecommunications", netWorth: "$1.9B", description: "Founder of Huawei, world's largest telecom equipment maker. Built from military background to global tech giant.", descriptionRu: "Основатель Huawei, крупнейшего в мире производителя телекоммуникационного оборудования. Прошёл путь от военного до главы глобального технологического гиганта.", descriptionZh: "华为创始人，全球最大电信设备制造商。从军人背景发展成为全球科技巨头。" },
      { name: "Wang Chuanfu", nameZh: "王传福", nameRu: "Ван Чуаньфу", company: "BYD", industry: "Electric Vehicles", netWorth: "$18.7B", description: "Founder of BYD, world's largest EV manufacturer. Warren Buffett-backed battery and automotive pioneer.", descriptionRu: "Основатель BYD, крупнейшего в мире производителя электромобилей. Пионер в области аккумуляторов и автомобилестроения, поддержанный Уорреном Баффетом.", descriptionZh: "比亚迪创始人，全球最大电动汽车制造商。沃伦·巴菲特支持的电池和汽车行业先驱。" },
      { name: "Frank Wang", nameZh: "汪滔", nameRu: "Ван Тао", company: "DJI", industry: "Drones", netWorth: "$4.8B", description: "Founder of DJI, controls 70% of global consumer drone market. Started in Hong Kong dorm room.", descriptionRu: "Основатель DJI, контролирующей 70% мирового рынка потребительских дронов. Начал бизнес в общежитии Гонконга.", descriptionZh: "大疆创始人，控制全球70%的消费级无人机市场。从香港宿舍起步创业。" },
      { name: "He Xiaopeng", nameZh: "何小鹏", nameRu: "Хэ Сяопэн", company: "XPeng", industry: "Electric Vehicles", netWorth: "$3.2B", description: "Co-founder of XPeng Motors, leading Chinese EV and autonomous driving startup.", descriptionRu: "Сооснователь XPeng Motors, ведущего китайского стартапа в области электромобилей и автономного вождения.", descriptionZh: "小鹏汽车联合创始人，中国领先的电动汽车和自动驾驶初创企业。" }
    ],
    contactInfo: { investmentAgency: "Guangdong Provincial Department of Commerce", investmentAgencyRu: "Департамент коммерции провинции Гуандун", investmentAgencyZh: "广东省商务厅", website: "http://com.gd.gov.cn", email: "invest@gd.gov.cn", phone: "+86-20-38819912" }
  },
  "Jiangsu": {
    name: "Jiangsu",
    nameRu: "Цзянсу",
    nameZh: "江苏",
    gdp: "$1.88 Trillion",
    population: "85 Million",
    industries: ["Manufacturing", "Chemicals", "Textiles", "Electronics"],
    industriesRu: ["Производство", "Химическая промышленность", "Текстиль", "Электроника"],
    industriesZh: ["制造业", "化工", "纺织", "电子"],
    sezCount: 5,
    taxBenefits: ["Suzhou Industrial Park benefits", "Export processing zones", "High-tech park incentives"],
    taxBenefitsRu: ["Льготы промышленного парка Сучжоу", "Зоны экспортной переработки", "Льготы высокотехнологичных парков"],
    taxBenefitsZh: ["苏州工业园区优惠", "出口加工区", "高新技术园区激励"],
    majorCities: [
      { id: "nanjing", name: "Nanjing", nameRu: "Нанкин", nameZh: "南京", population: "9.3M", image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=1920&q=80", description: "Historic capital of six dynasties and Jiangsu's provincial capital. Major center for education, research, and software development with 80+ universities and strong aerospace and automotive industries.", opportunities: [
        { id: "nj-1", title: "Nanjing Software Valley Expansion", titleZh: "南京软件谷扩展", titleRu: "Расширение Долины ПО Нанкина", sector: "Software", description: "China's second-largest software park. AI, cloud computing, and enterprise software development. 200,000+ IT professionals.", descriptionZh: "中国第二大软件园区。人工智能、云计算和企业软件开发。20万+IT专业人员。", descriptionRu: "Второй по величине софтверный парк Китая. ИИ, облачные вычисления и корпоративное ПО. 200 000+ ИТ-специалистов.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" },
        { id: "nj-2", title: "Jiangbei New Area Innovation Hub", titleZh: "江北新区创新中心", titleRu: "Инновационный хаб новой зоны Цзянбэй", sector: "Technology", description: "National-level new area focusing on integrated circuits, life sciences, and new finance. Generous tax incentives.", descriptionZh: "国家级新区，专注于集成电路、生命科学和新金融。优厚的税收优惠。", descriptionRu: "Национальная новая зона с фокусом на интегральные схемы, науки о жизни и новые финансы. Щедрые налоговые льготы.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "priority" },
        { id: "nj-3", title: "Aerospace & Defense Industrial Park", titleZh: "航空航天与国防工业园", titleRu: "Промышленный парк авиакосмической и оборонной отрасли", sector: "Aerospace", description: "Partnerships with AVIC and COMAC supply chain. Avionics, materials, and precision components.", descriptionZh: "与中航工业和中国商飞供应链合作。航空电子设备、材料和精密部件。", descriptionRu: "Партнёрства с цепочками поставок AVIC и COMAC. Авионика, материалы и прецизионные компоненты.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "suzhou", name: "Suzhou", nameRu: "Сучжоу", nameZh: "苏州", population: "12.7M", image: "https://images.unsplash.com/photo-1567253508485-0e0a4e3c4024?w=1920&q=80", description: "The Venice of the East - ancient gardens meet cutting-edge industry. Suzhou Industrial Park is China's most successful foreign investment zone with 5,000+ foreign enterprises and a 30-year track record.", opportunities: [
        { id: "sz-sip-1", title: "Suzhou Industrial Park Biotech Bay", titleZh: "苏州工业园区生物科技湾", titleRu: "Биотехнологический залив промпарка Сучжоу", sector: "Biotech", description: "Asia's premier biotech cluster with 500+ companies. Direct NMPA engagement, Cold Spring Harbor partnership.", descriptionZh: "亚洲顶级生物技术集群，拥有500多家企业。直接对接国家药监局，与冷泉港合作。", descriptionRu: "Ведущий биотехнологический кластер Азии с 500+ компаниями. Прямое взаимодействие с NMPA, партнёрство с Cold Spring Harbor.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "sz-sip-2", title: "Suzhou Nanotechnology Hub", titleZh: "苏州纳米技术中心", titleRu: "Центр нанотехнологий Сучжоу", sector: "Advanced Materials", description: "China's national nanotechnology center. Research partnerships and commercialization support.", descriptionZh: "中国国家纳米技术中心。研究合作和商业化支持。", descriptionRu: "Национальный центр нанотехнологий Китая. Исследовательские партнёрства и поддержка коммерциализации.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" },
        { id: "sz-sip-3", title: "Precision Manufacturing Cluster", titleZh: "精密制造集群", titleRu: "Кластер прецизионного производства", sector: "Manufacturing", description: "World-class precision machining and automation. Supply chain for semiconductor equipment, medical devices.", descriptionZh: "世界级精密加工和自动化。半导体设备和医疗器械供应链。", descriptionRu: "Прецизионная обработка и автоматизация мирового класса. Цепочка поставок для полупроводникового оборудования и медицинских устройств.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "wuxi", name: "Wuxi", nameRu: "Уси", nameZh: "无锡", population: "7.5M", image: "https://images.unsplash.com/photo-1598887142487-3c854d51d678?w=1920&q=80", description: "China's national IoT demonstration city and semiconductor base. Beautiful lakeside location with strong manufacturing tradition now transforming into high-tech hub.", opportunities: [
        { id: "wx-1", title: "Wuxi IoT Valley", titleZh: "无锡物联网谷", titleRu: "Долина IoT Уси", sector: "IoT", description: "China's largest IoT industrial base. Sensors, connectivity, and smart city applications. National demonstration zone.", descriptionZh: "中国最大的物联网产业基地。传感器、连接和智慧城市应用。国家示范区。", descriptionRu: "Крупнейшая в Китае промышленная база IoT. Датчики, связь и приложения умного города. Национальная демонстрационная зона.", investmentRange: "$5M - $100M", timeline: "1-3 years", status: "priority" },
        { id: "wx-2", title: "Integrated Circuit Design Center", titleZh: "集成电路设计中心", titleRu: "Центр проектирования интегральных схем", sector: "Semiconductor", description: "IC design services and fabless semiconductor companies. Partnership with local foundries.", descriptionZh: "集成电路设计服务和无晶圆厂半导体公司。与本地晶圆厂合作。", descriptionRu: "Услуги проектирования ИС и fabless полупроводниковые компании. Партнёрство с местными фабами.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
        { id: "wx-3", title: "New Energy Equipment Manufacturing", titleZh: "新能源设备制造", titleRu: "Производство оборудования для новой энергетики", sector: "Clean Energy", description: "Solar panel components, wind turbine parts, and energy storage systems manufacturing.", descriptionZh: "太阳能电池板组件、风力涡轮机部件和储能系统制造。", descriptionRu: "Производство компонентов солнечных панелей, деталей ветрогенераторов и систем хранения энергии.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "China's second-richest province and manufacturing powerhouse. Suzhou Industrial Park is the gold standard for foreign investment zones, home to 5,000+ foreign enterprises. Strong in precision manufacturing, chemicals, and increasingly in biotech and IC design.",
    targetSectors: ["Precision Manufacturing", "Biotech", "IC Design", "New Materials", "Advanced Chemicals"],
    opportunities: [
      { id: "js-1", title: "Suzhou Industrial Park Biotech Valley", titleZh: "苏州工业园区生物技术谷", titleRu: "Биотехнологическая долина промпарка Сучжоу", sector: "Biotech", description: "500+ biotech companies, world-class CRO/CDMO services, and direct NMPA engagement. Partnership with Cold Spring Harbor Laboratory.", descriptionZh: "500多家生物技术企业，世界级CRO/CDMO服务，直接对接国家药监局。与冷泉港实验室合作。", descriptionRu: "500+ биотех-компаний, услуги CRO/CDMO мирового класса и прямое взаимодействие с NMPA. Партнёрство с лабораторией Cold Spring Harbor.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "active" },
      { id: "js-2", title: "Wuxi IoT Innovation Center", titleZh: "无锡物联网创新中心", titleRu: "Инновационный центр IoT Уси", sector: "IoT", description: "China's national IoT demonstration zone. Sensor manufacturing, smart city applications, and industrial IoT platforms.", descriptionZh: "中国国家物联网示范区。传感器制造、智慧城市应用和工业物联网平台。", descriptionRu: "Национальная демонстрационная зона IoT Китая. Производство датчиков, приложения умного города и промышленные IoT-платформы.", investmentRange: "$5M - $100M", timeline: "1-3 years", status: "active" },
      { id: "js-3", title: "Nanjing Software Valley", titleZh: "南京软件谷", titleRu: "Долина ПО Нанкина", sector: "Software", description: "70,000+ software engineers, AI and cloud computing focus. Partnerships with Alibaba Cloud, Huawei Cloud available.", descriptionZh: "7万多名软件工程师，专注于人工智能和云计算。可与阿里云、华为云合作。", descriptionRu: "70 000+ инженеров-программистов, фокус на ИИ и облачных вычислениях. Доступны партнёрства с Alibaba Cloud и Huawei Cloud.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" },
      { id: "js-4", title: "Yangtze River Chemical Industry Transformation", titleZh: "长江化工产业转型", titleRu: "Трансформация химической промышленности Янцзы", sector: "Chemicals", description: "Green chemistry and specialty chemicals investment. Government relocating polluting plants, opening space for advanced chemical manufacturing.", descriptionZh: "绿色化学和特种化学品投资。政府搬迁污染工厂，为先进化工制造腾出空间。", descriptionRu: "Инвестиции в зелёную химию и специальные химикаты. Правительство переносит загрязняющие предприятия, открывая пространство для передового химического производства.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" }
    ],
    keyProjects: [
      { id: "js-p1", name: "Samsung Suzhou Semiconductor Expansion", nameRu: "Расширение полупроводникового производства Samsung в Сучжоу", nameZh: "三星苏州半导体扩建", value: "$8 Billion", sector: "Semiconductor", description: "NAND flash expansion creating massive supply chain opportunities.", partners: ["Samsung Electronics"], completionYear: "2027", descriptionRu: "Расширение производства NAND-флеш, создающее огромные возможности для цепочки поставок.", descriptionZh: "NAND闪存扩产，创造大量供应链机会。" },
      { id: "js-p2", name: "Jiangsu-Russia Science Park", nameRu: "Научный парк Цзянсу-Россия", nameZh: "江苏-俄罗斯科技园", value: "$200 Million", sector: "Technology", description: "Dedicated park for Russia-China tech transfer and joint ventures.", descriptionRu: "Специализированный парк для российско-китайского трансфера технологий и совместных предприятий.", descriptionZh: "专门用于中俄技术转让和合资企业的园区。", completionYear: "2026" }
    ],
    advantages: [
      { icon: "infrastructure", title: "Premium Industrial Parks", titleRu: "Премиальные индустриальные парки", titleZh: "优质工业园区", description: "Suzhou Industrial Park is China's most successful FDI zone with 30-year track record.", descriptionRu: "Промышленный парк Сучжоу — самая успешная зона ПИИ в Китае с 30-летней историей.", descriptionZh: "苏州工业园区是中国最成功的外商直接投资区，拥有30年的成功经验。" },
      { icon: "talent", title: "Engineering Talent", titleRu: "Инженерные кадры", titleZh: "工程人才", description: "167 universities, strong vocational training. Reliable skilled labor supply.", descriptionRu: "167 университетов, развитое профессиональное обучение. Надёжное предложение квалифицированной рабочей силы.", descriptionZh: "167所大学，职业培训体系完善。技术工人供应可靠。" },
      { icon: "logistics", title: "Yangtze Delta Location", titleRu: "Расположение в дельте Янцзы", titleZh: "长三角区位", description: "2 hours to Shanghai by high-speed rail. Excellent river and sea port access.", descriptionRu: "2 часа до Шанхая на скоростном поезде. Отличный доступ к речным и морским портам.", descriptionZh: "高铁2小时到上海。河港和海港交通便利。" },
      { icon: "policy", title: "Pro-Business Government", titleRu: "Проинвестиционное правительство", titleZh: "亲商政府", description: "Efficient bureaucracy, English-speaking investment services, 30+ years FDI experience.", descriptionRu: "Эффективная бюрократия, англоязычные инвестиционные услуги, 30+ лет опыта работы с ПИИ.", descriptionZh: "高效的行政服务，英语投资服务，30多年外商投资经验。" }
    ],
    contactInfo: { investmentAgency: "Jiangsu Provincial Department of Commerce", investmentAgencyRu: "Департамент коммерции провинции Цзянсу", investmentAgencyZh: "江苏省商务厅", website: "http://swt.jiangsu.gov.cn", email: "invest@jiangsu.gov.cn", phone: "+86-25-57710228" },
    notableEntrepreneurs: [
      { name: "Liu Qiangdong (Richard Liu)", nameZh: "刘强东", nameRu: "Лю Цяндун (Ричард Лю)", company: "JD.com", industry: "E-commerce & Logistics", netWorth: "$11.2B", description: "Founder of JD.com, China's second-largest e-commerce platform. Pioneer in self-operated logistics and authentic goods guarantee.", descriptionRu: "Основатель JD.com, второй по величине платформы электронной коммерции в Китае. Пионер собственной логистики и гарантии подлинности товаров.", descriptionZh: "京东创始人，中国第二大电商平台。自营物流和正品保障的先驱。" },
      { name: "Zhang Jindong", nameZh: "张近东", nameRu: "Чжан Цзиньдун", company: "Suning", industry: "Retail & E-commerce", netWorth: "$5.8B", description: "Founder of Suning, one of China's largest retail and e-commerce conglomerates. Expanded from appliances to comprehensive retail.", descriptionRu: "Основатель Suning, одного из крупнейших розничных и e-commerce конгломератов Китая. Расширился от бытовой техники до комплексной розницы.", descriptionZh: "苏宁创始人，中国最大的零售和电商集团之一。从家电扩展到综合零售。" }
    ]
  },
  "Shandong": {
    name: "Shandong",
    nameRu: "Шаньдун",
    nameZh: "山东",
    gdp: "$1.34 Trillion",
    population: "101 Million",
    industries: ["Petrochemicals", "Agriculture", "Heavy Industry", "Mining"],
    industriesRu: ["Нефтехимия", "Сельское хозяйство", "Тяжёлая промышленность", "Горнодобывающая промышленность"],
    industriesZh: ["石化", "农业", "重工业", "采矿业"],
    sezCount: 4,
    taxBenefits: ["Qingdao FTZ benefits", "Agricultural tax incentives", "Industrial zone benefits"],
    taxBenefitsRu: ["Льготы зоны свободной торговли Циндао", "Налоговые льготы для сельского хозяйства", "Льготы промышленных зон"],
    taxBenefitsZh: ["青岛自贸区优惠", "农业税收优惠", "工业园区优惠"],
    majorCities: [
      { id: "jinan", name: "Jinan", nameRu: "Цзинань", nameZh: "济南", population: "9.2M", image: "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=1920&q=80", description: "The City of Springs - Shandong's capital with 72 famous springs. Major center for heavy industry, software, and government services. Growing focus on quantum computing and AI.", descriptionRu: "Город родников — столица Шаньдуна с 72 знаменитыми источниками. Крупный центр тяжёлой промышленности, программного обеспечения и государственных услуг. Растущий фокус на квантовых вычислениях и ИИ.", descriptionZh: "泉城——山东省会，拥有72处著名泉水。重工业、软件和政府服务的主要中心。日益关注量子计算和人工智能。", opportunities: [
        { id: "jn-1", title: "Jinan Quantum Valley", titleZh: "济南量子谷", titleRu: "Квантовая долина Цзинань", sector: "Quantum Technology", description: "China's quantum computing and communication research center. Partnership with University of Science and Technology of China.", descriptionZh: "中国量子计算和通信研究中心。与中国科学技术大学合作。", descriptionRu: "Центр исследований квантовых вычислений и связи Китая. Партнёрство с Университетом науки и технологий Китая.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "priority" },
        { id: "jn-2", title: "Heavy Equipment Modernization", titleZh: "重型设备现代化", titleRu: "Модернизация тяжёлого оборудования", sector: "Manufacturing", description: "Upgrade traditional machinery manufacturing with smart factory solutions. Local government subsidies available.", descriptionZh: "用智能工厂解决方案升级传统机械制造业。可获得地方政府补贴。", descriptionRu: "Модернизация традиционного машиностроения с решениями умных фабрик. Доступны субсидии местного правительства.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "qingdao", name: "Qingdao", nameRu: "Циндао", nameZh: "青岛", population: "10.1M", image: "https://images.unsplash.com/photo-1569155235789-b0d2e6ea6cb7?w=1920&q=80", description: "Beautiful coastal city with German heritage, home to Tsingtao Beer, Haier, and Hisense. Major port and SCO cooperation hub. Excellent quality of life with beaches and mountains.", descriptionRu: "Красивый прибрежный город с немецким наследием, дом Tsingtao Beer, Haier и Hisense. Крупный портовый город и центр сотрудничества ШОС. Отличное качество жизни с пляжами и горами.", descriptionZh: "具有德国遗产的美丽沿海城市，是青岛啤酒、海尔和海信的所在地。主要港口城市和上合组织合作中心。拥有海滩和山脉的优质生活。", opportunities: [
        { id: "qd-1", title: "SCO Local Cooperation Demonstration Zone", titleZh: "上合组织地方合作示范区", titleRu: "Демонстрационная зона сотрудничества ШОС", sector: "Trade", description: "Dedicated zone for SCO member trade. Fast customs, RMB settlement, preferential policies for Russian goods.", descriptionZh: "上合组织成员国贸易专区。快速通关、人民币结算、俄罗斯商品优惠政策。", descriptionRu: "Специальная зона для торговли стран ШОС. Быстрое таможенное оформление, расчёты в юанях, преференции для российских товаров.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "qd-2", title: "Haier Smart Manufacturing Partnership", titleZh: "海尔智能制造合作", titleRu: "Партнёрство по умному производству с Haier", sector: "Manufacturing", description: "Supply chain and technology partnerships with world's largest appliance maker. Industry 4.0 showcase.", descriptionZh: "与全球最大家电制造商的供应链和技术合作。工业4.0展示。", descriptionRu: "Партнёрства по цепочке поставок и технологиям с крупнейшим в мире производителем бытовой техники. Витрина Индустрии 4.0.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" },
        { id: "qd-3", title: "Marine Technology & Blue Economy", titleZh: "海洋科技与蓝色经济", titleRu: "Морские технологии и голубая экономика", sector: "Marine", description: "Ocean observation equipment, marine biotech, and offshore engineering. Partnership with Ocean University of China.", descriptionZh: "海洋观测设备、海洋生物技术和海洋工程。与中国海洋大学合作。", descriptionRu: "Оборудование для наблюдения за океаном, морские биотехнологии и офшорная инженерия. Партнёрство с Океанским университетом Китая.", investmentRange: "$5M - $80M", timeline: "2-4 years", status: "active" },
        { id: "qd-4", title: "Craft Brewing & Food Processing", titleZh: "精酿啤酒与食品加工", titleRu: "Крафтовое пивоварение и пищевая промышленность", sector: "Food & Beverage", description: "Premium food and beverage manufacturing. Leverage Tsingtao Beer heritage and local agriculture.", descriptionZh: "优质食品饮料制造。利用青岛啤酒传统和当地农业。", descriptionRu: "Производство премиальных продуктов питания и напитков. Использование наследия Tsingtao Beer и местного сельского хозяйства.", investmentRange: "$2M - $30M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "yantai", name: "Yantai", nameRu: "Яньтай", nameZh: "烟台", population: "7.1M", image: "https://images.unsplash.com/photo-1569947609091-b29675c88880?w=1920&q=80", description: "China\'s wine capital and major seafood producer. Beautiful coastal city with strong ties to South Korea. Growing in automotive components and precision manufacturing.", descriptionRu: "Винная столица Китая и крупный производитель морепродуктов. Красивый прибрежный город с сильными связями с Южной Кореей. Растёт в автомобильных компонентах и точном производстве.", descriptionZh: "中国的葡萄酒之都和主要海鲜生产商。美丽的沿海城市，与韩国有着紧密的联系。在汽车零部件和精密制造方面不断发展。", opportunities: [
        { id: "yt-1", title: "Yantai Wine Industry Development", titleZh: "烟台葡萄酒产业发展", titleRu: "Развитие винодельческой отрасли Яньтай", sector: "Wine & Agriculture", description: "China's premier wine region. Vineyard acquisition, winery partnerships, and wine tourism development.", descriptionZh: "中国首要葡萄酒产区。葡萄园收购、酒庄合作和葡萄酒旅游开发。", descriptionRu: "Ведущий винодельческий регион Китая. Приобретение виноградников, партнёрства с винодельнями и развитие винного туризма.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" },
        { id: "yt-2", title: "Seafood Processing & Cold Chain", titleZh: "海鲜加工与冷链", titleRu: "Переработка морепродуктов и холодовая цепь", sector: "Food Processing", description: "Modern seafood processing facilities for Russia-sourced products. Cold chain infrastructure for export.", descriptionZh: "为俄罗斯采购产品提供现代海鲜加工设施。出口冷链基础设施。", descriptionRu: "Современные мощности по переработке морепродуктов для российской продукции. Инфраструктура холодовой цепи для экспорта.", investmentRange: "$10M - $80M", timeline: "1-3 years", status: "priority" },
        { id: "yt-3", title: "Automotive Components Hub", titleZh: "汽车零部件中心", titleRu: "Хаб автомобильных компонентов", sector: "Automotive", description: "Tier 1/2 supplier facilities near Hyundai, GM, and BYD plants. Growing EV component demand.", descriptionZh: "靠近现代、通用和比亚迪工厂的一级/二级供应商设施。电动汽车零部件需求不断增长。", descriptionRu: "Объекты поставщиков Tier 1/2 рядом с заводами Hyundai, GM и BYD. Растущий спрос на компоненты электромобилей.", investmentRange: "$8M - $60M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "China's third-largest economy and agricultural heartland. Shandong bridges North and East China with strong heavy industry, petrochemicals, and food processing. Qingdao is a major port city with German heritage and brewing tradition; Yantai excels in wine and seafood.",
     overviewRu: "Третья по величине экономика Китая и сельскохозяйственный центр. Шаньдун соединяет Северный и Восточный Китай с сильной тяжёлой промышленностью, нефтехимией и пищевой переработкой. Циндао — крупный портовый город с немецким наследием и пивоваренной традицией; Яньтай преуспевает в виноделии и морепродуктах.",
     overviewZh: "中国第三大经济体和农业中心。山东连接华北和华东，拥有强大的重工业、石化和食品加工产业。青岛是具有德国遗产和啤酒传统的主要港口城市；烟台在葡萄酒和海鲜方面表现突出。",
    targetSectors: ["Petrochemicals", "Marine Economy", "High-end Equipment", "Food Processing", "New Energy"],
    targetSectorsRu: ["Нефтехимия", "Морская экономика", "Высокотехнологичное оборудование", "Пищевая переработка", "Новая энергетика"],
    targetSectorsZh: ["石化", "海洋经济", "高端装备", "食品加工", "新能源"],
    opportunities: [
      { id: "sd-1", title: "Qingdao SCO Demonstration Zone", titleZh: "青岛上合示范区", titleRu: "Демонстрационная зона ШОС Циндао", sector: "Trade & Logistics", description: "Dedicated zone for Shanghai Cooperation Organization trade. Fast customs clearance for Russia-origin goods, RMB settlement, and logistics hub.", descriptionZh: "上海合作组织贸易专区。俄罗斯原产地商品快速清关、人民币结算和物流中心。", descriptionRu: "Специальная зона для торговли ШОС. Быстрое таможенное оформление товаров российского происхождения, расчёты в юанях и логистический хаб.", investmentRange: "$10M - $200M", timeline: "1-3 years", status: "priority" },
      { id: "sd-2", title: "Yantai LNG Terminal & Petrochemical Complex", titleZh: "烟台LNG接收站与石化综合体", titleRu: "СПГ-терминал и нефтехимический комплекс Яньтай", sector: "Energy", description: "Russia-sourced LNG receiving and processing. Integrate with Siberia-China pipeline network.", descriptionZh: "俄罗斯来源的LNG接收和加工。与西伯利亚-中国管道网络整合。", descriptionRu: "Приём и переработка СПГ из России. Интеграция с газопроводной сетью Сибирь-Китай.", investmentRange: "$100M - $1B", timeline: "3-5 years", status: "active" },
      { id: "sd-3", title: "Shandong Marine Ranching Program", titleZh: "山东海洋牧场项目", titleRu: "Программа морского фермерства Шаньдун", sector: "Fisheries", description: "Modern aquaculture, offshore platforms, and seafood processing. Technical partnerships with Russian Far East fisheries.", descriptionZh: "现代水产养殖、海上平台和海鲜加工。与俄罗斯远东渔业技术合作。", descriptionRu: "Современная аквакультура, офшорные платформы и переработка морепродуктов. Технические партнёрства с рыболовством Дальнего Востока России.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" },
      { id: "sd-4", title: "Weifang Hydrogen Economy Pilot", titleZh: "潍坊氢能经济试点", titleRu: "Пилот водородной экономики Вэйфан", sector: "New Energy", description: "Green hydrogen production, fuel cell manufacturing, and hydrogen vehicle deployment.", descriptionZh: "绿色氢气生产、燃料电池制造和氢能汽车部署。", descriptionRu: "Производство зелёного водорода, изготовление топливных элементов и развёртывание водородных автомобилей.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "upcoming" }
    ],
    keyProjects: [
      { id: "sd-p1", name: "Qingdao Sino-Russian Local Cooperation Park", nameRu: "Циндаоский китайско-российский парк местного сотрудничества", nameZh: "青岛中俄地方合作园区", value: "$500 Million", sector: "Manufacturing", description: "Dedicated industrial park for Russian manufacturing enterprises in China.", descriptionRu: "Специализированный промышленный парк для российских производственных предприятий в Китае.", descriptionZh: "为俄罗斯制造企业在中国设立的专业工业园区。", completionYear: "2027" },
      { id: "sd-p2", name: "Rizhao Steel Green Transformation", nameRu: "Зелёная трансформация стали Жичжао", nameZh: "日照钢铁绿色转型", value: "$3 Billion", sector: "Steel", description: "Carbon-neutral steel production using Russian iron ore and hydrogen technology.", descriptionRu: "Углеродно-нейтральное производство стали с использованием российской железной руды и водородной технологии.", descriptionZh: "使用俄罗斯铁矿石和氢技术的碳中性钢铁生产。", partners: ["Rizhao Steel"], completionYear: "2030" }
    ],
    advantages: [
       { icon: "resources", title: "Agricultural Base", titleRu: "Сельскохозяйственная база", titleZh: "农业基地", description: "China's top producer of vegetables, fruits, and seafood. 100 million consumer market.", descriptionRu: "Ведущий производитель овощей, фруктов и морепродуктов в Китае. Рынок 100 миллионов потребителей.", descriptionZh: "中国蔬菜、水果和海鲜的顶级生产商。拥有1亿消费者的市场。" },
       { icon: "logistics", title: "Strategic Ports", titleRu: "Стратегические порты", titleZh: "战略港口", description: "Qingdao Port ranks 5th globally. Direct routes to Russian Pacific ports.", descriptionRu: "Порт Циндао занимает 5-е место в мире. Прямые маршруты в российские тихоокеанские порты.", descriptionZh: "青岛港全球排名第5。直达俄罗斯太平洋港口的航线。" },
       { icon: "market", title: "SCO Hub", titleRu: "Центр ШОС", titleZh: "上合组织中心", description: "Only SCO local economic cooperation demonstration zone. Preferential Russia-China trade policies.", descriptionRu: "Единственная демонстрационная зона местного экономического сотрудничества ШОС. Преференциальная политика торговли Россия-Китай.", descriptionZh: "唯一的上合组织地方经济合作示范区。优惠的俄中贸易政策。" },
       { icon: "infrastructure", title: "Industrial Foundation", titleRu: "Промышленная база", titleZh: "工业基础", description: "Mature heavy industry base with skilled workforce and supplier ecosystem.", descriptionRu: "Зрелая база тяжёлой промышленности с квалифицированной рабочей силой и экосистемой поставщиков.", descriptionZh: "成熟的重工业基地，拥有熟练的劳动力和供应商生态系统。" }
     ],
    contactInfo: { investmentAgency: "Shandong Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Шаньдун", investmentAgencyZh: "山东省商务厅", website: "http://commerce.shandong.gov.cn", email: "invest@shandong.gov.cn", phone: "+86-531-89013333" }
  },
  "Zhejiang": {
    name: "Zhejiang",
    nameRu: "Чжэцзян",
    nameZh: "浙江",
    gdp: "$1.23 Trillion",
    population: "65.4 Million",
    industries: ["E-commerce", "Manufacturing", "Textiles", "Digital Economy"],
    industriesRu: ["Электронная коммерция", "Производство", "Текстиль", "Цифровая экономика"],
    industriesZh: ["电子商务", "制造业", "纺织品", "数字经济"],
    sezCount: 4,
    taxBenefits: ["Hangzhou digital economy incentives", "Cross-border e-commerce benefits", "Small business tax breaks"],
    taxBenefitsRu: ["Льготы цифровой экономики Ханчжоу", "Льготы трансграничной электронной коммерции", "Налоговые льготы для малого бизнеса"],
    taxBenefitsZh: ["杭州数字经济优惠政策", "跨境电商优惠政策", "小企业税收优惠"],
    majorCities: [
       { id: "hangzhou", name: "Hangzhou", nameRu: "Ханчжоу", nameZh: "杭州", population: "12.2M", image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=1920&q=80", description: "China's digital capital and home to Alibaba, Ant Group, and NetEase. Historic city with UNESCO World Heritage West Lake. 2022 Asian Games host with world-class infrastructure.", descriptionRu: "Цифровая столица Китая и дом Alibaba, Ant Group и NetEase. Исторический город с объектом Всемирного наследия ЮНЕСКО озером Сиху. Хозяин Азиатских игр 2022 года с мировоззренческой инфраструктурой.", descriptionZh: "中国的数字首都，也是阿里巴巴、蚂蚁集团和网易的所在地。拥有联合国教科文组织世界遗产西湖的历史城市。2022年亚运会主办城市，拥有世界级基础设施。", opportunities: [
        { id: "hz-1", title: "Alibaba Ecosystem Partnership", titleZh: "阿里巴巴生态合作", titleRu: "Партнёрство с экосистемой Alibaba", sector: "E-commerce", description: "Launch on Tmall Global, access Alibaba Cloud, and leverage Cainiao logistics. Direct partnership support.", descriptionZh: "入驻天猫国际，接入阿里云，利用菜鸟物流。直接合作支持。", descriptionRu: "Запуск на Tmall Global, доступ к Alibaba Cloud и логистике Cainiao. Прямая партнёрская поддержка.", investmentRange: "$1M - $50M", timeline: "6-18 months", status: "priority" },
        { id: "hz-2", title: "Hangzhou AI Town", titleZh: "杭州人工智能小镇", titleRu: "Городок ИИ в Ханчжоу", sector: "AI", description: "1,000-hectare AI innovation zone with DAMO Academy. Computing infrastructure, talent programs, and funding.", descriptionZh: "与达摩院合作的1000公顷人工智能创新区。计算基础设施、人才计划和资金支持。", descriptionRu: "1000-гектарная зона инноваций ИИ с Академией DAMO. Вычислительная инфраструктура, программы для талантов и финансирование.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" },
        { id: "hz-3", title: "Digital Healthcare Hub", titleZh: "数字医疗中心", titleRu: "Центр цифрового здравоохранения", sector: "HealthTech", description: "Internet hospital platforms, medical AI, and digital therapeutics. Partnership with top hospitals.", descriptionZh: "互联网医院平台、医疗人工智能和数字疗法。与顶级医院合作。", descriptionRu: "Платформы интернет-больниц, медицинский ИИ и цифровая терапия. Партнёрства с ведущими больницами.", investmentRange: "$3M - $60M", timeline: "1-3 years", status: "active" },
        { id: "hz-4", title: "Fintech & Digital Payments", titleZh: "金融科技与数字支付", titleRu: "Финтех и цифровые платежи", sector: "Fintech", description: "Payment solutions, blockchain applications, and digital banking. Ant Group ecosystem access.", descriptionZh: "支付解决方案、区块链应用和数字银行。接入蚂蚁集团生态系统。", descriptionRu: "Платёжные решения, блокчейн-приложения и цифровой банкинг. Доступ к экосистеме Ant Group.", investmentRange: "$5M - $80M", timeline: "1-2 years", status: "active" }
      ]},
       { id: "ningbo", name: "Ningbo", nameRu: "Нинбо", nameZh: "宁波", population: "9.4M", image: "https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?w=1920&q=80", description: "World's largest port by cargo tonnage and China's private enterprise capital. Strong manufacturing base with excellent logistics. Gateway for Russia-China maritime trade.", descriptionRu: "Крупнейший в мире порт по грузообороту и столица частного предпринимательства Китая. Сильная производственная база с отличной логистикой. Ворота для российско-китайской морской торговли.", descriptionZh: "按货物吞吐量计世界最大的港口，也是中国私营企业的首都。拥有强大的制造基地和优秀的物流。俄中海上贸易的门户。", opportunities: [
        { id: "nb-1", title: "Ningbo Port Russia Trade Hub", titleZh: "宁波港俄罗斯贸易中心", titleRu: "Торговый хаб Россия в порту Нинбо", sector: "Logistics", description: "Bonded warehousing and distribution for Russia-China trade. Connect Trans-Siberian Railway to maritime routes.", descriptionZh: "中俄贸易保税仓储和配送。连接西伯利亚大铁路与海运航线。", descriptionRu: "Таможенное складирование и дистрибуция для российско-китайской торговли. Соединение Транссиба с морскими маршрутами.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "nb-2", title: "Auto Parts & Mold Manufacturing", titleZh: "汽车零部件与模具制造", titleRu: "Производство автозапчастей и пресс-форм", sector: "Manufacturing", description: "China's mold-making capital with precision manufacturing. Automotive and appliance component clusters.", descriptionZh: "中国模具之都，精密制造。汽车和家电零部件集群。", descriptionRu: "Столица Китая по производству пресс-форм с прецизионным производством. Кластеры автомобильных и бытовых компонентов.", investmentRange: "$5M - $80M", timeline: "1-3 years", status: "active" },
        { id: "nb-3", title: "Petrochemical & New Materials", titleZh: "石化与新材料", titleRu: "Нефтехимия и новые материалы", sector: "Chemicals", description: "Integration with Zhenhai Refinery complex. Specialty chemicals and advanced polymers.", descriptionZh: "与镇海炼化综合体整合。特种化学品和先进聚合物。", descriptionRu: "Интеграция с НПЗ-комплексом Чжэньхай. Специальные химикаты и передовые полимеры.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
      ]},
       { id: "wenzhou", name: "Wenzhou", nameRu: "Вэньчжоу", nameZh: "温州", population: "9.6M", image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1920&q=80", description: "China's entrepreneurship capital - birthplace of private enterprise. Famous for shoes, leather goods, and eyewear. Strong overseas Chinese network with global trade connections.", descriptionRu: "Столица предпринимательства Китая — колыбель частного предпринимательства. Известна обувью, кожаными товарами и очками. Сильная сеть зарубежных китайцев с глобальными торговыми связями.", descriptionZh: "中国的创业之都——私营企业的摇篮。以鞋类、皮革制品和眼镜而闻名。拥有强大的海外华人网络和全球贸易联系。", opportunities: [
        { id: "wz-1", title: "Fashion & Footwear Innovation", titleZh: "时尚与鞋业创新", titleRu: "Инновации в моде и обуви", sector: "Fashion", description: "Partner with China's largest shoe manufacturing cluster. Smart manufacturing and sustainable materials.", descriptionZh: "与中国最大的鞋业制造集群合作。智能制造和可持续材料。", descriptionRu: "Партнёрство с крупнейшим в Китае обувным кластером. Умное производство и экологичные материалы.", investmentRange: "$2M - $40M", timeline: "1-2 years", status: "active" },
        { id: "wz-2", title: "Eyewear Manufacturing Hub", titleZh: "眼镜制造中心", titleRu: "Хаб производства очков", sector: "Manufacturing", description: "World's largest eyewear production base. OEM/ODM for global brands and own-brand development.", descriptionZh: "全球最大的眼镜生产基地。为全球品牌OEM/ODM和自主品牌开发。", descriptionRu: "Крупнейшая в мире база производства очков. OEM/ODM для мировых брендов и развитие собственного бренда.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" },
        { id: "wz-3", title: "Cross-border E-commerce Pilot", titleZh: "跨境电商试点", titleRu: "Пилот трансграничной электронной коммерции", sector: "E-commerce", description: "Leverage Wenzhou merchant networks for Russia market entry. Established trade channels to CIS countries.", descriptionZh: "利用温州商人网络进入俄罗斯市场。已建立通往独联体国家的贸易渠道。", descriptionRu: "Использование торговых сетей Вэньчжоу для выхода на российский рынок. Налаженные торговые каналы в страны СНГ.", investmentRange: "$1M - $20M", timeline: "6-12 months", status: "priority" }
      ]}
    ],
     overview: "Home to Alibaba and China's most dynamic private sector. Zhejiang leads in e-commerce, digital payments, and private entrepreneurship. Hangzhou hosts Alibaba, Ant Group, and NetEase; Ningbo is a major port; Wenzhou is famous for private enterprise.",
    overviewRu: "Дом Alibaba и самого динамичного частного сектора Китая. Чжэцзян лидирует в электронной коммерции, цифровых платежах и частном предпринимательстве. Ханчжоу является домом для Alibaba, Ant Group и NetEase; Нинбо — крупный порт; Вэньчжоу известен частным предпринимательством.",
    overviewZh: "阿里巴巴的所在地和中国最具活力的私营部门。浙江在电子商务、数字支付和私营企业方面处于领先地位。杭州是阿里巴巴、蚂蚁集团和网易的所在地；宁波是主要港口；温州以私营企业而闻名。",
    targetSectors: ["Digital Economy", "E-commerce", "Fashion & Textiles", "Smart Manufacturing", "Cross-border Trade"],
    opportunities: [
      { id: "zj-1", title: "Alibaba Cross-border E-commerce Ecosystem", titleZh: "阿里巴巴跨境电商生态系统", titleRu: "Экосистема трансграничной электронной коммерции Alibaba", sector: "E-commerce", description: "Launch on Tmall Global, AliExpress, and Lazada. Warehouse and fulfillment services in Hangzhou Cross-border E-commerce Comprehensive Zone.", descriptionZh: "入驻天猫国际、速卖通和Lazada。杭州跨境电商综合试验区仓储和履约服务。", descriptionRu: "Запуск на Tmall Global, AliExpress и Lazada. Складские и фулфилмент-услуги в комплексной зоне трансграничной электронной коммерции Ханчжоу.", investmentRange: "$1M - $50M", timeline: "6-18 months", status: "active" },
      { id: "zj-2", title: "Ningbo Russia Trade Logistics Center", titleZh: "宁波俄罗斯贸易物流中心", titleRu: "Логистический центр российской торговли в Нинбо", sector: "Logistics", description: "Bonded warehouse and distribution center for Russia-China trade. Connect Trans-Siberian Railway to Ningbo Port.", descriptionZh: "中俄贸易保税仓库和配送中心。连接西伯利亚大铁路与宁波港。", descriptionRu: "Таможенный склад и распределительный центр для российско-китайской торговли. Соединение Транссиба с портом Нинбо.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "priority" },
      { id: "zj-3", title: "Hangzhou AI Town", titleZh: "杭州人工智能小镇", titleRu: "Городок ИИ в Ханчжоу", sector: "AI", description: "1,000-hectare AI innovation zone with Alibaba DAMO Academy partnership. Computing infrastructure and talent programs.", descriptionZh: "与阿里巴巴达摩院合作的1000公顷人工智能创新区。计算基础设施和人才计划。", descriptionRu: "1000-гектарная зона инноваций ИИ в партнёрстве с Академией DAMO Alibaba. Вычислительная инфраструктура и программы для талантов.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" },
      { id: "zj-4", title: "Zhejiang Fashion Industry Upgrade", titleZh: "浙江时尚产业升级", titleRu: "Модернизация модной индустрии Чжэцзяна", sector: "Textiles", description: "Smart garment manufacturing, sustainable textiles, and fashion tech. Partnerships with 50,000+ textile factories.", descriptionZh: "智能服装制造、可持续纺织品和时尚科技。与50,000多家纺织工厂合作。", descriptionRu: "Умное производство одежды, экологичный текстиль и модные технологии. Партнёрства с 50 000+ текстильными фабриками.", investmentRange: "$3M - $50M", timeline: "1-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "zj-p1", name: "Ant Group Digital Finance Platform", nameRu: "Платформа цифрового финансирования Ant Group", nameZh: "蚂蚁集团数字金融平台", value: "$2 Billion", sector: "Fintech", description: "Cross-border payment and digital banking partnerships for Russia-China trade.", descriptionRu: "Партнёрства в области трансграничных платежей и цифрового банкинга для российско-китайской торговли.", descriptionZh: "俄中贸易的跨境支付和数字银行合作。", partners: ["Ant Group"], completionYear: "Ongoing" },
      { id: "zj-p2", name: "Geely-Volvo New Energy Vehicle Hub", nameRu: "Хаб новых энергетических автомобилей Geely-Volvo", nameZh: "吉利-沃尔沃新能源汽车中心", value: "$1 Billion", sector: "Automotive", description: "EV manufacturing and supply chain opportunities.", descriptionRu: "Производство электромобилей и возможности в цепочке поставок.", descriptionZh: "电动汽车制造和供应链机会。", partners: ["Geely", "Volvo"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "tech", title: "Digital Economy Leader", titleRu: "Лидер цифровой экономики", titleZh: "数字经济领导者", description: "Home to Alibaba, Ant Group, NetEase. Most advanced digital commerce ecosystem in China.", descriptionRu: "Дом Alibaba, Ant Group, NetEase. Самая передовая экосистема цифровой коммерции в Китае.", descriptionZh: "阿里巴巴、蚂蚁集团、网易的所在地。中国最先进的数字商务生态系统。" },
      { icon: "market", title: "Private Sector Engine", titleRu: "Двигатель частного сектора", titleZh: "私营部门引擎", description: "65% of GDP from private enterprises. Entrepreneurial culture with strong SME ecosystem.", descriptionRu: "65% ВВП от частных предприятий. Предпринимательская культура с сильной экосистемой МСП.", descriptionZh: "65%的GDP来自私营企业。具有强大中小企业生态系统的创业文化。" },
      { icon: "logistics", title: "Ningbo Port", titleRu: "Порт Нинбо", titleZh: "宁波港", description: "World's 3rd largest cargo port. Direct connections to Russia via sea and rail.", descriptionRu: "Третий по величине грузовой порт в мире. Прямые связи с Россией по морю и железной дороге.", descriptionZh: "世界第三大货运港口。经海路和铁路与俄罗斯的直接连接。" },
      { icon: "infrastructure", title: "E-commerce Infrastructure", titleRu: "Инфраструктура электронной коммерции", titleZh: "电子商务基础设施", description: "Most developed cross-border e-commerce zone. Streamlined customs for online retail.", descriptionRu: "Наиболее развитая зона трансграничной электронной коммерции. Упрощённые таможенные процедуры для онлайн-розницы.", descriptionZh: "最发达的跨境电商区。简化的在线零售海关程序。" }
    ],
    notableEntrepreneurs: [
      { name: "Jack Ma", nameZh: "马云", nameRu: "Джек Ма", company: "Alibaba Group", industry: "E-commerce & Fintech", netWorth: "$25.5B", description: "Founder of Alibaba, created world's largest e-commerce ecosystem. Former English teacher who built China's tech empire.", descriptionRu: "Основатель Alibaba, создатель крупнейшей в мире экосистемы электронной коммерции. Бывший учитель английского языка, построивший технологическую империю Китая.", descriptionZh: "阿里巴巴创始人，创建了世界上最大的电子商务生态系统。曾是英语教师，建立了中国的科技帝国。" },
      { name: "Zhong Shanshan", nameZh: "钟睒睒", nameRu: "Чжун Шаньшань", company: "Nongfu Spring", industry: "Beverages & Pharma", netWorth: "$62.3B", description: "China's richest person. Founded Nongfu Spring bottled water and major pharma stake. Famously private 'Lone Wolf'.", descriptionRu: "Самый богатый человек в Китае. Основатель Nongfu Spring и крупный акционер фармацевтической компании. Известен своей приватностью как 'Одинокий волк'.", descriptionZh: "中国最富有的人。创办了农夫山泉，拥有主要制药公司股份。以隐私著称，被称为'独狼'。" },
      { name: "Ding Lei (William Ding)", nameZh: "丁磊", nameRu: "Дин Лэй", company: "NetEase", industry: "Gaming & Music", netWorth: "$25.8B", description: "Founder of NetEase, one of China's largest gaming and music streaming companies.", descriptionRu: "Основатель NetEase, одной из крупнейших в Китае компаний по играм и потоковой музыке.", descriptionZh: "网易创始人，中国最大的游戏和音乐流媒体公司之一。" },
      { name: "Li Shufu", nameZh: "李书福", nameRu: "Ли Шуфу", company: "Geely", industry: "Automotive", netWorth: "$16.2B", description: "Founder of Geely, owns Volvo, Lotus, and Polestar. China's most acquisitive auto entrepreneur.", descriptionRu: "Основатель Geely, владелец Volvo, Lotus и Polestar. Самый активный в приобретениях автомобильный предприниматель Китая.", descriptionZh: "吉利创始人，拥有沃尔沃、莲花和极星。中国最具收购意愿的汽车企业家。" }
    ],
    contactInfo: { investmentAgency: "Zhejiang Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Чжэцзян", investmentAgencyZh: "浙江省商务厅", website: "http://zcom.zj.gov.cn", email: "invest@zj.gov.cn", phone: "+86-571-87057626" }
  },
  "Henan": {
    name: "Henan",
    nameRu: "Хэнань",
    nameZh: "河南",
    gdp: "$870 Billion",
    population: "99 Million",
     industries: ["Agriculture", "Food Processing", "Logistics", "Manufacturing"],
     industriesRu: ["Сельское хозяйство", "Пищевая переработка", "Логистика", "Производство"],
     industriesZh: ["农业", "食品加工", "物流", "制造业"],
     sezCount: 3,
    taxBenefits: ["Zhengzhou Airport Economy Zone", "Central China incentives", "Agricultural processing benefits"],
    taxBenefitsRu: ["Экономическая зона аэропорта Чжэнчжоу", "Льготы Центрального Китая", "Льготы для переработки сельхозпродукции"],
    taxBenefitsZh: ["郑州航空港经济区", "中部地区优惠政策", "农产品加工优惠"],
    majorCities: [
      { id: "zhengzhou", name: "Zhengzhou", nameRu: "Чжэнчжоу", nameZh: "郑州", population: "12.6M", image: "https://images.unsplash.com/photo-1569078449082-93b5a5127c78?w=1920&q=80", description: "China's logistics crossroads where all major rail lines intersect. Home to Foxconn's largest iPhone factory and China-Europe Railway terminus. Gateway to 100 million Central China consumers.", descriptionRu: "Логистический перекрёсток Китая, где пересекаются все основные железные дороги. Здесь расположен крупнейший завод iPhone компании Foxconn и терминал железной дороги Китай-Европа. Ворота для 100 миллионов потребителей Центрального Китая.", descriptionZh: "中国的物流十字路口，所有主要铁路线在此交汇。拥有富士康最大的iPhone工厂和中欧铁路枢纽。通往华中1亿消费者的门户。", opportunities: [
        { id: "zz-1", title: "Zhengzhou Airport Economy Zone", titleZh: "郑州航空港经济区", titleRu: "Экономическая зона аэропорта Чжэнчжоу", sector: "Logistics", description: "China's fastest-growing air cargo hub. Direct freight to Moscow. Bonded logistics for electronics and e-commerce.", descriptionZh: "中国增长最快的航空货运枢纽。直飞莫斯科的货运。电子和电商保税物流。", descriptionRu: "Самый быстрорастущий авиагрузовой хаб Китая. Прямые грузы в Москву. Таможенная логистика для электроники и e-commerce.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "zz-2", title: "Foxconn iPhone City Supply Chain", titleZh: "富士康iPhone城供应链", titleRu: "Цепочка поставок Foxconn iPhone City", sector: "Electronics", description: "Supply chain opportunities for world's largest smartphone factory. 300,000 workers and massive component demand.", descriptionZh: "世界最大智能手机工厂的供应链机会。30万工人和巨大的零部件需求。", descriptionRu: "Возможности цепочки поставок для крупнейшего в мире завода смартфонов. 300 000 работников и огромный спрос на комплектующие.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" },
        { id: "zz-3", title: "China-Europe Railway Terminal", titleZh: "中欧铁路枢纽", titleRu: "Терминал железной дороги Китай-Европа", sector: "Trade", description: "Largest China-Europe rail hub. Direct trains to Moscow, Hamburg, Duisburg. Trade processing and logistics.", descriptionZh: "最大的中欧铁路枢纽。直达莫斯科、汉堡、杜伊斯堡的列车。贸易加工和物流。", descriptionRu: "Крупнейший ж/д хаб Китай-Европа. Прямые поезда в Москву, Гамбург, Дуйсбург. Торговая переработка и логистика.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "luoyang", name: "Luoyang", nameRu: "Лоян", nameZh: "洛阳", population: "7.1M", image: "https://images.unsplash.com/photo-1600077106724-946750eeaf3c?w=1920&q=80", description: "Ancient capital with 13 dynasties of history. Now a heavy machinery and agricultural equipment center. Famous for peonies and Longmen Grottoes UNESCO site.", descriptionRu: "Древняя столица с историей 13 династий. Теперь центр тяжёлого машиностроения и сельскохозяйственного оборудования. Известна пионами и объектом ЮНЕСКО пещер Лунмэнь.", descriptionZh: "拥有13个朝代历史的古都。现为重型机械和农业设备中心。以牡丹和龙门石窟联合国教科文组织遗址而闻名。", opportunities: [
        { id: "ly-1", title: "Luoyang Heavy Machinery JV", titleZh: "洛阳重型机械合资", titleRu: "СП по тяжёлому машиностроению Лоян", sector: "Machinery", description: "Partnerships with CIMC, Yituo, and other major equipment manufacturers. Mining and agricultural machinery.", descriptionZh: "与中集、一拖等主要设备制造商合作。矿山和农业机械。", descriptionRu: "Партнёрства с CIMC, Yituo и другими крупными производителями оборудования. Горное и сельскохозяйственное машиностроение.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" },
        { id: "ly-2", title: "Cultural Tourism Development", titleZh: "文化旅游开发", titleRu: "Развитие культурного туризма", sector: "Tourism", description: "Longmen Grottoes UNESCO site area development. Hotels and cultural experiences.", descriptionZh: "龙门石窟联合国教科文组织遗址区域开发。酒店和文化体验。", descriptionRu: "Развитие зоны пещер Лунмэнь ЮНЕСКО. Отели и культурные впечатления.", investmentRange: "$5M - $80M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "kaifeng", name: "Kaifeng", nameRu: "Кайфэн", nameZh: "开封", population: "4.8M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Song Dynasty capital with preserved ancient city. Food processing hub with strong agricultural connections. Growing cultural tourism destination.", descriptionRu: "Столица династии Сун с сохранённым древним городом. Центр пищевой переработки с сильными сельскохозяйственными связями. Растущий центр культурного туризма.", descriptionZh: "宋朝古都，保留着古城风貌。食品加工中心，与农业联系紧密。文化旅游目的地不断发展。", opportunities: [
        { id: "kf-1", title: "Kaifeng Food Processing Zone", titleZh: "开封食品加工区", titleRu: "Зона пищевой переработки Кайфэн", sector: "Food", description: "Agricultural processing for Central China's wheat and produce. Cold chain and distribution development.", descriptionZh: "华中地区小麦和农产品加工。冷链和配送发展。", descriptionRu: "Переработка пшеницы и продукции Центрального Китая. Развитие холодовой цепи и дистрибуции.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]}
    ],
    overview: "China's most populous province and transportation crossroads. Zhengzhou is a national logistics hub connecting all major cities by rail. Agricultural powerhouse leading in wheat, pork, and food processing. Emerging smartphone manufacturing center (Foxconn).", overviewRu: "Самая населённая провинция Китая и транспортный перекрёсток. Чжэнчжоу — национальный логистический центр, соединяющий все крупные города железными дорогами. Сельскохозяйственная держава, лидирующая в производстве пшеницы, свинины и пищевой переработке. Развивающийся центр производства смартфонов (Foxconn).", overviewZh: "中国人口最多的省份和交通枢纽。郑州是国家物流中心，通过铁路连接所有主要城市。农业大省，在小麦、猪肉和食品加工方面处于领先地位。新兴的智能手机制造中心（富士康）。",
    targetSectors: ["Logistics", "Food Processing", "Electronics Assembly", "Agriculture", "Cold Chain"],
    opportunities: [
      { id: "hn-1", title: "Zhengzhou Air Cargo Hub", titleZh: "郑州航空货运枢纽", titleRu: "Авиагрузовой хаб Чжэнчжоу", sector: "Logistics", description: "China's largest air cargo hub by growth rate. Direct freight to Moscow, Novosibirsk. Bonded logistics for high-value goods.", descriptionZh: "中国增速最快的航空货运枢纽。直飞莫斯科、新西伯利亚的货运。高价值商品保税物流。", descriptionRu: "Крупнейший авиагрузовой хаб Китая по темпам роста. Прямые грузы в Москву, Новосибирск. Таможенная логистика для ценных товаров.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
      { id: "hn-2", title: "Central China Cold Chain Network", titleZh: "华中冷链网络", titleRu: "Холодовая цепь Центрального Китая", sector: "Cold Chain", description: "Connect Russian food exports to 100 million Central China consumers. Cold storage, distribution, and retail partnerships.", descriptionZh: "连接俄罗斯食品出口与华中1亿消费者。冷藏、配送和零售合作。", descriptionRu: "Связь российского продовольственного экспорта со 100 млн потребителей Центрального Китая. Холодное хранение, дистрибуция и розница.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "hn-3", title: "Foxconn Zhengzhou Supplier Park", titleZh: "富士康郑州供应商园区", titleRu: "Парк поставщиков Foxconn Чжэнчжоу", sector: "Electronics", description: "Supply chain opportunities for world's largest iPhone factory. 300,000 workers, massive component demand.", descriptionZh: "世界最大iPhone工厂的供应链机会。30万工人，巨大的零部件需求。", descriptionRu: "Возможности цепочки поставок для крупнейшего в мире завода iPhone. 300 000 работников, огромный спрос на комплектующие.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" },
      { id: "hn-4", title: "Henan Agricultural Technology Zone", titleZh: "河南农业科技区", titleRu: "Зона агротехнологий Хэнань", sector: "AgTech", description: "Precision farming, seed technology, and agricultural machinery. Partnerships with China's wheat research institutes.", descriptionZh: "精准农业、种子技术和农业机械。与中国小麦研究机构合作。", descriptionRu: "Точное земледелие, семенные технологии и сельхозтехника. Партнёрства с китайскими институтами по пшенице.", investmentRange: "$3M - $50M", timeline: "2-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "hn-p1", name: "China-Europe Railway (Zhengzhou) Hub", nameRu: "Хаб железной дороги Китай-Европа (Чжэнчжоу)", nameZh: "中欧铁路（郑州）枢纽", value: "$1 Billion", sector: "Logistics", description: "Expanding rail freight terminal for Belt and Road. Direct trains to Moscow, Hamburg, Duisburg.", descriptionRu: "Расширение терминала железнодорожных грузов для Пояса и пути. Прямые поезда в Москву, Гамбург, Дуйсбург.", descriptionZh: "扩建一带一路铁路货运枢纽。直达莫斯科、汉堡、杜伊斯堡的列车。", completionYear: "2027" },
      { id: "hn-p2", name: "Shuanghui-Smithfield Meat Processing Expansion", nameRu: "Расширение мясоперерабатывающего производства Shuanghui-Smithfield", nameZh: "双汇-史密斯菲尔德肉类加工扩建", value: "$500 Million", sector: "Food", description: "World's largest pork producer expanding cold chain and processing capacity.", descriptionRu: "Крупнейший в мире производитель свинины расширяет холодовую цепь и производственные мощности.", descriptionZh: "全球最大的猪肉生产商扩大冷链和加工能力。", partners: ["WH Group"], completionYear: "2026" }
    ],
    advantages: [
      { icon: "logistics", title: "National Crossroads", titleRu: "Национальный перекрёсток", titleZh: "国家十字路口", description: "All major rail lines intersect in Zhengzhou. 2-hour flight to 90% of China's population.", descriptionRu: "Все основные железные дороги пересекаются в Чжэнчжоу. 2-часовой полёт до 90% населения Китая.", descriptionZh: "所有主要铁路线在郑州交汇。飞行2小时可到达中国90%的人口。" },
      { icon: "market", title: "100 Million Consumers", titleRu: "100 миллионов потребителей", titleZh: "1亿消费者", description: "Massive local market with rapidly growing middle class.", descriptionRu: "Огромный местный рынок с быстро растущим средним классом.", descriptionZh: "庞大的本地市场，中产阶级快速增长。" },
      { icon: "resources", title: "Agricultural Powerhouse", titleRu: "Сельскохозяйственная держава", titleZh: "农业大省", description: "25% of China's wheat, 10% of pork. World-class food processing industry.", descriptionRu: "25% пшеницы Китая, 10% свинины. Мировой уровень пищевой промышленности.", descriptionZh: "中国25%的小麦，10%的猪肉。世界级食品加工产业。" },
      { icon: "talent", title: "Labor Abundance", titleRu: "Изобилие рабочей силы", titleZh: "劳动力充足", description: "Large skilled workforce at competitive costs. Strong vocational training system.", descriptionRu: "Большая квалифицированная рабочая сила по конкурентным ценам. Сильная система профессионального обучения.", descriptionZh: "大量技术工人，成本竞争力强。强大的职业培训体系。" }
    ],
    contactInfo: { investmentAgency: "Henan Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Хэнань", investmentAgencyZh: "河南省商务厅", website: "http://www.hncom.gov.cn", email: "invest@henan.gov.cn", phone: "+86-371-63576035" }
  },
  "Sichuan": {
    name: "Sichuan",
    nameRu: "Сычуань",
    nameZh: "四川",
    gdp: "$830 Billion",
    population: "83.7 Million",
    industries: ["Electronics", "Aerospace", "Agriculture", "Tourism"],
    industriesRu: ["Электроника", "Аэрокосмос", "Сельское хозяйство", "Туризм"],
    industriesZh: ["电子", "航空航天", "农业", "旅游"],
    sezCount: 3,
    taxBenefits: ["Western Development incentives", "15% CIT for encouraged industries", "Land use discounts"],
    taxBenefitsRu: ["Льготы развития западных регионов", "15% налог на прибыль для поощряемых отраслей", "Скидки на использование земли"],
    taxBenefitsZh: ["西部大开发优惠政策", "鼓励产业15%企业所得税", "土地使用优惠"],
    majorCities: [
      { id: "chengdu", name: "Chengdu", nameRu: "Чэнду", nameZh: "成都", population: "21.2M", image: "https://images.unsplash.com/photo-1590093441241-e00f1a9b3b84?w=1920&q=80", description: "Western China's tech capital and one of China's most livable cities. Home to giant pandas, spicy cuisine, and thriving startup scene. Dual airport city with direct Moscow flights.", descriptionRu: "Технологическая столица Западного Китая и один из самых пригодных для жизни городов Китая. Дом больших панд, острой кухни и процветающей стартап-сцены. Город с двумя аэропортами с прямыми рейсами в Москву.", descriptionZh: "西部中国的科技中心，也是中国最宜居的城市之一。大熊猫的家园、辛辣美食和蓬勃发展的创业场景。拥有两个机场的城市，有直飞莫斯科的航班。", opportunities: [
        { id: "cd-1", title: "Tianfu Software Park Innovation Hub", titleZh: "天府软件园创新中心", titleRu: "Инновационный хаб софтверного парка Тяньфу", sector: "Gaming & Tech", description: "China's gaming capital with 1,000+ studios. Game development, localization, and publishing partnerships.", descriptionZh: "中国游戏之都，拥有1000多家工作室。游戏开发、本地化和发行合作。", descriptionRu: "Игровая столица Китая с 1000+ студиями. Разработка игр, локализация и издательские партнёрства.", investmentRange: "$2M - $50M", timeline: "1-2 years", status: "priority" },
        { id: "cd-2", title: "Chengdu Aerospace Industrial Park", titleZh: "成都航空航天产业园", titleRu: "Аэрокосмический индустриальный парк Чэнду", sector: "Aerospace", description: "Commercial aircraft components, satellites, and drones. COMAC and AVIC supply chain opportunities.", descriptionZh: "商用飞机零部件、卫星和无人机。中国商飞和中航工业供应链机会。", descriptionRu: "Компоненты гражданских самолётов, спутники и дроны. Возможности в цепочке поставок COMAC и AVIC.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "active" },
        { id: "cd-3", title: "China-Europe Railway Western Hub", titleZh: "中欧铁路西部枢纽", titleRu: "Западный хаб железной дороги Китай-Европа", sector: "Logistics", description: "Direct rail to Europe through Russia. Fastest route for Western China exports. Logistics development.", descriptionZh: "经俄罗斯直达欧洲的铁路。西部出口最快路线。物流发展。", descriptionRu: "Прямое ж/д сообщение с Европой через Россию. Быстрейший маршрут для экспорта из Западного Китая. Развитие логистики.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" },
        { id: "cd-4", title: "Panda & Cultural Tourism", titleZh: "大熊猫与文化旅游", titleRu: "Панда и культурный туризм", sector: "Tourism", description: "Giant Panda breeding center, Sichuan cuisine experiences, and cultural tourism. Growing Russian tourist interest.", descriptionZh: "大熊猫繁育中心、四川美食体验和文化旅游。俄罗斯游客兴趣日增。", descriptionRu: "Центр разведения больших панд, кулинарный опыт Сычуани и культурный туризм. Растущий интерес российских туристов.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "mianyang", name: "Mianyang", nameRu: "Мяньян", nameZh: "绵阳", population: "4.9M", image: "https://images.unsplash.com/photo-1569254998317-8e794e1c5fb1?w=1920&q=80", description: "China's Science City - home to numerous defense research institutes. Strong in electronics, new materials, and high-tech manufacturing. Relatively lower costs than Chengdu.", descriptionRu: "Научный город Китая — дом многочисленных оборонных научно-исследовательских институтов. Сильные позиции в электронике, новых материалах и высокотехнологичном производстве. Относительно более низкие затраты, чем в Чэнду.", descriptionZh: "中国的科学城——众多国防研究机构的所在地。在电子、新材料和高科技制造方面实力雄厚。成本相对低于成都。", opportunities: [
        { id: "my-1", title: "Mianyang High-Tech Zone", titleZh: "绵阳高新区", titleRu: "Высокотехнологичная зона Мяньян", sector: "Technology", description: "Electronics, new materials, and precision manufacturing. Access to defense technology spinoffs.", descriptionZh: "电子、新材料和精密制造。获取国防技术衍生品。", descriptionRu: "Электроника, новые материалы и точное производство. Доступ к технологиям из оборонной сферы.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" },
        { id: "my-2", title: "Display Technology Manufacturing", titleZh: "显示技术制造", titleRu: "Производство дисплейных технологий", sector: "Electronics", description: "BOE and other display manufacturers. Panel and component supply chain.", descriptionZh: "京东方等显示器制造商。面板和零部件供应链。", descriptionRu: "BOE и другие производители дисплеев. Цепочка поставок панелей и комплектующих.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "leshan", name: "Leshan", nameRu: "Лэшань", nameZh: "乐山", population: "3.2M", image: "https://images.unsplash.com/photo-1591122947157-26bad3a117d2?w=1920&q=80", description: "UNESCO Giant Buddha heritage site and silicon materials production center. Beautiful confluence of three rivers. Growing tourism and clean energy industries.", descriptionRu: "Объект Всемирного наследия ЮНЕСКО — Большой Будда и центр производства кремниевых материалов. Красивое слияние трёх рек. Растущие туризм и чистая энергетика.", descriptionZh: "联合国教科文组织世界遗产地——乐山大佛和硅材料生产中心。三江汇流的美景。旅游业和清洁能源产业不断增长。", opportunities: [
        { id: "ls-1", title: "Leshan Silicon Materials Base", titleZh: "乐山硅材料基地", titleRu: "База кремниевых материалов Лэшань", sector: "Materials", description: "Polysilicon and solar material production. Clean energy supply chain development.", descriptionZh: "多晶硅和太阳能材料生产。清洁能源供应链发展。", descriptionRu: "Производство поликремния и солнечных материалов. Развитие цепочки поставок чистой энергии.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "ls-2", title: "Giant Buddha Tourism Development", titleZh: "乐山大佛旅游开发", titleRu: "Туристическое развитие Большого Будды", sector: "Tourism", description: "UNESCO World Heritage site area. Hotels, cruise tourism, and cultural experiences.", descriptionZh: "联合国教科文组织世界遗产区域。酒店、游船旅游和文化体验。", descriptionRu: "Зона объекта Всемирного наследия ЮНЕСКО. Отели, круизный туризм и культурные впечатления.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Western China's economic powerhouse and gateway to Southwest Asia. Chengdu rivals coastal cities in livability and innovation. Strong aerospace, electronics, and gaming industries. Famous for pandas, cuisine, and rapidly growing tech scene.",
    overviewRu: "Экономическая держава Западного Китая и ворота в Юго-Западную Азию. Чэнду соперничает с прибрежными городами по пригодности для жизни и инновациям. Сильные позиции в аэрокосмосе, электронике и игровой индустрии. Известна пандами, кухней и быстро растущей технологической сценой.",
    overviewZh: "西部中国的经济强省，也是通往西南亚的门户。成都在宜居性和创新方面与沿海城市相媲美。航空航天、电子和游戏产业实力雄厚。以大熊猫、美食和快速增长的科技产业而闻名。",
    targetSectors: ["Aerospace & Aviation", "Gaming & Entertainment", "Electronics", "Biomedicine", "Tourism"],
    opportunities: [
      { id: "sc-1", title: "Chengdu Aerospace Industrial Park", titleZh: "成都航空航天产业园", titleRu: "Аэрокосмический индустриальный парк Чэнду", sector: "Aerospace", description: "Commercial aircraft components, satellites, and drones. Partnership with COMAC and AVIC subsidiaries.", descriptionZh: "商用飞机零部件、卫星和无人机。与中国商飞和中航工业子公司合作。", descriptionRu: "Компоненты гражданских самолётов, спутники и дроны. Партнёрство с дочерними компаниями COMAC и AVIC.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "sc-2", title: "Tianfu Software Park Gaming Hub", titleZh: "天府软件园游戏中心", titleRu: "Игровой хаб софтверного парка Тяньфу", sector: "Gaming", description: "China's gaming capital with 1,000+ studios. Localization, development, and publishing partnerships.", descriptionZh: "中国游戏之都，拥有1000多家工作室。本地化、开发和发行合作。", descriptionRu: "Игровая столица Китая с 1000+ студиями. Локализация, разработка и издательские партнёрства.", investmentRange: "$2M - $50M", timeline: "1-2 years", status: "active" },
      { id: "sc-3", title: "Chengdu-Europe Railway Gateway", titleZh: "成都-欧洲铁路门户", titleRu: "Железнодорожные ворота Чэнду-Европа", sector: "Logistics", description: "Direct rail link to Europe through Russia. Fastest route for Western China exports. Logistics and trade hub development.", descriptionZh: "经俄罗斯直达欧洲的铁路连接。西部出口最快路线。物流和贸易枢纽发展。", descriptionRu: "Прямое ж/д сообщение с Европой через Россию. Быстрейший маршрут для экспорта из Западного Китая. Развитие логистического и торгового хаба.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" },
      { id: "sc-4", title: "Sichuan Panda Cultural Tourism", titleZh: "四川大熊猫文化旅游", titleRu: "Культурный туризм с пандами Сычуань", sector: "Tourism", description: "Eco-tourism, theme parks, and cultural experiences. Growing Russian tourist interest in Sichuan.", descriptionZh: "生态旅游、主题公园和文化体验。俄罗斯游客对四川的兴趣日增。", descriptionRu: "Экотуризм, тематические парки и культурные впечатления. Растущий интерес российских туристов к Сычуани.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "sc-p1", name: "Chengdu Tianfu International Airport", nameRu: "Международный аэропорт Чэнду Тяньфу", nameZh: "成都天府国际机场", value: "$11 Billion", sector: "Aviation", description: "China's 4th largest airport. Cargo and logistics zone development ongoing.", descriptionRu: "4-й по величине аэропорт Китая. Развитие грузовой и логистической зоны продолжается.", descriptionZh: "中国第四大机场。货运和物流区开发正在进行中。", completionYear: "2025" },
      { id: "sc-p2", name: "China-Russia Sichuan Technology Park", nameRu: "Китайско-российский технопарк Сычуань", nameZh: "中俄四川科技园", value: "$150 Million", sector: "Technology", description: "Joint R&D center for aerospace, new materials, and energy technology.", descriptionRu: "Совместный центр НИОКР по аэрокосмосу, новым материалам и энергетическим технологиям.", descriptionZh: "航空航天、新材料和能源技术的联合研发中心。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "talent", title: "Tech Talent Hub", titleRu: "Хаб технологических талантов", titleZh: "科技人才中心", description: "56 universities, strong in engineering and software. Lower costs than coastal cities.", descriptionRu: "56 университетов, сильные позиции в инженерии и программировании. Более низкие затраты, чем в прибрежных городах.", descriptionZh: "56所高校，工程和软件实力雄厚。成本低于沿海城市。" },
      { icon: "infrastructure", title: "Dual Airport City", titleRu: "Город с двумя аэропортами", titleZh: "双机场城市", description: "Two international airports with direct Moscow flights. High-speed rail expanding rapidly.", descriptionRu: "Два международных аэропорта с прямыми рейсами в Москву. Высокоскоростные железные дороги быстро расширяются.", descriptionZh: "两个国际机场，有直飞莫斯科的航班。高铁网络快速扩展。" },
      { icon: "policy", title: "Western Development Zone", titleRu: "Зона развития западных регионов", titleZh: "西部开发区", description: "15% CIT rate, land discounts, and talent subsidies under national policy.", descriptionRu: "Ставка налога на прибыль 15%, скидки на землю и субсидии на таланты в рамках национальной политики.", descriptionZh: "企业所得税率15%，土地优惠和人才补贴，享受国家政策支持。" },
      { icon: "market", title: "Gateway to SW Asia", titleRu: "Ворота в ЮЗ Азию", titleZh: "西南亚门户", description: "Strategic location for accessing Southeast Asian markets via rail and road.", descriptionRu: "Стратегическое расположение для доступа к рынкам Юго-Восточной Азии по железной дороге и автомобильным путям.", descriptionZh: "通过铁路和公路进入东南亚市场的战略位置。" }
    ],
    notableEntrepreneurs: [
      { name: "Liu Yonghao", nameRu: "Лю Юнхао", nameZh: "刘永好", company: "New Hope Group", netWorth: "$7.8B", industry: "Agriculture", description: "Founder of New Hope Group, China's largest animal feed producer and agribusiness conglomerate.", descriptionRu: "Основатель New Hope Group, крупнейшего в Китае производителя кормов для животных и агропромышленного конгломерата.", descriptionZh: "新希望集团创始人，中国最大的动物饲料生产商和农业综合企业集团。", image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80" },
      { name: "Wang Jianlin", nameRu: "Ван Цзяньлинь", nameZh: "王健林", company: "Wanda Group", netWorth: "$12.5B", industry: "Real Estate & Entertainment", description: "Founder of Wanda Group, originally from Sichuan, built China's largest commercial real estate and entertainment empire.", descriptionRu: "Основатель Wanda Group, родом из Сычуани, создал крупнейшую в Китае империю коммерческой недвижимости и развлечений.", descriptionZh: "万达集团创始人，四川人，打造了中国最大的商业地产和娱乐帝国。", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" },
      { name: "Zhang Yong", nameRu: "Чжан Юн", nameZh: "张勇", company: "Haidilao", netWorth: "$8.5B", industry: "Food & Beverage", description: "Founder of Haidilao, the world's largest hot pot restaurant chain, started in Sichuan.", descriptionRu: "Основатель Haidilao, крупнейшей в мире сети ресторанов хого, начавшей свою деятельность в Сычуани.", descriptionZh: "海底捞创始人，全球最大的火锅连锁餐厅，起源于四川。", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80" }
    ],
    contactInfo: { investmentAgency: "Sichuan Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Сычуань", investmentAgencyZh: "四川省商务厅", website: "http://swt.sc.gov.cn", email: "invest@sichuan.gov.cn", phone: "+86-28-83220039" }
  },
  "Hubei": {
    name: "Hubei",
    nameRu: "Хубэй",
    nameZh: "湖北",
    gdp: "$770 Billion",
    population: "57.5 Million",
    industries: ["Automotive", "Steel", "Optoelectronics", "Biomedicine"],
    industriesRu: ["Автомобилестроение", "Металлургия", "Оптоэлектроника", "Биомедицина"],
    industriesZh: ["汽车", "钢铁", "光电子", "生物医药"],
    sezCount: 3,
    taxBenefits: ["Wuhan Optics Valley incentives", "Central China development benefits", "High-tech enterprise benefits"],
    taxBenefitsRu: ["Льготы Оптической долины Ухань", "Льготы развития Центрального Китая", "Льготы для высокотехнологичных предприятий"],
    taxBenefitsZh: ["武汉光谷优惠政策", "中部地区发展优惠", "高新技术企业优惠"],
    majorCities: [
      { id: "wuhan", name: "Wuhan", nameRu: "Ухань", nameZh: "武汉", population: "13.6M", image: "https://images.unsplash.com/photo-1568485248685-019a98426c14?w=1920&q=80", description: "Central China's megapolis spanning three cities at the Yangtze confluence. China's optical fiber and laser capital (Optics Valley). Major automotive center with Dongfeng Motor headquarters.", opportunities: [
        { id: "wh-1", title: "Optics Valley Innovation Hub", titleZh: "光谷创新中心", titleRu: "Инновационный хаб Оптической долины", sector: "Optoelectronics", description: "China's laser and fiber optics capital. BOE, Huawei optical, and 100+ laser companies. Display technology R&D.", descriptionZh: "中国激光和光纤之都。京东方、华为光电和100多家激光企业。显示技术研发。", descriptionRu: "Столица Китая по лазерам и оптоволокну. BOE, Huawei optical и 100+ лазерных компаний. R&D дисплейных технологий.", investmentRange: "$10M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "wh-2", title: "Dongfeng EV Partnership", titleZh: "东风电动汽车合作", titleRu: "Партнёрство с Dongfeng по электромобилям", sector: "Automotive", description: "Electric vehicle development with Dongfeng Motor Group. Component manufacturing and technology JVs.", descriptionZh: "与东风汽车集团合作开发电动汽车。零部件制造和技术合资企业。", descriptionRu: "Разработка электромобилей с Dongfeng Motor Group. Производство комплектующих и технологические СП.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "wh-3", title: "Wuhan Biotech Valley", titleZh: "武汉生物技术谷", titleRu: "Биотехнологическая долина Ухань", sector: "Biotech", description: "Vaccine development, biomanufacturing, and medical devices. Post-pandemic public health investment focus.", descriptionZh: "疫苗开发、生物制造和医疗器械。后疫情时代公共卫生投资重点。", descriptionRu: "Разработка вакцин, биопроизводство и медицинские устройства. Фокус на инвестициях в общественное здравоохранение.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
        { id: "wh-4", title: "Yangtze River Port Logistics", titleZh: "长江港口物流", titleRu: "Портовая логистика реки Янцзы", sector: "Logistics", description: "China's largest inland port. River transport connecting Central China to Shanghai.", descriptionZh: "中国最大的内河港口。连接华中至上海的水运。", descriptionRu: "Крупнейший внутренний порт Китая. Речное сообщение Центрального Китая с Шанхаем.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "yichang", name: "Yichang", nameRu: "Ичан", nameZh: "宜昌", population: "4.0M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Gateway to the Three Gorges Dam - world's largest hydropower station. Major chemicals and phosphate mining center. Beautiful Yangtze Gorges tourism.", opportunities: [
        { id: "yc-1", title: "Clean Energy & Chemicals", titleZh: "清洁能源与化工", titleRu: "Чистая энергия и химия", sector: "Energy", description: "Leverage Three Gorges hydropower for energy-intensive industries. Green chemicals and hydrogen.", descriptionZh: "利用三峡水电发展能源密集型产业。绿色化工和氢能。", descriptionRu: "Использование гидроэнергии Трёх ущелий для энергоёмких отраслей. Зелёная химия и водород.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
        { id: "yc-2", title: "Three Gorges Tourism", titleZh: "三峡旅游", titleRu: "Туризм Три ущелья", sector: "Tourism", description: "Dam visits, Yangtze cruises, and scenic area development. Growing international tourism.", descriptionZh: "大坝参观、长江游轮和景区开发。国际旅游增长。", descriptionRu: "Посещение плотины, круизы по Янцзы и развитие живописных зон. Рост международного туризма.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "xiangyang", name: "Xiangyang", nameRu: "Сянъян", nameZh: "襄阳", population: "5.3M", image: "https://images.unsplash.com/photo-1580844947206-7b2e1a3257c1?w=1920&q=80", description: "Ancient walled city and automotive manufacturing base. Dongfeng commercial vehicle headquarters. Strategic location on the Han River with growing aerospace industry.", opportunities: [
        { id: "xy-1", title: "Commercial Vehicle Manufacturing", titleZh: "商用车制造", titleRu: "Производство коммерческих автомобилей", sector: "Automotive", description: "Dongfeng commercial trucks, buses, and special vehicles. Component supply chain opportunities.", descriptionZh: "东风商用卡车、客车和专用车辆。零部件供应链机会。", descriptionRu: "Коммерческие грузовики, автобусы и спецтехника Dongfeng. Возможности в цепочке поставок комплектующих.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "active" },
        { id: "xy-2", title: "Aerospace Components", titleZh: "航空航天零部件", titleRu: "Аэрокосмические комплектующие", sector: "Aerospace", description: "Aviation component manufacturing for AVIC and COMAC. Growing aerospace cluster.", descriptionZh: "为中航工业和中国商飞制造航空零部件。航空航天产业集群不断壮大。", descriptionRu: "Производство авиакомпонентов для AVIC и COMAC. Растущий аэрокосмический кластер.", investmentRange: "$15M - $120M", timeline: "3-5 years", status: "upcoming" }
      ]}
    ],
    overview: "Central China's industrial heart with Wuhan as a tri-city megapolis. Optics Valley is China's laser and fiber optics capital. Strong automotive sector (Dongfeng) and emerging biotech. Strategic Yangtze River location for logistics.",
    overviewRu: "Промышленное сердце Центрального Китая с Уханем как мегаполисом из трёх городов. Оптическая долина — столица Китая по лазерам и оптоволокну. Сильный автомобильный сектор (Dongfeng) и развивающиеся биотехнологии. Стратегическое расположение на реке Янцзы для логистики.",
    overviewZh: "中部地区工业中心，武汉是三镇合一的特大城市。光谷是中国激光和光纤之都。强大的汽车产业（东风）和新兴生物技术。长江沿岸的战略物流位置。",
    targetSectors: ["Optoelectronics", "Automotive", "Biotech", "Steel & Materials", "Education"],
    opportunities: [
      { id: "hb-1", title: "Wuhan Optics Valley Expansion", titleZh: "武汉光谷扩展", titleRu: "Расширение Оптической долины Ухань", sector: "Optoelectronics", description: "Laser equipment, fiber optics, and display technology. Home to BOE, Huawei optical, and 100+ laser companies.", descriptionZh: "激光设备、光纤和显示技术。京东方、华为光电和100多家激光企业所在地。", descriptionRu: "Лазерное оборудование, оптоволокно и дисплейные технологии. Здесь расположены BOE, Huawei optical и 100+ лазерных компаний.", investmentRange: "$10M - $200M", timeline: "2-3 years", status: "priority" },
      { id: "hb-2", title: "Dongfeng Auto New Energy JV", titleZh: "东风汽车新能源合资企业", titleRu: "СП по новой энергетике Dongfeng Auto", sector: "Automotive", description: "Electric vehicle development with Dongfeng Motor Group. Component manufacturing and technology partnerships.", descriptionZh: "与东风汽车集团合作开发电动汽车。零部件制造和技术合作。", descriptionRu: "Разработка электромобилей с Dongfeng Motor Group. Производство комплектующих и технологические партнёрства.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
      { id: "hb-3", title: "Wuhan Biotech Innovation Center", titleZh: "武汉生物技术创新中心", titleRu: "Инновационный биотех-центр Ухань", sector: "Biotech", description: "Vaccine development, biomanufacturing, and medical devices. Leveraging post-pandemic investment in public health.", descriptionZh: "疫苗开发、生物制造和医疗器械。利用后疫情时代对公共卫生的投资。", descriptionRu: "Разработка вакцин, биопроизводство и медицинские устройства. Использование постпандемийных инвестиций в здравоохранение.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "hb-4", title: "Yangtze River Industrial Corridor", titleZh: "长江产业走廊", titleRu: "Промышленный коридор Янцзы", sector: "Logistics", description: "River port development connecting Central China to Shanghai. Steel, grain, and container logistics.", descriptionZh: "连接华中至上海的河港发展。钢铁、粮食和集装箱物流。", descriptionRu: "Развитие речного порта, связывающего Центральный Китай с Шанхаем. Логистика стали, зерна и контейнеров.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "hb-p1", name: "YMTC Memory Chip Expansion", nameRu: "Расширение производства чипов памяти YMTC", nameZh: "长江存储芯片扩产", value: "$24 Billion", sector: "Semiconductor", description: "China's leading NAND manufacturer expanding capacity. Supply chain opportunities.", descriptionRu: "Ведущий китайский производитель NAND расширяет мощности. Возможности в цепочке поставок.", descriptionZh: "中国领先的NAND制造商扩大产能。供应链机会。", partners: ["YMTC"], completionYear: "2027" },
      { id: "hb-p2", name: "Wuhan High-Speed Rail Hub", nameRu: "Высокоскоростной железнодорожный хаб Ухань", nameZh: "武汉高铁枢纽", value: "$3 Billion", sector: "Infrastructure", description: "Central China's largest rail hub expansion.", descriptionRu: "Расширение крупнейшего железнодорожного хаба Центрального Китая.", descriptionZh: "中部地区最大铁路枢纽扩建。", completionYear: "2028" }
    ],
    advantages: [
      { icon: "tech", title: "Optics Valley", titleRu: "Оптическая долина", titleZh: "光谷", description: "China's fiber optics and laser capital. 30% of China's optical fiber produced here.", descriptionRu: "Столица Китая по оптоволокну и лазерам. Здесь производится 30% оптоволокна Китая.", descriptionZh: "中国光纤和激光之都。中国30%的光纤在此生产。" },
      { icon: "talent", title: "University City", titleRu: "Университетский город", titleZh: "大学城", description: "89 universities with 1.3 million students. Strongest engineering talent in Central China.", descriptionRu: "89 университетов с 1,3 миллиона студентов. Сильнейшие инженерные кадры в Центральном Китае.", descriptionZh: "89所高校，130万学生。中部地区最强的工程人才。" },
      { icon: "logistics", title: "Yangtze Gateway", titleRu: "Ворота Янцзы", titleZh: "长江门户", description: "Wuhan Port is largest inland port. Direct water route to Shanghai.", descriptionRu: "Порт Ухань — крупнейший внутренний порт. Прямой водный путь до Шанхая.", descriptionZh: "武汉港是最大的内河港口。直达上海的水路。" },
      { icon: "infrastructure", title: "Transportation Hub", titleRu: "Транспортный хаб", titleZh: "交通枢纽", description: "High-speed rail connections to all major cities within 4 hours.", descriptionRu: "Высокоскоростное железнодорожное сообщение со всеми крупными городами в пределах 4 часов.", descriptionZh: "4小时内高铁连接所有主要城市。" }
    ],
    contactInfo: { investmentAgency: "Hubei Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Хубэй", investmentAgencyZh: "湖北省商务厅", website: "http://swt.hubei.gov.cn", email: "invest@hubei.gov.cn", phone: "+86-27-87235520" }
  },
  "Hunan": {
    name: "Hunan",
    nameRu: "Хунань",
    nameZh: "湖南",
    gdp: "$680 Billion",
    population: "66.2 Million",
    industries: ["Construction Machinery", "Electronics", "Agriculture", "Culture Media"],
    industriesRu: ["Строительная техника", "Электроника", "Сельское хозяйство", "Медиа и культура"],
    industriesZh: ["工程机械", "电子", "农业", "文化传媒"],
    sezCount: 2,
    taxBenefits: ["Changsha Economic Zone benefits", "Central China incentives", "Cultural industry support"],
    taxBenefitsRu: ["Льготы экономической зоны Чанша", "Льготы Центрального Китая", "Поддержка культурной индустрии"],
    taxBenefitsZh: ["长沙经济区优惠", "中部地区优惠政策", "文化产业扶持"],
    majorCities: [
      { id: "changsha", name: "Changsha", nameRu: "Чанша", nameZh: "长沙", population: "10.5M", image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1920&q=80", description: "Capital of Hunan and emerging tech hub. Home to SANY and Zoomlion headquarters - world's largest construction machinery makers. Vibrant entertainment industry and famous for spicy cuisine.", opportunities: [
        { id: "cs-1", title: "SANY-Russia Heavy Machinery JV", titleZh: "三一-俄罗斯重型机械合资", titleRu: "СП SANY-Россия по тяжёлой технике", sector: "Construction Machinery", description: "Partner with world's largest concrete machinery maker. Mining and construction equipment for Russian market.", descriptionZh: "与世界最大混凝土机械制造商合作。面向俄罗斯市场的矿山和建筑设备。", descriptionRu: "Партнёрство с крупнейшим в мире производителем бетонной техники. Горное и строительное оборудование для российского рынка.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "cs-2", title: "Changsha AI Manufacturing Hub", titleZh: "长沙AI制造中心", titleRu: "Хаб ИИ-производства Чанша", sector: "AI", description: "Industrial AI applications for smart factories. Autonomous construction equipment development.", descriptionZh: "工业AI应用于智能工厂。自主建筑设备开发。", descriptionRu: "Промышленный ИИ для умных заводов. Разработка автономного строительного оборудования.", investmentRange: "$5M - $80M", timeline: "2-4 years", status: "active" },
        { id: "cs-3", title: "Mango TV Media Partnership", titleZh: "芒果TV媒体合作", titleRu: "Медиа-партнёрство с Mango TV", sector: "Entertainment", description: "Content co-production and streaming platform partnerships with China's top entertainment network.", descriptionZh: "与中国顶级娱乐网络合作制作内容和流媒体平台合作。", descriptionRu: "Совместное производство контента и партнёрство по стриминговым платформам с топовой развлекательной сетью Китая.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "zhuzhou", name: "Zhuzhou", nameRu: "Чжучжоу", nameZh: "株洲", population: "3.9M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "China's rail transport capital. Home to CRRC Zhuzhou producing electric locomotives, metro trains, and maglev systems. Key supplier for Belt and Road rail projects.", opportunities: [
        { id: "zz-1", title: "CRRC Rail Equipment Partnership", titleZh: "中国中车铁路设备合作", titleRu: "Партнёрство с CRRC по ж/д оборудованию", sector: "Rail Transport", description: "Electric locomotives and metro systems for Russia modernization. Technology transfer and local production.", descriptionZh: "用于俄罗斯现代化的电力机车和地铁系统。技术转让和本地化生产。", descriptionRu: "Электровозы и системы метро для модернизации России. Трансфер технологий и локальное производство.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
        { id: "zz-2", title: "Maglev Technology Cooperation", titleZh: "磁悬浮技术合作", titleRu: "Сотрудничество по технологии маглев", sector: "Transport", description: "Medium-speed maglev for urban transit. China's most advanced maglev technology.", descriptionZh: "用于城市交通的中速磁悬浮。中国最先进的磁悬浮技术。", descriptionRu: "Среднескоростной маглев для городского транспорта. Самая передовая технология маглев в Китае.", investmentRange: "$100M - $800M", timeline: "5-7 years", status: "upcoming" },
        { id: "zz-3", title: "Rail Components Manufacturing", titleZh: "铁路零部件制造", titleRu: "Производство ж/д комплектующих", sector: "Manufacturing", description: "Traction systems, signaling, and rolling stock components for rail industry.", descriptionZh: "牵引系统、信号系统和铁路行业的机车车辆零部件。", descriptionRu: "Тяговые системы, сигнализация и комплектующие подвижного состава для железных дорог.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "xiangtan", name: "Xiangtan", nameRu: "Сянтань", nameZh: "湘潭", population: "2.7M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "Birthplace of Chairman Mao and industrial city in the Changsha-Zhuzhou-Xiangtan city cluster. Strong in steel, machinery, and new energy vehicles.", opportunities: [
        { id: "xt-1", title: "Xiangtan Steel Green Upgrade", titleZh: "湘潭钢铁绿色升级", titleRu: "Зелёная модернизация стали Сянтань", sector: "Steel", description: "Low-carbon steel production technology. Hydrogen-based steelmaking pilot.", descriptionZh: "低碳钢铁生产技术。氢基炼钢试点。", descriptionRu: "Низкоуглеродные технологии производства стали. Пилотное производство стали на водороде.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
        { id: "xt-2", title: "Electric Bus Manufacturing", titleZh: "电动客车制造", titleRu: "Производство электрических автобусов", sector: "EV", description: "Electric bus production for urban transit. Strong domestic demand and export potential.", descriptionZh: "用于城市交通的电动客车生产。强劲的国内需求和出口潜力。", descriptionRu: "Производство электробусов для городского транспорта. Сильный внутренний спрос и экспортный потенциал.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Home to construction machinery giants SANY and Zoomlion. Strong in rail transport equipment (CRRC Zhuzhou), entertainment media, and agriculture. Changsha is an emerging cultural and innovation hub.",
    overviewRu: "Родина гигантов строительной техники SANY и Zoomlion. Сильные позиции в железнодорожном транспортном оборудовании (CRRC Zhuzhou), развлекательных медиа и сельском хозяйстве. Чанша — развивающийся культурный и инновационный центр.",
    overviewZh: "三一重工和中联重科等工程机械巨头的总部所在地。在轨道交通装备（中车株洲）、娱乐传媒和农业方面实力雄厚。长沙是新兴的文化和创新中心。",
    targetSectors: ["Construction Machinery", "Rail Transport", "Media & Entertainment", "Agriculture", "New Materials"],
    opportunities: [
      { id: "hun-1", title: "SANY Heavy Equipment JV", titleZh: "三一重工合资企业", titleRu: "СП SANY по тяжёлому оборудованию", sector: "Machinery", description: "Partnership opportunities with world's largest concrete machinery manufacturer. Export and technology cooperation.", descriptionZh: "与世界最大混凝土机械制造商的合作机会。出口和技术合作。", descriptionRu: "Возможности партнёрства с крупнейшим в мире производителем бетонной техники. Экспорт и технологическое сотрудничество.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "active" },
      { id: "hun-2", title: "Zhuzhou Rail Innovation Hub", titleZh: "株洲铁路创新中心", titleRu: "Инновационный ж/д хаб Чжучжоу", sector: "Rail", description: "R&D for electric locomotives, metro systems, and maglev. CRRC partnership opportunities.", descriptionZh: "电力机车、地铁系统和磁悬浮的研发。中国中车合作机会。", descriptionRu: "R&D электровозов, систем метро и маглева. Возможности партнёрства с CRRC.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" }
    ],
    keyProjects: [
      { id: "hun-p1", name: "Changsha AI Industrial Park", nameRu: "Индустриальный парк ИИ Чанша", nameZh: "长沙人工智能产业园", value: "$500 Million", sector: "AI", description: "AI applications for manufacturing and autonomous vehicles.", descriptionRu: "Применение ИИ в производстве и автономных транспортных средствах.", descriptionZh: "人工智能在制造业和自动驾驶汽车中的应用。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "infrastructure", title: "Machinery Capital", titleRu: "Столица машиностроения", titleZh: "机械之都", description: "SANY, Zoomlion headquarters. Complete construction equipment supply chain.", descriptionRu: "Штаб-квартиры SANY и Zoomlion. Полная цепочка поставок строительного оборудования.", descriptionZh: "三一重工、中联重科总部所在地。完整的工程机械供应链。" },
      { icon: "talent", title: "Engineering Excellence", titleRu: "Инженерное превосходство", titleZh: "工程卓越", description: "Strong technical universities and vocational training.", descriptionRu: "Сильные технические университеты и профессиональное обучение.", descriptionZh: "强大的技术大学和职业培训。" }
    ],
    contactInfo: { investmentAgency: "Hunan Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Хунань", investmentAgencyZh: "湖南省商务厅", website: "http://swt.hunan.gov.cn", email: "invest@hunan.gov.cn" }
  },
  "Fujian": {
    name: "Fujian",
    nameRu: "Фуцзянь",
    nameZh: "福建",
    gdp: "$730 Billion",
    population: "41.5 Million",
    industries: ["Electronics", "Machinery", "Textiles", "Maritime Trade"],
    industriesRu: ["Электроника", "Машиностроение", "Текстиль", "Морская торговля"],
    industriesZh: ["电子", "机械", "纺织", "海上贸易"],
    sezCount: 4,
    taxBenefits: ["Xiamen SEZ benefits", "Taiwan Strait incentives", "Free trade pilot zone"],
    taxBenefitsRu: ["Льготы ОЭЗ Сямэнь", "Льготы Тайваньского пролива", "Пилотная зона свободной торговли"],
    taxBenefitsZh: ["厦门经济特区优惠", "台湾海峡优惠政策", "自贸试验区"],
    majorCities: [
      { id: "fuzhou", name: "Fuzhou", nameRu: "Фучжоу", nameZh: "福州", population: "8.3M", image: "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=1920&q=80", description: "Provincial capital with rich history and growing tech sector. Headquarters of Ningde (CATL) nearby - world's largest EV battery maker. Strong textile and electronics industries.", opportunities: [
        { id: "fz-1", title: "CATL Battery Supply Chain", titleZh: "宁德时代电池供应链", titleRu: "Цепочка поставок батарей CATL", sector: "Battery", description: "Component supplier partnerships with world's largest battery maker. Cathode, anode, and separator materials.", descriptionZh: "与世界最大电池制造商的零部件供应商合作。正极、负极和隔膜材料。", descriptionRu: "Партнёрства с крупнейшим в мире производителем батарей. Катодные, анодные и сепараторные материалы.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
        { id: "fz-2", title: "Fuzhou Software Park", titleZh: "福州软件园", titleRu: "Софтверный парк Фучжоу", sector: "Software", description: "Software development and BPO services. Strong talent from local universities.", descriptionZh: "软件开发和BPO服务。本地大学人才充足。", descriptionRu: "Разработка ПО и BPO-услуги. Сильный кадровый потенциал из местных университетов.", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "active" },
        { id: "fz-3", title: "Fujian FTZ Headquarters", titleZh: "福建自贸区总部", titleRu: "Штаб-квартира ЗСТ Фуцзянь", sector: "Trade", description: "Regional headquarters for Russia-China trade operations. Bonded logistics and trade finance.", descriptionZh: "中俄贸易运营区域总部。保税物流和贸易金融。", descriptionRu: "Региональная штаб-квартира для российско-китайской торговли. Таможенная логистика и торговое финансирование.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "xiamen", name: "Xiamen", nameRu: "Сямэнь", nameZh: "厦门", population: "5.3M", image: "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=1920&q=80", description: "Beautiful coastal city and original SEZ. Known as China's garden city with excellent quality of life. Strong in electronics, software, and cross-strait trade.", opportunities: [
        { id: "xm-1", title: "Xiamen Cross-Strait E-commerce", titleZh: "厦门两岸电商", titleRu: "Трансграничная электронная торговля Сямэнь", sector: "E-commerce", description: "E-commerce platform leveraging Taiwan and Southeast Asia trade networks.", descriptionZh: "利用台湾和东南亚贸易网络的电商平台。", descriptionRu: "Платформа e-commerce, использующая торговые сети Тайваня и Юго-Восточной Азии.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "xm-2", title: "Xiamen Software Park II", titleZh: "厦门软件园二期", titleRu: "Софтверный парк Сямэнь II", sector: "IT", description: "Software development and IT services. Dell, IBM, and local firms present.", descriptionZh: "软件开发和IT服务。戴尔、IBM和本地企业入驻。", descriptionRu: "Разработка ПО и ИТ-услуги. Присутствуют Dell, IBM и местные компании.", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "active" },
        { id: "xm-3", title: "Xiamen Port Logistics Hub", titleZh: "厦门港物流枢纽", titleRu: "Логистический хаб порта Сямэнь", sector: "Logistics", description: "Container shipping and logistics for Southeast Asia trade. Direct Russia routes via Arctic.", descriptionZh: "东南亚贸易的集装箱航运和物流。经北极直达俄罗斯航线。", descriptionRu: "Контейнерные перевозки и логистика для торговли с ЮВА. Прямые маршруты в Россию через Арктику.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "quanzhou", name: "Quanzhou", nameRu: "Цюаньчжоу", nameZh: "泉州", population: "8.8M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Ancient maritime Silk Road starting point. China's sportswear capital - home to Anta, 361°, and Peak. Strong in shoes, textiles, and stone materials.", opportunities: [
        { id: "qz-1", title: "Sportswear Manufacturing JV", titleZh: "运动服装制造合资", titleRu: "СП по производству спортивной одежды", sector: "Apparel", description: "Partnership with Anta, 361°, Peak for Russian market sportswear. OEM and brand licensing.", descriptionZh: "与安踏、361°、匹克合作面向俄罗斯市场的运动服装。OEM和品牌授权。", descriptionRu: "Партнёрство с Anta, 361°, Peak для спортивной одежды на российский рынок. OEM и лицензирование брендов.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "priority" },
        { id: "qz-2", title: "Smart Textile Manufacturing", titleZh: "智能纺织制造", titleRu: "Умное текстильное производство", sector: "Textiles", description: "Industry 4.0 textile production. Automated garment manufacturing.", descriptionZh: "工业4.0纺织生产。自动化服装制造。", descriptionRu: "Текстильное производство Индустрии 4.0. Автоматизированное производство одежды.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
        { id: "qz-3", title: "Quanzhou Stone Materials", titleZh: "泉州石材", titleRu: "Каменные материалы Цюаньчжоу", sector: "Materials", description: "Premium stone and ceramic tiles for construction. Export to Russia and Central Asia.", descriptionZh: "用于建筑的优质石材和陶瓷砖。出口到俄罗斯和中亚。", descriptionRu: "Премиальный камень и керамическая плитка для строительства. Экспорт в Россию и Центральную Азию.", investmentRange: "$5M - $40M", timeline: "1-2 years", status: "active" }
      ]}
    ],
    overview: "Taiwan-facing province with special cross-strait policies. Xiamen is a beautiful coastal city with strong trade ties. Strong in electronics, sportswear (Anta, Li-Ning), and tea. Gateway for Taiwan investment into mainland.",
    overviewRu: "Провинция, обращённая к Тайваню, со специальной политикой в отношении пролива. Сямэнь — красивый прибрежный город с сильными торговыми связями. Сильные позиции в электронике, спортивной одежде (Anta, Li-Ning) и чае. Ворота для тайваньских инвестиций на материк.",
    overviewZh: "面向台湾的省份，拥有特殊的两岸政策。厦门是一座美丽的沿海城市，贸易联系紧密。在电子、运动服装（安踏、李宁）和茶叶方面实力雄厚。台湾投资进入大陆的门户。",
    targetSectors: ["Electronics", "Sportswear & Apparel", "Taiwan Trade", "Maritime", "New Energy"],
    opportunities: [
      { id: "fj-1", title: "Xiamen Cross-Strait E-commerce Zone", titleZh: "厦门两岸电商区", titleRu: "Зона трансграничной e-commerce Сямэнь", sector: "E-commerce", description: "Leverage Taiwan trade relationships and logistics infrastructure for regional e-commerce.", descriptionZh: "利用台湾贸易关系和物流基础设施发展区域电商。", descriptionRu: "Использование торговых связей с Тайванем и логистической инфраструктуры для региональной e-commerce.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
      { id: "fj-2", title: "Fuzhou New Energy Vehicle Cluster", titleZh: "福州新能源汽车集群", titleRu: "Кластер электромобилей Фучжоу", sector: "EV", description: "CATL battery headquarters region. EV supply chain opportunities.", descriptionZh: "宁德时代电池总部所在地区。电动汽车供应链机会。", descriptionRu: "Регион штаб-квартиры CATL. Возможности в цепочке поставок электромобилей.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" }
    ],
    keyProjects: [
      { id: "fj-p1", name: "CATL Battery Expansion", nameRu: "Расширение производства батарей CATL", nameZh: "宁德时代电池扩产", value: "$5 Billion", sector: "Battery", description: "World's largest battery maker expanding in home province.", descriptionRu: "Крупнейший в мире производитель батарей расширяется в родной провинции.", descriptionZh: "全球最大电池制造商在本省扩产。", partners: ["CATL"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "policy", title: "Taiwan Gateway", titleRu: "Ворота на Тайвань", titleZh: "台湾门户", description: "Special policies for Taiwan business. Unique cross-strait opportunities.", descriptionRu: "Специальная политика для тайваньского бизнеса. Уникальные возможности через пролив.", descriptionZh: "针对台湾企业的特殊政策。独特的两岸机遇。" },
      { icon: "logistics", title: "Maritime Hub", titleRu: "Морской хаб", titleZh: "海上枢纽", description: "Major ports facing Taiwan and Southeast Asia.", descriptionRu: "Крупные порты, обращённые к Тайваню и Юго-Восточной Азии.", descriptionZh: "面向台湾和东南亚的主要港口。" }
    ],
    contactInfo: { investmentAgency: "Fujian Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Фуцзянь", investmentAgencyZh: "福建省商务厅", website: "http://swt.fujian.gov.cn", email: "invest@fujian.gov.cn" }
  },
  "Anhui": {
    name: "Anhui",
    nameRu: "Аньхой",
    nameZh: "安徽",
    gdp: "$680 Billion",
    population: "61 Million",
    industries: ["Automotive", "Home Appliances", "New Energy", "AI"],
    industriesRu: ["Автомобилестроение", "Бытовая техника", "Новая энергетика", "ИИ"],
    industriesZh: ["汽车", "家电", "新能源", "人工智能"],
    sezCount: 2,
    taxBenefits: ["Hefei high-tech zone benefits", "Yangtze Delta integration incentives", "New energy vehicle support"],
    taxBenefitsRu: ["Льготы высокотехнологичной зоны Хэфэй", "Льготы интеграции дельты Янцзы", "Поддержка электромобилей"],
    taxBenefitsZh: ["合肥高新区优惠", "长三角一体化优惠政策", "新能源汽车扶持"],
    majorCities: [
      { id: "hefei", name: "Hefei", nameRu: "Хэфэй", nameZh: "合肥", population: "9.4M", image: "https://images.unsplash.com/photo-1617952739858-28043cecdae3?w=1920&q=80", description: "China's fastest-rising tech hub and new EV capital. Home to NIO HQ, VW EV plant, USTC (quantum computing leader), and iFlytek (voice AI). Aggressive government investment strategy attracting global firms.", opportunities: [
        { id: "hf-1", title: "NIO EV Supply Partnership", titleZh: "蔚来电动汽车供应合作", titleRu: "Партнёрство по поставкам NIO EV", sector: "EV", description: "Direct supplier relationships with premium EV maker. Battery, motors, electronics, and software.", descriptionZh: "与高端电动汽车制造商的直接供应商关系。电池、电机、电子和软件。", descriptionRu: "Прямые отношения с поставщиками премиального производителя электромобилей. Батареи, моторы, электроника и ПО.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "hf-2", title: "Hefei Quantum Computing Hub", titleZh: "合肥量子计算中心", titleRu: "Хаб квантовых вычислений Хэфэй", sector: "Quantum", description: "China's quantum technology center with USTC. Quantum communication and computing research.", descriptionZh: "与中科大合作的中国量子技术中心。量子通信和计算研究。", descriptionRu: "Китайский центр квантовых технологий с USTC. Исследования в области квантовой связи и вычислений.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "upcoming" },
        { id: "hf-3", title: "iFlytek AI Ecosystem", titleZh: "科大讯飞AI生态", titleRu: "Экосистема ИИ iFlytek", sector: "AI", description: "Voice recognition and AI partnerships with China's leading AI company.", descriptionZh: "与中国领先的人工智能公司合作语音识别和AI。", descriptionRu: "Партнёрства по распознаванию речи и ИИ с ведущей китайской ИИ-компанией.", investmentRange: "$5M - $80M", timeline: "1-3 years", status: "active" },
        { id: "hf-4", title: "BOE Display Technology Park", titleZh: "京东方显示技术园区", titleRu: "Технопарк дисплеев BOE", sector: "Display", description: "LCD and OLED display manufacturing. Supply chain for global electronics.", descriptionZh: "LCD和OLED显示器制造。全球电子产品供应链。", descriptionRu: "Производство LCD и OLED дисплеев. Цепочка поставок для мировой электроники.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "wuhu", name: "Wuhu", nameRu: "Уху", nameZh: "芜湖", population: "3.6M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "Home to Chery Automobile - China's largest automotive exporter. Major robotics and new materials center on the Yangtze River.", opportunities: [
        { id: "wh-1", title: "Chery Auto Export Partnership", titleZh: "奇瑞汽车出口合作", titleRu: "Партнёрство по экспорту Chery Auto", sector: "Automotive", description: "Partnership with China's top car exporter. CKD assembly and distribution for Russia.", descriptionZh: "与中国最大汽车出口商合作。面向俄罗斯的CKD组装和分销。", descriptionRu: "Партнёрство с крупнейшим автоэкспортёром Китая. CKD-сборка и дистрибуция для России.", investmentRange: "$30M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "wh-2", title: "Wuhu Robotics Cluster", titleZh: "芜湖机器人集群", titleRu: "Робототехнический кластер Уху", sector: "Robotics", description: "Industrial robotics manufacturing. EFORT and other leading robot makers.", descriptionZh: "工业机器人制造。埃夫特等领先机器人制造商。", descriptionRu: "Производство промышленных роботов. EFORT и другие ведущие производители роботов.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "maanshan", name: "Ma'anshan", nameRu: "Мааньшань", nameZh: "马鞍山", population: "2.2M", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=80", description: "Major steel city transitioning to advanced manufacturing. Strategic location near Nanjing with excellent logistics connections.", opportunities: [
        { id: "mas-1", title: "Green Steel Technology", titleZh: "绿色钢铁技术", titleRu: "Зелёные стальные технологии", sector: "Steel", description: "Low-carbon steel production. Hydrogen-based reduction technology.", descriptionZh: "低碳钢铁生产。氢基还原技术。", descriptionRu: "Низкоуглеродное производство стали. Технология восстановления на водороде.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" },
        { id: "mas-2", title: "New Materials Industrial Park", titleZh: "新材料产业园", titleRu: "Индустриальный парк новых материалов", sector: "Materials", description: "Advanced steel products and new materials for automotive and construction.", descriptionZh: "用于汽车和建筑的先进钢材产品和新材料。", descriptionRu: "Передовые стальные изделия и новые материалы для автомобилей и строительства.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Fastest-growing provincial economy and EV powerhouse. Hefei attracted NIO, Volkswagen, and emerging as AI center. Home appliance giants (Midea factories), display technology (BOE), and quantum computing research.",
    overviewRu: "Самая быстрорастущая провинциальная экономика и центр электромобилей. Хэфэй привлёк NIO, Volkswagen и становится центром ИИ. Гиганты бытовой техники (заводы Midea), дисплейные технологии (BOE) и исследования квантовых вычислений.",
    overviewZh: "增长最快的省级经济体和电动汽车强省。合肥吸引了蔚来、大众，正在成为人工智能中心。家电巨头（美的工厂）、显示技术（京东方）和量子计算研究。",
    targetSectors: ["Electric Vehicles", "AI & Quantum Computing", "Home Appliances", "Display Technology", "New Materials"],
    opportunities: [
      { id: "ah-1", title: "Hefei EV Capital Investment", titleZh: "合肥电动汽车之都投资", titleRu: "Инвестиции в EV-столицу Хэфэй", sector: "EV", description: "NIO headquarters, VW EV factory, and 200+ EV suppliers. Complete supply chain for electric vehicles.", descriptionZh: "蔚来总部、大众电动汽车工厂和200多家电动汽车供应商。完整的电动汽车供应链。", descriptionRu: "Штаб-квартира NIO, завод электромобилей VW и 200+ поставщиков. Полная цепочка поставок для электромобилей.", investmentRange: "$20M - $500M", timeline: "2-4 years", status: "priority" },
      { id: "ah-2", title: "Quantum Computing Research Park", titleZh: "量子计算研究园", titleRu: "Исследовательский парк квантовых вычислений", sector: "Quantum", description: "China's quantum computing center with USTC partnership. Cutting-edge research opportunities.", descriptionZh: "与中科大合作的中国量子计算中心。尖端研究机会。", descriptionRu: "Китайский центр квантовых вычислений в партнёрстве с USTC. Возможности передовых исследований.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "upcoming" }
    ],
    keyProjects: [
      { id: "ah-p1", name: "NIO Hefei Advanced Manufacturing", nameRu: "Передовое производство NIO в Хэфэй", nameZh: "蔚来合肥先进制造", value: "$1 Billion", sector: "EV", description: "Premium EV manufacturing expansion.", descriptionRu: "Расширение производства премиальных электромобилей.", descriptionZh: "高端电动汽车制造扩产。", partners: ["NIO"], completionYear: "2026" }
    ],
    advantages: [
      { icon: "tech", title: "EV Capital", titleRu: "Столица электромобилей", titleZh: "电动汽车之都", description: "China's emerging electric vehicle center with full supply chain.", descriptionRu: "Развивающийся центр электромобилей Китая с полной цепочкой поставок.", descriptionZh: "中国新兴的电动汽车中心，拥有完整供应链。" },
      { icon: "talent", title: "USTC Excellence", titleRu: "Превосходство USTC", titleZh: "中科大卓越", description: "Top science university with quantum computing breakthroughs.", descriptionRu: "Ведущий научный университет с прорывами в квантовых вычислениях.", descriptionZh: "顶尖科学大学，在量子计算方面取得突破。" }
    ],
    contactInfo: { investmentAgency: "Anhui Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Аньхой", investmentAgencyZh: "安徽省商务厅", website: "http://swt.ah.gov.cn", email: "invest@anhui.gov.cn" }
  },
  "Liaoning": {
    name: "Liaoning",
    nameRu: "Ляонин",
    nameZh: "辽宁",
    gdp: "$400 Billion",
    population: "42.5 Million",
    industries: ["Heavy Industry", "Shipbuilding", "Petrochemicals", "Equipment Manufacturing"],
    industriesRu: ["Тяжёлая промышленность", "Судостроение", "Нефтехимия", "Производство оборудования"],
    industriesZh: ["重工业", "造船", "石化", "装备制造"],
    sezCount: 3,
    taxBenefits: ["Northeast revitalization incentives", "Dalian FTZ benefits", "Equipment manufacturing support"],
    taxBenefitsRu: ["Льготы возрождения Северо-Востока", "Льготы ЗСТ Далянь", "Поддержка производства оборудования"],
    taxBenefitsZh: ["东北振兴优惠政策", "大连自贸区优惠", "装备制造业扶持"],
    majorCities: [
      { id: "shenyang", name: "Shenyang", nameRu: "Шэньян", nameZh: "沈阳", population: "9.1M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Northeast China's largest city and traditional heavy industry capital. Home to Shenyang Machine Tool, BMW Brilliance, and major aerospace facilities. Deep Russian influence in architecture and culture.", opportunities: [
        { id: "sy-1", title: "Shenyang Heavy Machinery 4.0", titleZh: "沈阳重型机械4.0", titleRu: "Тяжёлое машиностроение Шэньян 4.0", sector: "Machinery", description: "Smart manufacturing upgrades for machine tools and industrial equipment. German-style precision engineering.", descriptionZh: "机床和工业设备的智能制造升级。德式精密工程。", descriptionRu: "Умная модернизация станков и промышленного оборудования. Немецкое точное машиностроение.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "sy-2", title: "BMW Brilliance Supply Chain", titleZh: "华晨宝马供应链", titleRu: "Цепочка поставок BMW Brilliance", sector: "Automotive", description: "Component supply for BMW's largest global production base. Premium auto parts.", descriptionZh: "为宝马全球最大生产基地提供零部件供应。高端汽车零部件。", descriptionRu: "Поставка комплектующих для крупнейшей глобальной базы производства BMW. Премиальные автозапчасти.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" },
        { id: "sy-3", title: "Shenyang Aerospace Industrial Park", titleZh: "沈阳航空航天产业园", titleRu: "Аэрокосмический индустриальный парк Шэньян", sector: "Aerospace", description: "Aircraft components and UAV manufacturing. AVIC partnership opportunities.", descriptionZh: "飞机零部件和无人机制造。中航工业合作机会。", descriptionRu: "Производство авиакомпонентов и БПЛА. Возможности партнёрства с AVIC.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "dalian", name: "Dalian", nameRu: "Далянь", nameZh: "大连", population: "7.5M", image: "https://images.unsplash.com/photo-1559682468-a6a29e7d9517?w=1920&q=80", description: "Beautiful coastal city dubbed 'Northern Hong Kong'. Major port with direct Russia routes, strong software industry, and shipbuilding. Popular Japanese and Korean business destination.", opportunities: [
        { id: "dl-1", title: "Dalian Russia Trade Hub", titleZh: "大连俄罗斯贸易中心", titleRu: "Торговый хаб Россия-Далянь", sector: "Trade", description: "Comprehensive trade zone for Russia imports/exports. Direct shipping to Vladivostok (2 days).", descriptionZh: "俄罗斯进出口综合贸易区。直达符拉迪沃斯托克的航运（2天）。", descriptionRu: "Комплексная торговая зона для импорта/экспорта с Россией. Прямая доставка во Владивосток (2 дня).", investmentRange: "$10M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "dl-2", title: "Dalian Software Park", titleZh: "大连软件园", titleRu: "Софтверный парк Далянь", sector: "IT", description: "Japan/Korea outsourcing hub expanding to Russia. 100,000+ IT professionals.", descriptionZh: "日韩外包中心扩展至俄罗斯。10万多名IT专业人员。", descriptionRu: "Хаб аутсорсинга для Японии/Кореи, расширяющийся на Россию. 100 000+ ИТ-специалистов.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "dl-3", title: "Dalian Shipbuilding Partnership", titleZh: "大连造船合作", titleRu: "Партнёрство с судостроением Далянь", sector: "Shipbuilding", description: "LNG carriers, tankers, and container ships. Dalian Shipbuilding is among world's largest.", descriptionZh: "LNG船、油轮和集装箱船。大连船舶重工是世界最大的造船厂之一。", descriptionRu: "СПГ-танкеры, нефтеналивные и контейнеровозы. Dalian Shipbuilding — один из крупнейших в мире.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "dl-4", title: "Dalian Petrochemical Complex", titleZh: "大连石化综合体", titleRu: "Нефтехимический комплекс Далянь", sector: "Petrochemicals", description: "Downstream oil processing and specialty chemicals. Russian crude processing.", descriptionZh: "下游石油加工和特种化学品。俄罗斯原油加工。", descriptionRu: "Переработка нефтепродуктов и спецхимия. Переработка российской нефти.", investmentRange: "$100M - $800M", timeline: "4-6 years", status: "upcoming" }
      ]},
      { id: "anshan", name: "Anshan", nameRu: "Аньшань", nameZh: "鞍山", population: "3.3M", image: "https://images.unsplash.com/photo-1597473322203-2c4f0e36e1c3?w=1920&q=80", description: "Steel capital of China with Ansteel Group - one of world's largest steelmakers. Rich iron ore reserves and complete metallurgy supply chain.", opportunities: [
        { id: "as-1", title: "Ansteel Green Steel Partnership", titleZh: "鞍钢绿色钢铁合作", titleRu: "Партнёрство с Ansteel по зелёной стали", sector: "Steel", description: "Low-carbon steel production and technology. Electric arc furnace and hydrogen reduction.", descriptionZh: "低碳钢铁生产和技术。电弧炉和氢还原。", descriptionRu: "Низкоуглеродное производство стали и технологии. Дуговая печь и водородное восстановление.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
        { id: "as-2", title: "Steel Products Processing", titleZh: "钢铁产品加工", titleRu: "Переработка стальной продукции", sector: "Manufacturing", description: "High-value steel products for automotive and construction. Specialized alloys.", descriptionZh: "用于汽车和建筑的高价值钢材产品。特种合金。", descriptionRu: "Высококачественные стальные изделия для автомобилей и строительства. Специальные сплавы.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Northeast China's industrial heartland with strong Russian ties. Dalian is a major port and tech hub; Shenyang leads in heavy machinery. Deep historical and economic connections with Russia.",
    overviewRu: "Промышленное сердце Северо-Восточного Китая с прочными связями с Россией. Далянь — крупный порт и технологический хаб; Шэньян лидирует в тяжёлом машиностроении. Глубокие исторические и экономические связи с Россией.",
    overviewZh: "中国东北工业腹地，与俄罗斯关系密切。大连是主要港口和科技中心；沈阳在重型机械领域领先。与俄罗斯有深厚的历史和经济联系。",
    targetSectors: ["Heavy Machinery", "Shipbuilding", "Petrochemicals", "Russia Trade", "Software"],
    opportunities: [
      { id: "ln-1", title: "Dalian Russia Trade Gateway", titleZh: "大连俄罗斯贸易门户", titleRu: "Торговые ворота Далянь-Россия", sector: "Trade", description: "Direct shipping to Vladivostok, trade processing zone for Russian goods.", descriptionZh: "直达符拉迪沃斯托克的航运，俄罗斯商品贸易加工区。", descriptionRu: "Прямая доставка во Владивосток, зона обработки торговли для российских товаров.", investmentRange: "$10M - $100M", timeline: "1-3 years", status: "priority" },
      { id: "ln-2", title: "Shenyang Heavy Equipment Modernization", titleZh: "沈阳重型设备现代化", titleRu: "Модернизация тяжёлого оборудования Шэньян", sector: "Machinery", description: "Industry 4.0 upgrades for China's machinery base. Robot integration and smart manufacturing.", descriptionZh: "中国机械基地的工业4.0升级。机器人集成和智能制造。", descriptionRu: "Модернизация Индустрии 4.0 для машиностроительной базы Китая. Интеграция роботов и умное производство.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "ln-p1", name: "Dalian Shipbuilding Expansion", nameRu: "Расширение судостроения Далянь", nameZh: "大连造船扩建", value: "$2 Billion", sector: "Shipbuilding", description: "LNG carriers and container ships for Russia-China routes.", descriptionRu: "СПГ-танкеры и контейнеровозы для российско-китайских маршрутов.", descriptionZh: "用于中俄航线的LNG船和集装箱船。", completionYear: "2028" }
    ],
    advantages: [
      { icon: "location", title: "Russia Gateway", titleRu: "Ворота в Россию", titleZh: "俄罗斯门户", description: "Closest major port to Russian Far East. Direct connections to Vladivostok.", descriptionRu: "Ближайший крупный порт к российскому Дальнему Востоку. Прямое сообщение с Владивостоком.", descriptionZh: "距俄罗斯远东最近的主要港口。与符拉迪沃斯托克直接连接。" },
      { icon: "infrastructure", title: "Industrial Base", titleRu: "Промышленная база", titleZh: "工业基地", description: "China's traditional heavy industry center with skilled workforce.", descriptionRu: "Традиционный центр тяжёлой промышленности Китая с квалифицированной рабочей силой.", descriptionZh: "中国传统重工业中心，拥有熟练劳动力。" }
    ],
    contactInfo: { investmentAgency: "Liaoning Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Ляонин", investmentAgencyZh: "辽宁省商务厅", website: "http://swt.ln.gov.cn", email: "invest@liaoning.gov.cn" }
  },
  "Shaanxi": {
    name: "Shaanxi",
    nameRu: "Шэньси",
    nameZh: "陕西",
    gdp: "$450 Billion",
    population: "39.5 Million",
    industries: ["Aerospace", "Energy", "Technology", "Tourism"],
    industriesRu: ["Аэрокосмическая отрасль", "Энергетика", "Технологии", "Туризм"],
    industriesZh: ["航空航天", "能源", "科技", "旅游"],
    sezCount: 2,
    taxBenefits: ["Xi'an High-tech Zone incentives", "Western Development policy", "Belt and Road benefits"],
    taxBenefitsRu: ["Льготы высокотехнологичной зоны Сиань", "Политика развития Запада", "Льготы Пояса и Пути"],
    taxBenefitsZh: ["西安高新区优惠政策", "西部大开发政策", "一带一路优惠"],
    majorCities: [
      { id: "xian", name: "Xi'an", nameRu: "Сиань", nameZh: "西安", population: "13M", image: "https://images.unsplash.com/photo-1529551739587-e242c564f727?w=1920&q=80", description: "Ancient capital of 13 dynasties and terminus of the Silk Road. Home to Terracotta Warriors, major aerospace center, and Samsung's largest semiconductor fab outside Korea. Starting point for China-Europe freight rail.", opportunities: [
        { id: "xa-1", title: "Xi'an Aerospace Supply Chain", titleZh: "西安航空航天供应链", titleRu: "Аэрокосмическая цепочка поставок Сиань", sector: "Aerospace", description: "Aircraft components, satellites, and UAVs for AVIC and COMAC. Avionics and materials.", descriptionZh: "为中航工业和中国商飞提供飞机零部件、卫星和无人机。航空电子和材料。", descriptionRu: "Компоненты самолётов, спутники и БПЛА для AVIC и COMAC. Авионика и материалы.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "xa-2", title: "Chang'an-Europe Rail Hub", titleZh: "长安-欧洲铁路枢纽", titleRu: "Ж/д хаб Чанъань-Европа", sector: "Logistics", description: "Rail freight terminus for China-Europe routes. Bonded logistics and trade processing to Moscow.", descriptionZh: "中欧铁路货运终点站。至莫斯科的保税物流和贸易加工。", descriptionRu: "Терминал ж/д грузов для маршрутов Китай-Европа. Таможенная логистика и торговая обработка до Москвы.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "xa-3", title: "Xi'an Samsung Semiconductor Ecosystem", titleZh: "西安三星半导体生态", titleRu: "Полупроводниковая экосистема Samsung Сиань", sector: "Semiconductor", description: "Supply chain for Samsung's $17B NAND fab. Equipment, materials, and services.", descriptionZh: "三星170亿美元NAND工厂供应链。设备、材料和服务。", descriptionRu: "Цепочка поставок для NAND-фабрики Samsung за $17B. Оборудование, материалы и услуги.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" },
        { id: "xa-4", title: "Silk Road Cultural Tourism", titleZh: "丝绸之路文化旅游", titleRu: "Культурный туризм Шёлкового пути", sector: "Tourism", description: "Terracotta Warriors, ancient city walls, and Silk Road heritage. Premium cultural experiences.", descriptionZh: "兵马俑、古城墙和丝绸之路遗产。高端文化体验。", descriptionRu: "Терракотовые воины, древние городские стены и наследие Шёлкового пути. Премиальные культурные впечатления.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "baoji", name: "Baoji", nameRu: "Баоцзи", nameZh: "宝鸡", population: "3.3M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "Titanium capital of China and major defense manufacturing center. Produces 90% of China's titanium. Strategic location on ancient Silk Road.", opportunities: [
        { id: "bj-1", title: "Baoji Titanium Partnership", titleZh: "宝鸡钛合作", titleRu: "Партнёрство по титану Баоцзи", sector: "Materials", description: "Titanium production and processing for aerospace and medical. 90% of China's titanium.", descriptionZh: "用于航空航天和医疗的钛生产和加工。中国90%的钛。", descriptionRu: "Производство и обработка титана для авиакосмической и медицинской отраслей. 90% титана Китая.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "bj-2", title: "Defense Equipment Conversion", titleZh: "国防设备转化", titleRu: "Конверсия оборонного оборудования", sector: "Manufacturing", description: "Civilian applications of defense manufacturing capabilities. Precision machinery.", descriptionZh: "国防制造能力的民用应用。精密机械。", descriptionRu: "Гражданское применение оборонных производственных мощностей. Точное машиностроение.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "xianyang", name: "Xianyang", nameRu: "Сяньян", nameZh: "咸阳", population: "4.2M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Ancient Qin Dynasty capital adjacent to Xi'an airport. Major electronics manufacturing and pharmaceutical production. Growing logistics hub.", opportunities: [
        { id: "xy-1", title: "Xi'an Airport Economy Zone", titleZh: "西安机场经济区", titleRu: "Экономическая зона аэропорта Сиань", sector: "Logistics", description: "Air cargo and e-commerce logistics near major international airport.", descriptionZh: "大型国际机场附近的航空货运和电商物流。", descriptionRu: "Авиагрузы и e-commerce логистика рядом с крупным международным аэропортом.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" },
        { id: "xy-2", title: "Pharmaceutical Manufacturing", titleZh: "制药生产", titleRu: "Фармацевтическое производство", sector: "Pharma", description: "Traditional Chinese medicine and generic drug production.", descriptionZh: "中药和仿制药生产。", descriptionRu: "Производство традиционной китайской медицины и дженериков.", investmentRange: "$15M - $100M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Ancient capital and Belt and Road starting point. Xi'an is a major aerospace center (AVIC, COMAC), technology hub, and tourist destination (Terracotta Warriors). Key node for China-Europe rail freight.",
    overviewRu: "Древняя столица и отправная точка Пояса и Пути. Сиань — крупный аэрокосмический центр (AVIC, COMAC), технологический хаб и туристическое направление (Терракотовые воины). Ключевой узел железнодорожных грузоперевозок Китай-Европа.",
    overviewZh: "古都和一带一路起点。西安是主要的航空航天中心（中航工业、中国商飞）、科技中心和旅游目的地（兵马俑）。中欧铁路货运的关键节点。",
    targetSectors: ["Aerospace", "Belt and Road Trade", "Tourism", "Technology", "Energy"],
    opportunities: [
      { id: "sax-1", title: "Xi'an Aerospace Industrial Base", titleZh: "西安航空航天产业基地", titleRu: "Аэрокосмическая индустриальная база Сиань", sector: "Aerospace", description: "Aircraft components, satellites, and UAVs. AVIC and COMAC supply chain opportunities.", descriptionZh: "飞机零部件、卫星和无人机。中航工业和中国商飞供应链机会。", descriptionRu: "Компоненты самолётов, спутники и БПЛА. Возможности в цепочке поставок AVIC и COMAC.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "sax-2", title: "Chang'an-Europe Railway Hub", titleZh: "长安-欧洲铁路枢纽", titleRu: "Ж/д хаб Чанъань-Европа", sector: "Logistics", description: "China-Europe freight train origin point. Logistics park development for Russia-China trade.", descriptionZh: "中欧货运列车始发地。中俄贸易物流园区开发。", descriptionRu: "Начальная точка грузовых поездов Китай-Европа. Развитие логистического парка для российско-китайской торговли.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "sax-p1", name: "Xi'an International Trade Port", nameRu: "Международный торговый порт Сиань", nameZh: "西安国际贸易港", value: "$800 Million", sector: "Logistics", description: "Expanding rail freight terminal and bonded zone.", descriptionRu: "Расширение железнодорожного грузового терминала и таможенной зоны.", descriptionZh: "扩建铁路货运站和保税区。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Belt and Road Hub", titleRu: "Хаб Пояса и Пути", titleZh: "一带一路枢纽", description: "Starting point of Chang'an-Europe railway. Direct trains to Moscow.", descriptionRu: "Отправная точка железной дороги Чанъань-Европа. Прямые поезда до Москвы.", descriptionZh: "长安-欧洲铁路起点。直达莫斯科的列车。" },
      { icon: "infrastructure", title: "Aerospace Center", titleRu: "Аэрокосмический центр", titleZh: "航空航天中心", description: "Major aircraft manufacturing base with complete supply chain.", descriptionRu: "Крупная база авиастроения с полной цепочкой поставок.", descriptionZh: "主要飞机制造基地，拥有完整供应链。" }
    ],
    contactInfo: { investmentAgency: "Shaanxi Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Шэньси", investmentAgencyZh: "陕西省商务厅", website: "http://sxdofcom.shaanxi.gov.cn", email: "invest@shaanxi.gov.cn" }
  },
  "Jiangxi": {
    name: "Jiangxi",
    nameRu: "Цзянси",
    nameZh: "江西",
    gdp: "$430 Billion",
    population: "45.2 Million",
    industries: ["Aviation", "Electronics", "New Materials", "Rare Earths"],
    industriesRu: ["Авиация", "Электроника", "Новые материалы", "Редкоземельные металлы"],
    industriesZh: ["航空", "电子", "新材料", "稀土"],
    sezCount: 2,
    taxBenefits: ["Central China development benefits", "Aviation industry incentives", "Rare earth processing support"],
    taxBenefitsRu: ["Льготы развития Центрального Китая", "Льготы авиационной отрасли", "Поддержка переработки редкоземельных металлов"],
    taxBenefitsZh: ["中部地区发展优惠", "航空产业优惠政策", "稀土加工扶持"],
    majorCities: [
      { id: "nanchang", name: "Nanchang", nameRu: "Наньчан", nameZh: "南昌", population: "6.3M", image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=1920&q=80", description: "Provincial capital and birthplace of PLA. Emerging aviation manufacturing hub with helicopter production. Host of World VR Industry Conference - China's VR capital.", opportunities: [
        { id: "nc-1", title: "Nanchang Aviation Manufacturing", titleZh: "南昌航空制造", titleRu: "Авиационное производство Наньчан", sector: "Aviation", description: "Helicopter and trainer aircraft production. AVIC Hongdu partnership opportunities.", descriptionZh: "直升机和教练机生产。中航工业洪都合作机会。", descriptionRu: "Производство вертолётов и учебных самолётов. Партнёрство с AVIC Hongdu.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "nc-2", title: "Nanchang VR Industry Hub", titleZh: "南昌VR产业中心", titleRu: "VR-индустриальный хаб Наньчана", sector: "VR/AR", description: "China's VR industry center with 200+ companies. Hardware and content development.", descriptionZh: "中国VR产业中心，拥有200多家企业。硬件和内容开发。", descriptionRu: "Китайский центр VR-индустрии с 200+ компаниями. Разработка оборудования и контента.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" },
        { id: "nc-3", title: "Nanchang High-tech Zone", titleZh: "南昌高新区", titleRu: "Высокотехнологичная зона Наньчана", sector: "Electronics", description: "LED and semiconductor lighting. Electronic components manufacturing.", descriptionZh: "LED和半导体照明。电子元器件制造。", descriptionRu: "Светодиодное и полупроводниковое освещение. Производство электронных компонентов.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "ganzhou", name: "Ganzhou", nameRu: "Ганьчжоу", nameZh: "赣州", population: "9.8M", image: "https://images.unsplash.com/photo-1569335468083-1b4c4b5e6fd0?w=1920&q=80", description: "China's rare earth capital with 30% of national reserves. Critical for EV batteries, electronics, and clean energy. Strategic resource for technology manufacturing.", opportunities: [
        { id: "gz-1", title: "Ganzhou Rare Earth Processing", titleZh: "赣州稀土加工", titleRu: "Переработка редкоземельных металлов Ганьчжоу", sector: "Materials", description: "Value-added rare earth processing. Permanent magnets for EVs and wind turbines.", descriptionZh: "稀土深加工。用于电动汽车和风力发电机的永磁体。", descriptionRu: "Переработка редкоземельных элементов с добавленной стоимостью. Постоянные магниты для электромобилей и ветрогенераторов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "gz-2", title: "Rare Earth Magnet Manufacturing", titleZh: "稀土磁铁制造", titleRu: "Производство редкоземельных магнитов", sector: "Manufacturing", description: "NdFeB magnets for electric motors and generators. Critical EV component.", descriptionZh: "用于电机和发电机的钕铁硼磁铁。关键的电动汽车零部件。", descriptionRu: "Неодимовые магниты для электродвигателей и генераторов. Критический компонент электромобилей.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "gz-3", title: "Ganzhou Furniture Industry", titleZh: "赣州家具产业", titleRu: "Мебельная промышленность Ганьчжоу", sector: "Manufacturing", description: "Southern China's largest furniture production base. Wood processing and export.", descriptionZh: "华南最大的家具生产基地。木材加工和出口。", descriptionRu: "Крупнейшая база производства мебели в Южном Китае. Деревообработка и экспорт.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "jiujiang", name: "Jiujiang", nameRu: "Цзюцзян", nameZh: "九江", population: "4.6M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Major Yangtze River port city at Poyang Lake. Gateway for Jiangxi's exports with strong petrochemical and textile industries.", opportunities: [
        { id: "jj-1", title: "Jiujiang Petrochemical Park", titleZh: "九江石化园区", titleRu: "Нефтехимический парк Цзюцзян", sector: "Petrochemicals", description: "Oil refining and chemical production on Yangtze River. Excellent logistics.", descriptionZh: "长江沿岸的炼油和化工生产。优越的物流条件。", descriptionRu: "Нефтепереработка и химическое производство на реке Янцзы. Отличная логистика.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" },
        { id: "jj-2", title: "Jiujiang Port Logistics", titleZh: "九江港物流", titleRu: "Портовая логистика Цзюцзян", sector: "Logistics", description: "Yangtze River shipping hub. Container and bulk cargo handling.", descriptionZh: "长江航运枢纽。集装箱和散货处理。", descriptionRu: "Судоходный хаб на реке Янцзы. Контейнерные и насыпные грузы.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Rising central province with aviation manufacturing and rare earth resources. Nanchang hosts aircraft manufacturing; Ganzhou has China's largest rare earth deposits. Cost-competitive with strong government support.",
    overviewRu: "Развивающаяся центральная провинция с авиационным производством и ресурсами редкоземельных металлов. Наньчан — центр авиастроения; Ганьчжоу имеет крупнейшие в Китае месторождения редкоземельных металлов. Конкурентоспособные затраты при сильной государственной поддержке.",
    overviewZh: "新兴的中部省份，拥有航空制造业和稀土资源。南昌是飞机制造中心；赣州拥有中国最大的稀土矿藏。成本竞争力强，政府支持力度大。",
    targetSectors: ["Aviation", "Rare Earths", "Electronics", "New Materials", "VR/AR"],
    opportunities: [
      { id: "jx-1", title: "Nanchang Aviation Industrial Park", titleZh: "南昌航空产业园", titleRu: "Авиационный индустриальный парк Наньчан", sector: "Aviation", description: "Helicopter and regional aircraft manufacturing. AVIC partnership opportunities.", descriptionZh: "直升机和支线飞机制造。中航工业合作机会。", descriptionRu: "Производство вертолётов и региональных самолётов. Возможности партнёрства с AVIC.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" },
      { id: "jx-2", title: "Ganzhou Rare Earth Processing", titleZh: "赣州稀土加工", titleRu: "Переработка редкоземельных металлов Ганьчжоу", sector: "Materials", description: "Value-added rare earth processing and magnet manufacturing.", descriptionZh: "稀土深加工和磁铁制造。", descriptionRu: "Переработка редкоземельных элементов с добавленной стоимостью и производство магнитов.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "priority" }
    ],
    keyProjects: [
      { id: "jx-p1", name: "Nanchang VR Industry Base", nameRu: "VR-индустриальная база Наньчан", nameZh: "南昌VR产业基地", value: "$300 Million", sector: "VR", description: "China's VR industry cluster with 200+ companies.", descriptionRu: "Китайский VR-кластер с 200+ компаниями.", descriptionZh: "中国VR产业集群，拥有200多家企业。", completionYear: "2026" }
    ],
    advantages: [
      { icon: "resources", title: "Rare Earth Capital", titleRu: "Столица редкоземельных металлов", titleZh: "稀土之都", description: "Ganzhou has 30% of China's rare earth reserves.", descriptionRu: "Ганьчжоу располагает 30% запасов редкоземельных металлов Китая.", descriptionZh: "赣州拥有中国30%的稀土储量。" },
      { icon: "policy", title: "Cost Advantage", titleRu: "Ценовое преимущество", titleZh: "成本优势", description: "Lower costs than coastal regions with strong incentives.", descriptionRu: "Более низкие затраты, чем в прибрежных регионах, при сильных стимулах.", descriptionZh: "成本低于沿海地区，优惠政策力度大。" }
    ],
    contactInfo: { investmentAgency: "Jiangxi Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Цзянси", investmentAgencyZh: "江西省商务厅", website: "http://swt.jiangxi.gov.cn", email: "invest@jiangxi.gov.cn" }
  },
  "Chongqing": {
    name: "Chongqing",
    nameRu: "Чунцин",
    nameZh: "重庆",
    gdp: "$430 Billion",
    population: "32.1 Million",
    industries: ["Automotive", "Electronics", "Pharmaceuticals", "Logistics"],
    industriesRu: ["Автомобилестроение", "Электроника", "Фармацевтика", "Логистика"],
    industriesZh: ["汽车", "电子", "医药", "物流"],
    sezCount: 3,
    taxBenefits: ["Western Development incentives", "Liangjiang New Area benefits", "Land-sea trade corridor benefits"],
    taxBenefitsRu: ["Льготы развития Запада", "Льготы Нового района Лянцзян", "Льготы сухопутно-морского коридора"],
    taxBenefitsZh: ["西部大开发优惠政策", "两江新区优惠", "陆海新通道优惠"],
    majorCities: [
      { id: "yuzhong", name: "Yuzhong District", nameRu: "Район Юйчжун", nameZh: "渝中区", population: "0.6M", image: "https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?w=1920&q=80", description: "Historic peninsula core of Chongqing at Yangtze-Jialing confluence. Famous for dramatic hillside architecture, hot pot cuisine, and vibrant nightlife. Major financial and commercial district.", opportunities: [
        { id: "yz-1", title: "Jiefangbei CBD Development", titleZh: "解放碑中央商务区开发", titleRu: "Развитие CBD Цзефанбэй", sector: "Real Estate", description: "Premium office and retail in Chongqing's historic center. Finance and professional services.", descriptionZh: "重庆历史中心的高端写字楼和零售。金融和专业服务。", descriptionRu: "Премиальные офисы и торговля в историческом центре Чунцина. Финансы и профессиональные услуги.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" },
        { id: "yz-2", title: "Yangtze Riverfront Tourism", titleZh: "长江滨江旅游", titleRu: "Туризм на набережной Янцзы", sector: "Tourism", description: "Cruise terminal and riverside entertainment. Hongya Cave expansion.", descriptionZh: "邮轮码头和滨江娱乐。洪崖洞扩建。", descriptionRu: "Круизный терминал и развлечения на набережной. Расширение пещеры Хунъя.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "jiangbei", name: "Jiangbei District", nameRu: "Район Цзянбэй", nameZh: "江北区", population: "0.9M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "New business district north of the Jialing River. Home to Guanyinqiao shopping area and expanding financial services sector. Major airport gateway.", opportunities: [
        { id: "jb-1", title: "Jiangbei Airport Economy Zone", titleZh: "江北机场经济区", titleRu: "Экономическая зона аэропорта Цзянбэй", sector: "Logistics", description: "Air cargo and e-commerce logistics hub. Direct flights to Moscow and Europe.", descriptionZh: "航空货运和电商物流中心。直飞莫斯科和欧洲。", descriptionRu: "Хаб авиагрузов и электронной коммерции. Прямые рейсы в Москву и Европу.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "jb-2", title: "Guanyinqiao Retail Hub", titleZh: "观音桥零售中心", titleRu: "Торговый хаб Гуаньиньцяо", sector: "Retail", description: "One of China's top shopping districts. Chinese and international brand expansion.", descriptionZh: "中国顶级购物区之一。中外品牌扩张。", descriptionRu: "Один из топовых торговых районов Китая. Расширение китайских и международных брендов.", investmentRange: "$10M - $100M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "liangjiang", name: "Liangjiang New Area", nameRu: "Новый район Лянцзян", nameZh: "两江新区", population: "3.2M", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=80", description: "National-level new area and western China's development engine. Automotive hub (Chang'an, Ford), electronics manufacturing, and smart industry demonstration zone.", opportunities: [
        { id: "lj-1", title: "Chang'an Auto Partnership", titleZh: "长安汽车合作", titleRu: "Партнёрство с Chang'an Auto", sector: "Automotive", description: "EV and ICE vehicle manufacturing with China's 4th largest automaker. Complete supply chain.", descriptionZh: "与中国第四大汽车制造商合作生产电动和燃油汽车。完整供应链。", descriptionRu: "Производство электрических и бензиновых автомобилей с 4-м крупнейшим автопроизводителем Китая. Полная цепочка поставок.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
        { id: "lj-2", title: "Liangjiang Smart Manufacturing", titleZh: "两江智能制造", titleRu: "Умное производство Лянцзян", sector: "Manufacturing", description: "Industry 4.0 demonstration with robotics, IoT, and AI integration.", descriptionZh: "工业4.0示范区，集成机器人、物联网和人工智能。", descriptionRu: "Демонстрация Индустрии 4.0 с робототехникой, IoT и интеграцией ИИ.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" },
        { id: "lj-3", title: "Laptop & Electronics Assembly", titleZh: "笔记本电脑和电子产品组装", titleRu: "Сборка ноутбуков и электроники", sector: "Electronics", description: "HP, Acer laptop production. 40% of global laptop output from Chongqing.", descriptionZh: "惠普、宏碁笔记本电脑生产。重庆占全球笔记本电脑产量的40%。", descriptionRu: "Производство ноутбуков HP, Acer. 40% мирового производства ноутбуков из Чунцина.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" },
        { id: "lj-4", title: "China-Europe Rail Terminal", titleZh: "中欧铁路枢纽", titleRu: "Терминал железной дороги Китай-Европа", sector: "Logistics", description: "Chongqing-Duisburg rail freight hub. 10,000+ trains annually to Europe.", descriptionZh: "重庆-杜伊斯堡铁路货运枢纽。每年超过10,000列火车开往欧洲。", descriptionRu: "Железнодорожный грузовой хаб Чунцин-Дуйсбург. 10,000+ поездов ежегодно в Европу.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" }
      ]}
    ],
    overview: "China's largest municipality and western logistics hub. Major automotive center (Chang'an, Ford) and electronics manufacturer (HP, Foxconn laptops). Key terminus for China-Europe railway and land-sea corridor to Southeast Asia.",
    overviewRu: "Крупнейший муниципалитет Китая и западный логистический хаб. Крупный автомобильный центр (Chang'an, Ford) и производитель электроники (ноутбуки HP, Foxconn). Ключевой терминал железной дороги Китай-Европа и сухопутно-морского коридора в Юго-Восточную Азию.",
    overviewZh: "中国最大的直辖市和西部物流枢纽。主要汽车中心（长安、福特）和电子产品制造商（惠普、富士康笔记本电脑）。中欧铁路和通往东南亚的陆海新通道的关键终点站。",
    targetSectors: ["Automotive", "Electronics", "Logistics", "Smart Manufacturing", "Biotech"],
    opportunities: [
      { id: "cq-1", title: "Liangjiang New Area Smart Manufacturing", titleZh: "两江新区智能制造", titleRu: "Умное производство Нового района Лянцзян", sector: "Manufacturing", description: "Industry 4.0 demonstration zone with automotive and electronics clusters.", descriptionZh: "工业4.0示范区，包含汽车和电子集群。", descriptionRu: "Демонстрационная зона Индустрии 4.0 с автомобильными и электронными кластерами.", investmentRange: "$20M - $300M", timeline: "2-4 years", status: "priority" },
      { id: "cq-2", title: "Western Land-Sea Corridor Hub", titleZh: "西部陆海新通道枢纽", titleRu: "Хаб Западного сухопутно-морского коридора", sector: "Logistics", description: "New trade route connecting Russia via Central Asia to Southeast Asian ports.", descriptionZh: "连接俄罗斯经中亚至东南亚港口的新贸易路线。", descriptionRu: "Новый торговый маршрут, связывающий Россию через Центральную Азию с портами Юго-Восточной Азии.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "cq-p1", name: "Chongqing-Duisburg Rail Expansion", nameRu: "Расширение железной дороги Чунцин-Дуйсбург", nameZh: "重庆-杜伊斯堡铁路扩建", value: "$500 Million", sector: "Logistics", description: "Doubling capacity of China-Europe freight trains.", descriptionRu: "Удвоение пропускной способности грузовых поездов Китай-Европа.", descriptionZh: "中欧货运列车运力翻倍。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Western Hub", titleRu: "Западный хаб", titleZh: "西部枢纽", description: "Junction of Yangtze River, China-Europe railway, and land-sea corridor.", descriptionRu: "Узел реки Янцзы, железной дороги Китай-Европа и сухопутно-морского коридора.", descriptionZh: "长江、中欧铁路和陆海新通道的交汇点。" },
      { icon: "market", title: "Mega City", titleRu: "Мегаполис", titleZh: "超大城市", description: "32 million population with rapidly growing consumer market.", descriptionRu: "32 миллиона населения с быстрорастущим потребительским рынком.", descriptionZh: "3200万人口，消费市场快速增长。" }
    ],
    contactInfo: { investmentAgency: "Chongqing Municipal Commission of Commerce", investmentAgencyRu: "Муниципальная комиссия торговли Чунцина", investmentAgencyZh: "重庆市商务委员会", website: "http://sww.cq.gov.cn", email: "invest@cq.gov.cn" }
  },
  "Yunnan": { name: "Yunnan", nameRu: "Юньнань", nameZh: "云南", gdp: "$400 Billion", population: "47.2 Million", industries: ["Tourism", "Mining", "Agriculture", "Hydropower"], industriesRu: ["Туризм", "Горнодобывающая промышленность", "Сельское хозяйство", "Гидроэнергетика"], industriesZh: ["旅游", "采矿", "农业", "水力发电"], sezCount: 2, taxBenefits: ["Western Development incentives", "Border trade benefits", "Tourism industry support"], taxBenefitsRu: ["Стимулы развития западных регионов", "Льготы приграничной торговли", "Поддержка туристической отрасли"], taxBenefitsZh: ["西部大开发激励", "边境贸易优惠", "旅游产业支持"], majorCities: [{ id: "kunming", name: "Kunming", nameRu: "Куньмин", nameZh: "昆明", population: "8.5M", lat: 25.0389, lng: 102.7183, image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=1920&q=80" }, { id: "yuxi", name: "Yuxi", nameRu: "Юйси", nameZh: "玉溪", population: "2.3M", lat: 24.3550, lng: 102.5428, image: "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=1920&q=80" }, { id: "qujing", name: "Qujing", nameRu: "Цюйцзин", nameZh: "曲靖", population: "5.8M", lat: 25.4900, lng: 103.7960, image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80" }], overview: "China's gateway to Southeast Asia with stunning natural beauty. Kunming enjoys 'Spring City' climate. Rich in minerals, biodiversity, and hydropower. Tourism powerhouse with unique ethnic cultures.", overviewRu: "Ворота Китая в Юго-Восточную Азию с потрясающей природной красотой. Куньмин известен климатом 'Города вечной весны'. Богат полезными ископаемыми, биоразнообразием и гидроэнергией. Туристический центр с уникальными этническими культурами.", overviewZh: "中国通往东南亚的门户，拥有壮丽的自然风景。昆明享有'春城'气候。矿产资源丰富、生物多样性高、水力发电资源充足。旅游强市，拥有独特的民族文化。", targetSectors: ["Tourism", "Mining", "Southeast Asia Trade", "Hydropower", "Specialty Agriculture"], opportunities: [{ id: "yn-1", title: "Kunming Southeast Asia Trade Hub", titleZh: "昆明东南亚贸易中心", titleRu: "Куньминский торговый хаб Юго-Восточной Азии", sector: "Trade", description: "Gateway to ASEAN via Laos railway. Trade processing and logistics development.", descriptionZh: "通过老挝铁路通往东盟的门户。贸易加工和物流发展。", descriptionRu: "Ворота в АСЕАН через железную дорогу в Лаос. Торговая переработка и развитие логистики.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }, { id: "yn-2", title: "Yunnan Eco-Tourism Development", titleZh: "云南生态旅游开发", titleRu: "Развитие экотуризма Юньнани", sector: "Tourism", description: "Luxury resorts, adventure tourism, and ethnic cultural experiences.", descriptionZh: "豪华度假村、探险旅游和民族文化体验。", descriptionRu: "Роскошные курорты, приключенческий туризм и этнические культурные впечатления.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "yn-p1", name: "China-Laos Railway Economic Corridor", nameRu: "Экономический коридор железной дороги Китай-Лаос", nameZh: "中老铁路经济走廊", value: "$2 Billion", sector: "Infrastructure", description: "Development zones along new railway to Southeast Asia.", descriptionRu: "Зоны развития вдоль новой железной дороги в Юго-Восточную Азию.", descriptionZh: "沿新铁路通往东南亚的发展区。", completionYear: "2030" }], advantages: [{ icon: "location", title: "ASEAN Gateway", titleRu: "Ворота АСЕАН", titleZh: "东盟门户", description: "Land border with Myanmar, Laos, Vietnam. New railway to Thailand.", descriptionRu: "Сухопутная граница с Мьянмой, Лаосом, Вьетнамом. Новая железная дорога в Таиланд.", descriptionZh: "与缅甸、老挝、越南接壤。通往泰国的新铁路。" }, { icon: "resources", title: "Natural Wealth", titleRu: "Природное богатство", titleZh: "自然财富", description: "Rich in minerals, hydropower, and biodiversity.", descriptionRu: "Богат полезными ископаемыми, гидроэнергией и биоразнообразием.", descriptionZh: "矿产资源丰富、水力发电和生物多样性。" }], contactInfo: { investmentAgency: "Yunnan Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Юньнань", investmentAgencyZh: "云南省商务厅", website: "http://swt.yn.gov.cn", email: "invest@yunnan.gov.cn" } },
  "Guangxi": { name: "Guangxi", nameRu: "Гуанси", nameZh: "广西", gdp: "$370 Billion", population: "50.1 Million", industries: ["Sugar Processing", "Nonferrous Metals", "Machinery", "ASEAN Trade"], industriesRu: ["Переработка сахара", "Цветные металлы", "Машиностроение", "Торговля с АСЕАН"], industriesZh: ["糖加工", "有色金属", "机械", "东盟贸易"], sezCount: 2, taxBenefits: ["ASEAN FTZ benefits", "Western Development incentives", "Border economic cooperation"], taxBenefitsRu: ["Льготы зоны свободной торговли АСЕАН", "Стимулы развития западных регионов", "Приграничное экономическое сотрудничество"], taxBenefitsZh: ["东盟自由贸易区优惠", "西部大开发激励", "边境经济合作"], majorCities: [{ id: "nanning", name: "Nanning", nameRu: "Наньнин", nameZh: "南宁", population: "8.7M" }, { id: "liuzhou", name: "Liuzhou", nameRu: "Лючжоу", nameZh: "柳州", population: "4.2M" }, { id: "guilin", name: "Guilin", nameRu: "Гуйлинь", nameZh: "桂林", population: "4.9M" }], overview: "Home to China-ASEAN Expo and gateway to Southeast Asia. Nanning hosts permanent ASEAN trade infrastructure. Guilin's stunning karst landscape attracts millions of tourists. Strong in automotive (SAIC-GM-Wuling) and aluminum.", overviewRu: "Дом Китайско-АСЕАН Экспо и ворота в Юго-Восточную Азию. Наньнин является хозяином постоянной инфраструктуры торговли АСЕАН. Потрясающий карстовый ландшафт Гуйлиня привлекает миллионы туристов. Сильна в автомобилестроении (SAIC-GM-Wuling) и алюминии.", overviewZh: "中国-东盟博览会所在地，通往东南亚的门户。南宁拥有永久性东盟贸易基础设施。桂林壮丽的喀斯特地貌吸引了数百万游客。在汽车（上汽通用五菱）和铝业方面实力强劲。", targetSectors: ["ASEAN Trade", "Automotive", "Aluminum", "Tourism", "Sugar & Agriculture"], opportunities: [{ id: "gx-1", title: "China-ASEAN Trade Platform", titleZh: "中国-东盟贸易平台", titleRu: "Китайско-АСЕАН торговая платформа", sector: "Trade", description: "Permanent expo infrastructure for Southeast Asian trade. Bonded warehousing and e-commerce fulfillment.", descriptionZh: "东南亚贸易永久性博览会基础设施。保税仓储和电商物流。", descriptionRu: "Постоянная инфраструктура выставки для торговли с Юго-Восточной Азией. Таможенные склады и электронная коммерция.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" }, { id: "gx-2", title: "Wuling EV Manufacturing Expansion", titleZh: "五菱电动汽车生产扩张", titleRu: "Расширение производства электромобилей Wuling", sector: "Automotive", description: "Low-cost EV production with SAIC-GM-Wuling. Mini EV supply chain opportunities.", descriptionZh: "与上汽通用五菱合作的低成本电动汽车生产。微型电动汽车供应链机会。", descriptionRu: "Производство недорогих электромобилей с SAIC-GM-Wuling. Возможности в цепочке поставок мини-электромобилей.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "priority" }], keyProjects: [{ id: "gx-p1", name: "Beibu Gulf Economic Zone", value: "$1 Billion", sector: "Port", description: "Port and industrial development on Gulf of Tonkin.", completionYear: "2028" }], advantages: [{ icon: "location", title: "ASEAN Hub", titleRu: "Центр АСЕАН", titleZh: "东盟中心", description: "Hosts annual China-ASEAN Expo. Direct border with Vietnam.", descriptionRu: "Ежегодно принимает Китайско-АСЕАН Экспо. Прямая граница с Вьетнамом.", descriptionZh: "每年举办中国-东盟博览会。与越南直接接壤。" }, { icon: "logistics", title: "Sea & Land Routes", titleRu: "Морские и сухопутные маршруты", titleZh: "海陆通道", description: "Port access and land routes to Southeast Asia.", descriptionRu: "Доступ к портам и сухопутные маршруты в Юго-Восточную Азию.", descriptionZh: "港口通道和通往东南亚的陆路。" }], contactInfo: { investmentAgency: "Guangxi Department of Commerce", website: "http://swt.gxzf.gov.cn", email: "invest@guangxi.gov.cn" } },
  "Shanxi": { name: "Shanxi", nameRu: "Шаньси", nameZh: "山西", gdp: "$340 Billion", population: "34.9 Million", industries: ["Coal Mining", "Steel", "Chemicals", "New Energy"], industriesRu: ["Угольная добыча", "Сталь", "Химикаты", "Новая энергетика"], industriesZh: ["煤炭开采", "钢铁", "化工", "新能源"], sezCount: 1, taxBenefits: ["Energy transition incentives", "Industrial upgrading support", "Environmental tech benefits"], taxBenefitsRu: ["Стимулы энергетического перехода", "Поддержка промышленного обновления", "Льготы экологических технологий"], taxBenefitsZh: ["能源转型激励", "产业升级支持", "环保技术优惠"], majorCities: [{ id: "taiyuan", name: "Taiyuan", nameRu: "Тайюань", nameZh: "太原", population: "5.3M" }, { id: "datong", name: "Datong", nameRu: "Датун", nameZh: "大同", population: "3.1M" }, { id: "changzhi", name: "Changzhi", nameRu: "Чанчжи", nameZh: "长治", population: "3.2M" }], overview: "China's coal heartland undergoing green transformation. Major investment in solar, hydrogen, and clean coal technology. Rich in ancient temples and historic sites along Silk Road.", overviewRu: "Угольный центр Китая, переходящий на зелёную трансформацию. Крупные инвестиции в солнечную энергию, водород и чистые угольные технологии. Богат древними храмами и историческими памятниками вдоль Шёлкового пути.", overviewZh: "中国煤炭中心正在进行绿色转型。对太阳能、氢能和清洁煤炭技术进行大规模投资。沿丝绸之路拥有丰富的古庙和历史遗迹。", targetSectors: ["Clean Energy", "Green Coal Technology", "Hydrogen", "Cultural Tourism", "New Materials"], opportunities: [{ id: "sx-1", title: "Shanxi Green Energy Transition", titleZh: "山西绿色能源转型", titleRu: "Переход Шаньси на зелёную энергетику", sector: "Energy", description: "Solar farms, hydrogen production, and coal-to-chemicals. Government incentives for clean energy.", descriptionZh: "太阳能农场、氢能生产和煤化工。政府清洁能源激励措施。", descriptionRu: "Солнечные электростанции, производство водорода и углехимия. Государственные стимулы для чистой энергии.", investmentRange: "$20M - $500M", timeline: "3-5 years", status: "priority" }, { id: "sx-2", title: "Datong Cultural Tourism", titleZh: "大同文化旅游", titleRu: "Культурный туризм Датуна", sector: "Tourism", description: "UNESCO Yungang Grottoes area development. Hotel and tourism infrastructure.", descriptionZh: "联合国教科文组织云冈石窟地区开发。酒店和旅游基础设施。", descriptionRu: "Развитие зоны пещер Юньган ЮНЕСКО. Отельная и туристическая инфраструктура.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "sx-p1", name: "Shanxi Hydrogen Corridor", nameRu: "Водородный коридор Шаньси", nameZh: "山西氢能走廊", value: "$2 Billion", sector: "Hydrogen", description: "Green hydrogen production and fuel cell deployment.", descriptionRu: "Производство зелёного водорода и развёртывание топливных элементов.", descriptionZh: "绿色氢气生产和燃料电池部署。", completionYear: "2030" }], advantages: [{ icon: "resources", title: "Energy Wealth", titleRu: "Энергетическое богатство", titleZh: "能源财富", description: "25% of China's coal reserves. Transitioning to clean energy leader.", descriptionRu: "25% угольных запасов Китая. Переход к лидерству в чистой энергетике.", descriptionZh: "中国25%的煤炭储量。正在转型为清洁能源领导者。" }, { icon: "policy", title: "Transition Support", titleRu: "Поддержка перехода", titleZh: "转型支持", description: "Strong government support for green transformation.", descriptionRu: "Сильная государственная поддержка зелёной трансформации.", descriptionZh: "政府大力支持绿色转型。" }], contactInfo: { investmentAgency: "Shanxi Provincial Department of Commerce", website: "http://swt.shanxi.gov.cn", email: "invest@shanxi.gov.cn" } },
  "Inner Mongolia": { name: "Inner Mongolia", nameRu: "Внутренняя Монголия", nameZh: "内蒙古", gdp: "$330 Billion", population: "24 Million", industries: ["Mining", "Energy", "Agriculture", "Rare Earths"], industriesRu: ["Горнодобывающая промышленность", "Энергетика", "Сельское хозяйство", "Редкоземельные элементы"], industriesZh: ["采矿", "能源", "农业", "稀土"], sezCount: 2, taxBenefits: ["Western Development incentives", "Energy base incentives", "Rare earth processing benefits"], taxBenefitsRu: ["Стимулы развития западных регионов", "Стимулы энергетической базы", "Льготы переработки редкоземельных элементов"], taxBenefitsZh: ["西部大开发激励", "能源基地激励", "稀土加工优惠"], majorCities: [{ id: "hohhot", name: "Hohhot", nameRu: "Хух-Хото", nameZh: "呼和浩特", population: "3.5M" }, { id: "baotou", name: "Baotou", nameRu: "Баотоу", nameZh: "包头", population: "2.7M" }, { id: "ordos", name: "Ordos", nameRu: "Ордос", nameZh: "鄂尔多斯", population: "2.2M" }], overview: "Vast northern region bordering Mongolia and Russia. Major rare earth producer (Baotou), coal and natural gas reserves, and wind/solar potential. Growing dairy industry (Yili, Mengniu).", overviewRu: "Обширный северный регион, граничащий с Монголией и Россией. Крупный производитель редкоземельных элементов (Баотоу), запасы угля и природного газа, потенциал ветровой и солнечной энергии. Растущая молочная промышленность (Yili, Mengniu).", overviewZh: "与蒙古和俄罗斯接壤的广阔北方地区。主要稀土生产地（包头），煤炭和天然气储备，风能和太阳能潜力。不断增长的乳业（伊利、蒙牛）。", targetSectors: ["Rare Earths", "Renewable Energy", "Mining", "Dairy & Agriculture", "Border Trade"], opportunities: [{ id: "im-1", title: "Baotou Rare Earth High-Tech Zone", titleZh: "包头稀土高新区", titleRu: "Высокотехнологичная зона редкоземельных металлов Баотоу", sector: "Materials", description: "Value-added rare earth processing for magnets, batteries, and electronics.", descriptionZh: "用于磁铁、电池和电子产品的稀土深加工。", descriptionRu: "Переработка редкоземельных элементов с добавленной стоимостью для магнитов, батарей и электроники.", investmentRange: "$20M - $300M", timeline: "2-4 years", status: "priority" }, { id: "im-2", title: "Inner Mongolia Wind & Solar Farms", titleZh: "内蒙古风光电场", titleRu: "Ветровые и солнечные электростанции Внутренней Монголии", sector: "Energy", description: "Massive renewable energy development. Some of world's best wind resources.", descriptionZh: "大规模可再生能源开发。世界上最好的风力资源之一。", descriptionRu: "Масштабное развитие возобновляемой энергетики. Одни из лучших ветровых ресурсов в мире.", investmentRange: "$50M - $1B", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "im-p1", name: "Ordos Renewable Energy Base", nameRu: "База возобновляемой энергии Ордос", nameZh: "鄂尔多斯可再生能源基地", value: "$10 Billion", sector: "Energy", description: "Giant wind and solar installation with hydrogen production.", descriptionRu: "Гигантская установка ветровой и солнечной энергии с производством водорода.", descriptionZh: "巨型风能和太阳能装置，配备氢气生产。", completionYear: "2030" }], advantages: [{ icon: "resources", title: "Rare Earth Capital", titleRu: "Столица редкоземельных металлов", titleZh: "稀土之都", description: "90% of China's rare earth production. Critical for tech manufacturing.", descriptionRu: "90% производства редкоземельных металлов Китая. Критически важно для технологического производства.", descriptionZh: "中国90%的稀土生产。对科技制造至关重要。" }, { icon: "location", title: "Russia-Mongolia Border", titleRu: "Граница с Россией и Монголией", titleZh: "俄蒙边境", description: "Manzhouli crossing handles most China-Russia rail trade.", descriptionRu: "Переход Маньчжурия обрабатывает большую часть железнодорожной торговли Китай-Россия.", descriptionZh: "满洲里口岸处理大部分中俄铁路贸易。" }], contactInfo: { investmentAgency: "Inner Mongolia Department of Commerce", investmentAgencyRu: "Департамент торговли Внутренней Монголии", investmentAgencyZh: "内蒙古自治区商务厅", website: "http://swt.nmg.gov.cn", email: "invest@nmg.gov.cn" } },
     "Guizhou": { name: "Guizhou", nameRu: "Гуйчжоу", nameZh: "贵州", gdp: "$300 Billion", population: "38.5 Million", industries: ["Big Data", "Tourism", "Liquor", "Mining"], industriesRu: ["Большие данные", "Туризм", "Ликёроводство", "Горнодобывающая промышленность"], industriesZh: ["大数据", "旅游", "酒业", "采矿"], sezCount: 2, taxBenefits: ["Big Data industry incentives", "Western Development policy", "Poverty alleviation benefits"], taxBenefitsRu: ["Стимулы для индустрии больших данных", "Политика развития западных регионов", "Льготы по борьбе с бедностью"], taxBenefitsZh: ["大数据产业激励", "西部大开发政策", "扶贫优惠"], majorCities: [{ id: "guiyang", name: "Guiyang", nameRu: "Гуйян", nameZh: "贵阳", population: "6M" }, { id: "zunyi", name: "Zunyi", nameRu: "Цзуньи", nameZh: "遵义", population: "6.6M" }, { id: "liupanshui", name: "Liupanshui", nameRu: "Люйпаньшуй", nameZh: "六盘水", population: "2.9M" }], overview: "China's big data capital with major data centers (Apple, Huawei, Tencent). Cool mountain climate ideal for servers. Home to Moutai liquor and stunning karst landscapes.", overviewRu: "Столица больших данных Китая с крупными дата-центрами (Apple, Huawei, Tencent). Прохладный горный климат идеален для серверов. Родина ликёра Мотай и потрясающих карстовых ландшафтов.", overviewZh: "中国的大数据之都，拥有主要数据中心（苹果、华为、腾讯）。凉爽的山地气候非常适合服务器。茅台酒的故乡和壮丽的喀斯特地貌。", targetSectors: ["Big Data & Cloud", "Tourism", "Liquor", "Pharmaceuticals", "Mining"], opportunities: [{ id: "gz-1", title: "Guiyang Big Data Valley", titleZh: "贵阳大数据谷", titleRu: "Долина больших данных Гуйяна", sector: "Tech", description: "Data center development with cheap electricity and cool climate. Apple, Huawei, Tencent already present.", descriptionZh: "廉价电力和凉爽气候下的数据中心发展。苹果、华为、腾讯已入驻。", descriptionRu: "Развитие дата-центров с дешёвым электричеством и прохладным климатом. Apple, Huawei, Tencent уже присутствуют.", investmentRange: "$20M - $500M", timeline: "2-4 years", status: "priority" }, { id: "gz-2", title: "Guizhou Eco-Tourism", titleZh: "贵州生态旅游", titleRu: "Экотуризм Гуйчжоу", sector: "Tourism", description: "Karst caves, waterfalls, and ethnic minority villages. Adventure and cultural tourism development.", descriptionZh: "喀斯特洞穴、瀑布和少数民族村寨。探险和文化旅游发展。", descriptionRu: "Карстовые пещеры, водопады и деревни этнических меньшинств. Развитие приключенческого и культурного туризма.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "gz-p1", name: "Huawei Cloud Guizhou Data Center", nameRu: "Дата-центр облачных сервисов Huawei в Гуйчжоу", nameZh: "华为云贵州数据中心", value: "$1 Billion", sector: "Cloud", description: "Major cloud infrastructure expansion.", descriptionRu: "Крупное расширение облачной инфраструктуры.", descriptionZh: "主要云基础设施扩展。", partners: ["Huawei"], completionYear: "2027" }], advantages: [{ icon: "tech", title: "Big Data Hub", titleRu: "Центр больших данных", titleZh: "大数据中心", description: "China's first national big data pilot zone. Cool climate and cheap power for data centers.", descriptionRu: "Первая национальная пилотная зона больших данных Китая. Прохладный климат и дешёвая электроэнергия для дата-центров.", descriptionZh: "中国首个国家级大数据试验区。凉爽的气候和低廉的电力适合数据中心。" }, { icon: "resources", title: "Premium Liquor", titleRu: "Премиальный ликёр", titleZh: "高端白酒", description: "Moutai and other premium baijiu. China's liquor capital.", descriptionRu: "Маотай и другие премиальные байцзю. Ликёрная столица Китая.", descriptionZh: "茅台和其他高端白酒。中国白酒之都。" }], contactInfo: { investmentAgency: "Guizhou Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Гуйчжоу", investmentAgencyZh: "贵州省商务厅", website: "http://swt.guizhou.gov.cn", email: "invest@guizhou.gov.cn" } },
  "Xinjiang": { name: "Xinjiang", nameRu: "Синьцзян", nameZh: "新疆", gdp: "$260 Billion", population: "25.9 Million", industries: ["Oil & Gas", "Cotton", "Agriculture", "Mining"], industriesRu: ["Нефть и газ", "Хлопок", "Сельское хозяйство", "Горнодобывающая промышленность"], industriesZh: ["石油和天然气", "棉花", "农业", "采矿"], sezCount: 3, taxBenefits: ["Western Development incentives", "Border trade benefits", "Resource extraction support"], taxBenefitsRu: ["Стимулы развития западных регионов", "Льготы приграничной торговли", "Поддержка добычи ресурсов"], taxBenefitsZh: ["西部大开发激励", "边境贸易优惠", "资源开采支持"], majorCities: [{ id: "urumqi", name: "Urumqi", nameRu: "Урумчи", nameZh: "乌鲁木齐", population: "4M" }, { id: "kashgar", name: "Kashgar", nameRu: "Кашгар", nameZh: "喀什", population: "0.7M" }, { id: "korla", name: "Korla", nameRu: "Корла", nameZh: "库尔勒", population: "0.6M" }], overview: "Vast western region bordering Central Asia and Russia. Major oil and gas reserves, cotton production, and Belt and Road gateway. Kashgar is ancient Silk Road trading post reviving as economic hub.", overviewRu: "Обширный западный регион, граничащий с Центральной Азией и Россией. Крупные запасы нефти и газа, производство хлопка и ворота Пояса и пути. Кашгар — древний торговый пост Шёлкового пути, возрождающийся как экономический центр.", overviewZh: "与中亚和俄罗斯接壤的广阔西部地区。主要石油和天然气储备、棉花生产和一带一路门户。喀什是古丝绸之路贸易站，正在复兴为经济中心。", targetSectors: ["Oil & Gas", "Cotton & Textiles", "Central Asia Trade", "Mining", "Solar Energy"], opportunities: [{ id: "xj-1", title: "Xinjiang Central Asia Trade Zone", titleZh: "新疆中亚贸易区", titleRu: "Синьцзянская торговая зона Центральной Азии", sector: "Trade", description: "Border trade with Kazakhstan, Kyrgyzstan, and beyond. Logistics and processing zones.", descriptionZh: "与哈萨克斯坦、吉尔吉斯斯坦等国的边境贸易。物流和加工区。", descriptionRu: "Приграничная торговля с Казахстаном, Кыргызстаном и другими странами. Логистические и перерабатывающие зоны.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "active" }, { id: "xj-2", title: "Tarim Basin Energy Development", titleZh: "塔里木盆地能源开发", titleRu: "Развитие энергетики бассейна Тарим", sector: "Energy", description: "Oil and gas exploration and production partnerships.", descriptionZh: "石油和天然气勘探和生产合作。", descriptionRu: "Партнёрства по разведке и добыче нефти и газа.", investmentRange: "$100M - $1B", timeline: "5-10 years", status: "priority" }], keyProjects: [{ id: "xj-p1", name: "China-Pakistan Economic Corridor (Xinjiang Section)", nameRu: "Китайско-пакистанский экономический коридор (раздел Синьцзян)", nameZh: "中巴经济走廊（新疆段）", value: "$5 Billion", sector: "Infrastructure", description: "Road, rail, and pipeline development through Kashgar.", descriptionRu: "Развитие дорог, железных дорог и трубопроводов через Кашгар.", descriptionZh: "通过喀什的道路、铁路和管道开发。", completionYear: "2030" }], advantages: [{ icon: "location", title: "Central Asia Gateway", titleRu: "Ворота в Центральную Азию", titleZh: "中亚门户", description: "Borders 8 countries. Key Belt and Road junction.", descriptionRu: "Граничит с 8 странами. Ключевой узел Пояса и пути.", descriptionZh: "与8个国家接壤。一带一路关键枢纽。" }, { icon: "resources", title: "Energy Reserves", titleRu: "Энергетические запасы", titleZh: "能源储备", description: "Major oil, gas, and mineral deposits.", descriptionRu: "Крупные месторождения нефти, газа и полезных ископаемых.", descriptionZh: "主要石油、天然气和矿产资源。" }], contactInfo: { investmentAgency: "Xinjiang Department of Commerce", investmentAgencyRu: "Департамент торговли Синьцзяна", investmentAgencyZh: "新疆商务厅", website: "http://swt.xinjiang.gov.cn", email: "invest@xinjiang.gov.cn" } },
  "Tianjin": { name: "Tianjin", nameRu: "Тяньцзинь", nameZh: "天津", gdp: "$250 Billion", population: "13.9 Million", industries: ["Petrochemicals", "Manufacturing", "Shipping", "Finance"], industriesRu: ["Нефтехимия", "Производство", "Судоходство", "Финансы"], industriesZh: ["石油化工", "制造业", "航运", "金融"], sezCount: 3, taxBenefits: ["Binhai New Area benefits", "FTZ pilot zone incentives", "Port and logistics support"], taxBenefitsRu: ["Льготы Нового района Бинхай", "Стимулы пилотной зоны СЭЗ", "Поддержка портов и логистики"], taxBenefitsZh: ["滨海新区优惠", "自贸区试点激励", "港口和物流支持"], majorCities: [{ id: "binhai", name: "Binhai New Area", nameRu: "Новый район Бинхай", nameZh: "滨海新区", population: "3M" }, { id: "heping", name: "Heping District", nameRu: "Район Хэпин", nameZh: "和平区", population: "0.4M" }, { id: "hedong", name: "Hedong District", nameRu: "Район Хэдун", nameZh: "河东区", population: "0.8M" }], overview: "Major port city serving Beijing-Tianjin-Hebei megalopolis. Binhai New Area is a comprehensive FTZ with manufacturing, finance, and shipping. Strong aerospace (Airbus final assembly) and petrochemical sectors.", overviewRu: "Крупный портовый город, обслуживающий мегаполис Пекин-Тяньцзинь-Хэбэй. Новый район Бинхай — комплексная СЭЗ с производством, финансами и судоходством. Сильные позиции в аэрокосмической промышленности (финальная сборка Airbus) и нефтехимии.", overviewZh: "服务京津冀都市圈的主要港口城市。滨海新区是综合自贸区，拥有制造业、金融和航运。在航空航天（空客总装）和石油化工领域实力强劲。", targetSectors: ["Aerospace", "Petrochemicals", "Shipping", "Fintech", "Advanced Manufacturing"], opportunities: [{ id: "tj-1", title: "Tianjin Aerospace Manufacturing", titleZh: "天津航空航天制造", titleRu: "Аэрокосмическое производство Тяньцзиня", sector: "Aerospace", description: "Airbus A320 final assembly line supply chain. Helicopter and drone manufacturing.", descriptionZh: "空客A320总装线供应链。直升机和无人机制造。", descriptionRu: "Цепочка поставок линии финальной сборки Airbus A320. Производство вертолётов и дронов.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" }, { id: "tj-2", title: "Tianjin Port Russia Trade Route", titleZh: "天津港俄罗斯贸易航线", titleRu: "Торговый маршрут порта Тяньцзинь в Россию", sector: "Logistics", description: "Direct shipping connections to Russian Arctic route. LNG receiving terminal.", descriptionZh: "与俄罗斯北极航线的直接航运连接。LNG接收终端。", descriptionRu: "Прямое судоходное сообщение с российским арктическим маршрутом. СПГ-приёмный терминал.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "tj-p1", name: "Airbus Tianjin Wide-body Completion Center", nameRu: "Центр завершения широкофюзеляжных самолётов Airbus в Тяньцзине", nameZh: "空客天津宽体飞机完成中心", value: "$500 Million", sector: "Aerospace", description: "A350 completion and delivery center.", descriptionRu: "Центр завершения и доставки A350.", descriptionZh: "A350完成和交付中心。", partners: ["Airbus"], completionYear: "2026" }], advantages: [{ icon: "logistics", title: "Northern Gateway", titleRu: "Северные ворота", titleZh: "北方门户", description: "Major port serving 130 million people in Beijing-Tianjin-Hebei region.", descriptionRu: "Крупный порт, обслуживающий 130 миллионов человек в регионе Пекин-Тяньцзинь-Хэбэй.", descriptionZh: "服务京津冀地区1.3亿人口的主要港口。" }, { icon: "infrastructure", title: "Aerospace Hub", titleRu: "Аэрокосмический центр", titleZh: "航空航天中心", description: "Only Airbus final assembly outside Europe.", descriptionRu: "Единственная финальная сборка Airbus за пределами Европы.", descriptionZh: "欧洲以外唯一的空客总装线。" }], contactInfo: { investmentAgency: "Tianjin Municipal Commission of Commerce", investmentAgencyRu: "Муниципальная комиссия торговли Тяньцзиня", investmentAgencyZh: "天津市商务委员会", website: "http://www.investtianjin.gov.cn", email: "invest@tj.gov.cn" } },
  "Heilongjiang": { name: "Heilongjiang", nameRu: "Хэйлунцзян", nameZh: "黑龙江", gdp: "$220 Billion", population: "31.9 Million", industries: ["Agriculture", "Heavy Industry", "Energy", "Forestry"], industriesRu: ["Сельское хозяйство", "Тяжёлая промышленность", "Энергетика", "Лесное хозяйство"], industriesZh: ["农业", "重工业", "能源", "林业"], sezCount: 2, taxBenefits: ["Northeast revitalization policy", "Russia border trade benefits", "Agricultural support"], taxBenefitsRu: ["Политика возрождения северо-востока", "Льготы приграничной торговли с Россией", "Поддержка сельского хозяйства"], taxBenefitsZh: ["东北振兴政策", "俄罗斯边境贸易优惠", "农业支持"], majorCities: [{ id: "harbin", name: "Harbin", nameRu: "Харбин", nameZh: "哈尔滨", population: "9.5M", lat: 45.8038, lng: 126.5350, image: "https://images.unsplash.com/photo-1541959833400-049d37f98ccd?w=1920&q=80" }, { id: "daqing", name: "Daqing", nameRu: "Дацин", nameZh: "大庆", population: "2.8M", lat: 46.5877, lng: 125.1032, image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80" }, { id: "qiqihar", name: "Qiqihar", nameRu: "Цицикар", nameZh: "齐齐哈尔", population: "5.3M", lat: 47.3542, lng: 123.9179, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80" }], overview: "China's northernmost province with deepest Russia ties. Harbin has Russian architectural heritage and hosts annual Ice Festival. Major agricultural base (soybeans, rice) and oil producer (Daqing). Key for Russia-China trade.", overviewRu: "Самая северная провинция Китая с глубочайшими связями с Россией. Харбин имеет русское архитектурное наследие и ежегодный ледяной фестиваль. Крупная сельскохозяйственная база (соя, рис) и производитель нефти (Дацин). Ключевой центр российско-китайской торговли.", overviewZh: "中国最北方的省份，与俄罗斯关系最深。哈尔滨拥有俄罗斯建筑遗产和年度冰雪节。主要农业基地（大豆、水稻）和石油生产地（大庆）。俄中贸易的关键枢纽。", targetSectors: ["Russia Trade", "Agriculture", "Energy", "Ice & Snow Tourism", "Forestry"], opportunities: [{ id: "hlj-1", title: "Harbin-Russia Trade & Logistics Hub", titleZh: "哈尔滨-俄罗斯贸易物流中心", titleRu: "Харбинско-российский торгово-логистический хаб", sector: "Trade", description: "Comprehensive trade zone for Russia imports. Direct rail to Vladivostok and Moscow. Cold chain logistics for Russian food.", descriptionZh: "俄罗斯进口综合贸易区。直达符拉迪沃斯托克和莫斯科的铁路。俄罗斯食品冷链物流。", descriptionRu: "Комплексная торговая зона для российского импорта. Прямое железнодорожное сообщение с Владивостоком и Москвой. Холодильная логистика для российских продуктов.", investmentRange: "$10M - $200M", timeline: "2-3 years", status: "priority" }, { id: "hlj-2", title: "Heilongjiang Agricultural Partnership", titleZh: "黑龙江农业合作", titleRu: "Сельскохозяйственное партнёрство Хэйлунцзян", sector: "Agriculture", description: "Soybean, rice, and dairy production. Technology partnerships with Russian Far East farmers.", descriptionZh: "大豆、大米和乳制品生产。与俄罗斯远东农民的技术合作。", descriptionRu: "Производство сои, риса и молочной продукции. Технологическое партнёрство с фермерами российского Дальнего Востока.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }, { id: "hlj-3", title: "Harbin Ice & Snow Tourism", titleZh: "哈尔滨冰雪旅游", titleRu: "Ледовый и снежный туризм Харбина", sector: "Tourism", description: "Year-round ice tourism infrastructure, ski resorts, and winter sports facilities.", descriptionZh: "全年冰雪旅游基础设施、滑雪度假村和冬季运动设施。", descriptionRu: "Круглогодичная инфраструктура ледового туризма, горнолыжные курорты и зимние спортивные объекты.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "hlj-p1", name: "Suifenhe Russia Trade Processing Zone", value: "$500 Million", sector: "Trade", description: "Border city processing zone for Russia-origin goods.", completionYear: "2027" }, { id: "hlj-p2", name: "Harbin Ice & Snow World Expansion", value: "$200 Million", sector: "Tourism", description: "Permanent ice sculpture park and resort.", completionYear: "2026" }], advantages: [{ icon: "location", title: "Russia Border", titleRu: "Граница с Россией", titleZh: "俄罗斯边境", description: "3,000km border with Russia. Multiple crossing points.", descriptionRu: "3000 км границы с Россией. Множество пунктов пропуска.", descriptionZh: "与俄罗斯3000公里边境。多个过境点。" }, { icon: "resources", title: "Agricultural Powerhouse", titleRu: "Сельскохозяйственная держава", titleZh: "农业大省", description: "China's largest soybean and rice producer. Black soil breadbasket.", descriptionRu: "Крупнейший производитель сои и риса в Китае. Житница чернозёма.", descriptionZh: "中国最大的大豆和水稻生产地。黑土粮仓。" }, { icon: "infrastructure", title: "Russia Heritage", titleRu: "Российское наследие", titleZh: "俄罗斯遗产", description: "Harbin has century of Russian connections. Cultural and business ties.", descriptionRu: "Харбин имеет вековые связи с Россией. Культурные и деловые связи.", descriptionZh: "哈尔滨与俄罗斯有百年渊源。文化和商业联系。" }], contactInfo: { investmentAgency: "Heilongjiang Provincial Department of Commerce", investmentAgencyRu: "Департамент торговли провинции Хэйлунцзян", investmentAgencyZh: "黑龙江省商务厅", website: "http://swt.hlj.gov.cn", email: "invest@hlj.gov.cn", phone: "+86-451-82628177" } },
  "Jilin": { name: "Jilin", nameRu: "Цзилинь", nameZh: "吉林", gdp: "$190 Billion", population: "24 Million", industries: ["Automotive", "Petrochemicals", "Food Processing", "Agriculture"], industriesRu: ["Автомобилестроение", "Нефтехимия", "Пищевая промышленность", "Сельское хозяйство"], industriesZh: ["汽车", "石油化工", "食品加工", "农业"], sezCount: 2, taxBenefits: ["Northeast revitalization incentives", "Automotive industry support", "Agricultural processing benefits"], taxBenefitsRu: ["Стимулы возрождения северо-востока", "Поддержка автомобильной промышленности", "Льготы пищевой промышленности"], taxBenefitsZh: ["东北振兴激励", "汽车产业支持", "农产品加工优惠"], majorCities: [{ id: "changchun", name: "Changchun", population: "9.1M" }, { id: "jilin-city", name: "Jilin City", population: "4M" }, { id: "siping", name: "Siping", population: "1.8M" }], overview: "China's auto capital - Changchun hosts FAW (First Auto Works). Strong corn and soybean production. Winter sports development for Beijing-Changchun corridor. Border access to Russia and North Korea.", overviewRu: "Автомобильная столица Китая — Чанчунь является домом FAW (First Auto Works). Сильное производство кукурузы и сои. Развитие зимних видов спорта в коридоре Пекин-Чанчунь. Доступ к границе с Россией и Северной Кореей.", overviewZh: "中国汽车之都——长春是一汽（第一汽车制造厂）的所在地。玉米和大豆生产强劲。北京-长春走廊冬季运动发展。与俄罗斯和朝鲜的边境通道。", targetSectors: ["Automotive", "Food Processing", "Winter Sports", "Pharmaceuticals", "Russia Trade"], opportunities: [{ id: "jl-1", title: "FAW-Volkswagen Supply Chain", titleZh: "一汽-大众供应链", titleRu: "Цепочка поставок FAW-Volkswagen", sector: "Automotive", description: "Tier 1/2 supplier opportunities for China's oldest automaker. EV transition creating new opportunities.", descriptionZh: "为中国最老汽车制造商提供一/二级供应商机会。电动汽车转型创造新机会。", descriptionRu: "Возможности для поставщиков 1/2 уровня для старейшего китайского автопроизводителя. Переход на электромобили создаёт новые возможности.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" }, { id: "jl-2", title: "Jilin Winter Sports Development", titleZh: "吉林冬季运动发展", titleRu: "Развитие зимних видов спорта Цзилинь", sector: "Sports", description: "Ski resorts and winter training facilities. 2022 Olympics legacy development.", descriptionZh: "滑雪度假村和冬季训练设施。2022年冬奥会遗产发展。", descriptionRu: "Горнолыжные курорты и зимние тренировочные объекты. Развитие наследия Олимпиады 2022.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "jl-p1", name: "FAW EV Manufacturing Base", value: "$3 Billion", sector: "Automotive", description: "Electric vehicle production expansion.", partners: ["FAW Group"], completionYear: "2027" }], advantages: [{ icon: "infrastructure", title: "Auto Capital", titleRu: "Автомобильная столица", titleZh: "汽车之都", description: "FAW headquarters. Complete automotive supply chain.", descriptionRu: "Штаб-квартира FAW. Полная автомобильная цепочка поставок.", descriptionZh: "一汽总部。完整的汽车供应链。" }, { icon: "resources", title: "Agricultural Base", titleRu: "Сельскохозяйственная база", titleZh: "农业基地", description: "Major corn producer with strong food processing.", descriptionRu: "Крупный производитель кукурузы с развитой пищевой промышленностью.", descriptionZh: "主要玉米生产地，食品加工业发达。" }], contactInfo: { investmentAgency: "Jilin Provincial Department of Commerce", website: "http://swt.jl.gov.cn", email: "invest@jilin.gov.cn" } },
  "Gansu": { name: "Gansu", nameRu: "Ганьсу", nameZh: "甘肃", gdp: "$160 Billion", population: "25 Million", industries: ["Petrochemicals", "Mining", "New Energy", "Agriculture"], industriesRu: ["Нефтехимия", "Горнодобывающая промышленность", "Новая энергетика", "Сельское хозяйство"], industriesZh: ["石油化工", "采矿", "新能源", "农业"], sezCount: 1, taxBenefits: ["Western Development incentives", "New energy support", "Silk Road benefits"], taxBenefitsRu: ["Стимулы развития западных регионов", "Поддержка новой энергетики", "Льготы Шёлкового пути"], taxBenefitsZh: ["西部大开发激励", "新能源支持", "丝绸之路优惠"], majorCities: [{ id: "lanzhou", name: "Lanzhou", population: "4.4M" }, { id: "tianshui", name: "Tianshui", population: "2.9M" }, { id: "jiayuguan", name: "Jiayuguan", population: "0.3M" }], overview: "Historic Silk Road corridor with massive renewable energy potential. Dunhuang caves are UNESCO heritage. Wind and solar resources among world's best. Petrochemical hub with Lanzhou refineries.", overviewRu: "Исторический коридор Шёлкового пути с огромным потенциалом возобновляемой энергии. Пещеры Дуньхуана — объект наследия ЮНЕСКО. Ветровые и солнечные ресурсы среди лучших в мире. Нефтехимический центр с нефтеперерабатывающими заводами Ланьчжоу.", overviewZh: "历史悠久的丝绸之路走廊，具有巨大的可再生能源潜力。敦煌莫高窟是联合国教科文组织遗产。风能和太阳能资源位居世界前列。兰州炼油厂石油化工中心。", targetSectors: ["Renewable Energy", "Tourism", "Petrochemicals", "New Materials", "Data Centers"], opportunities: [{ id: "gs-1", title: "Gansu Wind & Solar Corridor", titleZh: "甘肃风光走廊", titleRu: "Ветро-солнечный коридор Ганьсу", sector: "Energy", description: "World-class wind and solar resources in Hexi Corridor. Grid-connected and off-grid projects.", descriptionZh: "河西走廊世界级风能和太阳能资源。并网和离网项目。", descriptionRu: "Мировые ветровые и солнечные ресурсы в коридоре Хэси. Сетевые и автономные проекты.", investmentRange: "$50M - $1B", timeline: "3-5 years", status: "priority" }, { id: "gs-2", title: "Silk Road Cultural Tourism", titleZh: "丝绸之路文化旅游", titleRu: "Культурный туризм Шёлкового пути", sector: "Tourism", description: "Dunhuang Mogao Caves, Great Wall terminus, and desert experiences.", descriptionZh: "敦煌莫高窟、长城终点和沙漠体验。", descriptionRu: "Пещеры Могао в Дуньхуане, окончание Великой стены и пустынные впечатления.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "gs-p1", name: "Jiuquan Wind Power Base", value: "$15 Billion", sector: "Energy", description: "10GW wind farm - one of world's largest.", completionYear: "2028" }], advantages: [{ icon: "resources", title: "Renewable Paradise", titleRu: "Рай возобновляемой энергии", titleZh: "可再生能源天堂", description: "Exceptional wind and solar resources. Cheap land and power.", descriptionRu: "Исключительные ветровые и солнечные ресурсы. Дешёвая земля и электроэнергия.", descriptionZh: "卓越的风能和太阳能资源。土地和电力便宜。" }, { icon: "location", title: "Silk Road Heritage", titleRu: "Наследие Шёлкового пути", titleZh: "丝绸之路遗产", description: "Historic trade route with tourism and trade potential.", descriptionRu: "Исторический торговый путь с туристическим и торговым потенциалом.", descriptionZh: "具有旅游和贸易潜力的历史贸易路线。" }], contactInfo: { investmentAgency: "Gansu Provincial Department of Commerce", website: "http://swt.gansu.gov.cn", email: "invest@gansu.gov.cn" } },
  "Hainan": { name: "Hainan", nameRu: "Хайнань", nameZh: "海南", gdp: "$100 Billion", population: "10.1 Million", industries: ["Tourism", "Tropical Agriculture", "Free Trade Port", "Marine Industry"], industriesRu: ["Туризм", "Тропическое сельское хозяйство", "Свободный торговый порт", "Морская промышленность"], industriesZh: ["旅游", "热带农业", "自由贸易港", "海洋产业"], sezCount: 1, taxBenefits: ["Free Trade Port zero tariff", "15% CIT cap", "Personal income tax cap 15%"], taxBenefitsRu: ["Нулевые пошлины свободного порта", "Налог на прибыль 15%", "Налог на доходы физических лиц 15%"], taxBenefitsZh: ["自由港零关税", "企业所得税15%", "个人所得税15%"], majorCities: [{ id: "haikou", name: "Haikou", population: "2.9M", lat: 20.0440, lng: 110.1999, image: "https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=1920&q=80" }, { id: "sanya", name: "Sanya", population: "1M", lat: 18.2524, lng: 109.5119, image: "https://images.unsplash.com/photo-1600077106724-946750eeaf3c?w=1920&q=80" }, { id: "danzhou", name: "Danzhou", population: "0.9M", lat: 19.5175, lng: 109.5801, image: "https://images.unsplash.com/photo-1559304787-e5db6d82acb1?w=1920&q=80" }], overview: "China's Hawaii and newest Free Trade Port with most favorable policies nationwide. Zero tariffs, 15% income tax cap, and relaxed foreign investment rules. Tropical tourism, duty-free shopping, and emerging tech hub.", overviewRu: "Гавайи Китая и новейший свободный торговый порт с наиболее благоприятной политикой в стране. Нулевые пошлины, налог на доходы 15% и смягчённые правила иностранных инвестиций. Тропический туризм, беспошлинный шопинг и развивающийся технологический центр.", overviewZh: "中国的夏威夷和最新的自由贸易港，拥有全国最优惠的政策。零关税、15%所得税和放宽的外商投资规则。热带旅游、免税购物和新兴科技中心。", targetSectors: ["Tourism", "Duty-Free Retail", "Healthcare Tourism", "Tropical Agriculture", "Marine Industry"], opportunities: [{ id: "hai-1", title: "Hainan Free Trade Port Investment", titleZh: "海南自由贸易港投资", titleRu: "Инвестиции в свободный порт Хайнань", sector: "Trade", description: "Zero tariffs, 15% corporate tax, relaxed forex. China's most open zone for foreign investment.", descriptionZh: "零关税、15%企业所得税、外汇管制放松。中国对外商投资最开放的区域。", descriptionRu: "Нулевые пошлины, 15% налог на прибыль, смягчённый валютный контроль. Самая открытая зона Китая для иностранных инвестиций.", investmentRange: "$5M - $500M", timeline: "1-3 years", status: "priority" }, { id: "hai-2", title: "Sanya Medical Tourism", titleZh: "三亚医疗旅游", titleRu: "Медицинский туризм Саньи", sector: "Healthcare", description: "International hospitals and medical tourism. Boao Lecheng allows imported drugs and devices.", descriptionZh: "国际医院和医疗旅游。博鳌乐城允许进口药品和医疗器械。", descriptionRu: "Международные больницы и медицинский туризм. Боао Лэчэн разрешает импортные лекарства и устройства.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }, { id: "hai-3", title: "Hainan Duty-Free Expansion", titleZh: "海南免税购物扩张", titleRu: "Расширение беспошлинной торговли Хайнаня", sector: "Retail", description: "Offshore duty-free shopping. $100,000/person annual allowance.", descriptionZh: "离岛免税购物。每人每年10万美元额度。", descriptionRu: "Оффшорный беспошлинный шоппинг. $100,000 на человека в год.", investmentRange: "$10M - $200M", timeline: "1-2 years", status: "active" }], keyProjects: [{ id: "hai-p1", name: "Hainan International Medical Tourism Pilot", value: "$1 Billion", sector: "Healthcare", description: "Advanced medical treatments and clinical trials zone.", completionYear: "2027" }, { id: "hai-p2", name: "Sanya Yazhou Bay Science City", value: "$3 Billion", sector: "Technology", description: "Deep-sea, space, and tropical agriculture research.", completionYear: "2030" }], advantages: [{ icon: "policy", title: "Free Trade Port", titleRu: "Свободный торговый порт", titleZh: "自由贸易港", description: "China's most open zone. Zero tariffs, 15% tax cap, relaxed investment rules.", descriptionRu: "Самая открытая зона Китая. Нулевые пошлины, налог 15%, смягчённые инвестиционные правила.", descriptionZh: "中国最开放的区域。零关税、15%税率上限、放宽投资规则。" }, { icon: "market", title: "Tourism Magnet", titleRu: "Туристический магнит", titleZh: "旅游磁铁", description: "Tropical paradise attracting 80 million tourists annually.", descriptionRu: "Тропический рай, привлекающий 80 миллионов туристов ежегодно.", descriptionZh: "热带天堂，每年吸引8000万游客。" }, { icon: "infrastructure", title: "World-Class Facilities", titleRu: "Инфраструктура мирового класса", titleZh: "世界级设施", description: "International airports, cruise terminals, and resort infrastructure.", descriptionRu: "Международные аэропорты, круизные терминалы и курортная инфраструктура.", descriptionZh: "国际机场、邮轮码头和度假村基础设施。" }], contactInfo: { investmentAgency: "Hainan Provincial Bureau of International Economic Development", website: "http://dofcom.hainan.gov.cn", email: "invest@hainan.gov.cn", phone: "+86-898-65342377" } },
  "Ningxia": { name: "Ningxia", nameRu: "Нинся", nameZh: "宁夏", gdp: "$70 Billion", population: "7.3 Million", industries: ["Energy", "Coal Chemicals", "Wine", "Halal Food"], industriesRu: ["Энергетика", "Углехимия", "Виноделие", "Халяльная пища"], industriesZh: ["能源", "煤化工", "葡萄酒", "清真食品"], sezCount: 1, taxBenefits: ["Western Development incentives", "Energy industry support", "Halal certification benefits"], taxBenefitsRu: ["Стимулы развития западных регионов", "Поддержка энергетической промышленности", "Льготы халяльной сертификации"], taxBenefitsZh: ["西部大开发激励", "能源产业支持", "清真认证优惠"], majorCities: [{ id: "yinchuan", name: "Yinchuan", population: "2.9M" }, { id: "shizuishan", name: "Shizuishan", population: "0.7M" }, { id: "wuzhong", name: "Wuzhong", population: "1.1M" }], overview: "Small but strategic region for China-Arab cooperation. Halal food certification hub. Emerging wine region rivaling France. Solar energy potential and coal chemical industry.", overviewRu: "Небольшой, но стратегический регион для китайско-арабского сотрудничества. Центр халяльной сертификации. Развивающийся винодельческий регион, конкурирующий с Францией. Потенциал солнечной энергии и углехимическая промышленность.", overviewZh: "小但战略性的中阿合作地区。清真食品认证中心。与法国竞争的新兴葡萄酒产区。太阳能潜力和煤化工产业。", targetSectors: ["Halal Food", "Wine", "Solar Energy", "Arab Trade", "Coal Chemicals"], opportunities: [{ id: "nx-1", title: "Ningxia Wine Industry", titleZh: "宁夏葡萄酒产业", titleRu: "Винодельческая отрасль Нинся", sector: "Agriculture", description: "Premium wine region with international awards. Winery investment and export opportunities.", descriptionZh: "获得国际奖项的优质葡萄酒产区。酒庄投资和出口机会。", descriptionRu: "Премиальный винодельческий регион с международными наградами. Возможности инвестиций в винодельни и экспорта.", investmentRange: "$5M - $50M", timeline: "3-5 years", status: "active" }, { id: "nx-2", title: "China-Arab Halal Food Hub", titleZh: "中阿清真食品中心", titleRu: "Китайско-арабский хаб халяльной еды", sector: "Food", description: "Halal certification and export platform for Arab world.", descriptionZh: "面向阿拉伯世界的清真认证和出口平台。", descriptionRu: "Платформа халяльной сертификации и экспорта в арабский мир.", investmentRange: "$3M - $30M", timeline: "2-3 years", status: "active" }], keyProjects: [{ id: "nx-p1", name: "China-Arab States Expo Permanent Platform", value: "$300 Million", sector: "Trade", description: "Trade infrastructure for Arab partnership.", completionYear: "2027" }], advantages: [{ icon: "policy", title: "Arab Gateway", titleRu: "Ворота в арабский мир", titleZh: "阿拉伯门户", description: "China-Arab States Expo host. Halal certification hub.", descriptionRu: "Принимает Китайско-арабскую выставку. Центр халяльной сертификации.", descriptionZh: "中阿博览会举办地。清真认证中心。" }, { icon: "resources", title: "Wine Region", titleRu: "Винодельческий регион", titleZh: "葡萄酒产区", description: "Eastern foothills of Helan Mountain produce award-winning wines.", descriptionRu: "Восточные предгорья горы Хэлань производят отмеченные наградами вина.", descriptionZh: "贺兰山东麓出产屡获殊荣的葡萄酒。" }], contactInfo: { investmentAgency: "Ningxia Department of Commerce", website: "http://swt.nx.gov.cn", email: "invest@ningxia.gov.cn" } },
  "Qinghai": { name: "Qinghai", nameRu: "Цинхай", nameZh: "青海", gdp: "$55 Billion", population: "5.9 Million", industries: ["Mining", "New Energy", "Salt Lake Resources", "Tourism"], industriesRu: ["Горнодобывающая промышленность", "Новая энергетика", "Ресурсы соляных озёр", "Туризм"], industriesZh: ["采矿", "新能源", "盐湖资源", "旅游"], sezCount: 1, taxBenefits: ["Western Development incentives", "New energy support", "Ecological protection benefits"], taxBenefitsRu: ["Стимулы развития западных регионов", "Поддержка новой энергетики", "Льготы экологической защиты"], taxBenefitsZh: ["西部大开发激励", "新能源支持", "生态保护优惠"], majorCities: [{ id: "xining", name: "Xining", population: "2.5M" }, { id: "haidong", name: "Haidong", population: "1.4M" }, { id: "golmud", name: "Golmud", population: "0.2M" }], overview: "Tibetan Plateau province with vast lithium resources in salt lakes. Critical for battery manufacturing supply chain. Stunning high-altitude landscapes and wildlife. Solar energy potential.", overviewRu: "Провинция Тибетского плато с огромными запасами лития в соляных озёрах. Критически важна для цепочки поставок производства батарей. Потрясающие высокогорные ландшафты и дикая природа. Потенциал солнечной энергии.", overviewZh: "西藏高原省份，盐湖中拥有丰富的锂资源。对电池制造供应链至关重要。壮丽的高原风景和野生动物。太阳能潜力。", targetSectors: ["Lithium & Battery Materials", "Solar Energy", "Eco-Tourism", "Salt Lake Resources", "Mining"], opportunities: [{ id: "qh-1", title: "Qinghai Lithium Triangle", titleZh: "青海锂三角", titleRu: "Литиевый треугольник Цинхай", sector: "Materials", description: "World's largest lithium reserves in salt lakes. Battery material processing and extraction.", descriptionZh: "世界上最大的盐湖锂资源。电池材料加工和提取。", descriptionRu: "Крупнейшие в мире запасы лития в солёных озёрах. Переработка и добыча материалов для батарей.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" }, { id: "qh-2", title: "Qinghai High-Altitude Tourism", titleZh: "青海高原旅游", titleRu: "Высокогорный туризм Цинхай", sector: "Tourism", description: "Qinghai Lake, Tibetan culture, and wildlife experiences.", descriptionZh: "青海湖、藏族文化和野生动物体验。", descriptionRu: "Озеро Цинхай, тибетская культура и наблюдение за дикой природой.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "qh-p1", name: "BYD Qinghai Lithium Processing", value: "$2 Billion", sector: "Materials", description: "Lithium extraction and battery material production.", partners: ["BYD"], completionYear: "2027" }], advantages: [{ icon: "resources", title: "Lithium Capital", titleRu: "Литиевая столица", titleZh: "锂都", description: "Largest lithium reserves. Critical for EV battery supply chain.", descriptionRu: "Крупнейшие запасы лития. Критически важно для цепочки поставок батарей электромобилей.", descriptionZh: "最大的锂储量。对电动汽车电池供应链至关重要。" }, { icon: "policy", title: "Ecological Zone", titleRu: "Экологическая зона", titleZh: "生态区", description: "Clean energy incentives and environmental protection focus.", descriptionRu: "Стимулы чистой энергии и акцент на защите окружающей среды.", descriptionZh: "清洁能源激励和环境保护重点。" }], contactInfo: { investmentAgency: "Qinghai Provincial Department of Commerce", website: "http://swt.qinghai.gov.cn", email: "invest@qinghai.gov.cn" } },
  "Tibet": { name: "Tibet", nameRu: "Тибет", nameZh: "西藏", gdp: "$30 Billion", population: "3.6 Million", industries: ["Tourism", "Mining", "Agriculture", "Traditional Crafts"], industriesRu: ["Туризм", "Горнодобывающая промышленность", "Сельское хозяйство", "Традиционные ремёсла"], industriesZh: ["旅游", "采矿", "农业", "传统工艺"], sezCount: 0, taxBenefits: ["Western Development incentives", "Poverty alleviation support", "Infrastructure investment benefits"], taxBenefitsRu: ["Стимулы развития западных регионов", "Поддержка борьбы с бедностью", "Льготы инфраструктурных инвестиций"], taxBenefitsZh: ["西部大开发激励", "扶贫支持", "基础设施投资优惠"], majorCities: [{ id: "lhasa", name: "Lhasa", nameRu: "Лхаса", nameZh: "拉萨", population: "0.9M" }, { id: "shigatse", name: "Shigatse", nameRu: "Шигатсе", nameZh: "日喀则", population: "0.8M" }, { id: "chamdo", name: "Chamdo", nameRu: "Чамдо", nameZh: "昌都", population: "0.7M" }], overview: "Roof of the World with unique Buddhist culture and stunning Himalayan landscapes. Limited industrial development but growing tourism and clean energy sectors. Strategic location bordering India and Nepal.", overviewRu: "Крыша мира с уникальной буддийской культурой и потрясающими гималайскими ландшафтами. Ограниченное промышленное развитие, но растущие туризм и сектор чистой энергии. Стратегическое расположение на границе с Индией и Непалом.", overviewZh: "世界屋脊，拥有独特的佛教文化和壮丽的喜马拉雅风景。工业发展有限，但旅游和清洁能源部门不断增长。与印度和尼泊尔接壤的战略位置。", targetSectors: ["Tourism", "Clean Energy", "Traditional Crafts", "Highland Agriculture", "Mining"], opportunities: [{ id: "tb-1", title: "Tibet Luxury Tourism", titleZh: "西藏高端旅游", titleRu: "Элитный туризм Тибета", sector: "Tourism", description: "High-end cultural and adventure tourism. Limited but premium market.", descriptionZh: "高端文化和探险旅游。有限但高端的市场。", descriptionRu: "Элитный культурный и приключенческий туризм. Ограниченный, но премиальный рынок.", investmentRange: "$5M - $50M", timeline: "3-5 years", status: "active" }, { id: "tb-2", title: "Tibet Solar & Hydropower", titleZh: "西藏太阳能和水电", titleRu: "Солнечная и гидроэнергетика Тибета", sector: "Energy", description: "Exceptional solar radiation and hydropower potential.", descriptionZh: "优越的太阳辐射和水电潜力。", descriptionRu: "Исключительная солнечная радиация и гидроэнергетический потенциал.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "tb-p1", name: "Lhasa-Nyingchi Railway Extension", value: "$5 Billion", sector: "Infrastructure", description: "Railway expansion opening new tourism areas.", completionYear: "2030" }], advantages: [{ icon: "location", title: "Unique Destination", titleRu: "Уникальное направление", titleZh: "独特目的地", description: "Unmatched cultural and natural heritage. Premium tourism market.", descriptionRu: "Непревзойдённое культурное и природное наследие. Премиальный туристический рынок.", descriptionZh: "无与伦比的文化和自然遗产。高端旅游市场。" }, { icon: "resources", title: "Clean Energy", titleRu: "Чистая энергия", titleZh: "清洁能源", description: "Exceptional solar and hydro resources.", descriptionRu: "Исключительные солнечные и гидроресурсы.", descriptionZh: "卓越的太阳能和水力资源。" }], contactInfo: { investmentAgency: "Tibet Department of Commerce", investmentAgencyRu: "Департамент торговли Тибета", investmentAgencyZh: "西藏自治区商务厅", website: "http://www.xizang.gov.cn", email: "invest@tibet.gov.cn" } },
  "Hong Kong": { name: "Hong Kong SAR", nameRu: "Гонконг", nameZh: "香港", gdp: "$360 Billion", population: "7.5 Million", industries: ["Finance", "Trade", "Professional Services", "Tourism"], sezCount: 0, taxBenefits: ["16.5% corporate tax", "No VAT/sales tax", "Free port status"], majorCities: [{ id: "central", name: "Central", nameRu: "Центральный район", nameZh: "中环", population: "0.1M", lat: 22.2819, lng: 114.1580, image: "https://images.unsplash.com/photo-1536599424071-0b215a388ba7?w=1920&q=80" }, { id: "kowloon", name: "Kowloon", nameRu: "Коулун", nameZh: "九龙", population: "2.3M", lat: 22.3193, lng: 114.1694, image: "https://images.unsplash.com/photo-1524236246106-c8c1e2e5cff4?w=1920&q=80" }, { id: "new-territories", name: "New Territories", nameRu: "Новые территории", nameZh: "新界", population: "4M", lat: 22.4530, lng: 114.1650, image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1920&q=80" }], overviewRu: "Глобальный финансовый центр и ворота между Китаем и миром. Система общего права, свободный поток капитала и мировые профессиональные услуги. Стратегическая платформа для российско-китайских инвестиций и торговли.", overviewZh: "全球金融中心和中国与世界的门户。普通法制度、资本自由流动和世界级专业服务。俄中投资和贸易的战略平台。", overview: "Global financial center and gateway between China and the world. Common law system, free capital flows, and world-class professional services. Strategic platform for Russia-China investment and trade structuring.", targetSectors: ["Finance", "Professional Services", "Trade", "Technology", "Asset Management"], opportunities: [{ id: "hk-1", title: "Hong Kong Russia-China Finance Platform", titleZh: "香港中俄金融平台", titleRu: "Гонконгская финансовая платформа Россия-Китай", sector: "Finance", description: "Structure cross-border investments, trade finance, and RMB settlement through Hong Kong.", descriptionZh: "通过香港构建跨境投资、贸易融资和人民币结算。", descriptionRu: "Структурирование трансграничных инвестиций, торгового финансирования и расчётов в юанях через Гонконг.", investmentRange: "$10M - $500M", timeline: "6-12 months", status: "active" }, { id: "hk-2", title: "Hong Kong Family Office Hub", titleZh: "香港家族办公室中心", titleRu: "Гонконгский хаб семейных офисов", sector: "Wealth Management", description: "Establish family offices with access to Greater China investments.", descriptionZh: "设立可进入大中华区投资的家族办公室。", descriptionRu: "Создание семейных офисов с доступом к инвестициям в Большой Китай.", investmentRange: "$50M - $1B", timeline: "3-6 months", status: "active" }], keyProjects: [{ id: "hk-p1", name: "Northern Metropolis Development", value: "$100 Billion", sector: "Urban Development", description: "New economic hub connecting to Shenzhen.", completionYear: "2035" }], advantages: [{ icon: "policy", title: "One Country Two Systems", titleRu: "Одна страна, две системы", titleZh: "一国两制", description: "Common law, free press, independent judiciary until 2047.", descriptionRu: "Общее право, свободная пресса, независимая судебная система до 2047 года.", descriptionZh: "普通法、新闻自由、独立司法至2047年。" }, { icon: "market", title: "Global Finance Hub", titleRu: "Глобальный финансовый центр", titleZh: "全球金融中心", description: "Top 3 financial center. Gateway for China investment.", descriptionRu: "Топ-3 финансовый центр. Ворота для инвестиций в Китай.", descriptionZh: "全球前三金融中心。中国投资门户。" }], contactInfo: { investmentAgency: "InvestHK", investmentAgencyRu: "Инвестиции в Гонконг", investmentAgencyZh: "香港投资推广署", website: "http://www.investhk.gov.hk", email: "enq@investhk.gov.hk", phone: "+852-3107-1000" } },
  "Macau": { name: "Macau SAR", nameRu: "Макао", nameZh: "澳门", gdp: "$30 Billion", population: "0.7 Million", industries: ["Gaming", "Tourism", "Finance", "MICE"], sezCount: 0, taxBenefits: ["12% corporate tax max", "No foreign exchange controls", "Gaming license benefits"], majorCities: [{ id: "macau-peninsula", name: "Macau Peninsula", nameRu: "Полуостров Макао", nameZh: "澳门半岛", population: "0.5M", lat: 22.1932, lng: 113.5415, image: "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=1920&q=80" }, { id: "taipa", name: "Taipa", nameRu: "Тайпа", nameZh: "氹仔", population: "0.1M", lat: 22.1560, lng: 113.5577, image: "https://images.unsplash.com/photo-1563436233770-eeca7a64cfcd?w=1920&q=80" }, { id: "cotai", name: "Cotai", nameRu: "Котай", nameZh: "路氹", population: "0.05M", lat: 22.1438, lng: 113.5581, image: "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=1920&q=80" }], overviewRu: "Крупнейший в мире центр азартных игр и португальско-китайский культурный синтез. Переход к диверсифицированному туризму и MICE-направлению. Зона сотрудничества Хэнцинь расширяет возможности.", overviewZh: "世界最大的博彩中心和葡萄牙-中国文化融合。向多元化旅游和会展目的地转变。横琴合作区扩大了机遇。", overview: "World's largest gaming center and Portuguese-Chinese cultural fusion. Transitioning to diversified tourism and MICE destination. Hengqin cooperation zone expanding opportunities.", targetSectors: ["Tourism", "MICE", "Finance", "Portuguese-speaking Countries Trade", "Healthcare"], opportunities: [{ id: "mo-1", title: "Macau-Hengqin Cooperation Zone", titleZh: "澳门-横琴合作区", titleRu: "Зона сотрудничества Макао-Хэнцинь", sector: "Services", description: "New zone quadrupling Macau's development space. Modern industries and Portuguese trade platform.", descriptionZh: "新区域使澳门发展空间扩大四倍。现代产业和葡语国家贸易平台。", descriptionRu: "Новая зона, увеличивающая пространство развития Макао в 4 раза. Современные отрасли и платформа торговли с португалоязычными странами.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" }, { id: "mo-2", title: "Macau MICE & Events", titleZh: "澳门会展活动", titleRu: "MICE и мероприятия Макао", sector: "Tourism", description: "Convention, exhibition, and entertainment infrastructure.", descriptionZh: "会议、展览和娱乐基础设施。", descriptionRu: "Конгрессная, выставочная и развлекательная инфраструктура.", investmentRange: "$5M - $100M", timeline: "1-3 years", status: "active" }], keyProjects: [{ id: "mo-p1", name: "Hengqin Guangdong-Macao Deep Cooperation Zone", value: "$10 Billion", sector: "Development", description: "106 sq km new development zone.", completionYear: "2029" }], advantages: [{ icon: "policy", title: "Gaming Hub", titleRu: "Игорный центр", titleZh: "博彩中心", description: "World's largest casino market. Premium tourism infrastructure.", descriptionRu: "Крупнейший в мире рынок казино. Премиальная туристическая инфраструктура.", descriptionZh: "世界最大的赌场市场。高端旅游基础设施。" }, { icon: "location", title: "Portuguese Gateway", titleRu: "Португальские ворота", titleZh: "葡语门户", description: "Platform for trade with Portuguese-speaking countries.", descriptionRu: "Платформа для торговли с португалоязычными странами.", descriptionZh: "与葡语国家贸易的平台。" }], contactInfo: { investmentAgency: "Macau Trade and Investment Promotion Institute", investmentAgencyRu: "Институт содействия торговле и инвестициям Макао", investmentAgencyZh: "澳门贸易投资促进局", website: "http://www.ipim.gov.mo", email: "ipim@ipim.gov.mo", phone: "+853-2871-0300" } },
};

export const RUSSIA_REGIONS: Record<string, RegionData> = {
  "Moscow": {
    name: "Moscow",
    nameRu: "Москва",
    nameZh: "莫斯科",
    gdp: "$416 Billion",
    population: "12.6 Million",
    industries: ["Finance", "Technology", "Services", "Media"],
    industriesRu: ["Финансы", "Технологии", "Услуги", "Медиа"],
    industriesZh: ["金融", "科技", "服务业", "媒体"],
    sezCount: 4,
    taxBenefits: ["Special Investment Contracts", "Technology park benefits", "R&D incentives"],
    taxBenefitsRu: ["Специальные инвестиционные контракты", "Льготы технопарков", "Льготы на НИОКР"],
    taxBenefitsZh: ["特别投资合同", "科技园区优惠", "研发激励政策"],
    majorCities: [
      { id: "central-ao", name: "Central Administrative Okrug", nameRu: "Центральный административный округ", nameZh: "中央行政区", population: "0.8M", lat: 55.7539, lng: 37.6208, image: "https://images.unsplash.com/photo-1513326738677-b964603b136d?w=1920&q=80", description: "The heart of Moscow with Red Square, the Kremlin, and Tverskaya Street. Russia's political and business epicenter with the highest concentration of headquarters and luxury retail.", opportunities: [
        { id: "msc-c-1", title: "Tverskaya Premium Retail", titleZh: "特维尔大街高端零售", titleRu: "Премиальный ритейл на Тверской", sector: "Retail", description: "Flagship stores on Russia's most prestigious shopping street. Chinese luxury brands entering Russian market.", descriptionZh: "在俄罗斯最负盛名的购物街开设旗舰店。中国奢侈品牌进入俄罗斯市场。", descriptionRu: "Флагманские магазины на самой престижной торговой улице России. Китайские люксовые бренды, выходящие на российский рынок.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "msc-c-2", title: "Moscow City Business Center", titleZh: "莫斯科城商务中心", titleRu: "Деловой центр Москва-Сити", sector: "Real Estate", description: "Grade A office space in Russia's Manhattan. Chinese company regional headquarters.", descriptionZh: "俄罗斯曼哈顿的甲级写字楼。中国公司区域总部。", descriptionRu: "Офисы класса А в российском Манхэттене. Региональные штаб-квартиры китайских компаний.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "northern-ao", name: "Northern Administrative Okrug", nameRu: "Северный административный округ", nameZh: "北部行政区", population: "1.2M", image: "https://images.unsplash.com/photo-1520106212299-d99c443e4568?w=1920&q=80", description: "Major industrial and residential district with Sheremetyevo Airport connection. Home to tech parks and manufacturing zones near key transportation infrastructure.", opportunities: [
        { id: "msc-n-1", title: "Sheremetyevo Logistics Zone", titleZh: "谢列梅捷沃物流区", titleRu: "Логистическая зона Шереметьево", sector: "Logistics", description: "Air cargo and distribution facilities near Russia's largest airport. E-commerce fulfillment center.", descriptionZh: "靠近俄罗斯最大机场的航空货运和配送设施。电商履约中心。", descriptionRu: "Объекты авиагрузов и дистрибуции рядом с крупнейшим аэропортом России. Фулфилмент-центр электронной коммерции.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" }
      ]},
      { id: "southern-ao", name: "Southern Administrative Okrug", nameRu: "Южный административный округ", nameZh: "南部行政区", population: "1.8M", image: "https://images.unsplash.com/photo-1547448415-e9f5b28e570d?w=1920&q=80", description: "Growing residential and commercial district with major industrial heritage. Home to technology parks and research institutes.", opportunities: [
        { id: "msc-s-1", title: "Skolkovo Innovation Center", titleZh: "斯科尔科沃创新中心", titleRu: "Инновационный центр Сколково", sector: "Technology", description: "Russia's Silicon Valley. Tech startups, R&D centers, and university partnerships.", descriptionZh: "俄罗斯的硅谷。科技初创企业、研发中心和大学合作。", descriptionRu: "Российская Кремниевая долина. Технологические стартапы, R&D-центры и университетские партнёрства.", investmentRange: "$5M - $80M", timeline: "1-3 years", status: "priority" }
      ]}
    ],
    overview: "Russia's capital and largest city, Moscow is the undisputed political, economic, and cultural center. Home to the Kremlin, major banks, tech companies (Yandex, Mail.ru), and serves as headquarters for most Russian-Chinese joint ventures. Key gateway for Chinese investment into Russia.",
    overviewRu: "Столица и крупнейший город России, Москва является бесспорным политическим, экономическим и культурным центром. Здесь находятся Кремль, крупнейшие банки, технологические компании (Яндекс, Mail.ru), а также штаб-квартиры большинства российско-китайских совместных предприятий.",
    overviewZh: "俄罗斯首都和最大城市，莫斯科是无可争议的政治、经济和文化中心。这里是克里姆林宫、主要银行、科技公司（Yandex、Mail.ru）的所在地，也是大多数中俄合资企业的总部所在地。是中国投资进入俄罗斯的重要门户。",
    targetSectors: ["Fintech", "E-commerce", "IT Services", "Real Estate", "Consumer Goods"],
    opportunities: [
      { id: "msk-1", title: "Moscow International Financial Center", titleZh: "莫斯科国际金融中心", titleRu: "Московский международный финансовый центр", sector: "Finance", description: "Establish banking, insurance, or asset management presence. RMB clearing center and SPFS payment system integration for China trade.", descriptionZh: "建立银行、保险或资产管理业务。人民币清算中心和SPFS支付系统集成，服务中国贸易。", descriptionRu: "Создание банковского, страхового или инвестиционного присутствия. Клиринговый центр юаня и интеграция с платёжной системой СПФС для торговли с Китаем.", investmentRange: "$20M - $500M", timeline: "1-2 years", status: "priority" },
      { id: "msk-2", title: "Skolkovo Innovation Center", titleZh: "斯科尔科沃创新中心", titleRu: "Инновационный центр Сколково", sector: "Technology", description: "Russia's Silicon Valley with tax-free status. AI, biotech, and IT partnerships with major Russian tech companies.", descriptionZh: "俄罗斯的硅谷，享有免税地位。与俄罗斯主要科技公司的人工智能、生物技术和IT合作。", descriptionRu: "Российская Кремниевая долина с безналоговым статусом. Партнёрства в области ИИ, биотехнологий и ИТ с ведущими российскими технологическими компаниями.", investmentRange: "$5M - $100M", timeline: "1-3 years", status: "active" },
      { id: "msk-3", title: "Moscow E-commerce & Logistics", titleZh: "莫斯科电商与物流", titleRu: "Московская электронная коммерция и логистика", sector: "E-commerce", description: "Last-mile delivery and fulfillment centers for Chinese goods. Partnership with Ozon, Wildberries marketplaces.", descriptionZh: "中国商品的最后一公里配送和履约中心。与Ozon、Wildberries电商平台合作。", descriptionRu: "Центры доставки последней мили и фулфилмента для китайских товаров. Партнёрство с маркетплейсами Ozon и Wildberries.", investmentRange: "$10M - $100M", timeline: "1-2 years", status: "active" },
      { id: "msk-4", title: "Moscow Real Estate Development", titleZh: "莫斯科房地产开发", titleRu: "Девелопмент недвижимости в Москве", sector: "Real Estate", description: "Commercial and residential development in expanding Moscow. Chinese construction technology and materials.", descriptionZh: "在不断扩张的莫斯科进行商业和住宅开发。中国建筑技术和材料。", descriptionRu: "Коммерческая и жилая застройка расширяющейся Москвы. Китайские строительные технологии и материалы.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "msk-p1", name: "Moscow-Beijing High-Speed Rail Planning", nameRu: "Высокоскоростная магистраль Москва-Пекин", nameZh: "莫斯科-北京高速铁路规划", value: "$242 Billion", sector: "Infrastructure", description: "Planning phase for 7,000km HSR connection. Feasibility studies and route planning.", descriptionRu: "Этап планирования ВСМ протяжённостью 7000 км. Технико-экономическое обоснование и проектирование маршрута.", descriptionZh: "7000公里高铁连接的规划阶段。可行性研究和路线规划。", partners: ["Russian Railways", "China Railway"], completionYear: "2035" },
      { id: "msk-p2", name: "Yandex-Alibaba E-commerce Platform", nameRu: "Электронная платформа Яндекс-Alibaba", nameZh: "Yandex-阿里巴巴电商平台", value: "$1 Billion", sector: "E-commerce", description: "Joint venture for cross-border e-commerce between Russia and China.", descriptionRu: "Совместное предприятие для трансграничной электронной коммерции между Россией и Китаем.", descriptionZh: "中俄跨境电商合资企业。", partners: ["Yandex", "Alibaba"], completionYear: "Ongoing" }
    ],
    advantages: [
      { icon: "market", title: "Economic Hub", titleRu: "Экономический центр", titleZh: "经济中心", description: "25% of Russia's GDP. Headquarters of major corporations and banks.", descriptionRu: "25% ВВП России. Штаб-квартиры крупнейших корпораций и банков.", descriptionZh: "俄罗斯GDP的25%。主要企业和银行总部所在地。" },
      { icon: "talent", title: "Talent Pool", titleRu: "Кадровый потенциал", titleZh: "人才库", description: "250+ universities, 1 million+ students. Strong IT and engineering talent.", descriptionRu: "250+ университетов, более 1 млн студентов. Сильные кадры в IT и инженерии.", descriptionZh: "250多所大学，100多万学生。强大的IT和工程人才。" },
      { icon: "infrastructure", title: "Global Connectivity", titleRu: "Глобальная связанность", titleZh: "全球互联", description: "3 international airports, high-speed rail hub. Direct flights to all Chinese cities.", descriptionRu: "3 международных аэропорта, узел высокоскоростных железных дорог. Прямые рейсы во все города Китая.", descriptionZh: "3个国际机场，高铁枢纽。直飞中国所有城市。" },
      { icon: "policy", title: "Administrative Center", titleRu: "Административный центр", titleZh: "行政中心", description: "All federal ministries and regulatory bodies. Fastest approvals.", descriptionRu: "Все федеральные министерства и регуляторы. Быстрейшие согласования.", descriptionZh: "所有联邦部委和监管机构。最快的审批速度。" }
    ],
    notableEntrepreneurs: [
      { name: "Vladimir Potanin", nameRu: "Владимир Потанин", nameZh: "弗拉基米尔·波塔宁", company: "Norilsk Nickel", industry: "Mining & Metals", netWorth: "$30.4B", description: "President of Nornickel, world's largest producer of nickel and palladium. Russia's richest person.", descriptionRu: "Президент «Норникеля», крупнейшего в мире производителя никеля и палладия. Богатейший человек России.", descriptionZh: "诺里尔斯克镍业总裁，世界最大的镍和钯生产商。俄罗斯首富。" },
      { name: "Leonid Mikhelson", nameRu: "Леонид Михельсон", nameZh: "列昂尼德·米赫尔松", company: "Novatek", industry: "Natural Gas", netWorth: "$27.4B", description: "CEO of Novatek, Russia's largest independent gas producer. Leading Arctic LNG development.", descriptionRu: "Генеральный директор «Новатэка», крупнейшего независимого производителя газа в России. Лидер в освоении арктического СПГ.", descriptionZh: "诺瓦泰克首席执行官，俄罗斯最大的独立天然气生产商。引领北极LNG开发。" },
      { name: "Pavel Durov", nameRu: "Павел Дуров", nameZh: "帕维尔·杜罗夫", company: "Telegram", industry: "Technology", netWorth: "$15.5B", description: "Founder of Telegram and VKontakte. Russia's most famous tech entrepreneur, now based in Dubai.", descriptionRu: "Основатель Telegram и ВКонтакте. Самый известный технологический предприниматель России, ныне живёт в Дубае.", descriptionZh: "Telegram和VKontakte创始人。俄罗斯最著名的科技企业家，现居迪拜。" },
      { name: "Arkady Volozh", nameRu: "Аркадий Волож", nameZh: "阿尔卡季·沃洛日", company: "Yandex", industry: "Technology", netWorth: "$5.7B", description: "Co-founder of Yandex, Russia's largest search engine and tech company. Pioneer of Russian internet.", descriptionRu: "Сооснователь «Яндекса», крупнейшей поисковой системы и технологической компании России. Пионер российского интернета.", descriptionZh: "Yandex联合创始人，俄罗斯最大的搜索引擎和科技公司。俄罗斯互联网先驱。" }
    ],
    contactInfo: { investmentAgency: "Moscow City Investment Agency", investmentAgencyRu: "Московское городское инвестиционное агентство", investmentAgencyZh: "莫斯科市投资局", website: "https://investmoscow.ru", email: "info@investmoscow.ru", phone: "+7-495-620-2045" }
  },
  "Saint Petersburg": {
    name: "Saint Petersburg",
    nameRu: "Санкт-Петербург",
    nameZh: "圣彼得堡",
    gdp: "$163 Billion",
    population: "5.4 Million",
    industries: ["Shipbuilding", "Automotive", "IT", "Tourism"],
    industriesRu: ["Судостроение", "Автомобилестроение", "ИТ", "Туризм"],
    industriesZh: ["造船业", "汽车制造", "信息技术", "旅游业"],
    sezCount: 2,
    taxBenefits: ["SEZ benefits", "IT park incentives", "Cultural industry support"],
    taxBenefitsRu: ["Льготы ОЭЗ", "Льготы IT-парков", "Поддержка культурной индустрии"],
    taxBenefitsZh: ["经济特区优惠", "IT园区激励政策", "文化产业支持"],
    majorCities: [
      { id: "admiralteysky", name: "Admiralteysky District", nameRu: "Адмиралтейский район", nameZh: "海军部区", population: "0.16M", lat: 59.9311, lng: 30.3150, image: "https://images.unsplash.com/photo-1556610961-2fecc5927173?w=1920&q=80", description: "Historic heart of St. Petersburg with the Admiralty, St. Isaac's Cathedral, and the Hermitage. Russia's cultural capital and UNESCO World Heritage site.", opportunities: [
{ id: "spb-a-1", title: "Heritage Tourism Development", titleZh: "遗产旅游开发", titleRu: "Развитие наследия туризма", sector: "Tourism", description: "Boutique hotels and cultural tourism near Hermitage and Palace Square. Growing Chinese tourist segment.", descriptionZh: "靠近冬宫和宫殿广场的精品酒店和文化旅游。中国游客群体不断增长。", descriptionRu: "Бутик-отели и культурный туризм рядом с Эрмитажем и Дворцовой площадью. Растущий сегмент китайских туристов.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
         { id: "spb-a-2", title: "Luxury Hospitality", titleZh: "豪华酒店业", titleRu: "Люксовое гостеприимство", sector: "Hospitality", description: "5-star hotels and restaurants catering to high-end Chinese tourists. WeChat/Alipay integration.", descriptionZh: "面向高端中国游客的五星级酒店和餐厅。微信/支付宝集成。", descriptionRu: "5-звёздочные отели и рестораны для состоятельных китайских туристов. Интеграция WeChat/Alipay.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "vasileostrovsky", name: "Vasileostrovsky Island", nameRu: "Васильевский остров", nameZh: "瓦西里岛", population: "0.21M", image: "https://images.unsplash.com/photo-1548834925-e48f8a27ae1f?w=1920&q=80", description: "Historic island district with the Rostral Columns, universities, and emerging tech scene. Major port facilities and the new Lakhta Center (Gazprom HQ).", opportunities: [
{ id: "spb-v-1", title: "Baltic Port Development", titleZh: "波罗的海港口开发", titleRu: "Развитие Балтийского порта", sector: "Logistics", description: "Container terminal and logistics facilities. Direct shipping connections to China.", descriptionZh: "集装箱码头和物流设施。与中国的直达海运连接。", descriptionRu: "Контейнерный терминал и логистические объекты. Прямые морские маршруты в Китай.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
         { id: "spb-v-2", title: "St. Petersburg IT Cluster", titleZh: "圣彼得堡IT集群", titleRu: "IT-кластер Санкт-Петербурга", sector: "IT", description: "Software development and gaming studios. JetBrains and Vkontakte ecosystem.", descriptionZh: "软件开发和游戏工作室。JetBrains和VKontakte生态系统。", descriptionRu: "Разработка ПО и игровые студии. Экосистема JetBrains и ВКонтакте.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "petrogradsky", name: "Petrogradsky District", nameRu: "Петроградский район", nameZh: "彼得格勒区", population: "0.13M", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=80", description: "Historic district with the Peter and Paul Fortress and growing residential development. Mix of heritage sites and modern apartments.", opportunities: [
        { id: "spb-p-1", title: "Mixed-Use Development", titleZh: "综合开发", titleRu: "Многофункциональная застройка", sector: "Real Estate", description: "Premium residential and retail development in historic settings.", descriptionZh: "在历史环境中的高端住宅和零售开发。", descriptionRu: "Премиальная жилая и торговая застройка в историческом окружении.", investmentRange: "$15M - $100M", timeline: "3-4 years", status: "active" }
      ]}
    ],
    overview: "Russia's cultural capital and second-largest city. Major port on the Baltic Sea with strong shipbuilding, automotive (Toyota, Hyundai, Nissan plants), and IT sectors. Historic architecture attracts millions of Chinese tourists annually. Hosts St. Petersburg International Economic Forum.",
    overviewRu: "Культурная столица России и второй по величине город. Крупный порт на Балтийском море с развитым судостроением, автомобильной промышленностью (заводы Toyota, Hyundai, Nissan) и IT-сектором. Историческая архитектура привлекает миллионы китайских туристов ежегодно.",
    overviewZh: "俄罗斯的文化之都和第二大城市。波罗的海主要港口，拥有发达的造船业、汽车制造业（丰田、现代、日产工厂）和IT行业。历史建筑每年吸引数百万中国游客。圣彼得堡国际经济论坛的举办地。",
    targetSectors: ["Shipbuilding", "Automotive", "IT & Software", "Tourism", "Pharmaceuticals"],
    opportunities: [
{ id: "spb-1", title: "Baltic Shipyard Modernization", titleZh: "波罗的海造船厂现代化", titleRu: "Модернизация Балтийского судостроительного завода", sector: "Shipbuilding", description: "Icebreaker and LNG carrier construction partnerships. Russian Arctic fleet expansion.", descriptionZh: "破冰船和LNG运输船建造合作。俄罗斯北极船队扩张。", descriptionRu: "Партнёрства по строительству ледоколов и СПГ-танкеров. Расширение российского арктического флота.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
       { id: "spb-2", title: "St. Petersburg IT Cluster", titleZh: "圣彼得堡IT集群", titleRu: "IT-кластер Санкт-Петербурга", sector: "IT", description: "Software development, gaming, and fintech. Partnerships with JetBrains, Vkontakte, and gaming studios.", descriptionZh: "软件开发、游戏和金融科技。与JetBrains、VKontakte和游戏工作室合作。", descriptionRu: "Разработка ПО, гейминг и финтех. Партнёрства с JetBrains, ВКонтакте и игровыми студиями.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
       { id: "spb-3", title: "Chinese Tourism Infrastructure", titleZh: "中国旅游基础设施", titleRu: "Инфраструктура для китайского туризма", sector: "Tourism", description: "Hotels, restaurants, and tourism services for 1 million+ Chinese visitors. WeChat/Alipay integration.", descriptionZh: "为100万+中国游客提供酒店、餐厅和旅游服务。微信/支付宝集成。", descriptionRu: "Отели, рестораны и туристические услуги для 1+ млн китайских посетителей. Интеграция WeChat/Alipay.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" },
       { id: "spb-4", title: "Pharmaceutical Production", titleZh: "制药生产", titleRu: "Фармацевтическое производство", sector: "Pharma", description: "Generic drug manufacturing and biotech. Partnerships with Russian pharmaceutical companies.", descriptionZh: "仿制药生产和生物技术。与俄罗斯制药公司合作。", descriptionRu: "Производство дженериков и биотехнологии. Партнёрства с российскими фармацевтическими компаниями.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "spb-p1", name: "Lakhta Center Phase 2", nameRu: "Лахта Центр Фаза 2", nameZh: "拉赫塔中心二期", value: "$2 Billion", sector: "Real Estate", description: "Gazprom headquarters expansion. Commercial and residential development.", descriptionRu: "Расширение штаб-квартиры Газпрома. Коммерческая и жилая застройка.", descriptionZh: "俄罗斯天然气工业股份公司总部扩建。商业和住宅开发。", partners: ["Gazprom"], completionYear: "2028" },
      { id: "spb-p2", name: "Pulkovo Airport Expansion", nameRu: "Расширение аэропорта Пулково", nameZh: "普尔科沃机场扩建", value: "$1 Billion", sector: "Aviation", description: "Terminal expansion for increased China traffic.", descriptionRu: "Расширение терминала для увеличения пассажиропотока из Китая.", descriptionZh: "航站楼扩建以应对中国客流增长。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Baltic Port", titleRu: "Балтийский порт", titleZh: "波罗的海港口", description: "Major port connecting to Europe. Icebreaker support for year-round operations.", descriptionRu: "Крупный порт, связывающий с Европой. Ледокольная поддержка для круглогодичной работы.", descriptionZh: "连接欧洲的主要港口。破冰船支持全年运营。" },
      { icon: "talent", title: "IT Excellence", titleRu: "IT-превосходство", titleZh: "IT卓越", description: "Strong software engineering tradition. JetBrains, Vkontakte headquarters.", descriptionRu: "Сильные традиции разработки ПО. Штаб-квартиры JetBrains и ВКонтакте.", descriptionZh: "强大的软件工程传统。JetBrains和VKontakte总部所在地。" },
      { icon: "infrastructure", title: "Tourism Hub", titleRu: "Туристический центр", titleZh: "旅游中心", description: "UNESCO World Heritage city. Hermitage, Mariinsky Theatre.", descriptionRu: "Город всемирного наследия ЮНЕСКО. Эрмитаж, Мариинский театр.", descriptionZh: "联合国教科文组织世界遗产城市。冬宫、马林斯基剧院。" },
      { icon: "policy", title: "SPIEF Host", titleRu: "Площадка ПМЭФ", titleZh: "SPIEF主办地", description: "Annual St. Petersburg International Economic Forum - key China-Russia business platform.", descriptionRu: "Ежегодный Петербургский международный экономический форум — ключевая площадка китайско-российского бизнеса.", descriptionZh: "每年举办圣彼得堡国际经济论坛——中俄商业的关键平台。" }
    ],
    notableEntrepreneurs: [
      { name: "Yuri Milner", nameRu: "Юрий Мильнер", nameZh: "尤里·米尔纳", company: "DST Global", industry: "Venture Capital", netWorth: "$7.3B", description: "Co-founder of DST Global, early investor in Facebook, Twitter, and Alibaba. Pioneer of Russian tech investing globally.", descriptionRu: "Сооснователь DST Global, ранний инвестор в Facebook, Twitter и Alibaba. Пионер российских технологических инвестиций в мировом масштабе.", descriptionZh: "DST Global联合创始人，Facebook、Twitter和阿里巴巴的早期投资者。俄罗斯科技全球投资的先驱。" },
      { name: "Pavel Durov", nameRu: "Павел Дуров", nameZh: "帕维尔·杜罗夫", company: "Telegram", industry: "Technology", netWorth: "$15.5B", description: "Founder of VKontakte and Telegram. Born and studied in St. Petersburg. Russia's most influential tech entrepreneur.", descriptionRu: "Основатель ВКонтакте и Telegram. Родился и учился в Санкт-Петербурге. Самый влиятельный технологический предприниматель России.", descriptionZh: "VKontakte和Telegram创始人。出生并在圣彼得堡求学。俄罗斯最具影响力的科技企业家。" },
      { name: "Maxim Galkin", nameRu: "Максим Галкин", nameZh: "马克西姆·加尔金", company: "JetBrains", industry: "Software", netWorth: "$1.8B", description: "Co-founder of JetBrains, maker of IntelliJ IDEA and Kotlin programming language. St. Petersburg-based software tools company.", descriptionRu: "Сооснователь JetBrains, создателя IntelliJ IDEA и языка программирования Kotlin. Петербургская компания по разработке инструментов для программистов.", descriptionZh: "JetBrains联合创始人，IntelliJ IDEA和Kotlin编程语言的开发商。总部位于圣彼得堡的软件工具公司。" },
      { name: "Sergey Galitsky", nameRu: "Сергей Галицкий", nameZh: "谢尔盖·加利茨基", company: "Magnit", industry: "Retail", netWorth: "$3.2B", description: "Founder of Magnit retail chain. One of Russia's most successful self-made entrepreneurs. Major philanthropist.", descriptionRu: "Основатель сети магазинов «Магнит». Один из самых успешных предпринимателей России, добившийся всего самостоятельно. Крупный меценат.", descriptionZh: "Magnit零售连锁店创始人。俄罗斯最成功的白手起家企业家之一。著名慈善家。" }
    ],
    contactInfo: { investmentAgency: "St. Petersburg Investment Agency", investmentAgencyRu: "Инвестиционное агентство Санкт-Петербурга", investmentAgencyZh: "圣彼得堡投资局", website: "https://spbia.ru", email: "info@spbia.ru", phone: "+7-812-576-7500" }
  },
  "Moscow Oblast": {
    name: "Moscow Oblast",
    nameRu: "Московская область",
    nameZh: "莫斯科州",
    gdp: "$113 Billion",
    population: "8.5 Million",
    industries: ["Manufacturing", "Logistics", "Food Processing", "Chemicals"],
    industriesRu: ["Производство", "Логистика", "Пищевая переработка", "Химия"],
    industriesZh: ["制造业", "物流", "食品加工", "化学品"],
    sezCount: 3,
    taxBenefits: ["Industrial park benefits", "Logistics hub incentives", "Manufacturing support"],
    taxBenefitsRu: ["Льготы индустриальных парков", "Льготы логистических хабов", "Поддержка производства"],
    taxBenefitsZh: ["工业园区优惠", "物流中心激励政策", "制造业支持"],
    majorCities: [
      { id: "krasnogorsk", name: "Krasnogorsk", nameRu: "Красногорск", nameZh: "克拉斯诺戈尔斯克", population: "0.2M", image: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=1920&q=80", description: "Modern satellite city northwest of Moscow. Major business center with Crocus City complex and growing tech presence.", descriptionRu: "Современный город-спутник к северо-западу от Москвы. Крупный бизнес-центр с комплексом Крокус Сити и растущим технологическим присутствием.", descriptionZh: "莫斯科西北部的现代卫星城。拥有番红花城综合体的主要商业中心，科技产业不断发展。", opportunities: [
        { id: "krs-1", title: "Crocus City Expansion", titleZh: "番红花城扩建", titleRu: "Расширение Крокус Сити", sector: "Real Estate", description: "Exhibition, retail, and office development in Russia's largest expo complex.", descriptionZh: "俄罗斯最大展览综合体的展览、零售和办公开发。", descriptionRu: "Выставочная, торговая и офисная застройка в крупнейшем экспокомплексе России.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "balashikha", name: "Balashikha", nameRu: "Балашиха", nameZh: "巴拉什哈", population: "0.5M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Largest satellite city of Moscow with strong manufacturing and logistics base. Excellent highway access to Moscow center.", descriptionRu: "Крупнейший город-спутник Москвы с развитой производственной и логистической базой. Отличный доступ по шоссе к центру Москвы.", descriptionZh: "莫斯科最大的卫星城，拥有强大的制造业和物流基础。通往莫斯科市中心的高速公路交通便利。", opportunities: [
        { id: "bal-1", title: "Moscow East Logistics Hub", titleZh: "莫斯科东部物流中心", titleRu: "Восточный логистический хаб Москвы", sector: "Logistics", description: "Warehousing and distribution for eastern approaches to Moscow. E-commerce fulfillment.", descriptionZh: "莫斯科东部入口的仓储和配送。电商履约。", descriptionRu: "Складирование и дистрибуция для восточных подходов к Москве. Фулфилмент e-commerce.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "priority" }
      ]},
      { id: "khimki", name: "Khimki", nameRu: "Химки", nameZh: "希姆基", population: "0.3M", image: "https://images.unsplash.com/photo-1558618047-f4b4c45d7b42?w=1920&q=80", description: "Northern satellite city home to Sheremetyevo Airport and major shopping centers. Key logistics and retail hub.", descriptionRu: "Северный город-спутник, где расположен аэропорт Шереметьево и крупные торговые центры. Ключевой логистический и торговый хаб.", descriptionZh: "北部卫星城，谢列梅捷沃机场和主要购物中心所在地。重要的物流和零售中心。", opportunities: [
        { id: "khm-1", title: "Airport City Development", titleZh: "机场城市开发", titleRu: "Развитие Airport City", sector: "Real Estate", description: "Hotels, offices, and retail near Sheremetyevo. Transit-oriented development.", descriptionZh: "谢列梅捷沃机场附近的酒店、办公和零售。交通导向型开发。", descriptionRu: "Отели, офисы и торговля рядом с Шереметьево. Транзитно-ориентированное развитие.", investmentRange: "$25M - $180M", timeline: "3-5 years", status: "active" },
        { id: "khm-2", title: "Mega Shopping Center", titleZh: "Mega购物中心", titleRu: "Торговый центр Мега", sector: "Retail", description: "Partnership with IKEA centers and retail development.", descriptionZh: "与宜家中心合作和零售开发。", descriptionRu: "Партнёрство с центрами IKEA и розничное развитие.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Region surrounding Moscow with massive logistics and manufacturing infrastructure. Home to major industrial parks, warehouses, and food processing facilities serving the 20+ million Moscow metropolitan area.",
    overviewRu: "Регион, окружающий Москву, с огромной логистической и производственной инфраструктурой. Дом крупных индустриальных парков, складов и пищевых перерабатывающих предприятий, обслуживающих 20+ миллионов жителей московской агломерации.",
    overviewZh: "围绕莫斯科的地区，拥有庞大的物流和制造基础设施。拥有主要工业园区、仓库和食品加工设施，为2000多万莫斯科都市区居民服务。",
    targetSectors: ["Logistics", "Food Processing", "Manufacturing", "Data Centers", "Retail"],
    opportunities: [
      { id: "mo-1", title: "Moscow Region Logistics Hub", titleZh: "莫斯科州物流中心", titleRu: "Логистический хаб Московской области", sector: "Logistics", description: "Warehouse and distribution centers for Chinese goods entering Russia. E-commerce fulfillment.", descriptionZh: "中国商品进入俄罗斯的仓储和配送中心。电商履约。", descriptionRu: "Складские и распределительные центры для китайских товаров в России. Фулфилмент e-commerce.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
      { id: "mo-2", title: "Food Processing Cluster", titleZh: "食品加工集群", titleRu: "Кластер пищевой переработки", sector: "Food", description: "Processing facilities for Chinese food products and Russian agricultural exports.", descriptionZh: "中国食品和俄罗斯农产品出口加工设施。", descriptionRu: "Перерабатывающие мощности для китайских продуктов питания и российского агроэкспорта.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "mo-p1", name: "Sheremetyevo Cargo Expansion", nameRu: "Расширение грузового терминала Шереметьево", nameZh: "谢列梅捷沃货运扩建", value: "$500 Million", sector: "Logistics", description: "Air cargo terminal expansion for China trade.", descriptionRu: "Расширение аэрокарго терминала для торговли с Китаем.", descriptionZh: "为中国贸易扩建航空货运码头。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Moscow Gateway", titleRu: "Ворота Москвы", titleZh: "莫斯科门户", description: "Surrounds Moscow with excellent highway and rail access.", descriptionRu: "Окружает Москву с отличным доступом по шоссе и железной дороге.", descriptionZh: "围绕莫斯科，拥有优秀的公路和铁路通道。" },
      { icon: "market", title: "Massive Market", titleRu: "Огромный рынок", titleZh: "巨大市场", description: "Direct access to 20+ million Moscow metro consumers.", descriptionRu: "Прямой доступ к 20+ миллионам потребителей московской агломерации.", descriptionZh: "直接进入2000多万莫斯科都市区消费者。" }
    ],
    contactInfo: { investmentAgency: "Moscow Oblast Investment Agency", investmentAgencyRu: "Инвестиционное агентство Московской области", investmentAgencyZh: "莫斯科州投资局", website: "https://mosreg.ru", email: "invest@mosreg.ru" }
  },

  "Tatarstan": {
    name: "Republic of Tatarstan",
    nameRu: "Республика Татарстан",
    nameZh: "鞑靼斯坦共和国",
    gdp: "$61 Billion",
    population: "4 Million",
    industries: ["Oil & Gas", "Petrochemicals", "Automotive", "IT"],
     industriesRu: ["Нефть и газ", "Нефтехимия", "Автомобилестроение", "ИТ"],
     industriesZh: ["石油和天然气", "石化产品", "汽车制造", "信息技术"],
    sezCount: 4,
    taxBenefits: ["Alabuga SEZ benefits", "IT park Innopolis incentives", "Petrochemical support"],
     taxBenefitsRu: ["Льготы ОЭЗ Алабуга", "Льготы IT-парка Иннополис", "Поддержка нефтехимии"],
     taxBenefitsZh: ["阿拉布加经济特区优惠", "伊诺波利斯IT园区激励政策", "石化产业支持"],
    majorCities: [
      { id: "kazan", name: "Kazan", nameRu: "Казань", nameZh: "喀山", population: "1.3M", lat: 55.7887, lng: 49.1221, image: "https://images.unsplash.com/photo-1561627358-3e27ef39c9dd?w=1920&q=80", description: "Capital of Tatarstan and Russia's sports capital. Beautiful UNESCO World Heritage Kremlin, emerging IT hub (Innopolis nearby), and Haier manufacturing base. Model for Russian regional development.", opportunities: [
        { id: "kzn-1", title: "Kazan IT Park", titleRu: "Казанский IT-парк", titleZh: "喀山IT园区", sector: "IT", description: "Software development and tech services. Gateway to Innopolis ecosystem with tax incentives.", descriptionRu: "Разработка программного обеспечения и IT-услуги. Доступ к экосистеме Иннополиса с налоговыми льготами.", descriptionZh: "软件开发和技术服务。通往伊诺波利斯生态系统的门户，享受税收优惠。", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "priority" },
{ id: "kzn-2", title: "Haier Ecosystem Expansion", titleZh: "海尔生态扩展", titleRu: "Расширение экосистемы Haier", sector: "Manufacturing", description: "Supply chain partnerships with Haier's Russian manufacturing base. Appliance components.", descriptionZh: "与海尔俄罗斯制造基地的供应链合作。家电零部件。", descriptionRu: "Партнёрства по цепочке поставок с российской производственной базой Haier. Компоненты бытовой техники.", investmentRange: "$5M - $60M", timeline: "1-2 years", status: "active" },
         { id: "kzn-3", title: "Kazan Sports Tourism", titleZh: "喀山体育旅游", titleRu: "Спортивный туризм Казани", sector: "Tourism", description: "Sports facilities and tourism from World Cup and Universiade legacy. Chinese sports partnerships.", descriptionZh: "世界杯和大运会遗产的体育设施和旅游。中国体育合作。", descriptionRu: "Спортивные объекты и туризм как наследие Чемпионата мира и Универсиады. Китайские спортивные партнёрства.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
         { id: "kzn-4", title: "Halal Industry Development", titleZh: "清真产业发展", titleRu: "Развитие халяльной индустрии", sector: "Food", description: "Halal food production and certification. Gateway to Muslim markets globally.", descriptionZh: "清真食品生产和认证。通往全球穆斯林市场的门户。", descriptionRu: "Производство и сертификация халяльной продукции. Ворота на мировые мусульманские рынки.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "naberezhnye-chelny", name: "Naberezhnye Chelny", nameRu: "Набережные Челны", nameZh: "纳贝雷日尼耶切尔尼", population: "0.5M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Home of KAMAZ - Russia's largest truck manufacturer. Industrial city with strong automotive supply chain and Alabuga SEZ nearby.", opportunities: [
{ id: "nch-1", title: "KAMAZ EV Partnership", titleZh: "卡玛斯电动汽车合作", titleRu: "Партнёрство с КАМАЗ по электромобилям", sector: "Automotive", description: "Electric truck development with Russia's largest truck maker. Battery and powertrain components.", descriptionZh: "与俄罗斯最大卡车制造商合作开发电动卡车。电池和动力总成部件。", descriptionRu: "Разработка электрогрузовиков с крупнейшим российским производителем грузовиков. Компоненты батарей и силовых агрегатов.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
         { id: "nch-2", title: "Alabuga SEZ Manufacturing", titleZh: "阿拉布加经济特区制造", titleRu: "Производство в ОЭЗ Алабуга", sector: "Manufacturing", description: "Russia's best SEZ: 0% profit tax 10 years, 0% property tax. Turnkey factory facilities.", descriptionZh: "俄罗斯最好的经济特区：10年零利润税，零房产税。交钥匙工厂设施。", descriptionRu: "Лучшая ОЭЗ России: 0% налога на прибыль 10 лет, 0% налога на имущество. Заводы под ключ.", investmentRange: "$10M - $150M", timeline: "1-2 years", status: "priority" },
         { id: "nch-3", title: "Automotive Components Cluster", titleZh: "汽车零部件集群", titleRu: "Кластер автокомпонентов", sector: "Automotive", description: "Tier 1/2 supplier facilities for KAMAZ and nearby automakers.", descriptionZh: "为卡玛斯和附近汽车制造商提供一级/二级供应商设施。", descriptionRu: "Объекты поставщиков Tier 1/2 для КАМАЗа и ближайших автопроизводителей.", investmentRange: "$5M - $80M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "nizhnekamsk", name: "Nizhnekamsk", nameRu: "Нижнекамск", nameZh: "尼日涅卡姆斯克", population: "0.2M", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80", description: "Petrochemical capital of Tatarstan. Home to TATNEFT and SIBUR facilities. Major polymer and rubber production center.", opportunities: [
{ id: "nzk-1", title: "SIBUR Polymer Partnership", titleZh: "西布尔聚合物合作", titleRu: "Полимерное партнёрство с СИБУРом", sector: "Petrochemicals", description: "Ethylene and polyethylene production. World-scale petrochemical complex.", descriptionZh: "乙烯和聚乙烯生产。世界级石化综合体。", descriptionRu: "Производство этилена и полиэтилена. Нефтехимический комплекс мирового масштаба.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
         { id: "nzk-2", title: "Specialty Chemicals Production", titleZh: "特种化学品生产", titleRu: "Производство специальных химикатов", sector: "Chemicals", description: "High-value chemical products leveraging local feedstock and infrastructure.", descriptionZh: "利用当地原料和基础设施生产高价值化学产品。", descriptionRu: "Высокомаржинальные химические продукты с использованием местного сырья и инфраструктуры.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" },
         { id: "nzk-3", title: "Tire & Rubber Manufacturing", titleZh: "轮胎和橡胶制造", titleRu: "Производство шин и резины", sector: "Manufacturing", description: "Tire production and rubber products for domestic and export markets.", descriptionZh: "面向国内和出口市场的轮胎和橡胶制品生产。", descriptionRu: "Производство шин и резиновых изделий для внутреннего рынка и экспорта.", investmentRange: "$15M - $100M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Russia's most successful regional economy and investment destination. Alabuga SEZ is Russia's best-performing special economic zone. Innopolis is Russia's IT city. KAMAZ truck manufacturing and TATNEFT oil production. Strong Chinese investment track record.",
    overviewRu: "Самая успешная региональная экономика России и лучшее направление для инвестиций. ОЭЗ «Алабуга» — лучшая особая экономическая зона России. Иннополис — IT-город России. Производство грузовиков КАМАЗ и добыча нефти ТАТНЕФТЬ. Успешный опыт китайских инвестиций.",
    overviewZh: "俄罗斯最成功的区域经济体和投资目的地。阿拉布加经济特区是俄罗斯表现最好的经济特区。伊诺波利斯是俄罗斯的IT城市。卡玛斯卡车制造和鞑靼石油生产。拥有良好的中国投资记录。",
    targetSectors: ["Petrochemicals", "Automotive Components", "IT", "Halal Industry", "Advanced Manufacturing"],
    opportunities: [
{ id: "tt-1", title: "Alabuga Special Economic Zone", titleZh: "阿拉布加经济特区", titleRu: "Особая экономическая зона Алабуга", sector: "Manufacturing", description: "Russia's top SEZ with 0% profit tax for 10 years, 0% property tax, subsidized utilities. 100+ residents including Chinese companies.", descriptionZh: "俄罗斯顶级经济特区，10年零利润税，零房产税，公用事业补贴。100多家入驻企业包括中国公司。", descriptionRu: "Лучшая ОЭЗ России: 0% налога на прибыль 10 лет, 0% налога на имущество, субсидированные коммунальные услуги. 100+ резидентов, включая китайские компании.", investmentRange: "$10M - $300M", timeline: "1-3 years", status: "priority" },
       { id: "tt-2", title: "Innopolis IT City", titleZh: "伊诺波利斯IT城", titleRu: "IT-город Иннополис", sector: "IT", description: "Russia's purpose-built tech city. AI, blockchain, and software development. Tax-free zone for IT companies.", descriptionZh: "俄罗斯专为科技而建的城市。人工智能、区块链和软件开发。IT公司免税区。", descriptionRu: "Специально построенный технологический город России. ИИ, блокчейн и разработка ПО. Безналоговая зона для IT-компаний.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "priority" },
       { id: "tt-3", title: "KAMAZ Electric Truck Partnership", titleZh: "卡玛斯电动卡车合作", titleRu: "Партнёрство по электрогрузовикам КАМАЗ", sector: "Automotive", description: "Electric truck development and component manufacturing with Russia's largest truck maker.", descriptionZh: "与俄罗斯最大卡车制造商合作开发电动卡车和零部件制造。", descriptionRu: "Разработка электрогрузовиков и производство компонентов с крупнейшим российским производителем грузовиков.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
       { id: "tt-4", title: "Nizhnekamsk Petrochemical Expansion", titleZh: "尼日涅卡姆斯克石化扩展", titleRu: "Расширение нефтехимии Нижнекамска", sector: "Petrochemicals", description: "SIBUR and TATNEFT petrochemical projects. Polymer and specialty chemical production.", descriptionZh: "西布尔和鞑靼石油的石化项目。聚合物和特种化学品生产。", descriptionRu: "Нефтехимические проекты СИБУРа и ТАТНЕФТи. Производство полимеров и специальных химикатов.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "tt-p1", name: "Haier Industrial Park Kazan", nameRu: "Промышленный парк Haier Казань", nameZh: "海尔工业园区喀山", value: "$200 Million", sector: "Electronics", description: "Chinese home appliance manufacturing base for Russia market.", descriptionRu: "Китайская база производства бытовой техники для российского рынка.", descriptionZh: "中国家电制造基地，服务俄罗斯市场。", partners: ["Haier"], completionYear: "2026" },
      { id: "tt-p2", name: "SIBUR Nizhnekamsk Polymer", nameRu: "Полимеры SIBUR Нижнекамск", nameZh: "西布尔尼日涅卡姆斯克聚合物", value: "$3 Billion", sector: "Petrochemicals", description: "Ethylene and polyethylene production expansion.", descriptionRu: "Расширение производства этилена и полиэтилена.", descriptionZh: "乙烯和聚乙烯生产扩建。", partners: ["SIBUR"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "policy", title: "Best Regional Government", titleRu: "Лучшее региональное правительство", titleZh: "最佳地区政府", description: "Most efficient bureaucracy in Russia. English-speaking investment services.", descriptionRu: "Самая эффективная бюрократия в России. Инвестиционные услуги на английском языке.", descriptionZh: "俄罗斯最高效的官僚机构。英语投资服务。" },
      { icon: "infrastructure", title: "Top SEZ", titleRu: "Лучшая ОЭЗ", titleZh: "顶级经济特区", description: "Alabuga consistently rated Russia\'s best special economic zone.", descriptionRu: "Алабуга постоянно признаётся лучшей особой экономической зоной России.", descriptionZh: "阿拉布加被评为俄罗斯最好的经济特区。" },
      { icon: "tech", title: "IT City", titleRu: "IT-город", titleZh: "IT城市", description: "Innopolis - Russia\'s only purpose-built tech city.", descriptionRu: "Иннополис — единственный специально построенный технологический город России.", descriptionZh: "伊诺波利斯——俄罗斯唯一专为科技而建的城市。" },
      { icon: "market", title: "China Track Record", titleRu: "Опыт работы с Китаем", titleZh: "中国合作记录", description: "Haier, Midea, and other Chinese companies already operating successfully.", descriptionRu: "Haier, Midea и другие китайские компании уже успешно работают.", descriptionZh: "海尔、美的和其他中国公司已成功运营。" }
    ],
    notableEntrepreneurs: [
      { name: "Rustam Minnikhanov", nameRu: "Рустам Минниханов", nameZh: "鲁斯塔姆·明尼哈诺夫", company: "Tatarstan Government", industry: "Government & Business", netWorth: "N/A", description: "President of Tatarstan since 2010. Architect of Tatarstan's investment-friendly policies and SEZ success.", descriptionRu: "Президент Татарстана с 2010 года. Архитектор инвестиционно-дружественной политики Татарстана и успеха ОЭЗ.", descriptionZh: "自2010年以来的鞑靼斯坦总统。鞑靼斯坦投资友好政策和经济特区成功的设计师。" },
      { name: "Airat Shaimiev", nameRu: "Айрат Шаймиев", nameZh: "艾拉特·沙伊米耶夫", company: "TAIF Group", industry: "Petrochemicals", netWorth: "$2.5B", description: "Part of founding family of TAIF, Tatarstan's largest private company. Major petrochemical and energy conglomerate.", descriptionRu: "Член семьи основателей ТАИФ, крупнейшей частной компании Татарстана. Крупный нефтехимический и энергетический конгломерат.", descriptionZh: "鞑靼斯坦最大私营公司TAIF创始家族成员。主要石化和能源集团。" },
      { name: "Sergey Kogogin", nameRu: "Сергей Когогин", nameZh: "谢尔盖·科戈金", company: "KAMAZ", industry: "Automotive", netWorth: "N/A", description: "CEO of KAMAZ, Russia's largest truck manufacturer. Leading electric truck and autonomous vehicle development.", descriptionRu: "Генеральный директор КАМАЗа, крупнейшего производителя грузовиков в России. Руководит разработкой электрогрузовиков и автономных транспортных средств.", descriptionZh: "卡玛斯首席执行官，俄罗斯最大的卡车制造商。领导电动卡车和自动驾驶汽车的开发。" },
      { name: "Albert Shigabutdinov", nameRu: "Альберт Шигабутдинов", nameZh: "阿尔伯特·希加布特季诺夫", company: "TAIF Group", industry: "Energy", netWorth: "$1.1B", description: "General Director of TAIF. Transformed local refinery into integrated petrochemical powerhouse.", descriptionRu: "Генеральный директор ТАИФ. Преобразовал местный нефтеперерабатывающий завод в интегрированный нефтехимический гигант.", descriptionZh: "TAIF总经理。将当地炼油厂转变为综合石化巨头。" }
    ],
    contactInfo: { investmentAgency: "Tatarstan Investment Development Agency", investmentAgencyRu: "Агентство развития инвестиций Татарстана", investmentAgencyZh: "鞑靼斯坦投资发展局", website: "https://tida.tatarstan.ru", email: "info@tida.tatarstan.ru", phone: "+7-843-524-9091" }
  },
  "Sverdlovsk Oblast": {
    name: "Sverdlovsk Oblast",
    nameRu: "Свердловская область",
    nameZh: "斯维尔德洛夫斯克州",
    gdp: "$51 Billion",
    population: "4.3 Million",
    industries: ["Metallurgy", "Heavy Machinery", "Mining", "Defense"],
    industriesRu: ["Металлургия", "Тяжёлое машиностроение", "Горнодобыча", "Оборона"],
    industriesZh: ["冶金", "重型机械", "采矿", "国防"],
    sezCount: 2,
    taxBenefits: ["Industrial cluster benefits", "Mining incentives", "Titanium Valley SEZ"],
    taxBenefitsRu: ["Льготы промышленных кластеров", "Льготы горнодобычи", "ОЭЗ Титановая долина"],
    taxBenefitsZh: ["工业集群优惠", "采矿激励政策", "钛谷经济特区"],
    majorCities: [
       { id: "yekaterinburg", name: "Yekaterinburg", nameRu: "Екатеринбург", nameZh: "叶卡捷琳堡", population: "1.5M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Russia's 4th largest city and industrial capital of the Urals. Historic gateway between Europe and Asia on Trans-Siberian Railway. Hosts annual INNOPROM industrial fair - Russia's main platform for China partnerships.", opportunities: [
        { id: "ykt-1", title: "INNOPROM Industrial Partnership", titleZh: "中国国际工业博览会产业合作", titleRu: "Промышленное партнёрство ИННОПРОМ", sector: "Manufacturing", description: "Annual industrial fair connecting Chinese and Russian manufacturers. Technology transfer and JV platform.", descriptionZh: "连接中俄制造商的年度工业博览会。技术转让和合资企业平台。", descriptionRu: "Ежегодная промышленная выставка, соединяющая китайских и российских производителей. Платформа для трансфера технологий и создания СП.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "ykt-2", title: "Urals Heavy Industry Modernization", titleZh: "乌拉尔重工业现代化", titleRu: "Модернизация тяжёлой промышленности Урала", sector: "Machinery", description: "Industry 4.0 upgrades for metallurgy and machinery. Smart manufacturing solutions.", descriptionZh: "冶金和机械行业的工业4.0升级。智能制造解决方案。", descriptionRu: "Модернизация металлургии и машиностроения по стандартам Индустрии 4.0. Решения для умного производства.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
        { id: "ykt-3", title: "Yekaterinburg Tech Hub", titleZh: "叶卡捷琳堡科技中心", titleRu: "Технологический хаб Екатеринбурга", sector: "IT", description: "Software development and IT services. Growing startup ecosystem.", descriptionZh: "软件开发和IT服务。蓬勃发展的初创企业生态系统。", descriptionRu: "Разработка ПО и ИТ-услуги. Растущая стартап-экосистема.", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "active" }
      ]},
       { id: "nizhny-tagil", name: "Nizhny Tagil", nameRu: "Нижний Тагил", nameZh: "下塔吉尔", population: "0.3M", image: "https://images.unsplash.com/photo-1590244840770-b9a0a36a3a83?w=1920&q=80", description: "Major metallurgical center home to EVRAZ steel operations. Historic arms manufacturing city now diversifying into civilian products and green steel.", opportunities: [
        { id: "ntg-1", title: "EVRAZ Green Steel Partnership", titleZh: "EVRAZ绿色钢铁合作", titleRu: "Партнёрство ЕВРАЗ по зелёной стали", sector: "Steel", description: "Low-carbon steel production and rail manufacturing. Technology and supply partnerships.", descriptionZh: "低碳钢生产和铁路制造。技术和供应合作。", descriptionRu: "Производство низкоуглеродной стали и железнодорожной продукции. Технологическое и снабженческое партнёрство.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "ntg-2", title: "Defense Conversion Manufacturing", titleZh: "国防工业民用化生产", titleRu: "Конверсия оборонного производства", sector: "Manufacturing", description: "Civilian applications for defense industry capabilities. Precision machinery.", descriptionZh: "国防工业能力的民用化应用。精密机械制造。", descriptionRu: "Гражданское применение возможностей оборонной промышленности. Точное машиностроение.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
       { id: "kamensk-uralsky", name: "Kamensk-Uralsky", nameRu: "Каменск-Уральский", nameZh: "卡缅斯克-乌拉尔斯基", population: "0.2M", image: "https://images.unsplash.com/photo-1597473322203-2c4f0e36e1c3?w=1920&q=80", description: "Aluminum and titanium processing center. Key supplier for aerospace and defense industries with VSMPO-AVISMA operations nearby.", opportunities: [
        { id: "kmu-1", title: "Titanium Valley Partnership", titleZh: "钛谷合作项目", titleRu: "Партнёрство Титановой долины", sector: "Aerospace", description: "Titanium processing and aerospace components. VSMPO-AVISMA ecosystem.", descriptionZh: "钛材加工和航空航天部件。VSMPO-AVISMA生态系统。", descriptionRu: "Переработка титана и производство аэрокосмических компонентов. Экосистема ВСМПО-АВИСМА.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "priority" }
      ]}
    ],
     overview: "Industrial heartland of the Urals and Russia's fourth-largest city (Yekaterinburg). Major metallurgy center (EVRAZ, UMMC), heavy machinery, and defense industry. Hosts annual INNOPROM industrial exhibition. Titanium Valley SEZ for aerospace.",
    overviewRu: "Промышленное сердце Урала и четвёртый по величине город России (Екатеринбург). Крупный центр металлургии (ЕВРАЗ, УММК), тяжёлого машиностроения и оборонной промышленности. Ежегодно проводит промышленную выставку ИННОПРОМ. ОЭЗ Титановая долина для аэрокосмической отрасли.",
    overviewZh: "乌拉尔工业中心和俄罗斯第四大城市（叶卡捷琳堡）。主要冶金中心（EVRAZ、UMMC）、重型机械和国防工业。举办年度INNOPROM工业展览会。钛谷经济特区用于航空航天产业。",
    targetSectors: ["Metallurgy", "Heavy Machinery", "Titanium & Aerospace", "Mining Equipment", "Industrial IoT"],
    opportunities: [
      { id: "sv-1", title: "Titanium Valley SEZ", titleZh: "钛谷经济特区", titleRu: "ОЭЗ Титановая долина", sector: "Aerospace", description: "Titanium processing and aerospace component manufacturing. VSMPO-AVISMA partnership opportunities.", descriptionZh: "钛材加工和航空航天部件制造。VSMPO-AVISMA合作机会。", descriptionRu: "Переработка титана и производство аэрокосмических компонентов. Возможности партнёрства с ВСМПО-АВИСМА.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "sv-2", title: "INNOPROM Industrial Partnership", titleZh: "中国国际工业博览会产业合作", titleRu: "Промышленное партнёрство ИННОПРОМ", sector: "Manufacturing", description: "Annual industrial exhibition - platform for China-Russia manufacturing partnerships.", descriptionZh: "年度工业展览会——中俄制造业合作平台。", descriptionRu: "Ежегодная промышленная выставка — платформа для китайско-российского производственного партнёрства.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" },
      { id: "sv-3", title: "Urals Mining Equipment", titleZh: "乌拉尔矿业设备", titleRu: "Горное оборудование Урала", sector: "Mining", description: "Mining machinery and equipment manufacturing for Russia's resource sector.", descriptionZh: "为俄罗斯资源行业制造矿山机械和设备。", descriptionRu: "Производство горнодобывающей техники и оборудования для ресурсного сектора России.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "active" }
    ],
     keyProjects: [
       { id: "sv-p1", name: "EVRAZ Nizhny Tagil Modernization", nameRu: "Модернизация ЕВРАЗ Нижний Тагил", nameZh: "EVRAZ下塔吉尔现代化", value: "$2 Billion", sector: "Steel", description: "Green steel production and rail manufacturing.", descriptionRu: "Производство зелёной стали и железнодорожной продукции.", descriptionZh: "绿色钢铁生产和铁路制造。", partners: ["EVRAZ"], completionYear: "2028" }
     ],
    advantages: [
      { icon: "resources", title: "Mineral Wealth", titleRu: "Минеральное богатство", titleZh: "矿产财富", description: "Major deposits of iron, copper, titanium, and precious metals.", descriptionRu: "Крупные месторождения железа, меди, титана и драгоценных металлов.", descriptionZh: "铁、铜、钛和贵金属的主要矿床。" },
      { icon: "infrastructure", title: "Industrial Base", titleRu: "Промышленная база", titleZh: "工业基地", description: "Complete heavy industry supply chain and skilled workforce.", descriptionRu: "Полная цепочка поставок тяжёлой промышленности и квалифицированная рабочая сила.", descriptionZh: "完整的重工业供应链和熟练的劳动力。" },
      { icon: "location", title: "Eurasia Gateway", titleRu: "Ворота Евразии", titleZh: "欧亚门户", description: "Yekaterinburg on Trans-Siberian Railway. Historic gateway between Europe and Asia.", descriptionRu: "Екатеринбург на Транссибирской магистрали. Исторические ворота между Европой и Азией.", descriptionZh: "叶卡捷琳堡位于西伯利亚大铁路上。欧洲和亚洲之间的历史门户。" }
    ],
    contactInfo: { investmentAgency: "Sverdlovsk Region Investment Agency", investmentAgencyRu: "Инвестиционное агентство Свердловской области", investmentAgencyZh: "斯维尔德洛夫斯克州投资局", website: "https://invest-in-ural.ru", email: "info@invest-in-ural.ru" }
  },
  "Krasnoyarsk Krai": {
    name: "Krasnoyarsk Krai",
    nameRu: "Красноярский край",
    nameZh: "克拉斯诺亚尔斯克边疆区",
    gdp: "$48 Billion",
    population: "2.9 Million",
    industries: ["Mining", "Metallurgy", "Hydropower", "Forestry"],
    industriesRu: ["Добыча полезных ископаемых", "Металлургия", "Гидроэнергетика", "Лесопромышленность"],
    industriesZh: ["采矿业", "冶金业", "水力发电", "林业"],
    sezCount: 1,
    taxBenefits: ["Resource extraction benefits", "Arctic development incentives", "Hydropower support"],
    taxBenefitsRu: ["Льготы на добычу ресурсов", "Льготы развития Арктики", "Поддержка гидроэнергетики"],
    taxBenefitsZh: ["资源开采优惠", "北极开发激励政策", "水力发电支持"],
    majorCities: [
      { id: "krasnoyarsk", name: "Krasnoyarsk", nameRu: "Красноярск", nameZh: "克拉斯诺亚尔斯克", population: "1.1M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Siberia's largest city on the Yenisei River. Major aluminum production (RUSAL) and hydropower hub. Gateway to vast mineral resources of northern Siberia.", opportunities: [
        { id: "kry-1", title: "RUSAL Aluminum Partnership", titleZh: "俄铝合作项目", titleRu: "Партнёрство с РУСАЛом", sector: "Aluminum", description: "World's lowest-cost aluminum production using hydropower. Processing and export.", descriptionZh: "利用水力发电的全球最低成本铝生产。加工和出口。", descriptionRu: "Производство алюминия с самой низкой себестоимостью в мире благодаря гидроэнергетике. Переработка и экспорт.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
        { id: "kry-2", title: "Siberian Hydropower Projects", titleZh: "西伯利亚水电项目", titleRu: "Сибирские гидроэнергетические проекты", sector: "Energy", description: "New hydropower development and integration with mining operations.", descriptionZh: "新水电开发及与采矿作业的整合。", descriptionRu: "Развитие новых гидроэлектростанций и интеграция с горнодобывающими операциями.", investmentRange: "$50M - $500M", timeline: "5-10 years", status: "upcoming" },
        { id: "kry-3", title: "Forestry & Wood Processing", titleZh: "林业与木材加工", titleRu: "Лесопереработка", sector: "Forestry", description: "Sustainable forestry and wood products export to China.", descriptionZh: "可持续林业和木材产品出口至中国。", descriptionRu: "Устойчивое лесопользование и экспорт древесной продукции в Китай.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "norilsk", name: "Norilsk", nameRu: "Норильск", nameZh: "诺里尔斯克", population: "0.2M", image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80", description: "Arctic mining city and home to Nornickel - world's largest nickel and palladium producer. Critical minerals for EV batteries and electronics. Extreme environment with unique investment opportunities.", opportunities: [
        { id: "nrl-1", title: "Nornickel Strategic Partnership", titleZh: "诺里尔斯克镍业战略合作", titleRu: "Стратегическое партнёрство с Норникелем", sector: "Mining", description: "Nickel, palladium, and copper supply agreements. Critical minerals for Chinese EV industry.", descriptionZh: "镍、钯和铜供应协议。中国电动汽车行业的关键矿产。", descriptionRu: "Соглашения о поставках никеля, палладия и меди. Критически важные минералы для китайской EV-индустрии.", investmentRange: "$100M - $1B", timeline: "5-10 years", status: "priority" },
        { id: "nrl-2", title: "Mining Technology", titleZh: "采矿技术", titleRu: "Горнодобывающие технологии", sector: "Technology", description: "Autonomous mining equipment and Arctic technology. Harsh environment solutions.", descriptionZh: "自主采矿设备和北极技术。恶劣环境解决方案。", descriptionRu: "Автономное горное оборудование и арктические технологии. Решения для экстремальных условий.", investmentRange: "$20M - $150M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "achinsk", name: "Achinsk", nameRu: "Ачинск", nameZh: "阿钦斯克", population: "0.1M", image: "https://images.unsplash.com/photo-1598286867762-8bde84aae1e3?w=1920&q=80", description: "Industrial city on the Trans-Siberian Railway. Aluminum and cement production. Growing logistics importance for eastbound freight.", opportunities: [
        { id: "ach-1", title: "Trans-Siberian Logistics Hub", titleZh: "西伯利亚大铁路物流枢纽", titleRu: "Транссибирский логистический хаб", sector: "Logistics", description: "Warehousing and transshipment on main rail corridor to Asia.", descriptionZh: "主要铁路走廊上通往亚洲的仓储和转运。", descriptionRu: "Складирование и перевалка на главном железнодорожном коридоре в Азию.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Vast Siberian region with enormous mineral wealth. Norilsk Nickel is world's largest nickel and palladium producer. Major aluminum (RUSAL) and hydropower production. Growing Arctic development importance.",
    overviewRu: "Огромный сибирский регион с колоссальным минеральным богатством. Норникель - крупнейший в мире производитель никеля и палладия. Крупное производство алюминия (РУСАЛ) и гидроэнергетики. Растущее значение развития Арктики.",
    overviewZh: "拥有巨大矿产财富的广阔西伯利亚地区。诺里尔斯克镍业是世界最大的镍和钯生产商。主要铝生产（俄铝）和水力发电。北极开发重要性不断增长。",
    targetSectors: ["Mining", "Aluminum", "Hydropower", "Arctic Development", "Forestry"],
    opportunities: [
      { id: "kr-1", title: "Nornickel Expansion Partnership", titleZh: "诺里尔斯克镍业扩展合作", titleRu: "Партнёрство по расширению Норникеля", sector: "Mining", description: "Nickel, palladium, and copper mining technology and equipment. Green mining initiatives.", descriptionZh: "镍、钯和铜采矿技术及设备。绿色采矿倡议。", descriptionRu: "Технологии и оборудование для добычи никеля, палладия и меди. Инициативы зелёной добычи.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "kr-2", title: "RUSAL Aluminum Partnership", titleZh: "俄铝合作项目", titleRu: "Партнёрство с РУСАЛом", sector: "Aluminum", description: "Aluminum smelting and processing. World's lowest-cost aluminum production using hydropower.", descriptionZh: "铝冶炼和加工。利用水力发电的全球最低成本铝生产。", descriptionRu: "Выплавка и переработка алюминия. Производство с самой низкой себестоимостью в мире благодаря гидроэнергетике.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
      { id: "kr-3", title: "Siberian Forestry Modernization", titleZh: "西伯利亚林业现代化", titleRu: "Модернизация сибирского лесопромышленного комплекса", sector: "Forestry", description: "Sustainable forestry and wood processing. Export to China.", descriptionZh: "可持续林业和木材加工。出口至中国。", descriptionRu: "Устойчивое лесопользование и деревообработка. Экспорт в Китай.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "kr-p1", name: "Nornickel Sulphur Program", nameRu: "Программа сероулавливания Норникеля", nameZh: "诺里尔斯克镍业硫回收计划", value: "$3.5 Billion", sector: "Mining", description: "Environmental modernization capturing 95% of sulphur emissions.", descriptionRu: "Экологическая модернизация с улавливанием 95% выбросов серы.", descriptionZh: "环保现代化，捕获95%的硫排放。", partners: ["Nornickel"], completionYear: "2025" }
    ],
    advantages: [
      { icon: "resources", title: "Mineral Superpower", titleRu: "Минеральная сверхдержава", titleZh: "矿产超级大国", description: "Largest nickel, palladium reserves. Major copper, gold, platinum.", descriptionRu: "Крупнейшие запасы никеля и палладия. Значительные запасы меди, золота, платины.", descriptionZh: "最大的镍和钯储量。主要铜、金、铂储量。" },
      { icon: "infrastructure", title: "Cheap Hydropower", titleRu: "Дешёвая гидроэнергетика", titleZh: "廉价水力发电", description: "Massive hydroelectric dams provide lowest-cost electricity.", descriptionRu: "Огромные гидроэлектростанции обеспечивают самое дешёвое электричество.", descriptionZh: "大型水电大坝提供最低成本的电力。" }
    ],
    contactInfo: { investmentAgency: "Krasnoyarsk Krai Investment Agency", investmentAgencyRu: "Агентство инвестиций Красноярского края", investmentAgencyZh: "克拉斯诺亚尔斯克边疆区投资局", website: "https://krskinvest.ru", email: "info@krskinvest.ru" }
  },
   "Krasnodar Krai": {
     name: "Krasnodar Krai",
     nameRu: "Краснодарский край",
     nameZh: "克拉斯诺达尔边疆区",
     gdp: "$63 Billion",
     population: "5.7 Million",
     industries: ["Agriculture", "Tourism", "Food Processing", "Oil & Gas"],
     industriesRu: ["Сельское хозяйство", "Туризм", "Пищевая переработка", "Нефть и газ"],
     industriesZh: ["农业", "旅游业", "食品加工", "石油和天然气"],
     sezCount: 2,
     taxBenefits: ["Agricultural support", "Resort zone benefits", "Investment incentives"],
     taxBenefitsRu: ["Поддержка сельского хозяйства", "Льготы курортной зоны", "Инвестиционные стимулы"],
     taxBenefitsZh: ["农业支持", "度假区优惠", "投资激励政策"],
    majorCities: [
      { id: "krasnodar", name: "Krasnodar", nameRu: "Краснодар", nameZh: "克拉斯诺达尔", population: "1.1M", image: "https://images.unsplash.com/photo-1568954775058-be47c87a0a20?w=1920&q=80", description: "Capital of Russia's agricultural heartland. Fast-growing modern city with excellent climate. Major food processing and agribusiness center serving southern Russia.", opportunities: [
        { id: "krd-1", title: "Krasnodar Agribusiness Hub", titleZh: "克拉斯诺达尔农业综合中心", titleRu: "Агропромышленный хаб Краснодара", sector: "Agriculture", description: "Grain, sunflower, and food processing. Partnership with Russia's largest agricultural producers.", descriptionZh: "粮食、葵花籽和食品加工。与俄罗斯最大农业生产商的合作。", descriptionRu: "Зерно, подсолнечник и пищевая переработка. Партнёрство с крупнейшими аграрными производителями России.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "krd-2", title: "Food Processing Cluster", titleZh: "食品加工产业集群", titleRu: "Кластер пищевой переработки", sector: "Food", description: "Modern processing facilities for export to China. Cold chain and packaging.", descriptionZh: "出口中国的现代化加工设施。冷链和包装。", descriptionRu: "Современные перерабатывающие мощности для экспорта в Китай. Холодильная цепь и упаковка.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
        { id: "krd-3", title: "Wine Industry Development", titleZh: "葡萄酒产业发展", titleRu: "Развитие винодельческой отрасли", sector: "Wine", description: "Partnership with local wineries. China market export and tourism development.", descriptionZh: "与当地酒庄的合作。中国市场出口和旅游发展。", descriptionRu: "Партнёрство с местными винодельнями. Экспорт на китайский рынок и развитие туризма.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "sochi", name: "Sochi", nameRu: "Сочи", nameZh: "索契", population: "0.4M", image: "https://images.unsplash.com/photo-1578070181910-f1e514afdd08?w=1920&q=80", description: "Russia's premier Black Sea resort and 2014 Winter Olympics host. Year-round destination with beaches and ski slopes. World-class sports and entertainment facilities.", opportunities: [
        { id: "soc-1", title: "Sochi Resort Development", titleZh: "索契度假村开发", titleRu: "Развитие курортов Сочи", sector: "Tourism", description: "Luxury hotels and resort facilities. Growing Chinese tourist segment.", descriptionZh: "豪华酒店和度假设施。不断增长的中国游客群体。", descriptionRu: "Люксовые отели и курортная инфраструктура. Растущий сегмент китайских туристов.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
        { id: "soc-2", title: "Olympic Legacy Sports Hub", titleZh: "奥运遗产体育中心", titleRu: "Олимпийский спортивный наследственный хаб", sector: "Sports", description: "Sports training and event facilities. Formula 1 circuit and ski resorts.", descriptionZh: "体育训练和赛事设施。F1赛道和滑雪度假村。", descriptionRu: "Спортивные тренировочные и событийные объекты. Трасса Формулы-1 и горнолыжные курорты.", investmentRange: "$15M - $150M", timeline: "2-4 years", status: "active" },
        { id: "soc-3", title: "Medical Tourism", titleZh: "医疗旅游", titleRu: "Медицинский туризм", sector: "Healthcare", description: "Wellness resorts and medical tourism. Traditional Russian spa treatments.", descriptionZh: "健康度假村和医疗旅游。传统俄罗斯水疗。", descriptionRu: "Велнес-курорты и медицинский туризм. Традиционные российские спа-процедуры.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "upcoming" }
      ]},
      { id: "novorossiysk", name: "Novorossiysk", nameRu: "Новороссийск", nameZh: "新罗西斯克", population: "0.3M", image: "https://images.unsplash.com/photo-1562073853-7d6039f3cb8a?w=1920&q=80", description: "Russia's largest Black Sea port handling 25% of seaborne trade. Major grain export terminal and oil terminal. Key logistics hub for southern Russia.", opportunities: [
        { id: "nvr-1", title: "Novorossiysk Container Terminal", titleZh: "新罗西斯克集装箱码头", titleRu: "Контейнерный терминал Новороссийска", sector: "Logistics", description: "Container handling expansion for China trade via Suez Canal route.", descriptionZh: "通过苏伊士运河航线扩大中国贸易的集装箱处理能力。", descriptionRu: "Расширение контейнерных мощностей для торговли с Китаем через Суэцкий канал.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
        { id: "nvr-2", title: "Grain Export Terminal", titleZh: "粮食出口码头", titleRu: "Зерновой экспортный терминал", sector: "Agriculture", description: "Grain export facilities for Russian wheat to global markets.", descriptionZh: "俄罗斯小麦出口至全球市场的粮食出口设施。", descriptionRu: "Зерновые экспортные мощности для российской пшеницы на мировые рынки.", investmentRange: "$30M - $200M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Russia's agricultural heartland and Black Sea resort region. Sochi hosted 2014 Winter Olympics. Novorossiysk is Russia's largest port. Warm climate attracts millions of tourists and agricultural investment.",
     overviewRu: "Сельскохозяйственный центр России и курортный регион на Чёрном море. Сочи принимал Зимние Олимпийские игры 2014 года. Новороссийск - крупнейший порт России. Тёплый климат привлекает миллионы туристов и сельскохозяйственные инвестиции.",
     overviewZh: "俄罗斯农业中心和黑海度假区。索契举办了2014年冬季奥运会。新罗西斯克是俄罗斯最大的港口。温暖的气候吸引了数百万游客和农业投资。",
    targetSectors: ["Agriculture", "Tourism", "Food Processing", "Wine", "Port & Logistics"],
    opportunities: [
      { id: "kd-1", title: "Krasnodar Agricultural Investment", titleZh: "克拉斯诺达尔农业投资", titleRu: "Сельскохозяйственные инвестиции в Краснодар", sector: "Agriculture", description: "Grain, sunflower, and vegetable production. Largest agricultural region in Russia.", descriptionZh: "粮食、葵花籽和蔬菜生产。俄罗斯最大的农业区。", descriptionRu: "Производство зерна, подсолнечника и овощей. Крупнейший аграрный регион России.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "kd-2", title: "Sochi Resort Development", titleZh: "索契度假村开发", titleRu: "Развитие курортов Сочи", sector: "Tourism", description: "Hotels, resorts, and tourism infrastructure. Olympic legacy facilities.", descriptionZh: "酒店、度假村和旅游基础设施。奥运遗产设施。", descriptionRu: "Отели, курорты и туристическая инфраструктура. Олимпийские наследственные объекты.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
      { id: "kd-3", title: "Novorossiysk Port Expansion", titleZh: "新罗西斯克港口扩建", titleRu: "Расширение порта Новороссийск", sector: "Logistics", description: "Container terminal and grain export facilities. China trade gateway.", descriptionZh: "集装箱码头和粮食出口设施。中国贸易门户。", descriptionRu: "Контейнерный терминал и зерновые экспортные мощности. Ворота торговли с Китаем.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "kd-p1", name: "Sochi-Adler Tourism Cluster", nameRu: "Туристический кластер Сочи-Адлер", nameZh: "索契-阿德勒旅游集群", value: "$1 Billion", sector: "Tourism", description: "Year-round resort development.", completionYear: "2028" }
    ],
    advantages: [
      { icon: "resources", title: "Agricultural Leader", titleRu: "Лидер сельского хозяйства", titleZh: "农业领导者", description: "Russia's breadbasket. Best climate for farming.", descriptionRu: "Хлебница России. Лучший климат для земледелия.", descriptionZh: "俄罗斯粮仓。最适合农业的气候。" },
      { icon: "logistics", title: "Black Sea Ports", titleRu: "Порты Чёрного моря", titleZh: "黑海港口", description: "Novorossiysk handles 25% of Russian seaborne trade.", descriptionRu: "Новороссийск обрабатывает 25% морской торговли России.", descriptionZh: "新罗西斯克处理俄罗斯25%的海上贸易。" },
      { icon: "infrastructure", title: "Olympic Legacy", titleRu: "Олимпийское наследие", titleZh: "奥运遗产", description: "World-class sports and tourism facilities from 2014 Olympics.", descriptionRu: "Мировые спортивные и туристические объекты Олимпиады 2014.", descriptionZh: "2014年奥运会的世界级体育和旅游设施。" }
    ],
    contactInfo: { investmentAgency: "Krasnodar Krai Investment Agency", investmentAgencyRu: "Инвестиционное агентство Краснодарского края", investmentAgencyZh: "克拉斯诺达尔边疆区投资局", website: "https://kubaninvest.ru", email: "info@kubaninvest.ru" }
  },
  "Primorsky Krai": {
    name: "Primorsky Krai",
    nameRu: "Приморский край",
    nameZh: "滨海边疆区",
    gdp: "$20 Billion",
    population: "1.9 Million",
    industries: ["Shipping", "Fishing", "Trade", "Shipbuilding"],
    industriesRu: ["Судоходство", "Рыболовство", "Торговля", "Судостроение"],
    industriesZh: ["航运", "渔业", "贸易", "造船业"],
    sezCount: 3,
    taxBenefits: ["Free Port of Vladivostok benefits", "Far East development incentives", "Fishing industry support"],
    taxBenefitsRu: ["Льготы Свободного порта Владивосток", "Льготы развития Дальнего Востока", "Поддержка рыбной отрасли"],
    taxBenefitsZh: ["符拉迪沃斯托克自由港优惠", "远东发展激励政策", "渔业支持"],
    majorCities: [
      { id: "vladivostok", name: "Vladivostok", nameRu: "Владивосток", nameZh: "符拉迪沃斯托克", population: "0.6M", lat: 43.1155, lng: 131.8855, image: "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=1920&q=80", description: "Russia's Pacific capital and gateway to Asia. Free Port of Vladivostok offers unique investment incentives. 2 hours from Harbin, direct connections to all major Asian cities. Eastern Economic Forum host.", opportunities: [
        { id: "vlk-1", title: "Free Port of Vladivostok", titleRu: "Свободный порт Владивосток", titleZh: "符拉迪沃斯托克自由港", sector: "Trade", description: "Simplified visa, customs, and tax regime. Gateway for China-Russia-Asia trade. Duty-free processing zones.", descriptionRu: "Упрощённый визовый, таможенный и налоговый режим. Ворота для торговли Китай-Россия-Азия. Беспошлинные зоны переработки.", descriptionZh: "简化签证、海关和税收制度。中俄亚贸易门户。免税加工区。", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "vlk-2", title: "Vladivostok Port Expansion", titleZh: "符拉迪沃斯托克港口扩建", titleRu: "Расширение порта Владивосток", sector: "Logistics", description: "Container terminal and logistics hub. Direct shipping to all Chinese ports.", descriptionZh: "集装箱码头和物流枢纽。直接发运至所有中国港口。", descriptionRu: "Контейнерный терминал и логистический хаб. Прямые поставки во все китайские порты.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "vlk-3", title: "Casino & Tourism Zone", titleZh: "赌场与旅游区", titleRu: "Казино и туристическая зона", sector: "Tourism", description: "Primorye integrated entertainment resort. Gaming license and resort development.", descriptionZh: "滨海边疆区综合娱乐度假村。博彩牌照和度假村开发。", descriptionRu: "Интегрированный развлекательный курорт Приморье. Игорная лицензия и развитие курорта.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "vlk-4", title: "Seafood Processing Hub", titleZh: "海产品加工中心", titleRu: "Хаб переработки морепродуктов", sector: "Food", description: "Fish and seafood processing for China market. Cold chain and export facilities.", descriptionZh: "面向中国市场的鱼类和海产品加工。冷链和出口设施。", descriptionRu: "Переработка рыбы и морепродуктов для китайского рынка. Холодильная цепь и экспортные мощности.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "nakhodka", name: "Nakhodka", nameRu: "Находка", nameZh: "纳霍德卡", population: "0.1M", image: "https://images.unsplash.com/photo-1569335468083-1b4c4b5e6fd0?w=1920&q=80", description: "Major Pacific port with ice-free harbor. Key terminus for Russian exports to Asia. Growing oil and LNG export terminal operations.", opportunities: [
        { id: "nak-1", title: "Nakhodka Oil Terminal", titleZh: "纳霍德卡石油码头", titleRu: "Нефтяной терминал Находки", sector: "Energy", description: "Oil export terminal operations and logistics. Russian crude to China.", descriptionZh: "石油出口码头运营和物流。俄罗斯原油出口至中国。", descriptionRu: "Операции нефтяного экспортного терминала и логистика. Российская нефть в Китай.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "nak-2", title: "Container Port Development", titleZh: "集装箱港口开发", titleRu: "Развитие контейнерного порта", sector: "Logistics", description: "Container handling expansion for trans-Pacific trade.", descriptionZh: "跨太平洋贸易的集装箱处理能力扩展。", descriptionRu: "Расширение контейнерных мощностей для транстихоокеанской торговли.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "ussuriysk", name: "Ussuriysk", nameRu: "Уссурийск", nameZh: "乌苏里斯克", population: "0.2M", image: "https://images.unsplash.com/photo-1602746280895-acb6f3b8a01a?w=1920&q=80", description: "Major rail junction and agricultural center near Chinese border. Processing hub for agricultural products and manufacturing gateway for Chinese goods entering Russia.", opportunities: [
        { id: "uss-1", title: "Border Trade Processing Zone", titleZh: "边境贸易加工区", titleRu: "Зона пограничной торговой переработки", sector: "Trade", description: "Processing and packaging for China-sourced goods. Rail transfer and logistics.", descriptionZh: "中国来源商品的加工和包装。铁路转运和物流。", descriptionRu: "Переработка и упаковка китайских товаров. Железнодорожная перевалка и логистика.", investmentRange: "$5M - $60M", timeline: "1-2 years", status: "priority" },
        { id: "uss-2", title: "Agricultural Processing", titleZh: "农产品加工", titleRu: "Сельскохозяйственная переработка", sector: "Agriculture", description: "Soybean, rice, and honey processing for export. Food industry cluster.", descriptionZh: "大豆、大米和蜂蜜出口加工。食品产业集群。", descriptionRu: "Переработка сои, риса и мёда на экспорт. Кластер пищевой промышленности.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Russia's Pacific gateway and closest major Russian city to China. Vladivostok hosts Eastern Economic Forum. Free Port regime with visa-free entry, tax benefits, and simplified customs. Direct border crossing to Heilongjiang and Jilin provinces.",
    overviewRu: "Тихоокеанские ворота России и ближайший крупный российский город к Китаю. Владивосток принимает Восточный экономический форум. Режим свободного порта с безвизовым въездом, налоговыми льготами и упрощённой таможней. Прямое пограничное сообщение с провинциями Хэйлунцзян и Цзилинь.",
    overviewZh: "俄罗斯的太平洋门户，距离中国最近的俄罗斯主要城市。符拉迪沃斯托克举办东方经济论坛。自由港制度提供免签入境、税收优惠和简化海关手续。与黑龙江省和吉林省直接边境通道。",
    targetSectors: ["Shipping & Logistics", "Fishing", "China Border Trade", "Shipbuilding", "Tourism"],
    opportunities: [
      { id: "pk-1", title: "Free Port of Vladivostok", titleZh: "符拉迪沃斯托克自由港", titleRu: "Свободный порт Владивосток", sector: "Trade", description: "Tax-free zone with simplified customs, visa-free entry for 18 countries, 0% import duties for SEZ goods. Gateway for China-Russia trade.", descriptionZh: "免税区，海关简化，18国免签入境，经济特区商品零进口关税。中俄贸易门户。", descriptionRu: "Безналоговая зона с упрощённой таможней, безвизовый въезд для 18 стран, 0% пошлины для товаров ОЭЗ. Ворота китайско-российской торговли.", investmentRange: "$10M - $300M", timeline: "1-3 years", status: "priority" },
      { id: "pk-2", title: "Vladivostok-Harbin Trade Corridor", titleZh: "符拉迪沃斯托克-哈尔滨贸易走廊", titleRu: "Торговый коридор Владивосток-Харбин", sector: "Logistics", description: "Cross-border logistics connecting Russian Far East to Northeast China. Rail and road infrastructure.", descriptionZh: "连接俄罗斯远东与中国东北的跨境物流。铁路和公路基础设施。", descriptionRu: "Трансграничная логистика, соединяющая российский Дальний Восток с Северо-Восточным Китаем. Железнодорожная и автодорожная инфраструктура.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "pk-3", title: "Russian Seafood Export Hub", titleZh: "俄罗斯海产品出口中心", titleRu: "Российский хаб экспорта морепродуктов", sector: "Fishing", description: "Fishing fleet investment and seafood processing for China market. Russia supplies 10% of China's seafood.", descriptionZh: "渔船投资和面向中国市场的海产品加工。俄罗斯供应中国10%的海产品。", descriptionRu: "Инвестиции в рыболовный флот и переработка морепродуктов для китайского рынка. Россия поставляет 10% морепродуктов Китая.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "active" },
      { id: "pk-4", title: "Zvezda Shipyard Partnership", titleZh: "红星造船厂合作", titleRu: "Партнёрство с судоверфью Звезда", sector: "Shipbuilding", description: "LNG carriers, tankers, and icebreakers at Russia's largest shipyard.", descriptionZh: "在俄罗斯最大造船厂建造LNG运输船、油轮和破冰船。", descriptionRu: "СПГ-танкеры, нефтеналивные танкеры и ледоколы на крупнейшей судоверфи России.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "pk-p1", name: "Eastern Economic Forum Infrastructure", nameRu: "Инфраструктура Восточного экономического форума", nameZh: "东方经济论坛基础设施", value: "$2 Billion", sector: "Infrastructure", description: "Vladivostok development as Russia-Asia business hub.", descriptionRu: "Развитие Владивостока как делового центра Россия-Азия.", descriptionZh: "符拉迪沃斯托克作为俄亚商业中心的发展。", completionYear: "2030" },
      { id: "pk-p2", name: "Zarubino Port Development", nameRu: "Развитие порта Зарубино", nameZh: "扎鲁比诺港口开发", value: "$3 Billion", sector: "Port", description: "Major new port for Northeast China transit trade.", descriptionRu: "Крупный новый порт для транзитной торговли с Северо-Восточным Китаем.", descriptionZh: "中国东北过境贸易的主要新港口。", partners: ["Summa Group", "Chinese investors"], completionYear: "2030" }
    ],
    advantages: [
      { icon: "location", title: "China Gateway", titleRu: "Ворота в Китай", titleZh: "中国门户", description: "2 hours from Harbin by car. Closest Russian city to Asian markets.", descriptionRu: "2 часа от Харбина на машине. Ближайший российский город к азиатским рынкам.", descriptionZh: "距哈尔滨2小时车程。距亚洲市场最近的俄罗斯城市。" },
      { icon: "policy", title: "Free Port Regime", titleRu: "Режим свободного порта", titleZh: "自由港制度", description: "Visa-free, tax-free, simplified customs. Best incentives in Russia.", descriptionRu: "Безвизовый режим, освобождение от налогов, упрощённая таможня. Лучшие льготы в России.", descriptionZh: "免签、免税、简化海关。俄罗斯最佳优惠政策。" },
      { icon: "resources", title: "Seafood Capital", titleRu: "Столица морепродуктов", titleZh: "海产品之都", description: "Rich fishing grounds. Major crab, salmon, and pollock supply.", descriptionRu: "Богатые рыболовные угодья. Крупные поставки краба, лосося и минтая.", descriptionZh: "丰富的渔场。主要的螃蟹、三文鱼和鳕鱼供应地。" },
      { icon: "infrastructure", title: "EEF Host", titleRu: "Площадка ВЭФ", titleZh: "东方经济论坛举办地", description: "Annual Eastern Economic Forum brings top China-Russia business leaders.", descriptionRu: "Ежегодный Восточный экономический форум собирает ведущих бизнес-лидеров Китая и России.", descriptionZh: "每年的东方经济论坛汇聚中俄顶级商业领袖。" }
    ],
    contactInfo: { investmentAgency: "Primorsky Krai Investment Agency", investmentAgencyRu: "Агентство по привлечению инвестиций Приморского края", investmentAgencyZh: "滨海边疆区投资促进局", website: "https://invest.primorsky.ru", email: "info@invest.primorsky.ru", phone: "+7-423-220-5555" }
  },
  "Sakhalin Oblast": {
    name: "Sakhalin Oblast",
    nameRu: "Сахалинская область",
    nameZh: "萨哈林州",
    gdp: "$25 Billion",
    population: "0.5 Million",
    industries: ["Oil & Gas", "Fishing", "Mining", "LNG"],
    industriesRu: ["Нефть и газ", "Рыболовство", "Добыча полезных ископаемых", "СПГ"],
    industriesZh: ["石油和天然气", "渔业", "采矿", "液化天然气"],
    sezCount: 1,
    taxBenefits: ["PSA benefits", "Far East incentives", "LNG project support"],
    taxBenefitsRu: ["Льготы по соглашениям о разделе продукции", "Льготы Дальнего Востока", "Поддержка проектов СПГ"],
    taxBenefitsZh: ["产品分成协议优惠", "远东激励政策", "液化天然气项目支持"],
    majorCities: [
      { id: "yuzhno-sakhalinsk", name: "Yuzhno-Sakhalinsk", nameRu: "Южно-Сахалинск", nameZh: "南萨哈林斯克", population: "0.2M", image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80", description: "Capital of Russia's richest Far Eastern region. Oil and gas service center with Japanese heritage. Gateway to massive offshore energy projects.", opportunities: [
        { id: "ysk-1", title: "Oil & Gas Service Hub", titleZh: "油气服务中心", titleRu: "Хаб нефтегазовых услуг", sector: "Energy Services", description: "Service base for Sakhalin offshore projects. Equipment, logistics, and technical services.", descriptionZh: "萨哈林近海项目的服务基地。设备、物流和技术服务。", descriptionRu: "Сервисная база для шельфовых проектов Сахалина. Оборудование, логистика и технические услуги.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "ysk-2", title: "LNG Terminal Operations", titleZh: "LNG码头运营", titleRu: "Операции СПГ-терминала", sector: "LNG", description: "LNG export operations and maintenance. Ship loading and storage services.", descriptionZh: "LNG出口运营和维护。船舶装载和储存服务。", descriptionRu: "Экспортные операции СПГ и техническое обслуживание. Услуги по погрузке и хранению.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" },
        { id: "ysk-3", title: "Sakhalin Tech Services", titleZh: "萨哈林技术服务", titleRu: "Технические услуги Сахалина", sector: "IT", description: "Remote operations and digital oilfield services. Arctic technology development.", descriptionZh: "远程操作和数字油田服务。北极技术开发。", descriptionRu: "Дистанционное управление и цифровые нефтепромысловые услуги. Разработка арктических технологий.", investmentRange: "$5M - $50M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "korsakov", name: "Korsakov", nameRu: "Корсаков", nameZh: "科尔萨科夫", population: "0.03M", image: "https://images.unsplash.com/photo-1569335468083-1b4c4b5e6fd0?w=1920&q=80", description: "Major port city and LNG export terminal. Gateway for Sakhalin-2 project shipments to Asia.", opportunities: [
        { id: "kor-1", title: "Korsakov LNG Transshipment", titleZh: "科尔萨科夫LNG转运", titleRu: "Перевалка СПГ в Корсакове", sector: "LNG", description: "LNG transshipment and bunkering services. Arctic route support.", descriptionZh: "LNG转运和加注服务。北极航线支持。", descriptionRu: "Услуги перевалки и бункеровки СПГ. Поддержка арктических маршрутов.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "priority" },
        { id: "kor-2", title: "Seafood Processing Complex", titleZh: "海产品加工中心", titleRu: "Комплекс переработки морепродуктов", sector: "Fishing", description: "Premium crab and salmon processing. Direct export to Chinese markets.", descriptionZh: "优质蟹和三文鱼加工。直接出口至中国市场。", descriptionRu: "Переработка премиального краба и лосося. Прямой экспорт на китайские рынки.", investmentRange: "$15M - $100M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Island region with massive offshore oil and gas resources. Major LNG exporter to Asia. Sakhalin-1 and Sakhalin-2 are among world's largest integrated oil and gas projects. Strategic location for Asia energy supply.",
    overviewRu: "Островной регион с огромными запасами нефти и газа на шельфе. Крупный экспортер СПГ в Азию. Сахалин-1 и Сахалин-2 входят в число крупнейших интегрированных нефтегазовых проектов в мире. Стратегическое расположение для энергоснабжения Азии.",
    overviewZh: "拥有大量近海石油和天然气资源的岛屿地区。亚洲主要液化天然气出口地。萨哈林-1和萨哈林-2是世界上最大的综合油气项目之一。战略位置为亚洲能源供应。",
    targetSectors: ["Oil & Gas", "LNG", "Fishing", "Mining", "Hydrogen"],
    opportunities: [
      { id: "sk-1", title: "Sakhalin LNG Expansion", titleZh: "萨哈林LNG扩建", titleRu: "Расширение сахалинского СПГ", sector: "LNG", description: "LNG plant expansion and Asian export infrastructure. Direct shipments to China LNG terminals.", descriptionZh: "LNG工厂扩建和亚洲出口基础设施。直接发运至中国LNG码头。", descriptionRu: "Расширение СПГ-завода и экспортная инфраструктура для Азии. Прямые поставки на китайские СПГ-терминалы.", investmentRange: "$100M - $1B", timeline: "5-10 years", status: "priority" },
      { id: "sk-2", title: "Sakhalin Hydrogen Hub", titleZh: "萨哈林氢能中心", titleRu: "Сахалинский водородный хаб", sector: "Hydrogen", description: "Blue and green hydrogen production for Asian markets. Leverage existing gas infrastructure.", descriptionZh: "面向亚洲市场的蓝氢和绿氢生产。利用现有天然气基础设施。", descriptionRu: "Производство голубого и зелёного водорода для азиатских рынков. Использование существующей газовой инфраструктуры.", investmentRange: "$50M - $500M", timeline: "5-10 years", status: "upcoming" },
      { id: "sk-3", title: "Sakhalin Seafood Processing", titleZh: "萨哈林海产品加工", titleRu: "Переработка морепродуктов Сахалина", sector: "Fishing", description: "Premium crab and salmon processing for Chinese market.", descriptionZh: "面向中国市场的优质蟹和三文鱼加工。", descriptionRu: "Переработка премиального краба и лосося для китайского рынка.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "sk-p1", name: "Sakhalin Energy LNG Train 3", nameRu: "Сахалинская энергия СПГ Поезд 3", nameZh: "萨哈林能源液化天然气第3列车", value: "$10 Billion", sector: "LNG", description: "Additional LNG production capacity.", descriptionRu: "Дополнительная мощность по производству СПГ.", descriptionZh: "额外的液化天然气生产能力。", partners: ["Sakhalin Energy"], completionYear: "2030" }
    ],
    advantages: [
      { icon: "resources", title: "Energy Superpower", titleRu: "Энергетическая сверхдержава", titleZh: "能源超级大国", description: "Massive oil and gas reserves. Russia's LNG export hub to Asia.", descriptionRu: "Огромные запасы нефти и газа. Российский хаб экспорта СПГ в Азию.", descriptionZh: "大量石油和天然气储备。俄罗斯对亚洲的液化天然气出口枢纽。" },
      { icon: "location", title: "Asia Proximity", titleRu: "Близость к Азии", titleZh: "亚洲邻近", description: "Short shipping distance to China, Japan, Korea LNG markets.", descriptionRu: "Короткое расстояние доставки на рынки СПГ Китая, Японии, Кореи.", descriptionZh: "到中国、日本、韩国液化天然气市场的短距离运输。" }
    ],
    contactInfo: { investmentAgency: "Sakhalin Oblast Investment Agency", investmentAgencyRu: "Агентство инвестиций Сахалинской области", investmentAgencyZh: "萨哈林州投资局", website: "https://investinsakhalin.ru", email: "info@investinsakhalin.ru" }
  },
  "Khabarovsk Krai": {
    name: "Khabarovsk Krai",
    nameRu: "Хабаровский край",
    nameZh: "哈巴罗夫斯克边疆区",
    gdp: "$17 Billion",
    population: "1.3 Million",
    industries: ["Mining", "Forestry", "Fishing", "Manufacturing"],
     industriesRu: ["Добыча полезных ископаемых", "Лесное хозяйство", "Рыболовство", "Производство"],
     industriesZh: ["采矿", "林业", "渔业", "制造业"],
    sezCount: 2,
    taxBenefits: ["Far East development benefits", "Resource extraction incentives", "Border trade support"],
     taxBenefitsRu: ["Льготы развития Дальнего Востока", "Льготы на добычу ресурсов", "Поддержка приграничной торговли"],
     taxBenefitsZh: ["远东发展优惠", "资源开采激励政策", "边境贸易支持"],
    majorCities: [
      { id: "khabarovsk", name: "Khabarovsk", nameRu: "Хабаровск", nameZh: "哈巴罗夫斯克", population: "0.6M", image: "https://images.unsplash.com/photo-1569935738295-3ef208855c9e?w=1920&q=80", description: "Capital of Russia's Far East Federal District on the Amur River. Major administrative and cultural center with direct border crossing to China. Gateway for Heilongjiang trade.", opportunities: [
        { id: "khb-1", title: "Khabarovsk-Fuyuan Border Hub", titleZh: "哈巴罗夫斯克-抚远边境枢纽", titleRu: "Пограничный хаб Хабаровск-Фуюань", sector: "Trade", description: "Cross-border trade zone with direct China access. Simplified customs for Russian-Chinese goods.", descriptionZh: "直通中国的跨境贸易区。中俄商品简化通关。", descriptionRu: "Трансграничная торговая зона с прямым доступом в Китай. Упрощённая таможня для российско-китайских товаров.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "khb-2", title: "Khabarovsk Logistics Center", titleZh: "哈巴罗夫斯克物流中心", titleRu: "Логистический центр Хабаровска", sector: "Logistics", description: "Regional distribution hub for Far East. Rail and river transport integration.", descriptionZh: "远东区域配送中心。铁路和水运整合。", descriptionRu: "Региональный распределительный хаб для Дальнего Востока. Интеграция ж/д и речного транспорта.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
        { id: "khb-3", title: "Far East Food Processing", titleZh: "远东食品加工", titleRu: "Пищевая переработка Дальнего Востока", sector: "Food", description: "Processing Russian agricultural products for Chinese market. Honey, berries, and game.", descriptionZh: "为中国市场加工俄罗斯农产品。蜂蜜、浆果和野味。", descriptionRu: "Переработка российской сельхозпродукции для китайского рынка. Мёд, ягоды и дичь.", investmentRange: "$8M - $60M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "komsomolsk-on-amur", name: "Komsomolsk-on-Amur", nameRu: "Комсомольск-на-Амуре", nameZh: "共青城", population: "0.2M", image: "https://images.unsplash.com/photo-1590244840770-b9a0a36a3a83?w=1920&q=80", description: "Russia's major aerospace manufacturing city. Home to Sukhoi fighter jets and civilian aircraft production. Strong industrial base with skilled workforce.", opportunities: [
        { id: "kms-1", title: "Sukhoi Supply Partnership", titleZh: "苏霍伊供应合作", titleRu: "Партнёрство с поставками для Сухого", sector: "Aerospace", description: "Component supply for Su-35, Su-57 fighters and Superjet 100. Avionics and materials.", descriptionZh: "苏-35、苏-57战斗机和超级喷气100的零部件供应。航空电子和材料。", descriptionRu: "Поставка комплектующих для Су-35, Су-57 и Sukhoi Superjet 100. Авионика и материалы.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "kms-2", title: "Civilian Aircraft Components", titleZh: "民用飞机零部件", titleRu: "Компоненты гражданских самолётов", sector: "Aerospace", description: "Superjet and MC-21 supply chain. Composite materials and systems.", descriptionZh: "超级喷气和MC-21供应链。复合材料和系统。", descriptionRu: "Цепочка поставок для Superjet и МС-21. Композитные материалы и системы.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" },
        { id: "kms-3", title: "Steel & Metallurgy Processing", titleZh: "钢铁和冶金加工", titleRu: "Переработка стали и металлургия", sector: "Steel", description: "Amurstal steel plant partnerships. Specialty steel products.", descriptionZh: "阿穆尔钢铁厂合作。特种钢产品。", descriptionRu: "Партнёрства с заводом Амурсталь. Специальные стальные изделия.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Major Far East region on Amur River bordering China. Khabarovsk is administrative center of Far Eastern Federal District. Strong aerospace (Sukhoi aircraft), mining, and forestry sectors. Direct border trade with Heilongjiang.",
    targetSectors: ["Aerospace", "Mining", "Forestry", "Border Trade", "Food Processing"],
     overviewRu: "Крупный регион Дальнего Востока на реке Амур, граничащий с Китаем. Хабаровск является административным центром Дальневосточного федерального округа. Сильные сектора аэрокосмической промышленности (самолёты Сухого), добычи полезных ископаемых и лесного хозяйства. Прямая приграничная торговля с Хэйлунцзяном.",
     overviewZh: "阿穆尔河畔与中国接壤的远东主要地区。哈巴罗夫斯克是远东联邦区的行政中心。拥有强大的航空航天（苏霍伊飞机）、采矿和林业部门。与黑龙江直接边境贸易。",
    opportunities: [
      { id: "kh-1", title: "Khabarovsk-Fuyuan Border Trade", titleZh: "哈巴罗夫斯克-抚远边境贸易", titleRu: "Пограничная торговля Хабаровск-Фуюань", sector: "Trade", description: "Cross-border trade zone with Heilongjiang. Simplified customs and logistics.", descriptionZh: "与黑龙江的跨境贸易区。简化通关和物流。", descriptionRu: "Трансграничная торговая зона с Хэйлунцзяном. Упрощённая таможня и логистика.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" },
      { id: "kh-2", title: "Komsomolsk Aviation Cluster", titleZh: "共青城航空集群", titleRu: "Авиационный кластер Комсомольска", sector: "Aerospace", description: "Sukhoi aircraft manufacturing. Supplier and technology partnerships.", descriptionZh: "苏霍伊飞机制造。供应商和技术合作。", descriptionRu: "Производство самолётов Сухого. Партнёрства с поставщиками и по технологиям.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" },
      { id: "kh-3", title: "Far East Timber Processing", titleZh: "远东木材加工", titleRu: "Деревообработка Дальнего Востока", sector: "Forestry", description: "Value-added wood processing for China export. Sustainable forestry.", descriptionZh: "面向中国出口的木材深加工。可持续林业。", descriptionRu: "Деревообработка с добавленной стоимостью для экспорта в Китай. Устойчивое лесопользование.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "kh-p1", name: "Sukhoi Superjet Production", nameRu: "Производство Sukhoi Superjet", nameZh: "苏霍伊超级喷气生产", value: "$1 Billion", sector: "Aerospace", description: "Regional jet manufacturing expansion.", descriptionRu: "Расширение производства региональных самолётов.", descriptionZh: "区域喷气机制造扩展.", partners: ["UAC"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "location", title: "Far East Capital", titleRu: "Столица Дальнего Востока", titleZh: "远东首都", description: "Administrative center of Far Eastern Federal District.", descriptionRu: "Административный центр Дальневосточного федерального округа.", descriptionZh: "远东联邦区的行政中心。" },
      { icon: "infrastructure", title: "Aerospace Hub", titleRu: "Аэрокосмический хаб", titleZh: "航空航天中心", description: "Sukhoi fighter and civilian aircraft production.", descriptionRu: "Производство истребителей Сухого и гражданских самолётов.", descriptionZh: "苏霍伊战斗机和民用飞机生产。" }
    ],
    contactInfo: { investmentAgency: "Khabarovsk Krai Investment Agency", investmentAgencyRu: "Инвестиционное агентство Хабаровского края", investmentAgencyZh: "哈巴罗夫斯克边疆区投资局", website: "https://invest.khabkrai.ru", email: "info@invest.khabkrai.ru" }
  },
    "Novosibirsk Oblast": {
    name: "Novosibirsk Oblast",
    nameRu: "Новосибирская область",
    nameZh: "新西伯利亚州",
    gdp: "$23 Billion",
    population: "2.8 Million",
    industries: ["IT", "Science", "Manufacturing", "Agriculture"],
    industriesRu: ["IT", "Наука", "Производство", "Сельское хозяйство"],
    industriesZh: ["IT", "科学", "制造业", "农业"],
    sezCount: 2,
    taxBenefits: ["Akademgorodok technopark benefits", "IT incentives", "Science city support"],
    taxBenefitsRu: ["Льготы технопарка Академгородок", "Льготы для IT", "Поддержка научного города"],
    taxBenefitsZh: ["科学城技术园区优惠", "IT激励政策", "科学城支持"],
    majorCities: [
      { id: "novosibirsk", name: "Novosibirsk", nameRu: "Новосибирск", nameZh: "新西伯利亚", population: "1.6M", image: "https://images.unsplash.com/photo-1596389662031-aa6e6b8d0c09?w=1920&q=80", description: "Russia's third-largest city and capital of Siberia. Home to Akademgorodok - Russia's premier science city. Major IT hub with strong research tradition. Strategic location on Trans-Siberian Railway.", descriptionRu: "Третий по величине город России и столица Сибири. Дом Академгородка - ведущего научного города России. Крупный IT-хаб с сильной научной традицией. Стратегическое расположение на Транссибирской магистрали.", descriptionZh: "俄罗斯第三大城市和西伯利亚首都。科学城的所在地——俄罗斯顶级科学城。主要IT中心，具有强大的研究传统。位于西伯利亚大铁路的战略位置。", opportunities: [
        { id: "nvs-1", title: "Akademgorodok Tech Partnership", titleZh: "新西伯利亚科学城技术合作", titleRu: "Технологическое партнёрство с Академгородком", sector: "R&D", description: "Joint research with 35+ institutes. AI, physics, biology, and materials science.", descriptionZh: "与35+研究机构联合研究。AI、物理、生物和材料科学。", descriptionRu: "Совместные исследования с 35+ институтами. ИИ, физика, биология и материаловедение.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "priority" },
        { id: "nvs-2", title: "Novosibirsk IT Cluster", titleZh: "新西伯利亚IT集群", titleRu: "ИТ-кластер Новосибирска", sector: "IT", description: "Software development hub. Strong mathematics and programming talent from NSU.", descriptionZh: "软件开发中心。新西伯利亚国立大学的强大数学和编程人才。", descriptionRu: "Хаб разработки ПО. Сильные математики и программисты из НГУ.", investmentRange: "$5M - $60M", timeline: "1-2 years", status: "active" },
        { id: "nvs-3", title: "Vector Institute Partnership", titleZh: "矢量研究所合作", titleRu: "Партнёрство с институтом Вектор", sector: "Biotech", description: "Virology and vaccine research. World-renowned biosecurity expertise.", descriptionZh: "病毒学和疫苗研究。世界知名的生物安全专业知识。", descriptionRu: "Вирусология и исследования вакцин. Всемирно известная экспертиза в биобезопасности.", investmentRange: "$15M - $120M", timeline: "3-5 years", status: "active" },
        { id: "nvs-4", title: "Siberian Logistics Hub", titleZh: "西伯利亚物流中心", titleRu: "Сибирский логистический хаб", sector: "Logistics", description: "Trans-Siberian Railway node. China-Europe freight and distribution.", descriptionZh: "西伯利亚大铁路枢纽。中欧货运和配送。", descriptionRu: "Узел Транссиба. Грузоперевозки и дистрибуция Китай-Европа.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "berdsk", name: "Berdsk", nameRu: "Бердск", nameZh: "别尔茨克", population: "0.1M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Satellite city with electronics manufacturing and recreation on Ob Sea reservoir. Growing residential and tech services.", descriptionRu: "Спутниковый город с производством электроники и отдыхом на водохранилище Обского моря. Растущий жилой и технологический сектор услуг.", descriptionZh: "卫星城市，拥有电子制造和Ob海水库娱乐设施。不断增长的住宅和技术服务。", opportunities: [
        { id: "brd-1", title: "Electronics Manufacturing", titleZh: "电子制造", titleRu: "Производство электроники", sector: "Electronics", description: "Consumer and industrial electronics production. Novosibirsk metro area supplier.", descriptionZh: "消费和工业电子产品生产。新西伯利亚都市区供应商。", descriptionRu: "Производство потребительской и промышленной электроники. Поставщик для агломерации Новосибирска.", investmentRange: "$8M - $60M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Russia's third-largest city and Siberian capital. Akademgorodok is Russia's premier science city with world-class research institutes. Strong IT sector and growing tech startup ecosystem. Strategic location on Trans-Siberian Railway.",
    overviewRu: "Третий по величине город России и столица Сибири. Академгородок - ведущий научный город России с мировыми научными институтами. Сильный IT-сектор и растущая экосистема технологических стартапов. Стратегическое расположение на Транссибирской магистрали.",
    overviewZh: "俄罗斯第三大城市和西伯利亚首都。科学城是俄罗斯顶级科学城，拥有世界级研究机构。强大的IT部门和不断增长的科技创业生态系统。位于西伯利亚大铁路的战略位置。",
    targetSectors: ["IT & Software", "Science & R&D", "Biotech", "Nuclear Technology", "Education"],
    opportunities: [
      { id: "ns-1", title: "Akademgorodok Science Partnership", titleZh: "新西伯利亚科学城科研合作", titleRu: "Научное партнёрство с Академгородком", sector: "R&D", description: "Joint research with 35+ institutes in physics, biology, chemistry. Technology commercialization opportunities.", descriptionZh: "与35+物理、生物、化学研究机构联合研究。技术商业化机会。", descriptionRu: "Совместные исследования с 35+ институтами по физике, биологии, химии. Возможности коммерциализации технологий.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "priority" },
      { id: "ns-2", title: "Novosibirsk IT Cluster", titleZh: "新西伯利亚IT集群", titleRu: "ИТ-кластер Новосибирска", sector: "IT", description: "Software development and tech startups. Strong mathematics and programming talent.", descriptionZh: "软件开发和科技创业公司。强大的数学和编程人才。", descriptionRu: "Разработка ПО и техстартапы. Сильные математики и программисты.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" },
      { id: "ns-3", title: "Siberian Biotech Hub", titleZh: "西伯利亚生物技术中心", titleRu: "Сибирский биотех-хаб", sector: "Biotech", description: "Vector Institute for virology and biotech research. Vaccine and pharmaceutical development.", descriptionZh: "矢量研究所病毒学和生物技术研究。疫苗和制药开发。", descriptionRu: "Институт Вектор для вирусологии и биотех-исследований. Разработка вакцин и фармпрепаратов.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "ns-p1", name: "Akademgorodok 2.0", nameRu: "Академгородок 2.0", nameZh: "科学城2.0", value: "$500 Million", sector: "Science", description: "Modernization of Russia's premier science city.", descriptionRu: "Модернизация ведущего научного города России.", descriptionZh: "俄罗斯顶级科学城的现代化。", completionYear: "2030" }
    ],
    advantages: [
      { icon: "talent", title: "Science Capital", titleRu: "Научная столица", titleZh: "科学首都", description: "Akademgorodok - Russia's largest scientific center with 35+ research institutes.", descriptionRu: "Академгородок - крупнейший научный центр России с 35+ научными институтами.", descriptionZh: "科学城——俄罗斯最大的科学中心，拥有35+研究机构。" },
      { icon: "tech", title: "IT Hub", titleRu: "IT-хаб", titleZh: "IT中心", description: "Strong programming talent and growing startup ecosystem.", descriptionRu: "Сильные программисты и растущая экосистема стартапов.", descriptionZh: "强大的编程人才和不断增长的创业生态系统。" }
    ],
    contactInfo: { investmentAgency: "Novosibirsk Oblast Investment Agency", investmentAgencyRu: "Агентство инвестиций Новосибирской области", investmentAgencyZh: "新西伯利亚州投资局", website: "https://invest.nso.ru", email: "info@invest.nso.ru" }
  },
  "Kaliningrad Oblast": {
    name: "Kaliningrad Oblast",
    nameRu: "Калининградская область",
    nameZh: "加里宁格勒州",
    gdp: "$12 Billion",
    population: "1 Million",
    industries: ["Automotive", "Electronics", "Food Processing", "Amber"],
    industriesRu: ["Автомобилестроение", "Электроника", "Пищевая промышленность", "Янтарь"],
    industriesZh: ["汽车制造", "电子产品", "食品加工", "琥珀"],
    sezCount: 1,
    overviewRu: "Российский анклав на Балтийском море между Польшей и Литвой. Особая экономическая зона с уникальным положением на границе с ЕС. Сборка автомобилей (BMW, Kia), производство электроники и 90% мировых запасов янтаря.",
    overviewZh: "波罗的海上的俄罗斯飞地，位于波兰和立陶宛之间。特别经济区，具有独特的欧盟边境地位。汽车组装（宝马、起亚）、电子产品制造和全球90%的琥珀储备。",
    taxBenefits: ["SEZ Yantar benefits", "EU border trade advantages", "Import substitution support"],
    taxBenefitsRu: ["Льготы ОЭЗ Янтарь", "Преимущества приграничной торговли с ЕС", "Поддержка импортозамещения"],
    taxBenefitsZh: ["琥珀特经区优惠", "欧盟边境贸易优势", "进口替代支持"],
    majorCities: [{ id: "kaliningrad", name: "Kaliningrad", nameRu: "Калининград", nameZh: "加里宁格勒", population: "0.5M" }, { id: "sovetsk", name: "Sovetsk", nameRu: "Советск", nameZh: "苏维埃斯克", population: "0.04M" }],
    overview: "Russian exclave on Baltic Sea between Poland and Lithuania. Special Economic Zone with unique EU border position. Automotive assembly (BMW, Kia), electronics manufacturing, and 90% of world's amber reserves.",
    targetSectors: ["Automotive", "Electronics Assembly", "Amber", "Food Processing", "Tourism"],
    opportunities: [
      { id: "kg-1", title: "Kaliningrad Assembly Hub", titleZh: "加里宁格勒组装中心", titleRu: "Сборочный хаб Калининграда", sector: "Manufacturing", description: "Electronics and automotive assembly for Russia market. SEZ tax benefits.", descriptionZh: "面向俄罗斯市场的电子和汽车组装。特别经济区税收优惠。", descriptionRu: "Сборка электроники и автомобилей для российского рынка. Налоговые льготы ОЭЗ.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "active" },
      { id: "kg-2", title: "Baltic Tourism Development", titleZh: "波罗的海旅游开发", titleRu: "Развитие балтийского туризма", sector: "Tourism", description: "Beach resorts and historical tourism. Amber jewelry and crafts.", descriptionZh: "海滩度假村和历史旅游。琥珀珠宝和工艺品。", descriptionRu: "Пляжные курорты и исторический туризм. Янтарные украшения и изделия.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "kg-p1", name: "Kaliningrad Port Modernization", nameRu: "Модернизация портов Калининграда", nameZh: "加里宁格勒港口现代化", value: "$300 Million", sector: "Port", description: "Baltic container terminal expansion.", descriptionRu: "Расширение балтийского контейнерного терминала.", descriptionZh: "波罗的海集装箱码头扩建。", completionYear: "2027" }
    ],
    advantages: [
      { icon: "location", title: "EU Gateway", titleRu: "Ворота в ЕС", titleZh: "欧盟门户", description: "Only Russian region bordering EU. Unique trade position.", descriptionRu: "Единственный российский регион, граничащий с ЕС. Уникальное торговое положение.", descriptionZh: "唯一与欧盟接壤的俄罗斯地区。独特的贸易地位。" },
      { icon: "resources", title: "Amber Capital", titleRu: "Янтарная столица", titleZh: "琥珀之都", description: "90% of world's amber deposits.", descriptionRu: "90% мировых запасов янтаря.", descriptionZh: "全球90%的琥珀储备。" }
    ],
    contactInfo: { investmentAgency: "Kaliningrad Oblast Development Corporation", investmentAgencyRu: "Корпорация развития Калининградской области", investmentAgencyZh: "加里宁格勒州发展公司", website: "https://investinkaliningrad.ru", email: "info@investinkaliningrad.ru" }
  },
  "Samara Oblast": { name: "Samara Oblast", nameRu: "Самарская область", nameZh: "萨马拉州", gdp: "$35 Billion", population: "3.2 Million", industries: ["Automotive", "Aerospace", "Petrochemicals", "Agriculture"], industriesRu: ["Автомобилестроение", "Аэрокосмос", "Нефтехимия", "Сельское хозяйство"], industriesZh: ["汽车制造", "航空航天", "石油化工", "农业"], sezCount: 1, taxBenefits: ["Automotive cluster benefits", "Aerospace incentives", "Togliatti SEZ"], taxBenefitsRu: ["Льготы автомобильного кластера", "Стимулы аэрокосмоса", "СЭЗ Тольятти"], taxBenefitsZh: ["汽车集群优惠", "航空航天激励", "托利亚蒂经济特区"], majorCities: [{ id: "samara", name: "Samara", nameRu: "Самара", nameZh: "萨马拉", population: "1.2M" }, { id: "togliatti", name: "Togliatti", nameRu: "Тольятти", nameZh: "托利亚蒂", population: "0.7M" }, { id: "syzran", name: "Syzran", nameRu: "Сызрань", nameZh: "西兹兰", population: "0.2M" }], overview: "Major Volga region industrial center. AVTOVAZ (Lada) headquarters in Togliatti. Space rocket production at Progress. Strong petrochemical sector.", overviewRu: "Крупный промышленный центр Волжского региона. Штаб-квартира АВТОВАЗ (Лада) в Тольятти. Производство космических ракет на Progress. Сильный нефтехимический сектор.", overviewZh: "伏尔加地区主要工业中心。AVTOVAZ（拉达）总部位于托利亚蒂。Progress公司的太空火箭生产。强大的石油化工部门。", targetSectors: ["Automotive", "Aerospace", "Petrochemicals", "Agriculture"], opportunities: [{ id: "sm-1", title: "AVTOVAZ Supplier Partnership", titleZh: "伏尔加汽车供应商合作", titleRu: "Партнёрство с поставщиками АВТОВАЗ", sector: "Automotive", description: "Component supply for Russia's largest automaker. EV transition opportunities.", descriptionZh: "俄罗斯最大汽车制造商的零部件供应。电动汽车转型机会。", descriptionRu: "Поставка комплектующих для крупнейшего автопроизводителя России. Возможности перехода на электромобили.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }], keyProjects: [{ id: "sm-p1", name: "Togliatti SEZ Expansion", nameRu: "Расширение СЭЗ Тольятти", nameZh: "托利亚蒂经济特区扩建", value: "$200 Million", sector: "Industrial", description: "Automotive supplier park development.", descriptionRu: "Развитие автомобильного парка поставщиков.", descriptionZh: "汽车供应商园区开发。", completionYear: "2027" }], advantages: [{ icon: "infrastructure", title: "Auto Capital", titleRu: "Автомобильная столица", titleZh: "汽车之都", description: "AVTOVAZ headquarters and supplier ecosystem.", descriptionRu: "Штаб-квартира АВТОВАЗ и экосистема поставщиков.", descriptionZh: "AVTOVAZ总部和供应商生态系统。" }], contactInfo: { investmentAgency: "Samara Oblast Investment Agency", investmentAgencyRu: "Инвестиционное агентство Самарской области", investmentAgencyZh: "萨马拉州投资局", website: "https://investinsamara.ru" } },
  "Nizhny Novgorod Oblast": { name: "Nizhny Novgorod Oblast", nameRu: "Нижегородская область", nameZh: "下诺夫哥罗德州", gdp: "$32 Billion", population: "3.2 Million", industries: ["Automotive", "IT", "Metallurgy", "Chemicals"], industriesRu: ["Автомобилестроение", "Информационные технологии", "Металлургия", "Химия"], industriesZh: ["汽车", "信息技术", "冶金", "化工"], sezCount: 2, taxBenefits: ["IT cluster benefits", "Automotive support", "Investment incentives"], taxBenefitsRu: ["Льготы ИТ-кластера", "Поддержка автомобилестроения", "Инвестиционные стимулы"], taxBenefitsZh: ["IT集群优惠", "汽车产业支持", "投资激励"], majorCities: [{ id: "nizhny-novgorod", name: "Nizhny Novgorod", nameRu: "Нижний Новгород", nameZh: "下诺夫哥罗德", population: "1.3M" }, { id: "dzerzhinsk", name: "Dzerzhinsk", nameRu: "Дзержинск", nameZh: "捷尔任斯克", population: "0.2M" }, { id: "arzamas", name: "Arzamas", nameRu: "Арзамас", nameZh: "阿尔扎马斯", population: "0.1M" }], overview: "Historic trading city at Volga-Oka confluence. GAZ Group truck manufacturing. Growing IT sector and strong chemicals industry in Dzerzhinsk.", overviewRu: "Исторический торговый город в месте слияния Волги и Оки. Производство грузовиков ГАЗ. Растущий ИТ-сектор и сильная химическая промышленность в Дзержинске.", overviewZh: "伏尔加河与奥卡河汇合处的历史贸易城市。高尔基汽车集团卡车制造。IT部门不断增长，捷尔任斯克化工产业强劲。", targetSectors: ["Automotive", "IT", "Chemicals", "Nuclear"], opportunities: [{ id: "nn-1", title: "GAZ Group Partnership", titleZh: "高尔基汽车集团合作", titleRu: "Партнёрство с ГАЗ", sector: "Automotive", description: "Commercial vehicle manufacturing. Chinese brand assembly.", descriptionZh: "商用车制造。中国品牌组装。", descriptionRu: "Производство коммерческих автомобилей. Сборка китайских брендов.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }], keyProjects: [], advantages: [{ icon: "logistics", title: "Volga Hub", titleRu: "Волжский хаб", titleZh: "伏尔加枢纽", description: "Strategic location on major river trade routes." }], contactInfo: { investmentAgency: "Nizhny Novgorod Investment Agency", investmentAgencyRu: "Агентство инвестиций Нижегородской области", investmentAgencyZh: "下诺夫哥罗德州投资局", website: "https://invest.nnov.ru" } },
  "Rostov Oblast": { name: "Rostov Oblast", nameRu: "Ростовская область", nameZh: "罗斯托夫州", gdp: "$33 Billion", population: "4.2 Million", industries: ["Agriculture", "Heavy Machinery", "Food Processing", "Trade"], industriesRu: ["Сельское хозяйство", "Тяжёлое машиностроение", "Пищевая промышленность", "Торговля"], industriesZh: ["农业", "重型机械", "食品加工", "贸易"], sezCount: 1, taxBenefits: ["Agricultural processing benefits", "Southern Russia incentives", "Port zone benefits"], taxBenefitsRu: ["Льготы пищевой промышленности", "Стимулы южной России", "Льготы портовой зоны"], taxBenefitsZh: ["食品加工优惠", "南俄罗斯激励", "港口区优惠"], majorCities: [{ id: "rostov-on-don", name: "Rostov-on-Don", nameRu: "Ростов-на-Дону", nameZh: "顿河畔罗斯托夫", population: "1.1M" }, { id: "taganrog", name: "Taganrog", nameRu: "Таганрог", nameZh: "塔甘罗格", population: "0.3M" }, { id: "shakhty", name: "Shakhty", nameRu: "Шахты", nameZh: "沙赫蒂", population: "0.2M" }], overview: "Southern Russia's largest city and agricultural hub. Gateway to Caucasus. Major agricultural machinery (Rostselmash) production. Port city on Don River.", overviewRu: "Крупнейший город южной России и сельскохозяйственный центр. Ворота на Кавказ. Крупное производство сельскохозяйственной техники (Ростсельмаш). Портовый город на реке Дон.", overviewZh: "俄罗斯南部最大城市和农业中心。通往高加索的门户。主要农业机械生产（Rostselmash）。顿河畔的港口城市。", targetSectors: ["Agriculture", "Agricultural Machinery", "Food Processing", "Logistics"], opportunities: [{ id: "rs-1", title: "Rostselmash Partnership", titleZh: "罗斯特农机合作", titleRu: "Партнёрство с Ростсельмаш", sector: "Machinery", description: "Agricultural machinery manufacturing. Combine harvester production.", descriptionZh: "农业机械制造。联合收割机生产。", descriptionRu: "Производство сельскохозяйственной техники. Производство зерноуборочных комбайнов.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
      { id: "rs-2", title: "Don River Grain Export", titleZh: "顿河粮食出口", titleRu: "Донской зерновой экспорт", sector: "Agriculture", description: "Grain processing and export terminal. Major wheat and sunflower production.", descriptionZh: "粮食加工和出口码头。主要小麦和葵花籽生产。", descriptionRu: "Зернопереработка и экспортный терминал. Крупное производство пшеницы и подсолнечника.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" },
      { id: "rs-3", title: "Rostov Tech Hub", titleZh: "罗斯托夫科技中心", titleRu: "Ростовский технопарк", sector: "IT", description: "IT and software development center for southern Russia.", descriptionZh: "俄罗斯南部IT和软件开发中心。", descriptionRu: "ИТ и центр разработки ПО для юга России.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Agricultural Belt", titleRu: "Сельскохозяйственный пояс", titleZh: "农业带", description: "Major grain and sunflower production region.", descriptionRu: "Крупный регион производства зерна и подсолнечника.", descriptionZh: "主要粮食和向日葵生产地区。" }], contactInfo: { investmentAgency: "Rostov Oblast Investment Agency", investmentAgencyRu: "Инвестиционное агентство Ростовской области", investmentAgencyZh: "罗斯托夫州投资局", website: "https://investinrostov.ru" } },
  "Chelyabinsk Oblast": { name: "Chelyabinsk Oblast", nameRu: "Челябинская область", nameZh: "车里雅宾斯克州", gdp: "$28 Billion", population: "3.4 Million", industries: ["Metallurgy", "Heavy Machinery", "Mining", "Defense"], industriesRu: ["Металлургия", "Тяжёлое машиностроение", "Горнодобывающая промышленность", "Оборонная промышленность"], industriesZh: ["冶金", "重型机械", "采矿", "国防工业"], sezCount: 1, taxBenefits: ["Industrial cluster benefits", "Metallurgy support", "Defense industry incentives"], taxBenefitsRu: ["Льготы индустриальных кластеров", "Поддержка металлургии", "Стимулы оборонной промышленности"], taxBenefitsZh: ["工业集群优惠", "冶金支持", "国防工业激励"], majorCities: [{ id: "chelyabinsk", name: "Chelyabinsk", nameRu: "Челябинск", nameZh: "车里雅宾斯克", population: "1.2M" }, { id: "magnitogorsk", name: "Magnitogorsk", nameRu: "Магнитогорск", nameZh: "马格尼托哥尔斯克", population: "0.4M" }, { id: "zlatoust", name: "Zlatoust", nameRu: "Златоуст", nameZh: "兹拉托乌斯特", population: "0.2M" }], overview: "Major Urals industrial center. MMK steel giant in Magnitogorsk. Pipe manufacturing and heavy machinery. Strong defense industry.", overviewRu: "Крупный промышленный центр Урала. Гигант металлургии ММК в Магнитогорске. Трубное производство и тяжёлое машиностроение. Сильная оборонная промышленность.", overviewZh: "乌拉尔主要工业中心。马格尼托哥尔斯克的钢铁巨头MMK。管道制造和重型机械。强大的国防工业。", targetSectors: ["Steel", "Pipe Manufacturing", "Mining Equipment", "Defense"], opportunities: [{ id: "ch-1", title: "MMK Steel Partnership", titleZh: "马格尼托哥尔斯克钢铁合作", titleRu: "Партнёрство с ММК", sector: "Steel", description: "Steel production and processing. Green steel initiatives.", descriptionZh: "钢铁生产和加工。绿色钢铁倡议。", descriptionRu: "Производство и переработка стали. Инициативы зелёной стали.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
       { id: "ch-2", title: "Chelyabinsk Pipe Manufacturing", titleZh: "车里雅宾斯克管道制造", titleRu: "Челябинское трубное производство", sector: "Manufacturing", description: "Steel pipe production for oil and gas pipelines to China.", descriptionZh: "石油和天然气管道的钢管生产。", descriptionRu: "Производство стальных труб для нефтегазопроводов в Китай.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
       { id: "ch-3", title: "Urals Mining Equipment", titleZh: "乌拉尔采矿设备", titleRu: "Уральское горное оборудование", sector: "Mining", description: "Mining machinery and equipment manufacturing.", descriptionZh: "采矿机械和设备制造。", descriptionRu: "Производство горнодобывающей техники и оборудования.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" }], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Steel Giant", titleRu: "Стальной гигант", titleZh: "钢铁巨头", description: "MMK - one of world's largest steel plants.", descriptionRu: "ММК — один из крупнейших сталелитейных заводов мира.", descriptionZh: "MMK——世界最大的钢铁厂之一。" }], contactInfo: { investmentAgency: "Chelyabinsk Oblast Investment Agency", investmentAgencyRu: "Инвестиционное агентство Челябинской области", investmentAgencyZh: "车里雅宾斯克州投资局", website: "https://investinchel.ru" } },
  "Bashkortostan": { name: "Republic of Bashkortostan", nameRu: "Республика Башкортостан", nameZh: "巴什科尔托斯坦共和国", gdp: "$27 Billion", population: "4 Million", industries: ["Oil & Gas", "Petrochemicals", "Agriculture", "Mining"], industriesRu: ["Нефть и газ", "Нефтехимия", "Сельское хозяйство", "Горнодобывающая промышленность"], industriesZh: ["石油和天然气", "石油化工", "农业", "采矿"], sezCount: 1, taxBenefits: ["Petrochemical cluster benefits", "Agricultural support", "Investment incentives"], taxBenefitsRu: ["Льготы нефтехимического кластера", "Поддержка сельского хозяйства", "Инвестиционные стимулы"], taxBenefitsZh: ["石油化工集群优惠", "农业支持", "投资激励"], majorCities: [{ id: "ufa", name: "Ufa", nameRu: "Уфа", nameZh: "乌法", population: "1.1M" }, { id: "sterlitamak", name: "Sterlitamak", nameRu: "Стерлитамак", nameZh: "斯特利塔马克", population: "0.3M" }, { id: "salavat", name: "Salavat", nameRu: "Салават", nameZh: "萨拉瓦特", population: "0.2M" }], overview: "Major petrochemical and agricultural region. Bashneft oil company. Diverse ethnic republic with strong manufacturing base.", overviewRu: "Крупный нефтехимический и сельскохозяйственный регион. Нефтяная компания Башнефть. Многоэтнический регион с сильной производственной базой.", overviewZh: "主要石油化工和农业地区。巴什石油公司。多民族共和国，拥有强大的制造业基础。", targetSectors: ["Petrochemicals", "Oil Refining", "Agriculture", "Soda & Chemicals"], opportunities: [{ id: "bs-1", title: "Bashkortostan Petrochemical Investment", titleZh: "巴什科尔托斯坦石化投资", titleRu: "Нефтехимические инвестиции Башкортостана", sector: "Petrochemicals", description: "Downstream oil processing and specialty chemicals.", descriptionZh: "下游石油加工和特种化学品。", descriptionRu: "Переработка нефти и производство специализированных химикатов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
       { id: "bs-2", title: "Bashneft Oil Partnership", titleZh: "巴什石油合作", titleRu: "Партнёрство с Башнефтью", sector: "Oil & Gas", description: "Oil production and refining partnership with Bashneft.", descriptionZh: "与巴什石油的石油生产和炼油合作。", descriptionRu: "Партнёрство по добыче и переработке нефти с Башнефтью.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
       { id: "bs-3", title: "Ufa Agricultural Processing", titleZh: "乌法农产品加工", titleRu: "Уфимская сельхозпереработка", sector: "Agriculture", description: "Grain and honey processing for export.", descriptionZh: "粮食和蜂蜜加工出口。", descriptionRu: "Переработка зерна и мёда на экспорт.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Petrochemical Hub", titleRu: "Нефтехимический хаб", titleZh: "石油化工中心", description: "Major refining and chemical production capacity.", descriptionRu: "Крупные мощности по переработке и химическому производству.", descriptionZh: "主要炼油和化学生产能力。" }], contactInfo: { investmentAgency: "Bashkortostan Investment Agency", investmentAgencyRu: "Инвестиционное агентство Башкортостана", investmentAgencyZh: "巴什科尔托斯坦投资局", website: "https://investinbashkortostan.ru" } },
  "Perm Krai": { name: "Perm Krai", nameRu: "Пермский край", nameZh: "彼尔姆边疆区", gdp: "$26 Billion", population: "2.6 Million", industries: ["Oil & Gas", "Chemicals", "Mining", "Machinery"], industriesRu: ["Нефть и газ", "Химия", "Горнодобыча", "Машиностроение"], industriesZh: ["石油和天然气", "化学品", "采矿", "机械制造"], sezCount: 1, taxBenefits: ["Chemical cluster benefits", "Mining incentives", "Industrial park support"], taxBenefitsRu: ["Льготы химического кластера", "Стимулы горнодобычи", "Поддержка индустриального парка"], taxBenefitsZh: ["化学集群优惠", "采矿激励", "工业园区支持"], majorCities: [{ id: "perm", name: "Perm", nameRu: "Пермь", nameZh: "彼尔姆", population: "1.1M" }, { id: "berezniki", name: "Berezniki", nameRu: "Березники", nameZh: "别列兹尼基", population: "0.1M" }, { id: "solikamsk", name: "Solikamsk", nameRu: "Соликамск", nameZh: "索利卡姆斯克", population: "0.1M" }], overview: "Major Urals industrial region. Uralkali potash production. Strong chemicals and oil sector. Aviation engine manufacturing.", overviewRu: "Крупный промышленный регион Урала. Производство калия компанией Уралкалий. Сильный химический и нефтяной сектор. Производство авиационных двигателей.", overviewZh: "乌拉尔主要工业地区。乌拉尔钾肥公司的钾肥生产。强大的化学和石油部门。飞机发动机制造。", targetSectors: ["Potash & Fertilizers", "Oil & Gas", "Aviation", "Chemicals"], opportunities: [{ id: "pm-1", title: "Uralkali Potash Partnership", titleZh: "乌拉尔钾肥合作", titleRu: "Партнёрство с Уралкалием", sector: "Fertilizers", description: "Potash mining and fertilizer production for China agriculture.", descriptionZh: "钾肥开采和化肥生产，供应中国农业。", descriptionRu: "Добыча калия и производство удобрений для китайского сельского хозяйства.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "pm-2", title: "Perm Aviation Engines", titleZh: "彼尔姆航空发动机", titleRu: "Пермские авиадвигатели", sector: "Aerospace", description: "Aircraft engine manufacturing and maintenance.", descriptionZh: "飞机发动机制造和维护。", descriptionRu: "Производство и обслуживание авиационных двигателей.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
      { id: "pm-3", title: "Kama Oil & Gas Services", titleZh: "卡马石油天然气服务", titleRu: "Камские нефтегазовые услуги", sector: "Oil & Gas", description: "Oilfield services and equipment for Western Siberia operations.", descriptionZh: "西西伯利亚作业的油田服务和设备。", descriptionRu: "Нефтесервисные услуги и оборудование для западносибирских операций.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Potash Leader", description: "World's largest potash producer. Critical for agriculture." }], contactInfo: { investmentAgency: "Perm Krai Investment Agency", website: "https://investinperm.ru" } },
  "Leningrad Oblast": { name: "Leningrad Oblast", nameRu: "Ленинградская область", nameZh: "列宁格勒州", gdp: "$22 Billion", population: "2 Million", industries: ["Automotive", "Shipbuilding", "Food Processing", "Logistics"], industriesRu: ["Автомобилестроение", "Судостроение", "Пищевая промышленность", "Логистика"], industriesZh: ["汽车", "造船", "食品加工", "物流"], sezCount: 2, taxBenefits: ["Port zone benefits", "Automotive cluster support", "Logistics incentives"], taxBenefitsRu: ["Льготы портовой зоны", "Поддержка автомобильного кластера", "Стимулы логистики"], taxBenefitsZh: ["港口区优惠", "汽车集群支持", "物流激励"], majorCities: [{ id: "gatchina", name: "Gatchina", nameRu: "Гатчина", nameZh: "盖奇纳", population: "0.1M" }, { id: "vyborg", name: "Vyborg", nameRu: "Выборг", nameZh: "维堡", population: "0.08M" }, { id: "vsevolozhsk", name: "Vsevolozhsk", nameRu: "Всеволожск", nameZh: "弗谢沃洛日斯克", population: "0.07M" }], overview: "Region surrounding St. Petersburg with major ports and industry. Major automotive plants (Ford, Toyota, GM). Ust-Luga port is Russia's largest Baltic terminal.", overviewRu: "Регион, окружающий Санкт-Петербург с крупными портами и промышленностью. Крупные автомобильные заводы (Ford, Toyota, GM). Порт Усть-Луга — крупнейший балтийский терминал России.", overviewZh: "圣彼得堡周围地区，拥有主要港口和工业。主要汽车工厂（福特、丰田、通用）。乌斯季卢加港是俄罗斯最大的波罗的海码头。", targetSectors: ["Automotive", "Port & Logistics", "Shipbuilding", "LNG"], opportunities: [{ id: "lo-1", title: "Ust-Luga Port Development", titleZh: "乌斯季卢加港口开发", titleRu: "Развитие порта Усть-Луга", sector: "Port", description: "Russia's largest Baltic port. Container and LNG terminals.", descriptionZh: "俄罗斯最大的波罗的海港口。集装箱和LNG码头。", descriptionRu: "Крупнейший российский балтийский порт. Контейнерные и СПГ-терминалы.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "lo-2", title: "Baltic Automotive Cluster", titleZh: "波罗的海汽车产业集群", titleRu: "Балтийский автомобильный кластер", sector: "Automotive", description: "Auto parts manufacturing near St. Petersburg plants.", descriptionZh: "圣彼得堡工厂附近的汽车零部件制造。", descriptionRu: "Производство автокомплектующих рядом с петербургскими заводами.", investmentRange: "$20M - $150M", timeline: "2-3 years", status: "active" },
      { id: "lo-3", title: "Leningrad LNG Terminal", titleZh: "列宁格勒LNG码头", titleRu: "Ленинградский СПГ-терминал", sector: "Energy", description: "LNG import and bunkering facility for Baltic shipping.", descriptionZh: "波罗的海航运的LNG进口和加注设施。", descriptionRu: "СПГ-импортный и бункеровочный терминал для балтийского судоходства.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "active" }], keyProjects: [], advantages: [{ icon: "logistics", title: "Baltic Gateway", titleRu: "Балтийские ворота", titleZh: "波罗的海门户", description: "Ust-Luga - Russia's largest Baltic port." }], contactInfo: { investmentAgency: "Leningrad Oblast Investment Agency", investmentAgencyRu: "Агентство инвестиций Ленинградской области", investmentAgencyZh: "列宁格勒州投资局", website: "https://investinlenobl.ru" } },
  "Irkutsk Oblast": {
    name: "Irkutsk Oblast",
    nameRu: "Иркутская область",
    nameZh: "伊尔库茨克州",
    gdp: "$34 Billion",
    population: "2.4 Million",
    industries: ["Mining", "Forestry", "Hydropower", "Chemicals"],
    industriesRu: ["Горнодобыча", "Лесопромышленность", "Гидроэнергетика", "Химия"],
    industriesZh: ["采矿", "林业", "水电", "化工"],
    sezCount: 1,
    taxBenefits: ["Resource extraction benefits", "Baikal tourism incentives", "Energy cluster support"],
    taxBenefitsRu: ["Льготы на добычу ресурсов", "Стимулы туризма на Байкале", "Поддержка энергетического кластера"],
    taxBenefitsZh: ["资源开采优惠", "贝加尔湖旅游激励", "能源集群支持"],
    majorCities: [
      { id: "irkutsk", name: "Irkutsk", nameRu: "Иркутск", nameZh: "伊尔库茨克", population: "0.6M", image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80", description: "Gateway to Lake Baikal and historic Siberian trading city. Rich architectural heritage from merchants' era. Major university center and tourism hub for Chinese visitors.", opportunities: [
        { id: "irk-1", title: "Lake Baikal Eco-Tourism", titleZh: "贝加尔湖生态旅游", titleRu: "Экотуризм на озере Байкал", sector: "Tourism", description: "Premium eco-lodges and adventure tourism on world's deepest lake. Growing Chinese visitor segment.", descriptionZh: "世界最深湖泊上的高端生态小屋和探险旅游。中国游客群体不断增长。", descriptionRu: "Премиальные эко-лоджи и приключенческий туризм на самом глубоком озере мира. Растущий сегмент китайских туристов.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "priority" },
        { id: "irk-2", title: "Baikal Chinese Tourism Services", titleZh: "贝加尔湖中国旅游服务", titleRu: "Туристические услуги для китайцев на Байкале", sector: "Tourism", description: "Hotels, restaurants, and tour services for 200,000+ Chinese visitors annually.", descriptionZh: "为每年20万+中国游客提供酒店、餐厅和旅游服务。", descriptionRu: "Отели, рестораны и туристические услуги для 200 000+ китайских посетителей ежегодно.", investmentRange: "$8M - $60M", timeline: "1-3 years", status: "active" },
        { id: "irk-3", title: "Irkutsk Aviation Hub", titleZh: "伊尔库茨克航空中心", titleRu: "Авиационный хаб Иркутска", sector: "Aviation", description: "Aircraft manufacturing and maintenance. Irkutsk Aircraft Corporation (MC-21 components).", descriptionZh: "飞机制造和维护。伊尔库茨克飞机公司（MC-21零部件）。", descriptionRu: "Производство и обслуживание самолётов. Иркутская авиастроительная корпорация (компоненты МС-21).", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "bratsk", name: "Bratsk", nameRu: "Братск", nameZh: "布拉茨克", population: "0.2M", image: "https://images.unsplash.com/photo-1597473322203-2c4f0e36e1c3?w=1920&q=80", description: "Major industrial city built around one of world's largest hydroelectric dams. Home to RUSAL Bratsk aluminum smelter - world's lowest-cost aluminum.", opportunities: [
        { id: "brt-1", title: "RUSAL Aluminum Partnership", titleZh: "俄铝合作", titleRu: "Партнёрство с РУСАЛ", sector: "Aluminum", description: "World's lowest-cost aluminum production using hydro power. Processing and export.", descriptionZh: "利用水电生产全球成本最低的铝。加工和出口。", descriptionRu: "Производство алюминия с самой низкой себестоимостью в мире на гидроэнергии. Переработка и экспорт.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
        { id: "brt-2", title: "Bratsk Wood Processing", titleZh: "布拉茨克木材加工", titleRu: "Деревообработка Братска", sector: "Forestry", description: "Value-added timber processing. Sustainable forestry for China export.", descriptionZh: "木材深加工。面向中国出口的可持续林业。", descriptionRu: "Деревообработка с добавленной стоимостью. Устойчивое лесопользование для экспорта в Китай.", investmentRange: "$15M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "angarsk", name: "Angarsk", nameRu: "Ангарск", nameZh: "安加尔斯克", population: "0.2M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Petrochemical and nuclear fuel center. Angarsk Petrochemical Company and uranium enrichment facility.", opportunities: [
        { id: "ang-1", title: "Angarsk Petrochemical JV", titleZh: "安加尔斯克石化合资", titleRu: "Нефтехимическое СП Ангарска", sector: "Petrochemicals", description: "Downstream oil processing and specialty chemicals. Integration with East Siberia crude.", descriptionZh: "下游石油加工和特种化学品。与东西伯利亚原油整合。", descriptionRu: "Переработка нефтепродуктов и спецхимия. Интеграция с восточносибирской нефтью.", investmentRange: "$50M - $400M", timeline: "4-6 years", status: "active" }
      ]}
    ],
    overview: "Eastern Siberia gateway to Lake Baikal. Major aluminum (RUSAL Bratsk), hydropower, and forestry. Growing Chinese tourism to Baikal.",
    overviewRu: "Ворота Восточной Сибири к озеру Байкал. Крупное производство алюминия (РУСАЛ Братск), гидроэнергетика и лесопромышленность. Растущий китайский туризм на Байкал.",
    overviewZh: "东西伯利亚通往贝加尔湖的门户。主要铝生产（俄铝布拉茨克）、水电和林业。中国游客赴贝加尔湖旅游不断增长。",
    targetSectors: ["Aluminum", "Hydropower", "Tourism", "Forestry", "Mining"],
    opportunities: [
      { id: "ir-1", title: "Baikal Tourism Development", titleZh: "贝加尔湖旅游开发", titleRu: "Развитие туризма на Байкале", sector: "Tourism", description: "Lake Baikal eco-tourism for Chinese visitors. Hotels and infrastructure.", descriptionZh: "面向中国游客的贝加尔湖生态旅游。酒店和基础设施。", descriptionRu: "Экотуризм на Байкале для китайских туристов. Отели и инфраструктура.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "ir-2", title: "RUSAL Bratsk Partnership", titleZh: "俄铝布拉茨克合作", titleRu: "Партнёрство РУСАЛ Братск", sector: "Aluminum", description: "Aluminum smelting using cheap hydropower.", descriptionZh: "利用廉价水电进行铝冶炼。", descriptionRu: "Выплавка алюминия на дешёвой гидроэнергии.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "ir-p1", name: "Baikal Tourism Infrastructure", nameRu: "Инфраструктура туризма на Байкале", nameZh: "贝加尔湖旅游基础设施", value: "$300 Million", sector: "Tourism", description: "Hotels, roads, and visitor facilities for Lake Baikal.", completionYear: "2028" }
    ],
    advantages: [
      { icon: "infrastructure", title: "Baikal Gateway", titleRu: "Ворота Байкала", titleZh: "贝加尔湖门户", description: "UNESCO World Heritage Lake Baikal. Growing Chinese tourism.", descriptionRu: "Озеро Байкал - объект Всемирного наследия ЮНЕСКО. Растущий китайский туризм.", descriptionZh: "联合国教科文组织世界遗产贝加尔湖。中国游客不断增长。" },
      { icon: "resources", title: "Cheap Energy", titleRu: "Дешёвая энергия", titleZh: "廉价能源", description: "Massive hydropower provides lowest-cost electricity in Russia.", descriptionRu: "Огромные гидроэнергетические мощности обеспечивают самую дешёвую электроэнергию в России.", descriptionZh: "大规模水电提供俄罗斯最廉价的电力。" }
    ],
    contactInfo: { investmentAgency: "Irkutsk Oblast Investment Agency", investmentAgencyRu: "Агентство инвестиций Иркутской области", investmentAgencyZh: "伊尔库茨克州投资局", website: "https://investinirkutsk.ru", email: "info@investinirkutsk.ru" }
  },
  "Voronezh Oblast": { name: "Voronezh Oblast", nameRu: "Воронежская область", nameZh: "沃罗涅日州", gdp: "$20 Billion", population: "2.3 Million", industries: ["Agriculture", "Food Processing", "Electronics", "Aerospace"], industriesRu: ["Сельское хозяйство", "Пищевая промышленность", "Электроника", "Аэрокосмос"], industriesZh: ["农业", "食品加工", "电子产品", "航空航天"], sezCount: 1, taxBenefits: ["Agricultural processing benefits", "Electronics cluster support", "Investment incentives"], taxBenefitsRu: ["Льготы пищевой промышленности", "Поддержка электронного кластера", "Инвестиционные стимулы"], taxBenefitsZh: ["食品加工优惠", "电子集群支持", "投资激励"], majorCities: [{ id: "voronezh", name: "Voronezh", nameRu: "Воронеж", nameZh: "沃罗涅日", population: "1.1M" }, { id: "rossosh", name: "Rossosh", nameRu: "Россошь", nameZh: "罗索什", population: "0.06M" }, { id: "borisoglebsk", name: "Borisoglebsk", nameRu: "Борисоглебск", nameZh: "鲍里索格列布斯克", population: "0.06M" }], overview: "Major agricultural and aerospace region in Central Russia. Aircraft engine manufacturing. Growing electronics and food processing.", overviewRu: "Крупный сельскохозяйственный и аэрокосмический регион Центральной России. Производство авиационных двигателей. Растущие электроника и пищевая промышленность.", overviewZh: "俄罗斯中部主要农业和航空航天地区。飞机发动机制造。电子产品和食品加工业不断增长。", targetSectors: ["Agriculture", "Aerospace", "Electronics", "Food Processing"], opportunities: [{ id: "vr-1", title: "Voronezh Agricultural Processing", titleZh: "沃罗涅日农产品加工", titleRu: "Воронежская сельхозпереработка", sector: "Food", description: "Sugar, grain, and oilseed processing for China export.", descriptionZh: "糖、粮食和油籽加工出口至中国。", descriptionRu: "Переработка сахара, зерна и масличных культур для экспорта в Китай.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "vr-2", title: "Voronezh Aircraft Engines", titleZh: "沃罗涅日飞机发动机", titleRu: "Воронежские авиадвигатели", sector: "Aerospace", description: "Aircraft engine manufacturing and maintenance center.", descriptionZh: "飞机发动机制造和维护中心。", descriptionRu: "Центр производства и обслуживания авиационных двигателей.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" },
      { id: "vr-3", title: "Central Russia Electronics", titleZh: "俄罗斯中部电子", titleRu: "Электроника Центральной России", sector: "Electronics", description: "Electronics and semiconductor assembly.", descriptionZh: "电子和半导体组装。", descriptionRu: "Сборка электроники и полупроводников.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Agricultural Hub", titleRu: "Сельскохозяйственный хаб", titleZh: "农业中心", description: "Major grain and sugar beet production.", descriptionRu: "Крупное производство зерна и сахарной свеклы.", descriptionZh: "主要粮食和甜菜生产。" }], contactInfo: { investmentAgency: "Voronezh Oblast Investment Agency", investmentAgencyRu: "Агентство инвестиций Воронежской области", investmentAgencyZh: "沃罗涅日州投资局", website: "https://investinvoronezh.ru" } },
  "Tyumen Oblast": { name: "Tyumen Oblast", nameZh: "秋明州", nameRu: "Тюменская область", gdp: "$85 Billion", population: "3.8 Million", sezCount: 2, industries: ["Oil & Gas", "Petrochemicals", "Services"], industriesRu: ["Нефть и газ", "Нефтехимия", "Услуги"], industriesZh: ["石油和天然气", "石化产品", "服务业"], taxBenefits: ["10% corporate tax", "Oil field incentives"], taxBenefitsRu: ["10% налог на прибыль", "Льготы нефтяных месторождений"], taxBenefitsZh: ["10%企业所得税", "油田激励"], majorCities: [
    { id: "tyumen-city", name: "Tyumen", nameRu: "Тюмень", nameZh: "秋明", population: "0.8M", image: "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=1920&q=80", description: "Gateway to Western Siberian oil fields. Fastest-growing major city in Russia.", opportunities: [
      { id: "tym-1", title: "Western Siberia Oil Services Hub", titleZh: "西西伯利亚油田服务中心", titleRu: "Хаб нефтесервисных услуг Западной Сибири", sector: "Oil Services", description: "Oilfield services, equipment, and logistics base for Siberian operations.", descriptionZh: "西伯利亚作业的油田服务、设备和物流基地。", descriptionRu: "База нефтесервисных услуг, оборудования и логистики для сибирских операций.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
      { id: "tym-2", title: "Tyumen Technology Park", titleZh: "秋明科技园", titleRu: "Тюменский технопарк", sector: "IT", description: "IT and digital services for oil and gas industry.", descriptionZh: "石油和天然气行业的IT和数字服务。", descriptionRu: "ИТ и цифровые услуги для нефтегазовой отрасли.", investmentRange: "$10M - $80M", timeline: "1-3 years", status: "active" }
    ]}
  ], overview: "Gateway to Russia's richest oil and gas regions. Major logistics and service hub for Western Siberian operations. Headquarters of many Russian oil companies.", overviewRu: "Ворота в богатейшие нефтегазовые регионы России. Крупный логистический и сервисный хаб западносибирских операций. Штаб-квартиры многих российских нефтяных компаний.", overviewZh: "通往俄罗斯最富有的油气地区的门户。西西伯利亚作业的主要物流和服务中心。许多俄罗斯石油公司的总部所在地。", targetSectors: ["Oil & Gas Services", "Petrochemicals", "Logistics", "IT Services"], opportunities: [
    { id: "ty-1", title: "Siberian Oil Services Base", titleZh: "西伯利亚石油服务基地", titleRu: "Сибирская база нефтесервиса", sector: "Energy Services", description: "Equipment and services hub for Western Siberian oil fields.", descriptionZh: "西西伯利亚油田的设备和服务中心。", descriptionRu: "Хаб оборудования и услуг для западносибирских нефтяных месторождений.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
    { id: "ty-2", title: "Tyumen Petrochemical Complex", titleZh: "秋明石化综合体", titleRu: "Тюменский нефтехимический комплекс", sector: "Petrochemicals", description: "Downstream processing of Siberian oil and gas.", descriptionZh: "西伯利亚石油和天然气的下游加工。", descriptionRu: "Переработка сибирской нефти и газа.", investmentRange: "$50M - $500M", timeline: "4-6 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Oil Gateway", titleRu: "Нефтяные ворота", titleZh: "石油门户", description: "Direct access to Western Siberian oil fields.", descriptionRu: "Прямой доступ к западносибирским нефтяным месторождениям.", descriptionZh: "直接进入西西伯利亚油田。" }], contactInfo: { investmentAgency: "Tyumen Oblast Investment Agency", investmentAgencyRu: "Агентство инвестиций Тюменской области", investmentAgencyZh: "秋明州投资局", website: "https://investtyumen.ru" } },
  "Volgograd Oblast": { name: "Volgograd Oblast", nameZh: "伏尔加格勒州", nameRu: "Волгоградская область", gdp: "$15 Billion", population: "2.5 Million", sezCount: 1, industries: ["Machinery", "Steel", "Agriculture", "Petrochemicals"], industriesRu: ["Машиностроение", "Сталь", "Сельское хозяйство", "Нефтехимия"], industriesZh: ["机械", "钢铁", "农业", "石化产品"], taxBenefits: ["SEZ tax incentives", "Agricultural subsidies"], taxBenefitsRu: ["Льготы ОЭЗ", "Сельскохозяйственные субсидии"], taxBenefitsZh: ["特经区税收优惠", "农业补贴"], majorCities: [
    { id: "volgograd-city", name: "Volgograd", nameRu: "Волгоград", nameZh: "伏尔加格勒", population: "1.0M", image: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=1920&q=80", description: "Major industrial city on the Volga River. Historic Stalingrad, now a manufacturing hub.", opportunities: [
      { id: "vlg-1", title: "Volga Industrial Modernization", titleZh: "伏尔加工业现代化", titleRu: "Модернизация волжской промышленности", sector: "Manufacturing", description: "Industry 4.0 upgrades for machinery and steel plants.", descriptionZh: "机械和钢铁厂的工业4.0升级。", descriptionRu: "Модернизация машиностроительных и металлургических заводов по стандартам Индустрии 4.0.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
      { id: "vlg-2", title: "Volga River Logistics Hub", titleZh: "伏尔加河物流枢纽", titleRu: "Волжский логистический хаб", sector: "Logistics", description: "River port and multimodal logistics center.", descriptionZh: "河港和多式联运物流中心。", descriptionRu: "Речной порт и мультимодальный логистический центр.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" }
    ]}
  ], overview: "Major industrial center on the Volga River. Strong machinery, steel, and petrochemical industries. Strategic location connecting European Russia to Kazakhstan and Central Asia.", overviewRu: "Крупный промышленный центр на реке Волга. Сильные машиностроение, сталь и нефтехимия. Стратегическое положение, соединяющее европейскую Россию с Казахстаном и Центральной Азией.", overviewZh: "伏尔加河上的主要工业中心。强大的机械、钢铁和石化产业。战略位置连接欧洲俄罗斯与哈萨克斯坦和中亚。", targetSectors: ["Heavy Machinery", "Steel Processing", "Petrochemicals", "Agriculture"], opportunities: [
    { id: "vg-1", title: "Volgograd Steel Complex", titleZh: "伏尔加格勒钢铁综合体", titleRu: "Волгоградский металлургический комплекс", sector: "Steel", description: "Steel production and pipe manufacturing for pipelines.", descriptionZh: "管道用钢铁生产和管道制造。", descriptionRu: "Производство стали и труб для трубопроводов.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
    { id: "vg-2", title: "Volga Agribusiness Hub", titleZh: "伏尔加农业综合中心", titleRu: "Волжский агропромышленный хаб", sector: "Agriculture", description: "Grain processing and food production for export.", descriptionZh: "粮食加工和食品生产出口。", descriptionRu: "Зернопереработка и производство продуктов питания на экспорт.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Volga Corridor", titleRu: "Волжский коридор", titleZh: "伏尔加走廊", description: "Strategic river and rail connections.", descriptionRu: "Стратегические речные и железнодорожные связи.", descriptionZh: "战略性河流和铁路连接。" }], contactInfo: { investmentAgency: "Volgograd Development Corporation", investmentAgencyRu: "Корпорация развития Волгоградской области", investmentAgencyZh: "伏尔加格勒州发展公司", website: "https://investvolgograd.ru" } },
  "Omsk Oblast": { name: "Omsk Oblast", nameZh: "鄂木斯克州", nameRu: "Омская область", gdp: "$18 Billion", population: "1.9 Million", sezCount: 1, industries: ["Petrochemicals", "Agriculture", "Machinery"], industriesRu: ["Нефтехимия", "Сельское хозяйство", "Машиностроение"], industriesZh: ["石化产品", "农业", "机械"], taxBenefits: ["Industrial park incentives", "Agricultural support"], taxBenefitsRu: ["Льготы индустриальных парков", "Поддержка сельского хозяйства"], taxBenefitsZh: ["工业园区激励", "农业支持"], majorCities: [
    { id: "omsk-city", name: "Omsk", nameRu: "Омск", nameZh: "鄂木斯克", population: "1.2M", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80", description: "Major refining center with Gazprom Neft's largest refinery. Gateway to Kazakhstan.", opportunities: [
      { id: "om-1", title: "Omsk Refinery Modernization", titleZh: "鄂木斯克炼油厂现代化", titleRu: "Модернизация Омского НПЗ", sector: "Oil Refining", description: "Partnership with Gazprom Neft refinery. Modernization and capacity expansion.", descriptionZh: "与俄气石油炼油厂的合作。现代化和产能扩张。", descriptionRu: "Партнёрство с НПЗ Газпром нефти. Модернизация и расширение мощностей.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "om-2", title: "Trans-Siberian Logistics", titleZh: "西伯利亚大铁路物流", titleRu: "Транссибирская логистика", sector: "Logistics", description: "Railway hub on Trans-Siberian route to China.", descriptionZh: "通往中国的西伯利亚大铁路枢纽。", descriptionRu: "Железнодорожный хаб на Транссибирской магистрали в Китай.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Major petrochemical and refining center in Western Siberia. Home to Russia's largest oil refinery. Strategic position on Trans-Siberian Railway and Kazakhstan border.", overviewRu: "Крупный нефтехимический и нефтеперерабатывающий центр Западной Сибири. Дом крупнейшего российского нефтеперерабатывающего завода. Стратегическое положение на Транссибирской магистрали и границе с Казахстаном.", overviewZh: "西西伯利亚主要石化和炼油中心。俄罗斯最大炼油厂所在地。位于西伯利亚大铁路和哈萨克斯坦边境的战略位置。", targetSectors: ["Petrochemicals", "Oil Refining", "Machinery", "Agriculture"], opportunities: [
    { id: "os-1", title: "Gazprom Neft Refinery Partnership", titleZh: "俄气石油炼油厂合作", titleRu: "Партнёрство с НПЗ Газпром нефти", sector: "Refining", description: "Joint venture opportunities at Russia's largest refinery.", descriptionZh: "俄罗斯最大炼油厂的合资机会。", descriptionRu: "Возможности совместных предприятий на крупнейшем российском НПЗ.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "os-2", title: "Siberian Agricultural Processing", titleZh: "西伯利亚农产品加工", titleRu: "Сибирская сельхозпереработка", sector: "Agriculture", description: "Grain and oilseed processing for Asian export.", descriptionZh: "面向亚洲出口的粮食和油籽加工。", descriptionRu: "Переработка зерна и масличных для азиатского экспорта.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Refining Hub", titleRu: "Нефтеперерабатывающий хаб", titleZh: "炼油中心", description: "Russia's largest oil refinery complex.", descriptionRu: "Крупнейший российский нефтеперерабатывающий комплекс.", descriptionZh: "俄罗斯最大的炼油综合体。" }], contactInfo: { investmentAgency: "Omsk Oblast Investment Agency", investmentAgencyRu: "Агентство инвестиций Омской области", investmentAgencyZh: "鄂木斯克州投资局", website: "https://investomsk.ru" } },
  "Kemerovo Oblast": { name: "Kemerovo Oblast", nameZh: "克麦罗沃州", nameRu: "Кемеровская область", gdp: "$22 Billion", population: "2.6 Million", sezCount: 1, industries: ["Coal Mining", "Steel", "Chemicals"], industriesRu: ["Угольная добыча", "Сталь", "Химия"], industriesZh: ["煤炭开采", "钢铁", "化工"], taxBenefits: ["Mining tax incentives", "SEZ benefits"], taxBenefitsRu: ["Льготы горнодобывающей промышленности", "Льготы ОЭЗ"], taxBenefitsZh: ["采矿税收激励", "特经区优惠"], majorCities: [
    { id: "kemerovo-city", name: "Kemerovo", nameRu: "Кемерово", nameZh: "克麦罗沃", population: "0.5M", image: "https://images.unsplash.com/photo-1615729947596-a598e5de0ab3?w=1920&q=80", description: "Capital of Russia's coal mining region. Major center for metallurgical coal production.", opportunities: [
      { id: "kem-1", title: "Kuzbass Coal Partnership", titleZh: "库兹巴斯煤炭合作", titleRu: "Партнёрство по кузбасскому углю", sector: "Coal", description: "Metallurgical coal mining and export to China.", descriptionZh: "冶金煤开采和出口至中国。", descriptionRu: "Добыча и экспорт коксующегося угля в Китай.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "kem-2", title: "Mining Technology Center", titleZh: "采矿技术中心", titleRu: "Центр горных технологий", sector: "Mining Tech", description: "Autonomous mining equipment and safety technology.", descriptionZh: "自主采矿设备和安全技术。", descriptionRu: "Автономное горное оборудование и технологии безопасности.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's largest coal mining region (Kuzbass). Produces 60% of Russia's coal, including metallurgical coal for Chinese steel industry. Major steel and chemical production.", overviewRu: "Крупнейший угольный регион России (Кузбасс). Производит 60% российского угля, включая коксующийся уголь для китайской сталелитейной промышленности. Крупное производство стали и химии.", overviewZh: "俄罗斯最大的煤炭开采地区（库兹巴斯）。生产俄罗斯60%的煤炭，包括中国钢铁工业用的冶金煤。主要钢铁和化工生产。", targetSectors: ["Coal Mining", "Mining Equipment", "Steel", "Chemicals"], opportunities: [
    { id: "ke-1", title: "Kuzbass Coal Export Expansion", titleZh: "库兹巴斯煤炭出口扩张", titleRu: "Расширение экспорта кузбасского угля", sector: "Coal", description: "Coal mining expansion to meet Chinese demand. New rail capacity.", descriptionZh: "扩大煤炭开采以满足中国需求。新增铁路运力。", descriptionRu: "Расширение угледобычи для удовлетворения китайского спроса. Новые железнодорожные мощности.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ke-2", title: "Kuzbass Green Mining Initiative", titleZh: "库兹巴斯绿色采矿倡议", titleRu: "Кузбасская инициатива зелёной добычи", sector: "Mining", description: "Environmental technology and mine reclamation projects.", descriptionZh: "环保技术和矿山复垦项目。", descriptionRu: "Экологические технологии и проекты рекультивации шахт.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Coal Capital", titleRu: "Угольная столица", titleZh: "煤炭之都", description: "60% of Russia's coal production.", descriptionRu: "60% производства угля России.", descriptionZh: "俄罗斯60%的煤炭生产。" }], contactInfo: { investmentAgency: "Kuzbass Development Corporation", investmentAgencyRu: "Корпорация развития Кузбасса", investmentAgencyZh: "库兹巴斯发展公司", website: "https://investkuzbass.ru" } },
  "Murmansk Oblast": { name: "Murmansk Oblast", nameZh: "摩尔曼斯克州", nameRu: "Мурманская область", gdp: "$12 Billion", population: "0.7 Million", sezCount: 1, industries: ["Shipping", "Mining", "Fishing", "LNG"], industriesRu: ["Судоходство", "Горнодобывающая промышленность", "Рыболовство", "СПГ"], industriesZh: ["航运", "采矿", "渔业", "液化天然气"], taxBenefits: ["Arctic zone benefits", "Port incentives"], taxBenefitsRu: ["Арктические зональные льготы", "Портовые стимулы"], taxBenefitsZh: ["北极地区优惠", "港口激励"], majorCities: [
    { id: "murmansk-city", name: "Murmansk", nameRu: "Мурманск", nameZh: "摩尔曼斯克", population: "0.3M", image: "https://images.unsplash.com/photo-1610472384533-2dc6d9a0c7e8?w=1920&q=80", description: "Russia's largest Arctic city. Ice-free port and gateway for Northern Sea Route.", opportunities: [
      { id: "mur-1", title: "Northern Sea Route Hub", titleZh: "北方海航线枢纽", titleRu: "Хаб Северного морского пути", sector: "Shipping", description: "Arctic shipping terminal and icebreaker support services.", descriptionZh: "北极航运码头和破冰船支持服务。", descriptionRu: "Арктический судоходный терминал и услуги ледокольной поддержки.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "mur-2", title: "Arctic LNG Transshipment", titleZh: "北极LNG转运", titleRu: "Перевалка арктического СПГ", sector: "LNG", description: "LNG transshipment from Yamal and Arctic projects to Asia.", descriptionZh: "从亚马尔和北极项目向亚洲转运LNG。", descriptionRu: "Перевалка СПГ из Ямала и арктических проектов в Азию.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" }
    ]}
  ], overview: "Strategic Arctic gateway and Northern Sea Route hub. Russia's largest ice-free Arctic port. Growing importance for LNG transshipment and China shipping route.", overviewRu: "Стратегические арктические ворота и хаб Северного морского пути. Крупнейший ледоходный арктический порт России. Растущее значение для перевалки СПГ и китайского судоходного маршрута.", overviewZh: "战略性北极门户和北方海航线枢纽。俄罗斯最大的不冻北极港口。对液化天然气转运和中国航运路线的重要性日益增加。", targetSectors: ["Arctic Shipping", "LNG", "Mining", "Fisheries"], opportunities: [
    { id: "mu-1", title: "Northern Sea Route Infrastructure", titleZh: "北方海航线基础设施", titleRu: "Инфраструктура Севморпути", sector: "Shipping", description: "Port and logistics infrastructure for Asia-Europe Arctic route.", descriptionZh: "亚欧北极航线的港口和物流基础设施。", descriptionRu: "Портовая и логистическая инфраструктура для арктического маршрута Азия-Европа.", investmentRange: "$50M - $500M", timeline: "4-6 years", status: "priority" },
    { id: "mu-2", title: "Kola Mining Partnership", titleZh: "科拉半岛采矿合作", titleRu: "Кольское горнодобывающее партнёрство", sector: "Mining", description: "Rare earth and phosphate mining on Kola Peninsula.", descriptionZh: "科拉半岛的稀土和磷酸盐开采。", descriptionRu: "Добыча редкоземельных элементов и фосфатов на Кольском полуострове.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Arctic Gateway", titleRu: "Арктические ворота", titleZh: "北极门户", description: "Ice-free port and Northern Sea Route access.", descriptionRu: "Ледоходный порт и доступ к Северному морскому пути.", descriptionZh: "不冻港和北方海航线通道。" }], contactInfo: { investmentAgency: "Murmansk Arctic Development Agency", investmentAgencyRu: "Агентство развития Арктики Мурманской области", investmentAgencyZh: "摩尔曼斯克州北极发展局", website: "https://investmurmansk.ru" } },
  "Arkhangelsk Oblast": { name: "Arkhangelsk Oblast", nameZh: "阿尔汉格尔斯克州", nameRu: "Архангельская область", gdp: "$10 Billion", population: "1.1 Million", sezCount: 1, industries: ["Forestry", "Shipbuilding", "Diamonds"], industriesRu: ["Лесное хозяйство", "Судостроение", "Алмазы"], industriesZh: ["林业", "造船", "钻石"], taxBenefits: ["Arctic zone benefits", "Forestry incentives"], taxBenefitsRu: ["Арктические зональные льготы", "Лесные стимулы"], taxBenefitsZh: ["北极地区优惠", "林业激励"], majorCities: [
    { id: "arkhangelsk-city", name: "Arkhangelsk", nameRu: "Архангельск", nameZh: "阿尔汉格尔斯克", population: "0.4M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Historic White Sea port. Major center for timber export and shipbuilding.", opportunities: [
      { id: "ark-1", title: "Russian Timber Export Hub", titleZh: "俄罗斯木材出口中心", titleRu: "Хаб экспорта российской древесины", sector: "Forestry", description: "Timber processing and export to China.", descriptionZh: "木材加工和出口至中国。", descriptionRu: "Переработка и экспорт древесины в Китай.", investmentRange: "$15M - $150M", timeline: "2-4 years", status: "active" },
      { id: "ark-2", title: "Sevmash Shipyard Partnership", titleZh: "北方机械造船厂合作", titleRu: "Партнёрство с Севмашем", sector: "Shipbuilding", description: "Civilian shipbuilding and Arctic vessel construction.", descriptionZh: "民用造船和北极船舶建造。", descriptionRu: "Гражданское судостроение и строительство арктических судов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Major timber and forestry center. Home to Sevmash shipyard and diamond mining operations. Growing role in Arctic development and Northern Sea Route.", overviewRu: "Крупный центр лесного хозяйства и деревообработки. Дом судостроительного завода Севмаш и алмазодобывающих операций. Растущая роль в развитии Арктики и Северном морском пути.", overviewZh: "主要的木材和林业中心。北方机械造船厂和钻石采矿业务的所在地。在北极发展和北方海航线中的作用日益增加。", targetSectors: ["Forestry", "Shipbuilding", "Diamonds", "Arctic Development"], opportunities: [
    { id: "ar-1", title: "Arkhangelsk Forestry Complex", titleZh: "阿尔汉格尔斯克林业综合体", titleRu: "Архангельский лесопромышленный комплекс", sector: "Forestry", description: "Sustainable forestry and wood processing for China market.", descriptionZh: "面向中国市场的可持续林业和木材加工。", descriptionRu: "Устойчивое лесопользование и деревообработка для китайского рынка.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "ar-2", title: "Lomonosov Diamond Mine", titleZh: "罗蒙诺索夫钻石矿", titleRu: "Алмазный рудник Ломоносова", sector: "Mining", description: "Diamond mining partnership with ALROSA.", descriptionZh: "与埃罗莎的钻石开采合作。", descriptionRu: "Партнёрство по добыче алмазов с АЛРОСА.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Forest Resources", titleRu: "Лесные ресурсы", titleZh: "森林资源", description: "Vast timber reserves and sustainable forestry.", descriptionRu: "Обширные запасы древесины и устойчивое лесопользование.", descriptionZh: "广阔的木材储备和可持续林业。" }], contactInfo: { investmentAgency: "Arkhangelsk Investment Agency", investmentAgencyRu: "Архангельское инвестиционное агентство", investmentAgencyZh: "阿尔汉格尔斯克投资局", website: "https://investarkhangelsk.ru" } },
  "Republic of Karelia": { name: "Republic of Karelia", nameZh: "卡累利阿共和国", nameRu: "Республика Карелия", gdp: "$6 Billion", population: "0.6 Million", sezCount: 1, industries: ["Forestry", "Mining", "Tourism"], industriesRu: ["Лесное хозяйство", "Горнодобывающая промышленность", "Туризм"], industriesZh: ["林业", "采矿", "旅游"], taxBenefits: ["Regional tax incentives", "Tourism development support"], taxBenefitsRu: ["Региональные налоговые льготы", "Поддержка развития туризма"], taxBenefitsZh: ["地区税收优惠", "旅游发展支持"], majorCities: [
    { id: "petrozavodsk", name: "Petrozavodsk", nameRu: "Петрозаводск", nameZh: "彼得罗扎沃茨克", population: "0.3M", image: "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=1920&q=80", description: "Capital of Karelia. Gateway to pristine lakes and forests.", opportunities: [
      { id: "pet-1", title: "Karelian Forestry Development", titleZh: "卡累利阿林业发展", titleRu: "Развитие карельского лесопромышленного комплекса", sector: "Forestry", description: "Sustainable timber harvesting and processing.", descriptionZh: "可持续木材采伐和加工。", descriptionRu: "Устойчивая заготовка и переработка древесины.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
      { id: "pet-2", title: "Karelia Eco-Tourism", titleZh: "卡累利阿生态旅游", titleRu: "Карельский экотуризм", sector: "Tourism", description: "Eco-tourism development near Finnish border.", descriptionZh: "芬兰边境附近的生态旅游开发。", descriptionRu: "Развитие экотуризма у финской границы.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Scenic region bordering Finland with vast forests and lakes. Major forestry and mining industry. Growing eco-tourism destination.", overviewRu: "Живописный регион, граничащий с Финляндией, с обширными лесами и озёрами. Крупная лесная и горнодобывающая промышленность. Растущее направление экотуризма.", overviewZh: "与芬兰接壤的风景秀丽地区，拥有广阔的森林和湖泊。主要的林业和采矿业。生态旅游目的地不断增长。", targetSectors: ["Forestry", "Mining", "Tourism", "IT"], opportunities: [
    { id: "ka-1", title: "Karelian Forest Products", titleZh: "卡累利阿林产品", titleRu: "Карельские лесопродукты", sector: "Forestry", description: "Wood pellets, lumber, and paper products.", descriptionZh: "木屑颗粒、木材和纸制品。", descriptionRu: "Древесные пеллеты, пиломатериалы и бумажная продукция.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
    { id: "ka-2", title: "Karelia Mining Development", titleZh: "卡累利阿采矿开发", titleRu: "Развитие горнодобычи Карелии", sector: "Mining", description: "Granite, crusite, and industrial minerals.", descriptionZh: "花岗岩、碎石和工业矿物。", descriptionRu: "Гранит, щебень и промышленные минералы.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "EU Border", titleRu: "Граница ЕС", titleZh: "欧盟边界", description: "Direct access to Finnish and EU markets.", descriptionRu: "Прямой доступ к финским и европейским рынкам.", descriptionZh: "直接进入芬兰和欧盟市场。" }], contactInfo: { investmentAgency: "Karelia Investment Agency", investmentAgencyRu: "Карельское инвестиционное агентство", investmentAgencyZh: "卡累利阿投资局", website: "https://investkarelia.ru" } },
  "Sakha (Yakutia)": { name: "Sakha (Yakutia)", nameZh: "萨哈（雅库特）共和国", nameRu: "Республика Саха (Якутия)", gdp: "$25 Billion", population: "1.0 Million", sezCount: 2, industries: ["Diamonds", "Gold", "Coal", "Oil & Gas"], industriesRu: ["Алмазы", "Золото", "Уголь", "Нефть и газ"], industriesZh: ["钻石", "黄金", "煤炭", "石油和天然气"], taxBenefits: ["Arctic zone benefits", "Mining incentives", "Far East development support"], taxBenefitsRu: ["Арктические зональные льготы", "Горнодобывающие стимулы", "Поддержка развития Дальнего Востока"], taxBenefitsZh: ["北极地区优惠", "采矿激励", "远东发展支持"], majorCities: [
    { id: "yakutsk", name: "Yakutsk", nameRu: "Якутск", nameZh: "雅库茨克", population: "0.3M", image: "https://images.unsplash.com/photo-1548625361-1c64bc0e3b74?w=1920&q=80", description: "World's coldest major city. Gateway to diamond and gold mining regions.", opportunities: [
      { id: "yak-1", title: "ALROSA Diamond Partnership", titleZh: "埃罗莎钻石合作", titleRu: "Партнёрство с АЛРОСА", sector: "Diamonds", description: "Diamond mining and processing. World's largest diamond producer.", descriptionZh: "钻石开采和加工。世界最大钻石生产商。", descriptionRu: "Добыча и обработка алмазов. Крупнейший производитель алмазов в мире.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "yak-2", title: "Polyus Gold Partnership", titleZh: "波柳斯黄金合作", titleRu: "Партнёрство с Полюсом", sector: "Gold", description: "Gold mining expansion. One of world's lowest-cost producers.", descriptionZh: "黄金开采扩张。全球成本最低的生产商之一。", descriptionRu: "Расширение добычи золота. Один из производителей с самой низкой себестоимостью.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" }
    ]}
  ], overview: "Largest region in Russia, rich in diamonds, gold, and rare earths. Home to ALROSA (27% of world diamond production). Strategic Arctic development zone.", overviewRu: "Крупнейший регион России, богатый алмазами, золотом и редкоземельными элементами. Дом АЛРОСА (27% мирового производства алмазов). Стратегическая зона развития Арктики.", overviewZh: "俄罗斯最大的地区，富含钻石、黄金和稀土元素。埃罗莎的所在地（占全球钻石产量的27%）。战略性北极发展区。", targetSectors: ["Diamond Mining", "Gold Mining", "Coal", "Arctic Development"], opportunities: [
    { id: "yk-1", title: "ALROSA Diamond Mining Expansion", titleZh: "埃罗莎钻石开采扩张", titleRu: "Расширение алмазодобычи АЛРОСА", sector: "Diamonds", description: "Partnership with world's largest diamond producer. 27% of global production.", descriptionZh: "与世界最大钻石生产商合作。占全球产量27%。", descriptionRu: "Партнёрство с крупнейшим производителем алмазов в мире. 27% мирового производства.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "yk-2", title: "Yakutia Coal Export to China", titleZh: "雅库特煤炭出口至中国", titleRu: "Экспорт якутского угля в Китай", sector: "Coal", description: "High-quality coking coal for Chinese steel industry.", descriptionZh: "中国钢铁行业的高质量焦煤。", descriptionRu: "Высококачественный коксующийся уголь для китайской металлургии.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
    { id: "yk-3", title: "Rare Earth Mining Development", titleZh: "稀土开采开发", titleRu: "Развитие добычи редкоземельных металлов", sector: "Mining", description: "Strategic rare earth element deposits. Alternative to Chinese supply.", descriptionZh: "战略稀土元素矿床。中国供应的替代来源。", descriptionRu: "Стратегические месторождения редкоземельных элементов. Альтернатива китайским поставкам.", investmentRange: "$40M - $400M", timeline: "4-6 years", status: "upcoming" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Diamond Capital", titleRu: "Столица алмазов", titleZh: "钻石之都", description: "27% of world diamond production.", descriptionRu: "27% мирового производства алмазов.", descriptionZh: "占全球钻石产量的27%。" }], contactInfo: { investmentAgency: "Yakutia Investment Agency", investmentAgencyRu: "Якутское инвестиционное агентство", investmentAgencyZh: "雅库特投资局", website: "https://investyakutia.ru" } },
  "Yamalo-Nenets": { name: "Yamalo-Nenets", nameZh: "亚马尔-涅涅茨自治区", nameRu: "Ямало-Ненецкий автономный округ", gdp: "$65 Billion", population: "0.5 Million", sezCount: 1, industries: ["Natural Gas", "LNG", "Oil"], industriesRu: ["Природный газ", "СПГ", "Нефть"], industriesZh: ["天然气", "液化天然气", "石油"], taxBenefits: ["Arctic zone benefits", "LNG incentives", "Energy sector support"], taxBenefitsRu: ["Арктические зональные льготы", "СПГ стимулы", "Поддержка энергетического сектора"], taxBenefitsZh: ["北极地区优惠", "液化天然气激励", "能源部门支持"], majorCities: [
    { id: "salekhard", name: "Salekhard", nameRu: "Салехард", nameZh: "萨列哈尔德", population: "0.05M", image: "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?w=1920&q=80", description: "Only city in the world on the Arctic Circle. Gateway to Yamal gas fields.", opportunities: [
      { id: "sal-1", title: "Yamal LNG Phase 2", titleZh: "亚马尔LNG二期", titleRu: "Ямал СПГ Фаза 2", sector: "LNG", description: "LNG production expansion. Major Chinese investment target.", descriptionZh: "LNG生产扩张。主要的中国投资目标。", descriptionRu: "Расширение производства СПГ. Крупнейший объект китайских инвестиций.", investmentRange: "$100M - $1B", timeline: "5-7 years", status: "priority" },
      { id: "sal-2", title: "Arctic Gas Processing", titleZh: "北极天然气加工", titleRu: "Арктическая газопереработка", sector: "Gas Processing", description: "Natural gas processing and condensate production.", descriptionZh: "天然气加工和凝析油生产。", descriptionRu: "Переработка природного газа и производство конденсата.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Russia's gas capital. Produces 80% of Russian natural gas. Home to Yamal LNG - one of world's largest LNG projects with major Chinese investment (CNPC, Silk Road Fund).", overviewRu: "Газовая столица России. Производит 80% российского природного газа. Дом Ямал СПГ — одного из крупнейших проектов СПГ в мире с крупными китайскими инвестициями (CNPC, Фонд Шёлкового пути).", overviewZh: "俄罗斯的天然气之都。生产俄罗斯80%的天然气。亚马尔液化天然气的所在地——世界上最大的液化天然气项目之一，拥有大量中国投资（中国石油、丝路基金）。", targetSectors: ["Natural Gas", "LNG", "Oil", "Arctic Services"], opportunities: [
    { id: "yn-1", title: "Yamal LNG Expansion", titleZh: "亚马尔LNG扩张", titleRu: "Расширение Ямал СПГ", sector: "LNG", description: "Additional LNG trains at Yamal and Arctic LNG 2 projects. Chinese financing available.", descriptionZh: "亚马尔和北极LNG 2项目的额外LNG生产线。可获得中国融资。", descriptionRu: "Дополнительные линии СПГ на проектах Ямал и Арктик СПГ 2. Доступно китайское финансирование.", investmentRange: "$200M - $2B", timeline: "5-10 years", status: "priority" },
    { id: "yn-2", title: "Power of Siberia 2 Support", titleZh: "西伯利亚力量2号管道支持", titleRu: "Поддержка Силы Сибири 2", sector: "Pipeline", description: "Infrastructure for Power of Siberia 2 gas pipeline to China.", descriptionZh: "通往中国的西伯利亚力量2号天然气管道基础设施。", descriptionRu: "Инфраструктура газопровода Сила Сибири 2 в Китай.", investmentRange: "$50M - $500M", timeline: "4-6 years", status: "upcoming" },
    { id: "yn-3", title: "Arctic Shipping & Logistics", titleZh: "北极航运和物流", titleRu: "Арктическое судоходство и логистика", sector: "Logistics", description: "Ice-class tanker operations and port services.", descriptionZh: "冰级油轮运营和港口服务。", descriptionRu: "Операции ледового класса танкеров и портовые услуги.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Gas Capital", titleRu: "Газовая столица", titleZh: "天然气之都", description: "80% of Russian natural gas production.", descriptionRu: "80% производства российского природного газа.", descriptionZh: "占俄罗斯天然气产量的80%。" }], contactInfo: { investmentAgency: "Yamal Development Corporation", investmentAgencyRu: "Корпорация развития Ямала", investmentAgencyZh: "亚马尔发展公司", website: "https://investyamal.ru" } },
  "Republic of Dagestan": { name: "Republic of Dagestan", nameZh: "达吉斯坦共和国", nameRu: "Республика Дагестан", gdp: "$12 Billion", population: "3.1 Million", sezCount: 1, industries: ["Agriculture", "Oil & Gas", "Tourism", "Manufacturing"], industriesRu: ["Сельское хозяйство", "Нефть и газ", "Туризм", "Производство"], industriesZh: ["农业", "石油和天然气", "旅游", "制造业"], taxBenefits: ["North Caucasus incentives", "SEZ benefits"], taxBenefitsRu: ["Льготы Северного Кавказа", "Льготы СЭЗ"], taxBenefitsZh: ["北高加索激励", "经济特区优惠"], majorCities: [
    { id: "makhachkala", name: "Makhachkala", nameRu: "Махачкала", nameZh: "马哈奇卡拉", population: "0.6M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Capital on the Caspian Sea. Major port for Caspian trade.", opportunities: [
      { id: "mak-1", title: "Caspian Port Development", titleZh: "里海港口开发", titleRu: "Развитие каспийского порта", sector: "Port", description: "Port infrastructure for North-South Transport Corridor.", descriptionZh: "南北运输走廊的港口基础设施。", descriptionRu: "Портовая инфраструктура для международного транспортного коридора Север-Юг.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "priority" },
      { id: "mak-2", title: "Dagestan Agriculture Hub", titleZh: "达吉斯坦农业中心", titleRu: "Дагестанский агрохаб", sector: "Agriculture", description: "Fruit, vegetable, and wine production for Russian and export markets.", descriptionZh: "面向俄罗斯和出口市场的水果、蔬菜和葡萄酒生产。", descriptionRu: "Производство фруктов, овощей и вина для российского и экспортного рынков.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Southernmost region of Russia on the Caspian Sea. Key node on North-South Transport Corridor (Russia-Iran-India). Growing tourism and agricultural potential.", overviewRu: "Самый южный регион России на Каспийском море. Ключевой узел международного транспортного коридора Север-Юг (Россия-Иран-Индия). Растущий потенциал туризма и сельского хозяйства.", overviewZh: "俄罗斯最南端的里海地区。北-南运输走廊（俄罗斯-伊朗-印度）的关键节点。旅游和农业潜力不断增长。", targetSectors: ["Port & Logistics", "Agriculture", "Tourism", "Manufacturing"], opportunities: [
    { id: "dg-1", title: "North-South Corridor Hub", titleZh: "南北走廊枢纽", titleRu: "Хаб коридора Север-Юг", sector: "Logistics", description: "Transit hub for Russia-Iran-India trade corridor.", descriptionZh: "俄罗斯-伊朗-印度贸易走廊的中转枢纽。", descriptionRu: "Транзитный хаб торгового коридора Россия-Иран-Индия.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "dg-2", title: "Caspian Sea Tourism", titleZh: "里海旅游", titleRu: "Каспийский туризм", sector: "Tourism", description: "Beach resorts and cultural tourism development.", descriptionZh: "海滩度假村和文化旅游开发。", descriptionRu: "Развитие пляжных курортов и культурного туризма.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caspian Gateway", titleRu: "Каспийские ворота", titleZh: "里海门户", description: "Key port on North-South corridor.", descriptionRu: "Ключевой порт на коридоре Север-Юг.", descriptionZh: "北-南走廊上的关键港口。" }], contactInfo: { investmentAgency: "Dagestan Investment Agency", investmentAgencyRu: "Агентство инвестиций Дагестана", investmentAgencyZh: "达吉斯坦投资局", website: "https://investdagestan.ru" } },
  "Tula Oblast": { name: "Tula Oblast", nameZh: "图拉州", nameRu: "Тульская область", gdp: "$14 Billion", population: "1.5 Million", sezCount: 2, industries: ["Chemicals", "Machinery", "Food", "Defense"], industriesRu: ["Химикаты", "Машиностроение", "Пищевая промышленность", "Оборона"], industriesZh: ["化工", "机械", "食品", "国防"], taxBenefits: ["SEZ benefits", "Manufacturing incentives"], taxBenefitsRu: ["Льготы СЭЗ", "Льготы производства"], taxBenefitsZh: ["经济特区优惠", "制造业激励"], majorCities: [
    { id: "tula-city", name: "Tula", nameRu: "Тула", nameZh: "图拉", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Historic arms manufacturing center. Now diversifying into chemicals and food.", opportunities: [
      { id: "tul-1", title: "Tula Chemical Complex", titleZh: "图拉化工综合体", titleRu: "Тульский химический комплекс", sector: "Chemicals", description: "Fertilizer and specialty chemical production.", descriptionZh: "化肥和特种化学品生产。", descriptionRu: "Производство удобрений и специализированных химикатов.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" },
      { id: "tul-2", title: "Central Russia Food Hub", titleZh: "俄罗斯中部食品中心", titleRu: "Продовольственный хаб Центральной России", sector: "Food", description: "Food processing for Moscow metropolitan market.", descriptionZh: "面向莫斯科都市圈的食品加工。", descriptionRu: "Пищевая переработка для московского столичного рынка.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "priority" }
    ]}
  ], overview: "Industrial region south of Moscow. Strong chemicals and food processing industries. Strategic location for Moscow market access.", overviewRu: "Промышленный регион к югу от Москвы. Сильные химическая и пищевая промышленность. Стратегическое расположение для доступа на московский рынок.", overviewZh: "莫斯科南部的工业区。化工和食品加工产业强劲。战略位置便于进入莫斯科市场。", targetSectors: ["Chemicals", "Food Processing", "Manufacturing", "Logistics"], opportunities: [
    { id: "tu-1", title: "Haval Auto Plant Expansion", titleZh: "哈弗汽车厂扩建", titleRu: "Расширение завода Haval", sector: "Automotive", description: "Chinese Great Wall Motors (Haval) plant expansion.", descriptionZh: "中国长城汽车（哈弗）工厂扩建。", descriptionRu: "Расширение завода китайской компании Great Wall Motors (Haval).", investmentRange: "$50M - $400M", timeline: "2-4 years", status: "priority" },
    { id: "tu-2", title: "Tula Agro-Processing Zone", titleZh: "图拉农产品加工区", titleRu: "Тульская агропромышленная зона", sector: "Food", description: "Food processing cluster for central Russia.", descriptionZh: "俄罗斯中部食品加工集群。", descriptionRu: "Кластер пищевой переработки для центральной России.", investmentRange: "$20M - $150M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Moscow Proximity", titleRu: "Близость к Москве", titleZh: "靠近莫斯科", description: "2 hours from Moscow - easy market access.", descriptionRu: "2 часа от Москвы - легкий доступ на рынок.", descriptionZh: "距莫斯科2小时 - 便利的市场准入。" }], contactInfo: { investmentAgency: "Tula Development Corporation", investmentAgencyRu: "Корпорация развития Тулы", investmentAgencyZh: "图拉发展公司", website: "https://investtula.ru" } },
  "Belgorod Oblast": { name: "Belgorod Oblast", nameZh: "别尔哥罗德州", nameRu: "Белгородская область", gdp: "$13 Billion", population: "1.5 Million", sezCount: 1, industries: ["Iron Ore", "Steel", "Agriculture", "Food"], industriesRu: ["Железная руда", "Сталь", "Сельское хозяйство", "Пищевая промышленность"], industriesZh: ["铁矿石", "钢铁", "农业", "食品"], taxBenefits: ["Mining incentives", "Agricultural support"], taxBenefitsRu: ["Льготы горнодобычи", "Поддержка сельского хозяйства"], taxBenefitsZh: ["采矿激励", "农业支持"], majorCities: [
    { id: "belgorod-city", name: "Belgorod", nameRu: "Белгород", nameZh: "别尔哥罗德", population: "0.4M", image: "https://images.unsplash.com/photo-1598881034666-c6e2b35d07fa?w=1920&q=80", description: "Center of Russia's iron ore belt. Major steel and agricultural region.", opportunities: [
      { id: "blg-1", title: "Iron Ore Mining Partnership", titleZh: "铁矿石开采合作", titleRu: "Партнёрство по добыче железной руды", sector: "Mining", description: "Partnership with Metalloinvest - Russia's largest iron ore producer.", descriptionZh: "与俄罗斯最大铁矿石生产商Metalloinvest的合作。", descriptionRu: "Партнёрство с Металлоинвестом — крупнейшим производителем железной руды в России.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "blg-2", title: "Belgorod Agro Complex", titleZh: "别尔哥罗德农业综合体", titleRu: "Белгородский агрокомплекс", sector: "Agriculture", description: "Pork and poultry production - Russia's leading region.", descriptionZh: "猪肉和家禽生产——俄罗斯领先地区。", descriptionRu: "Производство свинины и птицы — ведущий регион России.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Center of Russia's iron ore mining industry. Home to Metalloinvest and major steel production. Also Russia's leading pork and poultry region.", overviewRu: "Центр железорудной промышленности России. Дом Металлоинвеста и крупного стального производства. Также ведущий регион России по производству свинины и птицы.", overviewZh: "俄罗斯铁矿石开采产业中心。Metalloinvest和主要钢铁生产的所在地。也是俄罗斯领先的猪肉和家禽生产地区。", targetSectors: ["Iron Ore Mining", "Steel", "Agriculture", "Food Processing"], opportunities: [
    { id: "bg-1", title: "Metalloinvest Partnership", titleZh: "Metalloinvest合作", titleRu: "Партнёрство с Металлоинвестом", sector: "Mining", description: "Iron ore and HBI production. World's largest merchant HBI producer.", descriptionZh: "铁矿石和热压块铁生产。全球最大的商品热压块铁生产商。", descriptionRu: "Производство железной руды и ГБЖ. Крупнейший в мире производитель товарного ГБЖ.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "bg-2", title: "Agro-Industrial Export Hub", titleZh: "农工出口中心", titleRu: "Агропромышленный экспортный хаб", sector: "Agriculture", description: "Meat processing and export to China and Asia.", descriptionZh: "肉类加工和出口至中国和亚洲。", descriptionRu: "Переработка и экспорт мяса в Китай и Азию.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Iron Ore Belt", titleRu: "Железорудный пояс", titleZh: "铁矿石带", description: "Russia's richest iron ore deposits.", descriptionRu: "Самые богатые запасы железной руды в России.", descriptionZh: "俄罗斯最丰富的铁矿石储备。" }], contactInfo: { investmentAgency: "Belgorod Investment Agency", investmentAgencyRu: "Агентство инвестиций Белгорода", investmentAgencyZh: "别尔哥罗德投资局", website: "https://investbelgorod.ru" } },
  "Khanty-Mansi Autonomous Okrug": { name: "Khanty-Mansi Autonomous Okrug", nameZh: "汉特-曼西自治区", nameRu: "Ханты-Мансийский автономный округ", gdp: "$95 Billion", population: "1.7 Million", sezCount: 2, industries: ["Oil & Gas", "Energy", "Petrochemicals"], industriesRu: ["Нефть и газ", "Энергетика", "Нефтехимия"], industriesZh: ["石油和天然气", "能源", "石油化工"], taxBenefits: ["Oil industry incentives", "Northern benefits"], taxBenefitsRu: ["Льготы нефтяной промышленности", "Северные льготы"], taxBenefitsZh: ["石油产业激励", "北方优惠"], majorCities: [
    { id: "surgut", name: "Surgut", nameRu: "Сургут", nameZh: "苏尔古特", population: "0.4M", image: "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=1920&q=80", description: "Oil capital of Russia. Headquarters of Surgutneftegas.", opportunities: [
      { id: "sur-1", title: "Surgutneftegas Partnership", titleZh: "苏尔古特石油天然气合作", titleRu: "Партнёрство с Сургутнефтегазом", sector: "Oil", description: "Partnership with Russia's 4th largest oil company.", descriptionZh: "与俄罗斯第四大石油公司的合作。", descriptionRu: "Партнёрство с 4-й крупнейшей нефтяной компанией России.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "sur-2", title: "Siberian Oil Services", titleZh: "西伯利亚石油服务", titleRu: "Сибирские нефтесервисные услуги", sector: "Oil Services", description: "Oilfield services and equipment.", descriptionZh: "油田服务和设备。", descriptionRu: "Нефтесервисные услуги и оборудование.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's oil heartland producing 50% of Russian oil. Home to Surgutneftegas, Rosneft, and Lukoil operations. Highest per-capita GDP in Russia.", overviewRu: "Нефтяное сердце России, производящее 50% российской нефти. Дом Сургутнефтегаза, Роснефти и операций Лукойла. Самый высокий ВВП на душу населения в России.", overviewZh: "俄罗斯石油中心，生产俄罗斯50%的石油。Surgutneftegas、Rosneft和Lukoil运营的所在地。俄罗斯人均GDP最高。", targetSectors: ["Oil Production", "Oil Services", "Petrochemicals", "Energy"], opportunities: [
    { id: "khm-1", title: "West Siberian Oil Partnership", titleZh: "西西伯利亚石油合作", titleRu: "Западносибирское нефтяное партнёрство", sector: "Oil", description: "50% of Russia's oil production. Multiple partnership opportunities.", descriptionZh: "俄罗斯50%的石油产量。多种合作机会。", descriptionRu: "50% нефтедобычи России. Множество возможностей для партнёрства.", investmentRange: "$100M - $1B", timeline: "3-5 years", status: "priority" },
    { id: "khm-2", title: "Yugra Digital Oilfield", titleZh: "尤格拉数字油田", titleRu: "Цифровое месторождение Югры", sector: "Technology", description: "Digital transformation of oil operations.", descriptionZh: "石油作业的数字化转型。", descriptionRu: "Цифровая трансформация нефтяных операций.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Oil Capital", titleRu: "Нефтяная столица", titleZh: "石油之都", description: "50% of Russian oil production.", descriptionRu: "50% нефтедобычи России.", descriptionZh: "俄罗斯50%的石油产量。" }], contactInfo: { investmentAgency: "Yugra Investment Agency", investmentAgencyRu: "Агентство инвестиций Югры", investmentAgencyZh: "尤格拉投资局", website: "https://investugra.ru" } },
  "Stavropol Krai": { name: "Stavropol Krai", nameZh: "斯塔夫罗波尔边疆区", nameRu: "Ставропольский край", gdp: "$15 Billion", population: "2.8 Million", sezCount: 1, industries: ["Agriculture", "Tourism", "Chemicals"], industriesRu: ["Сельское хозяйство", "Туризм", "Химикаты"], industriesZh: ["农业", "旅游", "化工"], taxBenefits: ["Agricultural subsidies", "Spa tourism incentives"], taxBenefitsRu: ["Сельскохозяйственные субсидии", "Льготы спа-туризма"], taxBenefitsZh: ["农业补贴", "温泉旅游激励"], majorCities: [
    { id: "stavropol", name: "Stavropol", nameRu: "Ставрополь", nameZh: "斯塔夫罗波尔", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Agricultural center of southern Russia. Gateway to Caucasus spa resorts.", opportunities: [
      { id: "stv-1", title: "Stavropol Agro Complex", titleZh: "斯塔夫罗波尔农业综合体", titleRu: "Ставропольский агрокомплекс", sector: "Agriculture", description: "Grain and livestock production for export.", descriptionZh: "出口用粮食和畜牧生产。", descriptionRu: "Производство зерна и животноводство на экспорт.", investmentRange: "$15M - $150M", timeline: "2-4 years", status: "active" },
      { id: "stv-2", title: "Caucasus Mineral Water Resorts", titleZh: "高加索矿泉水度假村", titleRu: "Курорты Кавказских Минеральных Вод", sector: "Tourism", description: "Spa and wellness tourism development.", descriptionZh: "水疗和健康旅游开发。", descriptionRu: "Развитие спа и оздоровительного туризма.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" }
    ]}
  ], overview: "Major agricultural region and home to famous Caucasus Mineral Waters spa resorts. Growing tourism industry.", overviewRu: "Крупный сельскохозяйственный регион и дом знаменитых курортов Кавказских Минеральных Вод. Растущая туристическая индустрия.", overviewZh: "主要农业地区，是著名的高加索矿泉水温泉度假村的所在地。旅游业不断增长。", targetSectors: ["Agriculture", "Spa Tourism", "Food Processing", "Chemicals"], opportunities: [
    { id: "sk-1", title: "Caucasus Mineral Waters Development", titleZh: "高加索矿泉水开发", titleRu: "Развитие Кавказских Минеральных Вод", sector: "Tourism", description: "Historic spa resort region modernization.", descriptionZh: "历史悠久的温泉度假区现代化。", descriptionRu: "Модернизация исторического курортного региона.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "priority" },
    { id: "sk-2", title: "Stavropol Grain Export Hub", titleZh: "斯塔夫罗波尔粮食出口中心", titleRu: "Ставропольский зерновой экспортный хаб", sector: "Agriculture", description: "Grain processing and export to Middle East and Asia.", descriptionZh: "面向中东和亚洲的粮食加工和出口。", descriptionRu: "Переработка и экспорт зерна на Ближний Восток и в Азию.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Spa Capital", titleRu: "Столица спа", titleZh: "温泉之都", description: "Famous Caucasus Mineral Waters resorts.", descriptionRu: "Знаменитые курорты Кавказских Минеральных Вод.", descriptionZh: "著名的高加索矿泉水度假村。" }], contactInfo: { investmentAgency: "Stavropol Investment Agency", investmentAgencyRu: "Агентство инвестиций Ставрополя", investmentAgencyZh: "斯塔夫罗波尔投资局", website: "https://investstavropol.ru" } },
  "Orenburg Oblast": { name: "Orenburg Oblast", nameZh: "奥伦堡州", nameRu: "Оренбургская область", gdp: "$20 Billion", population: "2.0 Million", sezCount: 1, industries: ["Oil & Gas", "Metals", "Agriculture", "Machinery"], industriesRu: ["Нефть и газ", "Металлы", "Сельское хозяйство", "Машиностроение"], industriesZh: ["石油和天然气", "金属", "农业", "机械"], taxBenefits: ["SEZ benefits", "Gas industry incentives"], taxBenefitsRu: ["Льготы СЭЗ", "Стимулы газовой промышленности"], taxBenefitsZh: ["经济特区优惠", "天然气产业激励"], majorCities: [
    { id: "orenburg", name: "Orenburg", nameRu: "Оренбург", nameZh: "奥伦堡", population: "0.6M", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80", description: "Major gas processing center on Kazakhstan border. Historic Silk Road city.", opportunities: [
      { id: "orb-1", title: "Orenburg Gas Processing", titleZh: "奥伦堡天然气加工", titleRu: "Оренбургская газопереработка", sector: "Gas", description: "One of Russia's largest gas processing plants.", descriptionZh: "俄罗斯最大的天然气加工厂之一。", descriptionRu: "Один из крупнейших газоперерабатывающих заводов России.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
      { id: "orb-2", title: "Kazakhstan Border Trade", titleZh: "哈萨克斯坦边境贸易", titleRu: "Казахстанская приграничная торговля", sector: "Trade", description: "Cross-border trade and logistics hub.", descriptionZh: "跨境贸易和物流中心。", descriptionRu: "Хаб трансграничной торговли и логистики.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Major gas processing and metals region on Kazakhstan border. Strategic position on historic Silk Road route.", overviewRu: "Крупный регион газопереработки и металлургии на границе с Казахстаном. Стратегическое положение на историческом маршруте Шёлкового пути.", overviewZh: "哈萨克斯坦边境上的主要天然气加工和金属冶炼地区。位于历史悠久的丝绸之路上的战略位置。", targetSectors: ["Gas Processing", "Metals", "Agriculture", "Cross-border Trade"], opportunities: [
    { id: "ob-1", title: "Orenburg Gas Complex Expansion", titleZh: "奥伦堡天然气综合体扩建", titleRu: "Расширение Оренбургского газового комплекса", sector: "Gas", description: "Expansion of major gas processing facility.", descriptionZh: "主要天然气加工设施的扩建。", descriptionRu: "Расширение крупного газоперерабатывающего объекта.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "priority" },
    { id: "ob-2", title: "Silk Road Logistics Hub", titleZh: "丝绸之路物流中心", titleRu: "Логистический хаб Шёлкового пути", sector: "Logistics", description: "Trade corridor to Kazakhstan and Central Asia.", descriptionZh: "通往哈萨克斯坦和中亚的贸易走廊。", descriptionRu: "Торговый коридор в Казахстан и Центральную Азию.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Gateway to Asia", titleRu: "Ворота в Азию", titleZh: "亚洲门户", description: "Strategic position on Kazakhstan border.", descriptionRu: "Стратегическое положение на границе с Казахстаном.", descriptionZh: "哈萨克斯坦边境上的战略位置。" }], contactInfo: { investmentAgency: "Orenburg Investment Agency", investmentAgencyRu: "Агентство инвестиций Оренбургской области", investmentAgencyZh: "奥伦堡州投资局", website: "https://investorenburg.ru" } },
  "Saratov Oblast": { name: "Saratov Oblast", nameZh: "萨拉托夫州", nameRu: "Саратовская область", gdp: "$14 Billion", population: "2.4 Million", sezCount: 1, industries: ["Aviation", "Chemicals", "Agriculture", "Energy"], industriesRu: ["Авиация", "Химикаты", "Сельское хозяйство", "Энергетика"], industriesZh: ["航空", "化工", "农业", "能源"], taxBenefits: ["SEZ tax incentives", "Aviation support"], taxBenefitsRu: ["Льготы СЭЗ", "Поддержка авиации"], taxBenefitsZh: ["经济特区优惠", "航空支持"], majorCities: [
    { id: "saratov", name: "Saratov", nameRu: "Саратов", nameZh: "萨拉托夫", population: "0.8M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Major Volga city with aviation and chemical industries. Yuri Gagarin's hometown.", opportunities: [
      { id: "sar-1", title: "Saratov Aviation Plant Partnership", titleZh: "萨拉托夫航空工厂合作", titleRu: "Партнёрство с Саратовским авиазаводом", sector: "Aviation", description: "Aircraft component manufacturing.", descriptionZh: "飞机部件制造。", descriptionRu: "Производство авиационных компонентов.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" },
      { id: "sar-2", title: "Volga Chemical Complex", titleZh: "伏尔加化工综合体", titleRu: "Волжский химический комплекс", sector: "Chemicals", description: "Chemical and petrochemical production.", descriptionZh: "化学和石化生产。", descriptionRu: "Химическое и нефтехимическое производство.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Major industrial center on the Volga. Aviation, chemical, and agricultural industries. Historic city with strong education sector.", overviewRu: "Крупный промышленный центр на Волге. Авиационная, химическая и сельскохозяйственная отрасли. Исторический город с сильным образовательным сектором.", overviewZh: "伏尔加河上的主要工业中心。航空、化工和农业产业。具有强大教育部门的历史城市。", targetSectors: ["Aviation", "Chemicals", "Agriculture", "Education"], opportunities: [
    { id: "sr-1", title: "Saratov Aviation Cluster", titleZh: "萨拉托夫航空产业集群", titleRu: "Саратовский авиационный кластер", sector: "Aviation", description: "Aircraft and helicopter component production.", descriptionZh: "飞机和直升机部件生产。", descriptionRu: "Производство компонентов самолётов и вертолётов.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
    { id: "sr-2", title: "Volga Agro-Processing", titleZh: "伏尔加农产品加工", titleRu: "Волжская агропереработка", sector: "Agriculture", description: "Grain and sunflower processing for export.", descriptionZh: "粮食和葵花籽加工出口。", descriptionRu: "Переработка зерна и подсолнечника на экспорт.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Aviation Hub", titleRu: "Авиационный хаб", titleZh: "航空枢纽", description: "Historic aircraft manufacturing center.", descriptionRu: "Исторический центр производства самолётов.", descriptionZh: "历史悠久的飞机制造中心。" }], contactInfo: { investmentAgency: "Saratov Investment Agency", investmentAgencyRu: "Агентство инвестиций Саратовской области", investmentAgencyZh: "萨拉托夫州投资局", website: "https://investsaratov.ru" } },
  "Kamchatka Krai": { name: "Kamchatka Krai", nameZh: "堪察加边疆区", nameRu: "Камчатский край", gdp: "$5 Billion", population: "0.3 Million", sezCount: 1, industries: ["Fishing", "Mining", "Tourism", "Geothermal"], industriesRu: ["Рыболовство", "Горнодобывающая промышленность", "Туризм", "Геотермальная энергия"], industriesZh: ["渔业", "采矿", "旅游", "地热"], taxBenefits: ["Far East benefits", "Fishing incentives", "Tourism support"], taxBenefitsRu: ["Льготы Дальнего Востока", "Стимулы рыболовства", "Поддержка туризма"], taxBenefitsZh: ["远东优惠", "渔业激励", "旅游支持"], majorCities: [
    { id: "petropavlovsk", name: "Petropavlovsk-Kamchatsky", nameRu: "Петропавловск-Камчатский", nameZh: "彼得罗巴甫洛夫斯克-堪察加", population: "0.2M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Remote Pacific port surrounded by volcanoes. Premium fishing and adventure tourism.", opportunities: [
      { id: "pet-1", title: "Kamchatka Premium Seafood", titleZh: "堪察加优质海产品", titleRu: "Камчатские премиальные морепродукты", sector: "Fishing", description: "Premium crab, salmon, and pollock for China market.", descriptionZh: "面向中国市场的优质蟹、三文鱼和鳕鱼。", descriptionRu: "Премиальный краб, лосось и минтай для китайского рынка.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
      { id: "pet-2", title: "Volcano Adventure Tourism", titleZh: "火山探险旅游", titleRu: "Вулканический приключенческий туризм", sector: "Tourism", description: "Eco-tourism and adventure travel.", descriptionZh: "生态旅游和探险旅行。", descriptionRu: "Экотуризм и приключенческие путешествия.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Remote volcanic peninsula with pristine nature. World-class fishing (10% of Russia's catch) and growing eco-tourism. Geothermal energy potential.", overviewRu: "Удалённый вулканический полуостров с нетронутой природой. Мировой класс рыболовства (10% улова России) и растущий экотуризм. Потенциал геотермальной энергии.", overviewZh: "偏远的火山半岛，自然原始。世界级渔业（占俄罗斯鱼获量的10%）和不断增长的生态旅游。地热能潜力。", targetSectors: ["Fishing", "Eco-Tourism", "Geothermal Energy", "Mining"], opportunities: [
    { id: "km-1", title: "Kamchatka Seafood Export Hub", titleZh: "堪察加海产品出口中心", titleRu: "Камчатский хаб экспорта морепродуктов", sector: "Fishing", description: "Premium seafood processing for Asian markets. 10% of Russia's fish catch.", descriptionZh: "面向亚洲市场的优质海产品加工。占俄罗斯鱼获量的10%。", descriptionRu: "Переработка премиальных морепродуктов для азиатских рынков. 10% улова России.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "priority" },
    { id: "km-2", title: "Geothermal Energy Development", titleZh: "地热能源开发", titleRu: "Развитие геотермальной энергетики", sector: "Energy", description: "Clean geothermal power from volcanic activity.", descriptionZh: "来自火山活动的清洁地热能。", descriptionRu: "Чистая геотермальная энергия от вулканической активности.", investmentRange: "$40M - $300M", timeline: "4-6 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Pristine Nature", titleRu: "Нетронутая природа", titleZh: "原始自然", description: "UNESCO World Heritage volcanic landscapes.", descriptionRu: "Вулканические ландшафты объекта наследия ЮНЕСКО.", descriptionZh: "联合国教科文组织遗产火山景观。" }], contactInfo: { investmentAgency: "Kamchatka Investment Agency", investmentAgencyRu: "Агентство инвестиций Камчатского края", investmentAgencyZh: "堪察加边疆区投资局", website: "https://investkamchatka.ru" } },
  "Astrakhan Oblast": { name: "Astrakhan Oblast", nameZh: "阿斯特拉罕州", nameRu: "Астраханская область", gdp: "$10 Billion", population: "1.0 Million", sezCount: 2, industries: ["Oil & Gas", "Shipping", "Fishing", "Agriculture"], industriesRu: ["Нефть и газ", "Судоходство", "Рыболовство", "Сельское хозяйство"], industriesZh: ["石油和天然气", "航运", "渔业", "农业"], taxBenefits: ["SEZ benefits", "Caspian shipping incentives"], taxBenefitsRu: ["Льготы СЭЗ", "Стимулы каспийского судоходства"], taxBenefitsZh: ["经济特区优惠", "里海航运激励"], majorCities: [
    { id: "astrakhan", name: "Astrakhan", nameRu: "Астрахань", nameZh: "阿斯特拉罕", population: "0.5M", image: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=1920&q=80", description: "Caspian Sea port at Volga delta. Historic caviar capital and oil/gas hub.", opportunities: [
      { id: "ast-1", title: "Caspian Shipbuilding Hub", titleZh: "里海造船中心", titleRu: "Каспийский судостроительный хаб", sector: "Shipbuilding", description: "Shipbuilding for Caspian oil and gas operations.", descriptionZh: "里海油气作业的造船。", descriptionRu: "Судостроение для каспийских нефтегазовых операций.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
      { id: "ast-2", title: "North-South Corridor Port", titleZh: "南北走廊港口", titleRu: "Порт коридора Север-Юг", sector: "Logistics", description: "Key port on India-Russia trade corridor.", descriptionZh: "印度-俄罗斯贸易走廊上的关键港口。", descriptionRu: "Ключевой порт торгового коридора Индия-Россия.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" }
    ]}
  ], overview: "Strategic Caspian port at Volga delta. Key node on North-South corridor to Iran and India. Oil/gas, shipbuilding, and premium caviar.", overviewRu: "Стратегический каспийский порт в дельте Волги. Ключевой узел коридора Север-Юг в Иран и Индию. Нефть/газ, судостроение и премиальная икра.", overviewZh: "伏尔加河三角洲的战略性里海港口。通往伊朗和印度的南北走廊的关键节点。石油/天然气、造船和优质鱼子酱。", targetSectors: ["Port & Logistics", "Oil & Gas", "Shipbuilding", "Aquaculture"], opportunities: [
    { id: "as-1", title: "North-South Corridor Hub", titleZh: "南北走廊枢纽", titleRu: "Хаб коридора Север-Юг", sector: "Logistics", description: "Strategic port for Russia-Iran-India trade route.", descriptionZh: "俄罗斯-伊朗-印度贸易路线的战略港口。", descriptionRu: "Стратегический порт для торгового маршрута Россия-Иран-Индия.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "priority" },
    { id: "as-2", title: "Caspian Oil & Gas Services", titleZh: "里海油气服务", titleRu: "Каспийские нефтегазовые услуги", sector: "Energy", description: "Support services for Caspian offshore operations.", descriptionZh: "里海海上作业的支持服务。", descriptionRu: "Сервисные услуги для каспийских шельфовых операций.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caspian Gateway", titleRu: "Каспийские ворота", titleZh: "里海门户", description: "Key port on North-South corridor.", descriptionRu: "Ключевой порт коридора Север-Юг.", descriptionZh: "南北走廊的关键港口。" }], contactInfo: { investmentAgency: "Astrakhan Investment Agency", investmentAgencyRu: "Агентство инвестиций Астраханской области", investmentAgencyZh: "阿斯特拉罕州投资局", website: "https://investastrakhan.ru" } },
  "Altai Krai": { name: "Altai Krai", nameZh: "阿尔泰边疆区", nameRu: "Алтайский край", gdp: "$10 Billion", population: "2.3 Million", sezCount: 1, industries: ["Agriculture", "Food Processing", "Tourism", "Machinery"], industriesRu: ["Сельское хозяйство", "Пищевая промышленность", "Туризм", "Машиностроение"], industriesZh: ["农业", "食品加工", "旅游", "机械"], taxBenefits: ["Agricultural incentives", "Tourism development support"], taxBenefitsRu: ["Стимулы сельского хозяйства", "Поддержка развития туризма"], taxBenefitsZh: ["农业激励", "旅游发展支持"], majorCities: [
    { id: "barnaul", name: "Barnaul", nameRu: "Барнаул", nameZh: "巴尔瑙尔", population: "0.6M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Siberian agricultural capital. Gateway to scenic Altai Mountains.", opportunities: [
      { id: "brn-1", title: "Altai Grain Processing", titleZh: "阿尔泰粮食加工", titleRu: "Алтайская зернопереработка", sector: "Agriculture", description: "Major grain and flour production region.", descriptionZh: "主要粮食和面粉生产地区。", descriptionRu: "Крупный регион производства зерна и муки.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" },
      { id: "brn-2", title: "Altai Health Tourism", titleZh: "阿尔泰健康旅游", titleRu: "Алтайский оздоровительный туризм", sector: "Tourism", description: "Mountain resorts and traditional medicine tourism.", descriptionZh: "山地度假村和传统医疗旅游。", descriptionRu: "Горные курорты и туризм традиционной медицины.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's breadbasket - major grain and dairy region. Gateway to spectacular Altai Mountains. Growing eco-tourism and health tourism.", overviewRu: "Хлебница России - крупный регион зерна и молочной продукции. Ворота в спектакулярные Алтайские горы. Растущий экотуризм и оздоровительный туризм.", overviewZh: "俄罗斯的粮仓——主要谷物和乳制品地区。通往壮观的阿尔泰山脉的门户。不断增长的生态旅游和健康旅游。", targetSectors: ["Agriculture", "Food Processing", "Eco-Tourism", "Machinery"], opportunities: [
    { id: "ak-1", title: "Altai Agricultural Export Hub", titleZh: "阿尔泰农业出口中心", titleRu: "Алтайский сельскохозяйственный экспортный хаб", sector: "Agriculture", description: "Grain, dairy, and honey production for export to China.", descriptionZh: "出口中国的粮食、乳制品和蜂蜜生产。", descriptionRu: "Производство зерна, молочной продукции и мёда на экспорт в Китай.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "ak-2", title: "Altai Mountain Tourism", titleZh: "阿尔泰山旅游", titleRu: "Алтайский горный туризм", sector: "Tourism", description: "Eco-tourism and adventure travel in UNESCO heritage region.", descriptionZh: "联合国教科文组织遗产地区的生态旅游和探险旅行。", descriptionRu: "Экотуризм и приключенческие путешествия в регионе наследия ЮНЕСКО.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Breadbasket", description: "Russia's major grain and dairy region." }], contactInfo: { investmentAgency: "Altai Krai Investment Agency", website: "https://investaltai.ru" } },
  "Amur Oblast": { name: "Amur Oblast", nameZh: "阿穆尔州", nameRu: "Амурская область", gdp: "$7 Billion", population: "0.8 Million", sezCount: 1, industries: ["Space", "Mining", "Agriculture", "Energy"], industriesRu: ["Космос", "Горнодобывающая промышленность", "Сельское хозяйство", "Энергетика"], industriesZh: ["航天", "采矿", "农业", "能源"], taxBenefits: ["Far East benefits", "Space industry incentives"], taxBenefitsRu: ["Льготы Дальнего Востока", "Стимулы космической промышленности"], taxBenefitsZh: ["远东优惠", "航天产业激励"], majorCities: [
    { id: "blagoveshchensk", name: "Blagoveshchensk", nameRu: "Благовещенск", nameZh: "布拉戈维申斯克", population: "0.2M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Border city directly across the Amur River from China's Heihe.", opportunities: [
      { id: "blg-1", title: "Amur Cross-Border Trade", titleZh: "阿穆尔跨境贸易", titleRu: "Амурская трансграничная торговля", sector: "Trade", description: "Direct trade with China's Heihe across the bridge.", descriptionZh: "通过大桥与中国黑河的直接贸易。", descriptionRu: "Прямая торговля с китайским Хэйхэ через мост.", investmentRange: "$10M - $100M", timeline: "1-3 years", status: "priority" },
      { id: "blg-2", title: "Vostochny Cosmodrome Services", titleZh: "东方航天发射场服务", titleRu: "Услуги космодрома Восточный", sector: "Space", description: "Support services for Russia's new spaceport.", descriptionZh: "俄罗斯新航天发射场的支持服务。", descriptionRu: "Сервисные услуги для нового российского космодрома.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Strategic Far East region directly bordering China. Home to Vostochny Cosmodrome (Russia's new spaceport). Direct bridge to China's Heihe.", overviewRu: "Стратегический регион Дальнего Востока, непосредственно граничащий с Китаем. Дом космодрома Восточный (новый российский космодром). Прямой мост в китайский Хэйхэ.", overviewZh: "与中国直接接壤的战略性远东地区。拥有东方航天发射场（俄罗斯新航天港）。通往中国黑河的直接大桥。", targetSectors: ["Cross-border Trade", "Space Industry", "Agriculture", "Mining"], opportunities: [
    { id: "am-1", title: "Blagoveshchensk-Heihe Trade Zone", titleZh: "布拉戈维申斯克-黑河贸易区", titleRu: "Торговая зона Благовещенск-Хэйхэ", sector: "Trade", description: "Free trade zone on new China bridge. Direct border crossing.", descriptionZh: "新中国大桥上的自由贸易区。直接边境通道。", descriptionRu: "Зона свободной торговли на новом мосту в Китай. Прямой погранпереход.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
    { id: "am-2", title: "Vostochny Cosmodrome Cluster", titleZh: "东方航天发射场产业集群", titleRu: "Кластер космодрома Восточный", sector: "Space", description: "Space technology and satellite services.", descriptionZh: "航天技术和卫星服务。", descriptionRu: "Космические технологии и спутниковые услуги.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "China Border", description: "Direct bridge to China's Heihe city." }], contactInfo: { investmentAgency: "Amur Development Corporation", website: "https://investamur.ru" } },
  "Zabaykalsky Krai": { name: "Zabaykalsky Krai", nameZh: "外贝加尔边疆区", nameRu: "Забайкальский край", gdp: "$6 Billion", population: "1.1 Million", sezCount: 1, industries: ["Mining", "Rail", "Agriculture"], industriesRu: ["Горнодобывающая промышленность", "Железнодорожный транспорт", "Сельское хозяйство"], industriesZh: ["采矿", "铁路运输", "农业"], taxBenefits: ["Far East benefits", "Mining incentives"], taxBenefitsRu: ["Льготы Дальнего Востока", "Стимулы горнодобычи"], taxBenefitsZh: ["远东优惠", "采矿激励"], majorCities: [
    { id: "chita", name: "Chita", nameRu: "Чита", nameZh: "赤塔", population: "0.3M", image: "https://images.unsplash.com/photo-1548625361-1c64bc0e3b74?w=1920&q=80", description: "Trans-Siberian railway hub near China and Mongolia borders.", opportunities: [
      { id: "chi-1", title: "Trans-Manchurian Logistics", titleZh: "中国东北铁路物流", titleRu: "Трансманьчжурская логистика", sector: "Logistics", description: "Rail logistics to China via Trans-Manchurian route.", descriptionZh: "通过中国东北铁路的铁路物流。", descriptionRu: "Железнодорожная логистика в Китай по Трансманьчжурскому маршруту.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
      { id: "chi-2", title: "Zabaykalsk Mining Development", titleZh: "外贝加尔采矿开发", titleRu: "Забайкальская горнодобыча", sector: "Mining", description: "Uranium, gold, and copper mining.", descriptionZh: "铀、金和铜矿开采。", descriptionRu: "Добыча урана, золота и меди.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Strategic Trans-Siberian rail hub bordering China and Mongolia. Rich mineral deposits including uranium, gold, and copper.", overviewRu: "Стратегический хаб Транссибирской магистрали, граничащий с Китаем и Монголией. Богат месторождениями урана, золота и меди.", overviewZh: "与中国和蒙古接壤的战略性跨西伯利亚铁路枢纽。拥有丰富的铀、金和铜矿床。", targetSectors: ["Rail Logistics", "Mining", "Cross-border Trade", "Agriculture"], opportunities: [
    { id: "zb-1", title: "China-Russia Rail Gateway", titleZh: "中俄铁路门户", titleRu: "Железнодорожные ворота Китай-Россия", sector: "Logistics", description: "Major rail border crossing to China at Zabaykalsk-Manzhouli.", descriptionZh: "在满洲里-后贝加尔斯克的主要铁路边境口岸。", descriptionRu: "Крупный железнодорожный погранпереход в Китай в Забайкальске-Маньчжурии.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "priority" },
    { id: "zb-2", title: "Udokan Copper Project", titleZh: "乌多坎铜矿项目", titleRu: "Удоканский медный проект", sector: "Mining", description: "One of world's largest undeveloped copper deposits.", descriptionZh: "世界上最大的未开发铜矿床之一。", descriptionRu: "Одно из крупнейших в мире неосвоенных месторождений меди.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Rail Gateway", titleRu: "Железнодорожные ворота", titleZh: "铁路门户", description: "Trans-Siberian junction to China.", descriptionRu: "Транссибирский узел в Китай.", descriptionZh: "通往中国的跨西伯利亚枢纽。" }], contactInfo: { investmentAgency: "Zabaykalsky Investment Agency", investmentAgencyRu: "Агентство развития Забайкальского края", investmentAgencyZh: "外贝加尔边疆区发展局", website: "https://investzabaykalye.ru" } },
  "Tomsk Oblast": { name: "Tomsk Oblast", nameZh: "托木斯克州", nameRu: "Томская область", gdp: "$12 Billion", population: "1.1 Million", sezCount: 2, industries: ["Oil & Gas", "IT", "Education", "Pharmaceuticals"], taxBenefits: ["SEZ benefits", "Innovation incentives", "Education support"], industriesRu: ["Нефть и газ", "Информационные технологии", "Образование", "Фармацевтика"], industriesZh: ["石油和天然气", "信息技术", "教育", "制药"], taxBenefitsRu: ["Льготы ОЭЗ", "Стимулы инноваций", "Поддержка образования"], taxBenefitsZh: ["经济特区优惠", "创新激励", "教育支持"], majorCities: [
    { id: "tomsk", name: "Tomsk", nameRu: "Томск", nameZh: "托木斯克", population: "0.6M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Siberia's education capital. Six universities and growing tech sector.", opportunities: [
      { id: "tom-1", title: "Tomsk IT Cluster", titleZh: "托木斯克IT产业集群", titleRu: "Томский ИТ-кластер", sector: "IT", description: "Software development and tech startups.", descriptionZh: "软件开发和科技初创企业。", descriptionRu: "Разработка ПО и технологические стартапы.", investmentRange: "$10M - $80M", timeline: "1-3 years", status: "active" },
      { id: "tom-2", title: "Siberian Pharmaceuticals", titleZh: "西伯利亚制药", titleRu: "Сибирская фармацевтика", sector: "Pharma", description: "Pharmaceutical R&D and manufacturing.", descriptionZh: "制药研发和生产。", descriptionRu: "Фармацевтические НИОКР и производство.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Siberia's intellectual capital with 6 universities (100,000+ students). Strong IT, pharma, and innovation ecosystem. Oil and gas services.", overviewRu: "Интеллектуальный центр Сибири с 6 университетами (100 000+ студентов). Сильная ИТ, фармацевтическая и инновационная экосистема. Услуги нефти и газа.", overviewZh: "西伯利亚知识中心，拥有6所大学（10万+学生）。强大的IT、制药和创新生态系统。石油和天然气服务。", targetSectors: ["IT & Software", "Pharmaceuticals", "Education", "Oil Services"], opportunities: [
    { id: "to-1", title: "Tomsk Innovation Hub", titleZh: "托木斯克创新中心", titleRu: "Томский инновационный хаб", sector: "Technology", description: "Tech transfer from universities to industry.", descriptionZh: "从大学到产业的技术转让。", descriptionRu: "Трансфер технологий из университетов в промышленность.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" },
    { id: "to-2", title: "Tomsk Pharma Cluster", titleZh: "托木斯克制药集群", titleRu: "Томский фармацевтический кластер", sector: "Pharma", description: "Pharmaceutical production for Russian and Asian markets.", descriptionZh: "面向俄罗斯和亚洲市场的制药生产。", descriptionRu: "Фармацевтическое производство для российского и азиатского рынков.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Education Capital", titleRu: "Столица образования", titleZh: "教育之都", description: "6 universities, 100,000+ students.", descriptionRu: "6 университетов, 100 000+ студентов.", descriptionZh: "6所大学，10万+学生。" }], contactInfo: { investmentAgency: "Tomsk Investment Agency", investmentAgencyRu: "Агентство инвестиций Томска", investmentAgencyZh: "托木斯克投资局", website: "https://investtomsk.ru" } },
  "Udmurt Republic": { name: "Udmurt Republic", nameZh: "乌德穆尔特共和国", nameRu: "Удмуртская Республика", gdp: "$12 Billion", population: "1.5 Million", sezCount: 1, industries: ["Arms Manufacturing", "Automotive", "Oil", "Machinery"], taxBenefits: ["Manufacturing incentives", "Defense conversion support"], industriesRu: ["Производство вооружений", "Автомобилестроение", "Нефть", "Машиностроение"], industriesZh: ["武器制造", "汽车", "石油", "机械"], taxBenefitsRu: ["Стимулы производства", "Поддержка конверсии оборонной промышленности"], taxBenefitsZh: ["制造激励", "国防转换支持"], majorCities: [
    { id: "izhevsk", name: "Izhevsk", nameRu: "Ижевск", nameZh: "伊热夫斯克", population: "0.6M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Arms manufacturing capital. Home of Kalashnikov. Also automotive and electronics.", opportunities: [
      { id: "izh-1", title: "Kalashnikov Civilian Products", titleZh: "卡拉什尼科夫民用产品", titleRu: "Гражданская продукция Калашникова", sector: "Manufacturing", description: "Civilian applications of defense technology.", descriptionZh: "国防技术的民用化应用。", descriptionRu: "Гражданское применение оборонных технологий.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "izh-2", title: "Lada Izhevsk Partnership", titleZh: "伊热夫斯克拉达合作", titleRu: "Партнёрство с Лада Ижевск", sector: "Automotive", description: "Automotive manufacturing and components.", descriptionZh: "汽车制造和零部件。", descriptionRu: "Автомобилестроение и производство комплектующих.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's arms manufacturing capital (Kalashnikov, Izhmash). Also major automotive production (Lada). Oil production in the region.", overviewRu: "Столица вооружений России (Калашников, Ижмаш). Также крупное автомобильное производство (Лада). Добыча нефти в регионе.", overviewZh: "俄罗斯武器制造之都（卡拉什尼科夫、伊热马什）。也是主要汽车生产地（拉达）。该地区有石油生产。", targetSectors: ["Defense Conversion", "Automotive", "Oil Production", "Electronics"], opportunities: [
    { id: "ud-1", title: "Kalashnikov Concern Partnership", titleZh: "卡拉什尼科夫集团合作", titleRu: "Партнёрство с Концерном Калашников", sector: "Manufacturing", description: "Civilian products and technology transfer.", descriptionZh: "民用产品和技术转让。", descriptionRu: "Гражданская продукция и трансфер технологий.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" },
    { id: "ud-2", title: "Izhevsk Automotive Cluster", titleZh: "伊热夫斯克汽车产业集群", titleRu: "Ижевский автомобильный кластер", sector: "Automotive", description: "Vehicle and component manufacturing.", descriptionZh: "汽车和零部件制造。", descriptionRu: "Производство автомобилей и комплектующих.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "priority" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Manufacturing Hub", titleRu: "Производственный центр", titleZh: "制造中心", description: "Kalashnikov and Lada production.", descriptionRu: "Производство Калашникова и Лады.", descriptionZh: "卡拉什尼科夫和拉达生产。" }], contactInfo: { investmentAgency: "Udmurtia Investment Agency", investmentAgencyRu: "Агентство инвестиций Удмуртии", investmentAgencyZh: "乌德穆尔特投资局", website: "https://investudmurtia.ru" } },
  "Chuvash Republic": { name: "Chuvash Republic", nameZh: "楚瓦什共和国", nameRu: "Чувашская Республика", gdp: "$7 Billion", population: "1.2 Million", sezCount: 1, industries: ["Electrical Equipment", "Machinery", "Agriculture", "Textiles"], taxBenefits: ["Manufacturing incentives", "SME support"], industriesRu: ["Электрооборудование", "Машиностроение", "Сельское хозяйство", "Текстиль"], industriesZh: ["电气设备", "机械", "农业", "纺织"], taxBenefitsRu: ["Стимулы производства", "Поддержка МСП"], taxBenefitsZh: ["制造激励", "中小企业支持"], majorCities: [
    { id: "cheboksary", name: "Cheboksary", nameRu: "Чебоксары", nameZh: "切博克萨雷", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Volga industrial city. Major electrical equipment and tractor manufacturing.", opportunities: [
      { id: "chb-1", title: "Cheboksary Electrical Equipment", titleZh: "切博克萨雷电气设备", titleRu: "Чебоксарское электрооборудование", sector: "Electrical", description: "Electrical machinery and equipment manufacturing.", descriptionZh: "电气机械和设备制造。", descriptionRu: "Производство электрических машин и оборудования.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "chb-2", title: "Chuvash Tractor Works", titleZh: "楚瓦什拖拉机厂", titleRu: "Чувашский тракторный завод", sector: "Machinery", description: "Agricultural and industrial tractors.", descriptionZh: "农业和工业拖拉机。", descriptionRu: "Сельскохозяйственные и промышленные тракторы.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Industrial center on the Volga. Major producer of electrical equipment, tractors, and textiles. Strong agricultural sector.", overviewRu: "Промышленный центр на Волге. Крупный производитель электрооборудования, тракторов и текстиля. Сильный сельскохозяйственный сектор.", overviewZh: "伏尔加河上的工业中心。主要电气设备、拖拉机和纺织品生产商。强大的农业部门。", targetSectors: ["Electrical Equipment", "Machinery", "Agriculture", "Textiles"], opportunities: [
    { id: "cv-1", title: "Chuvash Electrical Cluster", titleZh: "楚瓦什电气产业集群", titleRu: "Чувашский электротехнический кластер", sector: "Electrical", description: "Electrical equipment for Russian and export markets.", descriptionZh: "面向俄罗斯和出口市场的电气设备。", descriptionRu: "Электрооборудование для российского и экспортного рынков.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "cv-2", title: "Volga Agricultural Processing", titleZh: "伏尔加农产品加工", titleRu: "Волжская сельхозпереработка", sector: "Agriculture", description: "Hop and grain processing.", descriptionZh: "啤酒花和粮食加工。", descriptionRu: "Переработка хмеля и зерна.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Electrical Hub", titleRu: "Электротехнический центр", titleZh: "电气中心", description: "Major electrical equipment producer.", descriptionRu: "Крупный производитель электрооборудования.", descriptionZh: "主要电气设备生产商。" }], contactInfo: { investmentAgency: "Chuvashia Investment Agency", investmentAgencyRu: "Агентство инвестиций Чувашии", investmentAgencyZh: "楚瓦什投资局", website: "https://investchuvashia.ru" } },
  "Republic of Mordovia": { name: "Republic of Mordovia", nameZh: "莫尔多瓦共和国", nameRu: "Республика Мордовия", gdp: "$6 Billion", population: "0.8 Million", sezCount: 1, industries: ["Electronics", "Lighting", "Cables", "Agriculture"], taxBenefits: ["SEZ benefits", "Electronics incentives"], industriesRu: ["Электроника", "Светотехника", "Кабели", "Сельское хозяйство"], industriesZh: ["电子", "照明", "电缆", "农业"], taxBenefitsRu: ["Льготы ОЭЗ", "Стимулы электроники"], taxBenefitsZh: ["经济特区优惠", "电子激励"], majorCities: [
    { id: "saransk", name: "Saransk", nameRu: "Саранск", nameZh: "萨兰斯克", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Electronics and lighting manufacturing center. 2018 FIFA World Cup host city.", opportunities: [
      { id: "srn-1", title: "Saransk Electronics Hub", titleZh: "萨兰斯克电子中心", titleRu: "Саранский электронный хаб", sector: "Electronics", description: "Electronics and semiconductor production.", descriptionZh: "电子和半导体生产。", descriptionRu: "Производство электроники и полупроводников.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "srn-2", title: "Russian Lighting Industry", titleZh: "俄罗斯照明产业", titleRu: "Российская светотехническая промышленность", sector: "Lighting", description: "LED and specialty lighting production.", descriptionZh: "LED和特种照明生产。", descriptionRu: "Производство светодиодного и специального освещения.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russian electronics and lighting manufacturing center. Strong cable and wire production. Modern sports infrastructure from FIFA 2018.", overviewRu: "Российский центр производства электроники и светотехники. Сильное производство кабелей и проводов. Современная спортивная инфраструктура от ЧМ-2018.", overviewZh: "俄罗斯电子和照明制造中心。强大的电缆和电线生产。2018年世界杯现代体育基础设施。", targetSectors: ["Electronics", "Lighting", "Cable Production", "Agriculture"], opportunities: [
    { id: "mo-1", title: "Mordovia Electronics Cluster", titleZh: "莫尔多瓦电子产业集群", titleRu: "Мордовский электронный кластер", sector: "Electronics", description: "Electronics manufacturing and R&D.", descriptionZh: "电子制造和研发。", descriptionRu: "Производство электроники и НИОКР.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" },
    { id: "mo-2", title: "Russian Optical Fiber", titleZh: "俄罗斯光纤", titleRu: "Российское оптоволокно", sector: "Telecom", description: "Fiber optic cable production.", descriptionZh: "光纤电缆生产。", descriptionRu: "Производство волоконно-оптического кабеля.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Electronics Center", titleRu: "Электронный центр", titleZh: "电子中心", description: "Russia's lighting and electronics hub.", descriptionRu: "Российский центр светотехники и электроники.", descriptionZh: "俄罗斯照明和电子中心。" }], contactInfo: { investmentAgency: "Mordovia Investment Agency", investmentAgencyRu: "Агентство инвестиций Мордовии", investmentAgencyZh: "莫尔多瓦投资局", website: "https://investmordovia.ru" } },
  "Republic of Buryatia": { name: "Republic of Buryatia", nameZh: "布里亚特共和国", nameRu: "Республика Бурятия", gdp: "$6 Billion", population: "1.0 Million", sezCount: 1, industries: ["Tourism", "Mining", "Aviation", "Agriculture"], taxBenefits: ["Far East benefits", "Tourism incentives", "Baikal protection support"], industriesRu: ["Туризм", "Горнодобывающая промышленность", "Авиация", "Сельское хозяйство"], industriesZh: ["旅游", "采矿", "航空", "农业"], taxBenefitsRu: ["Льготы Дальнего Востока", "Стимулы туризма", "Поддержка защиты Байкала"], taxBenefitsZh: ["远东优惠", "旅游激励", "贝加尔保护支持"], majorCities: [
    { id: "ulan-ude", name: "Ulan-Ude", nameRu: "Улан-Удэ", nameZh: "乌兰乌德", population: "0.4M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Buddhist cultural center on Lake Baikal. Aviation manufacturing and tourism gateway.", opportunities: [
      { id: "uud-1", title: "Lake Baikal Eco-Tourism", titleZh: "贝加尔湖生态旅游", titleRu: "Байкальский экотуризм", sector: "Tourism", description: "Sustainable tourism on UNESCO World Heritage lake.", descriptionZh: "联合国教科文组织世界遗产湖泊的可持续旅游。", descriptionRu: "Устойчивый туризм на озере — объекте Всемирного наследия ЮНЕСКО.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "priority" },
      { id: "uud-2", title: "Ulan-Ude Aviation Plant", titleZh: "乌兰乌德航空工厂", titleRu: "Улан-Удэнский авиазавод", sector: "Aviation", description: "Helicopter manufacturing and maintenance.", descriptionZh: "直升机制造和维护。", descriptionRu: "Производство и обслуживание вертолётов.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Gateway to Lake Baikal - world's deepest lake and UNESCO site. Unique Buddhist culture. Helicopter manufacturing and mining.", overviewRu: "Ворота к озеру Байкал - самому глубокому озеру в мире и объекту ЮНЕСКО. Уникальная буддийская культура. Производство вертолётов и горнодобыча.", overviewZh: "通往贝加尔湖的门户——世界最深的湖泊和联合国教科文组织遗址。独特的佛教文化。直升机制造和采矿。", targetSectors: ["Eco-Tourism", "Aviation", "Mining", "Agriculture"], opportunities: [
    { id: "br-1", title: "Baikal Tourism Development", titleZh: "贝加尔湖旅游开发", titleRu: "Развитие байкальского туризма", sector: "Tourism", description: "Eco-tourism infrastructure for Chinese tourists.", descriptionZh: "面向中国游客的生态旅游基础设施。", descriptionRu: "Экотуристическая инфраструктура для китайских туристов.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "br-2", title: "Buryatia Mineral Development", titleZh: "布里亚特矿产开发", titleRu: "Развитие минеральных ресурсов Бурятии", sector: "Mining", description: "Gold, uranium, and rare earth mining.", descriptionZh: "金、铀和稀土开采。", descriptionRu: "Добыча золота, урана и редкоземельных металлов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Baikal Gateway", titleRu: "Ворота Байкала", titleZh: "贝加尔门户", description: "World's deepest lake - UNESCO site.", descriptionRu: "Самое глубокое озеро в мире - объект ЮНЕСКО.", descriptionZh: "世界最深的湖泊——联合国教科文组织遗址。" }], contactInfo: { investmentAgency: "Buryatia Investment Agency", investmentAgencyRu: "Агентство инвестиций Бурятии", investmentAgencyZh: "布里亚特投资局", website: "https://investburyatia.ru" } },
  "Republic of Crimea": { name: "Republic of Crimea", nameZh: "克里米亚共和国", nameRu: "Республика Крым", gdp: "$5 Billion", population: "1.9 Million", sezCount: 1, industries: ["Tourism", "Agriculture", "Shipbuilding", "Wine"], industriesRu: ["Туризм", "Сельское хозяйство", "Судостроение", "Виноделие"], industriesZh: ["旅游", "农业", "造船", "葡萄酒"], taxBenefits: ["Free economic zone", "Tourism support", "Agriculture incentives"], taxBenefitsRu: ["Свободная экономическая зона", "Поддержка туризма", "Стимулы сельского хозяйства"], taxBenefitsZh: ["自由经济区", "旅游支持", "农业激励"], majorCities: [
    { id: "simferopol", name: "Simferopol", nameRu: "Симферополь", nameZh: "辛菲罗波尔", population: "0.3M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Capital and transportation hub. Gateway to Crimean resorts.", opportunities: [
      { id: "sim-1", title: "Crimean Wine Industry", titleZh: "克里米亚葡萄酒产业", titleRu: "Крымское виноделие", sector: "Wine", description: "Premium wine production with historic tradition.", descriptionZh: "具有悠久传统的优质葡萄酒生产。", descriptionRu: "Премиальное виноделие с исторической традицией.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" },
      { id: "sim-2", title: "Crimean Agriculture Hub", titleZh: "克里米亚农业中心", titleRu: "Крымский агрохаб", sector: "Agriculture", description: "Fruit, vegetable, and grain production.", descriptionZh: "水果、蔬菜和粮食生产。", descriptionRu: "Производство фруктов, овощей и зерна.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
    ]}
   ], overview: "Black Sea peninsula with rich tourism potential and agricultural land. Historic wine region. Free economic zone with significant tax benefits.", overviewRu: "Чёрноморский полуостров с богатым туристическим потенциалом и сельскохозяйственными землями. Исторический винодельческий регион. Свободная экономическая зона со значительными налоговыми льготами.", overviewZh: "黑海半岛，具有丰富的旅游潜力和农业用地。历史悠久的葡萄酒产区。具有重大税收优惠的自由经济区。", targetSectors: ["Tourism", "Wine Industry", "Agriculture", "Shipbuilding"], opportunities: [
    { id: "cr-1", title: "Crimean Resort Development", titleZh: "克里米亚度假村开发", titleRu: "Развитие крымских курортов", sector: "Tourism", description: "Beach and spa resort development.", descriptionZh: "海滩和温泉度假村开发。", descriptionRu: "Развитие пляжных и спа-курортов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
    { id: "cr-2", title: "Crimean Wine Export", titleZh: "克里米亚葡萄酒出口", titleRu: "Экспорт крымского вина", sector: "Wine", description: "Wine production and export to Asia.", descriptionZh: "葡萄酒生产和出口至亚洲。", descriptionRu: "Производство и экспорт вина в Азию.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
   ], keyProjects: [], advantages: [{ icon: "location", title: "Black Sea Resort", titleRu: "Чёрноморский курорт", titleZh: "黑海度假胜地", description: "Historic resort region with FEZ benefits.", descriptionRu: "Исторический курортный регион со льготами СЭЗ.", descriptionZh: "具有自由经济区优惠的历史悠久的度假区。" }], contactInfo: { investmentAgency: "Crimea Investment Agency", investmentAgencyRu: "Агентство инвестиций Крыма", investmentAgencyZh: "克里米亚投资局", website: "https://investcrimea.ru" } },
  "Kaluga Oblast": { name: "Kaluga Oblast", nameZh: "卡卢加州", nameRu: "Калужская область", gdp: "$15 Billion", population: "1.0 Million", sezCount: 3, industries: ["Automotive", "Pharmaceuticals", "Logistics", "IT"], industriesRu: ["Автомобилестроение", "Фармацевтика", "Логистика", "ИТ"], industriesZh: ["汽车", "制药", "物流", "信息技术"], taxBenefits: ["SEZ tax holidays", "Automotive cluster benefits"], taxBenefitsRu: ["Налоговые каникулы СЭЗ", "Льготы автомобильного кластера"], taxBenefitsZh: ["经济特区税收假期", "汽车集群优惠"], majorCities: [
    { id: "kaluga", name: "Kaluga", nameRu: "Калуга", nameZh: "卡卢加", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Russia's automotive capital with VW, Volvo, and other plants nearby.", opportunities: [
      { id: "klg-1", title: "Kaluga Automotive Cluster", titleZh: "卡卢加汽车产业集群", titleRu: "Калужский автомобильный кластер", sector: "Automotive", description: "Auto parts and component manufacturing for VW, Volvo plants.", descriptionZh: "为大众、沃尔沃工厂的汽车零部件制造。", descriptionRu: "Производство автокомплектующих для заводов VW, Volvo.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "klg-2", title: "Kaluga Pharma Park", titleZh: "卡卢加制药园区", titleRu: "Калужский фармапарк", sector: "Pharma", description: "Pharmaceutical manufacturing cluster.", descriptionZh: "制药生产集群。", descriptionRu: "Кластер фармацевтического производства.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
    ]}
   ], overview: "Russia's most successful automotive region with VW, Volvo, Peugeot-Citroen plants. Strong pharma and IT sectors. Model for regional development.", overviewRu: "Самый успешный автомобильный регион России с заводами VW, Volvo, Peugeot-Citroen. Сильные фармацевтический и ИТ-секторы. Модель регионального развития.", overviewZh: "俄罗斯最成功的汽车地区，拥有大众、沃尔沃、标致-雪铁龙工厂。强大的制药和信息技术部门。区域发展的典范。", targetSectors: ["Automotive", "Pharmaceuticals", "IT", "Logistics"], opportunities: [
    { id: "ka-1", title: "Automotive Component Manufacturing", titleZh: "汽车零部件制造", titleRu: "Производство автокомпонентов", sector: "Automotive", description: "Supplier base for major auto manufacturers.", descriptionZh: "主要汽车制造商的供应商基地。", descriptionRu: "Поставщик для крупных автопроизводителей.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
    { id: "ka-2", title: "Kaluga IT & Logistics Hub", titleZh: "卡卢加IT与物流中心", titleRu: "Калужский ИТ и логистический хаб", sector: "IT", description: "Data centers and e-commerce logistics.", descriptionZh: "数据中心和电商物流。", descriptionRu: "Дата-центры и логистика электронной коммерции.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
   ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Auto Capital", titleRu: "Автомобильная столица", titleZh: "汽车之都", description: "Russia's leading automotive region.", descriptionRu: "Ведущий автомобильный регион России.", descriptionZh: "俄罗斯领先的汽车地区。" }], contactInfo: { investmentAgency: "Kaluga Development Corporation", investmentAgencyRu: "Корпорация развития Калуги", investmentAgencyZh: "卡卢加发展公司", website: "https://investkaluga.ru" } },
  "Yaroslavl Oblast": { name: "Yaroslavl Oblast", nameZh: "雅罗斯拉夫尔州", nameRu: "Ярославская область", gdp: "$12 Billion", population: "1.3 Million", sezCount: 1, industries: ["Petroleum Machinery", "Chemicals", "Tires", "Pharma"], industriesRu: ["Нефтяное машиностроение", "Химикаты", "Шины", "Фармацевтика"], industriesZh: ["石油机械", "化工", "轮胎", "制药"], taxBenefits: ["Industrial park incentives", "Machinery support"], taxBenefitsRu: ["Стимулы индустриальных парков", "Поддержка машиностроения"], taxBenefitsZh: ["工业园区激励", "机械支持"], majorCities: [
    { id: "yaroslavl", name: "Yaroslavl", nameRu: "Ярославль", nameZh: "雅罗斯拉夫尔", population: "0.6M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Historic Golden Ring city. Major petroleum machinery and tire production.", opportunities: [
      { id: "yar-1", title: "Yaroslavl Engine Plant", titleZh: "雅罗斯拉夫尔发动机厂", titleRu: "Ярославский моторный завод", sector: "Machinery", description: "Diesel engine manufacturing.", descriptionZh: "柴油发动机制造。", descriptionRu: "Производство дизельных двигателей.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" },
      { id: "yar-2", title: "Cordiant Tire Partnership", titleZh: "科迪安特轮胎合作", titleRu: "Партнёрство с Кордиант", sector: "Automotive", description: "Tire manufacturing expansion.", descriptionZh: "轮胎制造扩张。", descriptionRu: "Расширение шинного производства.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Historic Golden Ring city with strong industrial base. Major petroleum equipment, tire, and pharmaceutical production.", overviewRu: "Исторический город Золотого кольца с сильной промышленной базой. Крупное производство нефтяного оборудования, шин и фармацевтики.", overviewZh: "历史悠久的金环城市，拥有强大的工业基础。主要石油设备、轮胎和制药生产。", targetSectors: ["Petroleum Equipment", "Tires", "Chemicals", "Pharmaceuticals"], opportunities: [
    { id: "ys-1", title: "Yaroslavl Petroleum Machinery", titleZh: "雅罗斯拉夫尔石油机械", titleRu: "Ярославское нефтяное машиностроение", sector: "Machinery", description: "Equipment for oil and gas industry.", descriptionZh: "石油和天然气行业设备。", descriptionRu: "Оборудование для нефтегазовой отрасли.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
    { id: "ys-2", title: "Golden Ring Tourism", titleZh: "金环旅游", titleRu: "Туризм Золотого кольца", sector: "Tourism", description: "UNESCO heritage tourism development.", descriptionZh: "联合国教科文组织遗产旅游开发。", descriptionRu: "Развитие туризма объектов наследия ЮНЕСКО.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Engine Capital", titleRu: "Столица двигателей", titleZh: "发动机之都", description: "Major diesel engine production.", descriptionRu: "Крупное производство дизельных двигателей.", descriptionZh: "主要柴油发动机生产。" }], contactInfo: { investmentAgency: "Yaroslavl Investment Agency", investmentAgencyRu: "Агентство инвестиций Ярославля", investmentAgencyZh: "雅罗斯拉夫尔投资局", website: "https://investyaroslavl.ru" } },
  "Tver Oblast": { name: "Tver Oblast", nameZh: "特维尔州", nameRu: "Тверская область", gdp: "$10 Billion", population: "1.3 Million", sezCount: 1, industries: ["Rail", "Glass", "Machinery", "Printing"], industriesRu: ["Железнодорожное", "Стекло", "Машиностроение", "Печать"], industriesZh: ["铁路", "玻璃", "机械", "印刷"], taxBenefits: ["Manufacturing incentives", "Transport equipment support"], taxBenefitsRu: ["Стимулы производства", "Поддержка транспортного оборудования"], taxBenefitsZh: ["制造激励", "运输设备支持"], majorCities: [
    { id: "tver", name: "Tver", nameRu: "Тверь", nameZh: "特维尔", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Rail manufacturing center between Moscow and St. Petersburg.", opportunities: [
      { id: "tvr-1", title: "Tver Rail Car Plant", titleZh: "特维尔客车厂", titleRu: "Тверской вагоностроительный завод", sector: "Rail", description: "Passenger rail car manufacturing.", descriptionZh: "客运车厢制造。", descriptionRu: "Производство пассажирских вагонов.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
      { id: "tvr-2", title: "Tver Glass Industry", titleZh: "特维尔玻璃产业", titleRu: "Тверская стекольная промышленность", sector: "Glass", description: "Industrial and specialty glass production.", descriptionZh: "工业和特种玻璃生产。", descriptionRu: "Производство промышленного и специального стекла.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Strategic location between Moscow and St. Petersburg. Major rail car manufacturing (TVZ). Historic city with growing logistics sector.", overviewRu: "Стратегическое расположение между Москвой и Санкт-Петербургом. Крупное производство железнодорожных вагонов (ТВЗ). Исторический город с растущим логистическим сектором.", overviewZh: "位于莫斯科和圣彼得堡之间的战略位置。主要铁路车厢制造（TVZ）。具有不断增长的物流部门的历史城市。", targetSectors: ["Rail Manufacturing", "Glass", "Logistics", "Printing"], opportunities: [
    { id: "tv-1", title: "TVZ Rail Manufacturing", titleZh: "特维尔铁路制造", titleRu: "Тверское вагоностроение", sector: "Rail", description: "Passenger and freight rail car production.", descriptionZh: "客运和货运车厢生产。", descriptionRu: "Производство пассажирских и грузовых вагонов.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "tv-2", title: "Moscow-St.Petersburg Corridor Logistics", titleZh: "莫斯科-圣彼得堡走廊物流", titleRu: "Логистика коридора Москва-Санкт-Петербург", sector: "Logistics", description: "Distribution centers on main transport corridor.", descriptionZh: "主要运输走廊上的配送中心。", descriptionRu: "Распределительные центры на главном транспортном коридоре.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Strategic Location", titleRu: "Стратегическое расположение", titleZh: "战略位置", description: "Between Moscow and St. Petersburg.", descriptionRu: "Между Москвой и Санкт-Петербургом.", descriptionZh: "位于莫斯科和圣彼得堡之间。" }], contactInfo: { investmentAgency: "Tver Investment Agency", investmentAgencyRu: "Агентство инвестиций Твери", investmentAgencyZh: "特维尔投资局", website: "https://investtver.ru" } },
  "Vladimir Oblast": { name: "Vladimir Oblast", nameZh: "弗拉基米尔州", nameRu: "Владимирская область", gdp: "$8 Billion", population: "1.4 Million", sezCount: 1, industries: ["Glass", "Machinery", "Food", "Tourism"], industriesRu: ["Стекло", "Машиностроение", "Пищевая промышленность", "Туризм"], industriesZh: ["玻璃", "机械", "食品", "旅游"], taxBenefits: ["Manufacturing incentives", "Tourism support"], taxBenefitsRu: ["Стимулы производства", "Поддержка туризма"], taxBenefitsZh: ["制造激励", "旅游支持"], majorCities: [
    { id: "vladimir", name: "Vladimir", nameRu: "Владимир", nameZh: "弗拉基米尔", population: "0.4M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Ancient capital of Russia. Famous for crystal and glassware.", opportunities: [
      { id: "vla-1", title: "Gus-Khrustalny Crystal", titleZh: "古斯赫鲁斯塔利尼水晶", titleRu: "Гусевский хрусталь", sector: "Glass", description: "Famous Russian crystal and glassware.", descriptionZh: "著名的俄罗斯水晶和玻璃器皿。", descriptionRu: "Знаменитый российский хрусталь и стекло.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
      { id: "vla-2", title: "Vladimir Industrial Park", titleZh: "弗拉基米尔工业园区", titleRu: "Владимирский индустриальный парк", sector: "Manufacturing", description: "Manufacturing cluster near Moscow.", descriptionZh: "莫斯科附近的制造业集群。", descriptionRu: "Производственный кластер под Москвой.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Historic Golden Ring center and ancient Russian capital. Famous Gus-Khrustalny crystal. Growing manufacturing near Moscow.", overviewRu: "Исторический центр Золотого кольца и древняя столица России. Знаменитый гусевский хрусталь. Растущее производство рядом с Москвой.", overviewZh: "历史悠久的金环中心和俄罗斯古都。著名的古斯赫鲁斯塔利尼水晶。莫斯科附近不断增长的制造业。", targetSectors: ["Glass & Crystal", "Machinery", "Food Processing", "Tourism"], opportunities: [
    { id: "vl-1", title: "Russian Crystal Industry", titleZh: "俄罗斯水晶产业", titleRu: "Российская хрустальная промышленность", sector: "Glass", description: "Premium crystal and art glass production.", descriptionZh: "优质水晶和艺术玻璃生产。", descriptionRu: "Производство премиального хрусталя и художественного стекла.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
    { id: "vl-2", title: "Golden Ring Heritage Tourism", titleZh: "金环遗产旅游", titleRu: "Наследственный туризм Золотого кольца", sector: "Tourism", description: "UNESCO heritage site tourism.", descriptionZh: "联合国教科文组织遗产地旅游。", descriptionRu: "Туризм объектов наследия ЮНЕСКО.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Crystal Capital", titleRu: "Столица хрусталя", titleZh: "水晶之都", description: "Famous Gus-Khrustalny crystal.", descriptionRu: "Знаменитый гусевский хрусталь.", descriptionZh: "著名的古斯赫鲁斯塔利尼水晶。" }], contactInfo: { investmentAgency: "Vladimir Investment Agency", investmentAgencyRu: "Агентство инвестиций Владимира", investmentAgencyZh: "弗拉基米尔投资局", website: "https://investvladimir.ru" } },
  "Lipetsk Oblast": { name: "Lipetsk Oblast", nameZh: "利佩茨克州", nameRu: "Липецкая область", gdp: "$14 Billion", population: "1.1 Million", sezCount: 2, industries: ["Steel", "Appliances", "Agriculture", "Machinery"], industriesRu: ["Сталь", "Бытовая техника", "Сельское хозяйство", "Машиностроение"], industriesZh: ["钢铁", "家电", "农业", "机械"], taxBenefits: ["SEZ tax holidays", "Steel industry support"], taxBenefitsRu: ["Налоговые каникулы в ОЭЗ", "Поддержка сталелитейной промышленности"], taxBenefitsZh: ["经济特区税收假期", "钢铁产业支持"], majorCities: [
    { id: "lipetsk", name: "Lipetsk", nameRu: "Липецк", nameZh: "利佩茨克", population: "0.5M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Steel capital. Home to NLMK - one of world's most efficient steel producers.", opportunities: [
      { id: "lip-1", title: "NLMK Steel Partnership", titleZh: "新利佩茨克钢铁合作", titleRu: "Партнёрство с НЛМК", sector: "Steel", description: "Partnership with world's most profitable steelmaker.", descriptionZh: "与全球最盈利钢铁制造商的合作。", descriptionRu: "Партнёрство с самым прибыльным сталелитейщиком мира.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "lip-2", title: "Lipetsk SEZ Manufacturing", titleZh: "利佩茨克经济特区制造", titleRu: "Производство в ОЭЗ Липецк", sector: "Manufacturing", description: "Appliance and machinery manufacturing.", descriptionZh: "家电和机械制造。", descriptionRu: "Производство бытовой техники и машиностроение.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's steel capital with NLMK - one of world's most efficient steel producers. Successful SEZ with appliance manufacturing.", overviewRu: "Сталелитейная столица России с НЛМК — одним из самых эффективных сталелитейщиков мира. Успешная ОЭЗ с производством бытовой техники.", overviewZh: "俄罗斯钢铁之都，拥有新利佩茨克钢铁公司——全球最高效的钢铁生产商之一。成功的经济特区拥有家电制造业。", targetSectors: ["Steel", "Appliances", "Machinery", "Agriculture"], opportunities: [
    { id: "lp-1", title: "NLMK Partnership Opportunities", titleZh: "新利佩茨克合作机会", titleRu: "Возможности партнёрства с НЛМК", sector: "Steel", description: "Steel processing and value-added products.", descriptionZh: "钢材加工和增值产品。", descriptionRu: "Переработка стали и продукция с добавленной стоимостью.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "lp-2", title: "Lipetsk Appliance Cluster", titleZh: "利佩茨克家电产业集群", titleRu: "Липецкий кластер бытовой техники", sector: "Appliances", description: "Home appliance manufacturing (Indesit, etc.).", descriptionZh: "家用电器制造（Indesit等）。", descriptionRu: "Производство бытовой техники (Indesit и др.).", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Steel Capital", titleRu: "Сталелитейная столица", titleZh: "钢铁之都", description: "NLMK - world's most efficient steelmaker.", descriptionRu: "НЛМК — самый эффективный сталелитейщик мира.", descriptionZh: "新利佩茨克钢铁公司——全球最高效的钢铁生产商。" }], contactInfo: { investmentAgency: "Lipetsk Investment Agency", investmentAgencyRu: "Агентство инвестиций Липецкой области", investmentAgencyZh: "利佩茨克州投资局", website: "https://investlipetsk.ru" } },
  "Vologda Oblast": { name: "Vologda Oblast", nameZh: "沃洛格达州", nameRu: "Вологодская область", gdp: "$13 Billion", population: "1.2 Million", sezCount: 1, industries: ["Steel", "Chemicals", "Forestry", "Dairy"], industriesRu: ["Сталь", "Химикаты", "Лесное хозяйство", "Молочная промышленность"], industriesZh: ["钢铁", "化工", "林业", "乳业"], taxBenefits: ["Industrial incentives", "Forestry support"], taxBenefitsRu: ["Промышленные стимулы", "Поддержка лесного хозяйства"], taxBenefitsZh: ["工业激励", "林业支持"], majorCities: [
    { id: "cherepovets", name: "Cherepovets", nameRu: "Череповец", nameZh: "切列波韦茨", population: "0.3M", image: "https://images.unsplash.com/photo-1590244840770-b9a0a36a3a83?w=1920&q=80", description: "Major steel city. Home to Severstal - Russia's leading private steelmaker.", opportunities: [
      { id: "chr-1", title: "Severstal Steel Partnership", titleZh: "北方钢铁合作", titleRu: "Партнёрство с Северсталью", sector: "Steel", description: "Partnership with Russia's leading private steel company.", descriptionZh: "与俄罗斯领先的私营钢铁公司的合作。", descriptionRu: "Партнёрство с ведущей частной сталелитейной компанией России.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "chr-2", title: "Chemical Complex", titleZh: "化工综合体", titleRu: "Химический комплекс", sector: "Chemicals", description: "Fertilizer and chemical production.", descriptionZh: "化肥和化学品生产。", descriptionRu: "Производство удобрений и химикатов.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Major steel and chemical region. Home to Severstal and PhosAgro. Famous for Vologda butter and dairy products.", overviewRu: "Крупный сталелитейный и химический регион. Дом Северстали и ФосАгро. Знаменит вологодским маслом и молочными продуктами.", overviewZh: "主要钢铁和化工地区。北方钢铁公司和磷肥公司的所在地。以沃洛格达黄油和乳制品而闻名。", targetSectors: ["Steel", "Chemicals", "Forestry", "Dairy"], opportunities: [
    { id: "vo-1", title: "Severstal Partnership", titleZh: "北方钢铁合作", titleRu: "Партнёрство с Северсталью", sector: "Steel", description: "Steel processing and downstream products.", descriptionZh: "钢材加工和下游产品。", descriptionRu: "Переработка стали и продукция вниз по цепочке.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "vo-2", title: "Vologda Dairy Export", titleZh: "沃洛格达乳制品出口", titleRu: "Вологодский молочный экспорт", sector: "Dairy", description: "Famous Vologda butter for premium markets.", descriptionZh: "著名的沃洛格达黄油面向高端市场。", descriptionRu: "Знаменитое вологодское масло для премиальных рынков.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Steel Hub", titleRu: "Сталелитейный хаб", titleZh: "钢铁枢纽", description: "Severstal headquarters.", descriptionRu: "Штаб-квартира Северстали.", descriptionZh: "北方钢铁公司总部。" }], contactInfo: { investmentAgency: "Vologda Investment Agency", investmentAgencyRu: "Агентство инвестиций Вологодской области", investmentAgencyZh: "沃洛格达州投资局", website: "https://investvologda.ru" } },
  "Komi Republic": { name: "Komi Republic", nameZh: "科米共和国", nameRu: "Республика Коми", gdp: "$12 Billion", population: "0.8 Million", sezCount: 1, industries: ["Oil & Gas", "Coal", "Forestry", "Mining"], industriesRu: ["Нефть и газ", "Уголь", "Лесное хозяйство", "Горнодобывающая промышленность"], industriesZh: ["石油和天然气", "煤炭", "林业", "采矿"], taxBenefits: ["Northern benefits", "Resource extraction incentives"], taxBenefitsRu: ["Северные льготы", "Стимулы добычи ресурсов"], taxBenefitsZh: ["北方优惠", "资源开采激励"], majorCities: [
    { id: "syktyvkar", name: "Syktyvkar", nameRu: "Сыктывкар", nameZh: "锡克特夫卡尔", population: "0.2M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Capital of vast northern region rich in oil, gas, and timber.", opportunities: [
      { id: "syk-1", title: "Komi Oil & Gas", titleZh: "科米油气", titleRu: "Коми нефтегаз", sector: "Oil & Gas", description: "Oil and gas production in Timan-Pechora basin.", descriptionZh: "蒂曼-伯朝拉盆地的油气生产。", descriptionRu: "Добыча нефти и газа в Тимано-Печорском бассейне.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "active" },
      { id: "syk-2", title: "Komi Forestry", titleZh: "科米林业", titleRu: "Коми лесопромышленность", sector: "Forestry", description: "Timber and pulp production.", descriptionZh: "木材和纸浆生产。", descriptionRu: "Производство древесины и целлюлозы.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Vast northern region with significant oil, gas, coal, and timber resources. Timan-Pechora oil and gas basin.", overviewRu: "Обширный северный регион с значительными запасами нефти, газа, угля и древесины. Тимано-Печорский нефтегазовый бассейн.", overviewZh: "拥有丰富石油、天然气、煤炭和木材资源的广阔北方地区。蒂曼-伯朝拉油气盆地。", targetSectors: ["Oil & Gas", "Coal", "Forestry", "Mining"], opportunities: [
    { id: "km-1", title: "Timan-Pechora Basin Development", titleZh: "蒂曼-伯朝拉盆地开发", titleRu: "Развитие Тимано-Печорского бассейна", sector: "Oil & Gas", description: "Oil and gas production expansion.", descriptionZh: "油气生产扩张。", descriptionRu: "Расширение добычи нефти и газа.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "km-2", title: "Komi Coal Export", titleZh: "科米煤炭出口", titleRu: "Экспорт коми угля", sector: "Coal", description: "Thermal coal mining for export.", descriptionZh: "出口用动力煤开采。", descriptionRu: "Добыча энергетического угля на экспорт.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Resource Rich", titleRu: "Богатые ресурсы", titleZh: "资源丰富", description: "Oil, gas, coal, timber.", descriptionRu: "Нефть, газ, уголь, древесина.", descriptionZh: "石油、天然气、煤炭、木材。" }], contactInfo: { investmentAgency: "Komi Investment Agency", investmentAgencyRu: "Агентство инвестиций Республики Коми", investmentAgencyZh: "科米共和国投资局", website: "https://investkomi.ru" } },
  "Republic of Khakassia": { name: "Republic of Khakassia", nameZh: "哈卡斯共和国", nameRu: "Республика Хакасия", gdp: "$5 Billion", population: "0.5 Million", sezCount: 1, industries: ["Aluminum", "Coal", "Energy", "Agriculture"], industriesRu: ["Алюминий", "Уголь", "Энергетика", "Сельское хозяйство"], industriesZh: ["铝", "煤炭", "能源", "农业"], taxBenefits: ["Energy incentives", "Aluminum support"], taxBenefitsRu: ["Энергетические стимулы", "Поддержка алюминия"], taxBenefitsZh: ["能源激励", "铝业支持"], majorCities: [
    { id: "abakan", name: "Abakan", nameRu: "Абакан", nameZh: "阿巴坎", population: "0.2M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Siberian city with hydropower and aluminum production.", opportunities: [
      { id: "abk-1", title: "Sayano-Shushenskaya Hydropower", titleZh: "萨彦-舒申斯克水电", titleRu: "Саяно-Шушенская ГЭС", sector: "Energy", description: "Russia's largest hydroelectric plant services.", descriptionZh: "俄罗斯最大水电站的服务。", descriptionRu: "Услуги крупнейшей гидроэлектростанции России.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
      { id: "abk-2", title: "Khakassia Aluminum", titleZh: "哈卡斯铝业", titleRu: "Хакасский алюминий", sector: "Aluminum", description: "Aluminum production using cheap hydropower.", descriptionZh: "利用廉价水电的铝生产。", descriptionRu: "Производство алюминия на дешёвой гидроэнергии.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "priority" }
    ]}
  ], overview: "Siberian republic with major hydropower (Sayano-Shushenskaya dam) and aluminum production. Growing coal mining.", overviewRu: "Сибирская республика с крупной гидроэнергией (плотина Саяно-Шушенская) и производством алюминия. Растущая угледобыча.", overviewZh: "拥有大型水电（萨彦-舒申斯克大坝）和铝生产的西伯利亚共和国。煤炭开采不断增长。", targetSectors: ["Aluminum", "Hydropower", "Coal", "Agriculture"], opportunities: [
    { id: "kh-1", title: "Khakassia Aluminum Expansion", titleZh: "哈卡斯铝业扩张", titleRu: "Расширение хакасского алюминия", sector: "Aluminum", description: "Low-cost aluminum production.", descriptionZh: "低成本铝生产。", descriptionRu: "Низкозатратное производство алюминия.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "kh-2", title: "Khakassia Coal Mining", titleZh: "哈卡斯煤矿开采", titleRu: "Хакасская угледобыча", sector: "Coal", description: "Coal mining expansion for Asian export.", descriptionZh: "面向亚洲出口的煤矿扩张。", descriptionRu: "Расширение угледобычи для азиатского экспорта.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Hydropower", titleRu: "Гидроэнергия", titleZh: "水电", description: "Sayano-Shushenskaya - Russia's largest dam.", descriptionRu: "Саяно-Шушенская — крупнейшая плотина России.", descriptionZh: "萨彦-舒申斯克——俄罗斯最大的大坝。" }], contactInfo: { investmentAgency: "Khakassia Investment Agency", investmentAgencyRu: "Агентство инвестиций Республики Хакасия", investmentAgencyZh: "哈卡斯共和国投资局", website: "https://investkhakassia.ru" } },
  "Republic of Adygea": { name: "Republic of Adygea", nameZh: "阿迪格共和国", nameRu: "Республика Адыгея", gdp: "$2 Billion", population: "0.5 Million", sezCount: 0, industries: ["Tourism", "Agriculture", "Food Processing"], industriesRu: ["Туризм", "Сельское хозяйство", "Пищевая промышленность"], industriesZh: ["旅游", "农业", "食品加工"], taxBenefits: ["Tourism incentives", "Agricultural support"], taxBenefitsRu: ["Туристические стимулы", "Поддержка сельского хозяйства"], taxBenefitsZh: ["旅游激励", "农业支持"], majorCities: [
    { id: "maykop", name: "Maykop", nameRu: "Майкоп", nameZh: "迈科普", population: "0.1M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Capital in scenic Caucasus foothills. Growing eco-tourism.", opportunities: [
      { id: "may-1", title: "Caucasus Eco-Tourism", titleZh: "高加索生态旅游", titleRu: "Кавказский экотуризм", sector: "Tourism", description: "Mountain and adventure tourism.", descriptionZh: "山地和探险旅游。", descriptionRu: "Горный и приключенческий туризм.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" },
      { id: "may-2", title: "Adygea Food Processing", titleZh: "阿迪格食品加工", titleRu: "Адыгейская пищепереработка", sector: "Food", description: "Famous Adyghe cheese and dairy.", descriptionZh: "著名的阿迪格奶酪和乳制品。", descriptionRu: "Знаменитый адыгейский сыр и молочная продукция.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Small scenic republic in Caucasus foothills. Famous for Adyghe cheese. Growing eco-tourism and agriculture.", overviewRu: "Небольшая живописная республика в предгорьях Кавказа. Знаменита адыгейским сыром. Растущий экотуризм и сельское хозяйство.", overviewZh: "高加索山麓的小型风景秀丽的共和国。以阿迪格奶酪而闻名。生态旅游和农业不断增长。", targetSectors: ["Eco-Tourism", "Food Processing", "Agriculture"], opportunities: [
    { id: "ad-1", title: "Adygea Tourism Development", titleZh: "阿迪格旅游开发", titleRu: "Развитие туризма Адыгеи", sector: "Tourism", description: "Caucasus mountain tourism.", descriptionZh: "高加索山地旅游。", descriptionRu: "Кавказский горный туризм.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
    { id: "ad-2", title: "Adyghe Cheese Export", titleZh: "阿迪格奶酪出口", titleRu: "Экспорт адыгейского сыра", sector: "Food", description: "Traditional cheese for premium markets.", descriptionZh: "面向高端市场的传统奶酪。", descriptionRu: "Традиционный сыр для премиальных рынков.", investmentRange: "$5M - $40M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caucasus Gateway", titleRu: "Кавказские ворота", titleZh: "高加索门户", description: "Scenic mountain region.", descriptionRu: "Живописный горный регион.", descriptionZh: "风景秀丽的山区。" }], contactInfo: { investmentAgency: "Adygea Investment Agency", investmentAgencyRu: "Агентство инвестиций Республики Адыгея", investmentAgencyZh: "阿迪格共和国投资局", website: "https://investadygea.ru" } },
  "Altai Republic": { name: "Altai Republic", nameZh: "阿尔泰共和国", nameRu: "Республика Алтай", gdp: "$1 Billion", population: "0.2 Million", sezCount: 0, industries: ["Tourism", "Agriculture", "Mining"], industriesRu: ["Туризм", "Сельское хозяйство", "Горнодобывающая промышленность"], industriesZh: ["旅游", "农业", "采矿"], taxBenefits: ["Tourism development support", "Environmental incentives"], taxBenefitsRu: ["Поддержка развития туризма", "Экологические стимулы"], taxBenefitsZh: ["旅游发展支持", "环保激励"], majorCities: [
    { id: "gorno-altaysk", name: "Gorno-Altaysk", nameRu: "Горно-Алтайск", nameZh: "戈尔诺-阿尔泰斯克", population: "0.06M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Gateway to spectacular Altai Mountains - UNESCO World Heritage site.", opportunities: [
      { id: "gor-1", title: "Altai Mountain Tourism", titleZh: "阿尔泰山旅游", titleRu: "Алтайский горный туризм", sector: "Tourism", description: "UNESCO heritage eco-tourism.", descriptionZh: "联合国教科文组织遗产生态旅游。", descriptionRu: "Экотуризм объектов наследия ЮНЕСКО.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "priority" },
      { id: "gor-2", title: "Altai Traditional Medicine", titleZh: "阿尔泰传统医学", titleRu: "Алтайская традиционная медицина", sector: "Health", description: "Traditional healing and health tourism.", descriptionZh: "传统疗法和健康旅游。", descriptionRu: "Традиционное целительство и оздоровительный туризм.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Pristine mountainous region - UNESCO World Heritage. Golden Mountains of Altai with spectacular scenery. Growing eco-tourism.", overviewRu: "Нетронутый горный регион — объект Всемирного наследия ЮНЕСКО. Золотые горы Алтая с потрясающими пейзажами. Растущий экотуризм.", overviewZh: "原始山区——联合国教科文组织世界遗产。阿尔泰金山拥有壮丽的风景。生态旅游不断增长。", targetSectors: ["Eco-Tourism", "Traditional Medicine", "Agriculture"], opportunities: [
    { id: "ar-1", title: "Golden Mountains Tourism", titleZh: "金山旅游", titleRu: "Туризм Золотых гор", sector: "Tourism", description: "UNESCO World Heritage eco-tourism.", descriptionZh: "联合国教科文组织世界遗产生态旅游。", descriptionRu: "Экотуризм объекта Всемирного наследия ЮНЕСКО.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "ar-2", title: "Altai Health Tourism", titleZh: "阿尔泰健康旅游", titleRu: "Алтайский оздоровительный туризм", sector: "Tourism", description: "Traditional medicine and wellness.", descriptionZh: "传统医学和健康养生。", descriptionRu: "Традиционная медицина и оздоровление.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "UNESCO Heritage", titleRu: "Наследие ЮНЕСКО", titleZh: "联合国教科文组织遗产", description: "Golden Mountains of Altai.", descriptionRu: "Золотые горы Алтая.", descriptionZh: "阿尔泰金山。" }], contactInfo: { investmentAgency: "Altai Republic Tourism Agency", investmentAgencyRu: "Агентство туризма Республики Алтай", investmentAgencyZh: "阿尔泰共和国旅游局", website: "https://investaltai-republic.ru" } },
  "Sevastopol": { name: "Sevastopol", nameZh: "塞瓦斯托波尔", nameRu: "Севастополь", gdp: "$2 Billion", population: "0.4 Million", sezCount: 1, industries: ["Shipbuilding", "Tourism", "Fishing", "Wine"], industriesRu: ["Судостроение", "Туризм", "Рыболовство", "Виноделие"], industriesZh: ["造船", "旅游", "渔业", "葡萄酒"], taxBenefits: ["Free economic zone", "Shipbuilding support"], taxBenefitsRu: ["Свободная экономическая зона", "Поддержка судостроения"], taxBenefitsZh: ["自由经济区", "造船支持"], majorCities: [
    { id: "sevastopol-city", name: "Sevastopol", nameRu: "Севастополь", nameZh: "塞瓦斯托波尔", population: "0.4M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Historic naval port and resort city on Black Sea.", opportunities: [
      { id: "sev-1", title: "Sevastopol Shipyard Partnership", titleZh: "塞瓦斯托波尔造船厂合作", titleRu: "Партнёрство с севастопольской верфью", sector: "Shipbuilding", description: "Ship repair and construction.", descriptionZh: "船舶修理和建造。", descriptionRu: "Судоремонт и судостроение.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" },
      { id: "sev-2", title: "Black Sea Tourism", titleZh: "黑海旅游", titleRu: "Черноморский туризм", sector: "Tourism", description: "Beach and heritage tourism.", descriptionZh: "海滩和遗产旅游。", descriptionRu: "Пляжный и наследственный туризм.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Historic Black Sea naval base and resort city. Major shipbuilding and repair. Growing tourism industry.", overviewRu: "Историческая черноморская военно-морская база и курортный город. Крупное судостроение и судоремонт. Растущая туристическая индустрия.", overviewZh: "历史悠久的黑海海军基地和度假城市。主要造船和船舶维修。旅游业不断增长。", targetSectors: ["Shipbuilding", "Ship Repair", "Tourism", "Wine"], opportunities: [
    { id: "sv-1", title: "Sevastopol Shipbuilding", titleZh: "塞瓦斯托波尔造船", titleRu: "Севастопольское судостроение", sector: "Shipbuilding", description: "Civilian shipbuilding and repair.", descriptionZh: "民用造船和修理。", descriptionRu: "Гражданское судостроение и судоремонт.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "active" },
    { id: "sv-2", title: "Sevastopol Tourism", titleZh: "塞瓦斯托波尔旅游", titleRu: "Севастопольский туризм", sector: "Tourism", description: "Historic and beach tourism development.", descriptionZh: "历史和海滩旅游开发。", descriptionRu: "Развитие исторического и пляжного туризма.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Naval Port", titleRu: "Военно-морская база", titleZh: "海军基地", description: "Historic Black Sea naval base.", descriptionRu: "Историческая черноморская военно-морская база.", descriptionZh: "历史悠久的黑海海军基地。" }], contactInfo: { investmentAgency: "Sevastopol Investment Agency", investmentAgencyRu: "Агентство инвестиций Севастополя", investmentAgencyZh: "塞瓦斯托波尔投资局", website: "https://investsevastopol.ru" } },
  "Kursk Oblast": { name: "Kursk Oblast", nameZh: "库尔斯克州", nameRu: "Курская область", gdp: "$11 Billion", population: "1.1 Million", sezCount: 1, industries: ["Iron Ore", "Agriculture", "Food Processing", "Machinery"], industriesRu: ["Железная руда", "Сельское хозяйство", "Пищевая промышленность", "Машиностроение"], industriesZh: ["铁矿石", "农业", "食品加工", "机械"], taxBenefits: ["Mining incentives", "Agricultural support"], taxBenefitsRu: ["Стимулы горнодобычи", "Поддержка сельского хозяйства"], taxBenefitsZh: ["采矿激励", "农业支持"], majorCities: [
    { id: "kursk", name: "Kursk", nameRu: "Курск", nameZh: "库尔斯克", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Center of Russia's iron ore belt. Famous for 1943 tank battle.", opportunities: [
      { id: "kur-1", title: "Kursk Magnetic Anomaly Mining", titleZh: "库尔斯克磁异常采矿", titleRu: "Добыча КМА", sector: "Mining", description: "World's largest iron ore reserve.", descriptionZh: "世界最大的铁矿石储量。", descriptionRu: "Крупнейшие в мире запасы железной руды.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "kur-2", title: "Kursk Agro-Industrial", titleZh: "库尔斯克农工业", titleRu: "Курский агропром", sector: "Agriculture", description: "Grain and sugar beet processing.", descriptionZh: "粮食和甜菜加工。", descriptionRu: "Переработка зерна и сахарной свёклы.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Part of Russia's iron ore belt (Kursk Magnetic Anomaly - world's largest iron ore reserve). Strong agricultural sector.", overviewRu: "Часть железорудного пояса России (Курская магнитная аномалия — крупнейший в мире запас железной руды). Сильный сельскохозяйственный сектор.", overviewZh: "俄罗斯铁矿带的一部分（库尔斯克磁异常——世界最大的铁矿石储量）。农业部门强劲。", targetSectors: ["Iron Ore Mining", "Agriculture", "Food Processing", "Machinery"], opportunities: [
    { id: "ku-1", title: "KMA Iron Ore Development", titleZh: "库尔斯克磁异常铁矿开发", titleRu: "Развитие КМА", sector: "Mining", description: "World's largest iron ore deposits.", descriptionZh: "世界最大的铁矿床。", descriptionRu: "Крупнейшие в мире месторождения железной руды.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ku-2", title: "Kursk Agricultural Hub", titleZh: "库尔斯克农业中心", titleRu: "Курский агрохаб", sector: "Agriculture", description: "Grain and sugar production.", descriptionZh: "粮食和糖生产。", descriptionRu: "Производство зерна и сахара.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Iron Ore Belt", titleRu: "Железорудный пояс", titleZh: "铁矿带", description: "World's largest iron ore reserve.", descriptionRu: "Крупнейший в мире запас железной руды.", descriptionZh: "世界最大的铁矿石储量。" }], contactInfo: { investmentAgency: "Kursk Investment Agency", investmentAgencyRu: "Агентство инвестиций Курска", investmentAgencyZh: "库尔斯克投资局", website: "https://investkursk.ru" } },
  "Bryansk Oblast": { name: "Bryansk Oblast", nameZh: "布良斯克州", nameRu: "Брянская область", gdp: "$9 Billion", population: "1.2 Million", sezCount: 1, industries: ["Rail Equipment", "Machinery", "Agriculture", "Forestry"], industriesRu: ["Железнодорожное оборудование", "Машиностроение", "Сельское хозяйство", "Лесное хозяйство"], industriesZh: ["铁路设备", "机械", "农业", "林业"], taxBenefits: ["Manufacturing incentives", "Border trade support"], taxBenefitsRu: ["Стимулы производства", "Поддержка приграничной торговли"], taxBenefitsZh: ["制造业激励", "边境贸易支持"], majorCities: [
    { id: "bryansk", name: "Bryansk", nameRu: "Брянск", nameZh: "布良斯克", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Rail equipment manufacturing center. Border region with Belarus and Ukraine.", opportunities: [
      { id: "bry-1", title: "Bryansk Rail Equipment", titleZh: "布良斯克铁路设备", titleRu: "Брянское железнодорожное оборудование", sector: "Rail", description: "Freight car and equipment manufacturing.", descriptionZh: "货车和设备制造。", descriptionRu: "Производство грузовых вагонов и оборудования.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
      { id: "bry-2", title: "Bryansk Forestry", titleZh: "布良斯克林业", titleRu: "Брянское лесопользование", sector: "Forestry", description: "Timber processing and furniture.", descriptionZh: "木材加工和家具。", descriptionRu: "Деревообработка и производство мебели.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Rail equipment manufacturing center. Border region with strategic logistics position. Strong forestry sector.", overviewRu: "Центр производства железнодорожного оборудования. Приграничный регион со стратегическим логистическим положением. Сильный лесной сектор.", overviewZh: "铁路设备制造中心。具有战略物流位置的边境地区。林业部门强劲。", targetSectors: ["Rail Equipment", "Machinery", "Forestry", "Agriculture"], opportunities: [
    { id: "bn-1", title: "Bryansk Rail Manufacturing", titleZh: "布良斯克铁路制造", titleRu: "Брянское вагоностроение", sector: "Rail", description: "Freight rail car production.", descriptionZh: "货运车厢生产。", descriptionRu: "Производство грузовых вагонов.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "active" },
    { id: "bn-2", title: "Western Border Logistics", titleZh: "西部边境物流", titleRu: "Западная пограничная логистика", sector: "Logistics", description: "Cross-border logistics hub.", descriptionZh: "跨境物流中心。", descriptionRu: "Трансграничный логистический хаб.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Border Region", titleRu: "Приграничный регион", titleZh: "边境地区", description: "Strategic western location.", descriptionRu: "Стратегическое западное расположение.", descriptionZh: "战略性西部位置。" }], contactInfo: { investmentAgency: "Bryansk Investment Agency", investmentAgencyRu: "Агентство инвестиций Брянска", investmentAgencyZh: "布良斯克投资局", website: "https://investbryansk.ru" } },
  "Kirov Oblast": { name: "Kirov Oblast", nameZh: "基洛夫州", nameRu: "Кировская область", gdp: "$8 Billion", population: "1.3 Million", sezCount: 1, industries: ["Chemicals", "Machinery", "Biotechnology", "Forestry"], industriesRu: ["Химикаты", "Машиностроение", "Биотехнология", "Лесное хозяйство"], industriesZh: ["化工", "机械", "生物技术", "林业"], taxBenefits: ["Biotech incentives", "Manufacturing support"], taxBenefitsRu: ["Стимулы биотехнологии", "Поддержка производства"], taxBenefitsZh: ["生物技术激励", "制造业支持"], majorCities: [
    { id: "kirov", name: "Kirov", nameRu: "Киров", nameZh: "基洛夫", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Chemical and biotech center. Russia's leading biotech cluster.", opportunities: [
      { id: "kir-1", title: "Kirov Biotech Cluster", titleZh: "基洛夫生物技术集群", titleRu: "Кировский биотехкластер", sector: "Biotech", description: "Vaccines and biological products.", descriptionZh: "疫苗和生物制品。", descriptionRu: "Вакцины и биологические препараты.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
      { id: "kir-2", title: "Kirov Chemical Complex", titleZh: "基洛夫化工综合体", titleRu: "Кировский химический комплекс", sector: "Chemicals", description: "Specialty chemicals and fertilizers.", descriptionZh: "特种化学品和化肥。", descriptionRu: "Специализированные химикаты и удобрения.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's biotech capital with vaccine and biological product manufacturing. Strong chemical and machinery sectors.", overviewRu: "Биотехнологическая столица России с производством вакцин и биологических препаратов. Сильные химические и машиностроительные секторы.", overviewZh: "俄罗斯生物技术之都，拥有疫苗和生物制品生产。强大的化工和机械部门。", targetSectors: ["Biotechnology", "Chemicals", "Machinery", "Forestry"], opportunities: [
    { id: "ki-1", title: "Kirov Biotech Hub", titleZh: "基洛夫生物技术中心", titleRu: "Кировский биотехнологический хаб", sector: "Biotech", description: "Vaccine and biological product manufacturing.", descriptionZh: "疫苗和生物制品生产。", descriptionRu: "Производство вакцин и биологических препаратов.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
    { id: "ki-2", title: "Kirov Forest Products", titleZh: "基洛夫林产品", titleRu: "Кировские лесопродукты", sector: "Forestry", description: "Timber and wood products.", descriptionZh: "木材和木制品。", descriptionRu: "Древесина и изделия из дерева.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Biotech Capital", titleRu: "Биотехнологическая столица", titleZh: "生物技术之都", description: "Russia's leading biotech cluster.", descriptionRu: "Ведущий биотехнологический кластер России.", descriptionZh: "俄罗斯领先的生物技术集群。" }], contactInfo: { investmentAgency: "Kirov Investment Agency", investmentAgencyRu: "Агентство инвестиций Кирова", investmentAgencyZh: "基洛夫投资局", website: "https://investkirov.ru" } },
  "Chechen Republic": { name: "Chechen Republic", nameZh: "车臣共和国", nameRu: "Чеченская Республика", gdp: "$3 Billion", population: "1.5 Million", sezCount: 1, industries: ["Construction", "Agriculture", "Tourism", "Oil"], industriesRu: ["Строительство", "Сельское хозяйство", "Туризм", "Нефть"], industriesZh: ["建筑", "农业", "旅游", "石油"], taxBenefits: ["North Caucasus incentives", "Reconstruction support"], taxBenefitsRu: ["Льготы Северного Кавказа", "Поддержка реконструкции"], taxBenefitsZh: ["北高加索激励", "重建支持"], majorCities: [
    { id: "grozny", name: "Grozny", nameRu: "Грозный", nameZh: "格罗兹尼", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Rebuilt capital. Modern city with ambitious construction projects.", opportunities: [
      { id: "grz-1", title: "Grozny City Development", titleZh: "格罗兹尼城市开发", titleRu: "Развитие города Грозный", sector: "Construction", description: "Modern construction and urban development.", descriptionZh: "现代建筑和城市发展。", descriptionRu: "Современное строительство и городское развитие.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "grz-2", title: "Chechnya Tourism", titleZh: "车臣旅游", titleRu: "Чеченский туризм", sector: "Tourism", description: "Mountain and cultural tourism.", descriptionZh: "山地和文化旅游。", descriptionRu: "Горный и культурный туризм.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Rapidly reconstructed republic with modern Grozny. Growing construction, tourism, and agriculture sectors.", overviewRu: "Быстро восстановленная республика с современным Грозным. Растущие строительство, туризм и сельскохозяйственные секторы.", overviewZh: "快速重建的共和国，拥有现代化的格罗兹尼。建筑、旅游和农业部门不断增长。", targetSectors: ["Construction", "Tourism", "Agriculture", "Oil Services"], opportunities: [
    { id: "cc-1", title: "Chechnya Development Projects", titleZh: "车臣发展项目", titleRu: "Проекты развития Чечни", sector: "Construction", description: "Infrastructure and urban development.", descriptionZh: "基础设施和城市发展。", descriptionRu: "Инфраструктура и городское развитие.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "priority" },
    { id: "cc-2", title: "Caucasus Mountain Tourism", titleZh: "高加索山旅游", titleRu: "Кавказский горный туризм", sector: "Tourism", description: "Mountain resort development.", descriptionZh: "山地度假村开发。", descriptionRu: "Развитие горных курортов.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caucasus Mountains", titleRu: "Кавказские горы", titleZh: "高加索山脉", description: "Growing tourism destination.", descriptionRu: "Растущее туристическое направление.", descriptionZh: "不断增长的旅游目的地。" }], contactInfo: { investmentAgency: "Chechnya Investment Agency", investmentAgencyRu: "Агентство инвестиций Чечни", investmentAgencyZh: "车臣投资局", website: "https://investchechnya.ru" } },
  "Kabardino-Balkarian Republic": { name: "Kabardino-Balkarian Republic", nameZh: "卡巴尔达-巴尔卡尔共和国", nameRu: "Кабардино-Балкарская Республика", gdp: "$3 Billion", population: "0.9 Million", sezCount: 1, industries: ["Tourism", "Agriculture", "Mining", "Manufacturing"], industriesRu: ["Туризм", "Сельское хозяйство", "Горнодобывающая промышленность", "Производство"], industriesZh: ["旅游", "农业", "采矿", "制造业"], taxBenefits: ["North Caucasus incentives", "Tourism support"], taxBenefitsRu: ["Льготы Северного Кавказа", "Поддержка туризма"], taxBenefitsZh: ["北高加索激励", "旅游支持"], majorCities: [
     { id: "nalchik", name: "Nalchik", nameRu: "Нальчик", nameZh: "纳尔奇克", population: "0.2M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Spa resort city at foot of Mount Elbrus - Europe's highest peak.", opportunities: [
      { id: "nal-1", title: "Elbrus Ski Resort", titleZh: "厄尔布鲁士滑雪度假村", titleRu: "Горнолыжный курорт Эльбрус", sector: "Tourism", description: "Ski resort at Europe's highest mountain.", descriptionZh: "欧洲最高山峰的滑雪度假村。", descriptionRu: "Горнолыжный курорт на высочайшей вершине Европы.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
      { id: "nal-2", title: "Nalchik Spa Tourism", titleZh: "纳尔奇克温泉旅游", titleRu: "Нальчикский спа-туризм", sector: "Tourism", description: "Historic spa resort development.", descriptionZh: "历史悠久的温泉度假村开发。", descriptionRu: "Развитие исторического курорта.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
   ], overview: "Home to Mount Elbrus - Europe's highest peak. Major ski and spa tourism destination. Growing manufacturing.", overviewRu: "Дом Эльбруса - высочайшей вершины Европы. Крупный центр горнолыжного и спа-туризма. Растущее производство.", overviewZh: "欧洲最高峰厄尔布鲁士山的所在地。主要滑雪和温泉旅游目的地。不断增长的制造业。", targetSectors: ["Ski Tourism", "Spa Tourism", "Agriculture", "Manufacturing"], opportunities: [
    { id: "kb-1", title: "Mount Elbrus Tourism", titleZh: "厄尔布鲁士山旅游", titleRu: "Туризм на Эльбрусе", sector: "Tourism", description: "Europe's highest peak ski and adventure tourism.", descriptionZh: "欧洲最高峰的滑雪和探险旅游。", descriptionRu: "Горнолыжный и приключенческий туризм на высочайшей вершине Европы.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "kb-2", title: "Kabardino-Balkaria Agriculture", titleZh: "卡巴尔达-巴尔卡尔农业", titleRu: "Сельское хозяйство КБР", sector: "Agriculture", description: "Fruit and grain production.", descriptionZh: "水果和粮食生产。", descriptionRu: "Производство фруктов и зерна.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
   ], keyProjects: [], advantages: [{ icon: "location", title: "Mount Elbrus", titleRu: "Гора Эльбрус", titleZh: "厄尔布鲁士山", description: "Europe's highest peak.", descriptionRu: "Высочайшая вершина Европы.", descriptionZh: "欧洲最高峰。" }], contactInfo: { investmentAgency: "KBR Investment Agency", investmentAgencyRu: "Инвестиционное агентство КБР", investmentAgencyZh: "卡巴尔达-巴尔卡尔投资局", website: "https://investkbr.ru" } },
  "Republic of North Ossetia-Alania": { name: "Republic of North Ossetia-Alania", nameZh: "北奥塞梯-阿兰共和国", nameRu: "Республика Северная Осетия — Алания", gdp: "$3 Billion", population: "0.7 Million", sezCount: 1, industries: ["Mining", "Manufacturing", "Agriculture", "Tourism"], industriesRu: ["Горнодобывающая промышленность", "Производство", "Сельское хозяйство", "Туризм"], industriesZh: ["采矿", "制造业", "农业", "旅游"], taxBenefits: ["North Caucasus incentives", "Mining support"], taxBenefitsRu: ["Льготы Северного Кавказа", "Поддержка горнодобычи"], taxBenefitsZh: ["北高加索激励", "采矿支持"], majorCities: [
     { id: "vladikavkaz", name: "Vladikavkaz", nameRu: "Владикавказ", nameZh: "弗拉季卡夫卡兹", population: "0.3M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Gateway to Georgia via historic Georgian Military Highway.", opportunities: [
      { id: "vlk-1", title: "North Ossetia Mining", titleZh: "北奥塞梯采矿", titleRu: "Североосетинская горнодобыча", sector: "Mining", description: "Lead, zinc, and polymetallic mining.", descriptionZh: "铅、锌和多金属矿开采。", descriptionRu: "Добыча свинца, цинка и полиметаллических руд.", investmentRange: "$25M - $220M", timeline: "3-5 years", status: "active" },
      { id: "vlk-2", title: "Trans-Caucasus Logistics", titleZh: "跨高加索物流", titleRu: "Транскавказская логистика", sector: "Logistics", description: "Trade corridor to Georgia and Armenia.", descriptionZh: "通往格鲁吉亚和亚美尼亚的贸易走廊。", descriptionRu: "Торговый коридор в Грузию и Армению.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
   ], overview: "Strategic location on Georgian border. Mining and metallurgy. Historic cultural heritage.", overviewRu: "Стратегическое расположение на границе с Грузией. Горнодобыча и металлургия. Историческое культурное наследие.", overviewZh: "格鲁吉亚边境的战略位置。采矿和冶金。历史文化遗产。", targetSectors: ["Mining", "Logistics", "Manufacturing", "Tourism"], opportunities: [
    { id: "no-1", title: "North Ossetia Mining Development", titleZh: "北奥塞梯矿业开发", titleRu: "Развитие горнодобычи Северной Осетии", sector: "Mining", description: "Polymetallic ore development.", descriptionZh: "多金属矿石开发。", descriptionRu: "Освоение полиметаллических руд.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" },
    { id: "no-2", title: "Georgian Highway Corridor", titleZh: "格鲁吉亚公路走廊", titleRu: "Коридор Военно-Грузинской дороги", sector: "Logistics", description: "Trade and transit corridor.", descriptionZh: "贸易和过境走廊。", descriptionRu: "Торговый и транзитный коридор.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" }
   ], keyProjects: [], advantages: [{ icon: "location", title: "Georgia Gateway", titleRu: "Грузинские ворота", titleZh: "格鲁吉亚门户", description: "Strategic trans-Caucasus location.", descriptionRu: "Стратегическое трансказахское расположение.", descriptionZh: "战略性跨高加索位置。" }], contactInfo: { investmentAgency: "North Ossetia Investment Agency", investmentAgencyRu: "Инвестиционное агентство Северной Осетии", investmentAgencyZh: "北奥塞梯投资局", website: "https://investosetia.ru" } },
  "Republic of Kalmykia": { name: "Republic of Kalmykia", nameZh: "卡尔梅克共和国", nameRu: "Республика Калмыкия", gdp: "$2 Billion", population: "0.3 Million", sezCount: 0, industries: ["Agriculture", "Oil & Gas", "Tourism"], industriesRu: ["Сельское хозяйство", "Нефть и газ", "Туризм"], industriesZh: ["农业", "石油和天然气", "旅游"], taxBenefits: ["Agricultural subsidies", "Steppe development support"], taxBenefitsRu: ["Сельскохозяйственные субсидии", "Поддержка развития степей"], taxBenefitsZh: ["农业补贴", "草原发展支持"], majorCities: [
     { id: "elista", name: "Elista", nameRu: "Элиста", nameZh: "埃利斯塔", population: "0.1M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Europe's only Buddhist capital. Chess City complex.", opportunities: [
      { id: "eli-1", title: "Kalmykia Livestock", titleZh: "卡尔梅克畜牧业", titleRu: "Калмыцкое животноводство", sector: "Agriculture", description: "Traditional cattle and sheep farming.", descriptionZh: "传统牛羊养殖。", descriptionRu: "Традиционное разведение крупного рогатого скота и овец.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" },
      { id: "eli-2", title: "Buddhist Cultural Tourism", titleZh: "佛教文化旅游", titleRu: "Буддийский культурный туризм", sector: "Tourism", description: "Unique Buddhist heritage in Europe.", descriptionZh: "欧洲独特的佛教遗产。", descriptionRu: "Уникальное буддийское наследие в Европе.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
   ], overview: "Europe's only Buddhist region with unique Mongolic culture. Steppe agriculture and growing oil production.", overviewRu: "Единственный буддийский регион Европы с уникальной монгольской культурой. Степное сельское хозяйство и растущая нефтедобыча.", overviewZh: "欧洲唯一的佛教地区，拥有独特的蒙古文化。草原农业和不断增长的石油生产。", targetSectors: ["Livestock", "Oil & Gas", "Cultural Tourism"], opportunities: [
    { id: "kl-1", title: "Kalmykia Agriculture", titleZh: "卡尔梅克农业", titleRu: "Калмыцкое сельское хозяйство", sector: "Agriculture", description: "Livestock and wool production.", descriptionZh: "畜牧和羊毛生产。", descriptionRu: "Животноводство и производство шерсти.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
    { id: "kl-2", title: "Kalmykia Oil Development", titleZh: "卡尔梅克石油开发", titleRu: "Нефтедобыча Калмыкии", sector: "Oil", description: "Oil exploration and production.", descriptionZh: "石油勘探和生产。", descriptionRu: "Разведка и добыча нефти.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Buddhist Europe", titleRu: "Буддийская Европа", titleZh: "佛教欧洲", description: "Europe's only Buddhist region.", descriptionRu: "Единственный буддийский регион Европы.", descriptionZh: "欧洲唯一的佛教地区。" }], contactInfo: { investmentAgency: "Kalmykia Investment Agency", investmentAgencyRu: "Инвестиционное агентство Калмыкии", investmentAgencyZh: "卡尔梅克投资局", website: "https://investkalmykia.ru" } },
  "Mari El Republic": { name: "Mari El Republic", nameZh: "马里埃尔共和国", nameRu: "Республика Марий Эл", gdp: "$4 Billion", population: "0.7 Million", sezCount: 1, industries: ["Machinery", "Forestry", "Agriculture", "IT"], industriesRu: ["Машиностроение", "Лесное хозяйство", "Сельское хозяйство", "ИТ"], industriesZh: ["机械", "林业", "农业", "信息技术"], taxBenefits: ["Manufacturing incentives", "Forestry support"], taxBenefitsRu: ["Стимулы производства", "Поддержка лесного хозяйства"], taxBenefitsZh: ["制造业激励", "林业支持"], majorCities: [
    { id: "yoshkar-ola", name: "Yoshkar-Ola", nameRu: "Йошкар-Ола", nameZh: "约什卡-奥拉", population: "0.3M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Picturesque city with unique Flemish-style architecture.", opportunities: [
      { id: "yos-1", title: "Mari El Machinery", titleZh: "马里埃尔机械", titleRu: "Марийское машиностроение", sector: "Machinery", description: "Precision machinery manufacturing.", descriptionZh: "精密机械制造。", descriptionRu: "Производство точного машиностроения.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "yos-2", title: "Mari El Forestry", titleZh: "马里埃尔林业", titleRu: "Марийское лесопользование", sector: "Forestry", description: "Sustainable timber production.", descriptionZh: "可持续木材生产。", descriptionRu: "Устойчивое лесопользование.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Volga region with strong machinery and forestry industries. Unique architecture and growing IT sector.", overviewRu: "Волжский регион с сильной машиностроительной и лесной промышленностью. Уникальная архитектура и растущий ИТ-сектор.", overviewZh: "伏尔加地区拥有强大的机械和林业产业。独特的建筑和不断增长的信息技术部门。", targetSectors: ["Machinery", "Forestry", "IT", "Agriculture"], opportunities: [
    { id: "me-1", title: "Mari El Industrial Park", titleZh: "马里埃尔工业园区", titleRu: "Марийский индустриальный парк", sector: "Manufacturing", description: "Machinery and equipment production.", descriptionZh: "机械和设备生产。", descriptionRu: "Производство машин и оборудования.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "me-2", title: "Volga Forestry Complex", titleZh: "伏尔加林业综合体", titleRu: "Волжский лесопромышленный комплекс", sector: "Forestry", description: "Timber and wood processing.", descriptionZh: "木材加工。", descriptionRu: "Деревообработка.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Forest Resources", titleRu: "Лесные ресурсы", titleZh: "森林资源", description: "Rich timber reserves.", descriptionRu: "Богатые лесные запасы.", descriptionZh: "丰富的木材储备。" }], contactInfo: { investmentAgency: "Mari El Investment Agency", investmentAgencyRu: "Инвестиционное агентство Марий Эл", investmentAgencyZh: "马里埃尔投资局", website: "https://investmariel.ru" } },
  "Tuva Republic": { name: "Tuva Republic", nameZh: "图瓦共和国", nameRu: "Республика Тыва", gdp: "$2 Billion", population: "0.3 Million", sezCount: 0, industries: ["Mining", "Agriculture", "Tourism"], industriesRu: ["Горнодобывающая промышленность", "Сельское хозяйство", "Туризм"], industriesZh: ["采矿", "农业", "旅游"], taxBenefits: ["Mining incentives", "Border zone benefits"], taxBenefitsRu: ["Стимулы горнодобычи", "Льготы пограничной зоны"], taxBenefitsZh: ["采矿激励", "边境区优惠"], majorCities: [
    { id: "kyzyl", name: "Kyzyl", nameRu: "Кызыл", nameZh: "基济尔", population: "0.1M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Geographic center of Asia. Unique nomadic culture on Mongolian border.", opportunities: [
      { id: "kyz-1", title: "Tuva Mining Development", titleZh: "图瓦矿业开发", titleRu: "Развитие горнодобычи Тувы", sector: "Mining", description: "Coal and rare earth mining.", descriptionZh: "煤炭和稀土开采。", descriptionRu: "Добыча угля и редкоземельных металлов.", investmentRange: "$25M - $250M", timeline: "3-5 years", status: "priority" },
      { id: "kyz-2", title: "Tuva Adventure Tourism", titleZh: "图瓦探险旅游", titleRu: "Тувинский приключенческий туризм", sector: "Tourism", description: "Nomadic culture and nature tourism.", descriptionZh: "游牧文化和自然旅游。", descriptionRu: "Туризм кочевой культуры и природы.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Remote republic at geographic center of Asia. Rich mineral deposits. Unique nomadic Turkic-Buddhist culture.", overviewRu: "Удалённая республика в географическом центре Азии. Богатые месторождения полезных ископаемых. Уникальная кочевая тюркско-буддийская культура.", overviewZh: "亚洲地理中心的偏远共和国。丰富的矿产资源。独特的游牧突厥-佛教文化。", targetSectors: ["Mining", "Adventure Tourism", "Agriculture"], opportunities: [
    { id: "tv-1", title: "Tuva Coal and Minerals", titleZh: "图瓦煤炭和矿产", titleRu: "Тувинский уголь и минералы", sector: "Mining", description: "Coal and mineral extraction.", descriptionZh: "煤炭和矿物开采。", descriptionRu: "Добыча угля и минералов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
    { id: "tv-2", title: "Center of Asia Tourism", titleZh: "亚洲中心旅游", titleRu: "Туризм Центра Азии", sector: "Tourism", description: "Geographic center of Asia experience.", descriptionZh: "亚洲地理中心体验。", descriptionRu: "Опыт географического центра Азии.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Center of Asia", titleRu: "Центр Азии", titleZh: "亚洲中心", description: "Geographic center of Asia.", descriptionRu: "Географический центр Азии.", descriptionZh: "亚洲地理中心。" }], contactInfo: { investmentAgency: "Tuva Investment Agency", investmentAgencyRu: "Инвестиционное агентство Тувы", investmentAgencyZh: "图瓦投资局", website: "https://investtuva.ru" } },
  "Ivanovo Oblast": { name: "Ivanovo Oblast", nameZh: "伊万诺沃州", nameRu: "Ивановская область", gdp: "$5 Billion", population: "1.0 Million", sezCount: 1, industries: ["Textiles", "Machinery", "Food Processing"], industriesRu: ["Текстиль", "Машиностроение", "Пищевая промышленность"], industriesZh: ["纺织", "机械", "食品加工"], taxBenefits: ["Textile industry support", "Manufacturing incentives"], taxBenefitsRu: ["Поддержка текстильной промышленности", "Стимулы производства"], taxBenefitsZh: ["纺织业支持", "制造业激励"], majorCities: [
    { id: "ivanovo", name: "Ivanovo", nameRu: "Иваново", nameZh: "伊万诺沃", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Historic Russian textile capital. 'City of Brides' nickname.", opportunities: [
      { id: "ivn-1", title: "Ivanovo Textile Revival", titleZh: "伊万诺沃纺织复兴", titleRu: "Возрождение ивановского текстиля", sector: "Textiles", description: "Modern textile and fashion production.", descriptionZh: "现代纺织和时尚生产。", descriptionRu: "Современное текстильное и модное производство.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "ivn-2", title: "Ivanovo Machinery", titleZh: "伊万诺沃机械", titleRu: "Ивановское машиностроение", sector: "Machinery", description: "Textile and industrial machinery.", descriptionZh: "纺织和工业机械。", descriptionRu: "Текстильное и промышленное машиностроение.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Historic Russian textile capital. Strong machinery and food processing industries. Golden Ring heritage.", overviewRu: "Исторический русский текстильный центр. Сильная машиностроительная и пищевая промышленность. Наследие Золотого кольца.", overviewZh: "历史悠久的俄罗斯纺织中心。强大的机械和食品加工产业。金环遗产。", targetSectors: ["Textiles", "Machinery", "Food Processing", "Tourism"], opportunities: [
    { id: "iv-1", title: "Russian Textile Hub", titleZh: "俄罗斯纺织中心", titleRu: "Российский текстильный хаб", sector: "Textiles", description: "Textile manufacturing revival.", descriptionZh: "纺织制造业复兴。", descriptionRu: "Возрождение текстильного производства.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "iv-2", title: "Golden Ring Tourism", titleZh: "金环旅游", titleRu: "Туризм Золотого кольца", sector: "Tourism", description: "Heritage tourism development.", descriptionZh: "遗产旅游开发。", descriptionRu: "Развитие наследственного туризма.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Textile Capital", titleRu: "Текстильная столица", titleZh: "纺织之都", description: "Historic Russian textile center.", descriptionRu: "Исторический русский текстильный центр.", descriptionZh: "历史悠久的俄罗斯纺织中心。" }], contactInfo: { investmentAgency: "Ivanovo Investment Agency", investmentAgencyRu: "Инвестиционное агентство Иванова", investmentAgencyZh: "伊万诺沃投资局", website: "https://investivanovo.ru" } },
  "Ryazan Oblast": { name: "Ryazan Oblast", nameZh: "梁赞州", nameRu: "Рязанская область", gdp: "$9 Billion", population: "1.1 Million", sezCount: 1, industries: ["Oil Refining", "Machinery", "Agriculture", "Electronics"], industriesRu: ["Нефтепереработка", "Машиностроение", "Сельское хозяйство", "Электроника"], industriesZh: ["炼油", "机械", "农业", "电子"], taxBenefits: ["SEZ benefits", "Oil industry support"], taxBenefitsRu: ["Льготы ОЭЗ", "Поддержка нефтяной промышленности"], taxBenefitsZh: ["经济特区优惠", "石油工业支持"], majorCities: [
    { id: "ryazan", name: "Ryazan", nameRu: "Рязань", nameZh: "梁赞", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Major oil refining center near Moscow. Historic Kremlin.", opportunities: [
      { id: "ryz-1", title: "Ryazan Oil Refinery", titleZh: "梁赞炼油厂", titleRu: "Рязанский НПЗ", sector: "Oil Refining", description: "Rosneft refinery expansion.", descriptionZh: "俄油炼油厂扩建。", descriptionRu: "Расширение НПЗ Роснефти.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "ryz-2", title: "Ryazan Electronics", titleZh: "梁赞电子", titleRu: "Рязанская электроника", sector: "Electronics", description: "Electronics and radio equipment.", descriptionZh: "电子和无线电设备。", descriptionRu: "Электроника и радиооборудование.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Major oil refining hub near Moscow. Strong electronics and machinery industries. Historic Golden Ring city.", overviewRu: "Крупный центр нефтепереработки рядом с Москвой. Сильные электроника и машиностроение. Исторический город Золотого кольца.", overviewZh: "莫斯科附近的主要炼油中心。电子和机械工业强劲。历史悠久的金环城市。", targetSectors: ["Oil Refining", "Electronics", "Machinery", "Agriculture"], opportunities: [
    { id: "ry-1", title: "Ryazan Petrochemical Complex", titleZh: "梁赞石化综合体", titleRu: "Рязанский нефтехимический комплекс", sector: "Petrochemicals", description: "Oil refining and petrochemicals.", descriptionZh: "炼油和石化。", descriptionRu: "Нефтепереработка и нефтехимия.", investmentRange: "$50M - $450M", timeline: "3-5 years", status: "priority" },
    { id: "ry-2", title: "Central Russia Logistics", titleZh: "俄罗斯中部物流", titleRu: "Логистика Центральной России", sector: "Logistics", description: "Distribution near Moscow.", descriptionZh: "莫斯科附近的分销。", descriptionRu: "Дистрибуция под Москвой.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Refining Hub", titleRu: "Центр нефтепереработки", titleZh: "炼油中心", description: "Major oil refining center.", descriptionRu: "Крупный центр нефтепереработки.", descriptionZh: "主要炼油中心。" }], contactInfo: { investmentAgency: "Ryazan Investment Agency", investmentAgencyRu: "Агентство инвестиций Рязани", investmentAgencyZh: "梁赞投资局", website: "https://investryazan.ru" } },
  "Penza Oblast": { name: "Penza Oblast", nameZh: "奔萨州", nameRu: "Пензенская область", gdp: "$7 Billion", population: "1.3 Million", sezCount: 1, industries: ["Machinery", "Food Processing", "Paper", "Electronics"], industriesRu: ["Машиностроение", "Пищевая промышленность", "Бумажная промышленность", "Электроника"], industriesZh: ["机械", "食品加工", "造纸", "电子"], taxBenefits: ["Manufacturing incentives", "Agricultural support"], taxBenefitsRu: ["Стимулы производства", "Поддержка сельского хозяйства"], taxBenefitsZh: ["制造业激励", "农业支持"], majorCities: [
    { id: "penza", name: "Penza", nameRu: "Пенза", nameZh: "奔萨", population: "0.5M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Industrial city with strong machinery and food processing.", opportunities: [
      { id: "pnz-1", title: "Penza Machinery Cluster", titleZh: "奔萨机械集群", titleRu: "Пензенский машиностроительный кластер", sector: "Machinery", description: "Precision and industrial machinery.", descriptionZh: "精密和工业机械。", descriptionRu: "Точное и промышленное машиностроение.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "pnz-2", title: "Penza Food Processing", titleZh: "奔萨食品加工", titleRu: "Пензенская пищепереработка", sector: "Food", description: "Confectionery and food products.", descriptionZh: "糖果和食品产品。", descriptionRu: "Кондитерские и продовольственные товары.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Central Russian industrial center. Strong machinery, food processing, and paper industries.", overviewRu: "Центр промышленности Центральной России. Сильное машиностроение, пищевая промышленность и бумажная промышленность.", overviewZh: "俄罗斯中部工业中心。机械、食品加工和造纸工业强劲。", targetSectors: ["Machinery", "Food Processing", "Paper", "Electronics"], opportunities: [
    { id: "pz-1", title: "Penza Industrial Development", titleZh: "奔萨工业发展", titleRu: "Промышленное развитие Пензы", sector: "Manufacturing", description: "Diversified manufacturing hub.", descriptionZh: "多元化制造中心。", descriptionRu: "Диверсифицированный производственный хаб.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "pz-2", title: "Volga Food Hub", titleZh: "伏尔加食品中心", titleRu: "Волжский продовольственный хаб", sector: "Food", description: "Food processing for central Russia.", descriptionZh: "俄罗斯中部食品加工。", descriptionRu: "Пищевая переработка для центральной России.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Industrial Center", titleRu: "Промышленный центр", titleZh: "工业中心", description: "Diversified manufacturing base.", descriptionRu: "Диверсифицированная производственная база.", descriptionZh: "多元化制造基地。" }], contactInfo: { investmentAgency: "Penza Investment Agency", investmentAgencyRu: "Агентство инвестиций Пензы", investmentAgencyZh: "奔萨投资局", website: "https://investpenza.ru" } },
  "Smolensk Oblast": { name: "Smolensk Oblast", nameZh: "斯摩棱斯克州", nameRu: "Смоленская область", gdp: "$8 Billion", population: "0.9 Million", sezCount: 1, industries: ["Logistics", "Machinery", "Agriculture", "Diamonds"], industriesRu: ["Логистика", "Машиностроение", "Сельское хозяйство", "Алмазы"], industriesZh: ["物流", "机械", "农业", "钻石"], taxBenefits: ["Border zone benefits", "Logistics incentives"], taxBenefitsRu: ["Льготы приграничной зоны", "Стимулы логистики"], taxBenefitsZh: ["边境区优惠", "物流激励"], majorCities: [
    { id: "smolensk", name: "Smolensk", nameRu: "Смоленск", nameZh: "斯摩棱斯克", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Strategic western gateway. Historic fortress city on Belarus border.", opportunities: [
      { id: "smo-1", title: "Smolensk Logistics Hub", titleZh: "斯摩棱斯克物流中心", titleRu: "Смоленский логистический хаб", sector: "Logistics", description: "Western gateway logistics.", descriptionZh: "西部门户物流。", descriptionRu: "Логистика западных ворот.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "priority" },
      { id: "smo-2", title: "Kristall Diamond Polishing", titleZh: "水晶钻石抛光", titleRu: "Бриллиантовая огранка Кристалл", sector: "Diamonds", description: "Diamond cutting and polishing.", descriptionZh: "钻石切割和抛光。", descriptionRu: "Огранка и полировка бриллиантов.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Strategic western gateway on Moscow-Minsk corridor. Diamond cutting industry. Strong logistics potential.", overviewRu: "Стратегические западные ворота на коридоре Москва-Минск. Алмазная огранка. Сильный потенциал логистики.", overviewZh: "莫斯科-明斯克走廊上的战略西部门户。钻石切割业。强大的物流潜力。", targetSectors: ["Logistics", "Diamond Processing", "Machinery", "Agriculture"], opportunities: [
    { id: "sm-1", title: "Western Corridor Logistics", titleZh: "西部走廊物流", titleRu: "Логистика западного коридора", sector: "Logistics", description: "Moscow-Europe logistics hub.", descriptionZh: "莫斯科-欧洲物流中心。", descriptionRu: "Логистический хаб Москва-Европа.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "priority" },
    { id: "sm-2", title: "Smolensk Diamond Industry", titleZh: "斯摩棱斯克钻石产业", titleRu: "Смоленская бриллиантовая промышленность", sector: "Diamonds", description: "Diamond processing expansion.", descriptionZh: "钻石加工扩张。", descriptionRu: "Расширение бриллиантовой обработки.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Western Gateway", titleRu: "Западные ворота", titleZh: "西部门户", description: "Strategic Moscow-Europe corridor.", descriptionRu: "Стратегический коридор Москва-Европа.", descriptionZh: "战略性莫斯科-欧洲走廊。" }], contactInfo: { investmentAgency: "Smolensk Investment Agency", investmentAgencyRu: "Агентство инвестиций Смоленска", investmentAgencyZh: "斯摩棱斯克投资局", website: "https://investsmolensk.ru" } },
  "Ulyanovsk Oblast": { name: "Ulyanovsk Oblast", nameZh: "乌里扬诺夫斯克州", nameRu: "Ульяновская область", gdp: "$10 Billion", population: "1.2 Million", sezCount: 2, industries: ["Aviation", "Automotive", "Nuclear", "IT"], industriesRu: ["Авиация", "Автомобилестроение", "Ядерная энергия", "IT"], industriesZh: ["航空", "汽车", "核能", "信息技术"], taxBenefits: ["SEZ tax holidays", "Aviation incentives"], taxBenefitsRu: ["Налоговые каникулы ОЭЗ", "Стимулы авиации"], taxBenefitsZh: ["经济特区税收假期", "航空激励"], majorCities: [
    { id: "ulyanovsk", name: "Ulyanovsk", nameRu: "Ульяновск", nameZh: "乌里扬诺夫斯克", population: "0.6M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Aviation capital. Birthplace of Lenin. UAZ automotive and Aviastar aircraft.", opportunities: [
      { id: "uly-1", title: "Aviastar Aircraft Partnership", titleZh: "航星飞机合作", titleRu: "Партнёрство с Авиастаром", sector: "Aviation", description: "Large cargo and passenger aircraft.", descriptionZh: "大型货运和客运飞机。", descriptionRu: "Крупные грузовые и пассажирские самолёты.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "uly-2", title: "UAZ Automotive Partnership", titleZh: "瓦兹汽车合作", titleRu: "Партнёрство с УАЗом", sector: "Automotive", description: "SUV and commercial vehicle production.", descriptionZh: "SUV和商用车生产。", descriptionRu: "Производство внедорожников и коммерческих автомобилей.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's aviation center with Aviastar (IL-76, TU-204). UAZ automotive. Nuclear industry cluster.", overviewRu: "Авиационный центр России с Авиастаром (IL-76, TU-204). Автомобилестроение УАЗ. Кластер ядерной промышленности.", overviewZh: "俄罗斯航空中心，拥有Aviastar（IL-76、TU-204）。UAZ汽车。核工业集群。", targetSectors: ["Aviation", "Automotive", "Nuclear", "IT"], opportunities: [
    { id: "ul-1", title: "Ulyanovsk Aviation Cluster", titleZh: "乌里扬诺夫斯克航空集群", titleRu: "Ульяновский авиационный кластер", sector: "Aviation", description: "Aircraft manufacturing and MRO.", descriptionZh: "飞机制造和维修。", descriptionRu: "Авиастроение и ТОиР.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ul-2", title: "Ulyanovsk Automotive SEZ", titleZh: "乌里扬诺夫斯克汽车经济特区", titleRu: "Ульяновская автомобильная ОЭЗ", sector: "Automotive", description: "Automotive component production.", descriptionZh: "汽车零部件生产。", descriptionRu: "Производство автокомпонентов.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Aviation Capital", titleRu: "Авиационная столица", titleZh: "航空之都", description: "Major aircraft manufacturing.", descriptionRu: "Крупное авиастроение.", descriptionZh: "主要飞机制造。" }], contactInfo: { investmentAgency: "Ulyanovsk Investment Agency", investmentAgencyRu: "Агентство инвестиций Ульяновска", investmentAgencyZh: "乌里扬诺夫斯克投资局", website: "https://investulyanovsk.ru" } },
  "Pskov Oblast": { name: "Pskov Oblast", nameZh: "普斯科夫州", nameRu: "Псковская область", gdp: "$4 Billion", population: "0.6 Million", sezCount: 1, industries: ["Logistics", "Agriculture", "Tourism", "Manufacturing"], industriesRu: ["Логистика", "Сельское хозяйство", "Туризм", "Производство"], industriesZh: ["物流", "农业", "旅游", "制造业"], taxBenefits: ["Border zone benefits", "EU proximity incentives"], taxBenefitsRu: ["Льготы приграничной зоны", "Стимулы близости к ЕС"], taxBenefitsZh: ["边境区优惠", "欧盟邻近激励"], majorCities: [
    { id: "pskov", name: "Pskov", nameRu: "Псков", nameZh: "普斯科夫", population: "0.2M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Ancient fortress city on EU border. UNESCO heritage sites.", opportunities: [
      { id: "psk-1", title: "EU Border Logistics", titleZh: "欧盟边境物流", titleRu: "Логистика на границе с ЕС", sector: "Logistics", description: "Cross-border trade with EU.", descriptionZh: "与欧盟的跨境贸易。", descriptionRu: "Трансграничная торговля с ЕС.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "psk-2", title: "Pskov Heritage Tourism", titleZh: "普斯科夫遗产旅游", titleRu: "Псковский наследственный туризм", sector: "Tourism", description: "Medieval fortress tourism.", descriptionZh: "中世纪堡垒旅游。", descriptionRu: "Туризм средневековых крепостей.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Historic city on EU border (Estonia, Latvia). UNESCO World Heritage sites. Strategic logistics position.", overviewRu: "Исторический город на границе с ЕС (Эстония, Латвия). Объекты всемирного наследия ЮНЕСКО. Стратегическое положение логистики.", overviewZh: "与欧盟边境的历史城市（爱沙尼亚、拉脱维亚）。联合国教科文组织世界遗产。战略物流位置。", targetSectors: ["Border Logistics", "Heritage Tourism", "Agriculture", "Manufacturing"], opportunities: [
    { id: "ps-1", title: "Baltic Border Hub", titleZh: "波罗的海边境中心", titleRu: "Балтийский пограничный хаб", sector: "Logistics", description: "Trade gateway to Baltic states.", descriptionZh: "通往波罗的海国家的贸易门户。", descriptionRu: "Торговые ворота в страны Балтии.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "ps-2", title: "Pskov Tourism Development", titleZh: "普斯科夫旅游开发", titleRu: "Развитие туризма Пскова", sector: "Tourism", description: "UNESCO heritage and eco-tourism.", descriptionZh: "联合国教科文组织遗产和生态旅游。", descriptionRu: "Туризм наследия ЮНЕСКО и экотуризм.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "EU Border", titleRu: "Граница с ЕС", titleZh: "欧盟边境", description: "Gateway to Baltic states.", descriptionRu: "Ворота в страны Балтии.", descriptionZh: "通往波罗的海国家的门户。" }], contactInfo: { investmentAgency: "Pskov Investment Agency", investmentAgencyRu: "Агентство инвестиций Пскова", investmentAgencyZh: "普斯科夫投资局", website: "https://investpskov.ru" } },
  "Magadan Oblast": { name: "Magadan Oblast", nameZh: "马加丹州", nameRu: "Магаданская область", gdp: "$5 Billion", population: "0.1 Million", sezCount: 1, industries: ["Gold Mining", "Fishing", "Energy"], industriesRu: ["Золотодобыча", "Рыболовство", "Энергетика"], industriesZh: ["黄金开采", "渔业", "能源"], taxBenefits: ["Far East benefits", "Gold mining incentives", "Northern allowances"], taxBenefitsRu: ["Льготы Дальнего Востока", "Стимулы золотодобычи", "Северные надбавки"], taxBenefitsZh: ["远东优惠", "黄金开采激励", "北方津贴"], majorCities: [
    { id: "magadan", name: "Magadan", nameRu: "Магадан", nameZh: "马加丹", population: "0.1M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Gold mining capital on Sea of Okhotsk. Gateway to Kolyma goldfields.", opportunities: [
      { id: "mag-1", title: "Kolyma Gold Mining", titleZh: "科雷马金矿开采", titleRu: "Колымская золотодобыча", sector: "Gold", description: "Major gold mining region.", descriptionZh: "主要黄金开采区。", descriptionRu: "Крупный золотодобывающий регион.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "mag-2", title: "Sea of Okhotsk Fishing", titleZh: "鄂霍次克海捕鱼", titleRu: "Охотоморский промысел", sector: "Fishing", description: "Premium seafood harvesting.", descriptionZh: "优质海产品捕捞。", descriptionRu: "Добыча премиальных морепродуктов.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Russia's gold mining capital in the Far East. Kolyma goldfields produce significant portion of Russian gold.", overviewRu: "Столица золотодобычи России на Дальнем Востоке. Колымские приисски производят значительную часть российского золота.", overviewZh: "俄罗斯远东黄金开采之都。科雷马金矿生产俄罗斯黄金的重要部分。", targetSectors: ["Gold Mining", "Silver Mining", "Fishing", "Energy"], opportunities: [
    { id: "ma-1", title: "Kolyma Goldfields Partnership", titleZh: "科雷马金矿合作", titleRu: "Партнёрство Колымских приисков", sector: "Gold", description: "Gold and silver mining expansion.", descriptionZh: "金银矿开采扩张。", descriptionRu: "Расширение добычи золота и серебра.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ma-2", title: "Magadan Seafood Processing", titleZh: "马加丹海产品加工", titleRu: "Магаданская переработка морепродуктов", sector: "Fishing", description: "Fish processing for Asian markets.", descriptionZh: "面向亚洲市场的鱼类加工。", descriptionRu: "Рыбопереработка для азиатских рынков.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Gold Capital", titleRu: "Столица золота", titleZh: "黄金之都", description: "Kolyma goldfields.", descriptionRu: "Колымские приисски.", descriptionZh: "科雷马金矿。" }], contactInfo: { investmentAgency: "Magadan Investment Agency", investmentAgencyRu: "Агентство инвестиций Магадана", investmentAgencyZh: "马加丹投资局", website: "https://investmagadan.ru" } },
  "Chukotka Autonomous Okrug": { name: "Chukotka Autonomous Okrug", nameZh: "楚科奇自治区", nameRu: "Чукотский автономный округ", gdp: "$3 Billion", population: "0.05 Million", sezCount: 0, industries: ["Gold Mining", "Mining", "Fishing"], industriesRu: ["Золотодобыча", "Горнодобывающая промышленность", "Рыболовство"], industriesZh: ["黄金开采", "采矿", "渔业"], taxBenefits: ["Far East benefits", "Arctic zone benefits", "Mining incentives"], taxBenefitsRu: ["Льготы Дальнего Востока", "Арктические зональные льготы", "Стимулы горнодобычи"], taxBenefitsZh: ["远东优惠", "北极地区优惠", "采矿激励"], majorCities: [
    { id: "anadyr", name: "Anadyr", nameRu: "Анадырь", nameZh: "阿纳德尔", population: "0.01M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Russia's easternmost city. Remote Arctic mining and fishing region.", opportunities: [
      { id: "ana-1", title: "Chukotka Gold Projects", titleZh: "楚科奇黄金项目", titleRu: "Чукотские золотые проекты", sector: "Gold", description: "Major gold deposits including Kupol mine.", descriptionZh: "包括库波尔矿在内的主要金矿。", descriptionRu: "Крупные месторождения золота, включая рудник Купол.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "ana-2", title: "Bering Sea Fishing", titleZh: "白令海捕鱼", titleRu: "Берингоморский промысел", sector: "Fishing", description: "Remote fishing grounds.", descriptionZh: "偏远渔场。", descriptionRu: "Удалённые рыбопромысловые угодья.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's easternmost region on Bering Strait. Major gold deposits. Extreme Arctic conditions.", overviewRu: "Самый восточный регион России на Беринговом проливе. Крупные месторождения золота. Экстремальные арктические условия.", overviewZh: "俄罗斯最东部地区，位于白令海峡。主要金矿储备。极端北极条件。", targetSectors: ["Gold Mining", "Copper Mining", "Fishing"], opportunities: [
    { id: "ch-1", title: "Chukotka Mining Development", titleZh: "楚科奇采矿开发", titleRu: "Развитие горнодобычи Чукотки", sector: "Mining", description: "Gold, copper, and tin mining.", descriptionZh: "金、铜和锡矿开采。", descriptionRu: "Добыча золота, меди и олова.", investmentRange: "$60M - $600M", timeline: "4-6 years", status: "priority" },
    { id: "ch-2", title: "Arctic Shipping Support", titleZh: "北极航运支持", titleRu: "Поддержка арктического судоходства", sector: "Logistics", description: "Northern Sea Route services.", descriptionZh: "北方海航线服务。", descriptionRu: "Услуги Северного морского пути.", investmentRange: "$25M - $220M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Gold Deposits", titleRu: "Золотые месторождения", titleZh: "黄金矿床", description: "Major Arctic gold mining.", descriptionRu: "Крупная арктическая золотодобыча.", descriptionZh: "主要北极黄金开采。" }], contactInfo: { investmentAgency: "Chukotka Investment Agency", investmentAgencyRu: "Агентство инвестиций Чукотки", investmentAgencyZh: "楚科奇投资局", website: "https://investchukotka.ru" } },
  "Nenets Autonomous Okrug": { name: "Nenets Autonomous Okrug", nameZh: "涅涅茨自治区", nameRu: "Ненецкий автономный округ", gdp: "$8 Billion", population: "0.04 Million", sezCount: 0, industries: ["Oil & Gas", "Reindeer Herding"], industriesRu: ["Нефть и газ", "Оленеводство"], industriesZh: ["石油和天然气", "驯鹿养殖"], taxBenefits: ["Arctic zone benefits", "Oil incentives", "Northern allowances"], taxBenefitsRu: ["Арктические зональные льготы", "Стимулы нефтедобычи", "Северные надбавки"], taxBenefitsZh: ["北极地区优惠", "石油激励", "北方津贴"], majorCities: [
    { id: "naryan-mar", name: "Naryan-Mar", nameRu: "Нарьян-Мар", nameZh: "纳里扬-马尔", population: "0.02M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Arctic oil region capital. Timan-Pechora oil basin.", opportunities: [
      { id: "nar-1", title: "Timan-Pechora Oil Development", titleZh: "蒂曼-伯朝拉石油开发", titleRu: "Освоение Тимано-Печорской нефти", sector: "Oil", description: "Arctic oil production.", descriptionZh: "北极石油生产。", descriptionRu: "Арктическая нефтедобыча.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "nar-2", title: "Arctic Logistics Base", titleZh: "北极物流基地", titleRu: "Арктическая логистическая база", sector: "Logistics", description: "Support services for Arctic operations.", descriptionZh: "北极作业的支持服务。", descriptionRu: "Сервисные услуги для арктических операций.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Arctic oil region with highest per-capita GDP in Russia. Timan-Pechora oil and gas basin.", overviewRu: "Арктический нефтяной регион с наивысшим ВВП на душу населения в России. Нефтегазовый бассейн Тимано-Печора.", overviewZh: "北极石油地区，人均GDP最高。蒂曼-伯朝拉油气盆地。", targetSectors: ["Oil & Gas", "Arctic Logistics", "Reindeer Products"], opportunities: [
    { id: "ne-1", title: "Nenets Oil Expansion", titleZh: "涅涅茨石油扩张", titleRu: "Расширение ненецкой нефтедобычи", sector: "Oil", description: "Arctic shelf and onshore oil.", descriptionZh: "北极陆架和陆上石油。", descriptionRu: "Арктический шельф и сухопутная нефть.", investmentRange: "$60M - $600M", timeline: "4-6 years", status: "priority" },
    { id: "ne-2", title: "Northern Sea Route Hub", titleZh: "北方海航线枢纽", titleRu: "Хаб Северного морского пути", sector: "Logistics", description: "Arctic shipping support.", descriptionZh: "北极航运支持。", descriptionRu: "Поддержка арктического судоходства.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Arctic Oil", titleRu: "Арктическая нефть", titleZh: "北极石油", description: "Major Arctic oil region.", descriptionRu: "Крупный арктический нефтяной регион.", descriptionZh: "主要北极石油地区。" }], contactInfo: { investmentAgency: "Nenets Investment Agency", investmentAgencyRu: "Агентство инвестиций Ненецкого АО", investmentAgencyZh: "涅涅茨投资局", website: "https://investnenets.ru" } },
  "Republic of Ingushetia": { name: "Republic of Ingushetia", nameZh: "印古什共和国", nameRu: "Республика Ингушетия", gdp: "$1 Billion", population: "0.5 Million", sezCount: 0, industries: ["Agriculture", "Construction", "Tourism"], industriesRu: ["Сельское хозяйство", "Строительство", "Туризм"], industriesZh: ["农业", "建筑", "旅游"], taxBenefits: ["North Caucasus incentives", "Development support"], taxBenefitsRu: ["Льготы Северного Кавказа", "Поддержка развития"], taxBenefitsZh: ["北高加索激励", "发展支持"], majorCities: [
    { id: "magas", name: "Magas", nameRu: "Магас", nameZh: "马加斯", population: "0.01M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Modern planned capital in scenic Caucasus mountains.", opportunities: [
      { id: "mgs-1", title: "Ingushetia Development", titleZh: "印古什发展", titleRu: "Развитие Ингушетии", sector: "Construction", description: "Infrastructure and urban development.", descriptionZh: "基础设施和城市发展。", descriptionRu: "Инфраструктура и городское развитие.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "mgs-2", title: "Caucasus Mountain Tourism", titleZh: "高加索山旅游", titleRu: "Кавказский горный туризм", sector: "Tourism", description: "Mountain and cultural tourism.", descriptionZh: "山地和文化旅游。", descriptionRu: "Горный и культурный туризм.", investmentRange: "$10M - $90M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Small Caucasus republic with beautiful mountain scenery. Growing construction and tourism sectors.", overviewRu: "Небольшая республика Северного Кавказа с красивыми горными пейзажами. Растущие строительство и туризм.", overviewZh: "北高加索小共和国，拥有美丽的山景。建筑和旅游业不断增长。", targetSectors: ["Construction", "Tourism", "Agriculture"], opportunities: [
    { id: "in-1", title: "Ingushetia Infrastructure", titleZh: "印古什基础设施", titleRu: "Инфраструктура Ингушетии", sector: "Construction", description: "Infrastructure development projects.", descriptionZh: "基础设施发展项目。", descriptionRu: "Проекты развития инфраструктуры.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "in-2", title: "Ingushetia Tourism", titleZh: "印古什旅游", titleRu: "Туризм Ингушетии", sector: "Tourism", description: "Mountain tourism development.", descriptionZh: "山地旅游开发。", descriptionRu: "Развитие горного туризма.", investmentRange: "$10M - $90M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Mountain Scenery", titleRu: "Горные пейзажи", titleZh: "山景", description: "Beautiful Caucasus landscapes.", descriptionRu: "Красивые кавказские ландшафты.", descriptionZh: "美丽的高加索风景。" }], contactInfo: { investmentAgency: "Ingushetia Investment Agency", investmentAgencyRu: "Агентство инвестиций Ингушетии", investmentAgencyZh: "印古什投资局", website: "https://investingushetia.ru" } },
  "Karachay-Cherkess Republic": { name: "Karachay-Cherkess Republic", nameZh: "卡拉恰伊-切尔克斯共和国", nameRu: "Карачаево-Черкесская Республика", gdp: "$2 Billion", population: "0.5 Million", sezCount: 1, industries: ["Tourism", "Mining", "Agriculture"], industriesRu: ["Туризм", "Горнодобывающая промышленность", "Сельское хозяйство"], industriesZh: ["旅游", "采矿", "农业"], taxBenefits: ["North Caucasus incentives", "Tourism support"], taxBenefitsRu: ["Льготы Северного Кавказа", "Поддержка туризма"], taxBenefitsZh: ["北高加索激励", "旅游支持"], majorCities: [
    { id: "cherkessk", name: "Cherkessk", nameRu: "Черкесск", nameZh: "切尔克斯克", population: "0.1M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Capital near famous Dombay ski resort.", opportunities: [
      { id: "ckk-1", title: "Dombay Ski Resort", titleZh: "多姆拜滑雪度假村", titleRu: "Горнолыжный курорт Домбай", sector: "Tourism", description: "Famous Caucasus ski resort.", descriptionZh: "著名的高加索滑雪度假村。", descriptionRu: "Знаменитый кавказский горнолыжный курорт.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "priority" },
      { id: "ckk-2", title: "Arkhyz Resort", titleZh: "阿尔希兹度假村", titleRu: "Курорт Архыз", sector: "Tourism", description: "New mountain resort development.", descriptionZh: "新山地度假村开发。", descriptionRu: "Развитие нового горного курорта.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Home to famous Dombay and Arkhyz ski resorts. Growing mountain tourism destination.", overviewRu: "Дом знаменитых горнолыжных курортов Домбай и Архыз. Растущий горный туристический центр.", overviewZh: "著名的多姆拜和阿尔希兹滑雪度假村所在地。不断增长的山地旅游目的地。", targetSectors: ["Ski Tourism", "Mining", "Agriculture"], opportunities: [
    { id: "kc-1", title: "Caucasus Ski Resorts", titleZh: "高加索滑雪度假村", titleRu: "Кавказские горнолыжные курорты", sector: "Tourism", description: "Dombay and Arkhyz resort expansion.", descriptionZh: "多姆拜和阿尔希兹度假村扩建。", descriptionRu: "Расширение курортов Домбай и Архыз.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
    { id: "kc-2", title: "Karachay-Cherkessia Mining", titleZh: "卡拉恰伊-切尔克斯采矿", titleRu: "Горнодобыча КЧР", sector: "Mining", description: "Copper and gold mining.", descriptionZh: "铜和金矿开采。", descriptionRu: "Добыча меди и золота.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Ski Destination", titleRu: "Горнолыжный курорт", titleZh: "滑雪目的地", description: "Dombay and Arkhyz resorts.", descriptionRu: "Курорты Домбай и Архыз.", descriptionZh: "多姆拜和阿尔希兹度假村。" }], contactInfo: { investmentAgency: "KCR Investment Agency", investmentAgencyRu: "Агентство инвестиций КЧР", investmentAgencyZh: "卡拉恰伊-切尔克斯投资局", website: "https://investkchr.ru" } },
  "Kostroma Oblast": { name: "Kostroma Oblast", nameZh: "科斯特罗马州", nameRu: "Костромская область", gdp: "$4 Billion", population: "0.6 Million", sezCount: 0, industries: ["Forestry", "Jewelry", "Tourism", "Textiles"], industriesRu: ["Лесное хозяйство", "Ювелирные изделия", "Туризм", "Текстиль"], industriesZh: ["林业", "珠宝", "旅游", "纺织"], taxBenefits: ["Forestry incentives", "Golden Ring tourism support"], taxBenefitsRu: ["Льготы лесного хозяйства", "Поддержка туризма Золотого кольца"], taxBenefitsZh: ["林业激励", "金环旅游支持"], majorCities: [
    { id: "kostroma", name: "Kostroma", nameRu: "Кострома", nameZh: "科斯特罗马", population: "0.3M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Historic Golden Ring city. Famous for linen and jewelry.", opportunities: [
      { id: "kos-1", title: "Kostroma Linen Industry", titleZh: "科斯特罗马亚麻产业", titleRu: "Костромская льняная промышленность", sector: "Textiles", description: "Traditional Russian linen.", descriptionZh: "传统俄罗斯亚麻。", descriptionRu: "Традиционный русский лён.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" },
      { id: "kos-2", title: "Kostroma Jewelry", titleZh: "科斯特罗马珠宝", titleRu: "Костромские ювелирные изделия", sector: "Jewelry", description: "Russian jewelry manufacturing hub.", descriptionZh: "俄罗斯珠宝制造中心。", descriptionRu: "Хаб производства российских ювелирных изделий.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Golden Ring historic city famous for linen and jewelry production. Rich forestry resources.", overviewRu: "Исторический город Золотого кольца, известный производством льна и ювелирных изделий. Богатые лесные ресурсы.", overviewZh: "金环历史城市，以亚麻和珠宝生产而闻名。丰富的林业资源。", targetSectors: ["Jewelry", "Textiles", "Forestry", "Tourism"], opportunities: [
    { id: "ks-1", title: "Russian Jewelry Hub", titleZh: "俄罗斯珠宝中心", titleRu: "Российский ювелирный хаб", sector: "Jewelry", description: "Major jewelry manufacturing center.", descriptionZh: "主要珠宝制造中心。", descriptionRu: "Крупный центр ювелирного производства.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "ks-2", title: "Golden Ring Heritage Tourism", titleZh: "金环遗产旅游", titleRu: "Наследственный туризм Золотого кольца", sector: "Tourism", description: "Historic cultural tourism.", descriptionZh: "历史文化旅游。", descriptionRu: "Исторический культурный туризм.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Jewelry Capital", titleRu: "Ювелирная столица", titleZh: "珠宝之都", description: "Russia's jewelry manufacturing center.", descriptionRu: "Центр ювелирного производства России.", descriptionZh: "俄罗斯珠宝制造中心。" }], contactInfo: { investmentAgency: "Kostroma Investment Agency", investmentAgencyRu: "Агентство инвестиций Костромской области", investmentAgencyZh: "科斯特罗马州投资局", website: "https://investkostroma.ru" } },
  "Kurgan Oblast": { name: "Kurgan Oblast", nameZh: "库尔干州", nameRu: "Курганская область", gdp: "$4 Billion", population: "0.8 Million", sezCount: 0, industries: ["Machinery", "Agriculture", "Pharmaceuticals"], industriesRu: ["Машиностроение", "Сельское хозяйство", "Фармацевтика"], industriesZh: ["机械", "农业", "制药"], taxBenefits: ["Manufacturing incentives", "Kazakhstan border benefits"], taxBenefitsRu: ["Льготы производства", "Льготы приграничной торговли с Казахстаном"], taxBenefitsZh: ["制造业激励", "哈萨克斯坦边境贸易优惠"], majorCities: [
    { id: "kurgan", name: "Kurgan", nameRu: "Курган", nameZh: "库尔干", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Industrial city on Trans-Siberian Railway near Kazakhstan.", opportunities: [
      { id: "krg-1", title: "Kurgan Machinery", titleZh: "库尔干机械", titleRu: "Курганское машиностроение", sector: "Machinery", description: "Bus and military vehicle manufacturing.", descriptionZh: "公共汽车和军用车辆制造。", descriptionRu: "Производство автобусов и военной техники.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "krg-2", title: "Trans-Siberian Logistics", titleZh: "西伯利亚大铁路物流", titleRu: "Транссибирская логистика", sector: "Logistics", description: "Rail logistics hub.", descriptionZh: "铁路物流中心。", descriptionRu: "Железнодорожный логистический хаб.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Industrial center on Trans-Siberian Railway. Machinery and agricultural processing. Kazakhstan border trade.", overviewRu: "Промышленный центр на Транссибирской магистрали. Машиностроение и сельскохозяйственная переработка. Приграничная торговля с Казахстаном.", overviewZh: "西伯利亚大铁路上的工业中心。机械和农业加工。与哈萨克斯坦的边境贸易。", targetSectors: ["Machinery", "Agriculture", "Logistics", "Pharmaceuticals"], opportunities: [
    { id: "kg-1", title: "Kurgan Industrial Cluster", titleZh: "库尔干工业集群", titleRu: "Курганский промышленный кластер", sector: "Manufacturing", description: "Machinery and vehicle production.", descriptionZh: "机械和车辆生产。", descriptionRu: "Производство машин и транспортных средств.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "kg-2", title: "Kazakhstan Border Trade", titleZh: "哈萨克斯坦边境贸易", titleRu: "Казахстанская приграничная торговля", sector: "Trade", description: "Cross-border trade hub.", descriptionZh: "跨境贸易中心。", descriptionRu: "Хаб трансграничной торговли.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Rail Hub", titleRu: "Железнодорожный хаб", titleZh: "铁路枢纽", description: "Trans-Siberian Railway junction.", descriptionRu: "Узел Транссибирской магистрали.", descriptionZh: "西伯利亚大铁路枢纽。" }], contactInfo: { investmentAgency: "Kurgan Investment Agency", investmentAgencyRu: "Агентство инвестиций Курганской области", investmentAgencyZh: "库尔干州投资局", website: "https://investkurgan.ru" } },
  "Novgorod Oblast": { name: "Novgorod Oblast", nameZh: "诺夫哥罗德州", nameRu: "Новгородская область", gdp: "$5 Billion", population: "0.6 Million", sezCount: 1, industries: ["Chemicals", "Electronics", "Food Processing", "Tourism"], industriesRu: ["Химия", "Электроника", "Пищевая промышленность", "Туризм"], industriesZh: ["化工", "电子", "食品加工", "旅游"], taxBenefits: ["SEZ benefits", "Heritage tourism support"], taxBenefitsRu: ["Льготы СЭЗ", "Поддержка наследственного туризма"], taxBenefitsZh: ["经济特区优惠", "遗产旅游支持"], majorCities: [
    { id: "veliky-novgorod", name: "Veliky Novgorod", nameRu: "Великий Новгород", nameZh: "大诺夫哥罗德", population: "0.2M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Ancient Russian capital. UNESCO World Heritage Kremlin.", opportunities: [
      { id: "vnv-1", title: "Novgorod Chemical Complex", titleZh: "诺夫哥罗德化工综合体", titleRu: "Новгородский химический комплекс", sector: "Chemicals", description: "Acron fertilizer production.", descriptionZh: "阿克龙化肥生产。", descriptionRu: "Производство удобрений Акрон.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" },
      { id: "vnv-2", title: "Ancient Russia Tourism", titleZh: "古俄罗斯旅游", titleRu: "Туризм Древней Руси", sector: "Tourism", description: "UNESCO heritage tourism.", descriptionZh: "联合国教科文组织遗产旅游。", descriptionRu: "Туризм наследия ЮНЕСКО.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Cradle of Russian statehood with UNESCO heritage. Major chemical industry (Acron). Electronics manufacturing.", overviewRu: "Колыбель русской государственности с наследием ЮНЕСКО. Крупная химическая промышленность (Акрон). Производство электроники.", overviewZh: "俄罗斯国家的摇篮，拥有联合国教科文组织遗产。主要化工产业（阿克龙）。电子制造。", targetSectors: ["Chemicals", "Electronics", "Heritage Tourism", "Food"], opportunities: [
    { id: "nv-1", title: "Acron Fertilizer Partnership", titleZh: "阿克龙化肥合作", titleRu: "Партнёрство с Акроном", sector: "Chemicals", description: "Major fertilizer production.", descriptionZh: "主要化肥生产。", descriptionRu: "Крупное производство удобрений.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "nv-2", title: "Veliky Novgorod Tourism", titleZh: "大诺夫哥罗德旅游", titleRu: "Туризм Великого Новгорода", sector: "Tourism", description: "Ancient capital heritage tourism.", descriptionZh: "古都遗产旅游。", descriptionRu: "Туризм наследия древней столицы.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Ancient Capital", titleRu: "Древняя столица", titleZh: "古都", description: "Cradle of Russian statehood.", descriptionRu: "Колыбель русской государственности.", descriptionZh: "俄罗斯国家的摇篮。" }], contactInfo: { investmentAgency: "Novgorod Investment Agency", investmentAgencyRu: "Агентство инвестиций Новгородской области", investmentAgencyZh: "诺夫哥罗德州投资局", website: "https://investnovgorod.ru" } },
  "Oryol Oblast": { name: "Oryol Oblast", nameZh: "奥廖尔州", nameRu: "Орловская область", gdp: "$5 Billion", population: "0.7 Million", sezCount: 1, industries: ["Machinery", "Steel", "Agriculture", "Food Processing"], industriesRu: ["Машиностроение", "Сталь", "Сельское хозяйство", "Пищевая промышленность"], industriesZh: ["机械", "钢铁", "农业", "食品加工"], taxBenefits: ["Manufacturing incentives", "Agricultural support"], taxBenefitsRu: ["Льготы производства", "Поддержка сельского хозяйства"], taxBenefitsZh: ["制造业激励", "农业支持"], majorCities: [
    { id: "oryol", name: "Oryol", nameRu: "Орёл", nameZh: "奥廖尔", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Literary capital of Russia. Industrial and agricultural center.", opportunities: [
      { id: "orl-1", title: "Oryol Steel Production", titleZh: "奥廖尔钢铁生产", titleRu: "Орловское сталелитейное производство", sector: "Steel", description: "Steel and metal processing.", descriptionZh: "钢铁和金属加工。", descriptionRu: "Сталелитейное производство и металлообработка.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
      { id: "orl-2", title: "Oryol Agricultural Hub", titleZh: "奥廖尔农业中心", titleRu: "Орловский агрохаб", sector: "Agriculture", description: "Grain and livestock production.", descriptionZh: "粮食和畜牧生产。", descriptionRu: "Производство зерна и животноводство.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Central Russian industrial and agricultural region. Strong steel and machinery industries.", overviewRu: "Центральный российский промышленно-аграрный регион. Сильные позиции в сталелитейной и машиностроительной промышленности.", overviewZh: "俄罗斯中部工业和农业地区。钢铁和机械工业实力强劲。", targetSectors: ["Steel", "Machinery", "Agriculture", "Food Processing"], opportunities: [
    { id: "or-1", title: "Oryol Industrial Park", titleZh: "奥廖尔工业园区", titleRu: "Орловский индустриальный парк", sector: "Manufacturing", description: "Diversified manufacturing.", descriptionZh: "多元化制造业。", descriptionRu: "Диверсифицированное производство.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "active" },
    { id: "or-2", title: "Central Russia Agriculture", titleZh: "俄罗斯中部农业", titleRu: "Сельское хозяйство Центральной России", sector: "Agriculture", description: "Grain and food processing.", descriptionZh: "粮食和食品加工。", descriptionRu: "Зернопереработка и пищевая промышленность.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Industrial Center", titleRu: "Промышленный центр", titleZh: "工业中心", description: "Diversified manufacturing base.", descriptionRu: "База диверсифицированного производства.", descriptionZh: "多元化制造业基地。" }], contactInfo: { investmentAgency: "Oryol Investment Agency", investmentAgencyRu: "Агентство инвестиций Орловской области", investmentAgencyZh: "奥廖尔州投资局", website: "https://investoryol.ru" } },
  "Tambov Oblast": { name: "Tambov Oblast", nameZh: "坦波夫州", nameRu: "Тамбовская область", gdp: "$6 Billion", population: "1.0 Million", sezCount: 1, industries: ["Agriculture", "Food Processing", "Chemicals", "Machinery"], industriesRu: ["Сельское хозяйство", "Пищевая промышленность", "Химия", "Машиностроение"], industriesZh: ["农业", "食品加工", "化工", "机械"], taxBenefits: ["Agricultural subsidies", "Manufacturing incentives"], taxBenefitsRu: ["Сельскохозяйственные субсидии", "Льготы производства"], taxBenefitsZh: ["农业补贴", "制造业激励"], majorCities: [
    { id: "tambov", name: "Tambov", nameRu: "Тамбов", nameZh: "坦波夫", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Agricultural center in Russia's black earth region.", opportunities: [
      { id: "tam-1", title: "Tambov Sugar Industry", titleZh: "坦波夫制糖业", titleRu: "Тамбовская сахарная промышленность", sector: "Food", description: "Sugar beet processing.", descriptionZh: "甜菜加工。", descriptionRu: "Переработка сахарной свёклы.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "tam-2", title: "Black Earth Agriculture", titleZh: "黑土农业", titleRu: "Чернозёмное земледелие", sector: "Agriculture", description: "Premium agricultural land.", descriptionZh: "优质农业用地。", descriptionRu: "Премиальные сельскохозяйственные земли.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Central Russian agricultural region with rich black earth. Major sugar and grain production.", overviewRu: "Центральный российский аграрный регион с богатыми чернозёмами. Крупное производство сахара и зерна.", overviewZh: "俄罗斯中部农业地区，拥有丰富的黑土。主要糖和谷物生产。", targetSectors: ["Agriculture", "Sugar Processing", "Food Industry", "Machinery"], opportunities: [
    { id: "ta-1", title: "Tambov Agro-Industrial Complex", titleZh: "坦波夫农工综合体", titleRu: "Тамбовский агропромышленный комплекс", sector: "Agriculture", description: "Integrated agricultural processing.", descriptionZh: "综合农业加工。", descriptionRu: "Интегрированная сельхозпереработка.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "ta-2", title: "Tambov Food Processing", titleZh: "坦波夫食品加工", titleRu: "Тамбовская пищепереработка", sector: "Food", description: "Food products for central Russia.", descriptionZh: "俄罗斯中部食品产品。", descriptionRu: "Продукты питания для центральной России.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Black Earth", titleRu: "Чернозём", titleZh: "黑土", description: "Russia's most fertile soil.", descriptionRu: "Самая плодородная почва России.", descriptionZh: "俄罗斯最肥沃的土壤。" }], contactInfo: { investmentAgency: "Tambov Investment Agency", investmentAgencyRu: "Агентство инвестиций Тамбовской области", investmentAgencyZh: "坦波夫州投资局", website: "https://investtambov.ru" } },
  "Jewish Autonomous Oblast": { name: "Jewish Autonomous Oblast", nameZh: "犹太自治州", nameRu: "Еврейская автономная область", gdp: "$2 Billion", population: "0.2 Million", sezCount: 1, industries: ["Mining", "Agriculture", "Manufacturing"], industriesRu: ["Горнодобывающая промышленность", "Сельское хозяйство", "Производство"], industriesZh: ["采矿", "农业", "制造"], taxBenefits: ["Far East benefits", "Border zone incentives"], taxBenefitsRu: ["Льготы Дальнего Востока", "Льготы приграничной зоны"], taxBenefitsZh: ["远东优惠", "边境区激励"], majorCities: [
    { id: "birobidzhan", name: "Birobidzhan", nameRu: "Биробиджан", nameZh: "比罗比詹", population: "0.07M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Capital on China border. Growing cross-border trade.", opportunities: [
      { id: "brb-1", title: "China Border Trade Zone", titleZh: "中国边境贸易区", titleRu: "Китайская пограничная торговая зона", sector: "Trade", description: "Direct trade with China's Heilongjiang.", descriptionZh: "与中国黑龙江的直接贸易。", descriptionRu: "Прямая торговля с китайским Хэйлунцзяном.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "priority" },
      { id: "brb-2", title: "JAO Mining Development", titleZh: "犹太自治州矿业开发", titleRu: "Развитие горнодобычи ЕАО", sector: "Mining", description: "Iron ore and tin mining.", descriptionZh: "铁矿石和锡矿开采。", descriptionRu: "Добыча железной руды и олова.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Russia's only Jewish autonomous region on China border. Growing cross-border trade. Mining and agriculture.", overviewRu: "Единственный еврейский автономный регион России на границе с Китаем. Растущая приграничная торговля. Горнодобыча и сельское хозяйство.", overviewZh: "俄罗斯唯一的犹太自治州，位于中国边境。跨境贸易不断增长。采矿和农业。", targetSectors: ["Cross-border Trade", "Mining", "Agriculture", "Manufacturing"], opportunities: [
    { id: "ja-1", title: "Russia-China Border Hub", titleZh: "中俄边境中心", titleRu: "Российско-китайский пограничный хаб", sector: "Trade", description: "Trade zone on China border.", descriptionZh: "中国边境的贸易区。", descriptionRu: "Торговая зона на границе с Китаем.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "priority" },
    { id: "ja-2", title: "JAO Agricultural Export", titleZh: "犹太自治州农业出口", titleRu: "Сельскохозяйственный экспорт ЕАО", sector: "Agriculture", description: "Soybean production for China.", descriptionZh: "面向中国的大豆生产。", descriptionRu: "Производство сои для Китая.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "China Border", titleRu: "Граница с Китаем", titleZh: "中国边境", description: "Direct access to Heilongjiang Province.", descriptionRu: "Прямой доступ к провинции Хэйлунцзян.", descriptionZh: "直接进入黑龙江省。" }], contactInfo: { investmentAgency: "JAO Investment Agency", investmentAgencyRu: "Агентство инвестиций ЕАО", investmentAgencyZh: "犹太自治州投资局", website: "https://investeao.ru" } },
};

export function getRegionData(regionName: string, country: 'CN' | 'RU'): RegionData | null {
  const data = country === 'CN' ? CHINA_REGIONS : RUSSIA_REGIONS;
  
  // Direct match
  if (data[regionName]) return data[regionName];
  
  // Normalize: lowercase and replace dashes with spaces
  const urlStyleToNormalized = regionName.toLowerCase().replace(/-/g, ' ');
  for (const key of Object.keys(data)) {
    if (key.toLowerCase() === urlStyleToNormalized) {
      return data[key];
    }
  }
  
  // For Russia: strip common prefixes like "Republic of", "Krai", "Oblast"
  if (country === 'RU') {
    const prefixes = ['republic of ', 'republic ', 'autonomous oblast ', 'autonomous okrug '];
    const suffixes = [' krai', ' oblast', ' okrug'];
    let stripped = regionName.toLowerCase();
    
    // Strip prefixes
    for (const prefix of prefixes) {
      if (stripped.startsWith(prefix)) {
        stripped = stripped.slice(prefix.length);
        break;
      }
    }
    
    // Strip suffixes
    for (const suffix of suffixes) {
      if (stripped.endsWith(suffix)) {
        stripped = stripped.slice(0, -suffix.length);
        break;
      }
    }
    
    // Try matching stripped version
    for (const key of Object.keys(data)) {
      if (key.toLowerCase() === stripped || key.toLowerCase().includes(stripped)) {
        return data[key];
      }
    }
  }
  
  return null;
}
`;
}

function generateNewsletterSignup(): string {
  return `"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function NewsletterSignup() {
  const t = useTranslations('widgets');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl p-6 border border-primary/30"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{t('newsletter')}</h3>
          <p className="text-sm text-slate-400">{t('newsletterDesc')}</p>
        </div>
      </div>

      {status === 'success' ? (
        <div className="flex items-center gap-2 text-green-400 bg-green-400/10 rounded-lg p-4">
          <CheckCircle className="w-5 h-5" />
          <span>{t('subscribed')}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {status === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('subscribe')
            )}
          </button>
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{t('subscribeError')}</span>
            </div>
          )}
        </form>
      )}
    </motion.div>
  );
}
`;
}

function generateSocialShare(): string {
  return `"use client";

import { useTranslations } from 'next-intl';
import { Share2 } from 'lucide-react';

interface SocialShareProps {
  title: string;
  url?: string;
}

export function SocialShare({ title, url }: SocialShareProps) {
  const t = useTranslations('widgets');
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const platforms = [
    {
      name: 'Telegram',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
      href: \`https://t.me/share/url?url=\${encodedUrl}&text=\${encodedTitle}\`,
      color: 'hover:bg-[#0088cc]',
    },
    {
      name: 'WeChat',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 0 1 .176-.554c1.522-1.12 2.484-2.773 2.484-4.628 0-3.222-3.004-5.879-6.829-6.049-.065-.002-.13-.003-.194-.003-.065-.003-.13-.007-.196-.007l.177-.056zm-2.853 2.928c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.84 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
        </svg>
      ),
      href: \`weixin://dl/posts?url=\${encodedUrl}\`,
      color: 'hover:bg-[#07C160]',
    },
    {
      name: 'VK',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.684 4 8.217c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.455 2.27 4.607 2.858 4.607.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.168c0 .373.17.508.271.508.22 0 .407-.135.813-.542 1.27-1.422 2.18-3.608 2.18-3.608.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
        </svg>
      ),
      href: \`https://vk.com/share.php?url=\${encodedUrl}&title=\${encodedTitle}\`,
      color: 'hover:bg-[#4680C2]',
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      href: \`https://www.linkedin.com/sharing/share-offsite/?url=\${encodedUrl}\`,
      color: 'hover:bg-[#0077B5]',
    },
    {
      name: 'WhatsApp',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      href: \`https://wa.me/?text=\${encodedTitle}%20\${encodedUrl}\`,
      color: 'hover:bg-[#25D366]',
    },
  ];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      console.info('Clipboard not available');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400 flex items-center gap-1">
        <Share2 className="w-4 h-4" />
        {t('share')}:
      </span>
      {platforms.map((platform) => (
        <a
          key={platform.name}
          href={platform.href}
          target="_blank"
          rel="noopener noreferrer"
          className={\`p-2 bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors \${platform.color}\`}
          title={platform.name}
        >
          {platform.icon}
        </a>
      ))}
      <button
        onClick={copyToClipboard}
        className="p-2 bg-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
        title={t('copyLink')}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
    </div>
  );
}
`;
}

function generateBackToTop(): string {
  return `"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 p-3 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg shadow-primary/25 transition-colors"
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
`;
}

function generateBreadcrumbs(): string {
  return `"use client";

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = useTranslations('nav');
  const params = useParams();
  const pathname = usePathname();
  const locale = params.locale as string;

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items;

    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    paths.forEach((path, index) => {
      if (path === locale) return;
      
      const href = '/' + paths.slice(0, index + 1).join('/');
      let label = path.charAt(0).toUpperCase() + path.slice(1);
      
      const navKeys = ['home', 'laws', 'calendar', 'organizations', 'news', 'invest', 'contact'] as const;
      if (navKeys.includes(path as typeof navKeys[number])) {
        const translated = t(path as typeof navKeys[number]);
        if (translated) label = translated;
      } else {
        label = decodeURIComponent(path).replace(/-/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
      }

      breadcrumbs.push({ label, href: index < paths.length - 1 ? href : undefined });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6 flex-wrap">
      <Link
        href={\`/\${locale}\`}
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      {breadcrumbs.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-slate-600" />
          {item.href ? (
            <Link href={item.href} className="hover:text-white transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-white">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
`;
}

function generateLoadingSkeleton(): string {
  return `"use client";

import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <motion.div
      className={\`bg-slate-700/50 rounded-lg \${className}\`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
      <Skeleton className="h-48 mb-4" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

export function RegionCardSkeleton() {
  return (
    <div className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700">
      <Skeleton className="h-40" />
      <div className="p-6">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Skeleton className="h-4 w-12 mb-1" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
`;
}

function generateRelatedRegions(): string {
  return `"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp } from 'lucide-react';
import type { RegionData } from '@/data/regionData';

interface RelatedRegionsProps {
  currentRegion: RegionData;
  allRegions: Record<string, RegionData>;
  maxItems?: number;
}

export function RelatedRegions({ currentRegion, allRegions, maxItems = 3 }: RelatedRegionsProps) {
  const t = useTranslations('invest');
  const tIndustries = useTranslations('industries');
  const tUnits = useTranslations('units');
  const params = useParams();
  const locale = params.locale as string;
  
  function translateIndustry(industry: string): string {
    try {
      return tIndustries(industry as any) || industry;
    } catch {
      return industry;
    }
  }
  
  function formatMoney(value: string): string {
    if (locale === 'en') return value;
    return value
      .replace(/Billion/gi, tUnits('billion'))
      .replace(/Trillion/gi, tUnits('trillion'))
      .replace(/Million/gi, tUnits('million'));
  }

  const findRelated = (): RegionData[] => {
    const currentIndustries = new Set(currentRegion.industries || []);
    const scored: { region: RegionData; score: number }[] = [];

    Object.values(allRegions).forEach((region) => {
      if (region.name === currentRegion.name) return;

      let score = 0;
      (region.industries || []).forEach((industry) => {
        if (currentIndustries.has(industry)) score += 2;
      });

      if (region.sezCount && region.sezCount > 0) score += 1;
      if ((region.opportunities?.length || 0) > 0) score += 1;

      if (score > 0) {
        scored.push({ region, score });
      }
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems)
      .map((s) => s.region);
  };

  const related = findRelated();

  if (related.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-12"
    >
      <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        {t('relatedRegions')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {related.map((region, index) => {
          const regionId = region.name.toLowerCase().replace(/\\s+/g, '-');
          const displayName = locale === 'ru' ? (region.nameRu || region.name) : locale === 'zh' ? (region.nameZh || region.name) : region.name;
          
          return (
            <motion.div
              key={region.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                href={\`/\${locale}/invest/\${regionId}\`}
                className="block bg-slate-800/50 hover:bg-slate-700/50 rounded-xl p-4 border border-slate-700 hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white group-hover:text-primary transition-colors">
                    {displayName}
                  </h4>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <div className="text-sm text-slate-400 mb-3">
                  {formatMoney(region.gdp)} • {formatMoney(region.population)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(locale === 'ru' && region.industriesRu ? region.industriesRu : locale === 'zh' && region.industriesZh ? region.industriesZh : (region.industries || []).map(i => translateIndustry(i))).slice(0, 3).map((industry, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-xs rounded-full"
                    >
                      {industry}
                    </span>
                  ))}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
`;
}

function generateSearchDialog(): string {
  return `"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MapPin, Building2, FileText, Calendar } from 'lucide-react';
import { CHINA_REGIONS, RUSSIA_REGIONS } from '@/data/regionData';
import { getTargetCountry } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

interface SearchResult {
  type: 'region' | 'city' | 'opportunity';
  title: string;
  subtitle: string;
  href: string;
  icon: typeof MapPin;
}

export function SearchDialog() {
  const t = useTranslations('widgets');
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as Locale;
  const targetCountry = getTargetCountry(locale);

  const search = useCallback((searchQuery: string): SearchResult[] => {
    if (!searchQuery.trim()) return [];

    const q = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];
    const regions = targetCountry === 'CN' ? CHINA_REGIONS : RUSSIA_REGIONS;

    Object.entries(regions).forEach(([_, region]) => {
      const regionId = region.name.toLowerCase().replace(/\\s+/g, '-');
      const displayName = locale === 'ru' ? (region.nameRu || region.name) : locale === 'zh' ? (region.nameZh || region.name) : region.name;

      if (
        region.name.toLowerCase().includes(q) ||
        (region.nameRu && region.nameRu.toLowerCase().includes(q)) ||
        (region.nameZh && region.nameZh.includes(q)) ||
        (region.industries || []).some(i => i.toLowerCase().includes(q))
      ) {
        searchResults.push({
          type: 'region',
          title: displayName,
          subtitle: (region.industries || []).slice(0, 3).join(', '),
          href: \`/\${locale}/invest/\${regionId}\`,
          icon: MapPin,
        });
      }

      (region.majorCities || []).forEach((city) => {
        if (city.name.toLowerCase().includes(q)) {
          searchResults.push({
            type: 'city',
            title: city.name,
            subtitle: displayName,
            href: \`/\${locale}/invest/\${regionId}/\${city.id}\`,
            icon: Building2,
          });
        }
      });

      (region.opportunities || []).forEach((opp) => {
        if (
          opp.title.toLowerCase().includes(q) ||
          opp.sector.toLowerCase().includes(q) ||
          opp.description.toLowerCase().includes(q)
        ) {
          searchResults.push({
            type: 'opportunity',
            title: opp.title,
            subtitle: \`\${opp.sector} • \${opp.investmentRange}\`,
            href: \`/\${locale}/invest/\${regionId}\`,
            icon: FileText,
          });
        }
      });
    });

    return searchResults.slice(0, 10);
  }, [locale, targetCountry]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setResults(search(query));
  }, [query, search]);

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm hidden sm:inline">{t('search')}</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 rounded text-xs">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 border-b border-slate-700">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {results.length > 0 ? (
                  <div className="p-2">
                    {results.map((result, index) => (
                      <button
                        key={\`\${result.type}-\${index}\`}
                        onClick={() => handleSelect(result.href)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                      >
                        <div className="p-2 bg-slate-700 rounded-lg">
                          <result.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{result.title}</div>
                          <div className="text-sm text-slate-400 truncate">{result.subtitle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query ? (
                  <div className="p-8 text-center text-slate-500">
                    {t('noResults')}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    {t('searchHint')}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
`;
}

function generateContactPage(): string {
  return `import { useTranslations } from 'next-intl';
import { ContactForm } from '@/features/contact/ContactForm';
import { Breadcrumbs } from '@/components/widgets/Breadcrumbs';

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Breadcrumbs />
      <ContactForm />
    </div>
  );
}
`;
}

function generateContactForm(): string {
  return `"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Send, CheckCircle, AlertCircle, Loader2, Building2, Mail, User, MessageSquare } from 'lucide-react';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

interface FormData {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  investmentRange: string;
}

export function ContactForm() {
  const t = useTranslations('contact');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
    investmentRange: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus('success');
        setFormData({
          name: '',
          email: '',
          company: '',
          subject: '',
          message: '',
          investmentRange: '',
        });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center"
      >
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">{t('successTitle')}</h2>
        <p className="text-slate-400">{t('successMessage')}</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          {t('sendAnother')}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('title')}</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              {t('name')} *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              {t('email')} *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('emailPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Building2 className="w-4 h-4 inline mr-2" />
              {t('company')}
            </label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('companyPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('investmentRange')}
            </label>
            <select
              name="investmentRange"
              value={formData.investmentRange}
              onChange={handleChange}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('selectRange')}</option>
              <option value="<1M">{t('investmentRanges.under1m')}</option>
              <option value="1-10M">{t('investmentRanges.1to10m')}</option>
              <option value="10-50M">{t('investmentRanges.10to50m')}</option>
              <option value="50-100M">{t('investmentRanges.50to100m')}</option>
              <option value=">100M">{t('investmentRanges.over100m')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t('subject')} *
          </label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('subjectPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <MessageSquare className="w-4 h-4 inline mr-2" />
            {t('message')} *
          </label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={5}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder={t('messagePlaceholder')}
          />
        </div>

        {status === 'error' && (
          <div className="flex items-center gap-2 text-red-400 bg-red-400/10 rounded-lg p-4">
            <AlertCircle className="w-5 h-5" />
            <span>{t('errorMessage')}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              {t('submit')}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
`;
}

function generateContactApiRoute(): string {
  return `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company, subject, message, investmentRange } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.info('Contact form submission:', {
      name,
      email,
      company,
      subject,
      investmentRange,
      message: message.substring(0, 100) + '...',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;
}

function generateNewsletterApiRoute(): string {
  return `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    console.info('Newsletter subscription:', {
      email,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;
}

function generateReadme(
  name: string,
  countryPair: PortalScaffoldConfig["countryPair"]
): string {
  return `# ${name}

Bilingual business portal for ${countryPair.countryA}-${countryPair.countryB} trade and investment.

## Features

- 🌐 Bilingual support (${countryPair.locales.join(", ")})
- 🗺️ Interactive 3D globe and regional maps
- 📜 Laws and regulations guide
- 📅 Business event calendar
- 🏢 Organization directory
- 📰 News aggregator (RSS)
- 💰 Investment opportunity explorer

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your database URL

# Push database schema
pnpm db:push

# Seed initial data
pnpm db:seed

# Start development server
pnpm dev
\`\`\`

## Tech Stack

- Next.js 14 (App Router)
- next-intl (i18n)
- globe.gl (3D visualization)
- react-simple-maps (2D maps)
- Framer Motion (animations)
- Drizzle ORM (database)
- Tailwind CSS (styling)

## Project Structure

\`\`\`
src/
├── app/[locale]/     # Pages (laws, calendar, organizations, news, invest)
├── components/       # Shared components (globe, map, layout)
├── features/         # Feature-specific components
├── lib/              # Utilities (i18n, db, rss)
└── content/          # Static content files
\`\`\`
`;
}
