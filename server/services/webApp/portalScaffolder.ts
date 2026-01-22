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
        email: "Email",
        emailPlaceholder: "your@email.com",
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
        emailPlaceholder: "your@email.com",
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
                  {sector}
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
          <p className="text-2xl font-bold text-white">{data.gdp}</p>
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
          <p className="text-2xl font-bold text-white">{data.population}</p>
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
            {(locale === 'ru' && data.industriesRu ? data.industriesRu : locale === 'zh' && data.industriesZh ? data.industriesZh : data.industries).map((industry, index) => (
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
                  <span className="px-2 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded">{opp.sector}</span>
                  {getStatusBadge(opp.status)}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{getLocalizedField(opp as unknown as Record<string, unknown>, 'title', locale)}</h3>
                <p className="text-slate-400 text-sm mb-4">{getLocalizedField(opp as unknown as Record<string, unknown>, 'description', locale)}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>{opp.investmentRange}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{opp.timeline}</span>
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
                      <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">{project.sector}</span>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">{project.description}</p>
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
                    <span className="text-2xl font-bold text-green-400">{project.value}</span>
                    {project.completionYear && (
                      <span className="text-sm text-slate-500">{t('target')}: {project.completionYear}</span>
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
                    <h3 className="font-semibold text-white mb-1">{adv.title}</h3>
                    <p className="text-slate-400 text-sm">{adv.description}</p>
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
                  <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-full mb-2">{entrepreneur.industry}</span>
                  {entrepreneur.netWorth && (
                    <div className="flex items-center gap-1 text-green-400 text-sm font-semibold">
                      <DollarSign className="w-3 h-3" />
                      <span>{entrepreneur.netWorth}</span>
                    </div>
                  )}
                  {entrepreneur.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{entrepreneur.description}</p>
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
                <p className="text-white font-medium">{data.contactInfo.investmentAgency}</p>
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
                    {city.name}
                  </h3>
                  <p className="text-sm text-slate-500">{city.population || 'Click to explore'}</p>
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
  population?: string;
  description?: string;
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
  value: string;
  sector: string;
  description: string;
  partners?: string[];
  completionYear?: string;
}

export interface CompetitiveAdvantage {
  icon: 'location' | 'infrastructure' | 'talent' | 'policy' | 'market' | 'resources' | 'logistics' | 'tech';
  title: string;
  description: string;
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
      { id: "haidian", name: "Haidian District", population: "3.5M", lat: 39.9593, lng: 116.2986, image: "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=1920&q=80", description: "China's Silicon Valley - home to Zhongguancun tech hub, Tsinghua University, Peking University, and 20,000+ high-tech companies. The epicenter of AI, software, and deeptech in China.", opportunities: [
        { id: "hd-1", title: "Zhongguancun Software Park JV", titleZh: "中关村软件园合资企业", titleRu: "СП в Технопарке Чжунгуаньцунь", sector: "Software", description: "Joint ventures with China's top software companies. Access to 30,000+ developers and government contracts.", descriptionZh: "与中国顶级软件公司成立合资企业。可接触30,000多名开发人员和政府合同。", descriptionRu: "Совместные предприятия с ведущими софтверными компаниями Китая. Доступ к 30 000+ разработчикам и государственным контрактам.", investmentRange: "$2M - $30M", timeline: "1-2 years", status: "active" },
        { id: "hd-2", title: "University Technology Transfer", titleZh: "大学技术转让", titleRu: "Трансфер университетских технологий", sector: "DeepTech", description: "Commercialize patents from Tsinghua and Peking University. AI, quantum computing, new materials focus.", descriptionZh: "将清华大学和北京大学的专利商业化。专注于人工智能、量子计算和新材料。", descriptionRu: "Коммерциализация патентов Университетов Цинхуа и Пекина. Фокус на ИИ, квантовых вычислениях и новых материалах.", investmentRange: "$1M - $20M", timeline: "2-3 years", status: "priority" },
        { id: "hd-3", title: "AI Research Lab Partnerships", titleZh: "人工智能研究实验室合作", titleRu: "Партнёрство с лабораториями ИИ", sector: "AI", description: "Co-develop AI solutions with Baidu, ByteDance, and state research institutes located in Haidian.", descriptionZh: "与百度、字节跳动及海淀区国家研究机构共同开发人工智能解决方案。", descriptionRu: "Совместная разработка ИИ-решений с Baidu, ByteDance и государственными НИИ в районе Хайдянь.", investmentRange: "$5M - $50M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "chaoyang", name: "Chaoyang District", population: "3.9M", lat: 39.9219, lng: 116.4435, image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1920&q=80", description: "Beijing's CBD and diplomatic center. Home to 170+ foreign embassies, Fortune 500 regional HQs, and luxury retail. The gateway for international business in China.", opportunities: [
        { id: "cy-1", title: "CBD Grade A Office Development", titleZh: "CBD甲级写字楼开发", titleRu: "Девелопмент офисов класса А в деловом центре", sector: "Real Estate", description: "Premium office towers in Beijing's financial district. Strong demand from Russian and Central Asian firms.", descriptionZh: "北京金融区优质写字楼。来自俄罗斯和中亚企业的强劲需求。", descriptionRu: "Премиальные офисные башни в финансовом районе Пекина. Высокий спрос со стороны российских и центральноазиатских компаний.", investmentRange: "$50M - $300M", timeline: "3-5 years", status: "active" },
        { id: "cy-2", title: "Russia-China Trade Service Center", titleRu: "Российско-китайский торговый сервисный центр", titleZh: "俄中贸易服务中心", sector: "Professional Services", description: "One-stop shop for bilateral trade: legal, accounting, consulting, and logistics coordination.", descriptionRu: "Универсальный центр для двусторонней торговли: юридические, бухгалтерские, консалтинговые и логистические услуги.", descriptionZh: "双边贸易一站式服务：法律、会计、咨询和物流协调。", investmentRange: "$2M - $10M", timeline: "1 year", status: "priority" },
        { id: "cy-3", title: "798 Art District Cultural Exchange", titleZh: "798艺术区文化交流", titleRu: "Культурный обмен в арт-районе 798", sector: "Culture & Tourism", description: "Russia-China cultural center, gallery spaces, and creative industry incubator in famous art zone.", descriptionZh: "在著名艺术区设立中俄文化中心、画廊空间和创意产业孵化器。", descriptionRu: "Российско-китайский культурный центр, галереи и инкубатор креативных индустрий в знаменитом арт-районе.", investmentRange: "$5M - $30M", timeline: "2-3 years", status: "upcoming" }
      ]},
      { id: "dongcheng", name: "Dongcheng District", population: "0.8M", lat: 39.9282, lng: 116.4160, image: "https://images.unsplash.com/photo-1537002295-36f0c5c56c97?w=1920&q=80", description: "Historic heart of Beijing with the Forbidden City, government ministries, and cultural heritage. Premium location for tourism, hospitality, and government relations.", opportunities: [
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
      { id: "bj-p1", name: "Beijing Universal Studios Phase 2", value: "$3.2 Billion", sector: "Tourism & Entertainment", description: "Expansion of the theme park with new attractions and hotels, seeking technology and content partners.", partners: ["Comcast NBCUniversal", "Beijing Tourism Group"], completionYear: "2028" },
      { id: "bj-p2", name: "Beijing-Moscow High-Speed Rail Link", value: "$242 Billion", sector: "Infrastructure", description: "7,000km high-speed rail connecting capitals through Kazakhstan. Equipment supply and construction partnerships available.", partners: ["China Railway", "Russian Railways"], completionYear: "2035" },
      { id: "bj-p3", name: "Zhongguancun Forum Tech Transfer", value: "$500 Million", sector: "Technology", description: "Annual funding for international tech commercialization projects, priority given to Russia-China joint ventures.", completionYear: "Ongoing" }
    ],
    advantages: [
      { icon: "policy", title: "Political Hub", description: "Direct access to central government ministries and policy-making bodies. First city to implement new national policies." },
      { icon: "talent", title: "Top Talent Pool", description: "Home to 92 universities including Tsinghua and Peking. 40% of China's AI researchers based here." },
      { icon: "tech", title: "R&D Capital", description: "Highest R&D spending in China at 6.5% of GDP. 30,000+ high-tech enterprises in Zhongguancun alone." },
      { icon: "infrastructure", title: "Global Connectivity", description: "Two international airports with direct flights to all Russian major cities. High-speed rail hub." }
    ],
    notableEntrepreneurs: [
      { name: "Lei Jun", nameZh: "雷军", nameRu: "Лэй Цзюнь", company: "Xiaomi", industry: "Consumer Electronics", netWorth: "$13.5B", description: "Founder of Xiaomi, one of world's largest smartphone makers. Pioneer of internet-based hardware business model." },
      { name: "Robin Li", nameZh: "李彦宏", nameRu: "Робин Ли", company: "Baidu", industry: "AI & Search", netWorth: "$6.5B", description: "Co-founder of Baidu, China's dominant search engine. Leading investor in autonomous driving and AI research." },
      { name: "Zhang Yiming", nameZh: "张一鸣", nameRu: "Чжан Имин", company: "ByteDance", industry: "Social Media", netWorth: "$49.5B", description: "Founder of ByteDance (TikTok, Douyin). Created the world's most valuable startup and revolutionized short-form video." },
      { name: "Wang Xing", nameZh: "王兴", nameRu: "Ван Син", company: "Meituan", industry: "E-commerce", netWorth: "$10.2B", description: "Founder of Meituan, China's largest local services platform. Dominates food delivery, hotel booking, and ride-hailing." }
    ],
    contactInfo: { investmentAgency: "Beijing Investment Promotion Bureau", website: "http://www.investbeijing.gov.cn", email: "invest@beijing.gov.cn", phone: "+86-10-55568888" }
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
      { id: "pudong", name: "Pudong New Area", population: "5.5M", lat: 31.2231, lng: 121.5440, image: "https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?w=1920&q=80", description: "China's financial powerhouse - home to Lujiazui financial district, Shanghai Stock Exchange, and Zhangjiang Hi-Tech Park. The Lingang Free Trade Zone offers unprecedented foreign investment openness.", opportunities: [
        { id: "pd-1", title: "Lujiazui Financial Services", titleZh: "陆家嘴金融服务", titleRu: "Финансовые услуги Луцзяцзуй", sector: "Finance", description: "Establish securities, asset management, or insurance operations in China's Wall Street. Full foreign ownership now permitted.", descriptionZh: "在中国的华尔街设立证券、资产管理或保险业务。现已允许外资全资控股。", descriptionRu: "Создание операций по ценным бумагам, управлению активами или страхованию на китайской Уолл-стрит. Разрешено полное иностранное владение.", investmentRange: "$30M - $200M", timeline: "1-2 years", status: "priority" },
        { id: "pd-2", title: "Zhangjiang Semiconductor Hub", titleZh: "张江半导体中心", titleRu: "Полупроводниковый хаб Чжанцзян", sector: "Semiconductor", description: "IC design and manufacturing facilities with talent from SMIC, Huawei HiSilicon. Equipment import duty-free.", descriptionZh: "集成电路设计和制造设施，拥有来自中芯国际、华为海思的人才。设备进口免税。", descriptionRu: "Проектирование и производство ИС с талантами из SMIC и Huawei HiSilicon. Беспошлинный импорт оборудования.", investmentRange: "$50M - $500M", timeline: "2-4 years", status: "priority" },
        { id: "pd-3", title: "Lingang New Energy Vehicle Park", titleZh: "临港新能源汽车园区", titleRu: "Парк электромобилей Линьган", sector: "EV", description: "EV component manufacturing near Tesla Gigafactory. Supplier qualification assistance available.", descriptionZh: "靠近特斯拉超级工厂的电动汽车零部件制造。提供供应商资质认证协助。", descriptionRu: "Производство компонентов электромобилей рядом с гигафабрикой Tesla. Доступна помощь в квалификации поставщиков.", investmentRange: "$20M - $100M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "huangpu", name: "Huangpu District", population: "0.7M", lat: 31.2304, lng: 121.4737, image: "https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=1920&q=80", description: "The historic Bund and Nanjing Road - Shanghai's most prestigious address. Premium retail, hospitality, and luxury brands. Shanghai's original commercial center.", opportunities: [
        { id: "hp-1", title: "The Bund Luxury Retail", titleZh: "外滩奢侈品零售", titleRu: "Люксовый ритейл на набережной Банд", sector: "Retail", description: "Flagship stores on China's most famous shopping street. Russian luxury brands seeking China entry.", descriptionZh: "在中国最著名的购物街开设旗舰店。俄罗斯奢侈品牌寻求进入中国市场。", descriptionRu: "Флагманские магазины на самой известной торговой улице Китая. Российские люксовые бренды, стремящиеся выйти на китайский рынок.", investmentRange: "$10M - $50M", timeline: "1-2 years", status: "active" },
        { id: "hp-2", title: "Historic Building Hospitality", titleZh: "历史建筑酒店业", titleRu: "Гостиничный бизнес в исторических зданиях", sector: "Hospitality", description: "Boutique hotels and restaurants in protected heritage buildings. Premium tourism segment.", descriptionZh: "在受保护的历史建筑中开设精品酒店和餐厅。高端旅游市场。", descriptionRu: "Бутик-отели и рестораны в охраняемых исторических зданиях. Премиальный туристический сегмент.", investmentRange: "$20M - $80M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "jing-an", name: "Jing'an District", population: "1.1M", image: "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=1920&q=80", description: "Shanghai's tech and creative hub - headquarters of many internet companies, creative agencies, and innovation centers. Excellent transport and lifestyle amenities.", opportunities: [
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
      { id: "sh-p1", name: "Tesla Gigafactory Shanghai Expansion", value: "$1.2 Billion", sector: "EV Manufacturing", description: "Supplier opportunities for battery components, motors, and software systems.", partners: ["Tesla", "CATL"], completionYear: "2026" },
      { id: "sh-p2", name: "Shanghai STAR Market Technology Fund", value: "$15 Billion", sector: "Venture Capital", description: "Government-backed fund for tech IPOs. Co-investment opportunities for qualified foreign investors.", completionYear: "Ongoing" },
      { id: "sh-p3", name: "China International Import Expo (CIIE) Permanent Platform", value: "$2 Billion", sector: "Trade", description: "Year-round exhibition and trading platform for Russian exporters. Preferential customs and certification for CIIE participants.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "market", title: "Financial Hub", description: "China's Wall Street with Shanghai Stock Exchange, 1,600+ financial institutions, and RMB internationalization center." },
      { icon: "logistics", title: "World's Busiest Port", description: "Shanghai Port handles 47 million TEU annually. Direct shipping to all Russian ports." },
      { icon: "policy", title: "Most Open FTZ", description: "Lingang allows full foreign ownership in more sectors than anywhere else in China." },
      { icon: "infrastructure", title: "Premium Infrastructure", description: "Maglev train, two airports, extensive metro, and 5G coverage throughout the city." }
    ],
    notableEntrepreneurs: [
      { name: "Colin Huang", nameZh: "黄峥", nameRu: "Колин Хуан", company: "Pinduoduo", industry: "E-commerce", netWorth: "$38.9B", description: "Founder of Pinduoduo, revolutionized social e-commerce. China's third-largest online marketplace." },
      { name: "Jiang Bin", nameZh: "蒋滨", nameRu: "Цзян Бинь", company: "QuantumScape", industry: "Battery Technology", netWorth: "$2.1B", description: "Pioneering solid-state battery technology for next-generation electric vehicles." },
      { name: "Richard Liu", nameZh: "刘强东", nameRu: "Ричард Лю", company: "JD.com", industry: "E-commerce & Logistics", netWorth: "$12.8B", description: "Founder of JD.com, China's largest direct-sales retailer. Built world-class logistics infrastructure." }
    ],
    contactInfo: { investmentAgency: "Shanghai Municipal Commission of Commerce", website: "http://www.investment.gov.cn", email: "invest@shanghai.gov.cn", phone: "+86-21-62752200" }
  },
  "Guangdong": {
    name: "Guangdong",
    nameRu: "Гуандун",
    nameZh: "广东",
    gdp: "$1.96 Trillion",
    population: "126 Million",
    industries: ["Electronics", "Manufacturing", "Export Trade", "Technology"],
    sezCount: 6,
    taxBenefits: ["Shenzhen SEZ incentives", "15% CIT for high-tech", "Greater Bay Area benefits"],
    majorCities: [
      { id: "guangzhou", name: "Guangzhou", population: "18.7M", image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1920&q=80", description: "South China's commercial capital and Canton Fair host city. Major hub for automotive, trade, and logistics. Gateway to the Greater Bay Area with excellent connectivity.", opportunities: [
        { id: "gz-1", title: "Canton Fair Permanent Exhibition", titleZh: "广交会常设展馆", titleRu: "Постоянная выставка Кантонской ярмарки", sector: "Trade", description: "Year-round exhibition space at world's largest trade fair. Priority access for Russian exporters.", descriptionZh: "在世界最大贸易展会上的全年展览空间。俄罗斯出口商优先入驻。", descriptionRu: "Круглогодичное выставочное пространство на крупнейшей в мире торговой ярмарке. Приоритетный доступ для российских экспортёров.", investmentRange: "$5M - $30M", timeline: "1-2 years", status: "priority" },
        { id: "gz-2", title: "Guangzhou Auto Parts Cluster", titleZh: "广州汽车零部件集群", titleRu: "Кластер автокомпонентов Гуанчжоу", sector: "Automotive", description: "Tier 1/2 supplier facilities near GAC, Honda, Toyota, and Nissan assembly plants.", descriptionZh: "靠近广汽、本田、丰田和日产装配厂的一级/二级供应商设施。", descriptionRu: "Объекты поставщиков Tier 1/2 рядом со сборочными заводами GAC, Honda, Toyota и Nissan.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
        { id: "gz-3", title: "Nansha International Logistics Hub", titleZh: "南沙国际物流中心", titleRu: "Международный логистический хаб Наньша", sector: "Logistics", description: "Bonded warehousing and distribution center for Russia-China trade. Cold chain facilities available.", descriptionZh: "中俄贸易保税仓储和配送中心。提供冷链设施。", descriptionRu: "Таможенное складирование и распределительный центр для российско-китайской торговли. Доступны холодильные мощности.", investmentRange: "$15M - $100M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "shenzhen", name: "Shenzhen", population: "17.6M", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80", description: "Global hardware capital and home to Huawei, Tencent, BYD, and DJI. World-leading electronics manufacturing ecosystem with same-day prototyping capabilities. China's most innovative city.", opportunities: [
        { id: "sz-1", title: "Huaqiangbei Electronics Hub", titleZh: "华强北电子市场", titleRu: "Электронный хаб Хуацянбэй", sector: "Electronics", description: "World's largest electronics market - source components or establish trading operations. Instant access to any electronic part.", descriptionZh: "世界最大的电子市场——采购元器件或建立贸易业务。即时获取任何电子零部件。", descriptionRu: "Крупнейший в мире электронный рынок — закупка компонентов или торговые операции. Мгновенный доступ к любым электронным деталям.", investmentRange: "$1M - $20M", timeline: "6-12 months", status: "active" },
        { id: "sz-2", title: "Shenzhen Hardware Accelerator", titleZh: "深圳硬件加速器", titleRu: "Аппаратный акселератор Шэньчжэня", sector: "Hardware", description: "Bring hardware products from prototype to mass production. Access to 10,000+ component suppliers within 1 hour.", descriptionZh: "将硬件产品从原型推向量产。1小时内可接触10,000多家元器件供应商。", descriptionRu: "От прототипа до массового производства аппаратных продуктов. Доступ к 10 000+ поставщикам компонентов в радиусе 1 часа.", investmentRange: "$500K - $10M", timeline: "6-18 months", status: "priority" },
        { id: "sz-3", title: "Qianhai Fintech Zone", titleZh: "前海金融科技区", titleRu: "Финтех-зона Цяньхай", sector: "Fintech", description: "Cross-border fintech operations with RMB settlement capabilities. Blockchain and digital currency pilots.", descriptionZh: "跨境金融科技业务，支持人民币结算。区块链和数字货币试点。", descriptionRu: "Трансграничные финтех-операции с возможностью расчётов в юанях. Пилоты блокчейна и цифровых валют.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "sz-4", title: "BYD EV Supply Partnership", titleZh: "比亚迪电动汽车供应合作", titleRu: "Партнёрство с BYD по поставкам для электромобилей", sector: "EV", description: "Direct supplier partnerships with world's largest EV company. Battery, motors, and software components.", descriptionZh: "与全球最大电动汽车公司直接建立供应商合作关系。电池、电机和软件组件。", descriptionRu: "Прямое партнёрство с крупнейшим в мире производителем электромобилей. Аккумуляторы, моторы и программные компоненты.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" }
      ]},
      { id: "dongguan", name: "Dongguan", population: "10.5M", image: "https://images.unsplash.com/photo-1553697388-94e804e2f0f6?w=1920&q=80", description: "World's factory floor - the manufacturing powerhouse producing everything from electronics to furniture. Undergoing Industry 4.0 transformation with government subsidies for automation.", opportunities: [
        { id: "dg-1", title: "Smart Factory Transformation", titleZh: "智能工厂升级改造", titleRu: "Трансформация в умные фабрики", sector: "Manufacturing", description: "Upgrade 10,000+ factories with robotics and IoT. Government subsidizes 30% of automation costs.", descriptionZh: "为10,000多家工厂进行机器人和物联网升级。政府补贴30%的自动化成本。", descriptionRu: "Модернизация 10 000+ фабрик с помощью робототехники и IoT. Государство субсидирует 30% затрат на автоматизацию.", investmentRange: "$2M - $30M", timeline: "1-2 years", status: "priority" },
        { id: "dg-2", title: "Contract Manufacturing Partnership", titleZh: "代工制造合作", titleRu: "Партнёрство по контрактному производству", sector: "Manufacturing", description: "OEM/ODM partnerships for consumer products. Furniture, toys, electronics, textiles expertise.", descriptionZh: "消费品OEM/ODM合作。家具、玩具、电子产品、纺织品专业制造。", descriptionRu: "OEM/ODM партнёрства по потребительским товарам. Экспертиза в мебели, игрушках, электронике, текстиле.", investmentRange: "$1M - $20M", timeline: "6-12 months", status: "active" },
        { id: "dg-3", title: "Huawei Songshan Lake Campus", titleZh: "华为松山湖园区", titleRu: "Кампус Huawei Суншань Лейк", sector: "Technology", description: "R&D facilities near Huawei's spectacular European-style headquarters. Tech supplier opportunities.", descriptionZh: "靠近华为壮观欧式总部的研发设施。科技供应商机会。", descriptionRu: "Объекты R&D рядом со впечатляющей европейской штаб-квартирой Huawei. Возможности для техно-поставщиков.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "China's richest province and the heart of the Greater Bay Area - a megalopolis rivaling Tokyo and New York. Shenzhen is the global hardware capital; Guangzhou is a trade hub; Dongguan is the world's factory floor. Combined, they form an unmatched manufacturing and innovation ecosystem.",
    overviewRu: "Богатейшая провинция Китая и сердце района Большого залива — мегаполиса, соперничающего с Токио и Нью-Йорком. Шэньчжэнь — мировая столица электроники; Гуанчжоу — торговый хаб; Дунгуань — мировая фабрика. Вместе они образуют непревзойдённую производственную и инновационную экосистему.",
    overviewZh: "中国最富裕的省份，也是粤港澳大湾区的核心——这个超级都市群可与东京和纽约媲美。深圳是全球硬件之都；广州是贸易中心；东莞是世界工厂。它们共同构成了无与伦比的制造和创新生态系统。",
    targetSectors: ["Consumer Electronics", "5G & Telecom", "Electric Vehicles", "Smart Manufacturing", "Cross-border E-commerce"],
    opportunities: [
      { id: "gd-1", title: "Greater Bay Area Tech Corridor", titleZh: "粤港澳大湾区科技走廊", titleRu: "Технологический коридор Большого залива", sector: "Technology", description: "R&D centers with access to Huawei, Tencent, BYD, and DJI ecosystems. Shenzhen-Hong Kong-Macau innovation triangle participation.", descriptionZh: "可接入华为、腾讯、比亚迪和大疆生态系统的研发中心。参与深港澳创新三角。", descriptionRu: "R&D-центры с доступом к экосистемам Huawei, Tencent, BYD и DJI. Участие в инновационном треугольнике Шэньчжэнь-Гонконг-Макао.", investmentRange: "$5M - $200M", timeline: "1-3 years", status: "priority" },
      { id: "gd-2", title: "Dongguan Smart Factory Transformation", titleZh: "东莞智能工厂转型", titleRu: "Трансформация умных фабрик Дунгуаня", sector: "Manufacturing", description: "Industry 4.0 upgrades for 10,000+ factories. Robotics, IoT, and AI integration opportunities. Government subsidizes 30% of upgrade costs.", descriptionZh: "为10,000多家工厂进行工业4.0升级。机器人、物联网和人工智能集成机会。政府补贴30%升级成本。", descriptionRu: "Модернизация Индустрии 4.0 для 10 000+ фабрик. Возможности интеграции робототехники, IoT и ИИ. Государство субсидирует 30% затрат.", investmentRange: "$2M - $50M", timeline: "1-2 years", status: "active" },
      { id: "gd-3", title: "Qianhai Shenzhen-Hong Kong Cooperation Zone", titleZh: "前海深港合作区", titleRu: "Зона сотрудничества Цяньхай Шэньчжэнь-Гонконг", sector: "Finance & Services", description: "Professional services, fintech, and cross-border business zone. HK-style tax regime (15% CIT), RMB cross-border lending.", descriptionZh: "专业服务、金融科技和跨境商务区。香港式税制（15%企业所得税），跨境人民币贷款。", descriptionRu: "Зона профессиональных услуг, финтеха и трансграничного бизнеса. Гонконгский налоговый режим (15% налога), трансграничное кредитование в юанях.", investmentRange: "$10M - $100M", timeline: "1-2 years", status: "active" },
      { id: "gd-4", title: "BYD EV Supply Chain Cluster", titleZh: "比亚迪电动汽车供应链集群", titleRu: "Кластер цепочки поставок электромобилей BYD", sector: "Electric Vehicles", description: "Tier 1/2 supplier opportunities for world's largest EV manufacturer. Battery materials, motors, electronics, and software.", descriptionZh: "为全球最大电动汽车制造商提供一级/二级供应商机会。电池材料、电机、电子设备和软件。", descriptionRu: "Возможности поставщиков Tier 1/2 для крупнейшего в мире производителя электромобилей. Материалы для батарей, моторы, электроника и ПО.", investmentRange: "$20M - $500M", timeline: "2-4 years", status: "priority" }
    ],
    keyProjects: [
      { id: "gd-p1", name: "Hong Kong-Zhuhai-Macau Bridge Economic Zone", value: "$20 Billion", sector: "Infrastructure", description: "Development zones around the 55km sea bridge. Logistics, tourism, and tech park opportunities.", partners: ["HKSAR Government", "Macau SAR"], completionYear: "2030" },
      { id: "gd-p2", name: "Huawei Dongguan Campus Expansion", value: "$1.5 Billion", sector: "Technology", description: "Supply chain and R&D partnership opportunities with Huawei's European-style headquarters.", partners: ["Huawei"], completionYear: "2026" },
      { id: "gd-p3", name: "Guangzhou Nansha International AI Island", value: "$3 Billion", sector: "AI", description: "1,000-company AI cluster with compute infrastructure and talent programs.", completionYear: "2028" }
    ],
    advantages: [
      { icon: "market", title: "China's Richest Province", description: "GDP exceeds South Korea. 126 million consumers with highest disposable income in China." },
      { icon: "infrastructure", title: "Manufacturing Paradise", description: "Complete supply chain for electronics within 100km. Same-day prototyping in Shenzhen." },
      { icon: "logistics", title: "Export Gateway", description: "Guangzhou Port, Shenzhen Port, and Hong Kong Port handle 25% of China's trade." },
      { icon: "tech", title: "Innovation Powerhouse", description: "Home to Huawei, Tencent, BYD, DJI, OPPO, Vivo. More PCT patents than most countries." }
    ],
    notableEntrepreneurs: [
      { name: "Ma Huateng (Pony Ma)", nameZh: "马化腾", nameRu: "Ма Хуатэн", company: "Tencent", industry: "Technology & Gaming", netWorth: "$39.5B", description: "Co-founder of Tencent, operator of WeChat and world's largest gaming company. Pioneer of China's internet ecosystem." },
      { name: "Ren Zhengfei", nameZh: "任正非", nameRu: "Жэнь Чжэнфэй", company: "Huawei", industry: "Telecommunications", netWorth: "$1.9B", description: "Founder of Huawei, world's largest telecom equipment maker. Built from military background to global tech giant." },
      { name: "Wang Chuanfu", nameZh: "王传福", nameRu: "Ван Чуаньфу", company: "BYD", industry: "Electric Vehicles", netWorth: "$18.7B", description: "Founder of BYD, world's largest EV manufacturer. Warren Buffett-backed battery and automotive pioneer." },
      { name: "Frank Wang", nameZh: "汪滔", nameRu: "Ван Тао", company: "DJI", industry: "Drones", netWorth: "$4.8B", description: "Founder of DJI, controls 70% of global consumer drone market. Started in Hong Kong dorm room." },
      { name: "He Xiaopeng", nameZh: "何小鹏", nameRu: "Хэ Сяопэн", company: "XPeng", industry: "Electric Vehicles", netWorth: "$3.2B", description: "Co-founder of XPeng Motors, leading Chinese EV and autonomous driving startup." }
    ],
    contactInfo: { investmentAgency: "Guangdong Provincial Department of Commerce", website: "http://com.gd.gov.cn", email: "invest@gd.gov.cn", phone: "+86-20-38819912" }
  },
  "Jiangsu": {
    name: "Jiangsu",
    nameRu: "Цзянсу",
    nameZh: "江苏",
    gdp: "$1.88 Trillion",
    population: "85 Million",
    industries: ["Manufacturing", "Chemicals", "Textiles", "Electronics"],
    sezCount: 5,
    taxBenefits: ["Suzhou Industrial Park benefits", "Export processing zones", "High-tech park incentives"],
    majorCities: [
      { id: "nanjing", name: "Nanjing", population: "9.3M", image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=1920&q=80", description: "Historic capital of six dynasties and Jiangsu's provincial capital. Major center for education, research, and software development with 80+ universities and strong aerospace and automotive industries.", opportunities: [
        { id: "nj-1", title: "Nanjing Software Valley Expansion", titleZh: "南京软件谷扩展", titleRu: "Расширение Долины ПО Нанкина", sector: "Software", description: "China's second-largest software park. AI, cloud computing, and enterprise software development. 200,000+ IT professionals.", descriptionZh: "中国第二大软件园区。人工智能、云计算和企业软件开发。20万+IT专业人员。", descriptionRu: "Второй по величине софтверный парк Китая. ИИ, облачные вычисления и корпоративное ПО. 200 000+ ИТ-специалистов.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" },
        { id: "nj-2", title: "Jiangbei New Area Innovation Hub", titleZh: "江北新区创新中心", titleRu: "Инновационный хаб новой зоны Цзянбэй", sector: "Technology", description: "National-level new area focusing on integrated circuits, life sciences, and new finance. Generous tax incentives.", descriptionZh: "国家级新区，专注于集成电路、生命科学和新金融。优厚的税收优惠。", descriptionRu: "Национальная новая зона с фокусом на интегральные схемы, науки о жизни и новые финансы. Щедрые налоговые льготы.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "priority" },
        { id: "nj-3", title: "Aerospace & Defense Industrial Park", titleZh: "航空航天与国防工业园", titleRu: "Промышленный парк авиакосмической и оборонной отрасли", sector: "Aerospace", description: "Partnerships with AVIC and COMAC supply chain. Avionics, materials, and precision components.", descriptionZh: "与中航工业和中国商飞供应链合作。航空电子设备、材料和精密部件。", descriptionRu: "Партнёрства с цепочками поставок AVIC и COMAC. Авионика, материалы и прецизионные компоненты.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "suzhou", name: "Suzhou", population: "12.7M", image: "https://images.unsplash.com/photo-1567253508485-0e0a4e3c4024?w=1920&q=80", description: "The Venice of the East - ancient gardens meet cutting-edge industry. Suzhou Industrial Park is China's most successful foreign investment zone with 5,000+ foreign enterprises and a 30-year track record.", opportunities: [
        { id: "sz-sip-1", title: "Suzhou Industrial Park Biotech Bay", titleZh: "苏州工业园区生物科技湾", titleRu: "Биотехнологический залив промпарка Сучжоу", sector: "Biotech", description: "Asia's premier biotech cluster with 500+ companies. Direct NMPA engagement, Cold Spring Harbor partnership.", descriptionZh: "亚洲顶级生物技术集群，拥有500多家企业。直接对接国家药监局，与冷泉港合作。", descriptionRu: "Ведущий биотехнологический кластер Азии с 500+ компаниями. Прямое взаимодействие с NMPA, партнёрство с Cold Spring Harbor.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "sz-sip-2", title: "Suzhou Nanotechnology Hub", titleZh: "苏州纳米技术中心", titleRu: "Центр нанотехнологий Сучжоу", sector: "Advanced Materials", description: "China's national nanotechnology center. Research partnerships and commercialization support.", descriptionZh: "中国国家纳米技术中心。研究合作和商业化支持。", descriptionRu: "Национальный центр нанотехнологий Китая. Исследовательские партнёрства и поддержка коммерциализации.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" },
        { id: "sz-sip-3", title: "Precision Manufacturing Cluster", titleZh: "精密制造集群", titleRu: "Кластер прецизионного производства", sector: "Manufacturing", description: "World-class precision machining and automation. Supply chain for semiconductor equipment, medical devices.", descriptionZh: "世界级精密加工和自动化。半导体设备和医疗器械供应链。", descriptionRu: "Прецизионная обработка и автоматизация мирового класса. Цепочка поставок для полупроводникового оборудования и медицинских устройств.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "wuxi", name: "Wuxi", population: "7.5M", image: "https://images.unsplash.com/photo-1598887142487-3c854d51d678?w=1920&q=80", description: "China's national IoT demonstration city and semiconductor base. Beautiful lakeside location with strong manufacturing tradition now transforming into high-tech hub.", opportunities: [
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
      { id: "js-p1", name: "Samsung Suzhou Semiconductor Expansion", value: "$8 Billion", sector: "Semiconductor", description: "NAND flash expansion creating massive supply chain opportunities.", partners: ["Samsung Electronics"], completionYear: "2027" },
      { id: "js-p2", name: "Jiangsu-Russia Science Park", value: "$200 Million", sector: "Technology", description: "Dedicated park for Russia-China tech transfer and joint ventures.", completionYear: "2026" }
    ],
    advantages: [
      { icon: "infrastructure", title: "Premium Industrial Parks", description: "Suzhou Industrial Park is China's most successful FDI zone with 30-year track record." },
      { icon: "talent", title: "Engineering Talent", description: "167 universities, strong vocational training. Reliable skilled labor supply." },
      { icon: "logistics", title: "Yangtze Delta Location", description: "2 hours to Shanghai by high-speed rail. Excellent river and sea port access." },
      { icon: "policy", title: "Pro-Business Government", description: "Efficient bureaucracy, English-speaking investment services, 30+ years FDI experience." }
    ],
    contactInfo: { investmentAgency: "Jiangsu Provincial Department of Commerce", website: "http://swt.jiangsu.gov.cn", email: "invest@jiangsu.gov.cn", phone: "+86-25-57710228" }
  },
  "Shandong": {
    name: "Shandong",
    nameRu: "Шаньдун",
    nameZh: "山东",
    gdp: "$1.34 Trillion",
    population: "101 Million",
    industries: ["Petrochemicals", "Agriculture", "Heavy Industry", "Mining"],
    sezCount: 4,
    taxBenefits: ["Qingdao FTZ benefits", "Agricultural tax incentives", "Industrial zone benefits"],
    majorCities: [
      { id: "jinan", name: "Jinan", population: "9.2M", image: "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=1920&q=80", description: "The City of Springs - Shandong's capital with 72 famous springs. Major center for heavy industry, software, and government services. Growing focus on quantum computing and AI.", opportunities: [
        { id: "jn-1", title: "Jinan Quantum Valley", titleZh: "济南量子谷", titleRu: "Квантовая долина Цзинань", sector: "Quantum Technology", description: "China's quantum computing and communication research center. Partnership with University of Science and Technology of China.", descriptionZh: "中国量子计算和通信研究中心。与中国科学技术大学合作。", descriptionRu: "Центр исследований квантовых вычислений и связи Китая. Партнёрство с Университетом науки и технологий Китая.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "priority" },
        { id: "jn-2", title: "Heavy Equipment Modernization", titleZh: "重型设备现代化", titleRu: "Модернизация тяжёлого оборудования", sector: "Manufacturing", description: "Upgrade traditional machinery manufacturing with smart factory solutions. Local government subsidies available.", descriptionZh: "用智能工厂解决方案升级传统机械制造业。可获得地方政府补贴。", descriptionRu: "Модернизация традиционного машиностроения с решениями умных фабрик. Доступны субсидии местного правительства.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "qingdao", name: "Qingdao", population: "10.1M", image: "https://images.unsplash.com/photo-1569155235789-b0d2e6ea6cb7?w=1920&q=80", description: "Beautiful coastal city with German heritage, home to Tsingtao Beer, Haier, and Hisense. Major port and SCO cooperation hub. Excellent quality of life with beaches and mountains.", opportunities: [
        { id: "qd-1", title: "SCO Local Cooperation Demonstration Zone", titleZh: "上合组织地方合作示范区", titleRu: "Демонстрационная зона сотрудничества ШОС", sector: "Trade", description: "Dedicated zone for SCO member trade. Fast customs, RMB settlement, preferential policies for Russian goods.", descriptionZh: "上合组织成员国贸易专区。快速通关、人民币结算、俄罗斯商品优惠政策。", descriptionRu: "Специальная зона для торговли стран ШОС. Быстрое таможенное оформление, расчёты в юанях, преференции для российских товаров.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "qd-2", title: "Haier Smart Manufacturing Partnership", titleZh: "海尔智能制造合作", titleRu: "Партнёрство по умному производству с Haier", sector: "Manufacturing", description: "Supply chain and technology partnerships with world's largest appliance maker. Industry 4.0 showcase.", descriptionZh: "与全球最大家电制造商的供应链和技术合作。工业4.0展示。", descriptionRu: "Партнёрства по цепочке поставок и технологиям с крупнейшим в мире производителем бытовой техники. Витрина Индустрии 4.0.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" },
        { id: "qd-3", title: "Marine Technology & Blue Economy", titleZh: "海洋科技与蓝色经济", titleRu: "Морские технологии и голубая экономика", sector: "Marine", description: "Ocean observation equipment, marine biotech, and offshore engineering. Partnership with Ocean University of China.", descriptionZh: "海洋观测设备、海洋生物技术和海洋工程。与中国海洋大学合作。", descriptionRu: "Оборудование для наблюдения за океаном, морские биотехнологии и офшорная инженерия. Партнёрство с Океанским университетом Китая.", investmentRange: "$5M - $80M", timeline: "2-4 years", status: "active" },
        { id: "qd-4", title: "Craft Brewing & Food Processing", titleZh: "精酿啤酒与食品加工", titleRu: "Крафтовое пивоварение и пищевая промышленность", sector: "Food & Beverage", description: "Premium food and beverage manufacturing. Leverage Tsingtao Beer heritage and local agriculture.", descriptionZh: "优质食品饮料制造。利用青岛啤酒传统和当地农业。", descriptionRu: "Производство премиальных продуктов питания и напитков. Использование наследия Tsingtao Beer и местного сельского хозяйства.", investmentRange: "$2M - $30M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "yantai", name: "Yantai", population: "7.1M", image: "https://images.unsplash.com/photo-1569947609091-b29675c88880?w=1920&q=80", description: "China's wine capital and major seafood producer. Beautiful coastal city with strong ties to South Korea. Growing in automotive components and precision manufacturing.", opportunities: [
        { id: "yt-1", title: "Yantai Wine Industry Development", titleZh: "烟台葡萄酒产业发展", titleRu: "Развитие винодельческой отрасли Яньтай", sector: "Wine & Agriculture", description: "China's premier wine region. Vineyard acquisition, winery partnerships, and wine tourism development.", descriptionZh: "中国首要葡萄酒产区。葡萄园收购、酒庄合作和葡萄酒旅游开发。", descriptionRu: "Ведущий винодельческий регион Китая. Приобретение виноградников, партнёрства с винодельнями и развитие винного туризма.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" },
        { id: "yt-2", title: "Seafood Processing & Cold Chain", titleZh: "海鲜加工与冷链", titleRu: "Переработка морепродуктов и холодовая цепь", sector: "Food Processing", description: "Modern seafood processing facilities for Russia-sourced products. Cold chain infrastructure for export.", descriptionZh: "为俄罗斯采购产品提供现代海鲜加工设施。出口冷链基础设施。", descriptionRu: "Современные мощности по переработке морепродуктов для российской продукции. Инфраструктура холодовой цепи для экспорта.", investmentRange: "$10M - $80M", timeline: "1-3 years", status: "priority" },
        { id: "yt-3", title: "Automotive Components Hub", titleZh: "汽车零部件中心", titleRu: "Хаб автомобильных компонентов", sector: "Automotive", description: "Tier 1/2 supplier facilities near Hyundai, GM, and BYD plants. Growing EV component demand.", descriptionZh: "靠近现代、通用和比亚迪工厂的一级/二级供应商设施。电动汽车零部件需求不断增长。", descriptionRu: "Объекты поставщиков Tier 1/2 рядом с заводами Hyundai, GM и BYD. Растущий спрос на компоненты электромобилей.", investmentRange: "$8M - $60M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "China's third-largest economy and agricultural heartland. Shandong bridges North and East China with strong heavy industry, petrochemicals, and food processing. Qingdao is a major port city with German heritage and brewing tradition; Yantai excels in wine and seafood.",
    targetSectors: ["Petrochemicals", "Marine Economy", "High-end Equipment", "Food Processing", "New Energy"],
    opportunities: [
      { id: "sd-1", title: "Qingdao SCO Demonstration Zone", titleZh: "青岛上合示范区", titleRu: "Демонстрационная зона ШОС Циндао", sector: "Trade & Logistics", description: "Dedicated zone for Shanghai Cooperation Organization trade. Fast customs clearance for Russia-origin goods, RMB settlement, and logistics hub.", descriptionZh: "上海合作组织贸易专区。俄罗斯原产地商品快速清关、人民币结算和物流中心。", descriptionRu: "Специальная зона для торговли ШОС. Быстрое таможенное оформление товаров российского происхождения, расчёты в юанях и логистический хаб.", investmentRange: "$10M - $200M", timeline: "1-3 years", status: "priority" },
      { id: "sd-2", title: "Yantai LNG Terminal & Petrochemical Complex", titleZh: "烟台LNG接收站与石化综合体", titleRu: "СПГ-терминал и нефтехимический комплекс Яньтай", sector: "Energy", description: "Russia-sourced LNG receiving and processing. Integrate with Siberia-China pipeline network.", descriptionZh: "俄罗斯来源的LNG接收和加工。与西伯利亚-中国管道网络整合。", descriptionRu: "Приём и переработка СПГ из России. Интеграция с газопроводной сетью Сибирь-Китай.", investmentRange: "$100M - $1B", timeline: "3-5 years", status: "active" },
      { id: "sd-3", title: "Shandong Marine Ranching Program", titleZh: "山东海洋牧场项目", titleRu: "Программа морского фермерства Шаньдун", sector: "Fisheries", description: "Modern aquaculture, offshore platforms, and seafood processing. Technical partnerships with Russian Far East fisheries.", descriptionZh: "现代水产养殖、海上平台和海鲜加工。与俄罗斯远东渔业技术合作。", descriptionRu: "Современная аквакультура, офшорные платформы и переработка морепродуктов. Технические партнёрства с рыболовством Дальнего Востока России.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" },
      { id: "sd-4", title: "Weifang Hydrogen Economy Pilot", titleZh: "潍坊氢能经济试点", titleRu: "Пилот водородной экономики Вэйфан", sector: "New Energy", description: "Green hydrogen production, fuel cell manufacturing, and hydrogen vehicle deployment.", descriptionZh: "绿色氢气生产、燃料电池制造和氢能汽车部署。", descriptionRu: "Производство зелёного водорода, изготовление топливных элементов и развёртывание водородных автомобилей.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "upcoming" }
    ],
    keyProjects: [
      { id: "sd-p1", name: "Qingdao Sino-Russian Local Cooperation Park", value: "$500 Million", sector: "Manufacturing", description: "Dedicated industrial park for Russian manufacturing enterprises in China.", completionYear: "2027" },
      { id: "sd-p2", name: "Rizhao Steel Green Transformation", value: "$3 Billion", sector: "Steel", description: "Carbon-neutral steel production using Russian iron ore and hydrogen technology.", partners: ["Rizhao Steel"], completionYear: "2030" }
    ],
    advantages: [
      { icon: "resources", title: "Agricultural Base", description: "China's top producer of vegetables, fruits, and seafood. 100 million consumer market." },
      { icon: "logistics", title: "Strategic Ports", description: "Qingdao Port ranks 5th globally. Direct routes to Russian Pacific ports." },
      { icon: "market", title: "SCO Hub", description: "Only SCO local economic cooperation demonstration zone. Preferential Russia-China trade policies." },
      { icon: "infrastructure", title: "Industrial Foundation", description: "Mature heavy industry base with skilled workforce and supplier ecosystem." }
    ],
    contactInfo: { investmentAgency: "Shandong Provincial Department of Commerce", website: "http://commerce.shandong.gov.cn", email: "invest@shandong.gov.cn", phone: "+86-531-89013333" }
  },
  "Zhejiang": {
    name: "Zhejiang",
    nameRu: "Чжэцзян",
    nameZh: "浙江",
    gdp: "$1.23 Trillion",
    population: "65.4 Million",
    industries: ["E-commerce", "Manufacturing", "Textiles", "Digital Economy"],
    sezCount: 4,
    taxBenefits: ["Hangzhou digital economy incentives", "Cross-border e-commerce benefits", "Small business tax breaks"],
    majorCities: [
      { id: "hangzhou", name: "Hangzhou", population: "12.2M", image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=1920&q=80", description: "China's digital capital and home to Alibaba, Ant Group, and NetEase. Historic city with UNESCO World Heritage West Lake. 2022 Asian Games host with world-class infrastructure.", opportunities: [
        { id: "hz-1", title: "Alibaba Ecosystem Partnership", titleZh: "阿里巴巴生态合作", titleRu: "Партнёрство с экосистемой Alibaba", sector: "E-commerce", description: "Launch on Tmall Global, access Alibaba Cloud, and leverage Cainiao logistics. Direct partnership support.", descriptionZh: "入驻天猫国际，接入阿里云，利用菜鸟物流。直接合作支持。", descriptionRu: "Запуск на Tmall Global, доступ к Alibaba Cloud и логистике Cainiao. Прямая партнёрская поддержка.", investmentRange: "$1M - $50M", timeline: "6-18 months", status: "priority" },
        { id: "hz-2", title: "Hangzhou AI Town", titleZh: "杭州人工智能小镇", titleRu: "Городок ИИ в Ханчжоу", sector: "AI", description: "1,000-hectare AI innovation zone with DAMO Academy. Computing infrastructure, talent programs, and funding.", descriptionZh: "与达摩院合作的1000公顷人工智能创新区。计算基础设施、人才计划和资金支持。", descriptionRu: "1000-гектарная зона инноваций ИИ с Академией DAMO. Вычислительная инфраструктура, программы для талантов и финансирование.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" },
        { id: "hz-3", title: "Digital Healthcare Hub", titleZh: "数字医疗中心", titleRu: "Центр цифрового здравоохранения", sector: "HealthTech", description: "Internet hospital platforms, medical AI, and digital therapeutics. Partnership with top hospitals.", descriptionZh: "互联网医院平台、医疗人工智能和数字疗法。与顶级医院合作。", descriptionRu: "Платформы интернет-больниц, медицинский ИИ и цифровая терапия. Партнёрства с ведущими больницами.", investmentRange: "$3M - $60M", timeline: "1-3 years", status: "active" },
        { id: "hz-4", title: "Fintech & Digital Payments", titleZh: "金融科技与数字支付", titleRu: "Финтех и цифровые платежи", sector: "Fintech", description: "Payment solutions, blockchain applications, and digital banking. Ant Group ecosystem access.", descriptionZh: "支付解决方案、区块链应用和数字银行。接入蚂蚁集团生态系统。", descriptionRu: "Платёжные решения, блокчейн-приложения и цифровой банкинг. Доступ к экосистеме Ant Group.", investmentRange: "$5M - $80M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "ningbo", name: "Ningbo", population: "9.4M", image: "https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?w=1920&q=80", description: "World's largest port by cargo tonnage and China's private enterprise capital. Strong manufacturing base with excellent logistics. Gateway for Russia-China maritime trade.", opportunities: [
        { id: "nb-1", title: "Ningbo Port Russia Trade Hub", titleZh: "宁波港俄罗斯贸易中心", titleRu: "Торговый хаб Россия в порту Нинбо", sector: "Logistics", description: "Bonded warehousing and distribution for Russia-China trade. Connect Trans-Siberian Railway to maritime routes.", descriptionZh: "中俄贸易保税仓储和配送。连接西伯利亚大铁路与海运航线。", descriptionRu: "Таможенное складирование и дистрибуция для российско-китайской торговли. Соединение Транссиба с морскими маршрутами.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "nb-2", title: "Auto Parts & Mold Manufacturing", titleZh: "汽车零部件与模具制造", titleRu: "Производство автозапчастей и пресс-форм", sector: "Manufacturing", description: "China's mold-making capital with precision manufacturing. Automotive and appliance component clusters.", descriptionZh: "中国模具之都，精密制造。汽车和家电零部件集群。", descriptionRu: "Столица Китая по производству пресс-форм с прецизионным производством. Кластеры автомобильных и бытовых компонентов.", investmentRange: "$5M - $80M", timeline: "1-3 years", status: "active" },
        { id: "nb-3", title: "Petrochemical & New Materials", titleZh: "石化与新材料", titleRu: "Нефтехимия и новые материалы", sector: "Chemicals", description: "Integration with Zhenhai Refinery complex. Specialty chemicals and advanced polymers.", descriptionZh: "与镇海炼化综合体整合。特种化学品和先进聚合物。", descriptionRu: "Интеграция с НПЗ-комплексом Чжэньхай. Специальные химикаты и передовые полимеры.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "wenzhou", name: "Wenzhou", population: "9.6M", image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1920&q=80", description: "China's entrepreneurship capital - birthplace of private enterprise. Famous for shoes, leather goods, and eyewear. Strong overseas Chinese network with global trade connections.", opportunities: [
        { id: "wz-1", title: "Fashion & Footwear Innovation", titleZh: "时尚与鞋业创新", titleRu: "Инновации в моде и обуви", sector: "Fashion", description: "Partner with China's largest shoe manufacturing cluster. Smart manufacturing and sustainable materials.", descriptionZh: "与中国最大的鞋业制造集群合作。智能制造和可持续材料。", descriptionRu: "Партнёрство с крупнейшим в Китае обувным кластером. Умное производство и экологичные материалы.", investmentRange: "$2M - $40M", timeline: "1-2 years", status: "active" },
        { id: "wz-2", title: "Eyewear Manufacturing Hub", titleZh: "眼镜制造中心", titleRu: "Хаб производства очков", sector: "Manufacturing", description: "World's largest eyewear production base. OEM/ODM for global brands and own-brand development.", descriptionZh: "全球最大的眼镜生产基地。为全球品牌OEM/ODM和自主品牌开发。", descriptionRu: "Крупнейшая в мире база производства очков. OEM/ODM для мировых брендов и развитие собственного бренда.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" },
        { id: "wz-3", title: "Cross-border E-commerce Pilot", titleZh: "跨境电商试点", titleRu: "Пилот трансграничной электронной коммерции", sector: "E-commerce", description: "Leverage Wenzhou merchant networks for Russia market entry. Established trade channels to CIS countries.", descriptionZh: "利用温州商人网络进入俄罗斯市场。已建立通往独联体国家的贸易渠道。", descriptionRu: "Использование торговых сетей Вэньчжоу для выхода на российский рынок. Налаженные торговые каналы в страны СНГ.", investmentRange: "$1M - $20M", timeline: "6-12 months", status: "priority" }
      ]}
    ],
    overview: "Home to Alibaba and China's most dynamic private sector. Zhejiang leads in e-commerce, digital payments, and private entrepreneurship. Hangzhou hosts Alibaba, Ant Group, and NetEase; Ningbo is a major port; Wenzhou is famous for private enterprise.",
    targetSectors: ["Digital Economy", "E-commerce", "Fashion & Textiles", "Smart Manufacturing", "Cross-border Trade"],
    opportunities: [
      { id: "zj-1", title: "Alibaba Cross-border E-commerce Ecosystem", titleZh: "阿里巴巴跨境电商生态系统", titleRu: "Экосистема трансграничной электронной коммерции Alibaba", sector: "E-commerce", description: "Launch on Tmall Global, AliExpress, and Lazada. Warehouse and fulfillment services in Hangzhou Cross-border E-commerce Comprehensive Zone.", descriptionZh: "入驻天猫国际、速卖通和Lazada。杭州跨境电商综合试验区仓储和履约服务。", descriptionRu: "Запуск на Tmall Global, AliExpress и Lazada. Складские и фулфилмент-услуги в комплексной зоне трансграничной электронной коммерции Ханчжоу.", investmentRange: "$1M - $50M", timeline: "6-18 months", status: "active" },
      { id: "zj-2", title: "Ningbo Russia Trade Logistics Center", titleZh: "宁波俄罗斯贸易物流中心", titleRu: "Логистический центр российской торговли в Нинбо", sector: "Logistics", description: "Bonded warehouse and distribution center for Russia-China trade. Connect Trans-Siberian Railway to Ningbo Port.", descriptionZh: "中俄贸易保税仓库和配送中心。连接西伯利亚大铁路与宁波港。", descriptionRu: "Таможенный склад и распределительный центр для российско-китайской торговли. Соединение Транссиба с портом Нинбо.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "priority" },
      { id: "zj-3", title: "Hangzhou AI Town", titleZh: "杭州人工智能小镇", titleRu: "Городок ИИ в Ханчжоу", sector: "AI", description: "1,000-hectare AI innovation zone with Alibaba DAMO Academy partnership. Computing infrastructure and talent programs.", descriptionZh: "与阿里巴巴达摩院合作的1000公顷人工智能创新区。计算基础设施和人才计划。", descriptionRu: "1000-гектарная зона инноваций ИИ в партнёрстве с Академией DAMO Alibaba. Вычислительная инфраструктура и программы для талантов.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" },
      { id: "zj-4", title: "Zhejiang Fashion Industry Upgrade", titleZh: "浙江时尚产业升级", titleRu: "Модернизация модной индустрии Чжэцзяна", sector: "Textiles", description: "Smart garment manufacturing, sustainable textiles, and fashion tech. Partnerships with 50,000+ textile factories.", descriptionZh: "智能服装制造、可持续纺织品和时尚科技。与50,000多家纺织工厂合作。", descriptionRu: "Умное производство одежды, экологичный текстиль и модные технологии. Партнёрства с 50 000+ текстильными фабриками.", investmentRange: "$3M - $50M", timeline: "1-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "zj-p1", name: "Ant Group Digital Finance Platform", value: "$2 Billion", sector: "Fintech", description: "Cross-border payment and digital banking partnerships for Russia-China trade.", partners: ["Ant Group"], completionYear: "Ongoing" },
      { id: "zj-p2", name: "Geely-Volvo New Energy Vehicle Hub", value: "$1 Billion", sector: "Automotive", description: "EV manufacturing and supply chain opportunities.", partners: ["Geely", "Volvo"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "tech", title: "Digital Economy Leader", description: "Home to Alibaba, Ant Group, NetEase. Most advanced digital commerce ecosystem in China." },
      { icon: "market", title: "Private Sector Engine", description: "65% of GDP from private enterprises. Entrepreneurial culture with strong SME ecosystem." },
      { icon: "logistics", title: "Ningbo Port", description: "World's 3rd largest cargo port. Direct connections to Russia via sea and rail." },
      { icon: "infrastructure", title: "E-commerce Infrastructure", description: "Most developed cross-border e-commerce zone. Streamlined customs for online retail." }
    ],
    notableEntrepreneurs: [
      { name: "Jack Ma", nameZh: "马云", nameRu: "Джек Ма", company: "Alibaba Group", industry: "E-commerce & Fintech", netWorth: "$25.5B", description: "Founder of Alibaba, created world's largest e-commerce ecosystem. Former English teacher who built China's tech empire." },
      { name: "Zhong Shanshan", nameZh: "钟睒睒", nameRu: "Чжун Шаньшань", company: "Nongfu Spring", industry: "Beverages & Pharma", netWorth: "$62.3B", description: "China's richest person. Founded Nongfu Spring bottled water and major pharma stake. Famously private 'Lone Wolf'." },
      { name: "Ding Lei (William Ding)", nameZh: "丁磊", nameRu: "Дин Лэй", company: "NetEase", industry: "Gaming & Music", netWorth: "$25.8B", description: "Founder of NetEase, one of China's largest gaming and music streaming companies." },
      { name: "Li Shufu", nameZh: "李书福", nameRu: "Ли Шуфу", company: "Geely", industry: "Automotive", netWorth: "$16.2B", description: "Founder of Geely, owns Volvo, Lotus, and Polestar. China's most acquisitive auto entrepreneur." }
    ],
    contactInfo: { investmentAgency: "Zhejiang Provincial Department of Commerce", website: "http://zcom.zj.gov.cn", email: "invest@zj.gov.cn", phone: "+86-571-87057626" }
  },
  "Henan": {
    name: "Henan",
    nameRu: "Хэнань",
    nameZh: "河南",
    gdp: "$870 Billion",
    population: "99 Million",
    industries: ["Agriculture", "Food Processing", "Logistics", "Manufacturing"],
    sezCount: 3,
    taxBenefits: ["Zhengzhou Airport Economy Zone", "Central China incentives", "Agricultural processing benefits"],
    majorCities: [
      { id: "zhengzhou", name: "Zhengzhou", population: "12.6M", image: "https://images.unsplash.com/photo-1569078449082-93b5a5127c78?w=1920&q=80", description: "China's logistics crossroads where all major rail lines intersect. Home to Foxconn's largest iPhone factory and China-Europe Railway terminus. Gateway to 100 million Central China consumers.", opportunities: [
        { id: "zz-1", title: "Zhengzhou Airport Economy Zone", sector: "Logistics", description: "China's fastest-growing air cargo hub. Direct freight to Moscow. Bonded logistics for electronics and e-commerce.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "zz-2", title: "Foxconn iPhone City Supply Chain", sector: "Electronics", description: "Supply chain opportunities for world's largest smartphone factory. 300,000 workers and massive component demand.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" },
        { id: "zz-3", title: "China-Europe Railway Terminal", sector: "Trade", description: "Largest China-Europe rail hub. Direct trains to Moscow, Hamburg, Duisburg. Trade processing and logistics.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "luoyang", name: "Luoyang", population: "7.1M", image: "https://images.unsplash.com/photo-1600077106724-946750eeaf3c?w=1920&q=80", description: "Ancient capital with 13 dynasties of history. Now a heavy machinery and agricultural equipment center. Famous for peonies and Longmen Grottoes UNESCO site.", opportunities: [
        { id: "ly-1", title: "Luoyang Heavy Machinery JV", sector: "Machinery", description: "Partnerships with CIMC, Yituo, and other major equipment manufacturers. Mining and agricultural machinery.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" },
        { id: "ly-2", title: "Cultural Tourism Development", sector: "Tourism", description: "Longmen Grottoes UNESCO site area development. Hotels and cultural experiences.", investmentRange: "$5M - $80M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "kaifeng", name: "Kaifeng", population: "4.8M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Song Dynasty capital with preserved ancient city. Food processing hub with strong agricultural connections. Growing cultural tourism destination.", opportunities: [
        { id: "kf-1", title: "Kaifeng Food Processing Zone", sector: "Food", description: "Agricultural processing for Central China's wheat and produce. Cold chain and distribution development.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]}
    ],
    overview: "China's most populous province and transportation crossroads. Zhengzhou is a national logistics hub connecting all major cities by rail. Agricultural powerhouse leading in wheat, pork, and food processing. Emerging smartphone manufacturing center (Foxconn).",
    targetSectors: ["Logistics", "Food Processing", "Electronics Assembly", "Agriculture", "Cold Chain"],
    opportunities: [
      { id: "hn-1", title: "Zhengzhou Air Cargo Hub", sector: "Logistics", description: "China's largest air cargo hub by growth rate. Direct freight to Moscow, Novosibirsk. Bonded logistics for high-value goods.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
      { id: "hn-2", title: "Central China Cold Chain Network", sector: "Cold Chain", description: "Connect Russian food exports to 100 million Central China consumers. Cold storage, distribution, and retail partnerships.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "hn-3", title: "Foxconn Zhengzhou Supplier Park", sector: "Electronics", description: "Supply chain opportunities for world's largest iPhone factory. 300,000 workers, massive component demand.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" },
      { id: "hn-4", title: "Henan Agricultural Technology Zone", sector: "AgTech", description: "Precision farming, seed technology, and agricultural machinery. Partnerships with China's wheat research institutes.", investmentRange: "$3M - $50M", timeline: "2-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "hn-p1", name: "China-Europe Railway (Zhengzhou) Hub", value: "$1 Billion", sector: "Logistics", description: "Expanding rail freight terminal for Belt and Road. Direct trains to Moscow, Hamburg, Duisburg.", completionYear: "2027" },
      { id: "hn-p2", name: "Shuanghui-Smithfield Meat Processing Expansion", value: "$500 Million", sector: "Food", description: "World's largest pork producer expanding cold chain and processing capacity.", partners: ["WH Group"], completionYear: "2026" }
    ],
    advantages: [
      { icon: "logistics", title: "National Crossroads", description: "All major rail lines intersect in Zhengzhou. 2-hour flight to 90% of China's population." },
      { icon: "market", title: "100 Million Consumers", description: "Massive local market with rapidly growing middle class." },
      { icon: "resources", title: "Agricultural Powerhouse", description: "25% of China's wheat, 10% of pork. World-class food processing industry." },
      { icon: "talent", title: "Labor Abundance", description: "Large skilled workforce at competitive costs. Strong vocational training system." }
    ],
    contactInfo: { investmentAgency: "Henan Provincial Department of Commerce", website: "http://www.hncom.gov.cn", email: "invest@henan.gov.cn", phone: "+86-371-63576035" }
  },
  "Sichuan": {
    name: "Sichuan",
    nameRu: "Сычуань",
    nameZh: "四川",
    gdp: "$830 Billion",
    population: "83.7 Million",
    industries: ["Electronics", "Aerospace", "Agriculture", "Tourism"],
    sezCount: 3,
    taxBenefits: ["Western Development incentives", "15% CIT for encouraged industries", "Land use discounts"],
    majorCities: [
      { id: "chengdu", name: "Chengdu", population: "21.2M", image: "https://images.unsplash.com/photo-1590093441241-e00f1a9b3b84?w=1920&q=80", description: "Western China's tech capital and one of China's most livable cities. Home to giant pandas, spicy cuisine, and thriving startup scene. Dual airport city with direct Moscow flights.", opportunities: [
        { id: "cd-1", title: "Tianfu Software Park Innovation Hub", sector: "Gaming & Tech", description: "China's gaming capital with 1,000+ studios. Game development, localization, and publishing partnerships.", investmentRange: "$2M - $50M", timeline: "1-2 years", status: "priority" },
        { id: "cd-2", title: "Chengdu Aerospace Industrial Park", sector: "Aerospace", description: "Commercial aircraft components, satellites, and drones. COMAC and AVIC supply chain opportunities.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "active" },
        { id: "cd-3", title: "China-Europe Railway Western Hub", sector: "Logistics", description: "Direct rail to Europe through Russia. Fastest route for Western China exports. Logistics development.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" },
        { id: "cd-4", title: "Panda & Cultural Tourism", sector: "Tourism", description: "Giant Panda breeding center, Sichuan cuisine experiences, and cultural tourism. Growing Russian tourist interest.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "mianyang", name: "Mianyang", population: "4.9M", image: "https://images.unsplash.com/photo-1569254998317-8e794e1c5fb1?w=1920&q=80", description: "China's Science City - home to numerous defense research institutes. Strong in electronics, new materials, and high-tech manufacturing. Relatively lower costs than Chengdu.", opportunities: [
        { id: "my-1", title: "Mianyang High-Tech Zone", sector: "Technology", description: "Electronics, new materials, and precision manufacturing. Access to defense technology spinoffs.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" },
        { id: "my-2", title: "Display Technology Manufacturing", sector: "Electronics", description: "BOE and other display manufacturers. Panel and component supply chain.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "leshan", name: "Leshan", population: "3.2M", image: "https://images.unsplash.com/photo-1591122947157-26bad3a117d2?w=1920&q=80", description: "UNESCO Giant Buddha heritage site and silicon materials production center. Beautiful confluence of three rivers. Growing tourism and clean energy industries.", opportunities: [
        { id: "ls-1", title: "Leshan Silicon Materials Base", sector: "Materials", description: "Polysilicon and solar material production. Clean energy supply chain development.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "ls-2", title: "Giant Buddha Tourism Development", sector: "Tourism", description: "UNESCO World Heritage site area. Hotels, cruise tourism, and cultural experiences.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Western China's economic powerhouse and gateway to Southwest Asia. Chengdu rivals coastal cities in livability and innovation. Strong aerospace, electronics, and gaming industries. Famous for pandas, cuisine, and rapidly growing tech scene.",
    targetSectors: ["Aerospace & Aviation", "Gaming & Entertainment", "Electronics", "Biomedicine", "Tourism"],
    opportunities: [
      { id: "sc-1", title: "Chengdu Aerospace Industrial Park", sector: "Aerospace", description: "Commercial aircraft components, satellites, and drones. Partnership with COMAC and AVIC subsidiaries.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "sc-2", title: "Tianfu Software Park Gaming Hub", sector: "Gaming", description: "China's gaming capital with 1,000+ studios. Localization, development, and publishing partnerships.", investmentRange: "$2M - $50M", timeline: "1-2 years", status: "active" },
      { id: "sc-3", title: "Chengdu-Europe Railway Gateway", sector: "Logistics", description: "Direct rail link to Europe through Russia. Fastest route for Western China exports. Logistics and trade hub development.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" },
      { id: "sc-4", title: "Sichuan Panda Cultural Tourism", sector: "Tourism", description: "Eco-tourism, theme parks, and cultural experiences. Growing Russian tourist interest in Sichuan.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "sc-p1", name: "Chengdu Tianfu International Airport", value: "$11 Billion", sector: "Aviation", description: "China's 4th largest airport. Cargo and logistics zone development ongoing.", completionYear: "2025" },
      { id: "sc-p2", name: "China-Russia Sichuan Technology Park", value: "$150 Million", sector: "Technology", description: "Joint R&D center for aerospace, new materials, and energy technology.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "talent", title: "Tech Talent Hub", description: "56 universities, strong in engineering and software. Lower costs than coastal cities." },
      { icon: "infrastructure", title: "Dual Airport City", description: "Two international airports with direct Moscow flights. High-speed rail expanding rapidly." },
      { icon: "policy", title: "Western Development Zone", description: "15% CIT rate, land discounts, and talent subsidies under national policy." },
      { icon: "market", title: "Gateway to SW Asia", description: "Strategic location for accessing Southeast Asian markets via rail and road." }
    ],
    contactInfo: { investmentAgency: "Sichuan Provincial Department of Commerce", website: "http://swt.sc.gov.cn", email: "invest@sichuan.gov.cn", phone: "+86-28-83220039" }
  },
  "Hubei": {
    name: "Hubei",
    nameRu: "Хубэй",
    nameZh: "湖北",
    gdp: "$770 Billion",
    population: "57.5 Million",
    industries: ["Automotive", "Steel", "Optoelectronics", "Biomedicine"],
    sezCount: 3,
    taxBenefits: ["Wuhan Optics Valley incentives", "Central China development benefits", "High-tech enterprise benefits"],
    majorCities: [
      { id: "wuhan", name: "Wuhan", population: "13.6M", image: "https://images.unsplash.com/photo-1568485248685-019a98426c14?w=1920&q=80", description: "Central China's megapolis spanning three cities at the Yangtze confluence. China's optical fiber and laser capital (Optics Valley). Major automotive center with Dongfeng Motor headquarters.", opportunities: [
        { id: "wh-1", title: "Optics Valley Innovation Hub", sector: "Optoelectronics", description: "China's laser and fiber optics capital. BOE, Huawei optical, and 100+ laser companies. Display technology R&D.", investmentRange: "$10M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "wh-2", title: "Dongfeng EV Partnership", sector: "Automotive", description: "Electric vehicle development with Dongfeng Motor Group. Component manufacturing and technology JVs.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "wh-3", title: "Wuhan Biotech Valley", sector: "Biotech", description: "Vaccine development, biomanufacturing, and medical devices. Post-pandemic public health investment focus.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
        { id: "wh-4", title: "Yangtze River Port Logistics", sector: "Logistics", description: "China's largest inland port. River transport connecting Central China to Shanghai.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "yichang", name: "Yichang", population: "4.0M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Gateway to the Three Gorges Dam - world's largest hydropower station. Major chemicals and phosphate mining center. Beautiful Yangtze Gorges tourism.", opportunities: [
        { id: "yc-1", title: "Clean Energy & Chemicals", sector: "Energy", description: "Leverage Three Gorges hydropower for energy-intensive industries. Green chemicals and hydrogen.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
        { id: "yc-2", title: "Three Gorges Tourism", sector: "Tourism", description: "Dam visits, Yangtze cruises, and scenic area development. Growing international tourism.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "xiangyang", name: "Xiangyang", population: "5.3M", image: "https://images.unsplash.com/photo-1580844947206-7b2e1a3257c1?w=1920&q=80", description: "Ancient walled city and automotive manufacturing base. Dongfeng commercial vehicle headquarters. Strategic location on the Han River with growing aerospace industry.", opportunities: [
        { id: "xy-1", title: "Commercial Vehicle Manufacturing", sector: "Automotive", description: "Dongfeng commercial trucks, buses, and special vehicles. Component supply chain opportunities.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "active" },
        { id: "xy-2", title: "Aerospace Components", sector: "Aerospace", description: "Aviation component manufacturing for AVIC and COMAC. Growing aerospace cluster.", investmentRange: "$15M - $120M", timeline: "3-5 years", status: "upcoming" }
      ]}
    ],
    overview: "Central China's industrial heart with Wuhan as a tri-city megapolis. Optics Valley is China's laser and fiber optics capital. Strong automotive sector (Dongfeng) and emerging biotech. Strategic Yangtze River location for logistics.",
    targetSectors: ["Optoelectronics", "Automotive", "Biotech", "Steel & Materials", "Education"],
    opportunities: [
      { id: "hb-1", title: "Wuhan Optics Valley Expansion", sector: "Optoelectronics", description: "Laser equipment, fiber optics, and display technology. Home to BOE, Huawei optical, and 100+ laser companies.", investmentRange: "$10M - $200M", timeline: "2-3 years", status: "priority" },
      { id: "hb-2", title: "Dongfeng Auto New Energy JV", sector: "Automotive", description: "Electric vehicle development with Dongfeng Motor Group. Component manufacturing and technology partnerships.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
      { id: "hb-3", title: "Wuhan Biotech Innovation Center", sector: "Biotech", description: "Vaccine development, biomanufacturing, and medical devices. Leveraging post-pandemic investment in public health.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "hb-4", title: "Yangtze River Industrial Corridor", sector: "Logistics", description: "River port development connecting Central China to Shanghai. Steel, grain, and container logistics.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "hb-p1", name: "YMTC Memory Chip Expansion", value: "$24 Billion", sector: "Semiconductor", description: "China's leading NAND manufacturer expanding capacity. Supply chain opportunities.", partners: ["YMTC"], completionYear: "2027" },
      { id: "hb-p2", name: "Wuhan High-Speed Rail Hub", value: "$3 Billion", sector: "Infrastructure", description: "Central China's largest rail hub expansion.", completionYear: "2028" }
    ],
    advantages: [
      { icon: "tech", title: "Optics Valley", description: "China's fiber optics and laser capital. 30% of China's optical fiber produced here." },
      { icon: "talent", title: "University City", description: "89 universities with 1.3 million students. Strongest engineering talent in Central China." },
      { icon: "logistics", title: "Yangtze Gateway", description: "Wuhan Port is largest inland port. Direct water route to Shanghai." },
      { icon: "infrastructure", title: "Transportation Hub", description: "High-speed rail connections to all major cities within 4 hours." }
    ],
    contactInfo: { investmentAgency: "Hubei Provincial Department of Commerce", website: "http://swt.hubei.gov.cn", email: "invest@hubei.gov.cn", phone: "+86-27-87235520" }
  },
  "Hunan": {
    name: "Hunan",
    nameRu: "Хунань",
    nameZh: "湖南",
    gdp: "$680 Billion",
    population: "66.2 Million",
    industries: ["Construction Machinery", "Electronics", "Agriculture", "Culture Media"],
    sezCount: 2,
    taxBenefits: ["Changsha Economic Zone benefits", "Central China incentives", "Cultural industry support"],
    majorCities: [
      { id: "changsha", name: "Changsha", population: "10.5M", image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1920&q=80", description: "Capital of Hunan and emerging tech hub. Home to SANY and Zoomlion headquarters - world's largest construction machinery makers. Vibrant entertainment industry and famous for spicy cuisine.", opportunities: [
        { id: "cs-1", title: "SANY-Russia Heavy Machinery JV", sector: "Construction Machinery", description: "Partner with world's largest concrete machinery maker. Mining and construction equipment for Russian market.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "cs-2", title: "Changsha AI Manufacturing Hub", sector: "AI", description: "Industrial AI applications for smart factories. Autonomous construction equipment development.", investmentRange: "$5M - $80M", timeline: "2-4 years", status: "active" },
        { id: "cs-3", title: "Mango TV Media Partnership", sector: "Entertainment", description: "Content co-production and streaming platform partnerships with China's top entertainment network.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "zhuzhou", name: "Zhuzhou", population: "3.9M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "China's rail transport capital. Home to CRRC Zhuzhou producing electric locomotives, metro trains, and maglev systems. Key supplier for Belt and Road rail projects.", opportunities: [
        { id: "zz-1", title: "CRRC Rail Equipment Partnership", sector: "Rail Transport", description: "Electric locomotives and metro systems for Russia modernization. Technology transfer and local production.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
        { id: "zz-2", title: "Maglev Technology Cooperation", sector: "Transport", description: "Medium-speed maglev for urban transit. China's most advanced maglev technology.", investmentRange: "$100M - $800M", timeline: "5-7 years", status: "upcoming" },
        { id: "zz-3", title: "Rail Components Manufacturing", sector: "Manufacturing", description: "Traction systems, signaling, and rolling stock components for rail industry.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "xiangtan", name: "Xiangtan", population: "2.7M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "Birthplace of Chairman Mao and industrial city in the Changsha-Zhuzhou-Xiangtan city cluster. Strong in steel, machinery, and new energy vehicles.", opportunities: [
        { id: "xt-1", title: "Xiangtan Steel Green Upgrade", sector: "Steel", description: "Low-carbon steel production technology. Hydrogen-based steelmaking pilot.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
        { id: "xt-2", title: "Electric Bus Manufacturing", sector: "EV", description: "Electric bus production for urban transit. Strong domestic demand and export potential.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Home to construction machinery giants SANY and Zoomlion. Strong in rail transport equipment (CRRC Zhuzhou), entertainment media, and agriculture. Changsha is an emerging cultural and innovation hub.",
    targetSectors: ["Construction Machinery", "Rail Transport", "Media & Entertainment", "Agriculture", "New Materials"],
    opportunities: [
      { id: "hun-1", title: "SANY Heavy Equipment JV", sector: "Machinery", description: "Partnership opportunities with world's largest concrete machinery manufacturer. Export and technology cooperation.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "active" },
      { id: "hun-2", title: "Zhuzhou Rail Innovation Hub", sector: "Rail", description: "R&D for electric locomotives, metro systems, and maglev. CRRC partnership opportunities.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" }
    ],
    keyProjects: [
      { id: "hun-p1", name: "Changsha AI Industrial Park", value: "$500 Million", sector: "AI", description: "AI applications for manufacturing and autonomous vehicles.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "infrastructure", title: "Machinery Capital", description: "SANY, Zoomlion headquarters. Complete construction equipment supply chain." },
      { icon: "talent", title: "Engineering Excellence", description: "Strong technical universities and vocational training." }
    ],
    contactInfo: { investmentAgency: "Hunan Provincial Department of Commerce", website: "http://swt.hunan.gov.cn", email: "invest@hunan.gov.cn" }
  },
  "Fujian": {
    name: "Fujian",
    nameRu: "Фуцзянь",
    nameZh: "福建",
    gdp: "$730 Billion",
    population: "41.5 Million",
    industries: ["Electronics", "Machinery", "Textiles", "Maritime Trade"],
    sezCount: 4,
    taxBenefits: ["Xiamen SEZ benefits", "Taiwan Strait incentives", "Free trade pilot zone"],
    majorCities: [
      { id: "fuzhou", name: "Fuzhou", population: "8.3M", image: "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=1920&q=80", description: "Provincial capital with rich history and growing tech sector. Headquarters of Ningde (CATL) nearby - world's largest EV battery maker. Strong textile and electronics industries.", opportunities: [
        { id: "fz-1", title: "CATL Battery Supply Chain", sector: "Battery", description: "Component supplier partnerships with world's largest battery maker. Cathode, anode, and separator materials.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
        { id: "fz-2", title: "Fuzhou Software Park", sector: "Software", description: "Software development and BPO services. Strong talent from local universities.", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "active" },
        { id: "fz-3", title: "Fujian FTZ Headquarters", sector: "Trade", description: "Regional headquarters for Russia-China trade operations. Bonded logistics and trade finance.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "xiamen", name: "Xiamen", population: "5.3M", image: "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=1920&q=80", description: "Beautiful coastal city and original SEZ. Known as China's garden city with excellent quality of life. Strong in electronics, software, and cross-strait trade.", opportunities: [
        { id: "xm-1", title: "Xiamen Cross-Strait E-commerce", sector: "E-commerce", description: "E-commerce platform leveraging Taiwan and Southeast Asia trade networks.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "xm-2", title: "Xiamen Software Park II", sector: "IT", description: "Software development and IT services. Dell, IBM, and local firms present.", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "active" },
        { id: "xm-3", title: "Xiamen Port Logistics Hub", sector: "Logistics", description: "Container shipping and logistics for Southeast Asia trade. Direct Russia routes via Arctic.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "quanzhou", name: "Quanzhou", population: "8.8M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Ancient maritime Silk Road starting point. China's sportswear capital - home to Anta, 361°, and Peak. Strong in shoes, textiles, and stone materials.", opportunities: [
        { id: "qz-1", title: "Sportswear Manufacturing JV", sector: "Apparel", description: "Partnership with Anta, 361°, Peak for Russian market sportswear. OEM and brand licensing.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "priority" },
        { id: "qz-2", title: "Smart Textile Manufacturing", sector: "Textiles", description: "Industry 4.0 textile production. Automated garment manufacturing.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
        { id: "qz-3", title: "Quanzhou Stone Materials", sector: "Materials", description: "Premium stone and ceramic tiles for construction. Export to Russia and Central Asia.", investmentRange: "$5M - $40M", timeline: "1-2 years", status: "active" }
      ]}
    ],
    overview: "Taiwan-facing province with special cross-strait policies. Xiamen is a beautiful coastal city with strong trade ties. Strong in electronics, sportswear (Anta, Li-Ning), and tea. Gateway for Taiwan investment into mainland.",
    targetSectors: ["Electronics", "Sportswear & Apparel", "Taiwan Trade", "Maritime", "New Energy"],
    opportunities: [
      { id: "fj-1", title: "Xiamen Cross-Strait E-commerce Zone", sector: "E-commerce", description: "Leverage Taiwan trade relationships and logistics infrastructure for regional e-commerce.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
      { id: "fj-2", title: "Fuzhou New Energy Vehicle Cluster", sector: "EV", description: "CATL battery headquarters region. EV supply chain opportunities.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" }
    ],
    keyProjects: [
      { id: "fj-p1", name: "CATL Battery Expansion", value: "$5 Billion", sector: "Battery", description: "World's largest battery maker expanding in home province.", partners: ["CATL"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "policy", title: "Taiwan Gateway", description: "Special policies for Taiwan business. Unique cross-strait opportunities." },
      { icon: "logistics", title: "Maritime Hub", description: "Major ports facing Taiwan and Southeast Asia." }
    ],
    contactInfo: { investmentAgency: "Fujian Provincial Department of Commerce", website: "http://swt.fujian.gov.cn", email: "invest@fujian.gov.cn" }
  },
  "Anhui": {
    name: "Anhui",
    nameRu: "Аньхой",
    nameZh: "安徽",
    gdp: "$680 Billion",
    population: "61 Million",
    industries: ["Automotive", "Home Appliances", "New Energy", "AI"],
    sezCount: 2,
    taxBenefits: ["Hefei high-tech zone benefits", "Yangtze Delta integration incentives", "New energy vehicle support"],
    majorCities: [
      { id: "hefei", name: "Hefei", population: "9.4M", image: "https://images.unsplash.com/photo-1617952739858-28043cecdae3?w=1920&q=80", description: "China's fastest-rising tech hub and new EV capital. Home to NIO HQ, VW EV plant, USTC (quantum computing leader), and iFlytek (voice AI). Aggressive government investment strategy attracting global firms.", opportunities: [
        { id: "hf-1", title: "NIO EV Supply Partnership", sector: "EV", description: "Direct supplier relationships with premium EV maker. Battery, motors, electronics, and software.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "hf-2", title: "Hefei Quantum Computing Hub", sector: "Quantum", description: "China's quantum technology center with USTC. Quantum communication and computing research.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "upcoming" },
        { id: "hf-3", title: "iFlytek AI Ecosystem", sector: "AI", description: "Voice recognition and AI partnerships with China's leading AI company.", investmentRange: "$5M - $80M", timeline: "1-3 years", status: "active" },
        { id: "hf-4", title: "BOE Display Technology Park", sector: "Display", description: "LCD and OLED display manufacturing. Supply chain for global electronics.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "wuhu", name: "Wuhu", population: "3.6M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "Home to Chery Automobile - China's largest automotive exporter. Major robotics and new materials center on the Yangtze River.", opportunities: [
        { id: "wh-1", title: "Chery Auto Export Partnership", sector: "Automotive", description: "Partnership with China's top car exporter. CKD assembly and distribution for Russia.", investmentRange: "$30M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "wh-2", title: "Wuhu Robotics Cluster", sector: "Robotics", description: "Industrial robotics manufacturing. EFORT and other leading robot makers.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "maanshan", name: "Ma'anshan", population: "2.2M", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=80", description: "Major steel city transitioning to advanced manufacturing. Strategic location near Nanjing with excellent logistics connections.", opportunities: [
        { id: "mas-1", title: "Green Steel Technology", sector: "Steel", description: "Low-carbon steel production. Hydrogen-based reduction technology.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" },
        { id: "mas-2", title: "New Materials Industrial Park", sector: "Materials", description: "Advanced steel products and new materials for automotive and construction.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Fastest-growing provincial economy and EV powerhouse. Hefei attracted NIO, Volkswagen, and emerging as AI center. Home appliance giants (Midea factories), display technology (BOE), and quantum computing research.",
    targetSectors: ["Electric Vehicles", "AI & Quantum Computing", "Home Appliances", "Display Technology", "New Materials"],
    opportunities: [
      { id: "ah-1", title: "Hefei EV Capital Investment", sector: "EV", description: "NIO headquarters, VW EV factory, and 200+ EV suppliers. Complete supply chain for electric vehicles.", investmentRange: "$20M - $500M", timeline: "2-4 years", status: "priority" },
      { id: "ah-2", title: "Quantum Computing Research Park", sector: "Quantum", description: "China's quantum computing center with USTC partnership. Cutting-edge research opportunities.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "upcoming" }
    ],
    keyProjects: [
      { id: "ah-p1", name: "NIO Hefei Advanced Manufacturing", value: "$1 Billion", sector: "EV", description: "Premium EV manufacturing expansion.", partners: ["NIO"], completionYear: "2026" }
    ],
    advantages: [
      { icon: "tech", title: "EV Capital", description: "China's emerging electric vehicle center with full supply chain." },
      { icon: "talent", title: "USTC Excellence", description: "Top science university with quantum computing breakthroughs." }
    ],
    contactInfo: { investmentAgency: "Anhui Provincial Department of Commerce", website: "http://swt.ah.gov.cn", email: "invest@anhui.gov.cn" }
  },
  "Liaoning": {
    name: "Liaoning",
    nameRu: "Ляонин",
    nameZh: "辽宁",
    gdp: "$400 Billion",
    population: "42.5 Million",
    industries: ["Heavy Industry", "Shipbuilding", "Petrochemicals", "Equipment Manufacturing"],
    sezCount: 3,
    taxBenefits: ["Northeast revitalization incentives", "Dalian FTZ benefits", "Equipment manufacturing support"],
    majorCities: [
      { id: "shenyang", name: "Shenyang", population: "9.1M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Northeast China's largest city and traditional heavy industry capital. Home to Shenyang Machine Tool, BMW Brilliance, and major aerospace facilities. Deep Russian influence in architecture and culture.", opportunities: [
        { id: "sy-1", title: "Shenyang Heavy Machinery 4.0", sector: "Machinery", description: "Smart manufacturing upgrades for machine tools and industrial equipment. German-style precision engineering.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "sy-2", title: "BMW Brilliance Supply Chain", sector: "Automotive", description: "Component supply for BMW's largest global production base. Premium auto parts.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" },
        { id: "sy-3", title: "Shenyang Aerospace Industrial Park", sector: "Aerospace", description: "Aircraft components and UAV manufacturing. AVIC partnership opportunities.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "dalian", name: "Dalian", population: "7.5M", image: "https://images.unsplash.com/photo-1559682468-a6a29e7d9517?w=1920&q=80", description: "Beautiful coastal city dubbed 'Northern Hong Kong'. Major port with direct Russia routes, strong software industry, and shipbuilding. Popular Japanese and Korean business destination.", opportunities: [
        { id: "dl-1", title: "Dalian Russia Trade Hub", sector: "Trade", description: "Comprehensive trade zone for Russia imports/exports. Direct shipping to Vladivostok (2 days).", investmentRange: "$10M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "dl-2", title: "Dalian Software Park", sector: "IT", description: "Japan/Korea outsourcing hub expanding to Russia. 100,000+ IT professionals.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "dl-3", title: "Dalian Shipbuilding Partnership", sector: "Shipbuilding", description: "LNG carriers, tankers, and container ships. Dalian Shipbuilding is among world's largest.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "dl-4", title: "Dalian Petrochemical Complex", sector: "Petrochemicals", description: "Downstream oil processing and specialty chemicals. Russian crude processing.", investmentRange: "$100M - $800M", timeline: "4-6 years", status: "upcoming" }
      ]},
      { id: "anshan", name: "Anshan", population: "3.3M", image: "https://images.unsplash.com/photo-1597473322203-2c4f0e36e1c3?w=1920&q=80", description: "Steel capital of China with Ansteel Group - one of world's largest steelmakers. Rich iron ore reserves and complete metallurgy supply chain.", opportunities: [
        { id: "as-1", title: "Ansteel Green Steel Partnership", sector: "Steel", description: "Low-carbon steel production and technology. Electric arc furnace and hydrogen reduction.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
        { id: "as-2", title: "Steel Products Processing", sector: "Manufacturing", description: "High-value steel products for automotive and construction. Specialized alloys.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Northeast China's industrial heartland with strong Russian ties. Dalian is a major port and tech hub; Shenyang leads in heavy machinery. Deep historical and economic connections with Russia.",
    targetSectors: ["Heavy Machinery", "Shipbuilding", "Petrochemicals", "Russia Trade", "Software"],
    opportunities: [
      { id: "ln-1", title: "Dalian Russia Trade Gateway", sector: "Trade", description: "Direct shipping to Vladivostok, trade processing zone for Russian goods.", investmentRange: "$10M - $100M", timeline: "1-3 years", status: "priority" },
      { id: "ln-2", title: "Shenyang Heavy Equipment Modernization", sector: "Machinery", description: "Industry 4.0 upgrades for China's machinery base. Robot integration and smart manufacturing.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "ln-p1", name: "Dalian Shipbuilding Expansion", value: "$2 Billion", sector: "Shipbuilding", description: "LNG carriers and container ships for Russia-China routes.", completionYear: "2028" }
    ],
    advantages: [
      { icon: "location", title: "Russia Gateway", description: "Closest major port to Russian Far East. Direct connections to Vladivostok." },
      { icon: "infrastructure", title: "Industrial Base", description: "China's traditional heavy industry center with skilled workforce." }
    ],
    contactInfo: { investmentAgency: "Liaoning Provincial Department of Commerce", website: "http://swt.ln.gov.cn", email: "invest@liaoning.gov.cn" }
  },
  "Shaanxi": {
    name: "Shaanxi",
    nameRu: "Шэньси",
    nameZh: "陕西",
    gdp: "$450 Billion",
    population: "39.5 Million",
    industries: ["Aerospace", "Energy", "Technology", "Tourism"],
    sezCount: 2,
    taxBenefits: ["Xi'an High-tech Zone incentives", "Western Development policy", "Belt and Road benefits"],
    majorCities: [
      { id: "xian", name: "Xi'an", population: "13M", image: "https://images.unsplash.com/photo-1529551739587-e242c564f727?w=1920&q=80", description: "Ancient capital of 13 dynasties and terminus of the Silk Road. Home to Terracotta Warriors, major aerospace center, and Samsung's largest semiconductor fab outside Korea. Starting point for China-Europe freight rail.", opportunities: [
        { id: "xa-1", title: "Xi'an Aerospace Supply Chain", sector: "Aerospace", description: "Aircraft components, satellites, and UAVs for AVIC and COMAC. Avionics and materials.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "xa-2", title: "Chang'an-Europe Rail Hub", sector: "Logistics", description: "Rail freight terminus for China-Europe routes. Bonded logistics and trade processing to Moscow.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "xa-3", title: "Xi'an Samsung Semiconductor Ecosystem", sector: "Semiconductor", description: "Supply chain for Samsung's $17B NAND fab. Equipment, materials, and services.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" },
        { id: "xa-4", title: "Silk Road Cultural Tourism", sector: "Tourism", description: "Terracotta Warriors, ancient city walls, and Silk Road heritage. Premium cultural experiences.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "baoji", name: "Baoji", population: "3.3M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "Titanium capital of China and major defense manufacturing center. Produces 90% of China's titanium. Strategic location on ancient Silk Road.", opportunities: [
        { id: "bj-1", title: "Baoji Titanium Partnership", sector: "Materials", description: "Titanium production and processing for aerospace and medical. 90% of China's titanium.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "bj-2", title: "Defense Equipment Conversion", sector: "Manufacturing", description: "Civilian applications of defense manufacturing capabilities. Precision machinery.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "xianyang", name: "Xianyang", population: "4.2M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Ancient Qin Dynasty capital adjacent to Xi'an airport. Major electronics manufacturing and pharmaceutical production. Growing logistics hub.", opportunities: [
        { id: "xy-1", title: "Xi'an Airport Economy Zone", sector: "Logistics", description: "Air cargo and e-commerce logistics near major international airport.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" },
        { id: "xy-2", title: "Pharmaceutical Manufacturing", sector: "Pharma", description: "Traditional Chinese medicine and generic drug production.", investmentRange: "$15M - $100M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Ancient capital and Belt and Road starting point. Xi'an is a major aerospace center (AVIC, COMAC), technology hub, and tourist destination (Terracotta Warriors). Key node for China-Europe rail freight.",
    targetSectors: ["Aerospace", "Belt and Road Trade", "Tourism", "Technology", "Energy"],
    opportunities: [
      { id: "sax-1", title: "Xi'an Aerospace Industrial Base", sector: "Aerospace", description: "Aircraft components, satellites, and UAVs. AVIC and COMAC supply chain opportunities.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "sax-2", title: "Chang'an-Europe Railway Hub", sector: "Logistics", description: "China-Europe freight train origin point. Logistics park development for Russia-China trade.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "sax-p1", name: "Xi'an International Trade Port", value: "$800 Million", sector: "Logistics", description: "Expanding rail freight terminal and bonded zone.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Belt and Road Hub", description: "Starting point of Chang'an-Europe railway. Direct trains to Moscow." },
      { icon: "infrastructure", title: "Aerospace Center", description: "Major aircraft manufacturing base with complete supply chain." }
    ],
    contactInfo: { investmentAgency: "Shaanxi Provincial Department of Commerce", website: "http://sxdofcom.shaanxi.gov.cn", email: "invest@shaanxi.gov.cn" }
  },
  "Jiangxi": {
    name: "Jiangxi",
    nameRu: "Цзянси",
    nameZh: "江西",
    gdp: "$430 Billion",
    population: "45.2 Million",
    industries: ["Aviation", "Electronics", "New Materials", "Rare Earths"],
    sezCount: 2,
    taxBenefits: ["Central China development benefits", "Aviation industry incentives", "Rare earth processing support"],
    majorCities: [
      { id: "nanchang", name: "Nanchang", population: "6.3M", image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=1920&q=80", description: "Provincial capital and birthplace of PLA. Emerging aviation manufacturing hub with helicopter production. Host of World VR Industry Conference - China's VR capital.", opportunities: [
        { id: "nc-1", title: "Nanchang Aviation Manufacturing", sector: "Aviation", description: "Helicopter and trainer aircraft production. AVIC Hongdu partnership opportunities.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "nc-2", title: "Nanchang VR Industry Hub", sector: "VR/AR", description: "China's VR industry center with 200+ companies. Hardware and content development.", investmentRange: "$5M - $80M", timeline: "2-3 years", status: "active" },
        { id: "nc-3", title: "Nanchang High-tech Zone", sector: "Electronics", description: "LED and semiconductor lighting. Electronic components manufacturing.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "ganzhou", name: "Ganzhou", population: "9.8M", image: "https://images.unsplash.com/photo-1569335468083-1b4c4b5e6fd0?w=1920&q=80", description: "China's rare earth capital with 30% of national reserves. Critical for EV batteries, electronics, and clean energy. Strategic resource for technology manufacturing.", opportunities: [
        { id: "gz-1", title: "Ganzhou Rare Earth Processing", sector: "Materials", description: "Value-added rare earth processing. Permanent magnets for EVs and wind turbines.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "gz-2", title: "Rare Earth Magnet Manufacturing", sector: "Manufacturing", description: "NdFeB magnets for electric motors and generators. Critical EV component.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "gz-3", title: "Ganzhou Furniture Industry", sector: "Manufacturing", description: "Southern China's largest furniture production base. Wood processing and export.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "jiujiang", name: "Jiujiang", population: "4.6M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Major Yangtze River port city at Poyang Lake. Gateway for Jiangxi's exports with strong petrochemical and textile industries.", opportunities: [
        { id: "jj-1", title: "Jiujiang Petrochemical Park", sector: "Petrochemicals", description: "Oil refining and chemical production on Yangtze River. Excellent logistics.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" },
        { id: "jj-2", title: "Jiujiang Port Logistics", sector: "Logistics", description: "Yangtze River shipping hub. Container and bulk cargo handling.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Rising central province with aviation manufacturing and rare earth resources. Nanchang hosts aircraft manufacturing; Ganzhou has China's largest rare earth deposits. Cost-competitive with strong government support.",
    targetSectors: ["Aviation", "Rare Earths", "Electronics", "New Materials", "VR/AR"],
    opportunities: [
      { id: "jx-1", title: "Nanchang Aviation Industrial Park", sector: "Aviation", description: "Helicopter and regional aircraft manufacturing. AVIC partnership opportunities.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" },
      { id: "jx-2", title: "Ganzhou Rare Earth Processing", sector: "Materials", description: "Value-added rare earth processing and magnet manufacturing.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "priority" }
    ],
    keyProjects: [
      { id: "jx-p1", name: "Nanchang VR Industry Base", value: "$300 Million", sector: "VR", description: "China's VR industry cluster with 200+ companies.", completionYear: "2026" }
    ],
    advantages: [
      { icon: "resources", title: "Rare Earth Capital", description: "Ganzhou has 30% of China's rare earth reserves." },
      { icon: "policy", title: "Cost Advantage", description: "Lower costs than coastal regions with strong incentives." }
    ],
    contactInfo: { investmentAgency: "Jiangxi Provincial Department of Commerce", website: "http://swt.jiangxi.gov.cn", email: "invest@jiangxi.gov.cn" }
  },
  "Chongqing": {
    name: "Chongqing",
    nameRu: "Чунцин",
    nameZh: "重庆",
    gdp: "$430 Billion",
    population: "32.1 Million",
    industries: ["Automotive", "Electronics", "Pharmaceuticals", "Logistics"],
    sezCount: 3,
    taxBenefits: ["Western Development incentives", "Liangjiang New Area benefits", "Land-sea trade corridor benefits"],
    majorCities: [
      { id: "yuzhong", name: "Yuzhong District", population: "0.6M", image: "https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?w=1920&q=80", description: "Historic peninsula core of Chongqing at Yangtze-Jialing confluence. Famous for dramatic hillside architecture, hot pot cuisine, and vibrant nightlife. Major financial and commercial district.", opportunities: [
        { id: "yz-1", title: "Jiefangbei CBD Development", sector: "Real Estate", description: "Premium office and retail in Chongqing's historic center. Finance and professional services.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" },
        { id: "yz-2", title: "Yangtze Riverfront Tourism", sector: "Tourism", description: "Cruise terminal and riverside entertainment. Hongya Cave expansion.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "jiangbei", name: "Jiangbei District", population: "0.9M", image: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1920&q=80", description: "New business district north of the Jialing River. Home to Guanyinqiao shopping area and expanding financial services sector. Major airport gateway.", opportunities: [
        { id: "jb-1", title: "Jiangbei Airport Economy Zone", sector: "Logistics", description: "Air cargo and e-commerce logistics hub. Direct flights to Moscow and Europe.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
        { id: "jb-2", title: "Guanyinqiao Retail Hub", sector: "Retail", description: "One of China's top shopping districts. Chinese and international brand expansion.", investmentRange: "$10M - $100M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "liangjiang", name: "Liangjiang New Area", population: "3.2M", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=80", description: "National-level new area and western China's development engine. Automotive hub (Chang'an, Ford), electronics manufacturing, and smart industry demonstration zone.", opportunities: [
        { id: "lj-1", title: "Chang'an Auto Partnership", sector: "Automotive", description: "EV and ICE vehicle manufacturing with China's 4th largest automaker. Complete supply chain.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
        { id: "lj-2", title: "Liangjiang Smart Manufacturing", sector: "Manufacturing", description: "Industry 4.0 demonstration with robotics, IoT, and AI integration.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" },
        { id: "lj-3", title: "Laptop & Electronics Assembly", sector: "Electronics", description: "HP, Acer laptop production. 40% of global laptop output from Chongqing.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" },
        { id: "lj-4", title: "China-Europe Rail Terminal", sector: "Logistics", description: "Chongqing-Duisburg rail freight hub. 10,000+ trains annually to Europe.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" }
      ]}
    ],
    overview: "China's largest municipality and western logistics hub. Major automotive center (Chang'an, Ford) and electronics manufacturer (HP, Foxconn laptops). Key terminus for China-Europe railway and land-sea corridor to Southeast Asia.",
    targetSectors: ["Automotive", "Electronics", "Logistics", "Smart Manufacturing", "Biotech"],
    opportunities: [
      { id: "cq-1", title: "Liangjiang New Area Smart Manufacturing", sector: "Manufacturing", description: "Industry 4.0 demonstration zone with automotive and electronics clusters.", investmentRange: "$20M - $300M", timeline: "2-4 years", status: "priority" },
      { id: "cq-2", title: "Western Land-Sea Corridor Hub", sector: "Logistics", description: "New trade route connecting Russia via Central Asia to Southeast Asian ports.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }
    ],
    keyProjects: [
      { id: "cq-p1", name: "Chongqing-Duisburg Rail Expansion", value: "$500 Million", sector: "Logistics", description: "Doubling capacity of China-Europe freight trains.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Western Hub", description: "Junction of Yangtze River, China-Europe railway, and land-sea corridor." },
      { icon: "market", title: "Mega City", description: "32 million population with rapidly growing consumer market." }
    ],
    contactInfo: { investmentAgency: "Chongqing Municipal Commission of Commerce", website: "http://sww.cq.gov.cn", email: "invest@cq.gov.cn" }
  },
  "Yunnan": { name: "Yunnan", gdp: "$400 Billion", population: "47.2 Million", industries: ["Tourism", "Mining", "Agriculture", "Hydropower"], sezCount: 2, taxBenefits: ["Western Development incentives", "Border trade benefits", "Tourism industry support"], majorCities: [{ id: "kunming", name: "Kunming", population: "8.5M", lat: 25.0389, lng: 102.7183, image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=1920&q=80" }, { id: "yuxi", name: "Yuxi", population: "2.3M", lat: 24.3550, lng: 102.5428, image: "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=1920&q=80" }, { id: "qujing", name: "Qujing", population: "5.8M", lat: 25.4900, lng: 103.7960, image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80" }], overview: "China's gateway to Southeast Asia with stunning natural beauty. Kunming enjoys 'Spring City' climate. Rich in minerals, biodiversity, and hydropower. Tourism powerhouse with unique ethnic cultures.", targetSectors: ["Tourism", "Mining", "Southeast Asia Trade", "Hydropower", "Specialty Agriculture"], opportunities: [{ id: "yn-1", title: "Kunming Southeast Asia Trade Hub", titleZh: "昆明东南亚贸易中心", titleRu: "Куньминский торговый хаб Юго-Восточной Азии", sector: "Trade", description: "Gateway to ASEAN via Laos railway. Trade processing and logistics development.", descriptionZh: "通过老挝铁路通往东盟的门户。贸易加工和物流发展。", descriptionRu: "Ворота в АСЕАН через железную дорогу в Лаос. Торговая переработка и развитие логистики.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }, { id: "yn-2", title: "Yunnan Eco-Tourism Development", titleZh: "云南生态旅游开发", titleRu: "Развитие экотуризма Юньнани", sector: "Tourism", description: "Luxury resorts, adventure tourism, and ethnic cultural experiences.", descriptionZh: "豪华度假村、探险旅游和民族文化体验。", descriptionRu: "Роскошные курорты, приключенческий туризм и этнические культурные впечатления.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "yn-p1", name: "China-Laos Railway Economic Corridor", value: "$2 Billion", sector: "Infrastructure", description: "Development zones along new railway to Southeast Asia.", completionYear: "2030" }], advantages: [{ icon: "location", title: "ASEAN Gateway", description: "Land border with Myanmar, Laos, Vietnam. New railway to Thailand." }, { icon: "resources", title: "Natural Wealth", description: "Rich in minerals, hydropower, and biodiversity." }], contactInfo: { investmentAgency: "Yunnan Provincial Department of Commerce", website: "http://swt.yn.gov.cn", email: "invest@yunnan.gov.cn" } },
  "Guangxi": { name: "Guangxi", nameRu: "Гуанси", nameZh: "广西", gdp: "$370 Billion", population: "50.1 Million", industries: ["Sugar Processing", "Nonferrous Metals", "Machinery", "ASEAN Trade"], sezCount: 2, taxBenefits: ["ASEAN FTZ benefits", "Western Development incentives", "Border economic cooperation"], majorCities: [{ id: "nanning", name: "Nanning", population: "8.7M" }, { id: "liuzhou", name: "Liuzhou", population: "4.2M" }, { id: "guilin", name: "Guilin", population: "4.9M" }], overview: "Home to China-ASEAN Expo and gateway to Southeast Asia. Nanning hosts permanent ASEAN trade infrastructure. Guilin's stunning karst landscape attracts millions of tourists. Strong in automotive (SAIC-GM-Wuling) and aluminum.", targetSectors: ["ASEAN Trade", "Automotive", "Aluminum", "Tourism", "Sugar & Agriculture"], opportunities: [{ id: "gx-1", title: "China-ASEAN Trade Platform", titleZh: "中国-东盟贸易平台", titleRu: "Китайско-АСЕАН торговая платформа", sector: "Trade", description: "Permanent expo infrastructure for Southeast Asian trade. Bonded warehousing and e-commerce fulfillment.", descriptionZh: "东南亚贸易永久性博览会基础设施。保税仓储和电商物流。", descriptionRu: "Постоянная инфраструктура выставки для торговли с Юго-Восточной Азией. Таможенные склады и электронная коммерция.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" }, { id: "gx-2", title: "Wuling EV Manufacturing Expansion", titleZh: "五菱电动汽车生产扩张", titleRu: "Расширение производства электромобилей Wuling", sector: "Automotive", description: "Low-cost EV production with SAIC-GM-Wuling. Mini EV supply chain opportunities.", descriptionZh: "与上汽通用五菱合作的低成本电动汽车生产。微型电动汽车供应链机会。", descriptionRu: "Производство недорогих электромобилей с SAIC-GM-Wuling. Возможности в цепочке поставок мини-электромобилей.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "priority" }], keyProjects: [{ id: "gx-p1", name: "Beibu Gulf Economic Zone", value: "$1 Billion", sector: "Port", description: "Port and industrial development on Gulf of Tonkin.", completionYear: "2028" }], advantages: [{ icon: "location", title: "ASEAN Hub", description: "Hosts annual China-ASEAN Expo. Direct border with Vietnam." }, { icon: "logistics", title: "Sea & Land Routes", description: "Port access and land routes to Southeast Asia." }], contactInfo: { investmentAgency: "Guangxi Department of Commerce", website: "http://swt.gxzf.gov.cn", email: "invest@guangxi.gov.cn" } },
  "Shanxi": { name: "Shanxi", nameRu: "Шаньси", nameZh: "山西", gdp: "$340 Billion", population: "34.9 Million", industries: ["Coal Mining", "Steel", "Chemicals", "New Energy"], sezCount: 1, taxBenefits: ["Energy transition incentives", "Industrial upgrading support", "Environmental tech benefits"], majorCities: [{ id: "taiyuan", name: "Taiyuan", population: "5.3M" }, { id: "datong", name: "Datong", population: "3.1M" }, { id: "changzhi", name: "Changzhi", population: "3.2M" }], overview: "China's coal heartland undergoing green transformation. Major investment in solar, hydrogen, and clean coal technology. Rich in ancient temples and historic sites along Silk Road.", targetSectors: ["Clean Energy", "Green Coal Technology", "Hydrogen", "Cultural Tourism", "New Materials"], opportunities: [{ id: "sx-1", title: "Shanxi Green Energy Transition", titleZh: "山西绿色能源转型", titleRu: "Переход Шаньси на зелёную энергетику", sector: "Energy", description: "Solar farms, hydrogen production, and coal-to-chemicals. Government incentives for clean energy.", descriptionZh: "太阳能农场、氢能生产和煤化工。政府清洁能源激励措施。", descriptionRu: "Солнечные электростанции, производство водорода и углехимия. Государственные стимулы для чистой энергии.", investmentRange: "$20M - $500M", timeline: "3-5 years", status: "priority" }, { id: "sx-2", title: "Datong Cultural Tourism", titleZh: "大同文化旅游", titleRu: "Культурный туризм Датуна", sector: "Tourism", description: "UNESCO Yungang Grottoes area development. Hotel and tourism infrastructure.", descriptionZh: "联合国教科文组织云冈石窟地区开发。酒店和旅游基础设施。", descriptionRu: "Развитие зоны пещер Юньган ЮНЕСКО. Отельная и туристическая инфраструктура.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "sx-p1", name: "Shanxi Hydrogen Corridor", value: "$2 Billion", sector: "Hydrogen", description: "Green hydrogen production and fuel cell deployment.", completionYear: "2030" }], advantages: [{ icon: "resources", title: "Energy Wealth", description: "25% of China's coal reserves. Transitioning to clean energy leader." }, { icon: "policy", title: "Transition Support", description: "Strong government support for green transformation." }], contactInfo: { investmentAgency: "Shanxi Provincial Department of Commerce", website: "http://swt.shanxi.gov.cn", email: "invest@shanxi.gov.cn" } },
  "Inner Mongolia": { name: "Inner Mongolia", nameRu: "Внутренняя Монголия", nameZh: "内蒙古", gdp: "$330 Billion", population: "24 Million", industries: ["Mining", "Energy", "Agriculture", "Rare Earths"], sezCount: 2, taxBenefits: ["Western Development incentives", "Energy base incentives", "Rare earth processing benefits"], majorCities: [{ id: "hohhot", name: "Hohhot", population: "3.5M" }, { id: "baotou", name: "Baotou", population: "2.7M" }, { id: "ordos", name: "Ordos", population: "2.2M" }], overview: "Vast northern region bordering Mongolia and Russia. Major rare earth producer (Baotou), coal and natural gas reserves, and wind/solar potential. Growing dairy industry (Yili, Mengniu).", targetSectors: ["Rare Earths", "Renewable Energy", "Mining", "Dairy & Agriculture", "Border Trade"], opportunities: [{ id: "im-1", title: "Baotou Rare Earth High-Tech Zone", titleZh: "包头稀土高新区", titleRu: "Высокотехнологичная зона редкоземельных металлов Баотоу", sector: "Materials", description: "Value-added rare earth processing for magnets, batteries, and electronics.", descriptionZh: "用于磁铁、电池和电子产品的稀土深加工。", descriptionRu: "Переработка редкоземельных элементов с добавленной стоимостью для магнитов, батарей и электроники.", investmentRange: "$20M - $300M", timeline: "2-4 years", status: "priority" }, { id: "im-2", title: "Inner Mongolia Wind & Solar Farms", titleZh: "内蒙古风光电场", titleRu: "Ветровые и солнечные электростанции Внутренней Монголии", sector: "Energy", description: "Massive renewable energy development. Some of world's best wind resources.", descriptionZh: "大规模可再生能源开发。世界上最好的风力资源之一。", descriptionRu: "Масштабное развитие возобновляемой энергетики. Одни из лучших ветровых ресурсов в мире.", investmentRange: "$50M - $1B", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "im-p1", name: "Ordos Renewable Energy Base", value: "$10 Billion", sector: "Energy", description: "Giant wind and solar installation with hydrogen production.", completionYear: "2030" }], advantages: [{ icon: "resources", title: "Rare Earth Capital", description: "90% of China's rare earth production. Critical for tech manufacturing." }, { icon: "location", title: "Russia-Mongolia Border", description: "Manzhouli crossing handles most China-Russia rail trade." }], contactInfo: { investmentAgency: "Inner Mongolia Department of Commerce", website: "http://swt.nmg.gov.cn", email: "invest@nmg.gov.cn" } },
  "Guizhou": { name: "Guizhou", nameRu: "Гуйчжоу", nameZh: "贵州", gdp: "$300 Billion", population: "38.5 Million", industries: ["Big Data", "Tourism", "Liquor", "Mining"], sezCount: 2, taxBenefits: ["Big Data industry incentives", "Western Development policy", "Poverty alleviation benefits"], majorCities: [{ id: "guiyang", name: "Guiyang", population: "6M" }, { id: "zunyi", name: "Zunyi", population: "6.6M" }, { id: "liupanshui", name: "Liupanshui", population: "2.9M" }], overview: "China's big data capital with major data centers (Apple, Huawei, Tencent). Cool mountain climate ideal for servers. Home to Moutai liquor and stunning karst landscapes.", targetSectors: ["Big Data & Cloud", "Tourism", "Liquor", "Pharmaceuticals", "Mining"], opportunities: [{ id: "gz-1", title: "Guiyang Big Data Valley", titleZh: "贵阳大数据谷", titleRu: "Долина больших данных Гуйяна", sector: "Tech", description: "Data center development with cheap electricity and cool climate. Apple, Huawei, Tencent already present.", descriptionZh: "廉价电力和凉爽气候下的数据中心发展。苹果、华为、腾讯已入驻。", descriptionRu: "Развитие дата-центров с дешёвым электричеством и прохладным климатом. Apple, Huawei, Tencent уже присутствуют.", investmentRange: "$20M - $500M", timeline: "2-4 years", status: "priority" }, { id: "gz-2", title: "Guizhou Eco-Tourism", titleZh: "贵州生态旅游", titleRu: "Экотуризм Гуйчжоу", sector: "Tourism", description: "Karst caves, waterfalls, and ethnic minority villages. Adventure and cultural tourism development.", descriptionZh: "喀斯特洞穴、瀑布和少数民族村寨。探险和文化旅游发展。", descriptionRu: "Карстовые пещеры, водопады и деревни этнических меньшинств. Развитие приключенческого и культурного туризма.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "gz-p1", name: "Huawei Cloud Guizhou Data Center", value: "$1 Billion", sector: "Cloud", description: "Major cloud infrastructure expansion.", partners: ["Huawei"], completionYear: "2027" }], advantages: [{ icon: "tech", title: "Big Data Hub", description: "China's first national big data pilot zone. Cool climate and cheap power for data centers." }, { icon: "resources", title: "Premium Liquor", description: "Moutai and other premium baijiu. China's liquor capital." }], contactInfo: { investmentAgency: "Guizhou Provincial Department of Commerce", website: "http://swt.guizhou.gov.cn", email: "invest@guizhou.gov.cn" } },
  "Xinjiang": { name: "Xinjiang", nameRu: "Синьцзян", nameZh: "新疆", gdp: "$260 Billion", population: "25.9 Million", industries: ["Oil & Gas", "Cotton", "Agriculture", "Mining"], sezCount: 3, taxBenefits: ["Western Development incentives", "Border trade benefits", "Resource extraction support"], majorCities: [{ id: "urumqi", name: "Urumqi", population: "4M" }, { id: "kashgar", name: "Kashgar", population: "0.7M" }, { id: "korla", name: "Korla", population: "0.6M" }], overview: "Vast western region bordering Central Asia and Russia. Major oil and gas reserves, cotton production, and Belt and Road gateway. Kashgar is ancient Silk Road trading post reviving as economic hub.", targetSectors: ["Oil & Gas", "Cotton & Textiles", "Central Asia Trade", "Mining", "Solar Energy"], opportunities: [{ id: "xj-1", title: "Xinjiang Central Asia Trade Zone", titleZh: "新疆中亚贸易区", titleRu: "Синьцзянская торговая зона Центральной Азии", sector: "Trade", description: "Border trade with Kazakhstan, Kyrgyzstan, and beyond. Logistics and processing zones.", descriptionZh: "与哈萨克斯坦、吉尔吉斯斯坦等国的边境贸易。物流和加工区。", descriptionRu: "Приграничная торговля с Казахстаном, Кыргызстаном и другими странами. Логистические и перерабатывающие зоны.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "active" }, { id: "xj-2", title: "Tarim Basin Energy Development", titleZh: "塔里木盆地能源开发", titleRu: "Развитие энергетики бассейна Тарим", sector: "Energy", description: "Oil and gas exploration and production partnerships.", descriptionZh: "石油和天然气勘探和生产合作。", descriptionRu: "Партнёрства по разведке и добыче нефти и газа.", investmentRange: "$100M - $1B", timeline: "5-10 years", status: "priority" }], keyProjects: [{ id: "xj-p1", name: "China-Pakistan Economic Corridor (Xinjiang Section)", value: "$5 Billion", sector: "Infrastructure", description: "Road, rail, and pipeline development through Kashgar.", completionYear: "2030" }], advantages: [{ icon: "location", title: "Central Asia Gateway", description: "Borders 8 countries. Key Belt and Road junction." }, { icon: "resources", title: "Energy Reserves", description: "Major oil, gas, and mineral deposits." }], contactInfo: { investmentAgency: "Xinjiang Department of Commerce", website: "http://swt.xinjiang.gov.cn", email: "invest@xinjiang.gov.cn" } },
  "Tianjin": { name: "Tianjin", nameRu: "Тяньцзинь", nameZh: "天津", gdp: "$250 Billion", population: "13.9 Million", industries: ["Petrochemicals", "Manufacturing", "Shipping", "Finance"], sezCount: 3, taxBenefits: ["Binhai New Area benefits", "FTZ pilot zone incentives", "Port and logistics support"], majorCities: [{ id: "binhai", name: "Binhai New Area", population: "3M" }, { id: "heping", name: "Heping District", population: "0.4M" }, { id: "hedong", name: "Hedong District", population: "0.8M" }], overview: "Major port city serving Beijing-Tianjin-Hebei megalopolis. Binhai New Area is a comprehensive FTZ with manufacturing, finance, and shipping. Strong aerospace (Airbus final assembly) and petrochemical sectors.", targetSectors: ["Aerospace", "Petrochemicals", "Shipping", "Fintech", "Advanced Manufacturing"], opportunities: [{ id: "tj-1", title: "Tianjin Aerospace Manufacturing", titleZh: "天津航空航天制造", titleRu: "Аэрокосмическое производство Тяньцзиня", sector: "Aerospace", description: "Airbus A320 final assembly line supply chain. Helicopter and drone manufacturing.", descriptionZh: "空客A320总装线供应链。直升机和无人机制造。", descriptionRu: "Цепочка поставок линии финальной сборки Airbus A320. Производство вертолётов и дронов.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" }, { id: "tj-2", title: "Tianjin Port Russia Trade Route", titleZh: "天津港俄罗斯贸易航线", titleRu: "Торговый маршрут порта Тяньцзинь в Россию", sector: "Logistics", description: "Direct shipping connections to Russian Arctic route. LNG receiving terminal.", descriptionZh: "与俄罗斯北极航线的直接航运连接。LNG接收终端。", descriptionRu: "Прямое судоходное сообщение с российским арктическим маршрутом. СПГ-приёмный терминал.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "tj-p1", name: "Airbus Tianjin Wide-body Completion Center", value: "$500 Million", sector: "Aerospace", description: "A350 completion and delivery center.", partners: ["Airbus"], completionYear: "2026" }], advantages: [{ icon: "logistics", title: "Northern Gateway", description: "Major port serving 130 million people in Beijing-Tianjin-Hebei region." }, { icon: "infrastructure", title: "Aerospace Hub", description: "Only Airbus final assembly outside Europe." }], contactInfo: { investmentAgency: "Tianjin Municipal Commission of Commerce", website: "http://www.investtianjin.gov.cn", email: "invest@tj.gov.cn" } },
  "Heilongjiang": { name: "Heilongjiang", nameRu: "Хэйлунцзян", nameZh: "黑龙江", gdp: "$220 Billion", population: "31.9 Million", industries: ["Agriculture", "Heavy Industry", "Energy", "Forestry"], sezCount: 2, taxBenefits: ["Northeast revitalization policy", "Russia border trade benefits", "Agricultural support"], majorCities: [{ id: "harbin", name: "Harbin", population: "9.5M", lat: 45.8038, lng: 126.5350, image: "https://images.unsplash.com/photo-1541959833400-049d37f98ccd?w=1920&q=80" }, { id: "daqing", name: "Daqing", population: "2.8M", lat: 46.5877, lng: 125.1032, image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80" }, { id: "qiqihar", name: "Qiqihar", population: "5.3M", lat: 47.3542, lng: 123.9179, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80" }], overview: "China's northernmost province with deepest Russia ties. Harbin has Russian architectural heritage and hosts annual Ice Festival. Major agricultural base (soybeans, rice) and oil producer (Daqing). Key for Russia-China trade.", targetSectors: ["Russia Trade", "Agriculture", "Energy", "Ice & Snow Tourism", "Forestry"], opportunities: [{ id: "hlj-1", title: "Harbin-Russia Trade & Logistics Hub", titleZh: "哈尔滨-俄罗斯贸易物流中心", titleRu: "Харбинско-российский торгово-логистический хаб", sector: "Trade", description: "Comprehensive trade zone for Russia imports. Direct rail to Vladivostok and Moscow. Cold chain logistics for Russian food.", descriptionZh: "俄罗斯进口综合贸易区。直达符拉迪沃斯托克和莫斯科的铁路。俄罗斯食品冷链物流。", descriptionRu: "Комплексная торговая зона для российского импорта. Прямое железнодорожное сообщение с Владивостоком и Москвой. Холодильная логистика для российских продуктов.", investmentRange: "$10M - $200M", timeline: "2-3 years", status: "priority" }, { id: "hlj-2", title: "Heilongjiang Agricultural Partnership", titleZh: "黑龙江农业合作", titleRu: "Сельскохозяйственное партнёрство Хэйлунцзян", sector: "Agriculture", description: "Soybean, rice, and dairy production. Technology partnerships with Russian Far East farmers.", descriptionZh: "大豆、大米和乳制品生产。与俄罗斯远东农民的技术合作。", descriptionRu: "Производство сои, риса и молочной продукции. Технологическое партнёрство с фермерами российского Дальнего Востока.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "active" }, { id: "hlj-3", title: "Harbin Ice & Snow Tourism", titleZh: "哈尔滨冰雪旅游", titleRu: "Ледовый и снежный туризм Харбина", sector: "Tourism", description: "Year-round ice tourism infrastructure, ski resorts, and winter sports facilities.", descriptionZh: "全年冰雪旅游基础设施、滑雪度假村和冬季运动设施。", descriptionRu: "Круглогодичная инфраструктура ледового туризма, горнолыжные курорты и зимние спортивные объекты.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "hlj-p1", name: "Suifenhe Russia Trade Processing Zone", value: "$500 Million", sector: "Trade", description: "Border city processing zone for Russia-origin goods.", completionYear: "2027" }, { id: "hlj-p2", name: "Harbin Ice & Snow World Expansion", value: "$200 Million", sector: "Tourism", description: "Permanent ice sculpture park and resort.", completionYear: "2026" }], advantages: [{ icon: "location", title: "Russia Border", description: "3,000km border with Russia. Multiple crossing points." }, { icon: "resources", title: "Agricultural Powerhouse", description: "China's largest soybean and rice producer. Black soil breadbasket." }, { icon: "infrastructure", title: "Russia Heritage", description: "Harbin has century of Russian connections. Cultural and business ties." }], contactInfo: { investmentAgency: "Heilongjiang Provincial Department of Commerce", website: "http://swt.hlj.gov.cn", email: "invest@hlj.gov.cn", phone: "+86-451-82628177" } },
  "Jilin": { name: "Jilin", nameRu: "Цзилинь", nameZh: "吉林", gdp: "$190 Billion", population: "24 Million", industries: ["Automotive", "Petrochemicals", "Food Processing", "Agriculture"], sezCount: 2, taxBenefits: ["Northeast revitalization incentives", "Automotive industry support", "Agricultural processing benefits"], majorCities: [{ id: "changchun", name: "Changchun", population: "9.1M" }, { id: "jilin-city", name: "Jilin City", population: "4M" }, { id: "siping", name: "Siping", population: "1.8M" }], overview: "China's auto capital - Changchun hosts FAW (First Auto Works). Strong corn and soybean production. Winter sports development for Beijing-Changchun corridor. Border access to Russia and North Korea.", targetSectors: ["Automotive", "Food Processing", "Winter Sports", "Pharmaceuticals", "Russia Trade"], opportunities: [{ id: "jl-1", title: "FAW-Volkswagen Supply Chain", titleZh: "一汽-大众供应链", titleRu: "Цепочка поставок FAW-Volkswagen", sector: "Automotive", description: "Tier 1/2 supplier opportunities for China's oldest automaker. EV transition creating new opportunities.", descriptionZh: "为中国最老汽车制造商提供一/二级供应商机会。电动汽车转型创造新机会。", descriptionRu: "Возможности для поставщиков 1/2 уровня для старейшего китайского автопроизводителя. Переход на электромобили создаёт новые возможности.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" }, { id: "jl-2", title: "Jilin Winter Sports Development", titleZh: "吉林冬季运动发展", titleRu: "Развитие зимних видов спорта Цзилинь", sector: "Sports", description: "Ski resorts and winter training facilities. 2022 Olympics legacy development.", descriptionZh: "滑雪度假村和冬季训练设施。2022年冬奥会遗产发展。", descriptionRu: "Горнолыжные курорты и зимние тренировочные объекты. Развитие наследия Олимпиады 2022.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "jl-p1", name: "FAW EV Manufacturing Base", value: "$3 Billion", sector: "Automotive", description: "Electric vehicle production expansion.", partners: ["FAW Group"], completionYear: "2027" }], advantages: [{ icon: "infrastructure", title: "Auto Capital", description: "FAW headquarters. Complete automotive supply chain." }, { icon: "resources", title: "Agricultural Base", description: "Major corn producer with strong food processing." }], contactInfo: { investmentAgency: "Jilin Provincial Department of Commerce", website: "http://swt.jl.gov.cn", email: "invest@jilin.gov.cn" } },
  "Gansu": { name: "Gansu", nameRu: "Ганьсу", nameZh: "甘肃", gdp: "$160 Billion", population: "25 Million", industries: ["Petrochemicals", "Mining", "New Energy", "Agriculture"], sezCount: 1, taxBenefits: ["Western Development incentives", "New energy support", "Silk Road benefits"], majorCities: [{ id: "lanzhou", name: "Lanzhou", population: "4.4M" }, { id: "tianshui", name: "Tianshui", population: "2.9M" }, { id: "jiayuguan", name: "Jiayuguan", population: "0.3M" }], overview: "Historic Silk Road corridor with massive renewable energy potential. Dunhuang caves are UNESCO heritage. Wind and solar resources among world's best. Petrochemical hub with Lanzhou refineries.", targetSectors: ["Renewable Energy", "Tourism", "Petrochemicals", "New Materials", "Data Centers"], opportunities: [{ id: "gs-1", title: "Gansu Wind & Solar Corridor", titleZh: "甘肃风光走廊", titleRu: "Ветро-солнечный коридор Ганьсу", sector: "Energy", description: "World-class wind and solar resources in Hexi Corridor. Grid-connected and off-grid projects.", descriptionZh: "河西走廊世界级风能和太阳能资源。并网和离网项目。", descriptionRu: "Мировые ветровые и солнечные ресурсы в коридоре Хэси. Сетевые и автономные проекты.", investmentRange: "$50M - $1B", timeline: "3-5 years", status: "priority" }, { id: "gs-2", title: "Silk Road Cultural Tourism", titleZh: "丝绸之路文化旅游", titleRu: "Культурный туризм Шёлкового пути", sector: "Tourism", description: "Dunhuang Mogao Caves, Great Wall terminus, and desert experiences.", descriptionZh: "敦煌莫高窟、长城终点和沙漠体验。", descriptionRu: "Пещеры Могао в Дуньхуане, окончание Великой стены и пустынные впечатления.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "gs-p1", name: "Jiuquan Wind Power Base", value: "$15 Billion", sector: "Energy", description: "10GW wind farm - one of world's largest.", completionYear: "2028" }], advantages: [{ icon: "resources", title: "Renewable Paradise", description: "Exceptional wind and solar resources. Cheap land and power." }, { icon: "location", title: "Silk Road Heritage", description: "Historic trade route with tourism and trade potential." }], contactInfo: { investmentAgency: "Gansu Provincial Department of Commerce", website: "http://swt.gansu.gov.cn", email: "invest@gansu.gov.cn" } },
  "Hainan": { name: "Hainan", nameRu: "Хайнань", nameZh: "海南", gdp: "$100 Billion", population: "10.1 Million", industries: ["Tourism", "Tropical Agriculture", "Free Trade Port", "Marine Industry"], sezCount: 1, taxBenefits: ["Free Trade Port zero tariff", "15% CIT cap", "Personal income tax cap 15%"], majorCities: [{ id: "haikou", name: "Haikou", population: "2.9M", lat: 20.0440, lng: 110.1999, image: "https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=1920&q=80" }, { id: "sanya", name: "Sanya", population: "1M", lat: 18.2524, lng: 109.5119, image: "https://images.unsplash.com/photo-1600077106724-946750eeaf3c?w=1920&q=80" }, { id: "danzhou", name: "Danzhou", population: "0.9M", lat: 19.5175, lng: 109.5801, image: "https://images.unsplash.com/photo-1559304787-e5db6d82acb1?w=1920&q=80" }], overview: "China's Hawaii and newest Free Trade Port with most favorable policies nationwide. Zero tariffs, 15% income tax cap, and relaxed foreign investment rules. Tropical tourism, duty-free shopping, and emerging tech hub.", targetSectors: ["Tourism", "Duty-Free Retail", "Healthcare Tourism", "Tropical Agriculture", "Marine Industry"], opportunities: [{ id: "hai-1", title: "Hainan Free Trade Port Investment", titleZh: "海南自由贸易港投资", titleRu: "Инвестиции в свободный порт Хайнань", sector: "Trade", description: "Zero tariffs, 15% corporate tax, relaxed forex. China's most open zone for foreign investment.", descriptionZh: "零关税、15%企业所得税、外汇管制放松。中国对外商投资最开放的区域。", descriptionRu: "Нулевые пошлины, 15% налог на прибыль, смягчённый валютный контроль. Самая открытая зона Китая для иностранных инвестиций.", investmentRange: "$5M - $500M", timeline: "1-3 years", status: "priority" }, { id: "hai-2", title: "Sanya Medical Tourism", titleZh: "三亚医疗旅游", titleRu: "Медицинский туризм Саньи", sector: "Healthcare", description: "International hospitals and medical tourism. Boao Lecheng allows imported drugs and devices.", descriptionZh: "国际医院和医疗旅游。博鳌乐城允许进口药品和医疗器械。", descriptionRu: "Международные больницы и медицинский туризм. Боао Лэчэн разрешает импортные лекарства и устройства.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }, { id: "hai-3", title: "Hainan Duty-Free Expansion", titleZh: "海南免税购物扩张", titleRu: "Расширение беспошлинной торговли Хайнаня", sector: "Retail", description: "Offshore duty-free shopping. $100,000/person annual allowance.", descriptionZh: "离岛免税购物。每人每年10万美元额度。", descriptionRu: "Оффшорный беспошлинный шоппинг. $100,000 на человека в год.", investmentRange: "$10M - $200M", timeline: "1-2 years", status: "active" }], keyProjects: [{ id: "hai-p1", name: "Hainan International Medical Tourism Pilot", value: "$1 Billion", sector: "Healthcare", description: "Advanced medical treatments and clinical trials zone.", completionYear: "2027" }, { id: "hai-p2", name: "Sanya Yazhou Bay Science City", value: "$3 Billion", sector: "Technology", description: "Deep-sea, space, and tropical agriculture research.", completionYear: "2030" }], advantages: [{ icon: "policy", title: "Free Trade Port", description: "China's most open zone. Zero tariffs, 15% tax cap, relaxed investment rules." }, { icon: "market", title: "Tourism Magnet", description: "Tropical paradise attracting 80 million tourists annually." }, { icon: "infrastructure", title: "World-Class Facilities", description: "International airports, cruise terminals, and resort infrastructure." }], contactInfo: { investmentAgency: "Hainan Provincial Bureau of International Economic Development", website: "http://dofcom.hainan.gov.cn", email: "invest@hainan.gov.cn", phone: "+86-898-65342377" } },
  "Ningxia": { name: "Ningxia", nameRu: "Нинся", nameZh: "宁夏", gdp: "$70 Billion", population: "7.3 Million", industries: ["Energy", "Coal Chemicals", "Wine", "Halal Food"], sezCount: 1, taxBenefits: ["Western Development incentives", "Energy industry support", "Halal certification benefits"], majorCities: [{ id: "yinchuan", name: "Yinchuan", population: "2.9M" }, { id: "shizuishan", name: "Shizuishan", population: "0.7M" }, { id: "wuzhong", name: "Wuzhong", population: "1.1M" }], overview: "Small but strategic region for China-Arab cooperation. Halal food certification hub. Emerging wine region rivaling France. Solar energy potential and coal chemical industry.", targetSectors: ["Halal Food", "Wine", "Solar Energy", "Arab Trade", "Coal Chemicals"], opportunities: [{ id: "nx-1", title: "Ningxia Wine Industry", titleZh: "宁夏葡萄酒产业", titleRu: "Винодельческая отрасль Нинся", sector: "Agriculture", description: "Premium wine region with international awards. Winery investment and export opportunities.", descriptionZh: "获得国际奖项的优质葡萄酒产区。酒庄投资和出口机会。", descriptionRu: "Премиальный винодельческий регион с международными наградами. Возможности инвестиций в винодельни и экспорта.", investmentRange: "$5M - $50M", timeline: "3-5 years", status: "active" }, { id: "nx-2", title: "China-Arab Halal Food Hub", titleZh: "中阿清真食品中心", titleRu: "Китайско-арабский хаб халяльной еды", sector: "Food", description: "Halal certification and export platform for Arab world.", descriptionZh: "面向阿拉伯世界的清真认证和出口平台。", descriptionRu: "Платформа халяльной сертификации и экспорта в арабский мир.", investmentRange: "$3M - $30M", timeline: "2-3 years", status: "active" }], keyProjects: [{ id: "nx-p1", name: "China-Arab States Expo Permanent Platform", value: "$300 Million", sector: "Trade", description: "Trade infrastructure for Arab partnership.", completionYear: "2027" }], advantages: [{ icon: "policy", title: "Arab Gateway", description: "China-Arab States Expo host. Halal certification hub." }, { icon: "resources", title: "Wine Region", description: "Eastern foothills of Helan Mountain produce award-winning wines." }], contactInfo: { investmentAgency: "Ningxia Department of Commerce", website: "http://swt.nx.gov.cn", email: "invest@ningxia.gov.cn" } },
  "Qinghai": { name: "Qinghai", nameRu: "Цинхай", nameZh: "青海", gdp: "$55 Billion", population: "5.9 Million", industries: ["Mining", "New Energy", "Salt Lake Resources", "Tourism"], sezCount: 1, taxBenefits: ["Western Development incentives", "New energy support", "Ecological protection benefits"], majorCities: [{ id: "xining", name: "Xining", population: "2.5M" }, { id: "haidong", name: "Haidong", population: "1.4M" }, { id: "golmud", name: "Golmud", population: "0.2M" }], overview: "Tibetan Plateau province with vast lithium resources in salt lakes. Critical for battery manufacturing supply chain. Stunning high-altitude landscapes and wildlife. Solar energy potential.", targetSectors: ["Lithium & Battery Materials", "Solar Energy", "Eco-Tourism", "Salt Lake Resources", "Mining"], opportunities: [{ id: "qh-1", title: "Qinghai Lithium Triangle", titleZh: "青海锂三角", titleRu: "Литиевый треугольник Цинхай", sector: "Materials", description: "World's largest lithium reserves in salt lakes. Battery material processing and extraction.", descriptionZh: "世界上最大的盐湖锂资源。电池材料加工和提取。", descriptionRu: "Крупнейшие в мире запасы лития в солёных озёрах. Переработка и добыча материалов для батарей.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" }, { id: "qh-2", title: "Qinghai High-Altitude Tourism", titleZh: "青海高原旅游", titleRu: "Высокогорный туризм Цинхай", sector: "Tourism", description: "Qinghai Lake, Tibetan culture, and wildlife experiences.", descriptionZh: "青海湖、藏族文化和野生动物体验。", descriptionRu: "Озеро Цинхай, тибетская культура и наблюдение за дикой природой.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }], keyProjects: [{ id: "qh-p1", name: "BYD Qinghai Lithium Processing", value: "$2 Billion", sector: "Materials", description: "Lithium extraction and battery material production.", partners: ["BYD"], completionYear: "2027" }], advantages: [{ icon: "resources", title: "Lithium Capital", description: "Largest lithium reserves. Critical for EV battery supply chain." }, { icon: "policy", title: "Ecological Zone", description: "Clean energy incentives and environmental protection focus." }], contactInfo: { investmentAgency: "Qinghai Provincial Department of Commerce", website: "http://swt.qinghai.gov.cn", email: "invest@qinghai.gov.cn" } },
  "Tibet": { name: "Tibet", nameRu: "Тибет", nameZh: "西藏", gdp: "$30 Billion", population: "3.6 Million", industries: ["Tourism", "Mining", "Agriculture", "Traditional Crafts"], sezCount: 0, taxBenefits: ["Western Development incentives", "Poverty alleviation support", "Infrastructure investment benefits"], majorCities: [{ id: "lhasa", name: "Lhasa", population: "0.9M" }, { id: "shigatse", name: "Shigatse", population: "0.8M" }, { id: "chamdo", name: "Chamdo", population: "0.7M" }], overview: "Roof of the World with unique Buddhist culture and stunning Himalayan landscapes. Limited industrial development but growing tourism and clean energy sectors. Strategic location bordering India and Nepal.", targetSectors: ["Tourism", "Clean Energy", "Traditional Crafts", "Highland Agriculture", "Mining"], opportunities: [{ id: "tb-1", title: "Tibet Luxury Tourism", titleZh: "西藏高端旅游", titleRu: "Элитный туризм Тибета", sector: "Tourism", description: "High-end cultural and adventure tourism. Limited but premium market.", descriptionZh: "高端文化和探险旅游。有限但高端的市场。", descriptionRu: "Элитный культурный и приключенческий туризм. Ограниченный, но премиальный рынок.", investmentRange: "$5M - $50M", timeline: "3-5 years", status: "active" }, { id: "tb-2", title: "Tibet Solar & Hydropower", titleZh: "西藏太阳能和水电", titleRu: "Солнечная и гидроэнергетика Тибета", sector: "Energy", description: "Exceptional solar radiation and hydropower potential.", descriptionZh: "优越的太阳辐射和水电潜力。", descriptionRu: "Исключительная солнечная радиация и гидроэнергетический потенциал.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }], keyProjects: [{ id: "tb-p1", name: "Lhasa-Nyingchi Railway Extension", value: "$5 Billion", sector: "Infrastructure", description: "Railway expansion opening new tourism areas.", completionYear: "2030" }], advantages: [{ icon: "location", title: "Unique Destination", description: "Unmatched cultural and natural heritage. Premium tourism market." }, { icon: "resources", title: "Clean Energy", description: "Exceptional solar and hydro resources." }], contactInfo: { investmentAgency: "Tibet Department of Commerce", website: "http://www.xizang.gov.cn", email: "invest@tibet.gov.cn" } },
  "Hong Kong": { name: "Hong Kong SAR", nameRu: "Гонконг", nameZh: "香港", gdp: "$360 Billion", population: "7.5 Million", industries: ["Finance", "Trade", "Professional Services", "Tourism"], sezCount: 0, taxBenefits: ["16.5% corporate tax", "No VAT/sales tax", "Free port status"], majorCities: [{ id: "central", name: "Central", population: "0.1M", lat: 22.2819, lng: 114.1580, image: "https://images.unsplash.com/photo-1536599424071-0b215a388ba7?w=1920&q=80" }, { id: "kowloon", name: "Kowloon", population: "2.3M", lat: 22.3193, lng: 114.1694, image: "https://images.unsplash.com/photo-1524236246106-c8c1e2e5cff4?w=1920&q=80" }, { id: "new-territories", name: "New Territories", population: "4M", lat: 22.4530, lng: 114.1650, image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1920&q=80" }], overview: "Global financial center and gateway between China and the world. Common law system, free capital flows, and world-class professional services. Strategic platform for Russia-China investment and trade structuring.", targetSectors: ["Finance", "Professional Services", "Trade", "Technology", "Asset Management"], opportunities: [{ id: "hk-1", title: "Hong Kong Russia-China Finance Platform", titleZh: "香港中俄金融平台", titleRu: "Гонконгская финансовая платформа Россия-Китай", sector: "Finance", description: "Structure cross-border investments, trade finance, and RMB settlement through Hong Kong.", descriptionZh: "通过香港构建跨境投资、贸易融资和人民币结算。", descriptionRu: "Структурирование трансграничных инвестиций, торгового финансирования и расчётов в юанях через Гонконг.", investmentRange: "$10M - $500M", timeline: "6-12 months", status: "active" }, { id: "hk-2", title: "Hong Kong Family Office Hub", titleZh: "香港家族办公室中心", titleRu: "Гонконгский хаб семейных офисов", sector: "Wealth Management", description: "Establish family offices with access to Greater China investments.", descriptionZh: "设立可进入大中华区投资的家族办公室。", descriptionRu: "Создание семейных офисов с доступом к инвестициям в Большой Китай.", investmentRange: "$50M - $1B", timeline: "3-6 months", status: "active" }], keyProjects: [{ id: "hk-p1", name: "Northern Metropolis Development", value: "$100 Billion", sector: "Urban Development", description: "New economic hub connecting to Shenzhen.", completionYear: "2035" }], advantages: [{ icon: "policy", title: "One Country Two Systems", description: "Common law, free press, independent judiciary until 2047." }, { icon: "market", title: "Global Finance Hub", description: "Top 3 financial center. Gateway for China investment." }], contactInfo: { investmentAgency: "InvestHK", website: "http://www.investhk.gov.hk", email: "enq@investhk.gov.hk", phone: "+852-3107-1000" } },
  "Macau": { name: "Macau SAR", nameRu: "Макао", nameZh: "澳门", gdp: "$30 Billion", population: "0.7 Million", industries: ["Gaming", "Tourism", "Finance", "MICE"], sezCount: 0, taxBenefits: ["12% corporate tax max", "No foreign exchange controls", "Gaming license benefits"], majorCities: [{ id: "macau-peninsula", name: "Macau Peninsula", population: "0.5M", lat: 22.1932, lng: 113.5415, image: "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=1920&q=80" }, { id: "taipa", name: "Taipa", population: "0.1M", lat: 22.1560, lng: 113.5577, image: "https://images.unsplash.com/photo-1563436233770-eeca7a64cfcd?w=1920&q=80" }, { id: "cotai", name: "Cotai", population: "0.05M", lat: 22.1438, lng: 113.5581, image: "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=1920&q=80" }], overview: "World's largest gaming center and Portuguese-Chinese cultural fusion. Transitioning to diversified tourism and MICE destination. Hengqin cooperation zone expanding opportunities.", targetSectors: ["Tourism", "MICE", "Finance", "Portuguese-speaking Countries Trade", "Healthcare"], opportunities: [{ id: "mo-1", title: "Macau-Hengqin Cooperation Zone", titleZh: "澳门-横琴合作区", titleRu: "Зона сотрудничества Макао-Хэнцинь", sector: "Services", description: "New zone quadrupling Macau's development space. Modern industries and Portuguese trade platform.", descriptionZh: "新区域使澳门发展空间扩大四倍。现代产业和葡语国家贸易平台。", descriptionRu: "Новая зона, увеличивающая пространство развития Макао в 4 раза. Современные отрасли и платформа торговли с португалоязычными странами.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" }, { id: "mo-2", title: "Macau MICE & Events", titleZh: "澳门会展活动", titleRu: "MICE и мероприятия Макао", sector: "Tourism", description: "Convention, exhibition, and entertainment infrastructure.", descriptionZh: "会议、展览和娱乐基础设施。", descriptionRu: "Конгрессная, выставочная и развлекательная инфраструктура.", investmentRange: "$5M - $100M", timeline: "1-3 years", status: "active" }], keyProjects: [{ id: "mo-p1", name: "Hengqin Guangdong-Macao Deep Cooperation Zone", value: "$10 Billion", sector: "Development", description: "106 sq km new development zone.", completionYear: "2029" }], advantages: [{ icon: "policy", title: "Gaming Hub", description: "World's largest casino market. Premium tourism infrastructure." }, { icon: "location", title: "Portuguese Gateway", description: "Platform for trade with Portuguese-speaking countries." }], contactInfo: { investmentAgency: "Macau Trade and Investment Promotion Institute", website: "http://www.ipim.gov.mo", email: "ipim@ipim.gov.mo", phone: "+853-2871-0300" } },
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
      { id: "central-ao", name: "Central Administrative Okrug", population: "0.8M", lat: 55.7539, lng: 37.6208, image: "https://images.unsplash.com/photo-1513326738677-b964603b136d?w=1920&q=80", description: "The heart of Moscow with Red Square, the Kremlin, and Tverskaya Street. Russia's political and business epicenter with the highest concentration of headquarters and luxury retail.", opportunities: [
        { id: "msc-c-1", title: "Tverskaya Premium Retail", titleZh: "特维尔大街高端零售", titleRu: "Премиальный ритейл на Тверской", sector: "Retail", description: "Flagship stores on Russia's most prestigious shopping street. Chinese luxury brands entering Russian market.", descriptionZh: "在俄罗斯最负盛名的购物街开设旗舰店。中国奢侈品牌进入俄罗斯市场。", descriptionRu: "Флагманские магазины на самой престижной торговой улице России. Китайские люксовые бренды, выходящие на российский рынок.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" },
        { id: "msc-c-2", title: "Moscow City Business Center", titleZh: "莫斯科城商务中心", titleRu: "Деловой центр Москва-Сити", sector: "Real Estate", description: "Grade A office space in Russia's Manhattan. Chinese company regional headquarters.", descriptionZh: "俄罗斯曼哈顿的甲级写字楼。中国公司区域总部。", descriptionRu: "Офисы класса А в российском Манхэттене. Региональные штаб-квартиры китайских компаний.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "northern-ao", name: "Northern Administrative Okrug", population: "1.2M", image: "https://images.unsplash.com/photo-1520106212299-d99c443e4568?w=1920&q=80", description: "Major industrial and residential district with Sheremetyevo Airport connection. Home to tech parks and manufacturing zones near key transportation infrastructure.", opportunities: [
        { id: "msc-n-1", title: "Sheremetyevo Logistics Zone", titleZh: "谢列梅捷沃物流区", titleRu: "Логистическая зона Шереметьево", sector: "Logistics", description: "Air cargo and distribution facilities near Russia's largest airport. E-commerce fulfillment center.", descriptionZh: "靠近俄罗斯最大机场的航空货运和配送设施。电商履约中心。", descriptionRu: "Объекты авиагрузов и дистрибуции рядом с крупнейшим аэропортом России. Фулфилмент-центр электронной коммерции.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" }
      ]},
      { id: "southern-ao", name: "Southern Administrative Okrug", population: "1.8M", image: "https://images.unsplash.com/photo-1547448415-e9f5b28e570d?w=1920&q=80", description: "Growing residential and commercial district with major industrial heritage. Home to technology parks and research institutes.", opportunities: [
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
      { id: "msk-p1", name: "Moscow-Beijing High-Speed Rail Planning", value: "$242 Billion", sector: "Infrastructure", description: "Planning phase for 7,000km HSR connection. Feasibility studies and route planning.", partners: ["Russian Railways", "China Railway"], completionYear: "2035" },
      { id: "msk-p2", name: "Yandex-Alibaba E-commerce Platform", value: "$1 Billion", sector: "E-commerce", description: "Joint venture for cross-border e-commerce between Russia and China.", partners: ["Yandex", "Alibaba"], completionYear: "Ongoing" }
    ],
    advantages: [
      { icon: "market", title: "Economic Hub", description: "25% of Russia's GDP. Headquarters of major corporations and banks." },
      { icon: "talent", title: "Talent Pool", description: "250+ universities, 1 million+ students. Strong IT and engineering talent." },
      { icon: "infrastructure", title: "Global Connectivity", description: "3 international airports, high-speed rail hub. Direct flights to all Chinese cities." },
      { icon: "policy", title: "Administrative Center", description: "All federal ministries and regulatory bodies. Fastest approvals." }
    ],
    notableEntrepreneurs: [
      { name: "Vladimir Potanin", nameRu: "Владимир Потанин", nameZh: "弗拉基米尔·波塔宁", company: "Norilsk Nickel", industry: "Mining & Metals", netWorth: "$30.4B", description: "President of Nornickel, world's largest producer of nickel and palladium. Russia's richest person." },
      { name: "Leonid Mikhelson", nameRu: "Леонид Михельсон", nameZh: "列昂尼德·米赫尔松", company: "Novatek", industry: "Natural Gas", netWorth: "$27.4B", description: "CEO of Novatek, Russia's largest independent gas producer. Leading Arctic LNG development." },
      { name: "Pavel Durov", nameRu: "Павел Дуров", nameZh: "帕维尔·杜罗夫", company: "Telegram", industry: "Technology", netWorth: "$15.5B", description: "Founder of Telegram and VKontakte. Russia's most famous tech entrepreneur, now based in Dubai." },
      { name: "Arkady Volozh", nameRu: "Аркадий Волож", nameZh: "阿尔卡季·沃洛日", company: "Yandex", industry: "Technology", netWorth: "$5.7B", description: "Co-founder of Yandex, Russia's largest search engine and tech company. Pioneer of Russian internet." }
    ],
    contactInfo: { investmentAgency: "Moscow City Investment Agency", website: "https://investmoscow.ru", email: "info@investmoscow.ru", phone: "+7-495-620-2045" }
  },
  "Saint Petersburg": {
    name: "Saint Petersburg",
    nameRu: "Санкт-Петербург",
    nameZh: "圣彼得堡",
    gdp: "$163 Billion",
    population: "5.4 Million",
    industries: ["Shipbuilding", "Automotive", "IT", "Tourism"],
    sezCount: 2,
    taxBenefits: ["SEZ benefits", "IT park incentives", "Cultural industry support"],
    majorCities: [
      { id: "admiralteysky", name: "Admiralteysky District", population: "0.16M", lat: 59.9311, lng: 30.3150, image: "https://images.unsplash.com/photo-1556610961-2fecc5927173?w=1920&q=80", description: "Historic heart of St. Petersburg with the Admiralty, St. Isaac's Cathedral, and the Hermitage. Russia's cultural capital and UNESCO World Heritage site.", opportunities: [
{ id: "spb-a-1", title: "Heritage Tourism Development", titleZh: "遗产旅游开发", titleRu: "Развитие наследия туризма", sector: "Tourism", description: "Boutique hotels and cultural tourism near Hermitage and Palace Square. Growing Chinese tourist segment.", descriptionZh: "靠近冬宫和宫殿广场的精品酒店和文化旅游。中国游客群体不断增长。", descriptionRu: "Бутик-отели и культурный туризм рядом с Эрмитажем и Дворцовой площадью. Растущий сегмент китайских туристов.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
         { id: "spb-a-2", title: "Luxury Hospitality", titleZh: "豪华酒店业", titleRu: "Люксовое гостеприимство", sector: "Hospitality", description: "5-star hotels and restaurants catering to high-end Chinese tourists. WeChat/Alipay integration.", descriptionZh: "面向高端中国游客的五星级酒店和餐厅。微信/支付宝集成。", descriptionRu: "5-звёздочные отели и рестораны для состоятельных китайских туристов. Интеграция WeChat/Alipay.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "vasileostrovsky", name: "Vasileostrovsky Island", population: "0.21M", image: "https://images.unsplash.com/photo-1548834925-e48f8a27ae1f?w=1920&q=80", description: "Historic island district with the Rostral Columns, universities, and emerging tech scene. Major port facilities and the new Lakhta Center (Gazprom HQ).", opportunities: [
{ id: "spb-v-1", title: "Baltic Port Development", titleZh: "波罗的海港口开发", titleRu: "Развитие Балтийского порта", sector: "Logistics", description: "Container terminal and logistics facilities. Direct shipping connections to China.", descriptionZh: "集装箱码头和物流设施。与中国的直达海运连接。", descriptionRu: "Контейнерный терминал и логистические объекты. Прямые морские маршруты в Китай.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
         { id: "spb-v-2", title: "St. Petersburg IT Cluster", titleZh: "圣彼得堡IT集群", titleRu: "IT-кластер Санкт-Петербурга", sector: "IT", description: "Software development and gaming studios. JetBrains and Vkontakte ecosystem.", descriptionZh: "软件开发和游戏工作室。JetBrains和VKontakte生态系统。", descriptionRu: "Разработка ПО и игровые студии. Экосистема JetBrains и ВКонтакте.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "petrogradsky", name: "Petrogradsky District", population: "0.13M", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=80", description: "Historic district with the Peter and Paul Fortress and growing residential development. Mix of heritage sites and modern apartments.", opportunities: [
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
      { id: "spb-p1", name: "Lakhta Center Phase 2", value: "$2 Billion", sector: "Real Estate", description: "Gazprom headquarters expansion. Commercial and residential development.", partners: ["Gazprom"], completionYear: "2028" },
      { id: "spb-p2", name: "Pulkovo Airport Expansion", value: "$1 Billion", sector: "Aviation", description: "Terminal expansion for increased China traffic.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Baltic Port", description: "Major port connecting to Europe. Icebreaker support for year-round operations." },
      { icon: "talent", title: "IT Excellence", description: "Strong software engineering tradition. JetBrains, Vkontakte headquarters." },
      { icon: "infrastructure", title: "Tourism Hub", description: "UNESCO World Heritage city. Hermitage, Mariinsky Theatre." },
      { icon: "policy", title: "SPIEF Host", description: "Annual St. Petersburg International Economic Forum - key China-Russia business platform." }
    ],
    notableEntrepreneurs: [
      { name: "Yuri Milner", nameRu: "Юрий Мильнер", nameZh: "尤里·米尔纳", company: "DST Global", industry: "Venture Capital", netWorth: "$7.3B", description: "Co-founder of DST Global, early investor in Facebook, Twitter, and Alibaba. Pioneer of Russian tech investing globally." },
      { name: "Pavel Durov", nameRu: "Павел Дуров", nameZh: "帕维尔·杜罗夫", company: "Telegram", industry: "Technology", netWorth: "$15.5B", description: "Founder of VKontakte and Telegram. Born and studied in St. Petersburg. Russia's most influential tech entrepreneur." },
      { name: "Maxim Galkin", nameRu: "Максим Галкин", nameZh: "马克西姆·加尔金", company: "JetBrains", industry: "Software", netWorth: "$1.8B", description: "Co-founder of JetBrains, maker of IntelliJ IDEA and Kotlin programming language. St. Petersburg-based software tools company." },
      { name: "Sergey Galitsky", nameRu: "Сергей Галицкий", nameZh: "谢尔盖·加利茨基", company: "Magnit", industry: "Retail", netWorth: "$3.2B", description: "Founder of Magnit retail chain. One of Russia's most successful self-made entrepreneurs. Major philanthropist." }
    ],
    contactInfo: { investmentAgency: "St. Petersburg Investment Agency", website: "https://spbia.ru", email: "info@spbia.ru", phone: "+7-812-576-7500" }
  },
  "Moscow Oblast": {
    name: "Moscow Oblast",
    nameRu: "Московская область",
    nameZh: "莫斯科州",
    gdp: "$113 Billion",
    population: "8.5 Million",
    industries: ["Manufacturing", "Logistics", "Food Processing", "Chemicals"],
    sezCount: 3,
    taxBenefits: ["Industrial park benefits", "Logistics hub incentives", "Manufacturing support"],
    majorCities: [
      { id: "krasnogorsk", name: "Krasnogorsk", population: "0.2M", image: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=1920&q=80", description: "Modern satellite city northwest of Moscow. Major business center with Crocus City complex and growing tech presence.", opportunities: [
        { id: "krs-1", title: "Crocus City Expansion", sector: "Real Estate", description: "Exhibition, retail, and office development in Russia's largest expo complex.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "balashikha", name: "Balashikha", population: "0.5M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Largest satellite city of Moscow with strong manufacturing and logistics base. Excellent highway access to Moscow center.", opportunities: [
        { id: "bal-1", title: "Moscow East Logistics Hub", sector: "Logistics", description: "Warehousing and distribution for eastern approaches to Moscow. E-commerce fulfillment.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "priority" }
      ]},
      { id: "khimki", name: "Khimki", population: "0.3M", image: "https://images.unsplash.com/photo-1558618047-f4b4c45d7b42?w=1920&q=80", description: "Northern satellite city home to Sheremetyevo Airport and major shopping centers. Key logistics and retail hub.", opportunities: [
        { id: "khm-1", title: "Airport City Development", sector: "Real Estate", description: "Hotels, offices, and retail near Sheremetyevo. Transit-oriented development.", investmentRange: "$25M - $180M", timeline: "3-5 years", status: "active" },
        { id: "khm-2", title: "Mega Shopping Center", sector: "Retail", description: "Partnership with IKEA centers and retail development.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Region surrounding Moscow with massive logistics and manufacturing infrastructure. Home to major industrial parks, warehouses, and food processing facilities serving the 20+ million Moscow metropolitan area.",
    targetSectors: ["Logistics", "Food Processing", "Manufacturing", "Data Centers", "Retail"],
    opportunities: [
      { id: "mo-1", title: "Moscow Region Logistics Hub", sector: "Logistics", description: "Warehouse and distribution centers for Chinese goods entering Russia. E-commerce fulfillment.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
      { id: "mo-2", title: "Food Processing Cluster", sector: "Food", description: "Processing facilities for Chinese food products and Russian agricultural exports.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "mo-p1", name: "Sheremetyevo Cargo Expansion", value: "$500 Million", sector: "Logistics", description: "Air cargo terminal expansion for China trade.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "logistics", title: "Moscow Gateway", description: "Surrounds Moscow with excellent highway and rail access." },
      { icon: "market", title: "Massive Market", description: "Direct access to 20+ million Moscow metro consumers." }
    ],
    contactInfo: { investmentAgency: "Moscow Oblast Investment Agency", website: "https://mosreg.ru", email: "invest@mosreg.ru" }
  },
  "Tatarstan": {
    name: "Republic of Tatarstan",
    nameRu: "Республика Татарстан",
    nameZh: "鞑靼斯坦共和国",
    gdp: "$61 Billion",
    population: "4 Million",
    industries: ["Oil & Gas", "Petrochemicals", "Automotive", "IT"],
    sezCount: 4,
    taxBenefits: ["Alabuga SEZ benefits", "IT park Innopolis incentives", "Petrochemical support"],
    majorCities: [
      { id: "kazan", name: "Kazan", population: "1.3M", lat: 55.7887, lng: 49.1221, image: "https://images.unsplash.com/photo-1561627358-3e27ef39c9dd?w=1920&q=80", description: "Capital of Tatarstan and Russia's sports capital. Beautiful UNESCO World Heritage Kremlin, emerging IT hub (Innopolis nearby), and Haier manufacturing base. Model for Russian regional development.", opportunities: [
        { id: "kzn-1", title: "Kazan IT Park", titleRu: "Казанский IT-парк", titleZh: "喀山IT园区", sector: "IT", description: "Software development and tech services. Gateway to Innopolis ecosystem with tax incentives.", descriptionRu: "Разработка программного обеспечения и IT-услуги. Доступ к экосистеме Иннополиса с налоговыми льготами.", descriptionZh: "软件开发和技术服务。通往伊诺波利斯生态系统的门户，享受税收优惠。", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "priority" },
{ id: "kzn-2", title: "Haier Ecosystem Expansion", titleZh: "海尔生态扩展", titleRu: "Расширение экосистемы Haier", sector: "Manufacturing", description: "Supply chain partnerships with Haier's Russian manufacturing base. Appliance components.", descriptionZh: "与海尔俄罗斯制造基地的供应链合作。家电零部件。", descriptionRu: "Партнёрства по цепочке поставок с российской производственной базой Haier. Компоненты бытовой техники.", investmentRange: "$5M - $60M", timeline: "1-2 years", status: "active" },
         { id: "kzn-3", title: "Kazan Sports Tourism", titleZh: "喀山体育旅游", titleRu: "Спортивный туризм Казани", sector: "Tourism", description: "Sports facilities and tourism from World Cup and Universiade legacy. Chinese sports partnerships.", descriptionZh: "世界杯和大运会遗产的体育设施和旅游。中国体育合作。", descriptionRu: "Спортивные объекты и туризм как наследие Чемпионата мира и Универсиады. Китайские спортивные партнёрства.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
         { id: "kzn-4", title: "Halal Industry Development", titleZh: "清真产业发展", titleRu: "Развитие халяльной индустрии", sector: "Food", description: "Halal food production and certification. Gateway to Muslim markets globally.", descriptionZh: "清真食品生产和认证。通往全球穆斯林市场的门户。", descriptionRu: "Производство и сертификация халяльной продукции. Ворота на мировые мусульманские рынки.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "naberezhnye-chelny", name: "Naberezhnye Chelny", population: "0.5M", image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1920&q=80", description: "Home of KAMAZ - Russia's largest truck manufacturer. Industrial city with strong automotive supply chain and Alabuga SEZ nearby.", opportunities: [
{ id: "nch-1", title: "KAMAZ EV Partnership", titleZh: "卡玛斯电动汽车合作", titleRu: "Партнёрство с КАМАЗ по электромобилям", sector: "Automotive", description: "Electric truck development with Russia's largest truck maker. Battery and powertrain components.", descriptionZh: "与俄罗斯最大卡车制造商合作开发电动卡车。电池和动力总成部件。", descriptionRu: "Разработка электрогрузовиков с крупнейшим российским производителем грузовиков. Компоненты батарей и силовых агрегатов.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
         { id: "nch-2", title: "Alabuga SEZ Manufacturing", titleZh: "阿拉布加经济特区制造", titleRu: "Производство в ОЭЗ Алабуга", sector: "Manufacturing", description: "Russia's best SEZ: 0% profit tax 10 years, 0% property tax. Turnkey factory facilities.", descriptionZh: "俄罗斯最好的经济特区：10年零利润税，零房产税。交钥匙工厂设施。", descriptionRu: "Лучшая ОЭЗ России: 0% налога на прибыль 10 лет, 0% налога на имущество. Заводы под ключ.", investmentRange: "$10M - $150M", timeline: "1-2 years", status: "priority" },
         { id: "nch-3", title: "Automotive Components Cluster", titleZh: "汽车零部件集群", titleRu: "Кластер автокомпонентов", sector: "Automotive", description: "Tier 1/2 supplier facilities for KAMAZ and nearby automakers.", descriptionZh: "为卡玛斯和附近汽车制造商提供一级/二级供应商设施。", descriptionRu: "Объекты поставщиков Tier 1/2 для КАМАЗа и ближайших автопроизводителей.", investmentRange: "$5M - $80M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "nizhnekamsk", name: "Nizhnekamsk", population: "0.2M", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80", description: "Petrochemical capital of Tatarstan. Home to TATNEFT and SIBUR facilities. Major polymer and rubber production center.", opportunities: [
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
      { id: "tt-p1", name: "Haier Industrial Park Kazan", value: "$200 Million", sector: "Electronics", description: "Chinese home appliance manufacturing base for Russia market.", partners: ["Haier"], completionYear: "2026" },
      { id: "tt-p2", name: "SIBUR Nizhnekamsk Polymer", value: "$3 Billion", sector: "Petrochemicals", description: "Ethylene and polyethylene production expansion.", partners: ["SIBUR"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "policy", title: "Best Regional Government", description: "Most efficient bureaucracy in Russia. English-speaking investment services." },
      { icon: "infrastructure", title: "Top SEZ", description: "Alabuga consistently rated Russia's best special economic zone." },
      { icon: "tech", title: "IT City", description: "Innopolis - Russia's only purpose-built tech city." },
      { icon: "market", title: "China Track Record", description: "Haier, Midea, and other Chinese companies already operating successfully." }
    ],
    notableEntrepreneurs: [
      { name: "Rustam Minnikhanov", nameRu: "Рустам Минниханов", nameZh: "鲁斯塔姆·明尼哈诺夫", company: "Tatarstan Government", industry: "Government & Business", netWorth: "N/A", description: "President of Tatarstan since 2010. Architect of Tatarstan's investment-friendly policies and SEZ success." },
      { name: "Airat Shaimiev", nameRu: "Айрат Шаймиев", nameZh: "艾拉特·沙伊米耶夫", company: "TAIF Group", industry: "Petrochemicals", netWorth: "$2.5B", description: "Part of founding family of TAIF, Tatarstan's largest private company. Major petrochemical and energy conglomerate." },
      { name: "Sergey Kogogin", nameRu: "Сергей Когогин", nameZh: "谢尔盖·科戈金", company: "KAMAZ", industry: "Automotive", netWorth: "N/A", description: "CEO of KAMAZ, Russia's largest truck manufacturer. Leading electric truck and autonomous vehicle development." },
      { name: "Albert Shigabutdinov", nameRu: "Альберт Шигабутдинов", nameZh: "阿尔伯特·希加布特季诺夫", company: "TAIF Group", industry: "Energy", netWorth: "$1.1B", description: "General Director of TAIF. Transformed local refinery into integrated petrochemical powerhouse." }
    ],
    contactInfo: { investmentAgency: "Tatarstan Investment Development Agency", website: "https://tida.tatarstan.ru", email: "info@tida.tatarstan.ru", phone: "+7-843-524-9091" }
  },
  "Sverdlovsk Oblast": {
    name: "Sverdlovsk Oblast",
    nameRu: "Свердловская область",
    nameZh: "斯维尔德洛夫斯克州",
    gdp: "$51 Billion",
    population: "4.3 Million",
    industries: ["Metallurgy", "Heavy Machinery", "Mining", "Defense"],
    sezCount: 2,
    taxBenefits: ["Industrial cluster benefits", "Mining incentives", "Titanium Valley SEZ"],
    majorCities: [
      { id: "yekaterinburg", name: "Yekaterinburg", population: "1.5M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Russia's 4th largest city and industrial capital of the Urals. Historic gateway between Europe and Asia on Trans-Siberian Railway. Hosts annual INNOPROM industrial fair - Russia's main platform for China partnerships.", opportunities: [
        { id: "ykt-1", title: "INNOPROM Industrial Partnership", titleZh: "中国国际工业博览会产业合作", titleRu: "Промышленное партнёрство ИННОПРОМ", sector: "Manufacturing", description: "Annual industrial fair connecting Chinese and Russian manufacturers. Technology transfer and JV platform.", descriptionZh: "连接中俄制造商的年度工业博览会。技术转让和合资企业平台。", descriptionRu: "Ежегодная промышленная выставка, соединяющая китайских и российских производителей. Платформа для трансфера технологий и создания СП.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "ykt-2", title: "Urals Heavy Industry Modernization", titleZh: "乌拉尔重工业现代化", titleRu: "Модернизация тяжёлой промышленности Урала", sector: "Machinery", description: "Industry 4.0 upgrades for metallurgy and machinery. Smart manufacturing solutions.", descriptionZh: "冶金和机械行业的工业4.0升级。智能制造解决方案。", descriptionRu: "Модернизация металлургии и машиностроения по стандартам Индустрии 4.0. Решения для умного производства.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
        { id: "ykt-3", title: "Yekaterinburg Tech Hub", titleZh: "叶卡捷琳堡科技中心", titleRu: "Технологический хаб Екатеринбурга", sector: "IT", description: "Software development and IT services. Growing startup ecosystem.", descriptionZh: "软件开发和IT服务。蓬勃发展的初创企业生态系统。", descriptionRu: "Разработка ПО и ИТ-услуги. Растущая стартап-экосистема.", investmentRange: "$3M - $40M", timeline: "1-2 years", status: "active" }
      ]},
      { id: "nizhny-tagil", name: "Nizhny Tagil", population: "0.3M", image: "https://images.unsplash.com/photo-1590244840770-b9a0a36a3a83?w=1920&q=80", description: "Major metallurgical center home to EVRAZ steel operations. Historic arms manufacturing city now diversifying into civilian products and green steel.", opportunities: [
        { id: "ntg-1", title: "EVRAZ Green Steel Partnership", titleZh: "EVRAZ绿色钢铁合作", titleRu: "Партнёрство ЕВРАЗ по зелёной стали", sector: "Steel", description: "Low-carbon steel production and rail manufacturing. Technology and supply partnerships.", descriptionZh: "低碳钢生产和铁路制造。技术和供应合作。", descriptionRu: "Производство низкоуглеродной стали и железнодорожной продукции. Технологическое и снабженческое партнёрство.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "ntg-2", title: "Defense Conversion Manufacturing", titleZh: "国防工业民用化生产", titleRu: "Конверсия оборонного производства", sector: "Manufacturing", description: "Civilian applications for defense industry capabilities. Precision machinery.", descriptionZh: "国防工业能力的民用化应用。精密机械制造。", descriptionRu: "Гражданское применение возможностей оборонной промышленности. Точное машиностроение.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "kamensk-uralsky", name: "Kamensk-Uralsky", population: "0.2M", image: "https://images.unsplash.com/photo-1597473322203-2c4f0e36e1c3?w=1920&q=80", description: "Aluminum and titanium processing center. Key supplier for aerospace and defense industries with VSMPO-AVISMA operations nearby.", opportunities: [
        { id: "kmu-1", title: "Titanium Valley Partnership", titleZh: "钛谷合作项目", titleRu: "Партнёрство Титановой долины", sector: "Aerospace", description: "Titanium processing and aerospace components. VSMPO-AVISMA ecosystem.", descriptionZh: "钛材加工和航空航天部件。VSMPO-AVISMA生态系统。", descriptionRu: "Переработка титана и производство аэрокосмических компонентов. Экосистема ВСМПО-АВИСМА.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "priority" }
      ]}
    ],
    overview: "Industrial heartland of the Urals and Russia's fourth-largest city (Yekaterinburg). Major metallurgy center (EVRAZ, UMMC), heavy machinery, and defense industry. Hosts annual INNOPROM industrial exhibition. Titanium Valley SEZ for aerospace.",
    targetSectors: ["Metallurgy", "Heavy Machinery", "Titanium & Aerospace", "Mining Equipment", "Industrial IoT"],
    opportunities: [
      { id: "sv-1", title: "Titanium Valley SEZ", titleZh: "钛谷经济特区", titleRu: "ОЭЗ Титановая долина", sector: "Aerospace", description: "Titanium processing and aerospace component manufacturing. VSMPO-AVISMA partnership opportunities.", descriptionZh: "钛材加工和航空航天部件制造。VSMPO-AVISMA合作机会。", descriptionRu: "Переработка титана и производство аэрокосмических компонентов. Возможности партнёрства с ВСМПО-АВИСМА.", investmentRange: "$20M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "sv-2", title: "INNOPROM Industrial Partnership", titleZh: "中国国际工业博览会产业合作", titleRu: "Промышленное партнёрство ИННОПРОМ", sector: "Manufacturing", description: "Annual industrial exhibition - platform for China-Russia manufacturing partnerships.", descriptionZh: "年度工业展览会——中俄制造业合作平台。", descriptionRu: "Ежегодная промышленная выставка — платформа для китайско-российского производственного партнёрства.", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "active" },
      { id: "sv-3", title: "Urals Mining Equipment", titleZh: "乌拉尔矿业设备", titleRu: "Горное оборудование Урала", sector: "Mining", description: "Mining machinery and equipment manufacturing for Russia's resource sector.", descriptionZh: "为俄罗斯资源行业制造矿山机械和设备。", descriptionRu: "Производство горнодобывающей техники и оборудования для ресурсного сектора России.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "sv-p1", name: "EVRAZ Nizhny Tagil Modernization", value: "$2 Billion", sector: "Steel", description: "Green steel production and rail manufacturing.", partners: ["EVRAZ"], completionYear: "2028" }
    ],
    advantages: [
      { icon: "resources", title: "Mineral Wealth", description: "Major deposits of iron, copper, titanium, and precious metals." },
      { icon: "infrastructure", title: "Industrial Base", description: "Complete heavy industry supply chain and skilled workforce." },
      { icon: "location", title: "Eurasia Gateway", description: "Yekaterinburg on Trans-Siberian Railway. Historic gateway between Europe and Asia." }
    ],
    contactInfo: { investmentAgency: "Sverdlovsk Region Investment Agency", website: "https://invest-in-ural.ru", email: "info@invest-in-ural.ru" }
  },
  "Krasnoyarsk Krai": {
    name: "Krasnoyarsk Krai",
    nameRu: "Красноярский край",
    nameZh: "克拉斯诺亚尔斯克边疆区",
    gdp: "$48 Billion",
    population: "2.9 Million",
    industries: ["Mining", "Metallurgy", "Hydropower", "Forestry"],
    sezCount: 1,
    taxBenefits: ["Resource extraction benefits", "Arctic development incentives", "Hydropower support"],
    majorCities: [
      { id: "krasnoyarsk", name: "Krasnoyarsk", population: "1.1M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Siberia's largest city on the Yenisei River. Major aluminum production (RUSAL) and hydropower hub. Gateway to vast mineral resources of northern Siberia.", opportunities: [
        { id: "kry-1", title: "RUSAL Aluminum Partnership", titleZh: "俄铝合作项目", titleRu: "Партнёрство с РУСАЛом", sector: "Aluminum", description: "World's lowest-cost aluminum production using hydropower. Processing and export.", descriptionZh: "利用水力发电的全球最低成本铝生产。加工和出口。", descriptionRu: "Производство алюминия с самой низкой себестоимостью в мире благодаря гидроэнергетике. Переработка и экспорт.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
        { id: "kry-2", title: "Siberian Hydropower Projects", titleZh: "西伯利亚水电项目", titleRu: "Сибирские гидроэнергетические проекты", sector: "Energy", description: "New hydropower development and integration with mining operations.", descriptionZh: "新水电开发及与采矿作业的整合。", descriptionRu: "Развитие новых гидроэлектростанций и интеграция с горнодобывающими операциями.", investmentRange: "$50M - $500M", timeline: "5-10 years", status: "upcoming" },
        { id: "kry-3", title: "Forestry & Wood Processing", titleZh: "林业与木材加工", titleRu: "Лесопереработка", sector: "Forestry", description: "Sustainable forestry and wood products export to China.", descriptionZh: "可持续林业和木材产品出口至中国。", descriptionRu: "Устойчивое лесопользование и экспорт древесной продукции в Китай.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "norilsk", name: "Norilsk", population: "0.2M", image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80", description: "Arctic mining city and home to Nornickel - world's largest nickel and palladium producer. Critical minerals for EV batteries and electronics. Extreme environment with unique investment opportunities.", opportunities: [
        { id: "nrl-1", title: "Nornickel Strategic Partnership", titleZh: "诺里尔斯克镍业战略合作", titleRu: "Стратегическое партнёрство с Норникелем", sector: "Mining", description: "Nickel, palladium, and copper supply agreements. Critical minerals for Chinese EV industry.", descriptionZh: "镍、钯和铜供应协议。中国电动汽车行业的关键矿产。", descriptionRu: "Соглашения о поставках никеля, палладия и меди. Критически важные минералы для китайской EV-индустрии.", investmentRange: "$100M - $1B", timeline: "5-10 years", status: "priority" },
        { id: "nrl-2", title: "Mining Technology", titleZh: "采矿技术", titleRu: "Горнодобывающие технологии", sector: "Technology", description: "Autonomous mining equipment and Arctic technology. Harsh environment solutions.", descriptionZh: "自主采矿设备和北极技术。恶劣环境解决方案。", descriptionRu: "Автономное горное оборудование и арктические технологии. Решения для экстремальных условий.", investmentRange: "$20M - $150M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "achinsk", name: "Achinsk", population: "0.1M", image: "https://images.unsplash.com/photo-1598286867762-8bde84aae1e3?w=1920&q=80", description: "Industrial city on the Trans-Siberian Railway. Aluminum and cement production. Growing logistics importance for eastbound freight.", opportunities: [
        { id: "ach-1", title: "Trans-Siberian Logistics Hub", titleZh: "西伯利亚大铁路物流枢纽", titleRu: "Транссибирский логистический хаб", sector: "Logistics", description: "Warehousing and transshipment on main rail corridor to Asia.", descriptionZh: "主要铁路走廊上通往亚洲的仓储和转运。", descriptionRu: "Складирование и перевалка на главном железнодорожном коридоре в Азию.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Vast Siberian region with enormous mineral wealth. Norilsk Nickel is world's largest nickel and palladium producer. Major aluminum (RUSAL) and hydropower production. Growing Arctic development importance.",
    targetSectors: ["Mining", "Aluminum", "Hydropower", "Arctic Development", "Forestry"],
    opportunities: [
      { id: "kr-1", title: "Nornickel Expansion Partnership", titleZh: "诺里尔斯克镍业扩展合作", titleRu: "Партнёрство по расширению Норникеля", sector: "Mining", description: "Nickel, palladium, and copper mining technology and equipment. Green mining initiatives.", descriptionZh: "镍、钯和铜采矿技术及设备。绿色采矿倡议。", descriptionRu: "Технологии и оборудование для добычи никеля, палладия и меди. Инициативы зелёной добычи.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "kr-2", title: "RUSAL Aluminum Partnership", titleZh: "俄铝合作项目", titleRu: "Партнёрство с РУСАЛом", sector: "Aluminum", description: "Aluminum smelting and processing. World's lowest-cost aluminum production using hydropower.", descriptionZh: "铝冶炼和加工。利用水力发电的全球最低成本铝生产。", descriptionRu: "Выплавка и переработка алюминия. Производство с самой низкой себестоимостью в мире благодаря гидроэнергетике.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
      { id: "kr-3", title: "Siberian Forestry Modernization", titleZh: "西伯利亚林业现代化", titleRu: "Модернизация сибирского лесопромышленного комплекса", sector: "Forestry", description: "Sustainable forestry and wood processing. Export to China.", descriptionZh: "可持续林业和木材加工。出口至中国。", descriptionRu: "Устойчивое лесопользование и деревообработка. Экспорт в Китай.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "kr-p1", name: "Nornickel Sulphur Program", value: "$3.5 Billion", sector: "Mining", description: "Environmental modernization capturing 95% of sulphur emissions.", partners: ["Nornickel"], completionYear: "2025" }
    ],
    advantages: [
      { icon: "resources", title: "Mineral Superpower", description: "Largest nickel, palladium reserves. Major copper, gold, platinum." },
      { icon: "infrastructure", title: "Cheap Hydropower", description: "Massive hydroelectric dams provide lowest-cost electricity." }
    ],
    contactInfo: { investmentAgency: "Krasnoyarsk Krai Investment Agency", website: "https://krskinvest.ru", email: "info@krskinvest.ru" }
  },
  "Krasnodar Krai": {
    name: "Krasnodar Krai",
    nameRu: "Краснодарский край",
    nameZh: "克拉斯诺达尔边疆区",
    gdp: "$63 Billion",
    population: "5.7 Million",
    industries: ["Agriculture", "Tourism", "Food Processing", "Oil & Gas"],
    sezCount: 2,
    taxBenefits: ["Agricultural support", "Resort zone benefits", "Investment incentives"],
    majorCities: [
      { id: "krasnodar", name: "Krasnodar", population: "1.1M", image: "https://images.unsplash.com/photo-1568954775058-be47c87a0a20?w=1920&q=80", description: "Capital of Russia's agricultural heartland. Fast-growing modern city with excellent climate. Major food processing and agribusiness center serving southern Russia.", opportunities: [
        { id: "krd-1", title: "Krasnodar Agribusiness Hub", titleZh: "克拉斯诺达尔农业综合中心", titleRu: "Агропромышленный хаб Краснодара", sector: "Agriculture", description: "Grain, sunflower, and food processing. Partnership with Russia's largest agricultural producers.", descriptionZh: "粮食、葵花籽和食品加工。与俄罗斯最大农业生产商的合作。", descriptionRu: "Зерно, подсолнечник и пищевая переработка. Партнёрство с крупнейшими аграрными производителями России.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "krd-2", title: "Food Processing Cluster", titleZh: "食品加工产业集群", titleRu: "Кластер пищевой переработки", sector: "Food", description: "Modern processing facilities for export to China. Cold chain and packaging.", descriptionZh: "出口中国的现代化加工设施。冷链和包装。", descriptionRu: "Современные перерабатывающие мощности для экспорта в Китай. Холодильная цепь и упаковка.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
        { id: "krd-3", title: "Wine Industry Development", titleZh: "葡萄酒产业发展", titleRu: "Развитие винодельческой отрасли", sector: "Wine", description: "Partnership with local wineries. China market export and tourism development.", descriptionZh: "与当地酒庄的合作。中国市场出口和旅游发展。", descriptionRu: "Партнёрство с местными винодельнями. Экспорт на китайский рынок и развитие туризма.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "sochi", name: "Sochi", population: "0.4M", image: "https://images.unsplash.com/photo-1578070181910-f1e514afdd08?w=1920&q=80", description: "Russia's premier Black Sea resort and 2014 Winter Olympics host. Year-round destination with beaches and ski slopes. World-class sports and entertainment facilities.", opportunities: [
        { id: "soc-1", title: "Sochi Resort Development", titleZh: "索契度假村开发", titleRu: "Развитие курортов Сочи", sector: "Tourism", description: "Luxury hotels and resort facilities. Growing Chinese tourist segment.", descriptionZh: "豪华酒店和度假设施。不断增长的中国游客群体。", descriptionRu: "Люксовые отели и курортная инфраструктура. Растущий сегмент китайских туристов.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
        { id: "soc-2", title: "Olympic Legacy Sports Hub", titleZh: "奥运遗产体育中心", titleRu: "Олимпийский спортивный наследственный хаб", sector: "Sports", description: "Sports training and event facilities. Formula 1 circuit and ski resorts.", descriptionZh: "体育训练和赛事设施。F1赛道和滑雪度假村。", descriptionRu: "Спортивные тренировочные и событийные объекты. Трасса Формулы-1 и горнолыжные курорты.", investmentRange: "$15M - $150M", timeline: "2-4 years", status: "active" },
        { id: "soc-3", title: "Medical Tourism", titleZh: "医疗旅游", titleRu: "Медицинский туризм", sector: "Healthcare", description: "Wellness resorts and medical tourism. Traditional Russian spa treatments.", descriptionZh: "健康度假村和医疗旅游。传统俄罗斯水疗。", descriptionRu: "Велнес-курорты и медицинский туризм. Традиционные российские спа-процедуры.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "upcoming" }
      ]},
      { id: "novorossiysk", name: "Novorossiysk", population: "0.3M", image: "https://images.unsplash.com/photo-1562073853-7d6039f3cb8a?w=1920&q=80", description: "Russia's largest Black Sea port handling 25% of seaborne trade. Major grain export terminal and oil terminal. Key logistics hub for southern Russia.", opportunities: [
        { id: "nvr-1", title: "Novorossiysk Container Terminal", titleZh: "新罗西斯克集装箱码头", titleRu: "Контейнерный терминал Новороссийска", sector: "Logistics", description: "Container handling expansion for China trade via Suez Canal route.", descriptionZh: "通过苏伊士运河航线扩大中国贸易的集装箱处理能力。", descriptionRu: "Расширение контейнерных мощностей для торговли с Китаем через Суэцкий канал.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
        { id: "nvr-2", title: "Grain Export Terminal", titleZh: "粮食出口码头", titleRu: "Зерновой экспортный терминал", sector: "Agriculture", description: "Grain export facilities for Russian wheat to global markets.", descriptionZh: "俄罗斯小麦出口至全球市场的粮食出口设施。", descriptionRu: "Зерновые экспортные мощности для российской пшеницы на мировые рынки.", investmentRange: "$30M - $200M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Russia's agricultural heartland and Black Sea resort region. Sochi hosted 2014 Winter Olympics. Novorossiysk is Russia's largest port. Warm climate attracts millions of tourists and agricultural investment.",
    targetSectors: ["Agriculture", "Tourism", "Food Processing", "Wine", "Port & Logistics"],
    opportunities: [
      { id: "kd-1", title: "Krasnodar Agricultural Investment", titleZh: "克拉斯诺达尔农业投资", titleRu: "Сельскохозяйственные инвестиции в Краснодар", sector: "Agriculture", description: "Grain, sunflower, and vegetable production. Largest agricultural region in Russia.", descriptionZh: "粮食、葵花籽和蔬菜生产。俄罗斯最大的农业区。", descriptionRu: "Производство зерна, подсолнечника и овощей. Крупнейший аграрный регион России.", investmentRange: "$10M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "kd-2", title: "Sochi Resort Development", titleZh: "索契度假村开发", titleRu: "Развитие курортов Сочи", sector: "Tourism", description: "Hotels, resorts, and tourism infrastructure. Olympic legacy facilities.", descriptionZh: "酒店、度假村和旅游基础设施。奥运遗产设施。", descriptionRu: "Отели, курорты и туристическая инфраструктура. Олимпийские наследственные объекты.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
      { id: "kd-3", title: "Novorossiysk Port Expansion", titleZh: "新罗西斯克港口扩建", titleRu: "Расширение порта Новороссийск", sector: "Logistics", description: "Container terminal and grain export facilities. China trade gateway.", descriptionZh: "集装箱码头和粮食出口设施。中国贸易门户。", descriptionRu: "Контейнерный терминал и зерновые экспортные мощности. Ворота торговли с Китаем.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "kd-p1", name: "Sochi-Adler Tourism Cluster", value: "$1 Billion", sector: "Tourism", description: "Year-round resort development.", completionYear: "2028" }
    ],
    advantages: [
      { icon: "resources", title: "Agricultural Leader", description: "Russia's breadbasket. Best climate for farming." },
      { icon: "logistics", title: "Black Sea Ports", description: "Novorossiysk handles 25% of Russian seaborne trade." },
      { icon: "infrastructure", title: "Olympic Legacy", description: "World-class sports and tourism facilities from 2014 Olympics." }
    ],
    contactInfo: { investmentAgency: "Krasnodar Krai Investment Agency", website: "https://kubaninvest.ru", email: "info@kubaninvest.ru" }
  },
  "Primorsky Krai": {
    name: "Primorsky Krai",
    nameRu: "Приморский край",
    nameZh: "滨海边疆区",
    gdp: "$20 Billion",
    population: "1.9 Million",
    industries: ["Shipping", "Fishing", "Trade", "Shipbuilding"],
    sezCount: 3,
    taxBenefits: ["Free Port of Vladivostok benefits", "Far East development incentives", "Fishing industry support"],
    majorCities: [
      { id: "vladivostok", name: "Vladivostok", population: "0.6M", lat: 43.1155, lng: 131.8855, image: "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=1920&q=80", description: "Russia's Pacific capital and gateway to Asia. Free Port of Vladivostok offers unique investment incentives. 2 hours from Harbin, direct connections to all major Asian cities. Eastern Economic Forum host.", opportunities: [
        { id: "vlk-1", title: "Free Port of Vladivostok", titleRu: "Свободный порт Владивосток", titleZh: "符拉迪沃斯托克自由港", sector: "Trade", description: "Simplified visa, customs, and tax regime. Gateway for China-Russia-Asia trade. Duty-free processing zones.", descriptionRu: "Упрощённый визовый, таможенный и налоговый режим. Ворота для торговли Китай-Россия-Азия. Беспошлинные зоны переработки.", descriptionZh: "简化签证、海关和税收制度。中俄亚贸易门户。免税加工区。", investmentRange: "$5M - $100M", timeline: "1-2 years", status: "priority" },
        { id: "vlk-2", title: "Vladivostok Port Expansion", titleZh: "符拉迪沃斯托克港口扩建", titleRu: "Расширение порта Владивосток", sector: "Logistics", description: "Container terminal and logistics hub. Direct shipping to all Chinese ports.", descriptionZh: "集装箱码头和物流枢纽。直接发运至所有中国港口。", descriptionRu: "Контейнерный терминал и логистический хаб. Прямые поставки во все китайские порты.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "vlk-3", title: "Casino & Tourism Zone", titleZh: "赌场与旅游区", titleRu: "Казино и туристическая зона", sector: "Tourism", description: "Primorye integrated entertainment resort. Gaming license and resort development.", descriptionZh: "滨海边疆区综合娱乐度假村。博彩牌照和度假村开发。", descriptionRu: "Интегрированный развлекательный курорт Приморье. Игорная лицензия и развитие курорта.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "vlk-4", title: "Seafood Processing Hub", titleZh: "海产品加工中心", titleRu: "Хаб переработки морепродуктов", sector: "Food", description: "Fish and seafood processing for China market. Cold chain and export facilities.", descriptionZh: "面向中国市场的鱼类和海产品加工。冷链和出口设施。", descriptionRu: "Переработка рыбы и морепродуктов для китайского рынка. Холодильная цепь и экспортные мощности.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]},
      { id: "nakhodka", name: "Nakhodka", population: "0.1M", image: "https://images.unsplash.com/photo-1569335468083-1b4c4b5e6fd0?w=1920&q=80", description: "Major Pacific port with ice-free harbor. Key terminus for Russian exports to Asia. Growing oil and LNG export terminal operations.", opportunities: [
        { id: "nak-1", title: "Nakhodka Oil Terminal", titleZh: "纳霍德卡石油码头", titleRu: "Нефтяной терминал Находки", sector: "Energy", description: "Oil export terminal operations and logistics. Russian crude to China.", descriptionZh: "石油出口码头运营和物流。俄罗斯原油出口至中国。", descriptionRu: "Операции нефтяного экспортного терминала и логистика. Российская нефть в Китай.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" },
        { id: "nak-2", title: "Container Port Development", titleZh: "集装箱港口开发", titleRu: "Развитие контейнерного порта", sector: "Logistics", description: "Container handling expansion for trans-Pacific trade.", descriptionZh: "跨太平洋贸易的集装箱处理能力扩展。", descriptionRu: "Расширение контейнерных мощностей для транстихоокеанской торговли.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "ussuriysk", name: "Ussuriysk", population: "0.2M", image: "https://images.unsplash.com/photo-1602746280895-acb6f3b8a01a?w=1920&q=80", description: "Major rail junction and agricultural center near Chinese border. Processing hub for agricultural products and manufacturing gateway for Chinese goods entering Russia.", opportunities: [
        { id: "uss-1", title: "Border Trade Processing Zone", titleZh: "边境贸易加工区", titleRu: "Зона пограничной торговой переработки", sector: "Trade", description: "Processing and packaging for China-sourced goods. Rail transfer and logistics.", descriptionZh: "中国来源商品的加工和包装。铁路转运和物流。", descriptionRu: "Переработка и упаковка китайских товаров. Железнодорожная перевалка и логистика.", investmentRange: "$5M - $60M", timeline: "1-2 years", status: "priority" },
        { id: "uss-2", title: "Agricultural Processing", titleZh: "农产品加工", titleRu: "Сельскохозяйственная переработка", sector: "Agriculture", description: "Soybean, rice, and honey processing for export. Food industry cluster.", descriptionZh: "大豆、大米和蜂蜜出口加工。食品产业集群。", descriptionRu: "Переработка сои, риса и мёда на экспорт. Кластер пищевой промышленности.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Russia's Pacific gateway and closest major Russian city to China. Vladivostok hosts Eastern Economic Forum. Free Port regime with visa-free entry, tax benefits, and simplified customs. Direct border crossing to Heilongjiang and Jilin provinces.",
    targetSectors: ["Shipping & Logistics", "Fishing", "China Border Trade", "Shipbuilding", "Tourism"],
    opportunities: [
      { id: "pk-1", title: "Free Port of Vladivostok", titleZh: "符拉迪沃斯托克自由港", titleRu: "Свободный порт Владивосток", sector: "Trade", description: "Tax-free zone with simplified customs, visa-free entry for 18 countries, 0% import duties for SEZ goods. Gateway for China-Russia trade.", descriptionZh: "免税区，海关简化，18国免签入境，经济特区商品零进口关税。中俄贸易门户。", descriptionRu: "Безналоговая зона с упрощённой таможней, безвизовый въезд для 18 стран, 0% пошлины для товаров ОЭЗ. Ворота китайско-российской торговли.", investmentRange: "$10M - $300M", timeline: "1-3 years", status: "priority" },
      { id: "pk-2", title: "Vladivostok-Harbin Trade Corridor", titleZh: "符拉迪沃斯托克-哈尔滨贸易走廊", titleRu: "Торговый коридор Владивосток-Харбин", sector: "Logistics", description: "Cross-border logistics connecting Russian Far East to Northeast China. Rail and road infrastructure.", descriptionZh: "连接俄罗斯远东与中国东北的跨境物流。铁路和公路基础设施。", descriptionRu: "Трансграничная логистика, соединяющая российский Дальний Восток с Северо-Восточным Китаем. Железнодорожная и автодорожная инфраструктура.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "pk-3", title: "Russian Seafood Export Hub", titleZh: "俄罗斯海产品出口中心", titleRu: "Российский хаб экспорта морепродуктов", sector: "Fishing", description: "Fishing fleet investment and seafood processing for China market. Russia supplies 10% of China's seafood.", descriptionZh: "渔船投资和面向中国市场的海产品加工。俄罗斯供应中国10%的海产品。", descriptionRu: "Инвестиции в рыболовный флот и переработка морепродуктов для китайского рынка. Россия поставляет 10% морепродуктов Китая.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "active" },
      { id: "pk-4", title: "Zvezda Shipyard Partnership", titleZh: "红星造船厂合作", titleRu: "Партнёрство с судоверфью Звезда", sector: "Shipbuilding", description: "LNG carriers, tankers, and icebreakers at Russia's largest shipyard.", descriptionZh: "在俄罗斯最大造船厂建造LNG运输船、油轮和破冰船。", descriptionRu: "СПГ-танкеры, нефтеналивные танкеры и ледоколы на крупнейшей судоверфи России.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "pk-p1", name: "Eastern Economic Forum Infrastructure", value: "$2 Billion", sector: "Infrastructure", description: "Vladivostok development as Russia-Asia business hub.", completionYear: "2030" },
      { id: "pk-p2", name: "Zarubino Port Development", value: "$3 Billion", sector: "Port", description: "Major new port for Northeast China transit trade.", partners: ["Summa Group", "Chinese investors"], completionYear: "2030" }
    ],
    advantages: [
      { icon: "location", title: "China Gateway", description: "2 hours from Harbin by car. Closest Russian city to Asian markets." },
      { icon: "policy", title: "Free Port Regime", description: "Visa-free, tax-free, simplified customs. Best incentives in Russia." },
      { icon: "resources", title: "Seafood Capital", description: "Rich fishing grounds. Major crab, salmon, and pollock supply." },
      { icon: "infrastructure", title: "EEF Host", description: "Annual Eastern Economic Forum brings top China-Russia business leaders." }
    ],
    contactInfo: { investmentAgency: "Primorsky Krai Investment Agency", website: "https://invest.primorsky.ru", email: "info@invest.primorsky.ru", phone: "+7-423-220-5555" }
  },
  "Sakhalin Oblast": {
    name: "Sakhalin Oblast",
    nameRu: "Сахалинская область",
    nameZh: "萨哈林州",
    gdp: "$25 Billion",
    population: "0.5 Million",
    industries: ["Oil & Gas", "Fishing", "Mining", "LNG"],
    sezCount: 1,
    taxBenefits: ["PSA benefits", "Far East incentives", "LNG project support"],
    majorCities: [
      { id: "yuzhno-sakhalinsk", name: "Yuzhno-Sakhalinsk", population: "0.2M", image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80", description: "Capital of Russia's richest Far Eastern region. Oil and gas service center with Japanese heritage. Gateway to massive offshore energy projects.", opportunities: [
        { id: "ysk-1", title: "Oil & Gas Service Hub", titleZh: "油气服务中心", titleRu: "Хаб нефтегазовых услуг", sector: "Energy Services", description: "Service base for Sakhalin offshore projects. Equipment, logistics, and technical services.", descriptionZh: "萨哈林近海项目的服务基地。设备、物流和技术服务。", descriptionRu: "Сервисная база для шельфовых проектов Сахалина. Оборудование, логистика и технические услуги.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
        { id: "ysk-2", title: "LNG Terminal Operations", titleZh: "LNG码头运营", titleRu: "Операции СПГ-терминала", sector: "LNG", description: "LNG export operations and maintenance. Ship loading and storage services.", descriptionZh: "LNG出口运营和维护。船舶装载和储存服务。", descriptionRu: "Экспортные операции СПГ и техническое обслуживание. Услуги по погрузке и хранению.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" },
        { id: "ysk-3", title: "Sakhalin Tech Services", titleZh: "萨哈林技术服务", titleRu: "Технические услуги Сахалина", sector: "IT", description: "Remote operations and digital oilfield services. Arctic technology development.", descriptionZh: "远程操作和数字油田服务。北极技术开发。", descriptionRu: "Дистанционное управление и цифровые нефтепромысловые услуги. Разработка арктических технологий.", investmentRange: "$5M - $50M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "korsakov", name: "Korsakov", population: "0.03M", image: "https://images.unsplash.com/photo-1569335468083-1b4c4b5e6fd0?w=1920&q=80", description: "Major port city and LNG export terminal. Gateway for Sakhalin-2 project shipments to Asia.", opportunities: [
        { id: "kor-1", title: "Korsakov LNG Transshipment", titleZh: "科尔萨科夫LNG转运", titleRu: "Перевалка СПГ в Корсакове", sector: "LNG", description: "LNG transshipment and bunkering services. Arctic route support.", descriptionZh: "LNG转运和加注服务。北极航线支持。", descriptionRu: "Услуги перевалки и бункеровки СПГ. Поддержка арктических маршрутов.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "priority" },
        { id: "kor-2", title: "Seafood Processing Complex", titleZh: "海产品加工中心", titleRu: "Комплекс переработки морепродуктов", sector: "Fishing", description: "Premium crab and salmon processing. Direct export to Chinese markets.", descriptionZh: "优质蟹和三文鱼加工。直接出口至中国市场。", descriptionRu: "Переработка премиального краба и лосося. Прямой экспорт на китайские рынки.", investmentRange: "$15M - $100M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Island region with massive offshore oil and gas resources. Major LNG exporter to Asia. Sakhalin-1 and Sakhalin-2 are among world's largest integrated oil and gas projects. Strategic location for Asia energy supply.",
    targetSectors: ["Oil & Gas", "LNG", "Fishing", "Mining", "Hydrogen"],
    opportunities: [
      { id: "sk-1", title: "Sakhalin LNG Expansion", titleZh: "萨哈林LNG扩建", titleRu: "Расширение сахалинского СПГ", sector: "LNG", description: "LNG plant expansion and Asian export infrastructure. Direct shipments to China LNG terminals.", descriptionZh: "LNG工厂扩建和亚洲出口基础设施。直接发运至中国LNG码头。", descriptionRu: "Расширение СПГ-завода и экспортная инфраструктура для Азии. Прямые поставки на китайские СПГ-терминалы.", investmentRange: "$100M - $1B", timeline: "5-10 years", status: "priority" },
      { id: "sk-2", title: "Sakhalin Hydrogen Hub", titleZh: "萨哈林氢能中心", titleRu: "Сахалинский водородный хаб", sector: "Hydrogen", description: "Blue and green hydrogen production for Asian markets. Leverage existing gas infrastructure.", descriptionZh: "面向亚洲市场的蓝氢和绿氢生产。利用现有天然气基础设施。", descriptionRu: "Производство голубого и зелёного водорода для азиатских рынков. Использование существующей газовой инфраструктуры.", investmentRange: "$50M - $500M", timeline: "5-10 years", status: "upcoming" },
      { id: "sk-3", title: "Sakhalin Seafood Processing", titleZh: "萨哈林海产品加工", titleRu: "Переработка морепродуктов Сахалина", sector: "Fishing", description: "Premium crab and salmon processing for Chinese market.", descriptionZh: "面向中国市场的优质蟹和三文鱼加工。", descriptionRu: "Переработка премиального краба и лосося для китайского рынка.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "sk-p1", name: "Sakhalin Energy LNG Train 3", value: "$10 Billion", sector: "LNG", description: "Additional LNG production capacity.", partners: ["Sakhalin Energy"], completionYear: "2030" }
    ],
    advantages: [
      { icon: "resources", title: "Energy Superpower", description: "Massive oil and gas reserves. Russia's LNG export hub to Asia." },
      { icon: "location", title: "Asia Proximity", description: "Short shipping distance to China, Japan, Korea LNG markets." }
    ],
    contactInfo: { investmentAgency: "Sakhalin Oblast Investment Agency", website: "https://investinsakhalin.ru", email: "info@investinsakhalin.ru" }
  },
  "Khabarovsk Krai": {
    name: "Khabarovsk Krai",
    nameRu: "Хабаровский край",
    nameZh: "哈巴罗夫斯克边疆区",
    gdp: "$17 Billion",
    population: "1.3 Million",
    industries: ["Mining", "Forestry", "Fishing", "Manufacturing"],
    sezCount: 2,
    taxBenefits: ["Far East development benefits", "Resource extraction incentives", "Border trade support"],
    majorCities: [
      { id: "khabarovsk", name: "Khabarovsk", population: "0.6M", image: "https://images.unsplash.com/photo-1569935738295-3ef208855c9e?w=1920&q=80", description: "Capital of Russia's Far East Federal District on the Amur River. Major administrative and cultural center with direct border crossing to China. Gateway for Heilongjiang trade.", opportunities: [
        { id: "khb-1", title: "Khabarovsk-Fuyuan Border Hub", sector: "Trade", description: "Cross-border trade zone with direct China access. Simplified customs for Russian-Chinese goods.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" },
        { id: "khb-2", title: "Khabarovsk Logistics Center", sector: "Logistics", description: "Regional distribution hub for Far East. Rail and river transport integration.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
        { id: "khb-3", title: "Far East Food Processing", sector: "Food", description: "Processing Russian agricultural products for Chinese market. Honey, berries, and game.", investmentRange: "$8M - $60M", timeline: "1-3 years", status: "active" }
      ]},
      { id: "komsomolsk-on-amur", name: "Komsomolsk-on-Amur", population: "0.2M", image: "https://images.unsplash.com/photo-1590244840770-b9a0a36a3a83?w=1920&q=80", description: "Russia's major aerospace manufacturing city. Home to Sukhoi fighter jets and civilian aircraft production. Strong industrial base with skilled workforce.", opportunities: [
        { id: "kms-1", title: "Sukhoi Supply Partnership", sector: "Aerospace", description: "Component supply for Su-35, Su-57 fighters and Superjet 100. Avionics and materials.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
        { id: "kms-2", title: "Civilian Aircraft Components", sector: "Aerospace", description: "Superjet and MC-21 supply chain. Composite materials and systems.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" },
        { id: "kms-3", title: "Steel & Metallurgy Processing", sector: "Steel", description: "Amurstal steel plant partnerships. Specialty steel products.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
      ]}
    ],
    overview: "Major Far East region on Amur River bordering China. Khabarovsk is administrative center of Far Eastern Federal District. Strong aerospace (Sukhoi aircraft), mining, and forestry sectors. Direct border trade with Heilongjiang.",
    targetSectors: ["Aerospace", "Mining", "Forestry", "Border Trade", "Food Processing"],
    opportunities: [
      { id: "kh-1", title: "Khabarovsk-Fuyuan Border Trade", sector: "Trade", description: "Cross-border trade zone with Heilongjiang. Simplified customs and logistics.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" },
      { id: "kh-2", title: "Komsomolsk Aviation Cluster", sector: "Aerospace", description: "Sukhoi aircraft manufacturing. Supplier and technology partnerships.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" },
      { id: "kh-3", title: "Far East Timber Processing", sector: "Forestry", description: "Value-added wood processing for China export. Sustainable forestry.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "kh-p1", name: "Sukhoi Superjet Production", value: "$1 Billion", sector: "Aerospace", description: "Regional jet manufacturing expansion.", partners: ["UAC"], completionYear: "2027" }
    ],
    advantages: [
      { icon: "location", title: "Far East Capital", description: "Administrative center of Far Eastern Federal District." },
      { icon: "infrastructure", title: "Aerospace Hub", description: "Sukhoi fighter and civilian aircraft production." }
    ],
    contactInfo: { investmentAgency: "Khabarovsk Krai Investment Agency", website: "https://invest.khabkrai.ru", email: "info@invest.khabkrai.ru" }
  },
  "Novosibirsk Oblast": {
    name: "Novosibirsk Oblast",
    nameRu: "Новосибирская область",
    nameZh: "新西伯利亚州",
    gdp: "$23 Billion",
    population: "2.8 Million",
    industries: ["IT", "Science", "Manufacturing", "Agriculture"],
    sezCount: 2,
    taxBenefits: ["Akademgorodok technopark benefits", "IT incentives", "Science city support"],
    majorCities: [
      { id: "novosibirsk", name: "Novosibirsk", population: "1.6M", image: "https://images.unsplash.com/photo-1596389662031-aa6e6b8d0c09?w=1920&q=80", description: "Russia's third-largest city and capital of Siberia. Home to Akademgorodok - Russia's premier science city. Major IT hub with strong research tradition. Strategic location on Trans-Siberian Railway.", opportunities: [
        { id: "nvs-1", title: "Akademgorodok Tech Partnership", sector: "R&D", description: "Joint research with 35+ institutes. AI, physics, biology, and materials science.", investmentRange: "$10M - $150M", timeline: "2-4 years", status: "priority" },
        { id: "nvs-2", title: "Novosibirsk IT Cluster", sector: "IT", description: "Software development hub. Strong mathematics and programming talent from NSU.", investmentRange: "$5M - $60M", timeline: "1-2 years", status: "active" },
        { id: "nvs-3", title: "Vector Institute Partnership", sector: "Biotech", description: "Virology and vaccine research. World-renowned biosecurity expertise.", investmentRange: "$15M - $120M", timeline: "3-5 years", status: "active" },
        { id: "nvs-4", title: "Siberian Logistics Hub", sector: "Logistics", description: "Trans-Siberian Railway node. China-Europe freight and distribution.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "berdsk", name: "Berdsk", population: "0.1M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Satellite city with electronics manufacturing and recreation on Ob Sea reservoir. Growing residential and tech services.", opportunities: [
        { id: "brd-1", title: "Electronics Manufacturing", sector: "Electronics", description: "Consumer and industrial electronics production. Novosibirsk metro area supplier.", investmentRange: "$8M - $60M", timeline: "2-3 years", status: "active" }
      ]}
    ],
    overview: "Russia's third-largest city and Siberian capital. Akademgorodok is Russia's premier science city with world-class research institutes. Strong IT sector and growing tech startup ecosystem. Strategic location on Trans-Siberian Railway.",
    targetSectors: ["IT & Software", "Science & R&D", "Biotech", "Nuclear Technology", "Education"],
    opportunities: [
      { id: "ns-1", title: "Akademgorodok Science Partnership", sector: "R&D", description: "Joint research with 35+ institutes in physics, biology, chemistry. Technology commercialization opportunities.", investmentRange: "$5M - $100M", timeline: "2-4 years", status: "priority" },
      { id: "ns-2", title: "Novosibirsk IT Cluster", sector: "IT", description: "Software development and tech startups. Strong mathematics and programming talent.", investmentRange: "$3M - $50M", timeline: "1-2 years", status: "active" },
      { id: "ns-3", title: "Siberian Biotech Hub", sector: "Biotech", description: "Vector Institute for virology and biotech research. Vaccine and pharmaceutical development.", investmentRange: "$10M - $100M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "ns-p1", name: "Akademgorodok 2.0", value: "$500 Million", sector: "Science", description: "Modernization of Russia's premier science city.", completionYear: "2030" }
    ],
    advantages: [
      { icon: "talent", title: "Science Capital", description: "Akademgorodok - Russia's largest scientific center with 35+ research institutes." },
      { icon: "tech", title: "IT Hub", description: "Strong programming talent and growing startup ecosystem." }
    ],
    contactInfo: { investmentAgency: "Novosibirsk Oblast Investment Agency", website: "https://invest.nso.ru", email: "info@invest.nso.ru" }
  },
  "Kaliningrad Oblast": {
    name: "Kaliningrad Oblast",
    nameRu: "Калининградская область",
    nameZh: "加里宁格勒州",
    gdp: "$12 Billion",
    population: "1 Million",
    industries: ["Automotive", "Electronics", "Food Processing", "Amber"],
    sezCount: 1,
    taxBenefits: ["SEZ Yantar benefits", "EU border trade advantages", "Import substitution support"],
    majorCities: [{ id: "kaliningrad", name: "Kaliningrad", population: "0.5M" }, { id: "sovetsk", name: "Sovetsk", population: "0.04M" }],
    overview: "Russian exclave on Baltic Sea between Poland and Lithuania. Special Economic Zone with unique EU border position. Automotive assembly (BMW, Kia), electronics manufacturing, and 90% of world's amber reserves.",
    targetSectors: ["Automotive", "Electronics Assembly", "Amber", "Food Processing", "Tourism"],
    opportunities: [
      { id: "kg-1", title: "Kaliningrad Assembly Hub", sector: "Manufacturing", description: "Electronics and automotive assembly for Russia market. SEZ tax benefits.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "active" },
      { id: "kg-2", title: "Baltic Tourism Development", sector: "Tourism", description: "Beach resorts and historical tourism. Amber jewelry and crafts.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
    ],
    keyProjects: [
      { id: "kg-p1", name: "Kaliningrad Port Modernization", value: "$300 Million", sector: "Port", description: "Baltic container terminal expansion.", completionYear: "2027" }
    ],
    advantages: [
      { icon: "location", title: "EU Gateway", description: "Only Russian region bordering EU. Unique trade position." },
      { icon: "resources", title: "Amber Capital", description: "90% of world's amber deposits." }
    ],
    contactInfo: { investmentAgency: "Kaliningrad Oblast Development Corporation", website: "https://investinkaliningrad.ru", email: "info@investinkaliningrad.ru" }
  },
  "Samara Oblast": { name: "Samara Oblast", nameRu: "Самарская область", nameZh: "萨马拉州", gdp: "$35 Billion", population: "3.2 Million", industries: ["Automotive", "Aerospace", "Petrochemicals", "Agriculture"], sezCount: 1, taxBenefits: ["Automotive cluster benefits", "Aerospace incentives", "Togliatti SEZ"], majorCities: [{ id: "samara", name: "Samara", population: "1.2M" }, { id: "togliatti", name: "Togliatti", population: "0.7M" }, { id: "syzran", name: "Syzran", population: "0.2M" }], overview: "Major Volga region industrial center. AVTOVAZ (Lada) headquarters in Togliatti. Space rocket production at Progress. Strong petrochemical sector.", targetSectors: ["Automotive", "Aerospace", "Petrochemicals", "Agriculture"], opportunities: [{ id: "sm-1", title: "AVTOVAZ Supplier Partnership", sector: "Automotive", description: "Component supply for Russia's largest automaker. EV transition opportunities.", investmentRange: "$10M - $150M", timeline: "2-3 years", status: "active" }], keyProjects: [{ id: "sm-p1", name: "Togliatti SEZ Expansion", value: "$200 Million", sector: "Industrial", description: "Automotive supplier park development.", completionYear: "2027" }], advantages: [{ icon: "infrastructure", title: "Auto Capital", description: "AVTOVAZ headquarters and supplier ecosystem." }], contactInfo: { investmentAgency: "Samara Oblast Investment Agency", website: "https://investinsamara.ru" } },
  "Nizhny Novgorod Oblast": { name: "Nizhny Novgorod Oblast", nameRu: "Нижегородская область", nameZh: "下诺夫哥罗德州", gdp: "$32 Billion", population: "3.2 Million", industries: ["Automotive", "IT", "Metallurgy", "Chemicals"], sezCount: 2, taxBenefits: ["IT cluster benefits", "Automotive support", "Investment incentives"], majorCities: [{ id: "nizhny-novgorod", name: "Nizhny Novgorod", population: "1.3M" }, { id: "dzerzhinsk", name: "Dzerzhinsk", population: "0.2M" }, { id: "arzamas", name: "Arzamas", population: "0.1M" }], overview: "Historic trading city at Volga-Oka confluence. GAZ Group truck manufacturing. Growing IT sector and strong chemicals industry in Dzerzhinsk.", targetSectors: ["Automotive", "IT", "Chemicals", "Nuclear"], opportunities: [{ id: "nn-1", title: "GAZ Group Partnership", sector: "Automotive", description: "Commercial vehicle manufacturing. Chinese brand assembly.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }], keyProjects: [], advantages: [{ icon: "logistics", title: "Volga Hub", description: "Strategic location on major river trade routes." }], contactInfo: { investmentAgency: "Nizhny Novgorod Investment Agency", website: "https://invest.nnov.ru" } },
  "Rostov Oblast": { name: "Rostov Oblast", nameRu: "Ростовская область", nameZh: "罗斯托夫州", gdp: "$33 Billion", population: "4.2 Million", industries: ["Agriculture", "Heavy Machinery", "Food Processing", "Trade"], sezCount: 1, taxBenefits: ["Agricultural processing benefits", "Southern Russia incentives", "Port zone benefits"], majorCities: [{ id: "rostov-on-don", name: "Rostov-on-Don", population: "1.1M" }, { id: "taganrog", name: "Taganrog", population: "0.3M" }, { id: "shakhty", name: "Shakhty", population: "0.2M" }], overview: "Southern Russia's largest city and agricultural hub. Gateway to Caucasus. Major agricultural machinery (Rostselmash) production. Port city on Don River.", targetSectors: ["Agriculture", "Agricultural Machinery", "Food Processing", "Logistics"], opportunities: [{ id: "rs-1", title: "Rostselmash Partnership", titleZh: "罗斯特农机合作", titleRu: "Партнёрство с Ростсельмаш", sector: "Machinery", description: "Agricultural machinery manufacturing. Combine harvester production.", descriptionZh: "农业机械制造。联合收割机生产。", descriptionRu: "Производство сельскохозяйственной техники. Производство зерноуборочных комбайнов.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
      { id: "rs-2", title: "Don River Grain Export", titleZh: "顿河粮食出口", titleRu: "Донской зерновой экспорт", sector: "Agriculture", description: "Grain processing and export terminal. Major wheat and sunflower production.", descriptionZh: "粮食加工和出口码头。主要小麦和葵花籽生产。", descriptionRu: "Зернопереработка и экспортный терминал. Крупное производство пшеницы и подсолнечника.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" },
      { id: "rs-3", title: "Rostov Tech Hub", titleZh: "罗斯托夫科技中心", titleRu: "Ростовский технопарк", sector: "IT", description: "IT and software development center for southern Russia.", descriptionZh: "俄罗斯南部IT和软件开发中心。", descriptionRu: "ИТ и центр разработки ПО для юга России.", investmentRange: "$5M - $50M", timeline: "1-2 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Agricultural Belt", description: "Major grain and sunflower production region." }], contactInfo: { investmentAgency: "Rostov Oblast Investment Agency", website: "https://investinrostov.ru" } },
  "Chelyabinsk Oblast": { name: "Chelyabinsk Oblast", nameRu: "Челябинская область", nameZh: "车里雅宾斯克州", gdp: "$28 Billion", population: "3.4 Million", industries: ["Metallurgy", "Heavy Machinery", "Mining", "Defense"], sezCount: 1, taxBenefits: ["Industrial cluster benefits", "Metallurgy support", "Defense industry incentives"], majorCities: [{ id: "chelyabinsk", name: "Chelyabinsk", population: "1.2M" }, { id: "magnitogorsk", name: "Magnitogorsk", population: "0.4M" }, { id: "zlatoust", name: "Zlatoust", population: "0.2M" }], overview: "Major Urals industrial center. MMK steel giant in Magnitogorsk. Pipe manufacturing and heavy machinery. Strong defense industry.", targetSectors: ["Steel", "Pipe Manufacturing", "Mining Equipment", "Defense"], opportunities: [{ id: "ch-1", title: "MMK Steel Partnership", titleZh: "马格尼托哥尔斯克钢铁合作", titleRu: "Партнёрство с ММК", sector: "Steel", description: "Steel production and processing. Green steel initiatives.", descriptionZh: "钢铁生产和加工。绿色钢铁倡议。", descriptionRu: "Производство и переработка стали. Инициативы зелёной стали.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
      { id: "ch-2", title: "Chelyabinsk Pipe Manufacturing", titleZh: "车里雅宾斯克管道制造", titleRu: "Челябинское трубное производство", sector: "Manufacturing", description: "Steel pipe production for oil and gas pipelines to China.", descriptionZh: "石油和天然气管道的钢管生产。", descriptionRu: "Производство стальных труб для нефтегазопроводов в Китай.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "ch-3", title: "Urals Mining Equipment", titleZh: "乌拉尔采矿设备", titleRu: "Уральское горное оборудование", sector: "Mining", description: "Mining machinery and equipment manufacturing.", descriptionZh: "采矿机械和设备制造。", descriptionRu: "Производство горнодобывающей техники и оборудования.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" }], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Steel Giant", description: "MMK - one of world's largest steel plants." }], contactInfo: { investmentAgency: "Chelyabinsk Oblast Investment Agency", website: "https://investinchel.ru" } },
  "Bashkortostan": { name: "Republic of Bashkortostan", nameRu: "Республика Башкортостан", nameZh: "巴什科尔托斯坦共和国", gdp: "$27 Billion", population: "4 Million", industries: ["Oil & Gas", "Petrochemicals", "Agriculture", "Mining"], sezCount: 1, taxBenefits: ["Petrochemical cluster benefits", "Agricultural support", "Investment incentives"], majorCities: [{ id: "ufa", name: "Ufa", population: "1.1M" }, { id: "sterlitamak", name: "Sterlitamak", population: "0.3M" }, { id: "salavat", name: "Salavat", population: "0.2M" }], overview: "Major petrochemical and agricultural region. Bashneft oil company. Diverse ethnic republic with strong manufacturing base.", targetSectors: ["Petrochemicals", "Oil Refining", "Agriculture", "Soda & Chemicals"], opportunities: [{ id: "bs-1", title: "Bashkortostan Petrochemical Investment", titleZh: "巴什科尔托斯坦石化投资", titleRu: "Нефтехимические инвестиции Башкортостана", sector: "Petrochemicals", description: "Downstream oil processing and specialty chemicals.", descriptionZh: "下游石油加工和特种化学品。", descriptionRu: "Переработка нефти и производство специализированных химикатов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
      { id: "bs-2", title: "Bashneft Oil Partnership", titleZh: "巴什石油合作", titleRu: "Партнёрство с Башнефтью", sector: "Oil & Gas", description: "Oil production and refining partnership with Bashneft.", descriptionZh: "与巴什石油的石油生产和炼油合作。", descriptionRu: "Партнёрство по добыче и переработке нефти с Башнефтью.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "bs-3", title: "Ufa Agricultural Processing", titleZh: "乌法农产品加工", titleRu: "Уфимская сельхозпереработка", sector: "Agriculture", description: "Grain and honey processing for export.", descriptionZh: "粮食和蜂蜜加工出口。", descriptionRu: "Переработка зерна и мёда на экспорт.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Petrochemical Hub", description: "Major refining and chemical production capacity." }], contactInfo: { investmentAgency: "Bashkortostan Investment Agency", website: "https://investinbashkortostan.ru" } },
  "Perm Krai": { name: "Perm Krai", nameRu: "Пермский край", nameZh: "彼尔姆边疆区", gdp: "$26 Billion", population: "2.6 Million", industries: ["Oil & Gas", "Chemicals", "Mining", "Machinery"], sezCount: 1, taxBenefits: ["Chemical cluster benefits", "Mining incentives", "Industrial park support"], majorCities: [{ id: "perm", name: "Perm", population: "1.1M" }, { id: "berezniki", name: "Berezniki", population: "0.1M" }, { id: "solikamsk", name: "Solikamsk", population: "0.1M" }], overview: "Major Urals industrial region. Uralkali potash production. Strong chemicals and oil sector. Aviation engine manufacturing.", targetSectors: ["Potash & Fertilizers", "Oil & Gas", "Aviation", "Chemicals"], opportunities: [{ id: "pm-1", title: "Uralkali Potash Partnership", titleZh: "乌拉尔钾肥合作", titleRu: "Партнёрство с Уралкалием", sector: "Fertilizers", description: "Potash mining and fertilizer production for China agriculture.", descriptionZh: "钾肥开采和化肥生产，供应中国农业。", descriptionRu: "Добыча калия и производство удобрений для китайского сельского хозяйства.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "pm-2", title: "Perm Aviation Engines", titleZh: "彼尔姆航空发动机", titleRu: "Пермские авиадвигатели", sector: "Aerospace", description: "Aircraft engine manufacturing and maintenance.", descriptionZh: "飞机发动机制造和维护。", descriptionRu: "Производство и обслуживание авиационных двигателей.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
      { id: "pm-3", title: "Kama Oil & Gas Services", titleZh: "卡马石油天然气服务", titleRu: "Камские нефтегазовые услуги", sector: "Oil & Gas", description: "Oilfield services and equipment for Western Siberia operations.", descriptionZh: "西西伯利亚作业的油田服务和设备。", descriptionRu: "Нефтесервисные услуги и оборудование для западносибирских операций.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Potash Leader", description: "World's largest potash producer. Critical for agriculture." }], contactInfo: { investmentAgency: "Perm Krai Investment Agency", website: "https://investinperm.ru" } },
  "Leningrad Oblast": { name: "Leningrad Oblast", nameRu: "Ленинградская область", nameZh: "列宁格勒州", gdp: "$22 Billion", population: "2 Million", industries: ["Automotive", "Shipbuilding", "Food Processing", "Logistics"], sezCount: 2, taxBenefits: ["Port zone benefits", "Automotive cluster support", "Logistics incentives"], majorCities: [{ id: "gatchina", name: "Gatchina", population: "0.1M" }, { id: "vyborg", name: "Vyborg", population: "0.08M" }, { id: "vsevolozhsk", name: "Vsevolozhsk", population: "0.07M" }], overview: "Region surrounding St. Petersburg with major ports and industry. Major automotive plants (Ford, Toyota, GM). Ust-Luga port is Russia's largest Baltic terminal.", targetSectors: ["Automotive", "Port & Logistics", "Shipbuilding", "LNG"], opportunities: [{ id: "lo-1", title: "Ust-Luga Port Development", titleZh: "乌斯季卢加港口开发", titleRu: "Развитие порта Усть-Луга", sector: "Port", description: "Russia's largest Baltic port. Container and LNG terminals.", descriptionZh: "俄罗斯最大的波罗的海港口。集装箱和LNG码头。", descriptionRu: "Крупнейший российский балтийский порт. Контейнерные и СПГ-терминалы.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "lo-2", title: "Baltic Automotive Cluster", titleZh: "波罗的海汽车产业集群", titleRu: "Балтийский автомобильный кластер", sector: "Automotive", description: "Auto parts manufacturing near St. Petersburg plants.", descriptionZh: "圣彼得堡工厂附近的汽车零部件制造。", descriptionRu: "Производство автокомплектующих рядом с петербургскими заводами.", investmentRange: "$20M - $150M", timeline: "2-3 years", status: "active" },
      { id: "lo-3", title: "Leningrad LNG Terminal", titleZh: "列宁格勒LNG码头", titleRu: "Ленинградский СПГ-терминал", sector: "Energy", description: "LNG import and bunkering facility for Baltic shipping.", descriptionZh: "波罗的海航运的LNG进口和加注设施。", descriptionRu: "СПГ-импортный и бункеровочный терминал для балтийского судоходства.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "active" }], keyProjects: [], advantages: [{ icon: "logistics", title: "Baltic Gateway", description: "Ust-Luga - Russia's largest Baltic port." }], contactInfo: { investmentAgency: "Leningrad Oblast Investment Agency", website: "https://investinlenobl.ru" } },
  "Irkutsk Oblast": {
    name: "Irkutsk Oblast",
    nameRu: "Иркутская область",
    nameZh: "伊尔库茨克州",
    gdp: "$34 Billion",
    population: "2.4 Million",
    industries: ["Mining", "Forestry", "Hydropower", "Chemicals"],
    sezCount: 1,
    taxBenefits: ["Resource extraction benefits", "Baikal tourism incentives", "Energy cluster support"],
    majorCities: [
      { id: "irkutsk", name: "Irkutsk", population: "0.6M", image: "https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=1920&q=80", description: "Gateway to Lake Baikal and historic Siberian trading city. Rich architectural heritage from merchants' era. Major university center and tourism hub for Chinese visitors.", opportunities: [
        { id: "irk-1", title: "Lake Baikal Eco-Tourism", sector: "Tourism", description: "Premium eco-lodges and adventure tourism on world's deepest lake. Growing Chinese visitor segment.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "priority" },
        { id: "irk-2", title: "Baikal Chinese Tourism Services", sector: "Tourism", description: "Hotels, restaurants, and tour services for 200,000+ Chinese visitors annually.", investmentRange: "$8M - $60M", timeline: "1-3 years", status: "active" },
        { id: "irk-3", title: "Irkutsk Aviation Hub", sector: "Aviation", description: "Aircraft manufacturing and maintenance. Irkutsk Aircraft Corporation (MC-21 components).", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
      ]},
      { id: "bratsk", name: "Bratsk", population: "0.2M", image: "https://images.unsplash.com/photo-1597473322203-2c4f0e36e1c3?w=1920&q=80", description: "Major industrial city built around one of world's largest hydroelectric dams. Home to RUSAL Bratsk aluminum smelter - world's lowest-cost aluminum.", opportunities: [
        { id: "brt-1", title: "RUSAL Aluminum Partnership", sector: "Aluminum", description: "World's lowest-cost aluminum production using hydro power. Processing and export.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
        { id: "brt-2", title: "Bratsk Wood Processing", sector: "Forestry", description: "Value-added timber processing. Sustainable forestry for China export.", investmentRange: "$15M - $100M", timeline: "2-4 years", status: "active" }
      ]},
      { id: "angarsk", name: "Angarsk", population: "0.2M", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80", description: "Petrochemical and nuclear fuel center. Angarsk Petrochemical Company and uranium enrichment facility.", opportunities: [
        { id: "ang-1", title: "Angarsk Petrochemical JV", sector: "Petrochemicals", description: "Downstream oil processing and specialty chemicals. Integration with East Siberia crude.", investmentRange: "$50M - $400M", timeline: "4-6 years", status: "active" }
      ]}
    ],
    overview: "Eastern Siberia gateway to Lake Baikal. Major aluminum (RUSAL Bratsk), hydropower, and forestry. Growing Chinese tourism to Baikal.",
    targetSectors: ["Aluminum", "Hydropower", "Tourism", "Forestry", "Mining"],
    opportunities: [
      { id: "ir-1", title: "Baikal Tourism Development", sector: "Tourism", description: "Lake Baikal eco-tourism for Chinese visitors. Hotels and infrastructure.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "ir-2", title: "RUSAL Bratsk Partnership", sector: "Aluminum", description: "Aluminum smelting using cheap hydropower.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
    ],
    keyProjects: [
      { id: "ir-p1", name: "Baikal Tourism Infrastructure", value: "$300 Million", sector: "Tourism", description: "Hotels, roads, and visitor facilities for Lake Baikal.", completionYear: "2028" }
    ],
    advantages: [
      { icon: "infrastructure", title: "Baikal Gateway", description: "UNESCO World Heritage Lake Baikal. Growing Chinese tourism." },
      { icon: "resources", title: "Cheap Energy", description: "Massive hydropower provides lowest-cost electricity in Russia." }
    ],
    contactInfo: { investmentAgency: "Irkutsk Oblast Investment Agency", website: "https://investinirkutsk.ru", email: "info@investinirkutsk.ru" }
  },
  "Voronezh Oblast": { name: "Voronezh Oblast", nameRu: "Воронежская область", nameZh: "沃罗涅日州", gdp: "$20 Billion", population: "2.3 Million", industries: ["Agriculture", "Food Processing", "Electronics", "Aerospace"], sezCount: 1, taxBenefits: ["Agricultural processing benefits", "Electronics cluster support", "Investment incentives"], majorCities: [{ id: "voronezh", name: "Voronezh", population: "1.1M" }, { id: "rossosh", name: "Rossosh", population: "0.06M" }, { id: "borisoglebsk", name: "Borisoglebsk", population: "0.06M" }], overview: "Major agricultural and aerospace region in Central Russia. Aircraft engine manufacturing. Growing electronics and food processing.", targetSectors: ["Agriculture", "Aerospace", "Electronics", "Food Processing"], opportunities: [{ id: "vr-1", title: "Voronezh Agricultural Processing", titleZh: "沃罗涅日农产品加工", titleRu: "Воронежская сельхозпереработка", sector: "Food", description: "Sugar, grain, and oilseed processing for China export.", descriptionZh: "糖、粮食和油籽加工出口至中国。", descriptionRu: "Переработка сахара, зерна и масличных культур для экспорта в Китай.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" },
      { id: "vr-2", title: "Voronezh Aircraft Engines", titleZh: "沃罗涅日飞机发动机", titleRu: "Воронежские авиадвигатели", sector: "Aerospace", description: "Aircraft engine manufacturing and maintenance center.", descriptionZh: "飞机发动机制造和维护中心。", descriptionRu: "Центр производства и обслуживания авиационных двигателей.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" },
      { id: "vr-3", title: "Central Russia Electronics", titleZh: "俄罗斯中部电子", titleRu: "Электроника Центральной России", sector: "Electronics", description: "Electronics and semiconductor assembly.", descriptionZh: "电子和半导体组装。", descriptionRu: "Сборка электроники и полупроводников.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }], keyProjects: [], advantages: [{ icon: "resources", title: "Agricultural Hub", description: "Major grain and sugar beet production." }], contactInfo: { investmentAgency: "Voronezh Oblast Investment Agency", website: "https://investinvoronezh.ru" } },
  "Tyumen Oblast": { name: "Tyumen Oblast", nameZh: "秋明州", nameRu: "Тюменская область", gdp: "$85 Billion", population: "3.8 Million", sezCount: 2, industries: ["Oil & Gas", "Petrochemicals", "Services"], taxBenefits: ["10% corporate tax", "Oil field incentives"], majorCities: [
    { id: "tyumen-city", name: "Tyumen", population: "0.8M", image: "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=1920&q=80", description: "Gateway to Western Siberian oil fields. Fastest-growing major city in Russia.", opportunities: [
      { id: "tym-1", title: "Western Siberia Oil Services Hub", titleZh: "西西伯利亚油田服务中心", titleRu: "Хаб нефтесервисных услуг Западной Сибири", sector: "Oil Services", description: "Oilfield services, equipment, and logistics base for Siberian operations.", descriptionZh: "西伯利亚作业的油田服务、设备和物流基地。", descriptionRu: "База нефтесервисных услуг, оборудования и логистики для сибирских операций.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
      { id: "tym-2", title: "Tyumen Technology Park", titleZh: "秋明科技园", titleRu: "Тюменский технопарк", sector: "IT", description: "IT and digital services for oil and gas industry.", descriptionZh: "石油和天然气行业的IT和数字服务。", descriptionRu: "ИТ и цифровые услуги для нефтегазовой отрасли.", investmentRange: "$10M - $80M", timeline: "1-3 years", status: "active" }
    ]}
  ], overview: "Gateway to Russia's richest oil and gas regions. Major logistics and service hub for Western Siberian operations. Headquarters of many Russian oil companies.", targetSectors: ["Oil & Gas Services", "Petrochemicals", "Logistics", "IT Services"], opportunities: [
    { id: "ty-1", title: "Siberian Oil Services Base", titleZh: "西伯利亚石油服务基地", titleRu: "Сибирская база нефтесервиса", sector: "Energy Services", description: "Equipment and services hub for Western Siberian oil fields.", descriptionZh: "西西伯利亚油田的设备和服务中心。", descriptionRu: "Хаб оборудования и услуг для западносибирских нефтяных месторождений.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
    { id: "ty-2", title: "Tyumen Petrochemical Complex", titleZh: "秋明石化综合体", titleRu: "Тюменский нефтехимический комплекс", sector: "Petrochemicals", description: "Downstream processing of Siberian oil and gas.", descriptionZh: "西伯利亚石油和天然气的下游加工。", descriptionRu: "Переработка сибирской нефти и газа.", investmentRange: "$50M - $500M", timeline: "4-6 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Oil Gateway", description: "Direct access to Western Siberian oil fields." }], contactInfo: { investmentAgency: "Tyumen Oblast Investment Agency", website: "https://investtyumen.ru" } },
  "Volgograd Oblast": { name: "Volgograd Oblast", nameZh: "伏尔加格勒州", nameRu: "Волгоградская область", gdp: "$15 Billion", population: "2.5 Million", sezCount: 1, industries: ["Machinery", "Steel", "Agriculture", "Petrochemicals"], taxBenefits: ["SEZ tax incentives", "Agricultural subsidies"], majorCities: [
    { id: "volgograd-city", name: "Volgograd", population: "1.0M", image: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=1920&q=80", description: "Major industrial city on the Volga River. Historic Stalingrad, now a manufacturing hub.", opportunities: [
      { id: "vlg-1", title: "Volga Industrial Modernization", titleZh: "伏尔加工业现代化", titleRu: "Модернизация волжской промышленности", sector: "Manufacturing", description: "Industry 4.0 upgrades for machinery and steel plants.", descriptionZh: "机械和钢铁厂的工业4.0升级。", descriptionRu: "Модернизация машиностроительных и металлургических заводов по стандартам Индустрии 4.0.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" },
      { id: "vlg-2", title: "Volga River Logistics Hub", titleZh: "伏尔加河物流枢纽", titleRu: "Волжский логистический хаб", sector: "Logistics", description: "River port and multimodal logistics center.", descriptionZh: "河港和多式联运物流中心。", descriptionRu: "Речной порт и мультимодальный логистический центр.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "priority" }
    ]}
  ], overview: "Major industrial center on the Volga River. Strong machinery, steel, and petrochemical industries. Strategic location connecting European Russia to Kazakhstan and Central Asia.", targetSectors: ["Heavy Machinery", "Steel Processing", "Petrochemicals", "Agriculture"], opportunities: [
    { id: "vg-1", title: "Volgograd Steel Complex", titleZh: "伏尔加格勒钢铁综合体", titleRu: "Волгоградский металлургический комплекс", sector: "Steel", description: "Steel production and pipe manufacturing for pipelines.", descriptionZh: "管道用钢铁生产和管道制造。", descriptionRu: "Производство стали и труб для трубопроводов.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
    { id: "vg-2", title: "Volga Agribusiness Hub", titleZh: "伏尔加农业综合中心", titleRu: "Волжский агропромышленный хаб", sector: "Agriculture", description: "Grain processing and food production for export.", descriptionZh: "粮食加工和食品生产出口。", descriptionRu: "Зернопереработка и производство продуктов питания на экспорт.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Volga Corridor", description: "Strategic river and rail connections." }], contactInfo: { investmentAgency: "Volgograd Development Corporation", website: "https://investvolgograd.ru" } },
  "Omsk Oblast": { name: "Omsk Oblast", nameZh: "鄂木斯克州", nameRu: "Омская область", gdp: "$18 Billion", population: "1.9 Million", sezCount: 1, industries: ["Petrochemicals", "Agriculture", "Machinery"], taxBenefits: ["Industrial park incentives", "Agricultural support"], majorCities: [
    { id: "omsk-city", name: "Omsk", population: "1.2M", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80", description: "Major refining center with Gazprom Neft's largest refinery. Gateway to Kazakhstan.", opportunities: [
      { id: "om-1", title: "Omsk Refinery Modernization", titleZh: "鄂木斯克炼油厂现代化", titleRu: "Модернизация Омского НПЗ", sector: "Oil Refining", description: "Partnership with Gazprom Neft refinery. Modernization and capacity expansion.", descriptionZh: "与俄气石油炼油厂的合作。现代化和产能扩张。", descriptionRu: "Партнёрство с НПЗ Газпром нефти. Модернизация и расширение мощностей.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "om-2", title: "Trans-Siberian Logistics", titleZh: "西伯利亚大铁路物流", titleRu: "Транссибирская логистика", sector: "Logistics", description: "Railway hub on Trans-Siberian route to China.", descriptionZh: "通往中国的西伯利亚大铁路枢纽。", descriptionRu: "Железнодорожный хаб на Транссибирской магистрали в Китай.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Major petrochemical and refining center in Western Siberia. Home to Russia's largest oil refinery. Strategic position on Trans-Siberian Railway and Kazakhstan border.", targetSectors: ["Petrochemicals", "Oil Refining", "Machinery", "Agriculture"], opportunities: [
    { id: "os-1", title: "Gazprom Neft Refinery Partnership", titleZh: "俄气石油炼油厂合作", titleRu: "Партнёрство с НПЗ Газпром нефти", sector: "Refining", description: "Joint venture opportunities at Russia's largest refinery.", descriptionZh: "俄罗斯最大炼油厂的合资机会。", descriptionRu: "Возможности совместных предприятий на крупнейшем российском НПЗ.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "os-2", title: "Siberian Agricultural Processing", titleZh: "西伯利亚农产品加工", titleRu: "Сибирская сельхозпереработка", sector: "Agriculture", description: "Grain and oilseed processing for Asian export.", descriptionZh: "面向亚洲出口的粮食和油籽加工。", descriptionRu: "Переработка зерна и масличных для азиатского экспорта.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Refining Hub", description: "Russia's largest oil refinery complex." }], contactInfo: { investmentAgency: "Omsk Oblast Investment Agency", website: "https://investomsk.ru" } },
  "Kemerovo Oblast": { name: "Kemerovo Oblast", nameZh: "克麦罗沃州", nameRu: "Кемеровская область", gdp: "$22 Billion", population: "2.6 Million", sezCount: 1, industries: ["Coal Mining", "Steel", "Chemicals"], taxBenefits: ["Mining tax incentives", "SEZ benefits"], majorCities: [
    { id: "kemerovo-city", name: "Kemerovo", population: "0.5M", image: "https://images.unsplash.com/photo-1615729947596-a598e5de0ab3?w=1920&q=80", description: "Capital of Russia's coal mining region. Major center for metallurgical coal production.", opportunities: [
      { id: "kem-1", title: "Kuzbass Coal Partnership", titleZh: "库兹巴斯煤炭合作", titleRu: "Партнёрство по кузбасскому углю", sector: "Coal", description: "Metallurgical coal mining and export to China.", descriptionZh: "冶金煤开采和出口至中国。", descriptionRu: "Добыча и экспорт коксующегося угля в Китай.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "kem-2", title: "Mining Technology Center", titleZh: "采矿技术中心", titleRu: "Центр горных технологий", sector: "Mining Tech", description: "Autonomous mining equipment and safety technology.", descriptionZh: "自主采矿设备和安全技术。", descriptionRu: "Автономное горное оборудование и технологии безопасности.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's largest coal mining region (Kuzbass). Produces 60% of Russia's coal, including metallurgical coal for Chinese steel industry. Major steel and chemical production.", targetSectors: ["Coal Mining", "Mining Equipment", "Steel", "Chemicals"], opportunities: [
    { id: "ke-1", title: "Kuzbass Coal Export Expansion", titleZh: "库兹巴斯煤炭出口扩张", titleRu: "Расширение экспорта кузбасского угля", sector: "Coal", description: "Coal mining expansion to meet Chinese demand. New rail capacity.", descriptionZh: "扩大煤炭开采以满足中国需求。新增铁路运力。", descriptionRu: "Расширение угледобычи для удовлетворения китайского спроса. Новые железнодорожные мощности.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ke-2", title: "Kuzbass Green Mining Initiative", titleZh: "库兹巴斯绿色采矿倡议", titleRu: "Кузбасская инициатива зелёной добычи", sector: "Mining", description: "Environmental technology and mine reclamation projects.", descriptionZh: "环保技术和矿山复垦项目。", descriptionRu: "Экологические технологии и проекты рекультивации шахт.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Coal Capital", description: "60% of Russia's coal production." }], contactInfo: { investmentAgency: "Kuzbass Development Corporation", website: "https://investkuzbass.ru" } },
  "Murmansk Oblast": { name: "Murmansk Oblast", nameZh: "摩尔曼斯克州", nameRu: "Мурманская область", gdp: "$12 Billion", population: "0.7 Million", sezCount: 1, industries: ["Shipping", "Mining", "Fishing", "LNG"], taxBenefits: ["Arctic zone benefits", "Port incentives"], majorCities: [
    { id: "murmansk-city", name: "Murmansk", population: "0.3M", image: "https://images.unsplash.com/photo-1610472384533-2dc6d9a0c7e8?w=1920&q=80", description: "Russia's largest Arctic city. Ice-free port and gateway for Northern Sea Route.", opportunities: [
      { id: "mur-1", title: "Northern Sea Route Hub", titleZh: "北方海航线枢纽", titleRu: "Хаб Северного морского пути", sector: "Shipping", description: "Arctic shipping terminal and icebreaker support services.", descriptionZh: "北极航运码头和破冰船支持服务。", descriptionRu: "Арктический судоходный терминал и услуги ледокольной поддержки.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "mur-2", title: "Arctic LNG Transshipment", titleZh: "北极LNG转运", titleRu: "Перевалка арктического СПГ", sector: "LNG", description: "LNG transshipment from Yamal and Arctic projects to Asia.", descriptionZh: "从亚马尔和北极项目向亚洲转运LNG。", descriptionRu: "Перевалка СПГ из Ямала и арктических проектов в Азию.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" }
    ]}
  ], overview: "Strategic Arctic gateway and Northern Sea Route hub. Russia's largest ice-free Arctic port. Growing importance for LNG transshipment and China shipping route.", targetSectors: ["Arctic Shipping", "LNG", "Mining", "Fisheries"], opportunities: [
    { id: "mu-1", title: "Northern Sea Route Infrastructure", titleZh: "北方海航线基础设施", titleRu: "Инфраструктура Севморпути", sector: "Shipping", description: "Port and logistics infrastructure for Asia-Europe Arctic route.", descriptionZh: "亚欧北极航线的港口和物流基础设施。", descriptionRu: "Портовая и логистическая инфраструктура для арктического маршрута Азия-Европа.", investmentRange: "$50M - $500M", timeline: "4-6 years", status: "priority" },
    { id: "mu-2", title: "Kola Mining Partnership", titleZh: "科拉半岛采矿合作", titleRu: "Кольское горнодобывающее партнёрство", sector: "Mining", description: "Rare earth and phosphate mining on Kola Peninsula.", descriptionZh: "科拉半岛的稀土和磷酸盐开采。", descriptionRu: "Добыча редкоземельных элементов и фосфатов на Кольском полуострове.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Arctic Gateway", description: "Ice-free port and Northern Sea Route access." }], contactInfo: { investmentAgency: "Murmansk Arctic Development Agency", website: "https://investmurmansk.ru" } },
  "Arkhangelsk Oblast": { name: "Arkhangelsk Oblast", nameZh: "阿尔汉格尔斯克州", nameRu: "Архангельская область", gdp: "$10 Billion", population: "1.1 Million", sezCount: 1, industries: ["Forestry", "Shipbuilding", "Diamonds"], taxBenefits: ["Arctic zone benefits", "Forestry incentives"], majorCities: [
    { id: "arkhangelsk-city", name: "Arkhangelsk", population: "0.4M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Historic White Sea port. Major center for timber export and shipbuilding.", opportunities: [
      { id: "ark-1", title: "Russian Timber Export Hub", titleZh: "俄罗斯木材出口中心", titleRu: "Хаб экспорта российской древесины", sector: "Forestry", description: "Timber processing and export to China.", descriptionZh: "木材加工和出口至中国。", descriptionRu: "Переработка и экспорт древесины в Китай.", investmentRange: "$15M - $150M", timeline: "2-4 years", status: "active" },
      { id: "ark-2", title: "Sevmash Shipyard Partnership", titleZh: "北方机械造船厂合作", titleRu: "Партнёрство с Севмашем", sector: "Shipbuilding", description: "Civilian shipbuilding and Arctic vessel construction.", descriptionZh: "民用造船和北极船舶建造。", descriptionRu: "Гражданское судостроение и строительство арктических судов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Major timber and forestry center. Home to Sevmash shipyard and diamond mining operations. Growing role in Arctic development and Northern Sea Route.", targetSectors: ["Forestry", "Shipbuilding", "Diamonds", "Arctic Development"], opportunities: [
    { id: "ar-1", title: "Arkhangelsk Forestry Complex", titleZh: "阿尔汉格尔斯克林业综合体", titleRu: "Архангельский лесопромышленный комплекс", sector: "Forestry", description: "Sustainable forestry and wood processing for China market.", descriptionZh: "面向中国市场的可持续林业和木材加工。", descriptionRu: "Устойчивое лесопользование и деревообработка для китайского рынка.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "ar-2", title: "Lomonosov Diamond Mine", titleZh: "罗蒙诺索夫钻石矿", titleRu: "Алмазный рудник Ломоносова", sector: "Mining", description: "Diamond mining partnership with ALROSA.", descriptionZh: "与埃罗莎的钻石开采合作。", descriptionRu: "Партнёрство по добыче алмазов с АЛРОСА.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Forest Resources", description: "Vast timber reserves and sustainable forestry." }], contactInfo: { investmentAgency: "Arkhangelsk Investment Agency", website: "https://investarkhangelsk.ru" } },
  "Republic of Karelia": { name: "Republic of Karelia", nameZh: "卡累利阿共和国", nameRu: "Республика Карелия", gdp: "$6 Billion", population: "0.6 Million", sezCount: 1, industries: ["Forestry", "Mining", "Tourism"], taxBenefits: ["Regional tax incentives", "Tourism development support"], majorCities: [
    { id: "petrozavodsk", name: "Petrozavodsk", population: "0.3M", image: "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=1920&q=80", description: "Capital of Karelia. Gateway to pristine lakes and forests.", opportunities: [
      { id: "pet-1", title: "Karelian Forestry Development", titleZh: "卡累利阿林业发展", titleRu: "Развитие карельского лесопромышленного комплекса", sector: "Forestry", description: "Sustainable timber harvesting and processing.", descriptionZh: "可持续木材采伐和加工。", descriptionRu: "Устойчивая заготовка и переработка древесины.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
      { id: "pet-2", title: "Karelia Eco-Tourism", titleZh: "卡累利阿生态旅游", titleRu: "Карельский экотуризм", sector: "Tourism", description: "Eco-tourism development near Finnish border.", descriptionZh: "芬兰边境附近的生态旅游开发。", descriptionRu: "Развитие экотуризма у финской границы.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Scenic region bordering Finland with vast forests and lakes. Major forestry and mining industry. Growing eco-tourism destination.", targetSectors: ["Forestry", "Mining", "Tourism", "IT"], opportunities: [
    { id: "ka-1", title: "Karelian Forest Products", titleZh: "卡累利阿林产品", titleRu: "Карельские лесопродукты", sector: "Forestry", description: "Wood pellets, lumber, and paper products.", descriptionZh: "木屑颗粒、木材和纸制品。", descriptionRu: "Древесные пеллеты, пиломатериалы и бумажная продукция.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
    { id: "ka-2", title: "Karelia Mining Development", titleZh: "卡累利阿采矿开发", titleRu: "Развитие горнодобычи Карелии", sector: "Mining", description: "Granite, crusite, and industrial minerals.", descriptionZh: "花岗岩、碎石和工业矿物。", descriptionRu: "Гранит, щебень и промышленные минералы.", investmentRange: "$10M - $100M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "EU Border", description: "Direct access to Finnish and EU markets." }], contactInfo: { investmentAgency: "Karelia Investment Agency", website: "https://investkarelia.ru" } },
  "Sakha (Yakutia)": { name: "Sakha (Yakutia)", nameZh: "萨哈（雅库特）共和国", nameRu: "Республика Саха (Якутия)", gdp: "$25 Billion", population: "1.0 Million", sezCount: 2, industries: ["Diamonds", "Gold", "Coal", "Oil & Gas"], taxBenefits: ["Arctic zone benefits", "Mining incentives", "Far East development support"], majorCities: [
    { id: "yakutsk", name: "Yakutsk", population: "0.3M", image: "https://images.unsplash.com/photo-1548625361-1c64bc0e3b74?w=1920&q=80", description: "World's coldest major city. Gateway to diamond and gold mining regions.", opportunities: [
      { id: "yak-1", title: "ALROSA Diamond Partnership", titleZh: "埃罗莎钻石合作", titleRu: "Партнёрство с АЛРОСА", sector: "Diamonds", description: "Diamond mining and processing. World's largest diamond producer.", descriptionZh: "钻石开采和加工。世界最大钻石生产商。", descriptionRu: "Добыча и обработка алмазов. Крупнейший производитель алмазов в мире.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "yak-2", title: "Polyus Gold Partnership", titleZh: "波柳斯黄金合作", titleRu: "Партнёрство с Полюсом", sector: "Gold", description: "Gold mining expansion. One of world's lowest-cost producers.", descriptionZh: "黄金开采扩张。全球成本最低的生产商之一。", descriptionRu: "Расширение добычи золота. Один из производителей с самой низкой себестоимостью.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" }
    ]}
  ], overview: "Largest region in Russia, rich in diamonds, gold, and rare earths. Home to ALROSA (27% of world diamond production). Strategic Arctic development zone.", targetSectors: ["Diamond Mining", "Gold Mining", "Coal", "Arctic Development"], opportunities: [
    { id: "yk-1", title: "ALROSA Diamond Mining Expansion", titleZh: "埃罗莎钻石开采扩张", titleRu: "Расширение алмазодобычи АЛРОСА", sector: "Diamonds", description: "Partnership with world's largest diamond producer. 27% of global production.", descriptionZh: "与世界最大钻石生产商合作。占全球产量27%。", descriptionRu: "Партнёрство с крупнейшим производителем алмазов в мире. 27% мирового производства.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "yk-2", title: "Yakutia Coal Export to China", titleZh: "雅库特煤炭出口至中国", titleRu: "Экспорт якутского угля в Китай", sector: "Coal", description: "High-quality coking coal for Chinese steel industry.", descriptionZh: "中国钢铁行业的高质量焦煤。", descriptionRu: "Высококачественный коксующийся уголь для китайской металлургии.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
    { id: "yk-3", title: "Rare Earth Mining Development", titleZh: "稀土开采开发", titleRu: "Развитие добычи редкоземельных металлов", sector: "Mining", description: "Strategic rare earth element deposits. Alternative to Chinese supply.", descriptionZh: "战略稀土元素矿床。中国供应的替代来源。", descriptionRu: "Стратегические месторождения редкоземельных элементов. Альтернатива китайским поставкам.", investmentRange: "$40M - $400M", timeline: "4-6 years", status: "upcoming" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Diamond Capital", description: "27% of world diamond production." }], contactInfo: { investmentAgency: "Yakutia Investment Agency", website: "https://investyakutia.ru" } },
  "Yamalo-Nenets": { name: "Yamalo-Nenets", nameZh: "亚马尔-涅涅茨自治区", nameRu: "Ямало-Ненецкий автономный округ", gdp: "$65 Billion", population: "0.5 Million", sezCount: 1, industries: ["Natural Gas", "LNG", "Oil"], taxBenefits: ["Arctic zone benefits", "LNG incentives", "Energy sector support"], majorCities: [
    { id: "salekhard", name: "Salekhard", population: "0.05M", image: "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?w=1920&q=80", description: "Only city in the world on the Arctic Circle. Gateway to Yamal gas fields.", opportunities: [
      { id: "sal-1", title: "Yamal LNG Phase 2", titleZh: "亚马尔LNG二期", titleRu: "Ямал СПГ Фаза 2", sector: "LNG", description: "LNG production expansion. Major Chinese investment target.", descriptionZh: "LNG生产扩张。主要的中国投资目标。", descriptionRu: "Расширение производства СПГ. Крупнейший объект китайских инвестиций.", investmentRange: "$100M - $1B", timeline: "5-7 years", status: "priority" },
      { id: "sal-2", title: "Arctic Gas Processing", titleZh: "北极天然气加工", titleRu: "Арктическая газопереработка", sector: "Gas Processing", description: "Natural gas processing and condensate production.", descriptionZh: "天然气加工和凝析油生产。", descriptionRu: "Переработка природного газа и производство конденсата.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Russia's gas capital. Produces 80% of Russian natural gas. Home to Yamal LNG - one of world's largest LNG projects with major Chinese investment (CNPC, Silk Road Fund).", targetSectors: ["Natural Gas", "LNG", "Oil", "Arctic Services"], opportunities: [
    { id: "yn-1", title: "Yamal LNG Expansion", titleZh: "亚马尔LNG扩张", titleRu: "Расширение Ямал СПГ", sector: "LNG", description: "Additional LNG trains at Yamal and Arctic LNG 2 projects. Chinese financing available.", descriptionZh: "亚马尔和北极LNG 2项目的额外LNG生产线。可获得中国融资。", descriptionRu: "Дополнительные линии СПГ на проектах Ямал и Арктик СПГ 2. Доступно китайское финансирование.", investmentRange: "$200M - $2B", timeline: "5-10 years", status: "priority" },
    { id: "yn-2", title: "Power of Siberia 2 Support", titleZh: "西伯利亚力量2号管道支持", titleRu: "Поддержка Силы Сибири 2", sector: "Pipeline", description: "Infrastructure for Power of Siberia 2 gas pipeline to China.", descriptionZh: "通往中国的西伯利亚力量2号天然气管道基础设施。", descriptionRu: "Инфраструктура газопровода Сила Сибири 2 в Китай.", investmentRange: "$50M - $500M", timeline: "4-6 years", status: "upcoming" },
    { id: "yn-3", title: "Arctic Shipping & Logistics", titleZh: "北极航运和物流", titleRu: "Арктическое судоходство и логистика", sector: "Logistics", description: "Ice-class tanker operations and port services.", descriptionZh: "冰级油轮运营和港口服务。", descriptionRu: "Операции ледового класса танкеров и портовые услуги.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Gas Capital", description: "80% of Russian natural gas production." }], contactInfo: { investmentAgency: "Yamal Development Corporation", website: "https://investyamal.ru" } },
  "Republic of Dagestan": { name: "Republic of Dagestan", nameZh: "达吉斯坦共和国", nameRu: "Республика Дагестан", gdp: "$12 Billion", population: "3.1 Million", sezCount: 1, industries: ["Agriculture", "Oil & Gas", "Tourism", "Manufacturing"], taxBenefits: ["North Caucasus incentives", "SEZ benefits"], majorCities: [
    { id: "makhachkala", name: "Makhachkala", population: "0.6M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Capital on the Caspian Sea. Major port for Caspian trade.", opportunities: [
      { id: "mak-1", title: "Caspian Port Development", titleZh: "里海港口开发", titleRu: "Развитие каспийского порта", sector: "Port", description: "Port infrastructure for North-South Transport Corridor.", descriptionZh: "南北运输走廊的港口基础设施。", descriptionRu: "Портовая инфраструктура для международного транспортного коридора Север-Юг.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "priority" },
      { id: "mak-2", title: "Dagestan Agriculture Hub", titleZh: "达吉斯坦农业中心", titleRu: "Дагестанский агрохаб", sector: "Agriculture", description: "Fruit, vegetable, and wine production for Russian and export markets.", descriptionZh: "面向俄罗斯和出口市场的水果、蔬菜和葡萄酒生产。", descriptionRu: "Производство фруктов, овощей и вина для российского и экспортного рынков.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Southernmost region of Russia on the Caspian Sea. Key node on North-South Transport Corridor (Russia-Iran-India). Growing tourism and agricultural potential.", targetSectors: ["Port & Logistics", "Agriculture", "Tourism", "Manufacturing"], opportunities: [
    { id: "dg-1", title: "North-South Corridor Hub", titleZh: "南北走廊枢纽", titleRu: "Хаб коридора Север-Юг", sector: "Logistics", description: "Transit hub for Russia-Iran-India trade corridor.", descriptionZh: "俄罗斯-伊朗-印度贸易走廊的中转枢纽。", descriptionRu: "Транзитный хаб торгового коридора Россия-Иран-Индия.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "dg-2", title: "Caspian Sea Tourism", titleZh: "里海旅游", titleRu: "Каспийский туризм", sector: "Tourism", description: "Beach resorts and cultural tourism development.", descriptionZh: "海滩度假村和文化旅游开发。", descriptionRu: "Развитие пляжных курортов и культурного туризма.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caspian Gateway", description: "Key port on North-South corridor." }], contactInfo: { investmentAgency: "Dagestan Investment Agency", website: "https://investdagestan.ru" } },
  "Tula Oblast": { name: "Tula Oblast", nameZh: "图拉州", nameRu: "Тульская область", gdp: "$14 Billion", population: "1.5 Million", sezCount: 2, industries: ["Chemicals", "Machinery", "Food", "Defense"], taxBenefits: ["SEZ benefits", "Manufacturing incentives"], majorCities: [
    { id: "tula-city", name: "Tula", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Historic arms manufacturing center. Now diversifying into chemicals and food.", opportunities: [
      { id: "tul-1", title: "Tula Chemical Complex", titleZh: "图拉化工综合体", titleRu: "Тульский химический комплекс", sector: "Chemicals", description: "Fertilizer and specialty chemical production.", descriptionZh: "化肥和特种化学品生产。", descriptionRu: "Производство удобрений и специализированных химикатов.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" },
      { id: "tul-2", title: "Central Russia Food Hub", titleZh: "俄罗斯中部食品中心", titleRu: "Продовольственный хаб Центральной России", sector: "Food", description: "Food processing for Moscow metropolitan market.", descriptionZh: "面向莫斯科都市圈的食品加工。", descriptionRu: "Пищевая переработка для московского столичного рынка.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "priority" }
    ]}
  ], overview: "Industrial region south of Moscow. Strong chemicals and food processing industries. Strategic location for Moscow market access.", targetSectors: ["Chemicals", "Food Processing", "Manufacturing", "Logistics"], opportunities: [
    { id: "tu-1", title: "Haval Auto Plant Expansion", titleZh: "哈弗汽车厂扩建", titleRu: "Расширение завода Haval", sector: "Automotive", description: "Chinese Great Wall Motors (Haval) plant expansion.", descriptionZh: "中国长城汽车（哈弗）工厂扩建。", descriptionRu: "Расширение завода китайской компании Great Wall Motors (Haval).", investmentRange: "$50M - $400M", timeline: "2-4 years", status: "priority" },
    { id: "tu-2", title: "Tula Agro-Processing Zone", titleZh: "图拉农产品加工区", titleRu: "Тульская агропромышленная зона", sector: "Food", description: "Food processing cluster for central Russia.", descriptionZh: "俄罗斯中部食品加工集群。", descriptionRu: "Кластер пищевой переработки для центральной России.", investmentRange: "$20M - $150M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Moscow Proximity", description: "2 hours from Moscow - easy market access." }], contactInfo: { investmentAgency: "Tula Development Corporation", website: "https://investtula.ru" } },
  "Belgorod Oblast": { name: "Belgorod Oblast", nameZh: "别尔哥罗德州", nameRu: "Белгородская область", gdp: "$13 Billion", population: "1.5 Million", sezCount: 1, industries: ["Iron Ore", "Steel", "Agriculture", "Food"], taxBenefits: ["Mining incentives", "Agricultural support"], majorCities: [
    { id: "belgorod-city", name: "Belgorod", population: "0.4M", image: "https://images.unsplash.com/photo-1598881034666-c6e2b35d07fa?w=1920&q=80", description: "Center of Russia's iron ore belt. Major steel and agricultural region.", opportunities: [
      { id: "blg-1", title: "Iron Ore Mining Partnership", titleZh: "铁矿石开采合作", titleRu: "Партнёрство по добыче железной руды", sector: "Mining", description: "Partnership with Metalloinvest - Russia's largest iron ore producer.", descriptionZh: "与俄罗斯最大铁矿石生产商Metalloinvest的合作。", descriptionRu: "Партнёрство с Металлоинвестом — крупнейшим производителем железной руды в России.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
      { id: "blg-2", title: "Belgorod Agro Complex", titleZh: "别尔哥罗德农业综合体", titleRu: "Белгородский агрокомплекс", sector: "Agriculture", description: "Pork and poultry production - Russia's leading region.", descriptionZh: "猪肉和家禽生产——俄罗斯领先地区。", descriptionRu: "Производство свинины и птицы — ведущий регион России.", investmentRange: "$20M - $150M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Center of Russia's iron ore mining industry. Home to Metalloinvest and major steel production. Also Russia's leading pork and poultry region.", targetSectors: ["Iron Ore Mining", "Steel", "Agriculture", "Food Processing"], opportunities: [
    { id: "bg-1", title: "Metalloinvest Partnership", titleZh: "Metalloinvest合作", titleRu: "Партнёрство с Металлоинвестом", sector: "Mining", description: "Iron ore and HBI production. World's largest merchant HBI producer.", descriptionZh: "铁矿石和热压块铁生产。全球最大的商品热压块铁生产商。", descriptionRu: "Производство железной руды и ГБЖ. Крупнейший в мире производитель товарного ГБЖ.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "bg-2", title: "Agro-Industrial Export Hub", titleZh: "农工出口中心", titleRu: "Агропромышленный экспортный хаб", sector: "Agriculture", description: "Meat processing and export to China and Asia.", descriptionZh: "肉类加工和出口至中国和亚洲。", descriptionRu: "Переработка и экспорт мяса в Китай и Азию.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Iron Ore Belt", description: "Russia's richest iron ore deposits." }], contactInfo: { investmentAgency: "Belgorod Investment Agency", website: "https://investbelgorod.ru" } },
  "Khanty-Mansi Autonomous Okrug": { name: "Khanty-Mansi Autonomous Okrug", nameZh: "汉特-曼西自治区", nameRu: "Ханты-Мансийский автономный округ", gdp: "$95 Billion", population: "1.7 Million", sezCount: 2, industries: ["Oil & Gas", "Energy", "Petrochemicals"], taxBenefits: ["Oil industry incentives", "Northern benefits"], majorCities: [
    { id: "surgut", name: "Surgut", population: "0.4M", image: "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=1920&q=80", description: "Oil capital of Russia. Headquarters of Surgutneftegas.", opportunities: [
      { id: "sur-1", title: "Surgutneftegas Partnership", titleZh: "苏尔古特石油天然气合作", titleRu: "Партнёрство с Сургутнефтегазом", sector: "Oil", description: "Partnership with Russia's 4th largest oil company.", descriptionZh: "与俄罗斯第四大石油公司的合作。", descriptionRu: "Партнёрство с 4-й крупнейшей нефтяной компанией России.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "sur-2", title: "Siberian Oil Services", titleZh: "西伯利亚石油服务", titleRu: "Сибирские нефтесервисные услуги", sector: "Oil Services", description: "Oilfield services and equipment.", descriptionZh: "油田服务和设备。", descriptionRu: "Нефтесервисные услуги и оборудование.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's oil heartland producing 50% of Russian oil. Home to Surgutneftegas, Rosneft, and Lukoil operations. Highest per-capita GDP in Russia.", targetSectors: ["Oil Production", "Oil Services", "Petrochemicals", "Energy"], opportunities: [
    { id: "khm-1", title: "West Siberian Oil Partnership", titleZh: "西西伯利亚石油合作", titleRu: "Западносибирское нефтяное партнёрство", sector: "Oil", description: "50% of Russia's oil production. Multiple partnership opportunities.", descriptionZh: "俄罗斯50%的石油产量。多种合作机会。", descriptionRu: "50% нефтедобычи России. Множество возможностей для партнёрства.", investmentRange: "$100M - $1B", timeline: "3-5 years", status: "priority" },
    { id: "khm-2", title: "Yugra Digital Oilfield", titleZh: "尤格拉数字油田", titleRu: "Цифровое месторождение Югры", sector: "Technology", description: "Digital transformation of oil operations.", descriptionZh: "石油作业的数字化转型。", descriptionRu: "Цифровая трансформация нефтяных операций.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Oil Capital", description: "50% of Russian oil production." }], contactInfo: { investmentAgency: "Yugra Investment Agency", website: "https://investugra.ru" } },
  "Stavropol Krai": { name: "Stavropol Krai", nameZh: "斯塔夫罗波尔边疆区", nameRu: "Ставропольский край", gdp: "$15 Billion", population: "2.8 Million", sezCount: 1, industries: ["Agriculture", "Tourism", "Chemicals"], taxBenefits: ["Agricultural subsidies", "Spa tourism incentives"], majorCities: [
    { id: "stavropol", name: "Stavropol", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Agricultural center of southern Russia. Gateway to Caucasus spa resorts.", opportunities: [
      { id: "stv-1", title: "Stavropol Agro Complex", titleZh: "斯塔夫罗波尔农业综合体", titleRu: "Ставропольский агрокомплекс", sector: "Agriculture", description: "Grain and livestock production for export.", descriptionZh: "出口用粮食和畜牧生产。", descriptionRu: "Производство зерна и животноводство на экспорт.", investmentRange: "$15M - $150M", timeline: "2-4 years", status: "active" },
      { id: "stv-2", title: "Caucasus Mineral Water Resorts", titleZh: "高加索矿泉水度假村", titleRu: "Курорты Кавказских Минеральных Вод", sector: "Tourism", description: "Spa and wellness tourism development.", descriptionZh: "水疗和健康旅游开发。", descriptionRu: "Развитие спа и оздоровительного туризма.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" }
    ]}
  ], overview: "Major agricultural region and home to famous Caucasus Mineral Waters spa resorts. Growing tourism industry.", targetSectors: ["Agriculture", "Spa Tourism", "Food Processing", "Chemicals"], opportunities: [
    { id: "sk-1", title: "Caucasus Mineral Waters Development", titleZh: "高加索矿泉水开发", titleRu: "Развитие Кавказских Минеральных Вод", sector: "Tourism", description: "Historic spa resort region modernization.", descriptionZh: "历史悠久的温泉度假区现代化。", descriptionRu: "Модернизация исторического курортного региона.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "priority" },
    { id: "sk-2", title: "Stavropol Grain Export Hub", titleZh: "斯塔夫罗波尔粮食出口中心", titleRu: "Ставропольский зерновой экспортный хаб", sector: "Agriculture", description: "Grain processing and export to Middle East and Asia.", descriptionZh: "面向中东和亚洲的粮食加工和出口。", descriptionRu: "Переработка и экспорт зерна на Ближний Восток и в Азию.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Spa Capital", description: "Famous Caucasus Mineral Waters resorts." }], contactInfo: { investmentAgency: "Stavropol Investment Agency", website: "https://investstavropol.ru" } },
  "Orenburg Oblast": { name: "Orenburg Oblast", nameZh: "奥伦堡州", nameRu: "Оренбургская область", gdp: "$20 Billion", population: "2.0 Million", sezCount: 1, industries: ["Oil & Gas", "Metals", "Agriculture", "Machinery"], taxBenefits: ["SEZ benefits", "Gas industry incentives"], majorCities: [
    { id: "orenburg", name: "Orenburg", population: "0.6M", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80", description: "Major gas processing center on Kazakhstan border. Historic Silk Road city.", opportunities: [
      { id: "orb-1", title: "Orenburg Gas Processing", titleZh: "奥伦堡天然气加工", titleRu: "Оренбургская газопереработка", sector: "Gas", description: "One of Russia's largest gas processing plants.", descriptionZh: "俄罗斯最大的天然气加工厂之一。", descriptionRu: "Один из крупнейших газоперерабатывающих заводов России.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
      { id: "orb-2", title: "Kazakhstan Border Trade", titleZh: "哈萨克斯坦边境贸易", titleRu: "Казахстанская приграничная торговля", sector: "Trade", description: "Cross-border trade and logistics hub.", descriptionZh: "跨境贸易和物流中心。", descriptionRu: "Хаб трансграничной торговли и логистики.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Major gas processing and metals region on Kazakhstan border. Strategic position on historic Silk Road route.", targetSectors: ["Gas Processing", "Metals", "Agriculture", "Cross-border Trade"], opportunities: [
    { id: "ob-1", title: "Orenburg Gas Complex Expansion", titleZh: "奥伦堡天然气综合体扩建", titleRu: "Расширение Оренбургского газового комплекса", sector: "Gas", description: "Expansion of major gas processing facility.", descriptionZh: "主要天然气加工设施的扩建。", descriptionRu: "Расширение крупного газоперерабатывающего объекта.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "priority" },
    { id: "ob-2", title: "Silk Road Logistics Hub", titleZh: "丝绸之路物流中心", titleRu: "Логистический хаб Шёлкового пути", sector: "Logistics", description: "Trade corridor to Kazakhstan and Central Asia.", descriptionZh: "通往哈萨克斯坦和中亚的贸易走廊。", descriptionRu: "Торговый коридор в Казахстан и Центральную Азию.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Gateway to Asia", description: "Strategic position on Kazakhstan border." }], contactInfo: { investmentAgency: "Orenburg Investment Agency", website: "https://investorenburg.ru" } },
  "Saratov Oblast": { name: "Saratov Oblast", nameZh: "萨拉托夫州", nameRu: "Саратовская область", gdp: "$14 Billion", population: "2.4 Million", sezCount: 1, industries: ["Aviation", "Chemicals", "Agriculture", "Energy"], taxBenefits: ["SEZ tax incentives", "Aviation support"], majorCities: [
    { id: "saratov", name: "Saratov", population: "0.8M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Major Volga city with aviation and chemical industries. Yuri Gagarin's hometown.", opportunities: [
      { id: "sar-1", title: "Saratov Aviation Plant Partnership", titleZh: "萨拉托夫航空工厂合作", titleRu: "Партнёрство с Саратовским авиазаводом", sector: "Aviation", description: "Aircraft component manufacturing.", descriptionZh: "飞机部件制造。", descriptionRu: "Производство авиационных компонентов.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" },
      { id: "sar-2", title: "Volga Chemical Complex", titleZh: "伏尔加化工综合体", titleRu: "Волжский химический комплекс", sector: "Chemicals", description: "Chemical and petrochemical production.", descriptionZh: "化学和石化生产。", descriptionRu: "Химическое и нефтехимическое производство.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Major industrial center on the Volga. Aviation, chemical, and agricultural industries. Historic city with strong education sector.", targetSectors: ["Aviation", "Chemicals", "Agriculture", "Education"], opportunities: [
    { id: "sr-1", title: "Saratov Aviation Cluster", titleZh: "萨拉托夫航空产业集群", titleRu: "Саратовский авиационный кластер", sector: "Aviation", description: "Aircraft and helicopter component production.", descriptionZh: "飞机和直升机部件生产。", descriptionRu: "Производство компонентов самолётов и вертолётов.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
    { id: "sr-2", title: "Volga Agro-Processing", titleZh: "伏尔加农产品加工", titleRu: "Волжская агропереработка", sector: "Agriculture", description: "Grain and sunflower processing for export.", descriptionZh: "粮食和葵花籽加工出口。", descriptionRu: "Переработка зерна и подсолнечника на экспорт.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Aviation Hub", description: "Historic aircraft manufacturing center." }], contactInfo: { investmentAgency: "Saratov Investment Agency", website: "https://investsaratov.ru" } },
  "Kamchatka Krai": { name: "Kamchatka Krai", nameZh: "堪察加边疆区", nameRu: "Камчатский край", gdp: "$5 Billion", population: "0.3 Million", sezCount: 1, industries: ["Fishing", "Mining", "Tourism", "Geothermal"], taxBenefits: ["Far East benefits", "Fishing incentives", "Tourism support"], majorCities: [
    { id: "petropavlovsk", name: "Petropavlovsk-Kamchatsky", population: "0.2M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Remote Pacific port surrounded by volcanoes. Premium fishing and adventure tourism.", opportunities: [
      { id: "pet-1", title: "Kamchatka Premium Seafood", titleZh: "堪察加优质海产品", titleRu: "Камчатские премиальные морепродукты", sector: "Fishing", description: "Premium crab, salmon, and pollock for China market.", descriptionZh: "面向中国市场的优质蟹、三文鱼和鳕鱼。", descriptionRu: "Премиальный краб, лосось и минтай для китайского рынка.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
      { id: "pet-2", title: "Volcano Adventure Tourism", titleZh: "火山探险旅游", titleRu: "Вулканический приключенческий туризм", sector: "Tourism", description: "Eco-tourism and adventure travel.", descriptionZh: "生态旅游和探险旅行。", descriptionRu: "Экотуризм и приключенческие путешествия.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Remote volcanic peninsula with pristine nature. World-class fishing (10% of Russia's catch) and growing eco-tourism. Geothermal energy potential.", targetSectors: ["Fishing", "Eco-Tourism", "Geothermal Energy", "Mining"], opportunities: [
    { id: "km-1", title: "Kamchatka Seafood Export Hub", titleZh: "堪察加海产品出口中心", titleRu: "Камчатский хаб экспорта морепродуктов", sector: "Fishing", description: "Premium seafood processing for Asian markets. 10% of Russia's fish catch.", descriptionZh: "面向亚洲市场的优质海产品加工。占俄罗斯鱼获量的10%。", descriptionRu: "Переработка премиальных морепродуктов для азиатских рынков. 10% улова России.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "priority" },
    { id: "km-2", title: "Geothermal Energy Development", titleZh: "地热能源开发", titleRu: "Развитие геотермальной энергетики", sector: "Energy", description: "Clean geothermal power from volcanic activity.", descriptionZh: "来自火山活动的清洁地热能。", descriptionRu: "Чистая геотермальная энергия от вулканической активности.", investmentRange: "$40M - $300M", timeline: "4-6 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Pristine Nature", description: "UNESCO World Heritage volcanic landscapes." }], contactInfo: { investmentAgency: "Kamchatka Investment Agency", website: "https://investkamchatka.ru" } },
  "Astrakhan Oblast": { name: "Astrakhan Oblast", nameZh: "阿斯特拉罕州", nameRu: "Астраханская область", gdp: "$10 Billion", population: "1.0 Million", sezCount: 2, industries: ["Oil & Gas", "Shipping", "Fishing", "Agriculture"], taxBenefits: ["SEZ benefits", "Caspian shipping incentives"], majorCities: [
    { id: "astrakhan", name: "Astrakhan", population: "0.5M", image: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=1920&q=80", description: "Caspian Sea port at Volga delta. Historic caviar capital and oil/gas hub.", opportunities: [
      { id: "ast-1", title: "Caspian Shipbuilding Hub", titleZh: "里海造船中心", titleRu: "Каспийский судостроительный хаб", sector: "Shipbuilding", description: "Shipbuilding for Caspian oil and gas operations.", descriptionZh: "里海油气作业的造船。", descriptionRu: "Судостроение для каспийских нефтегазовых операций.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
      { id: "ast-2", title: "North-South Corridor Port", titleZh: "南北走廊港口", titleRu: "Порт коридора Север-Юг", sector: "Logistics", description: "Key port on India-Russia trade corridor.", descriptionZh: "印度-俄罗斯贸易走廊上的关键港口。", descriptionRu: "Ключевой порт торгового коридора Индия-Россия.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" }
    ]}
  ], overview: "Strategic Caspian port at Volga delta. Key node on North-South corridor to Iran and India. Oil/gas, shipbuilding, and premium caviar.", targetSectors: ["Port & Logistics", "Oil & Gas", "Shipbuilding", "Aquaculture"], opportunities: [
    { id: "as-1", title: "North-South Corridor Hub", titleZh: "南北走廊枢纽", titleRu: "Хаб коридора Север-Юг", sector: "Logistics", description: "Strategic port for Russia-Iran-India trade route.", descriptionZh: "俄罗斯-伊朗-印度贸易路线的战略港口。", descriptionRu: "Стратегический порт для торгового маршрута Россия-Иран-Индия.", investmentRange: "$50M - $400M", timeline: "3-5 years", status: "priority" },
    { id: "as-2", title: "Caspian Oil & Gas Services", titleZh: "里海油气服务", titleRu: "Каспийские нефтегазовые услуги", sector: "Energy", description: "Support services for Caspian offshore operations.", descriptionZh: "里海海上作业的支持服务。", descriptionRu: "Сервисные услуги для каспийских шельфовых операций.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caspian Gateway", description: "Key port on North-South corridor." }], contactInfo: { investmentAgency: "Astrakhan Investment Agency", website: "https://investastrakhan.ru" } },
  "Altai Krai": { name: "Altai Krai", nameZh: "阿尔泰边疆区", nameRu: "Алтайский край", gdp: "$10 Billion", population: "2.3 Million", sezCount: 1, industries: ["Agriculture", "Food Processing", "Tourism", "Machinery"], taxBenefits: ["Agricultural incentives", "Tourism development support"], majorCities: [
    { id: "barnaul", name: "Barnaul", population: "0.6M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Siberian agricultural capital. Gateway to scenic Altai Mountains.", opportunities: [
      { id: "brn-1", title: "Altai Grain Processing", titleZh: "阿尔泰粮食加工", titleRu: "Алтайская зернопереработка", sector: "Agriculture", description: "Major grain and flour production region.", descriptionZh: "主要粮食和面粉生产地区。", descriptionRu: "Крупный регион производства зерна и муки.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" },
      { id: "brn-2", title: "Altai Health Tourism", titleZh: "阿尔泰健康旅游", titleRu: "Алтайский оздоровительный туризм", sector: "Tourism", description: "Mountain resorts and traditional medicine tourism.", descriptionZh: "山地度假村和传统医疗旅游。", descriptionRu: "Горные курорты и туризм традиционной медицины.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's breadbasket - major grain and dairy region. Gateway to spectacular Altai Mountains. Growing eco-tourism and health tourism.", targetSectors: ["Agriculture", "Food Processing", "Eco-Tourism", "Machinery"], opportunities: [
    { id: "ak-1", title: "Altai Agricultural Export Hub", titleZh: "阿尔泰农业出口中心", titleRu: "Алтайский сельскохозяйственный экспортный хаб", sector: "Agriculture", description: "Grain, dairy, and honey production for export to China.", descriptionZh: "出口中国的粮食、乳制品和蜂蜜生产。", descriptionRu: "Производство зерна, молочной продукции и мёда на экспорт в Китай.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "ak-2", title: "Altai Mountain Tourism", titleZh: "阿尔泰山旅游", titleRu: "Алтайский горный туризм", sector: "Tourism", description: "Eco-tourism and adventure travel in UNESCO heritage region.", descriptionZh: "联合国教科文组织遗产地区的生态旅游和探险旅行。", descriptionRu: "Экотуризм и приключенческие путешествия в регионе наследия ЮНЕСКО.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Breadbasket", description: "Russia's major grain and dairy region." }], contactInfo: { investmentAgency: "Altai Krai Investment Agency", website: "https://investaltai.ru" } },
  "Amur Oblast": { name: "Amur Oblast", nameZh: "阿穆尔州", nameRu: "Амурская область", gdp: "$7 Billion", population: "0.8 Million", sezCount: 1, industries: ["Space", "Mining", "Agriculture", "Energy"], taxBenefits: ["Far East benefits", "Space industry incentives"], majorCities: [
    { id: "blagoveshchensk", name: "Blagoveshchensk", population: "0.2M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Border city directly across the Amur River from China's Heihe.", opportunities: [
      { id: "blg-1", title: "Amur Cross-Border Trade", titleZh: "阿穆尔跨境贸易", titleRu: "Амурская трансграничная торговля", sector: "Trade", description: "Direct trade with China's Heihe across the bridge.", descriptionZh: "通过大桥与中国黑河的直接贸易。", descriptionRu: "Прямая торговля с китайским Хэйхэ через мост.", investmentRange: "$10M - $100M", timeline: "1-3 years", status: "priority" },
      { id: "blg-2", title: "Vostochny Cosmodrome Services", titleZh: "东方航天发射场服务", titleRu: "Услуги космодрома Восточный", sector: "Space", description: "Support services for Russia's new spaceport.", descriptionZh: "俄罗斯新航天发射场的支持服务。", descriptionRu: "Сервисные услуги для нового российского космодрома.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Strategic Far East region directly bordering China. Home to Vostochny Cosmodrome (Russia's new spaceport). Direct bridge to China's Heihe.", targetSectors: ["Cross-border Trade", "Space Industry", "Agriculture", "Mining"], opportunities: [
    { id: "am-1", title: "Blagoveshchensk-Heihe Trade Zone", titleZh: "布拉戈维申斯克-黑河贸易区", titleRu: "Торговая зона Благовещенск-Хэйхэ", sector: "Trade", description: "Free trade zone on new China bridge. Direct border crossing.", descriptionZh: "新中国大桥上的自由贸易区。直接边境通道。", descriptionRu: "Зона свободной торговли на новом мосту в Китай. Прямой погранпереход.", investmentRange: "$20M - $200M", timeline: "2-3 years", status: "priority" },
    { id: "am-2", title: "Vostochny Cosmodrome Cluster", titleZh: "东方航天发射场产业集群", titleRu: "Кластер космодрома Восточный", sector: "Space", description: "Space technology and satellite services.", descriptionZh: "航天技术和卫星服务。", descriptionRu: "Космические технологии и спутниковые услуги.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "China Border", description: "Direct bridge to China's Heihe city." }], contactInfo: { investmentAgency: "Amur Development Corporation", website: "https://investamur.ru" } },
  "Zabaykalsky Krai": { name: "Zabaykalsky Krai", nameZh: "外贝加尔边疆区", nameRu: "Забайкальский край", gdp: "$6 Billion", population: "1.1 Million", sezCount: 1, industries: ["Mining", "Rail", "Agriculture"], taxBenefits: ["Far East benefits", "Mining incentives"], majorCities: [
    { id: "chita", name: "Chita", population: "0.3M", image: "https://images.unsplash.com/photo-1548625361-1c64bc0e3b74?w=1920&q=80", description: "Trans-Siberian railway hub near China and Mongolia borders.", opportunities: [
      { id: "chi-1", title: "Trans-Manchurian Logistics", titleZh: "中国东北铁路物流", titleRu: "Трансманьчжурская логистика", sector: "Logistics", description: "Rail logistics to China via Trans-Manchurian route.", descriptionZh: "通过中国东北铁路的铁路物流。", descriptionRu: "Железнодорожная логистика в Китай по Трансманьчжурскому маршруту.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
      { id: "chi-2", title: "Zabaykalsk Mining Development", titleZh: "外贝加尔采矿开发", titleRu: "Забайкальская горнодобыча", sector: "Mining", description: "Uranium, gold, and copper mining.", descriptionZh: "铀、金和铜矿开采。", descriptionRu: "Добыча урана, золота и меди.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Strategic Trans-Siberian rail hub bordering China and Mongolia. Rich mineral deposits including uranium, gold, and copper.", targetSectors: ["Rail Logistics", "Mining", "Cross-border Trade", "Agriculture"], opportunities: [
    { id: "zb-1", title: "China-Russia Rail Gateway", titleZh: "中俄铁路门户", titleRu: "Железнодорожные ворота Китай-Россия", sector: "Logistics", description: "Major rail border crossing to China at Zabaykalsk-Manzhouli.", descriptionZh: "在满洲里-后贝加尔斯克的主要铁路边境口岸。", descriptionRu: "Крупный железнодорожный погранпереход в Китай в Забайкальске-Маньчжурии.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "priority" },
    { id: "zb-2", title: "Udokan Copper Project", titleZh: "乌多坎铜矿项目", titleRu: "Удоканский медный проект", sector: "Mining", description: "One of world's largest undeveloped copper deposits.", descriptionZh: "世界上最大的未开发铜矿床之一。", descriptionRu: "Одно из крупнейших в мире неосвоенных месторождений меди.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Rail Gateway", description: "Trans-Siberian junction to China." }], contactInfo: { investmentAgency: "Zabaykalsky Investment Agency", website: "https://investzabaykalye.ru" } },
  "Tomsk Oblast": { name: "Tomsk Oblast", nameZh: "托木斯克州", nameRu: "Томская область", gdp: "$12 Billion", population: "1.1 Million", sezCount: 2, industries: ["Oil & Gas", "IT", "Education", "Pharmaceuticals"], taxBenefits: ["SEZ benefits", "Innovation incentives", "Education support"], majorCities: [
    { id: "tomsk", name: "Tomsk", population: "0.6M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Siberia's education capital. Six universities and growing tech sector.", opportunities: [
      { id: "tom-1", title: "Tomsk IT Cluster", titleZh: "托木斯克IT产业集群", titleRu: "Томский ИТ-кластер", sector: "IT", description: "Software development and tech startups.", descriptionZh: "软件开发和科技初创企业。", descriptionRu: "Разработка ПО и технологические стартапы.", investmentRange: "$10M - $80M", timeline: "1-3 years", status: "active" },
      { id: "tom-2", title: "Siberian Pharmaceuticals", titleZh: "西伯利亚制药", titleRu: "Сибирская фармацевтика", sector: "Pharma", description: "Pharmaceutical R&D and manufacturing.", descriptionZh: "制药研发和生产。", descriptionRu: "Фармацевтические НИОКР и производство.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Siberia's intellectual capital with 6 universities (100,000+ students). Strong IT, pharma, and innovation ecosystem. Oil and gas services.", targetSectors: ["IT & Software", "Pharmaceuticals", "Education", "Oil Services"], opportunities: [
    { id: "to-1", title: "Tomsk Innovation Hub", titleZh: "托木斯克创新中心", titleRu: "Томский инновационный хаб", sector: "Technology", description: "Tech transfer from universities to industry.", descriptionZh: "从大学到产业的技术转让。", descriptionRu: "Трансфер технологий из университетов в промышленность.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" },
    { id: "to-2", title: "Tomsk Pharma Cluster", titleZh: "托木斯克制药集群", titleRu: "Томский фармацевтический кластер", sector: "Pharma", description: "Pharmaceutical production for Russian and Asian markets.", descriptionZh: "面向俄罗斯和亚洲市场的制药生产。", descriptionRu: "Фармацевтическое производство для российского и азиатского рынков.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Education Capital", description: "6 universities, 100,000+ students." }], contactInfo: { investmentAgency: "Tomsk Investment Agency", website: "https://investtomsk.ru" } },
  "Udmurt Republic": { name: "Udmurt Republic", nameZh: "乌德穆尔特共和国", nameRu: "Удмуртская Республика", gdp: "$12 Billion", population: "1.5 Million", sezCount: 1, industries: ["Arms Manufacturing", "Automotive", "Oil", "Machinery"], taxBenefits: ["Manufacturing incentives", "Defense conversion support"], majorCities: [
    { id: "izhevsk", name: "Izhevsk", population: "0.6M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Arms manufacturing capital. Home of Kalashnikov. Also automotive and electronics.", opportunities: [
      { id: "izh-1", title: "Kalashnikov Civilian Products", titleZh: "卡拉什尼科夫民用产品", titleRu: "Гражданская продукция Калашникова", sector: "Manufacturing", description: "Civilian applications of defense technology.", descriptionZh: "国防技术的民用化应用。", descriptionRu: "Гражданское применение оборонных технологий.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "izh-2", title: "Lada Izhevsk Partnership", titleZh: "伊热夫斯克拉达合作", titleRu: "Партнёрство с Лада Ижевск", sector: "Automotive", description: "Automotive manufacturing and components.", descriptionZh: "汽车制造和零部件。", descriptionRu: "Автомобилестроение и производство комплектующих.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's arms manufacturing capital (Kalashnikov, Izhmash). Also major automotive production (Lada). Oil production in the region.", targetSectors: ["Defense Conversion", "Automotive", "Oil Production", "Electronics"], opportunities: [
    { id: "ud-1", title: "Kalashnikov Concern Partnership", titleZh: "卡拉什尼科夫集团合作", titleRu: "Партнёрство с Концерном Калашников", sector: "Manufacturing", description: "Civilian products and technology transfer.", descriptionZh: "民用产品和技术转让。", descriptionRu: "Гражданская продукция и трансфер технологий.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" },
    { id: "ud-2", title: "Izhevsk Automotive Cluster", titleZh: "伊热夫斯克汽车产业集群", titleRu: "Ижевский автомобильный кластер", sector: "Automotive", description: "Vehicle and component manufacturing.", descriptionZh: "汽车和零部件制造。", descriptionRu: "Производство автомобилей и комплектующих.", investmentRange: "$30M - $250M", timeline: "2-4 years", status: "priority" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Manufacturing Hub", description: "Kalashnikov and Lada production." }], contactInfo: { investmentAgency: "Udmurtia Investment Agency", website: "https://investudmurtia.ru" } },
  "Chuvash Republic": { name: "Chuvash Republic", nameZh: "楚瓦什共和国", nameRu: "Чувашская Республика", gdp: "$7 Billion", population: "1.2 Million", sezCount: 1, industries: ["Electrical Equipment", "Machinery", "Agriculture", "Textiles"], taxBenefits: ["Manufacturing incentives", "SME support"], majorCities: [
    { id: "cheboksary", name: "Cheboksary", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Volga industrial city. Major electrical equipment and tractor manufacturing.", opportunities: [
      { id: "chb-1", title: "Cheboksary Electrical Equipment", titleZh: "切博克萨雷电气设备", titleRu: "Чебоксарское электрооборудование", sector: "Electrical", description: "Electrical machinery and equipment manufacturing.", descriptionZh: "电气机械和设备制造。", descriptionRu: "Производство электрических машин и оборудования.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "chb-2", title: "Chuvash Tractor Works", titleZh: "楚瓦什拖拉机厂", titleRu: "Чувашский тракторный завод", sector: "Machinery", description: "Agricultural and industrial tractors.", descriptionZh: "农业和工业拖拉机。", descriptionRu: "Сельскохозяйственные и промышленные тракторы.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Industrial center on the Volga. Major producer of electrical equipment, tractors, and textiles. Strong agricultural sector.", targetSectors: ["Electrical Equipment", "Machinery", "Agriculture", "Textiles"], opportunities: [
    { id: "cv-1", title: "Chuvash Electrical Cluster", titleZh: "楚瓦什电气产业集群", titleRu: "Чувашский электротехнический кластер", sector: "Electrical", description: "Electrical equipment for Russian and export markets.", descriptionZh: "面向俄罗斯和出口市场的电气设备。", descriptionRu: "Электрооборудование для российского и экспортного рынков.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "cv-2", title: "Volga Agricultural Processing", titleZh: "伏尔加农产品加工", titleRu: "Волжская сельхозпереработка", sector: "Agriculture", description: "Hop and grain processing.", descriptionZh: "啤酒花和粮食加工。", descriptionRu: "Переработка хмеля и зерна.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Electrical Hub", description: "Major electrical equipment producer." }], contactInfo: { investmentAgency: "Chuvashia Investment Agency", website: "https://investchuvashia.ru" } },
  "Republic of Mordovia": { name: "Republic of Mordovia", nameZh: "莫尔多瓦共和国", nameRu: "Республика Мордовия", gdp: "$6 Billion", population: "0.8 Million", sezCount: 1, industries: ["Electronics", "Lighting", "Cables", "Agriculture"], taxBenefits: ["SEZ benefits", "Electronics incentives"], majorCities: [
    { id: "saransk", name: "Saransk", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Electronics and lighting manufacturing center. 2018 FIFA World Cup host city.", opportunities: [
      { id: "srn-1", title: "Saransk Electronics Hub", titleZh: "萨兰斯克电子中心", titleRu: "Саранский электронный хаб", sector: "Electronics", description: "Electronics and semiconductor production.", descriptionZh: "电子和半导体生产。", descriptionRu: "Производство электроники и полупроводников.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "srn-2", title: "Russian Lighting Industry", titleZh: "俄罗斯照明产业", titleRu: "Российская светотехническая промышленность", sector: "Lighting", description: "LED and specialty lighting production.", descriptionZh: "LED和特种照明生产。", descriptionRu: "Производство светодиодного и специального освещения.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russian electronics and lighting manufacturing center. Strong cable and wire production. Modern sports infrastructure from FIFA 2018.", targetSectors: ["Electronics", "Lighting", "Cable Production", "Agriculture"], opportunities: [
    { id: "mo-1", title: "Mordovia Electronics Cluster", titleZh: "莫尔多瓦电子产业集群", titleRu: "Мордовский электронный кластер", sector: "Electronics", description: "Electronics manufacturing and R&D.", descriptionZh: "电子制造和研发。", descriptionRu: "Производство электроники и НИОКР.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" },
    { id: "mo-2", title: "Russian Optical Fiber", titleZh: "俄罗斯光纤", titleRu: "Российское оптоволокно", sector: "Telecom", description: "Fiber optic cable production.", descriptionZh: "光纤电缆生产。", descriptionRu: "Производство волоконно-оптического кабеля.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Electronics Center", description: "Russia's lighting and electronics hub." }], contactInfo: { investmentAgency: "Mordovia Investment Agency", website: "https://investmordovia.ru" } },
  "Republic of Buryatia": { name: "Republic of Buryatia", nameZh: "布里亚特共和国", nameRu: "Республика Бурятия", gdp: "$6 Billion", population: "1.0 Million", sezCount: 1, industries: ["Tourism", "Mining", "Aviation", "Agriculture"], taxBenefits: ["Far East benefits", "Tourism incentives", "Baikal protection support"], majorCities: [
    { id: "ulan-ude", name: "Ulan-Ude", population: "0.4M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Buddhist cultural center on Lake Baikal. Aviation manufacturing and tourism gateway.", opportunities: [
      { id: "uud-1", title: "Lake Baikal Eco-Tourism", titleZh: "贝加尔湖生态旅游", titleRu: "Байкальский экотуризм", sector: "Tourism", description: "Sustainable tourism on UNESCO World Heritage lake.", descriptionZh: "联合国教科文组织世界遗产湖泊的可持续旅游。", descriptionRu: "Устойчивый туризм на озере — объекте Всемирного наследия ЮНЕСКО.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "priority" },
      { id: "uud-2", title: "Ulan-Ude Aviation Plant", titleZh: "乌兰乌德航空工厂", titleRu: "Улан-Удэнский авиазавод", sector: "Aviation", description: "Helicopter manufacturing and maintenance.", descriptionZh: "直升机制造和维护。", descriptionRu: "Производство и обслуживание вертолётов.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Gateway to Lake Baikal - world's deepest lake and UNESCO site. Unique Buddhist culture. Helicopter manufacturing and mining.", targetSectors: ["Eco-Tourism", "Aviation", "Mining", "Agriculture"], opportunities: [
    { id: "br-1", title: "Baikal Tourism Development", titleZh: "贝加尔湖旅游开发", titleRu: "Развитие байкальского туризма", sector: "Tourism", description: "Eco-tourism infrastructure for Chinese tourists.", descriptionZh: "面向中国游客的生态旅游基础设施。", descriptionRu: "Экотуристическая инфраструктура для китайских туристов.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "br-2", title: "Buryatia Mineral Development", titleZh: "布里亚特矿产开发", titleRu: "Развитие минеральных ресурсов Бурятии", sector: "Mining", description: "Gold, uranium, and rare earth mining.", descriptionZh: "金、铀和稀土开采。", descriptionRu: "Добыча золота, урана и редкоземельных металлов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Baikal Gateway", description: "World's deepest lake - UNESCO site." }], contactInfo: { investmentAgency: "Buryatia Investment Agency", website: "https://investburyatia.ru" } },
  "Republic of Crimea": { name: "Republic of Crimea", nameZh: "克里米亚共和国", nameRu: "Республика Крым", gdp: "$5 Billion", population: "1.9 Million", sezCount: 1, industries: ["Tourism", "Agriculture", "Shipbuilding", "Wine"], taxBenefits: ["Free economic zone", "Tourism support", "Agriculture incentives"], majorCities: [
    { id: "simferopol", name: "Simferopol", population: "0.3M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Capital and transportation hub. Gateway to Crimean resorts.", opportunities: [
      { id: "sim-1", title: "Crimean Wine Industry", titleZh: "克里米亚葡萄酒产业", titleRu: "Крымское виноделие", sector: "Wine", description: "Premium wine production with historic tradition.", descriptionZh: "具有悠久传统的优质葡萄酒生产。", descriptionRu: "Премиальное виноделие с исторической традицией.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" },
      { id: "sim-2", title: "Crimean Agriculture Hub", titleZh: "克里米亚农业中心", titleRu: "Крымский агрохаб", sector: "Agriculture", description: "Fruit, vegetable, and grain production.", descriptionZh: "水果、蔬菜和粮食生产。", descriptionRu: "Производство фруктов, овощей и зерна.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Black Sea peninsula with rich tourism potential and agricultural land. Historic wine region. Free economic zone with significant tax benefits.", targetSectors: ["Tourism", "Wine Industry", "Agriculture", "Shipbuilding"], opportunities: [
    { id: "cr-1", title: "Crimean Resort Development", titleZh: "克里米亚度假村开发", titleRu: "Развитие крымских курортов", sector: "Tourism", description: "Beach and spa resort development.", descriptionZh: "海滩和温泉度假村开发。", descriptionRu: "Развитие пляжных и спа-курортов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
    { id: "cr-2", title: "Crimean Wine Export", titleZh: "克里米亚葡萄酒出口", titleRu: "Экспорт крымского вина", sector: "Wine", description: "Wine production and export to Asia.", descriptionZh: "葡萄酒生产和出口至亚洲。", descriptionRu: "Производство и экспорт вина в Азию.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Black Sea Resort", description: "Historic resort region with FEZ benefits." }], contactInfo: { investmentAgency: "Crimea Investment Agency", website: "https://investcrimea.ru" } },
  "Kaluga Oblast": { name: "Kaluga Oblast", nameZh: "卡卢加州", nameRu: "Калужская область", gdp: "$15 Billion", population: "1.0 Million", sezCount: 3, industries: ["Automotive", "Pharmaceuticals", "Logistics", "IT"], taxBenefits: ["SEZ tax holidays", "Automotive cluster benefits"], majorCities: [
    { id: "kaluga", name: "Kaluga", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Russia's automotive capital with VW, Volvo, and other plants nearby.", opportunities: [
      { id: "klg-1", title: "Kaluga Automotive Cluster", titleZh: "卡卢加汽车产业集群", titleRu: "Калужский автомобильный кластер", sector: "Automotive", description: "Auto parts and component manufacturing for VW, Volvo plants.", descriptionZh: "为大众、沃尔沃工厂的汽车零部件制造。", descriptionRu: "Производство автокомплектующих для заводов VW, Volvo.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "klg-2", title: "Kaluga Pharma Park", titleZh: "卡卢加制药园区", titleRu: "Калужский фармапарк", sector: "Pharma", description: "Pharmaceutical manufacturing cluster.", descriptionZh: "制药生产集群。", descriptionRu: "Кластер фармацевтического производства.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's most successful automotive region with VW, Volvo, Peugeot-Citroen plants. Strong pharma and IT sectors. Model for regional development.", targetSectors: ["Automotive", "Pharmaceuticals", "IT", "Logistics"], opportunities: [
    { id: "ka-1", title: "Automotive Component Manufacturing", titleZh: "汽车零部件制造", titleRu: "Производство автокомпонентов", sector: "Automotive", description: "Supplier base for major auto manufacturers.", descriptionZh: "主要汽车制造商的供应商基地。", descriptionRu: "Поставщик для крупных автопроизводителей.", investmentRange: "$30M - $300M", timeline: "2-4 years", status: "priority" },
    { id: "ka-2", title: "Kaluga IT & Logistics Hub", titleZh: "卡卢加IT与物流中心", titleRu: "Калужский ИТ и логистический хаб", sector: "IT", description: "Data centers and e-commerce logistics.", descriptionZh: "数据中心和电商物流。", descriptionRu: "Дата-центры и логистика электронной коммерции.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Auto Capital", description: "Russia's leading automotive region." }], contactInfo: { investmentAgency: "Kaluga Development Corporation", website: "https://investkaluga.ru" } },
  "Yaroslavl Oblast": { name: "Yaroslavl Oblast", nameZh: "雅罗斯拉夫尔州", nameRu: "Ярославская область", gdp: "$12 Billion", population: "1.3 Million", sezCount: 1, industries: ["Petroleum Machinery", "Chemicals", "Tires", "Pharma"], taxBenefits: ["Industrial park incentives", "Machinery support"], majorCities: [
    { id: "yaroslavl", name: "Yaroslavl", population: "0.6M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Historic Golden Ring city. Major petroleum machinery and tire production.", opportunities: [
      { id: "yar-1", title: "Yaroslavl Engine Plant", titleZh: "雅罗斯拉夫尔发动机厂", titleRu: "Ярославский моторный завод", sector: "Machinery", description: "Diesel engine manufacturing.", descriptionZh: "柴油发动机制造。", descriptionRu: "Производство дизельных двигателей.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" },
      { id: "yar-2", title: "Cordiant Tire Partnership", titleZh: "科迪安特轮胎合作", titleRu: "Партнёрство с Кордиант", sector: "Automotive", description: "Tire manufacturing expansion.", descriptionZh: "轮胎制造扩张。", descriptionRu: "Расширение шинного производства.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Historic Golden Ring city with strong industrial base. Major petroleum equipment, tire, and pharmaceutical production.", targetSectors: ["Petroleum Equipment", "Tires", "Chemicals", "Pharmaceuticals"], opportunities: [
    { id: "ys-1", title: "Yaroslavl Petroleum Machinery", titleZh: "雅罗斯拉夫尔石油机械", titleRu: "Ярославское нефтяное машиностроение", sector: "Machinery", description: "Equipment for oil and gas industry.", descriptionZh: "石油和天然气行业设备。", descriptionRu: "Оборудование для нефтегазовой отрасли.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" },
    { id: "ys-2", title: "Golden Ring Tourism", titleZh: "金环旅游", titleRu: "Туризм Золотого кольца", sector: "Tourism", description: "UNESCO heritage tourism development.", descriptionZh: "联合国教科文组织遗产旅游开发。", descriptionRu: "Развитие туризма объектов наследия ЮНЕСКО.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Engine Capital", description: "Major diesel engine production." }], contactInfo: { investmentAgency: "Yaroslavl Investment Agency", website: "https://investyaroslavl.ru" } },
  "Tver Oblast": { name: "Tver Oblast", nameZh: "特维尔州", nameRu: "Тверская область", gdp: "$10 Billion", population: "1.3 Million", sezCount: 1, industries: ["Rail", "Glass", "Machinery", "Printing"], taxBenefits: ["Manufacturing incentives", "Transport equipment support"], majorCities: [
    { id: "tver", name: "Tver", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Rail manufacturing center between Moscow and St. Petersburg.", opportunities: [
      { id: "tvr-1", title: "Tver Rail Car Plant", titleZh: "特维尔客车厂", titleRu: "Тверской вагоностроительный завод", sector: "Rail", description: "Passenger rail car manufacturing.", descriptionZh: "客运车厢制造。", descriptionRu: "Производство пассажирских вагонов.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
      { id: "tvr-2", title: "Tver Glass Industry", titleZh: "特维尔玻璃产业", titleRu: "Тверская стекольная промышленность", sector: "Glass", description: "Industrial and specialty glass production.", descriptionZh: "工业和特种玻璃生产。", descriptionRu: "Производство промышленного и специального стекла.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Strategic location between Moscow and St. Petersburg. Major rail car manufacturing (TVZ). Historic city with growing logistics sector.", targetSectors: ["Rail Manufacturing", "Glass", "Logistics", "Printing"], opportunities: [
    { id: "tv-1", title: "TVZ Rail Manufacturing", titleZh: "特维尔铁路制造", titleRu: "Тверское вагоностроение", sector: "Rail", description: "Passenger and freight rail car production.", descriptionZh: "客运和货运车厢生产。", descriptionRu: "Производство пассажирских и грузовых вагонов.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "tv-2", title: "Moscow-St.Petersburg Corridor Logistics", titleZh: "莫斯科-圣彼得堡走廊物流", titleRu: "Логистика коридора Москва-Санкт-Петербург", sector: "Logistics", description: "Distribution centers on main transport corridor.", descriptionZh: "主要运输走廊上的配送中心。", descriptionRu: "Распределительные центры на главном транспортном коридоре.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Strategic Location", description: "Between Moscow and St. Petersburg." }], contactInfo: { investmentAgency: "Tver Investment Agency", website: "https://investtver.ru" } },
  "Vladimir Oblast": { name: "Vladimir Oblast", nameZh: "弗拉基米尔州", nameRu: "Владимирская область", gdp: "$8 Billion", population: "1.4 Million", sezCount: 1, industries: ["Glass", "Machinery", "Food", "Tourism"], taxBenefits: ["Manufacturing incentives", "Tourism support"], majorCities: [
    { id: "vladimir", name: "Vladimir", population: "0.4M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Ancient capital of Russia. Famous for crystal and glassware.", opportunities: [
      { id: "vla-1", title: "Gus-Khrustalny Crystal", titleZh: "古斯赫鲁斯塔利尼水晶", titleRu: "Гусевский хрусталь", sector: "Glass", description: "Famous Russian crystal and glassware.", descriptionZh: "著名的俄罗斯水晶和玻璃器皿。", descriptionRu: "Знаменитый российский хрусталь и стекло.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" },
      { id: "vla-2", title: "Vladimir Industrial Park", titleZh: "弗拉基米尔工业园区", titleRu: "Владимирский индустриальный парк", sector: "Manufacturing", description: "Manufacturing cluster near Moscow.", descriptionZh: "莫斯科附近的制造业集群。", descriptionRu: "Производственный кластер под Москвой.", investmentRange: "$15M - $150M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Historic Golden Ring center and ancient Russian capital. Famous Gus-Khrustalny crystal. Growing manufacturing near Moscow.", targetSectors: ["Glass & Crystal", "Machinery", "Food Processing", "Tourism"], opportunities: [
    { id: "vl-1", title: "Russian Crystal Industry", titleZh: "俄罗斯水晶产业", titleRu: "Российская хрустальная промышленность", sector: "Glass", description: "Premium crystal and art glass production.", descriptionZh: "优质水晶和艺术玻璃生产。", descriptionRu: "Производство премиального хрусталя и художественного стекла.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
    { id: "vl-2", title: "Golden Ring Heritage Tourism", titleZh: "金环遗产旅游", titleRu: "Наследственный туризм Золотого кольца", sector: "Tourism", description: "UNESCO heritage site tourism.", descriptionZh: "联合国教科文组织遗产地旅游。", descriptionRu: "Туризм объектов наследия ЮНЕСКО.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Crystal Capital", description: "Famous Gus-Khrustalny crystal." }], contactInfo: { investmentAgency: "Vladimir Investment Agency", website: "https://investvladimir.ru" } },
  "Lipetsk Oblast": { name: "Lipetsk Oblast", nameZh: "利佩茨克州", nameRu: "Липецкая область", gdp: "$14 Billion", population: "1.1 Million", sezCount: 2, industries: ["Steel", "Appliances", "Agriculture", "Machinery"], taxBenefits: ["SEZ tax holidays", "Steel industry support"], majorCities: [
    { id: "lipetsk", name: "Lipetsk", population: "0.5M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Steel capital. Home to NLMK - one of world's most efficient steel producers.", opportunities: [
      { id: "lip-1", title: "NLMK Steel Partnership", titleZh: "新利佩茨克钢铁合作", titleRu: "Партнёрство с НЛМК", sector: "Steel", description: "Partnership with world's most profitable steelmaker.", descriptionZh: "与全球最盈利钢铁制造商的合作。", descriptionRu: "Партнёрство с самым прибыльным сталелитейщиком мира.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "lip-2", title: "Lipetsk SEZ Manufacturing", titleZh: "利佩茨克经济特区制造", titleRu: "Производство в ОЭЗ Липецк", sector: "Manufacturing", description: "Appliance and machinery manufacturing.", descriptionZh: "家电和机械制造。", descriptionRu: "Производство бытовой техники и машиностроение.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's steel capital with NLMK - one of world's most efficient steel producers. Successful SEZ with appliance manufacturing.", targetSectors: ["Steel", "Appliances", "Machinery", "Agriculture"], opportunities: [
    { id: "lp-1", title: "NLMK Partnership Opportunities", titleZh: "新利佩茨克合作机会", titleRu: "Возможности партнёрства с НЛМК", sector: "Steel", description: "Steel processing and value-added products.", descriptionZh: "钢材加工和增值产品。", descriptionRu: "Переработка стали и продукция с добавленной стоимостью.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "lp-2", title: "Lipetsk Appliance Cluster", titleZh: "利佩茨克家电产业集群", titleRu: "Липецкий кластер бытовой техники", sector: "Appliances", description: "Home appliance manufacturing (Indesit, etc.).", descriptionZh: "家用电器制造（Indesit等）。", descriptionRu: "Производство бытовой техники (Indesit и др.).", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Steel Capital", description: "NLMK - world's most efficient steelmaker." }], contactInfo: { investmentAgency: "Lipetsk Investment Agency", website: "https://investlipetsk.ru" } },
  "Vologda Oblast": { name: "Vologda Oblast", nameZh: "沃洛格达州", nameRu: "Вологодская область", gdp: "$13 Billion", population: "1.2 Million", sezCount: 1, industries: ["Steel", "Chemicals", "Forestry", "Dairy"], taxBenefits: ["Industrial incentives", "Forestry support"], majorCities: [
    { id: "cherepovets", name: "Cherepovets", population: "0.3M", image: "https://images.unsplash.com/photo-1590244840770-b9a0a36a3a83?w=1920&q=80", description: "Major steel city. Home to Severstal - Russia's leading private steelmaker.", opportunities: [
      { id: "chr-1", title: "Severstal Steel Partnership", titleZh: "北方钢铁合作", titleRu: "Партнёрство с Северсталью", sector: "Steel", description: "Partnership with Russia's leading private steel company.", descriptionZh: "与俄罗斯领先的私营钢铁公司的合作。", descriptionRu: "Партнёрство с ведущей частной сталелитейной компанией России.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "chr-2", title: "Chemical Complex", titleZh: "化工综合体", titleRu: "Химический комплекс", sector: "Chemicals", description: "Fertilizer and chemical production.", descriptionZh: "化肥和化学品生产。", descriptionRu: "Производство удобрений и химикатов.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Major steel and chemical region. Home to Severstal and PhosAgro. Famous for Vologda butter and dairy products.", targetSectors: ["Steel", "Chemicals", "Forestry", "Dairy"], opportunities: [
    { id: "vo-1", title: "Severstal Partnership", titleZh: "北方钢铁合作", titleRu: "Партнёрство с Северсталью", sector: "Steel", description: "Steel processing and downstream products.", descriptionZh: "钢材加工和下游产品。", descriptionRu: "Переработка стали и продукция вниз по цепочке.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "vo-2", title: "Vologda Dairy Export", titleZh: "沃洛格达乳制品出口", titleRu: "Вологодский молочный экспорт", sector: "Dairy", description: "Famous Vologda butter for premium markets.", descriptionZh: "著名的沃洛格达黄油面向高端市场。", descriptionRu: "Знаменитое вологодское масло для премиальных рынков.", investmentRange: "$15M - $120M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Steel Hub", description: "Severstal headquarters." }], contactInfo: { investmentAgency: "Vologda Investment Agency", website: "https://investvologda.ru" } },
  "Komi Republic": { name: "Komi Republic", nameZh: "科米共和国", nameRu: "Республика Коми", gdp: "$12 Billion", population: "0.8 Million", sezCount: 1, industries: ["Oil & Gas", "Coal", "Forestry", "Mining"], taxBenefits: ["Northern benefits", "Resource extraction incentives"], majorCities: [
    { id: "syktyvkar", name: "Syktyvkar", population: "0.2M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Capital of vast northern region rich in oil, gas, and timber.", opportunities: [
      { id: "syk-1", title: "Komi Oil & Gas", titleZh: "科米油气", titleRu: "Коми нефтегаз", sector: "Oil & Gas", description: "Oil and gas production in Timan-Pechora basin.", descriptionZh: "蒂曼-伯朝拉盆地的油气生产。", descriptionRu: "Добыча нефти и газа в Тимано-Печорском бассейне.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "active" },
      { id: "syk-2", title: "Komi Forestry", titleZh: "科米林业", titleRu: "Коми лесопромышленность", sector: "Forestry", description: "Timber and pulp production.", descriptionZh: "木材和纸浆生产。", descriptionRu: "Производство древесины и целлюлозы.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Vast northern region with significant oil, gas, coal, and timber resources. Timan-Pechora oil and gas basin.", targetSectors: ["Oil & Gas", "Coal", "Forestry", "Mining"], opportunities: [
    { id: "km-1", title: "Timan-Pechora Basin Development", titleZh: "蒂曼-伯朝拉盆地开发", titleRu: "Развитие Тимано-Печорского бассейна", sector: "Oil & Gas", description: "Oil and gas production expansion.", descriptionZh: "油气生产扩张。", descriptionRu: "Расширение добычи нефти и газа.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "km-2", title: "Komi Coal Export", titleZh: "科米煤炭出口", titleRu: "Экспорт коми угля", sector: "Coal", description: "Thermal coal mining for export.", descriptionZh: "出口用动力煤开采。", descriptionRu: "Добыча энергетического угля на экспорт.", investmentRange: "$30M - $250M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Resource Rich", description: "Oil, gas, coal, timber." }], contactInfo: { investmentAgency: "Komi Investment Agency", website: "https://investkomi.ru" } },
  "Republic of Khakassia": { name: "Republic of Khakassia", nameZh: "哈卡斯共和国", nameRu: "Республика Хакасия", gdp: "$5 Billion", population: "0.5 Million", sezCount: 1, industries: ["Aluminum", "Coal", "Energy", "Agriculture"], taxBenefits: ["Energy incentives", "Aluminum support"], majorCities: [
    { id: "abakan", name: "Abakan", population: "0.2M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Siberian city with hydropower and aluminum production.", opportunities: [
      { id: "abk-1", title: "Sayano-Shushenskaya Hydropower", titleZh: "萨彦-舒申斯克水电", titleRu: "Саяно-Шушенская ГЭС", sector: "Energy", description: "Russia's largest hydroelectric plant services.", descriptionZh: "俄罗斯最大水电站的服务。", descriptionRu: "Услуги крупнейшей гидроэлектростанции России.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "active" },
      { id: "abk-2", title: "Khakassia Aluminum", titleZh: "哈卡斯铝业", titleRu: "Хакасский алюминий", sector: "Aluminum", description: "Aluminum production using cheap hydropower.", descriptionZh: "利用廉价水电的铝生产。", descriptionRu: "Производство алюминия на дешёвой гидроэнергии.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "priority" }
    ]}
  ], overview: "Siberian republic with major hydropower (Sayano-Shushenskaya dam) and aluminum production. Growing coal mining.", targetSectors: ["Aluminum", "Hydropower", "Coal", "Agriculture"], opportunities: [
    { id: "kh-1", title: "Khakassia Aluminum Expansion", titleZh: "哈卡斯铝业扩张", titleRu: "Расширение хакасского алюминия", sector: "Aluminum", description: "Low-cost aluminum production.", descriptionZh: "低成本铝生产。", descriptionRu: "Низкозатратное производство алюминия.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "kh-2", title: "Khakassia Coal Mining", titleZh: "哈卡斯煤矿开采", titleRu: "Хакасская угледобыча", sector: "Coal", description: "Coal mining expansion for Asian export.", descriptionZh: "面向亚洲出口的煤矿扩张。", descriptionRu: "Расширение угледобычи для азиатского экспорта.", investmentRange: "$25M - $200M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Hydropower", description: "Sayano-Shushenskaya - Russia's largest dam." }], contactInfo: { investmentAgency: "Khakassia Investment Agency", website: "https://investkhakassia.ru" } },
  "Republic of Adygea": { name: "Republic of Adygea", nameZh: "阿迪格共和国", nameRu: "Республика Адыгея", gdp: "$2 Billion", population: "0.5 Million", sezCount: 0, industries: ["Tourism", "Agriculture", "Food Processing"], taxBenefits: ["Tourism incentives", "Agricultural support"], majorCities: [
    { id: "maykop", name: "Maykop", population: "0.1M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Capital in scenic Caucasus foothills. Growing eco-tourism.", opportunities: [
      { id: "may-1", title: "Caucasus Eco-Tourism", titleZh: "高加索生态旅游", titleRu: "Кавказский экотуризм", sector: "Tourism", description: "Mountain and adventure tourism.", descriptionZh: "山地和探险旅游。", descriptionRu: "Горный и приключенческий туризм.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" },
      { id: "may-2", title: "Adygea Food Processing", titleZh: "阿迪格食品加工", titleRu: "Адыгейская пищепереработка", sector: "Food", description: "Famous Adyghe cheese and dairy.", descriptionZh: "著名的阿迪格奶酪和乳制品。", descriptionRu: "Знаменитый адыгейский сыр и молочная продукция.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Small scenic republic in Caucasus foothills. Famous for Adyghe cheese. Growing eco-tourism and agriculture.", targetSectors: ["Eco-Tourism", "Food Processing", "Agriculture"], opportunities: [
    { id: "ad-1", title: "Adygea Tourism Development", titleZh: "阿迪格旅游开发", titleRu: "Развитие туризма Адыгеи", sector: "Tourism", description: "Caucasus mountain tourism.", descriptionZh: "高加索山地旅游。", descriptionRu: "Кавказский горный туризм.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" },
    { id: "ad-2", title: "Adyghe Cheese Export", titleZh: "阿迪格奶酪出口", titleRu: "Экспорт адыгейского сыра", sector: "Food", description: "Traditional cheese for premium markets.", descriptionZh: "面向高端市场的传统奶酪。", descriptionRu: "Традиционный сыр для премиальных рынков.", investmentRange: "$5M - $40M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caucasus Gateway", description: "Scenic mountain region." }], contactInfo: { investmentAgency: "Adygea Investment Agency", website: "https://investadygea.ru" } },
  "Altai Republic": { name: "Altai Republic", nameZh: "阿尔泰共和国", nameRu: "Республика Алтай", gdp: "$1 Billion", population: "0.2 Million", sezCount: 0, industries: ["Tourism", "Agriculture", "Mining"], taxBenefits: ["Tourism development support", "Environmental incentives"], majorCities: [
    { id: "gorno-altaysk", name: "Gorno-Altaysk", population: "0.06M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Gateway to spectacular Altai Mountains - UNESCO World Heritage site.", opportunities: [
      { id: "gor-1", title: "Altai Mountain Tourism", titleZh: "阿尔泰山旅游", titleRu: "Алтайский горный туризм", sector: "Tourism", description: "UNESCO heritage eco-tourism.", descriptionZh: "联合国教科文组织遗产生态旅游。", descriptionRu: "Экотуризм объектов наследия ЮНЕСКО.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "priority" },
      { id: "gor-2", title: "Altai Traditional Medicine", titleZh: "阿尔泰传统医学", titleRu: "Алтайская традиционная медицина", sector: "Health", description: "Traditional healing and health tourism.", descriptionZh: "传统疗法和健康旅游。", descriptionRu: "Традиционное целительство и оздоровительный туризм.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Pristine mountainous region - UNESCO World Heritage. Golden Mountains of Altai with spectacular scenery. Growing eco-tourism.", targetSectors: ["Eco-Tourism", "Traditional Medicine", "Agriculture"], opportunities: [
    { id: "ar-1", title: "Golden Mountains Tourism", titleZh: "金山旅游", titleRu: "Туризм Золотых гор", sector: "Tourism", description: "UNESCO World Heritage eco-tourism.", descriptionZh: "联合国教科文组织世界遗产生态旅游。", descriptionRu: "Экотуризм объекта Всемирного наследия ЮНЕСКО.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
    { id: "ar-2", title: "Altai Health Tourism", titleZh: "阿尔泰健康旅游", titleRu: "Алтайский оздоровительный туризм", sector: "Tourism", description: "Traditional medicine and wellness.", descriptionZh: "传统医学和健康养生。", descriptionRu: "Традиционная медицина и оздоровление.", investmentRange: "$10M - $80M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "UNESCO Heritage", description: "Golden Mountains of Altai." }], contactInfo: { investmentAgency: "Altai Republic Tourism Agency", website: "https://investaltai-republic.ru" } },
  "Sevastopol": { name: "Sevastopol", nameZh: "塞瓦斯托波尔", nameRu: "Севастополь", gdp: "$2 Billion", population: "0.4 Million", sezCount: 1, industries: ["Shipbuilding", "Tourism", "Fishing", "Wine"], taxBenefits: ["Free economic zone", "Shipbuilding support"], majorCities: [
    { id: "sevastopol-city", name: "Sevastopol", population: "0.4M", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1920&q=80", description: "Historic naval port and resort city on Black Sea.", opportunities: [
      { id: "sev-1", title: "Sevastopol Shipyard Partnership", titleZh: "塞瓦斯托波尔造船厂合作", titleRu: "Партнёрство с севастопольской верфью", sector: "Shipbuilding", description: "Ship repair and construction.", descriptionZh: "船舶修理和建造。", descriptionRu: "Судоремонт и судостроение.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" },
      { id: "sev-2", title: "Black Sea Tourism", titleZh: "黑海旅游", titleRu: "Черноморский туризм", sector: "Tourism", description: "Beach and heritage tourism.", descriptionZh: "海滩和遗产旅游。", descriptionRu: "Пляжный и наследственный туризм.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Historic Black Sea naval base and resort city. Major shipbuilding and repair. Growing tourism industry.", targetSectors: ["Shipbuilding", "Ship Repair", "Tourism", "Wine"], opportunities: [
    { id: "sv-1", title: "Sevastopol Shipbuilding", titleZh: "塞瓦斯托波尔造船", titleRu: "Севастопольское судостроение", sector: "Shipbuilding", description: "Civilian shipbuilding and repair.", descriptionZh: "民用造船和修理。", descriptionRu: "Гражданское судостроение и судоремонт.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "active" },
    { id: "sv-2", title: "Sevastopol Tourism", titleZh: "塞瓦斯托波尔旅游", titleRu: "Севастопольский туризм", sector: "Tourism", description: "Historic and beach tourism development.", descriptionZh: "历史和海滩旅游开发。", descriptionRu: "Развитие исторического и пляжного туризма.", investmentRange: "$25M - $200M", timeline: "2-4 years", status: "priority" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Naval Port", description: "Historic Black Sea naval base." }], contactInfo: { investmentAgency: "Sevastopol Investment Agency", website: "https://investsevastopol.ru" } },
  "Kursk Oblast": { name: "Kursk Oblast", nameZh: "库尔斯克州", nameRu: "Курская область", gdp: "$11 Billion", population: "1.1 Million", sezCount: 1, industries: ["Iron Ore", "Agriculture", "Food Processing", "Machinery"], taxBenefits: ["Mining incentives", "Agricultural support"], majorCities: [
    { id: "kursk", name: "Kursk", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Center of Russia's iron ore belt. Famous for 1943 tank battle.", opportunities: [
      { id: "kur-1", title: "Kursk Magnetic Anomaly Mining", titleZh: "库尔斯克磁异常采矿", titleRu: "Добыча КМА", sector: "Mining", description: "World's largest iron ore reserve.", descriptionZh: "世界最大的铁矿石储量。", descriptionRu: "Крупнейшие в мире запасы железной руды.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "kur-2", title: "Kursk Agro-Industrial", titleZh: "库尔斯克农工业", titleRu: "Курский агропром", sector: "Agriculture", description: "Grain and sugar beet processing.", descriptionZh: "粮食和甜菜加工。", descriptionRu: "Переработка зерна и сахарной свёклы.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Part of Russia's iron ore belt (Kursk Magnetic Anomaly - world's largest iron ore reserve). Strong agricultural sector.", targetSectors: ["Iron Ore Mining", "Agriculture", "Food Processing", "Machinery"], opportunities: [
    { id: "ku-1", title: "KMA Iron Ore Development", titleZh: "库尔斯克磁异常铁矿开发", titleRu: "Развитие КМА", sector: "Mining", description: "World's largest iron ore deposits.", descriptionZh: "世界最大的铁矿床。", descriptionRu: "Крупнейшие в мире месторождения железной руды.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ku-2", title: "Kursk Agricultural Hub", titleZh: "库尔斯克农业中心", titleRu: "Курский агрохаб", sector: "Agriculture", description: "Grain and sugar production.", descriptionZh: "粮食和糖生产。", descriptionRu: "Производство зерна и сахара.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Iron Ore Belt", description: "World's largest iron ore reserve." }], contactInfo: { investmentAgency: "Kursk Investment Agency", website: "https://investkursk.ru" } },
  "Bryansk Oblast": { name: "Bryansk Oblast", nameZh: "布良斯克州", nameRu: "Брянская область", gdp: "$9 Billion", population: "1.2 Million", sezCount: 1, industries: ["Rail Equipment", "Machinery", "Agriculture", "Forestry"], taxBenefits: ["Manufacturing incentives", "Border trade support"], majorCities: [
    { id: "bryansk", name: "Bryansk", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Rail equipment manufacturing center. Border region with Belarus and Ukraine.", opportunities: [
      { id: "bry-1", title: "Bryansk Rail Equipment", titleZh: "布良斯克铁路设备", titleRu: "Брянское железнодорожное оборудование", sector: "Rail", description: "Freight car and equipment manufacturing.", descriptionZh: "货车和设备制造。", descriptionRu: "Производство грузовых вагонов и оборудования.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
      { id: "bry-2", title: "Bryansk Forestry", titleZh: "布良斯克林业", titleRu: "Брянское лесопользование", sector: "Forestry", description: "Timber processing and furniture.", descriptionZh: "木材加工和家具。", descriptionRu: "Деревообработка и производство мебели.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Rail equipment manufacturing center. Border region with strategic logistics position. Strong forestry sector.", targetSectors: ["Rail Equipment", "Machinery", "Forestry", "Agriculture"], opportunities: [
    { id: "bn-1", title: "Bryansk Rail Manufacturing", titleZh: "布良斯克铁路制造", titleRu: "Брянское вагоностроение", sector: "Rail", description: "Freight rail car production.", descriptionZh: "货运车厢生产。", descriptionRu: "Производство грузовых вагонов.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "active" },
    { id: "bn-2", title: "Western Border Logistics", titleZh: "西部边境物流", titleRu: "Западная пограничная логистика", sector: "Logistics", description: "Cross-border logistics hub.", descriptionZh: "跨境物流中心。", descriptionRu: "Трансграничный логистический хаб.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Border Region", description: "Strategic western location." }], contactInfo: { investmentAgency: "Bryansk Investment Agency", website: "https://investbryansk.ru" } },
  "Kirov Oblast": { name: "Kirov Oblast", nameZh: "基洛夫州", nameRu: "Кировская область", gdp: "$8 Billion", population: "1.3 Million", sezCount: 1, industries: ["Chemicals", "Machinery", "Biotechnology", "Forestry"], taxBenefits: ["Biotech incentives", "Manufacturing support"], majorCities: [
    { id: "kirov", name: "Kirov", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Chemical and biotech center. Russia's leading biotech cluster.", opportunities: [
      { id: "kir-1", title: "Kirov Biotech Cluster", titleZh: "基洛夫生物技术集群", titleRu: "Кировский биотехкластер", sector: "Biotech", description: "Vaccines and biological products.", descriptionZh: "疫苗和生物制品。", descriptionRu: "Вакцины и биологические препараты.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "priority" },
      { id: "kir-2", title: "Kirov Chemical Complex", titleZh: "基洛夫化工综合体", titleRu: "Кировский химический комплекс", sector: "Chemicals", description: "Specialty chemicals and fertilizers.", descriptionZh: "特种化学品和化肥。", descriptionRu: "Специализированные химикаты и удобрения.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's biotech capital with vaccine and biological product manufacturing. Strong chemical and machinery sectors.", targetSectors: ["Biotechnology", "Chemicals", "Machinery", "Forestry"], opportunities: [
    { id: "ki-1", title: "Kirov Biotech Hub", titleZh: "基洛夫生物技术中心", titleRu: "Кировский биотехнологический хаб", sector: "Biotech", description: "Vaccine and biological product manufacturing.", descriptionZh: "疫苗和生物制品生产。", descriptionRu: "Производство вакцин и биологических препаратов.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
    { id: "ki-2", title: "Kirov Forest Products", titleZh: "基洛夫林产品", titleRu: "Кировские лесопродукты", sector: "Forestry", description: "Timber and wood products.", descriptionZh: "木材和木制品。", descriptionRu: "Древесина и изделия из дерева.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Biotech Capital", description: "Russia's leading biotech cluster." }], contactInfo: { investmentAgency: "Kirov Investment Agency", website: "https://investkirov.ru" } },
  "Chechen Republic": { name: "Chechen Republic", nameZh: "车臣共和国", nameRu: "Чеченская Республика", gdp: "$3 Billion", population: "1.5 Million", sezCount: 1, industries: ["Construction", "Agriculture", "Tourism", "Oil"], taxBenefits: ["North Caucasus incentives", "Reconstruction support"], majorCities: [
    { id: "grozny", name: "Grozny", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Rebuilt capital. Modern city with ambitious construction projects.", opportunities: [
      { id: "grz-1", title: "Grozny City Development", titleZh: "格罗兹尼城市开发", titleRu: "Развитие города Грозный", sector: "Construction", description: "Modern construction and urban development.", descriptionZh: "现代建筑和城市发展。", descriptionRu: "Современное строительство и городское развитие.", investmentRange: "$20M - $200M", timeline: "2-4 years", status: "priority" },
      { id: "grz-2", title: "Chechnya Tourism", titleZh: "车臣旅游", titleRu: "Чеченский туризм", sector: "Tourism", description: "Mountain and cultural tourism.", descriptionZh: "山地和文化旅游。", descriptionRu: "Горный и культурный туризм.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Rapidly reconstructed republic with modern Grozny. Growing construction, tourism, and agriculture sectors.", targetSectors: ["Construction", "Tourism", "Agriculture", "Oil Services"], opportunities: [
    { id: "cc-1", title: "Chechnya Development Projects", titleZh: "车臣发展项目", titleRu: "Проекты развития Чечни", sector: "Construction", description: "Infrastructure and urban development.", descriptionZh: "基础设施和城市发展。", descriptionRu: "Инфраструктура и городское развитие.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "priority" },
    { id: "cc-2", title: "Caucasus Mountain Tourism", titleZh: "高加索山旅游", titleRu: "Кавказский горный туризм", sector: "Tourism", description: "Mountain resort development.", descriptionZh: "山地度假村开发。", descriptionRu: "Развитие горных курортов.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Caucasus Mountains", description: "Growing tourism destination." }], contactInfo: { investmentAgency: "Chechnya Investment Agency", website: "https://investchechnya.ru" } },
  "Kabardino-Balkarian Republic": { name: "Kabardino-Balkarian Republic", nameZh: "卡巴尔达-巴尔卡尔共和国", nameRu: "Кабардино-Балкарская Республика", gdp: "$3 Billion", population: "0.9 Million", sezCount: 1, industries: ["Tourism", "Agriculture", "Mining", "Manufacturing"], taxBenefits: ["North Caucasus incentives", "Tourism support"], majorCities: [
    { id: "nalchik", name: "Nalchik", population: "0.2M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Spa resort city at foot of Mount Elbrus - Europe's highest peak.", opportunities: [
      { id: "nal-1", title: "Elbrus Ski Resort", titleZh: "厄尔布鲁士滑雪度假村", titleRu: "Горнолыжный курорт Эльбрус", sector: "Tourism", description: "Ski resort at Europe's highest mountain.", descriptionZh: "欧洲最高山峰的滑雪度假村。", descriptionRu: "Горнолыжный курорт на высочайшей вершине Европы.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
      { id: "nal-2", title: "Nalchik Spa Tourism", titleZh: "纳尔奇克温泉旅游", titleRu: "Нальчикский спа-туризм", sector: "Tourism", description: "Historic spa resort development.", descriptionZh: "历史悠久的温泉度假村开发。", descriptionRu: "Развитие исторического курорта.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Home to Mount Elbrus - Europe's highest peak. Major ski and spa tourism destination. Growing manufacturing.", targetSectors: ["Ski Tourism", "Spa Tourism", "Agriculture", "Manufacturing"], opportunities: [
    { id: "kb-1", title: "Mount Elbrus Tourism", titleZh: "厄尔布鲁士山旅游", titleRu: "Туризм на Эльбрусе", sector: "Tourism", description: "Europe's highest peak ski and adventure tourism.", descriptionZh: "欧洲最高峰的滑雪和探险旅游。", descriptionRu: "Горнолыжный и приключенческий туризм на высочайшей вершине Европы.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "kb-2", title: "Kabardino-Balkaria Agriculture", titleZh: "卡巴尔达-巴尔卡尔农业", titleRu: "Сельское хозяйство КБР", sector: "Agriculture", description: "Fruit and grain production.", descriptionZh: "水果和粮食生产。", descriptionRu: "Производство фруктов и зерна.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Mount Elbrus", description: "Europe's highest peak." }], contactInfo: { investmentAgency: "KBR Investment Agency", website: "https://investkbr.ru" } },
  "Republic of North Ossetia-Alania": { name: "Republic of North Ossetia-Alania", nameZh: "北奥塞梯-阿兰共和国", nameRu: "Республика Северная Осетия — Алания", gdp: "$3 Billion", population: "0.7 Million", sezCount: 1, industries: ["Mining", "Manufacturing", "Agriculture", "Tourism"], taxBenefits: ["North Caucasus incentives", "Mining support"], majorCities: [
    { id: "vladikavkaz", name: "Vladikavkaz", population: "0.3M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Gateway to Georgia via historic Georgian Military Highway.", opportunities: [
      { id: "vlk-1", title: "North Ossetia Mining", titleZh: "北奥塞梯采矿", titleRu: "Североосетинская горнодобыча", sector: "Mining", description: "Lead, zinc, and polymetallic mining.", descriptionZh: "铅、锌和多金属矿开采。", descriptionRu: "Добыча свинца, цинка и полиметаллических руд.", investmentRange: "$25M - $220M", timeline: "3-5 years", status: "active" },
      { id: "vlk-2", title: "Trans-Caucasus Logistics", titleZh: "跨高加索物流", titleRu: "Транскавказская логистика", sector: "Logistics", description: "Trade corridor to Georgia and Armenia.", descriptionZh: "通往格鲁吉亚和亚美尼亚的贸易走廊。", descriptionRu: "Торговый коридор в Грузию и Армению.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Strategic location on Georgian border. Mining and metallurgy. Historic cultural heritage.", targetSectors: ["Mining", "Logistics", "Manufacturing", "Tourism"], opportunities: [
    { id: "no-1", title: "North Ossetia Mining Development", titleZh: "北奥塞梯矿业开发", titleRu: "Развитие горнодобычи Северной Осетии", sector: "Mining", description: "Polymetallic ore development.", descriptionZh: "多金属矿石开发。", descriptionRu: "Освоение полиметаллических руд.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" },
    { id: "no-2", title: "Georgian Highway Corridor", titleZh: "格鲁吉亚公路走廊", titleRu: "Коридор Военно-Грузинской дороги", sector: "Logistics", description: "Trade and transit corridor.", descriptionZh: "贸易和过境走廊。", descriptionRu: "Торговый и транзитный коридор.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Georgia Gateway", description: "Strategic trans-Caucasus location." }], contactInfo: { investmentAgency: "North Ossetia Investment Agency", website: "https://investosetia.ru" } },
  "Republic of Kalmykia": { name: "Republic of Kalmykia", nameZh: "卡尔梅克共和国", nameRu: "Республика Калмыкия", gdp: "$2 Billion", population: "0.3 Million", sezCount: 0, industries: ["Agriculture", "Oil & Gas", "Tourism"], taxBenefits: ["Agricultural subsidies", "Steppe development support"], majorCities: [
    { id: "elista", name: "Elista", population: "0.1M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Europe's only Buddhist capital. Chess City complex.", opportunities: [
      { id: "eli-1", title: "Kalmykia Livestock", titleZh: "卡尔梅克畜牧业", titleRu: "Калмыцкое животноводство", sector: "Agriculture", description: "Traditional cattle and sheep farming.", descriptionZh: "传统牛羊养殖。", descriptionRu: "Традиционное разведение крупного рогатого скота и овец.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" },
      { id: "eli-2", title: "Buddhist Cultural Tourism", titleZh: "佛教文化旅游", titleRu: "Буддийский культурный туризм", sector: "Tourism", description: "Unique Buddhist heritage in Europe.", descriptionZh: "欧洲独特的佛教遗产。", descriptionRu: "Уникальное буддийское наследие в Европе.", investmentRange: "$5M - $50M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Europe's only Buddhist region with unique Mongolic culture. Steppe agriculture and growing oil production.", targetSectors: ["Livestock", "Oil & Gas", "Cultural Tourism"], opportunities: [
    { id: "kl-1", title: "Kalmykia Agriculture", titleZh: "卡尔梅克农业", titleRu: "Калмыцкое сельское хозяйство", sector: "Agriculture", description: "Livestock and wool production.", descriptionZh: "畜牧和羊毛生产。", descriptionRu: "Животноводство и производство шерсти.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
    { id: "kl-2", title: "Kalmykia Oil Development", titleZh: "卡尔梅克石油开发", titleRu: "Нефтедобыча Калмыкии", sector: "Oil", description: "Oil exploration and production.", descriptionZh: "石油勘探和生产。", descriptionRu: "Разведка и добыча нефти.", investmentRange: "$20M - $200M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Buddhist Europe", description: "Europe's only Buddhist region." }], contactInfo: { investmentAgency: "Kalmykia Investment Agency", website: "https://investkalmykia.ru" } },
  "Mari El Republic": { name: "Mari El Republic", nameZh: "马里埃尔共和国", nameRu: "Республика Марий Эл", gdp: "$4 Billion", population: "0.7 Million", sezCount: 1, industries: ["Machinery", "Forestry", "Agriculture", "IT"], taxBenefits: ["Manufacturing incentives", "Forestry support"], majorCities: [
    { id: "yoshkar-ola", name: "Yoshkar-Ola", population: "0.3M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Picturesque city with unique Flemish-style architecture.", opportunities: [
      { id: "yos-1", title: "Mari El Machinery", titleZh: "马里埃尔机械", titleRu: "Марийское машиностроение", sector: "Machinery", description: "Precision machinery manufacturing.", descriptionZh: "精密机械制造。", descriptionRu: "Производство точного машиностроения.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "yos-2", title: "Mari El Forestry", titleZh: "马里埃尔林业", titleRu: "Марийское лесопользование", sector: "Forestry", description: "Sustainable timber production.", descriptionZh: "可持续木材生产。", descriptionRu: "Устойчивое лесопользование.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Volga region with strong machinery and forestry industries. Unique architecture and growing IT sector.", targetSectors: ["Machinery", "Forestry", "IT", "Agriculture"], opportunities: [
    { id: "me-1", title: "Mari El Industrial Park", titleZh: "马里埃尔工业园区", titleRu: "Марийский индустриальный парк", sector: "Manufacturing", description: "Machinery and equipment production.", descriptionZh: "机械和设备生产。", descriptionRu: "Производство машин и оборудования.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "me-2", title: "Volga Forestry Complex", titleZh: "伏尔加林业综合体", titleRu: "Волжский лесопромышленный комплекс", sector: "Forestry", description: "Timber and wood processing.", descriptionZh: "木材加工。", descriptionRu: "Деревообработка.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Forest Resources", description: "Rich timber reserves." }], contactInfo: { investmentAgency: "Mari El Investment Agency", website: "https://investmariel.ru" } },
  "Tuva Republic": { name: "Tuva Republic", nameZh: "图瓦共和国", nameRu: "Республика Тыва", gdp: "$2 Billion", population: "0.3 Million", sezCount: 0, industries: ["Mining", "Agriculture", "Tourism"], taxBenefits: ["Mining incentives", "Border zone benefits"], majorCities: [
    { id: "kyzyl", name: "Kyzyl", population: "0.1M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Geographic center of Asia. Unique nomadic culture on Mongolian border.", opportunities: [
      { id: "kyz-1", title: "Tuva Mining Development", titleZh: "图瓦矿业开发", titleRu: "Развитие горнодобычи Тувы", sector: "Mining", description: "Coal and rare earth mining.", descriptionZh: "煤炭和稀土开采。", descriptionRu: "Добыча угля и редкоземельных металлов.", investmentRange: "$25M - $250M", timeline: "3-5 years", status: "priority" },
      { id: "kyz-2", title: "Tuva Adventure Tourism", titleZh: "图瓦探险旅游", titleRu: "Тувинский приключенческий туризм", sector: "Tourism", description: "Nomadic culture and nature tourism.", descriptionZh: "游牧文化和自然旅游。", descriptionRu: "Туризм кочевой культуры и природы.", investmentRange: "$10M - $80M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Remote republic at geographic center of Asia. Rich mineral deposits. Unique nomadic Turkic-Buddhist culture.", targetSectors: ["Mining", "Adventure Tourism", "Agriculture"], opportunities: [
    { id: "tv-1", title: "Tuva Coal and Minerals", titleZh: "图瓦煤炭和矿产", titleRu: "Тувинский уголь и минералы", sector: "Mining", description: "Coal and mineral extraction.", descriptionZh: "煤炭和矿物开采。", descriptionRu: "Добыча угля и минералов.", investmentRange: "$30M - $300M", timeline: "3-5 years", status: "priority" },
    { id: "tv-2", title: "Center of Asia Tourism", titleZh: "亚洲中心旅游", titleRu: "Туризм Центра Азии", sector: "Tourism", description: "Geographic center of Asia experience.", descriptionZh: "亚洲地理中心体验。", descriptionRu: "Опыт географического центра Азии.", investmentRange: "$15M - $120M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Center of Asia", description: "Geographic center of Asia." }], contactInfo: { investmentAgency: "Tuva Investment Agency", website: "https://investtuva.ru" } },
  "Ivanovo Oblast": { name: "Ivanovo Oblast", nameZh: "伊万诺沃州", nameRu: "Ивановская область", gdp: "$5 Billion", population: "1.0 Million", sezCount: 1, industries: ["Textiles", "Machinery", "Food Processing"], taxBenefits: ["Textile industry support", "Manufacturing incentives"], majorCities: [
    { id: "ivanovo", name: "Ivanovo", population: "0.4M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Historic Russian textile capital. 'City of Brides' nickname.", opportunities: [
      { id: "ivn-1", title: "Ivanovo Textile Revival", titleZh: "伊万诺沃纺织复兴", titleRu: "Возрождение ивановского текстиля", sector: "Textiles", description: "Modern textile and fashion production.", descriptionZh: "现代纺织和时尚生产。", descriptionRu: "Современное текстильное и модное производство.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "ivn-2", title: "Ivanovo Machinery", titleZh: "伊万诺沃机械", titleRu: "Ивановское машиностроение", sector: "Machinery", description: "Textile and industrial machinery.", descriptionZh: "纺织和工业机械。", descriptionRu: "Текстильное и промышленное машиностроение.", investmentRange: "$10M - $100M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Historic Russian textile capital. Strong machinery and food processing industries. Golden Ring heritage.", targetSectors: ["Textiles", "Machinery", "Food Processing", "Tourism"], opportunities: [
    { id: "iv-1", title: "Russian Textile Hub", titleZh: "俄罗斯纺织中心", titleRu: "Российский текстильный хаб", sector: "Textiles", description: "Textile manufacturing revival.", descriptionZh: "纺织制造业复兴。", descriptionRu: "Возрождение текстильного производства.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "iv-2", title: "Golden Ring Tourism", titleZh: "金环旅游", titleRu: "Туризм Золотого кольца", sector: "Tourism", description: "Heritage tourism development.", descriptionZh: "遗产旅游开发。", descriptionRu: "Развитие наследственного туризма.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Textile Capital", description: "Historic Russian textile center." }], contactInfo: { investmentAgency: "Ivanovo Investment Agency", website: "https://investivanovo.ru" } },
  "Ryazan Oblast": { name: "Ryazan Oblast", nameZh: "梁赞州", nameRu: "Рязанская область", gdp: "$9 Billion", population: "1.1 Million", sezCount: 1, industries: ["Oil Refining", "Machinery", "Agriculture", "Electronics"], taxBenefits: ["SEZ benefits", "Oil industry support"], majorCities: [
    { id: "ryazan", name: "Ryazan", population: "0.5M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Major oil refining center near Moscow. Historic Kremlin.", opportunities: [
      { id: "ryz-1", title: "Ryazan Oil Refinery", titleZh: "梁赞炼油厂", titleRu: "Рязанский НПЗ", sector: "Oil Refining", description: "Rosneft refinery expansion.", descriptionZh: "俄油炼油厂扩建。", descriptionRu: "Расширение НПЗ Роснефти.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "ryz-2", title: "Ryazan Electronics", titleZh: "梁赞电子", titleRu: "Рязанская электроника", sector: "Electronics", description: "Electronics and radio equipment.", descriptionZh: "电子和无线电设备。", descriptionRu: "Электроника и радиооборудование.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Major oil refining hub near Moscow. Strong electronics and machinery industries. Historic Golden Ring city.", targetSectors: ["Oil Refining", "Electronics", "Machinery", "Agriculture"], opportunities: [
    { id: "ry-1", title: "Ryazan Petrochemical Complex", titleZh: "梁赞石化综合体", titleRu: "Рязанский нефтехимический комплекс", sector: "Petrochemicals", description: "Oil refining and petrochemicals.", descriptionZh: "炼油和石化。", descriptionRu: "Нефтепереработка и нефтехимия.", investmentRange: "$50M - $450M", timeline: "3-5 years", status: "priority" },
    { id: "ry-2", title: "Central Russia Logistics", titleZh: "俄罗斯中部物流", titleRu: "Логистика Центральной России", sector: "Logistics", description: "Distribution near Moscow.", descriptionZh: "莫斯科附近的分销。", descriptionRu: "Дистрибуция под Москвой.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Refining Hub", description: "Major oil refining center." }], contactInfo: { investmentAgency: "Ryazan Investment Agency", website: "https://investryazan.ru" } },
  "Penza Oblast": { name: "Penza Oblast", nameZh: "奔萨州", nameRu: "Пензенская область", gdp: "$7 Billion", population: "1.3 Million", sezCount: 1, industries: ["Machinery", "Food Processing", "Paper", "Electronics"], taxBenefits: ["Manufacturing incentives", "Agricultural support"], majorCities: [
    { id: "penza", name: "Penza", population: "0.5M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Industrial city with strong machinery and food processing.", opportunities: [
      { id: "pnz-1", title: "Penza Machinery Cluster", titleZh: "奔萨机械集群", titleRu: "Пензенский машиностроительный кластер", sector: "Machinery", description: "Precision and industrial machinery.", descriptionZh: "精密和工业机械。", descriptionRu: "Точное и промышленное машиностроение.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "pnz-2", title: "Penza Food Processing", titleZh: "奔萨食品加工", titleRu: "Пензенская пищепереработка", sector: "Food", description: "Confectionery and food products.", descriptionZh: "糖果和食品产品。", descriptionRu: "Кондитерские и продовольственные товары.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Central Russian industrial center. Strong machinery, food processing, and paper industries.", targetSectors: ["Machinery", "Food Processing", "Paper", "Electronics"], opportunities: [
    { id: "pz-1", title: "Penza Industrial Development", titleZh: "奔萨工业发展", titleRu: "Промышленное развитие Пензы", sector: "Manufacturing", description: "Diversified manufacturing hub.", descriptionZh: "多元化制造中心。", descriptionRu: "Диверсифицированный производственный хаб.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "pz-2", title: "Volga Food Hub", titleZh: "伏尔加食品中心", titleRu: "Волжский продовольственный хаб", sector: "Food", description: "Food processing for central Russia.", descriptionZh: "俄罗斯中部食品加工。", descriptionRu: "Пищевая переработка для центральной России.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Industrial Center", description: "Diversified manufacturing base." }], contactInfo: { investmentAgency: "Penza Investment Agency", website: "https://investpenza.ru" } },
  "Smolensk Oblast": { name: "Smolensk Oblast", nameZh: "斯摩棱斯克州", nameRu: "Смоленская область", gdp: "$8 Billion", population: "0.9 Million", sezCount: 1, industries: ["Logistics", "Machinery", "Agriculture", "Diamonds"], taxBenefits: ["Border zone benefits", "Logistics incentives"], majorCities: [
    { id: "smolensk", name: "Smolensk", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Strategic western gateway. Historic fortress city on Belarus border.", opportunities: [
      { id: "smo-1", title: "Smolensk Logistics Hub", titleZh: "斯摩棱斯克物流中心", titleRu: "Смоленский логистический хаб", sector: "Logistics", description: "Western gateway logistics.", descriptionZh: "西部门户物流。", descriptionRu: "Логистика западных ворот.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "priority" },
      { id: "smo-2", title: "Kristall Diamond Polishing", titleZh: "水晶钻石抛光", titleRu: "Бриллиантовая огранка Кристалл", sector: "Diamonds", description: "Diamond cutting and polishing.", descriptionZh: "钻石切割和抛光。", descriptionRu: "Огранка и полировка бриллиантов.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Strategic western gateway on Moscow-Minsk corridor. Diamond cutting industry. Strong logistics potential.", targetSectors: ["Logistics", "Diamond Processing", "Machinery", "Agriculture"], opportunities: [
    { id: "sm-1", title: "Western Corridor Logistics", titleZh: "西部走廊物流", titleRu: "Логистика западного коридора", sector: "Logistics", description: "Moscow-Europe logistics hub.", descriptionZh: "莫斯科-欧洲物流中心。", descriptionRu: "Логистический хаб Москва-Европа.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "priority" },
    { id: "sm-2", title: "Smolensk Diamond Industry", titleZh: "斯摩棱斯克钻石产业", titleRu: "Смоленская бриллиантовая промышленность", sector: "Diamonds", description: "Diamond processing expansion.", descriptionZh: "钻石加工扩张。", descriptionRu: "Расширение бриллиантовой обработки.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Western Gateway", description: "Strategic Moscow-Europe corridor." }], contactInfo: { investmentAgency: "Smolensk Investment Agency", website: "https://investsmolensk.ru" } },
  "Ulyanovsk Oblast": { name: "Ulyanovsk Oblast", nameZh: "乌里扬诺夫斯克州", nameRu: "Ульяновская область", gdp: "$10 Billion", population: "1.2 Million", sezCount: 2, industries: ["Aviation", "Automotive", "Nuclear", "IT"], taxBenefits: ["SEZ tax holidays", "Aviation incentives"], majorCities: [
    { id: "ulyanovsk", name: "Ulyanovsk", population: "0.6M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Aviation capital. Birthplace of Lenin. UAZ automotive and Aviastar aircraft.", opportunities: [
      { id: "uly-1", title: "Aviastar Aircraft Partnership", titleZh: "航星飞机合作", titleRu: "Партнёрство с Авиастаром", sector: "Aviation", description: "Large cargo and passenger aircraft.", descriptionZh: "大型货运和客运飞机。", descriptionRu: "Крупные грузовые и пассажирские самолёты.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "uly-2", title: "UAZ Automotive Partnership", titleZh: "瓦兹汽车合作", titleRu: "Партнёрство с УАЗом", sector: "Automotive", description: "SUV and commercial vehicle production.", descriptionZh: "SUV和商用车生产。", descriptionRu: "Производство внедорожников и коммерческих автомобилей.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's aviation center with Aviastar (IL-76, TU-204). UAZ automotive. Nuclear industry cluster.", targetSectors: ["Aviation", "Automotive", "Nuclear", "IT"], opportunities: [
    { id: "ul-1", title: "Ulyanovsk Aviation Cluster", titleZh: "乌里扬诺夫斯克航空集群", titleRu: "Ульяновский авиационный кластер", sector: "Aviation", description: "Aircraft manufacturing and MRO.", descriptionZh: "飞机制造和维修。", descriptionRu: "Авиастроение и ТОиР.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ul-2", title: "Ulyanovsk Automotive SEZ", titleZh: "乌里扬诺夫斯克汽车经济特区", titleRu: "Ульяновская автомобильная ОЭЗ", sector: "Automotive", description: "Automotive component production.", descriptionZh: "汽车零部件生产。", descriptionRu: "Производство автокомпонентов.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Aviation Capital", description: "Major aircraft manufacturing." }], contactInfo: { investmentAgency: "Ulyanovsk Investment Agency", website: "https://investulyanovsk.ru" } },
  "Pskov Oblast": { name: "Pskov Oblast", nameZh: "普斯科夫州", nameRu: "Псковская область", gdp: "$4 Billion", population: "0.6 Million", sezCount: 1, industries: ["Logistics", "Agriculture", "Tourism", "Manufacturing"], taxBenefits: ["Border zone benefits", "EU proximity incentives"], majorCities: [
    { id: "pskov", name: "Pskov", population: "0.2M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Ancient fortress city on EU border. UNESCO heritage sites.", opportunities: [
      { id: "psk-1", title: "EU Border Logistics", titleZh: "欧盟边境物流", titleRu: "Логистика на границе с ЕС", sector: "Logistics", description: "Cross-border trade with EU.", descriptionZh: "与欧盟的跨境贸易。", descriptionRu: "Трансграничная торговля с ЕС.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "psk-2", title: "Pskov Heritage Tourism", titleZh: "普斯科夫遗产旅游", titleRu: "Псковский наследственный туризм", sector: "Tourism", description: "Medieval fortress tourism.", descriptionZh: "中世纪堡垒旅游。", descriptionRu: "Туризм средневековых крепостей.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Historic city on EU border (Estonia, Latvia). UNESCO World Heritage sites. Strategic logistics position.", targetSectors: ["Border Logistics", "Heritage Tourism", "Agriculture", "Manufacturing"], opportunities: [
    { id: "ps-1", title: "Baltic Border Hub", titleZh: "波罗的海边境中心", titleRu: "Балтийский пограничный хаб", sector: "Logistics", description: "Trade gateway to Baltic states.", descriptionZh: "通往波罗的海国家的贸易门户。", descriptionRu: "Торговые ворота в страны Балтии.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "ps-2", title: "Pskov Tourism Development", titleZh: "普斯科夫旅游开发", titleRu: "Развитие туризма Пскова", sector: "Tourism", description: "UNESCO heritage and eco-tourism.", descriptionZh: "联合国教科文组织遗产和生态旅游。", descriptionRu: "Туризм наследия ЮНЕСКО и экотуризм.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "EU Border", description: "Gateway to Baltic states." }], contactInfo: { investmentAgency: "Pskov Investment Agency", website: "https://investpskov.ru" } },
  "Magadan Oblast": { name: "Magadan Oblast", nameZh: "马加丹州", nameRu: "Магаданская область", gdp: "$5 Billion", population: "0.1 Million", sezCount: 1, industries: ["Gold Mining", "Fishing", "Energy"], taxBenefits: ["Far East benefits", "Gold mining incentives", "Northern allowances"], majorCities: [
    { id: "magadan", name: "Magadan", population: "0.1M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Gold mining capital on Sea of Okhotsk. Gateway to Kolyma goldfields.", opportunities: [
      { id: "mag-1", title: "Kolyma Gold Mining", titleZh: "科雷马金矿开采", titleRu: "Колымская золотодобыча", sector: "Gold", description: "Major gold mining region.", descriptionZh: "主要黄金开采区。", descriptionRu: "Крупный золотодобывающий регион.", investmentRange: "$40M - $400M", timeline: "3-5 years", status: "priority" },
      { id: "mag-2", title: "Sea of Okhotsk Fishing", titleZh: "鄂霍次克海捕鱼", titleRu: "Охотоморский промысел", sector: "Fishing", description: "Premium seafood harvesting.", descriptionZh: "优质海产品捕捞。", descriptionRu: "Добыча премиальных морепродуктов.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Russia's gold mining capital in the Far East. Kolyma goldfields produce significant portion of Russian gold.", targetSectors: ["Gold Mining", "Silver Mining", "Fishing", "Energy"], opportunities: [
    { id: "ma-1", title: "Kolyma Goldfields Partnership", titleZh: "科雷马金矿合作", titleRu: "Партнёрство Колымских приисков", sector: "Gold", description: "Gold and silver mining expansion.", descriptionZh: "金银矿开采扩张。", descriptionRu: "Расширение добычи золота и серебра.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
    { id: "ma-2", title: "Magadan Seafood Processing", titleZh: "马加丹海产品加工", titleRu: "Магаданская переработка морепродуктов", sector: "Fishing", description: "Fish processing for Asian markets.", descriptionZh: "面向亚洲市场的鱼类加工。", descriptionRu: "Рыбопереработка для азиатских рынков.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Gold Capital", description: "Kolyma goldfields." }], contactInfo: { investmentAgency: "Magadan Investment Agency", website: "https://investmagadan.ru" } },
  "Chukotka Autonomous Okrug": { name: "Chukotka Autonomous Okrug", nameZh: "楚科奇自治区", nameRu: "Чукотский автономный округ", gdp: "$3 Billion", population: "0.05 Million", sezCount: 0, industries: ["Gold Mining", "Mining", "Fishing"], taxBenefits: ["Far East benefits", "Arctic zone benefits", "Mining incentives"], majorCities: [
    { id: "anadyr", name: "Anadyr", population: "0.01M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Russia's easternmost city. Remote Arctic mining and fishing region.", opportunities: [
      { id: "ana-1", title: "Chukotka Gold Projects", titleZh: "楚科奇黄金项目", titleRu: "Чукотские золотые проекты", sector: "Gold", description: "Major gold deposits including Kupol mine.", descriptionZh: "包括库波尔矿在内的主要金矿。", descriptionRu: "Крупные месторождения золота, включая рудник Купол.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "ana-2", title: "Bering Sea Fishing", titleZh: "白令海捕鱼", titleRu: "Берингоморский промысел", sector: "Fishing", description: "Remote fishing grounds.", descriptionZh: "偏远渔场。", descriptionRu: "Удалённые рыбопромысловые угодья.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Russia's easternmost region on Bering Strait. Major gold deposits. Extreme Arctic conditions.", targetSectors: ["Gold Mining", "Copper Mining", "Fishing"], opportunities: [
    { id: "ch-1", title: "Chukotka Mining Development", titleZh: "楚科奇采矿开发", titleRu: "Развитие горнодобычи Чукотки", sector: "Mining", description: "Gold, copper, and tin mining.", descriptionZh: "金、铜和锡矿开采。", descriptionRu: "Добыча золота, меди и олова.", investmentRange: "$60M - $600M", timeline: "4-6 years", status: "priority" },
    { id: "ch-2", title: "Arctic Shipping Support", titleZh: "北极航运支持", titleRu: "Поддержка арктического судоходства", sector: "Logistics", description: "Northern Sea Route services.", descriptionZh: "北方海航线服务。", descriptionRu: "Услуги Северного морского пути.", investmentRange: "$25M - $220M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Gold Deposits", description: "Major Arctic gold mining." }], contactInfo: { investmentAgency: "Chukotka Investment Agency", website: "https://investchukotka.ru" } },
  "Nenets Autonomous Okrug": { name: "Nenets Autonomous Okrug", nameZh: "涅涅茨自治区", nameRu: "Ненецкий автономный округ", gdp: "$8 Billion", population: "0.04 Million", sezCount: 0, industries: ["Oil & Gas", "Reindeer Herding"], taxBenefits: ["Arctic zone benefits", "Oil incentives", "Northern allowances"], majorCities: [
    { id: "naryan-mar", name: "Naryan-Mar", population: "0.02M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Arctic oil region capital. Timan-Pechora oil basin.", opportunities: [
      { id: "nar-1", title: "Timan-Pechora Oil Development", titleZh: "蒂曼-伯朝拉石油开发", titleRu: "Освоение Тимано-Печорской нефти", sector: "Oil", description: "Arctic oil production.", descriptionZh: "北极石油生产。", descriptionRu: "Арктическая нефтедобыча.", investmentRange: "$50M - $500M", timeline: "3-5 years", status: "priority" },
      { id: "nar-2", title: "Arctic Logistics Base", titleZh: "北极物流基地", titleRu: "Арктическая логистическая база", sector: "Logistics", description: "Support services for Arctic operations.", descriptionZh: "北极作业的支持服务。", descriptionRu: "Сервисные услуги для арктических операций.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Arctic oil region with highest per-capita GDP in Russia. Timan-Pechora oil and gas basin.", targetSectors: ["Oil & Gas", "Arctic Logistics", "Reindeer Products"], opportunities: [
    { id: "ne-1", title: "Nenets Oil Expansion", titleZh: "涅涅茨石油扩张", titleRu: "Расширение ненецкой нефтедобычи", sector: "Oil", description: "Arctic shelf and onshore oil.", descriptionZh: "北极陆架和陆上石油。", descriptionRu: "Арктический шельф и сухопутная нефть.", investmentRange: "$60M - $600M", timeline: "4-6 years", status: "priority" },
    { id: "ne-2", title: "Northern Sea Route Hub", titleZh: "北方海航线枢纽", titleRu: "Хаб Северного морского пути", sector: "Logistics", description: "Arctic shipping support.", descriptionZh: "北极航运支持。", descriptionRu: "Поддержка арктического судоходства.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Arctic Oil", description: "Major Arctic oil region." }], contactInfo: { investmentAgency: "Nenets Investment Agency", website: "https://investnenets.ru" } },
  "Republic of Ingushetia": { name: "Republic of Ingushetia", nameZh: "印古什共和国", nameRu: "Республика Ингушетия", gdp: "$1 Billion", population: "0.5 Million", sezCount: 0, industries: ["Agriculture", "Construction", "Tourism"], taxBenefits: ["North Caucasus incentives", "Development support"], majorCities: [
    { id: "magas", name: "Magas", population: "0.01M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Modern planned capital in scenic Caucasus mountains.", opportunities: [
      { id: "mgs-1", title: "Ingushetia Development", titleZh: "印古什发展", titleRu: "Развитие Ингушетии", sector: "Construction", description: "Infrastructure and urban development.", descriptionZh: "基础设施和城市发展。", descriptionRu: "Инфраструктура и городское развитие.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" },
      { id: "mgs-2", title: "Caucasus Mountain Tourism", titleZh: "高加索山旅游", titleRu: "Кавказский горный туризм", sector: "Tourism", description: "Mountain and cultural tourism.", descriptionZh: "山地和文化旅游。", descriptionRu: "Горный и культурный туризм.", investmentRange: "$10M - $90M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Small Caucasus republic with beautiful mountain scenery. Growing construction and tourism sectors.", targetSectors: ["Construction", "Tourism", "Agriculture"], opportunities: [
    { id: "in-1", title: "Ingushetia Infrastructure", titleZh: "印古什基础设施", titleRu: "Инфраструктура Ингушетии", sector: "Construction", description: "Infrastructure development projects.", descriptionZh: "基础设施发展项目。", descriptionRu: "Проекты развития инфраструктуры.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "in-2", title: "Ingushetia Tourism", titleZh: "印古什旅游", titleRu: "Туризм Ингушетии", sector: "Tourism", description: "Mountain tourism development.", descriptionZh: "山地旅游开发。", descriptionRu: "Развитие горного туризма.", investmentRange: "$10M - $90M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Mountain Scenery", description: "Beautiful Caucasus landscapes." }], contactInfo: { investmentAgency: "Ingushetia Investment Agency", website: "https://investingushetia.ru" } },
  "Karachay-Cherkess Republic": { name: "Karachay-Cherkess Republic", nameZh: "卡拉恰伊-切尔克斯共和国", nameRu: "Карачаево-Черкесская Республика", gdp: "$2 Billion", population: "0.5 Million", sezCount: 1, industries: ["Tourism", "Mining", "Agriculture"], taxBenefits: ["North Caucasus incentives", "Tourism support"], majorCities: [
    { id: "cherkessk", name: "Cherkessk", population: "0.1M", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", description: "Capital near famous Dombay ski resort.", opportunities: [
      { id: "ckk-1", title: "Dombay Ski Resort", titleZh: "多姆拜滑雪度假村", titleRu: "Горнолыжный курорт Домбай", sector: "Tourism", description: "Famous Caucasus ski resort.", descriptionZh: "著名的高加索滑雪度假村。", descriptionRu: "Знаменитый кавказский горнолыжный курорт.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "priority" },
      { id: "ckk-2", title: "Arkhyz Resort", titleZh: "阿尔希兹度假村", titleRu: "Курорт Архыз", sector: "Tourism", description: "New mountain resort development.", descriptionZh: "新山地度假村开发。", descriptionRu: "Развитие нового горного курорта.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Home to famous Dombay and Arkhyz ski resorts. Growing mountain tourism destination.", targetSectors: ["Ski Tourism", "Mining", "Agriculture"], opportunities: [
    { id: "kc-1", title: "Caucasus Ski Resorts", titleZh: "高加索滑雪度假村", titleRu: "Кавказские горнолыжные курорты", sector: "Tourism", description: "Dombay and Arkhyz resort expansion.", descriptionZh: "多姆拜和阿尔希兹度假村扩建。", descriptionRu: "Расширение курортов Домбай и Архыз.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "priority" },
    { id: "kc-2", title: "Karachay-Cherkessia Mining", titleZh: "卡拉恰伊-切尔克斯采矿", titleRu: "Горнодобыча КЧР", sector: "Mining", description: "Copper and gold mining.", descriptionZh: "铜和金矿开采。", descriptionRu: "Добыча меди и золота.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Ski Destination", description: "Dombay and Arkhyz resorts." }], contactInfo: { investmentAgency: "KCR Investment Agency", website: "https://investkchr.ru" } },
  "Kostroma Oblast": { name: "Kostroma Oblast", nameZh: "科斯特罗马州", nameRu: "Костромская область", gdp: "$4 Billion", population: "0.6 Million", sezCount: 0, industries: ["Forestry", "Jewelry", "Tourism", "Textiles"], taxBenefits: ["Forestry incentives", "Golden Ring tourism support"], majorCities: [
    { id: "kostroma", name: "Kostroma", population: "0.3M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Historic Golden Ring city. Famous for linen and jewelry.", opportunities: [
      { id: "kos-1", title: "Kostroma Linen Industry", titleZh: "科斯特罗马亚麻产业", titleRu: "Костромская льняная промышленность", sector: "Textiles", description: "Traditional Russian linen.", descriptionZh: "传统俄罗斯亚麻。", descriptionRu: "Традиционный русский лён.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" },
      { id: "kos-2", title: "Kostroma Jewelry", titleZh: "科斯特罗马珠宝", titleRu: "Костромские ювелирные изделия", sector: "Jewelry", description: "Russian jewelry manufacturing hub.", descriptionZh: "俄罗斯珠宝制造中心。", descriptionRu: "Хаб производства российских ювелирных изделий.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Golden Ring historic city famous for linen and jewelry production. Rich forestry resources.", targetSectors: ["Jewelry", "Textiles", "Forestry", "Tourism"], opportunities: [
    { id: "ks-1", title: "Russian Jewelry Hub", titleZh: "俄罗斯珠宝中心", titleRu: "Российский ювелирный хаб", sector: "Jewelry", description: "Major jewelry manufacturing center.", descriptionZh: "主要珠宝制造中心。", descriptionRu: "Крупный центр ювелирного производства.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
    { id: "ks-2", title: "Golden Ring Heritage Tourism", titleZh: "金环遗产旅游", titleRu: "Наследственный туризм Золотого кольца", sector: "Tourism", description: "Historic cultural tourism.", descriptionZh: "历史文化旅游。", descriptionRu: "Исторический культурный туризм.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Jewelry Capital", description: "Russia's jewelry manufacturing center." }], contactInfo: { investmentAgency: "Kostroma Investment Agency", website: "https://investkostroma.ru" } },
  "Kurgan Oblast": { name: "Kurgan Oblast", nameZh: "库尔干州", nameRu: "Курганская область", gdp: "$4 Billion", population: "0.8 Million", sezCount: 0, industries: ["Machinery", "Agriculture", "Pharmaceuticals"], taxBenefits: ["Manufacturing incentives", "Kazakhstan border benefits"], majorCities: [
    { id: "kurgan", name: "Kurgan", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Industrial city on Trans-Siberian Railway near Kazakhstan.", opportunities: [
      { id: "krg-1", title: "Kurgan Machinery", titleZh: "库尔干机械", titleRu: "Курганское машиностроение", sector: "Machinery", description: "Bus and military vehicle manufacturing.", descriptionZh: "公共汽车和军用车辆制造。", descriptionRu: "Производство автобусов и военной техники.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "krg-2", title: "Trans-Siberian Logistics", titleZh: "西伯利亚大铁路物流", titleRu: "Транссибирская логистика", sector: "Logistics", description: "Rail logistics hub.", descriptionZh: "铁路物流中心。", descriptionRu: "Железнодорожный логистический хаб.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Industrial center on Trans-Siberian Railway. Machinery and agricultural processing. Kazakhstan border trade.", targetSectors: ["Machinery", "Agriculture", "Logistics", "Pharmaceuticals"], opportunities: [
    { id: "kg-1", title: "Kurgan Industrial Cluster", titleZh: "库尔干工业集群", titleRu: "Курганский промышленный кластер", sector: "Manufacturing", description: "Machinery and vehicle production.", descriptionZh: "机械和车辆生产。", descriptionRu: "Производство машин и транспортных средств.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "kg-2", title: "Kazakhstan Border Trade", titleZh: "哈萨克斯坦边境贸易", titleRu: "Казахстанская приграничная торговля", sector: "Trade", description: "Cross-border trade hub.", descriptionZh: "跨境贸易中心。", descriptionRu: "Хаб трансграничной торговли.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "Rail Hub", description: "Trans-Siberian Railway junction." }], contactInfo: { investmentAgency: "Kurgan Investment Agency", website: "https://investkurgan.ru" } },
  "Novgorod Oblast": { name: "Novgorod Oblast", nameZh: "诺夫哥罗德州", nameRu: "Новгородская область", gdp: "$5 Billion", population: "0.6 Million", sezCount: 1, industries: ["Chemicals", "Electronics", "Food Processing", "Tourism"], taxBenefits: ["SEZ benefits", "Heritage tourism support"], majorCities: [
    { id: "veliky-novgorod", name: "Veliky Novgorod", population: "0.2M", image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1920&q=80", description: "Ancient Russian capital. UNESCO World Heritage Kremlin.", opportunities: [
      { id: "vnv-1", title: "Novgorod Chemical Complex", titleZh: "诺夫哥罗德化工综合体", titleRu: "Новгородский химический комплекс", sector: "Chemicals", description: "Acron fertilizer production.", descriptionZh: "阿克龙化肥生产。", descriptionRu: "Производство удобрений Акрон.", investmentRange: "$30M - $280M", timeline: "3-5 years", status: "active" },
      { id: "vnv-2", title: "Ancient Russia Tourism", titleZh: "古俄罗斯旅游", titleRu: "Туризм Древней Руси", sector: "Tourism", description: "UNESCO heritage tourism.", descriptionZh: "联合国教科文组织遗产旅游。", descriptionRu: "Туризм наследия ЮНЕСКО.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
    ]}
  ], overview: "Cradle of Russian statehood with UNESCO heritage. Major chemical industry (Acron). Electronics manufacturing.", targetSectors: ["Chemicals", "Electronics", "Heritage Tourism", "Food"], opportunities: [
    { id: "nv-1", title: "Acron Fertilizer Partnership", titleZh: "阿克龙化肥合作", titleRu: "Партнёрство с Акроном", sector: "Chemicals", description: "Major fertilizer production.", descriptionZh: "主要化肥生产。", descriptionRu: "Крупное производство удобрений.", investmentRange: "$40M - $350M", timeline: "3-5 years", status: "priority" },
    { id: "nv-2", title: "Veliky Novgorod Tourism", titleZh: "大诺夫哥罗德旅游", titleRu: "Туризм Великого Новгорода", sector: "Tourism", description: "Ancient capital heritage tourism.", descriptionZh: "古都遗产旅游。", descriptionRu: "Туризм наследия древней столицы.", investmentRange: "$15M - $130M", timeline: "2-4 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Ancient Capital", description: "Cradle of Russian statehood." }], contactInfo: { investmentAgency: "Novgorod Investment Agency", website: "https://investnovgorod.ru" } },
  "Oryol Oblast": { name: "Oryol Oblast", nameZh: "奥廖尔州", nameRu: "Орловская область", gdp: "$5 Billion", population: "0.7 Million", sezCount: 1, industries: ["Machinery", "Steel", "Agriculture", "Food Processing"], taxBenefits: ["Manufacturing incentives", "Agricultural support"], majorCities: [
    { id: "oryol", name: "Oryol", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Literary capital of Russia. Industrial and agricultural center.", opportunities: [
      { id: "orl-1", title: "Oryol Steel Production", titleZh: "奥廖尔钢铁生产", titleRu: "Орловское сталелитейное производство", sector: "Steel", description: "Steel and metal processing.", descriptionZh: "钢铁和金属加工。", descriptionRu: "Сталелитейное производство и металлообработка.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
      { id: "orl-2", title: "Oryol Agricultural Hub", titleZh: "奥廖尔农业中心", titleRu: "Орловский агрохаб", sector: "Agriculture", description: "Grain and livestock production.", descriptionZh: "粮食和畜牧生产。", descriptionRu: "Производство зерна и животноводство.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Central Russian industrial and agricultural region. Strong steel and machinery industries.", targetSectors: ["Steel", "Machinery", "Agriculture", "Food Processing"], opportunities: [
    { id: "or-1", title: "Oryol Industrial Park", titleZh: "奥廖尔工业园区", titleRu: "Орловский индустриальный парк", sector: "Manufacturing", description: "Diversified manufacturing.", descriptionZh: "多元化制造业。", descriptionRu: "Диверсифицированное производство.", investmentRange: "$30M - $280M", timeline: "2-4 years", status: "active" },
    { id: "or-2", title: "Central Russia Agriculture", titleZh: "俄罗斯中部农业", titleRu: "Сельское хозяйство Центральной России", sector: "Agriculture", description: "Grain and food processing.", descriptionZh: "粮食和食品加工。", descriptionRu: "Зернопереработка и пищевая промышленность.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "infrastructure", title: "Industrial Center", description: "Diversified manufacturing base." }], contactInfo: { investmentAgency: "Oryol Investment Agency", website: "https://investoryol.ru" } },
  "Tambov Oblast": { name: "Tambov Oblast", nameZh: "坦波夫州", nameRu: "Тамбовская область", gdp: "$6 Billion", population: "1.0 Million", sezCount: 1, industries: ["Agriculture", "Food Processing", "Chemicals", "Machinery"], taxBenefits: ["Agricultural subsidies", "Manufacturing incentives"], majorCities: [
    { id: "tambov", name: "Tambov", population: "0.3M", image: "https://images.unsplash.com/photo-1558985212-1512ae10b850?w=1920&q=80", description: "Agricultural center in Russia's black earth region.", opportunities: [
      { id: "tam-1", title: "Tambov Sugar Industry", titleZh: "坦波夫制糖业", titleRu: "Тамбовская сахарная промышленность", sector: "Food", description: "Sugar beet processing.", descriptionZh: "甜菜加工。", descriptionRu: "Переработка сахарной свёклы.", investmentRange: "$20M - $180M", timeline: "2-4 years", status: "active" },
      { id: "tam-2", title: "Black Earth Agriculture", titleZh: "黑土农业", titleRu: "Чернозёмное земледелие", sector: "Agriculture", description: "Premium agricultural land.", descriptionZh: "优质农业用地。", descriptionRu: "Премиальные сельскохозяйственные земли.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
    ]}
  ], overview: "Central Russian agricultural region with rich black earth. Major sugar and grain production.", targetSectors: ["Agriculture", "Sugar Processing", "Food Industry", "Machinery"], opportunities: [
    { id: "ta-1", title: "Tambov Agro-Industrial Complex", titleZh: "坦波夫农工综合体", titleRu: "Тамбовский агропромышленный комплекс", sector: "Agriculture", description: "Integrated agricultural processing.", descriptionZh: "综合农业加工。", descriptionRu: "Интегрированная сельхозпереработка.", investmentRange: "$25M - $220M", timeline: "2-4 years", status: "active" },
    { id: "ta-2", title: "Tambov Food Processing", titleZh: "坦波夫食品加工", titleRu: "Тамбовская пищепереработка", sector: "Food", description: "Food products for central Russia.", descriptionZh: "俄罗斯中部食品产品。", descriptionRu: "Продукты питания для центральной России.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "resources", title: "Black Earth", description: "Russia's most fertile soil." }], contactInfo: { investmentAgency: "Tambov Investment Agency", website: "https://investtambov.ru" } },
  "Jewish Autonomous Oblast": { name: "Jewish Autonomous Oblast", nameZh: "犹太自治州", nameRu: "Еврейская автономная область", gdp: "$2 Billion", population: "0.2 Million", sezCount: 1, industries: ["Mining", "Agriculture", "Manufacturing"], taxBenefits: ["Far East benefits", "Border zone incentives"], majorCities: [
    { id: "birobidzhan", name: "Birobidzhan", population: "0.07M", image: "https://images.unsplash.com/photo-1551972873-b7e8754e8e26?w=1920&q=80", description: "Capital on China border. Growing cross-border trade.", opportunities: [
      { id: "brb-1", title: "China Border Trade Zone", titleZh: "中国边境贸易区", titleRu: "Китайская пограничная торговая зона", sector: "Trade", description: "Direct trade with China's Heilongjiang.", descriptionZh: "与中国黑龙江的直接贸易。", descriptionRu: "Прямая торговля с китайским Хэйлунцзяном.", investmentRange: "$15M - $130M", timeline: "2-3 years", status: "priority" },
      { id: "brb-2", title: "JAO Mining Development", titleZh: "犹太自治州矿业开发", titleRu: "Развитие горнодобычи ЕАО", sector: "Mining", description: "Iron ore and tin mining.", descriptionZh: "铁矿石和锡矿开采。", descriptionRu: "Добыча железной руды и олова.", investmentRange: "$20M - $180M", timeline: "3-5 years", status: "active" }
    ]}
  ], overview: "Russia's only Jewish autonomous region on China border. Growing cross-border trade. Mining and agriculture.", targetSectors: ["Cross-border Trade", "Mining", "Agriculture", "Manufacturing"], opportunities: [
    { id: "ja-1", title: "Russia-China Border Hub", titleZh: "中俄边境中心", titleRu: "Российско-китайский пограничный хаб", sector: "Trade", description: "Trade zone on China border.", descriptionZh: "中国边境的贸易区。", descriptionRu: "Торговая зона на границе с Китаем.", investmentRange: "$20M - $180M", timeline: "2-3 years", status: "priority" },
    { id: "ja-2", title: "JAO Agricultural Export", titleZh: "犹太自治州农业出口", titleRu: "Сельскохозяйственный экспорт ЕАО", sector: "Agriculture", description: "Soybean production for China.", descriptionZh: "面向中国的大豆生产。", descriptionRu: "Производство сои для Китая.", investmentRange: "$10M - $90M", timeline: "2-3 years", status: "active" }
  ], keyProjects: [], advantages: [{ icon: "location", title: "China Border", description: "Direct access to Heilongjiang Province." }], contactInfo: { investmentAgency: "JAO Investment Agency", website: "https://investeao.ru" } },
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
  const params = useParams();
  const locale = params.locale as string;

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
                  {region.gdp} • {region.population}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(region.industries || []).slice(0, 3).map((industry) => (
                    <span
                      key={industry}
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
