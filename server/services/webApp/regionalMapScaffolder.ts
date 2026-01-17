import * as fs from "fs";
import * as path from "path";
import {
  generateMapComponentCode,
  generateDualMapComponentCode,
  generateRegionPageCode,
  getMapDependencies,
  getMapDevDependencies,
  CHINA_PROVINCES,
  RUSSIA_REGIONS,
  type MapConfig,
} from "./mapComponents";
import {
  generateDrizzleSchema,
  generateSeedData,
  type DatabaseType,
} from "./mapSchemas";
import {
  generateRegionsApiRoute,
  generateOpportunitiesApiRoute,
  generateInquiriesApiRoute,
  generateDbConfig,
  generateEnvExample,
} from "./mapApiRoutes";

export interface RegionalMapConfig {
  projectName: string;
  outputPath: string;
  database?: DatabaseType;
  colorScheme?: "blue" | "green" | "orange" | "purple";
  countries?: ("china" | "russia")[];
  includeAuth?: boolean;
}

export interface ScaffoldResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  error?: string;
}

export async function scaffoldRegionalMapProject(
  config: RegionalMapConfig
): Promise<ScaffoldResult> {
  const {
    projectName,
    outputPath,
    database = "postgresql",
    colorScheme = "blue",
    countries = ["china", "russia"],
    includeAuth = false,
  } = config;

  const projectPath = path.join(outputPath, projectName);
  const filesCreated: string[] = [];

  try {
    const dirs = [
      "app",
      "app/api/regions",
      "app/api/opportunities",
      "app/api/inquiries",
      "app/region/[regionId]",
      "components",
      "components/map",
      "lib",
      "public",
      "scripts",
      "types",
    ];

    dirs.forEach(dir => {
      const fullPath = path.join(projectPath, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });

    const packageJson = {
      name: projectName,
      version: "0.1.0",
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
      dependencies: {
        next: "^14.2.0",
        react: "^18.3.0",
        "react-dom": "^18.3.0",
        "react-simple-maps": "^3.0.0",
        "@tanstack/react-query": "^5.0.0",
        "d3-geo": "^3.1.0",
        "drizzle-orm": "^0.30.0",
        pg: "^8.11.0",
        zod: "^3.23.0",
        "lucide-react": "^0.400.0",
        clsx: "^2.1.0",
        "tailwind-merge": "^2.3.0",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        "@types/d3-geo": "^3.1.0",
        "@types/pg": "^8.11.0",
        typescript: "^5",
        "drizzle-kit": "^0.21.0",
        tailwindcss: "^3.4.0",
        postcss: "^8.4.0",
        autoprefixer: "^10.4.0",
        tsx: "^4.15.0",
      },
    };
    writeFile(
      projectPath,
      "package.json",
      JSON.stringify(packageJson, null, 2),
      filesCreated
    );

    const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
}

module.exports = nextConfig
`;
    writeFile(projectPath, "next.config.js", nextConfig, filesCreated);

    const tsconfig = {
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
        paths: { "@/*": ["./*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    };
    writeFile(
      projectPath,
      "tsconfig.json",
      JSON.stringify(tsconfig, null, 2),
      filesCreated
    );

    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
    writeFile(projectPath, "tailwind.config.js", tailwindConfig, filesCreated);

    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
    writeFile(projectPath, "postcss.config.js", postcssConfig, filesCreated);

    const drizzleConfig = `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "${database}",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`;
    writeFile(projectPath, "drizzle.config.ts", drizzleConfig, filesCreated);

    writeFile(projectPath, ".env.example", generateEnvExample(), filesCreated);

    const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground: #171717;
  --background: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground: #ededed;
    --background: #0a0a0a;
  }
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: system-ui, -apple-system, sans-serif;
}
`;
    writeFile(projectPath, "app/globals.css", globalsCss, filesCreated);

    const layout = `import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: '${projectName} - Regional Business Opportunities',
  description: 'Discover business opportunities across China and Russia regions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <a href="/" className="text-2xl font-bold text-gray-900">
                ${projectName}
              </a>
              <div className="flex items-center gap-6">
                <a href="/opportunities" className="text-gray-600 hover:text-gray-900">
                  Opportunities
                </a>
                <a href="/sectors" className="text-gray-600 hover:text-gray-900">
                  Sectors
                </a>
                <a href="/about" className="text-gray-600 hover:text-gray-900">
                  About
                </a>
              </div>
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  )
}
`;
    writeFile(projectPath, "app/layout.tsx", layout, filesCreated);

    const providersComponent = `"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
`;
    writeFile(
      projectPath,
      "components/Providers.tsx",
      providersComponent,
      filesCreated
    );

    const homePage = generateHomePageCode(projectName, countries, colorScheme);
    writeFile(projectPath, "app/page.tsx", homePage, filesCreated);

    const mapConfig: MapConfig = {
      country: "both",
      colorScheme,
      enableZoom: true,
    };
    writeFile(
      projectPath,
      "components/map/InteractiveMap.tsx",
      generateMapComponentCode(mapConfig),
      filesCreated
    );
    writeFile(
      projectPath,
      "components/map/DualMapView.tsx",
      generateDualMapComponentCode(mapConfig),
      filesCreated
    );

    writeFile(
      projectPath,
      "app/region/[regionId]/page.tsx",
      generateRegionPageCode(),
      filesCreated
    );

    writeFile(
      projectPath,
      "lib/schema.ts",
      generateDrizzleSchema({ database, includeTimestamps: true }),
      filesCreated
    );
    writeFile(projectPath, "lib/db.ts", generateDbConfig(), filesCreated);

    writeFile(
      projectPath,
      "app/api/regions/route.ts",
      generateRegionsApiRoute("nextjs-app"),
      filesCreated
    );
    writeFile(
      projectPath,
      "app/api/opportunities/route.ts",
      generateOpportunitiesApiRoute("nextjs-app"),
      filesCreated
    );
    writeFile(
      projectPath,
      "app/api/inquiries/route.ts",
      generateInquiriesApiRoute("nextjs-app"),
      filesCreated
    );

    writeFile(projectPath, "scripts/seed.ts", generateSeedData(), filesCreated);

    const reactSimpleMapsTypes = `declare module "react-simple-maps" {
  import { ComponentType, ReactNode } from "react";

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
    };
  }

  export interface GeographyProps {
    geography: Geography;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
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
    writeFile(
      projectPath,
      "types/react-simple-maps.d.ts",
      reactSimpleMapsTypes,
      filesCreated
    );

    const readme = generateReadme(projectName, database);
    writeFile(projectPath, "README.md", readme, filesCreated);

    const gitignore = `# dependencies
node_modules
.pnpm-store

# next.js
.next/
out/

# production
build
dist

# misc
.DS_Store
*.pem

# local env files
.env
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# drizzle
drizzle/
`;
    writeFile(projectPath, ".gitignore", gitignore, filesCreated);

    return {
      success: true,
      projectPath,
      filesCreated,
    };
  } catch (error) {
    return {
      success: false,
      projectPath,
      filesCreated,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function writeFile(
  projectPath: string,
  filePath: string,
  content: string,
  filesCreated: string[]
) {
  const fullPath = path.join(projectPath, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  filesCreated.push(filePath);
}

function generateHomePageCode(
  projectName: string,
  countries: string[],
  colorScheme: string
): string {
  return `"use client";

import { useQuery } from "@tanstack/react-query";
import DualMapView from "@/components/map/DualMapView";

interface Region {
  id: number;
  slug: string;
  name: string;
  nameLocal?: string;
  country: string;
  code: string;
  opportunityCount?: number;
}

async function fetchRegions(country?: string): Promise<Region[]> {
  const url = country ? \`/api/regions?country=\${country}\` : "/api/regions";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch regions");
  return res.json();
}

export default function HomePage() {
  const { data: chinaRegions = [], isLoading: chinaLoading } = useQuery({
    queryKey: ["regions", "china"],
    queryFn: () => fetchRegions("china"),
  });

  const { data: russiaRegions = [], isLoading: russiaLoading } = useQuery({
    queryKey: ["regions", "russia"],
    queryFn: () => fetchRegions("russia"),
  });

  const isLoading = chinaLoading || russiaLoading;

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            ${projectName}
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Discover business opportunities across China and Russia.
            Click on any region to explore investment opportunities, partnerships, and more.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <StatCard
            title="Total Regions"
            value={chinaRegions.length + russiaRegions.length}
            subtitle="China & Russia"
          />
          <StatCard
            title="China Provinces"
            value={chinaRegions.length}
            subtitle="Click to explore"
          />
          <StatCard
            title="Russia Regions"
            value={russiaRegions.length}
            subtitle="Click to explore"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          <DualMapView
            chinaRegions={chinaRegions.map(r => ({
              id: r.slug,
              name: r.name,
              nameLocal: r.nameLocal,
              code: r.code,
              opportunityCount: r.opportunityCount,
            }))}
            russiaRegions={russiaRegions.map(r => ({
              id: r.slug,
              name: r.name,
              nameLocal: r.nameLocal,
              code: r.code,
              opportunityCount: r.opportunityCount,
            }))}
          />
        )}
      </section>

      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🗺️"
              title="Explore Regions"
              description="Click on any region on the map to see detailed information and opportunities."
            />
            <FeatureCard
              icon="💼"
              title="Find Opportunities"
              description="Browse investment opportunities, partnerships, and business ventures."
            />
            <FeatureCard
              icon="📧"
              title="Connect"
              description="Submit inquiries directly to opportunity owners and start building partnerships."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-4xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
`;
}

function generateReadme(projectName: string, database: string): string {
  return `# ${projectName}

A regional business opportunity platform for China-Russia collaboration, built with Next.js, React Simple Maps, and Drizzle ORM.

## Features

- 🗺️ Interactive clickable maps for China provinces and Russia regions
- 💼 Business opportunity listings per region
- 📊 Regional statistics (population, GDP, key industries)
- 📧 Inquiry system for opportunities
- 🔍 Search and filter functionality

## Getting Started

### Prerequisites

- Node.js 18+
- ${database === "postgresql" ? "PostgreSQL" : database === "mysql" ? "MySQL" : "SQLite"} database

### Installation

\`\`\`bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update DATABASE_URL in .env with your database connection string

# Run database migrations
npm run db:push

# Seed the database with initial data
npm run db:seed

# Start development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

\`\`\`
├── app/
│   ├── api/              # API routes
│   │   ├── regions/
│   │   ├── opportunities/
│   │   └── inquiries/
│   ├── region/[regionId]/ # Dynamic region pages
│   ├── layout.tsx
│   └── page.tsx          # Home page with map
├── components/
│   ├── map/              # Map components
│   │   ├── InteractiveMap.tsx
│   │   └── DualMapView.tsx
│   └── Providers.tsx
├── lib/
│   ├── db.ts             # Database connection
│   └── schema.ts         # Drizzle schema
└── scripts/
    └── seed.ts           # Database seeding
\`\`\`

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Maps**: react-simple-maps
- **Database**: ${database === "postgresql" ? "PostgreSQL" : database === "mysql" ? "MySQL" : "SQLite"} with Drizzle ORM
- **State Management**: TanStack Query

## Customization

### Adding New Regions

Edit \`scripts/seed.ts\` to add new regions and re-run:

\`\`\`bash
npm run db:seed
\`\`\`

### Changing Map Colors

Update the color scheme in \`components/map/InteractiveMap.tsx\`.

### Adding New Opportunity Sectors

Add sectors to the \`sectors\` table via the seed script or admin interface.

## License

MIT
`;
}
