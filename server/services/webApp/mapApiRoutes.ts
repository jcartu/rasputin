export type ApiStyle = "nextjs-app" | "nextjs-pages" | "trpc";

export function generateRegionsApiRoute(style: ApiStyle): string {
  if (style === "nextjs-app") {
    return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { regions, opportunities } from "@/lib/schema";
import { eq, sql, desc, and, like, or } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country");
    const search = searchParams.get("search");

    const conditions = [eq(regions.isActive, true)];

    if (country) {
      conditions.push(eq(regions.country, country));
    }

    if (search) {
      const searchCondition = or(
        like(regions.name, \`%\${search}%\`),
        like(regions.nameLocal, \`%\${search}%\`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const result = await db
      .select({
        id: regions.id,
        slug: regions.slug,
        name: regions.name,
        nameLocal: regions.nameLocal,
        country: regions.country,
        code: regions.code,
        centerLat: regions.centerLat,
        centerLng: regions.centerLng,
        opportunityCount: sql<number>\`(
          SELECT COUNT(*) FROM opportunities 
          WHERE opportunities.region_id = regions.id 
          AND opportunities.status = 'active'
        )\`,
      })
      .from(regions)
      .where(and(...conditions));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching regions:", error);
    return NextResponse.json(
      { error: "Failed to fetch regions" },
      { status: 500 }
    );
  }
}
`;
  }

  if (style === "trpc") {
    return `import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/lib/db";
import { regions, opportunities, inquiries } from "@/lib/schema";
import { eq, sql, desc, and, like, or, gte, lte } from "drizzle-orm";

export const regionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        country: z.enum(["china", "russia"]).optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const conditions = [eq(regions.isActive, true)];

      if (input?.country) {
        conditions.push(eq(regions.country, input.country));
      }

      if (input?.search) {
        const searchCondition = or(
          like(regions.name, \`%\${input.search}%\`),
          like(regions.nameLocal, \`%\${input.search}%\`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      return db
        .select({
          id: regions.id,
          slug: regions.slug,
          name: regions.name,
          nameLocal: regions.nameLocal,
          country: regions.country,
          code: regions.code,
          centerLat: regions.centerLat,
          centerLng: regions.centerLng,
          opportunityCount: sql<number>\`(
            SELECT COUNT(*) FROM opportunities 
            WHERE opportunities.region_id = regions.id 
            AND opportunities.status = 'active'
          )\`,
        })
        .from(regions)
        .where(and(...conditions));
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [region] = await db
        .select()
        .from(regions)
        .where(eq(regions.slug, input.slug))
        .limit(1);

      if (!region) {
        throw new Error("Region not found");
      }

      const regionOpportunities = await db
        .select()
        .from(opportunities)
        .where(
          and(
            eq(opportunities.regionId, region.id),
            eq(opportunities.status, "active")
          )
        )
        .orderBy(desc(opportunities.featured), desc(opportunities.createdAt));

      return {
        ...region,
        opportunities: regionOpportunities,
      };
    }),
});
`;
  }

  return "";
}

export function generateOpportunitiesApiRoute(style: ApiStyle): string {
  if (style === "nextjs-app") {
    return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { opportunities, regions } from "@/lib/schema";
import { eq, and, desc, gte, lte, like, or, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get("regionId");
    const sector = searchParams.get("sector");
    const minInvestment = searchParams.get("minInvestment");
    const maxInvestment = searchParams.get("maxInvestment");
    const search = searchParams.get("search");
    const featured = searchParams.get("featured");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let conditions = [eq(opportunities.status, "active")];

    if (regionId) {
      conditions.push(eq(opportunities.regionId, parseInt(regionId)));
    }

    if (sector) {
      conditions.push(eq(opportunities.sector, sector));
    }

    if (minInvestment) {
      conditions.push(gte(opportunities.investmentMin, minInvestment));
    }

    if (maxInvestment) {
      conditions.push(lte(opportunities.investmentMax, maxInvestment));
    }

    if (search) {
      const searchCondition = or(
        like(opportunities.title, \`%\${search}%\`),
        like(opportunities.description, \`%\${search}%\`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (featured === "true") {
      conditions.push(eq(opportunities.featured, true));
    }

    const result = await db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        description: opportunities.description,
        sector: opportunities.sector,
        investmentMin: opportunities.investmentMin,
        investmentMax: opportunities.investmentMax,
        investmentCurrency: opportunities.investmentCurrency,
        featured: opportunities.featured,
        createdAt: opportunities.createdAt,
        regionId: opportunities.regionId,
        regionName: regions.name,
        regionCountry: regions.country,
      })
      .from(opportunities)
      .leftJoin(regions, eq(opportunities.regionId, regions.id))
      .where(and(...conditions))
      .orderBy(desc(opportunities.featured), desc(opportunities.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>\`count(*)\` })
      .from(opportunities)
      .where(and(...conditions));

    return NextResponse.json({
      opportunities: result,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const [newOpportunity] = await db
      .insert(opportunities)
      .values({
        regionId: body.regionId,
        title: body.title,
        description: body.description,
        sector: body.sector,
        investmentMin: body.investmentMin,
        investmentMax: body.investmentMax,
        investmentCurrency: body.investmentCurrency || "USD",
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        websiteUrl: body.websiteUrl,
        requirements: body.requirements || [],
        benefits: body.benefits || [],
        status: "pending",
      })
      .returning();

    return NextResponse.json(newOpportunity, { status: 201 });
  } catch (error) {
    console.error("Error creating opportunity:", error);
    return NextResponse.json(
      { error: "Failed to create opportunity" },
      { status: 500 }
    );
  }
}
`;
  }

  if (style === "trpc") {
    return `import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { opportunities, regions } from "@/lib/schema";
import { eq, and, desc, gte, lte, like, or, sql } from "drizzle-orm";

export const opportunitiesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        regionId: z.number().optional(),
        sector: z.string().optional(),
        minInvestment: z.string().optional(),
        maxInvestment: z.string().optional(),
        search: z.string().optional(),
        featured: z.boolean().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      let conditions = [eq(opportunities.status, "active")];

      if (input?.regionId) {
        conditions.push(eq(opportunities.regionId, input.regionId));
      }

      if (input?.sector) {
        conditions.push(eq(opportunities.sector, input.sector));
      }

      if (input?.minInvestment) {
        conditions.push(gte(opportunities.investmentMin, input.minInvestment));
      }

      if (input?.maxInvestment) {
        conditions.push(lte(opportunities.investmentMax, input.maxInvestment));
      }

      if (input?.search) {
        const searchCondition = or(
          like(opportunities.title, \`%\${input.search}%\`),
          like(opportunities.description, \`%\${input.search}%\`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      if (input?.featured) {
        conditions.push(eq(opportunities.featured, true));
      }

      const result = await db
        .select({
          id: opportunities.id,
          title: opportunities.title,
          description: opportunities.description,
          sector: opportunities.sector,
          investmentMin: opportunities.investmentMin,
          investmentMax: opportunities.investmentMax,
          featured: opportunities.featured,
          createdAt: opportunities.createdAt,
          regionName: regions.name,
          regionCountry: regions.country,
        })
        .from(opportunities)
        .leftJoin(regions, eq(opportunities.regionId, regions.id))
        .where(and(...conditions))
        .orderBy(desc(opportunities.featured), desc(opportunities.createdAt))
        .limit(input?.limit || 50)
        .offset(input?.offset || 0);

      return result;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [opp] = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, input.id))
        .limit(1);

      if (!opp) {
        throw new Error("Opportunity not found");
      }

      await db
        .update(opportunities)
        .set({ viewCount: sql\`view_count + 1\` })
        .where(eq(opportunities.id, input.id));

      return opp;
    }),

  create: protectedProcedure
    .input(
      z.object({
        regionId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().min(1),
        sector: z.string().min(1).max(100),
        investmentMin: z.string().optional(),
        investmentMax: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        websiteUrl: z.string().url().optional(),
        requirements: z.array(z.string()).optional(),
        benefits: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [newOpp] = await db
        .insert(opportunities)
        .values({
          ...input,
          status: "pending",
        })
        .returning();

      return newOpp;
    }),
});
`;
  }

  return "";
}

export function generateInquiriesApiRoute(style: ApiStyle): string {
  if (style === "nextjs-app") {
    return `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inquiries, opportunities } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const [opportunity] = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, body.opportunityId))
      .limit(1);

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    const [newInquiry] = await db
      .insert(inquiries)
      .values({
        opportunityId: body.opportunityId,
        name: body.name,
        email: body.email,
        company: body.company,
        phone: body.phone,
        message: body.message,
        status: "pending",
      })
      .returning();

    return NextResponse.json(newInquiry, { status: 201 });
  } catch (error) {
    console.error("Error creating inquiry:", error);
    return NextResponse.json(
      { error: "Failed to submit inquiry" },
      { status: 500 }
    );
  }
}
`;
  }

  if (style === "trpc") {
    return `import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/lib/db";
import { inquiries, opportunities } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const inquiriesRouter = router({
  create: publicProcedure
    .input(
      z.object({
        opportunityId: z.number(),
        name: z.string().min(1).max(255),
        email: z.string().email(),
        company: z.string().optional(),
        phone: z.string().optional(),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const [opportunity] = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, input.opportunityId))
        .limit(1);

      if (!opportunity) {
        throw new Error("Opportunity not found");
      }

      const [newInquiry] = await db
        .insert(inquiries)
        .values({
          ...input,
          status: "pending",
        })
        .returning();

      return newInquiry;
    }),
});
`;
  }

  return "";
}

export function generateDbConfig(): string {
  return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
`;
}

export function generateEnvExample(): string {
  return `# Database
DATABASE_URL=postgresql://user:password@localhost:5432/regional_map

# Optional: Analytics
NEXT_PUBLIC_GA_ID=

# Optional: Email (for inquiry notifications)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
NOTIFICATION_EMAIL=
`;
}
