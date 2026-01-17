export type DatabaseType = "postgresql" | "mysql" | "sqlite";

export interface SchemaConfig {
  database: DatabaseType;
  includeAuth?: boolean;
  includeTimestamps?: boolean;
}

export function generateDrizzleSchema(config: SchemaConfig): string {
  const { database, includeTimestamps = true } = config;

  const timestampImport = database === "postgresql" ? "timestamp" : "datetime";
  const textType = database === "postgresql" ? "text" : "varchar";
  const serialType = database === "postgresql" ? "serial" : "int";
  const timestampDefault =
    database === "postgresql"
      ? "defaultNow()"
      : "default(sql`CURRENT_TIMESTAMP`)";

  const typeImports = Array.from(
    new Set([serialType, textType, "varchar", timestampImport])
  );

  return `import {
  ${database === "postgresql" ? "pgTable" : database === "mysql" ? "mysqlTable" : "sqliteTable"} as createTable,
  ${typeImports.join(",\n  ")},
  integer,
  decimal,
  boolean,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/${database === "postgresql" ? "pg" : database}-core";
import { relations } from "drizzle-orm";
${database !== "postgresql" ? 'import { sql } from "drizzle-orm";' : ""}

export const regions = createTable(
  "regions",
  {
    id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    nameLocal: varchar("name_local", { length: 255 }),
    country: varchar("country", { length: 50 }).notNull(),
    code: varchar("code", { length: 10 }).notNull(),
    description: ${textType}("description"),
    population: integer("population"),
    gdp: decimal("gdp", { precision: 15, scale: 2 }),
    centerLat: decimal("center_lat", { precision: 10, scale: 6 }),
    centerLng: decimal("center_lng", { precision: 10, scale: 6 }),
    keyIndustries: json("key_industries").$type<string[]>().default([]),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    isActive: boolean("is_active").default(true),
    ${
      includeTimestamps
        ? `createdAt: ${timestampImport}("created_at").${timestampDefault},
    updatedAt: ${timestampImport}("updated_at").${timestampDefault},`
        : ""
    }
  },
  (table) => ({
    countryIdx: index("region_country_idx").on(table.country),
    slugIdx: uniqueIndex("region_slug_idx").on(table.slug),
  })
);

export const opportunities = createTable(
  "opportunities",
  {
    id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: ${textType}("description").notNull(),
    sector: varchar("sector", { length: 100 }).notNull(),
    investmentMin: decimal("investment_min", { precision: 15, scale: 2 }),
    investmentMax: decimal("investment_max", { precision: 15, scale: 2 }),
    investmentCurrency: varchar("investment_currency", { length: 3 }).default("USD"),
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    websiteUrl: varchar("website_url", { length: 500 }),
    requirements: json("requirements").$type<string[]>().default([]),
    benefits: json("benefits").$type<string[]>().default([]),
    status: varchar("status", { length: 50 }).default("active"),
    featured: boolean("featured").default(false),
    viewCount: integer("view_count").default(0),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    ${
      includeTimestamps
        ? `createdAt: ${timestampImport}("created_at").${timestampDefault},
    updatedAt: ${timestampImport}("updated_at").${timestampDefault},
    expiresAt: ${timestampImport}("expires_at"),`
        : ""
    }
  },
  (table) => ({
    regionIdx: index("opp_region_idx").on(table.regionId),
    sectorIdx: index("opp_sector_idx").on(table.sector),
    statusIdx: index("opp_status_idx").on(table.status),
    featuredIdx: index("opp_featured_idx").on(table.featured),
  })
);

export const sectors = createTable("sectors", {
  id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameLocal: varchar("name_local", { length: 255 }),
  description: ${textType}("description"),
  icon: varchar("icon", { length: 100 }),
  color: varchar("color", { length: 20 }),
  parentId: integer("parent_id"),
  sortOrder: integer("sort_order").default(0),
  ${includeTimestamps ? `createdAt: ${timestampImport}("created_at").${timestampDefault},` : ""}
});

export const inquiries = createTable(
  "inquiries",
  {
    id: ${serialType}("id").primaryKey()${database !== "postgresql" ? ".autoincrement()" : ""},
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    message: ${textType}("message").notNull(),
    status: varchar("status", { length: 50 }).default("pending"),
    ${
      includeTimestamps
        ? `createdAt: ${timestampImport}("created_at").${timestampDefault},
    respondedAt: ${timestampImport}("responded_at"),`
        : ""
    }
  },
  (table) => ({
    oppIdx: index("inquiry_opp_idx").on(table.opportunityId),
    statusIdx: index("inquiry_status_idx").on(table.status),
  })
);

export const regionsRelations = relations(regions, ({ many }) => ({
  opportunities: many(opportunities),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  region: one(regions, {
    fields: [opportunities.regionId],
    references: [regions.id],
  }),
  inquiries: many(inquiries),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [inquiries.opportunityId],
    references: [opportunities.id],
  }),
}));

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type Sector = typeof sectors.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
`;
}

export function generatePrismaSchema(config: SchemaConfig): string {
  const { database } = config;

  const providerMap = {
    postgresql: "postgresql",
    mysql: "mysql",
    sqlite: "sqlite",
  };

  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${providerMap[database]}"
  url      = env("DATABASE_URL")
}

model Region {
  id            Int           @id @default(autoincrement())
  slug          String        @unique @db.VarChar(100)
  name          String        @db.VarChar(255)
  nameLocal     String?       @map("name_local") @db.VarChar(255)
  country       String        @db.VarChar(50)
  code          String        @db.VarChar(10)
  description   String?       @db.Text
  population    Int?
  gdp           Decimal?      @db.Decimal(15, 2)
  centerLat     Decimal?      @map("center_lat") @db.Decimal(10, 6)
  centerLng     Decimal?      @map("center_lng") @db.Decimal(10, 6)
  keyIndustries Json          @default("[]") @map("key_industries")
  metadata      Json?
  isActive      Boolean       @default(true) @map("is_active")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  opportunities Opportunity[]

  @@index([country])
  @@map("regions")
}

model Opportunity {
  id                 Int        @id @default(autoincrement())
  regionId           Int        @map("region_id")
  title              String     @db.VarChar(255)
  description        String     @db.Text
  sector             String     @db.VarChar(100)
  investmentMin      Decimal?   @map("investment_min") @db.Decimal(15, 2)
  investmentMax      Decimal?   @map("investment_max") @db.Decimal(15, 2)
  investmentCurrency String     @default("USD") @map("investment_currency") @db.VarChar(3)
  contactName        String?    @map("contact_name") @db.VarChar(255)
  contactEmail       String?    @map("contact_email") @db.VarChar(255)
  contactPhone       String?    @map("contact_phone") @db.VarChar(50)
  websiteUrl         String?    @map("website_url") @db.VarChar(500)
  requirements       Json       @default("[]")
  benefits           Json       @default("[]")
  status             String     @default("active") @db.VarChar(50)
  featured           Boolean    @default(false)
  viewCount          Int        @default(0) @map("view_count")
  metadata           Json?
  createdAt          DateTime   @default(now()) @map("created_at")
  updatedAt          DateTime   @updatedAt @map("updated_at")
  expiresAt          DateTime?  @map("expires_at")

  region    Region     @relation(fields: [regionId], references: [id], onDelete: Cascade)
  inquiries Inquiry[]

  @@index([regionId])
  @@index([sector])
  @@index([status])
  @@index([featured])
  @@map("opportunities")
}

model Sector {
  id          Int      @id @default(autoincrement())
  slug        String   @unique @db.VarChar(100)
  name        String   @db.VarChar(255)
  nameLocal   String?  @map("name_local") @db.VarChar(255)
  description String?  @db.Text
  icon        String?  @db.VarChar(100)
  color       String?  @db.VarChar(20)
  parentId    Int?     @map("parent_id")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("sectors")
}

model Inquiry {
  id            Int       @id @default(autoincrement())
  opportunityId Int       @map("opportunity_id")
  name          String    @db.VarChar(255)
  email         String    @db.VarChar(255)
  company       String?   @db.VarChar(255)
  phone         String?   @db.VarChar(50)
  message       String    @db.Text
  status        String    @default("pending") @db.VarChar(50)
  createdAt     DateTime  @default(now()) @map("created_at")
  respondedAt   DateTime? @map("responded_at")

  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@index([opportunityId])
  @@index([status])
  @@map("inquiries")
}
`;
}

export function generateSeedData(): string {
  return `import { db } from "../lib/db";
import { regions, opportunities, sectors } from "../lib/schema";

const chinaRegions = [
  { slug: "beijing", name: "Beijing", nameLocal: "北京", country: "china", code: "BJ", centerLat: "39.9", centerLng: "116.4", population: 21540000, keyIndustries: ["Technology", "Finance", "Government"] },
  { slug: "shanghai", name: "Shanghai", nameLocal: "上海", country: "china", code: "SH", centerLat: "31.2", centerLng: "121.5", population: 24280000, keyIndustries: ["Finance", "Trade", "Manufacturing"] },
  { slug: "guangdong", name: "Guangdong", nameLocal: "广东", country: "china", code: "GD", centerLat: "23.1", centerLng: "113.3", population: 126010000, keyIndustries: ["Electronics", "Manufacturing", "Export"] },
  { slug: "zhejiang", name: "Zhejiang", nameLocal: "浙江", country: "china", code: "ZJ", centerLat: "30.3", centerLng: "120.2", population: 64560000, keyIndustries: ["E-commerce", "Textiles", "Technology"] },
  { slug: "jiangsu", name: "Jiangsu", nameLocal: "江苏", country: "china", code: "JS", centerLat: "32.1", centerLng: "118.8", population: 84750000, keyIndustries: ["Manufacturing", "Technology", "Chemicals"] },
  { slug: "shandong", name: "Shandong", nameLocal: "山东", country: "china", code: "SD", centerLat: "36.7", centerLng: "117.0", population: 101530000, keyIndustries: ["Agriculture", "Heavy Industry", "Petrochemicals"] },
  { slug: "sichuan", name: "Sichuan", nameLocal: "四川", country: "china", code: "SC", centerLat: "30.7", centerLng: "104.1", population: 83740000, keyIndustries: ["Electronics", "Agriculture", "Tourism"] },
  { slug: "heilongjiang", name: "Heilongjiang", nameLocal: "黑龙江", country: "china", code: "HL", centerLat: "45.8", centerLng: "126.6", population: 31850000, keyIndustries: ["Agriculture", "Energy", "Heavy Industry"] },
];

const russiaRegions = [
  { slug: "moscow", name: "Moscow", nameLocal: "Москва", country: "russia", code: "MOW", centerLat: "55.8", centerLng: "37.6", population: 12655000, keyIndustries: ["Finance", "Technology", "Services"] },
  { slug: "spb", name: "Saint Petersburg", nameLocal: "Санкт-Петербург", country: "russia", code: "SPE", centerLat: "59.9", centerLng: "30.3", population: 5384000, keyIndustries: ["Shipbuilding", "Technology", "Tourism"] },
  { slug: "novosibirsk", name: "Novosibirsk Oblast", nameLocal: "Новосибирская область", country: "russia", code: "NVS", centerLat: "55.0", centerLng: "83.0", population: 2798000, keyIndustries: ["Science", "IT", "Manufacturing"] },
  { slug: "primorsky", name: "Primorsky Krai", nameLocal: "Приморский край", country: "russia", code: "PRI", centerLat: "44.0", centerLng: "133.0", population: 1895000, keyIndustries: ["Shipping", "Fishing", "Trade"] },
  { slug: "khabarovsk", name: "Khabarovsk Krai", nameLocal: "Хабаровский край", country: "russia", code: "KHA", centerLat: "48.5", centerLng: "135.1", population: 1316000, keyIndustries: ["Forestry", "Mining", "Transport"] },
  { slug: "amur", name: "Amur Oblast", nameLocal: "Амурская область", country: "russia", code: "AMU", centerLat: "50.3", centerLng: "128.0", population: 790000, keyIndustries: ["Agriculture", "Mining", "Energy"] },
  { slug: "zabaykalsky", name: "Zabaykalsky Krai", nameLocal: "Забайкальский край", country: "russia", code: "ZAB", centerLat: "52.0", centerLng: "113.5", population: 1053000, keyIndustries: ["Mining", "Agriculture", "Energy"] },
];

const sectorData = [
  { slug: "technology", name: "Technology", icon: "💻", color: "#3B82F6" },
  { slug: "manufacturing", name: "Manufacturing", icon: "🏭", color: "#6B7280" },
  { slug: "agriculture", name: "Agriculture", icon: "🌾", color: "#22C55E" },
  { slug: "energy", name: "Energy", icon: "⚡", color: "#F59E0B" },
  { slug: "finance", name: "Finance", icon: "💰", color: "#8B5CF6" },
  { slug: "logistics", name: "Logistics & Trade", icon: "🚚", color: "#EF4444" },
  { slug: "real-estate", name: "Real Estate", icon: "🏢", color: "#06B6D4" },
  { slug: "healthcare", name: "Healthcare", icon: "🏥", color: "#EC4899" },
  { slug: "tourism", name: "Tourism", icon: "✈️", color: "#14B8A6" },
  { slug: "education", name: "Education", icon: "📚", color: "#F97316" },
];

const sampleOpportunities = [
  {
    regionSlug: "beijing",
    title: "AI Research Partnership",
    description: "Joint venture opportunity for AI/ML research and development with leading Chinese tech companies.",
    sector: "technology",
    investmentMin: 5000000,
    investmentMax: 50000000,
  },
  {
    regionSlug: "shanghai",
    title: "Fintech Innovation Hub",
    description: "Investment opportunity in Shanghai's growing fintech ecosystem with government support.",
    sector: "finance",
    investmentMin: 10000000,
    investmentMax: 100000000,
  },
  {
    regionSlug: "primorsky",
    title: "Pacific Gateway Logistics",
    description: "Development of logistics infrastructure connecting China-Russia trade routes through Vladivostok.",
    sector: "logistics",
    investmentMin: 20000000,
    investmentMax: 200000000,
  },
  {
    regionSlug: "moscow",
    title: "Tech Startup Incubator",
    description: "Co-investment opportunity in Moscow's growing tech startup ecosystem.",
    sector: "technology",
    investmentMin: 1000000,
    investmentMax: 10000000,
  },
  {
    regionSlug: "heilongjiang",
    title: "Cross-Border Agricultural Zone",
    description: "Agricultural cooperation project leveraging Russian farmland and Chinese technology.",
    sector: "agriculture",
    investmentMin: 15000000,
    investmentMax: 80000000,
  },
];

async function seed() {
  console.log("Seeding database...");

  // Insert sectors
  console.log("Inserting sectors...");
  await db.insert(sectors).values(sectorData);

  // Insert China regions
  console.log("Inserting China regions...");
  const insertedChinaRegions = await db.insert(regions).values(chinaRegions).returning();

  // Insert Russia regions
  console.log("Inserting Russia regions...");
  const insertedRussiaRegions = await db.insert(regions).values(russiaRegions).returning();

  const allRegions = [...insertedChinaRegions, ...insertedRussiaRegions];

  // Insert sample opportunities
  console.log("Inserting sample opportunities...");
  for (const opp of sampleOpportunities) {
    const region = allRegions.find((r) => r.slug === opp.regionSlug);
    if (region) {
      await db.insert(opportunities).values({
        regionId: region.id,
        title: opp.title,
        description: opp.description,
        sector: opp.sector,
        investmentMin: opp.investmentMin.toString(),
        investmentMax: opp.investmentMax.toString(),
        status: "active",
      });
    }
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
`;
}
