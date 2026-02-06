import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

// ============================================================================
// Zod Schemas
// ============================================================================

const PromptCategorySchema = z.enum([
  "general",
  "coding",
  "writing",
  "analysis",
  "creative",
  "business",
  "education",
  "other",
]);

const PromptVisibilitySchema = z.enum(["private", "public", "unlisted"]);

const VariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "number", "select", "boolean"]),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true),
});

const CreatePromptSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: z.string().min(1),
  category: PromptCategorySchema.optional().default("general"),
  tags: z.array(z.string()).optional(),
  variables: z.array(VariableSchema).optional(),
  folderId: z.number().optional(),
});

const UpdatePromptSchema = z.object({
  promptId: z.number(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  content: z.string().min(1).optional(),
  category: PromptCategorySchema.optional(),
  tags: z.array(z.string()).optional(),
  variables: z.array(VariableSchema).optional(),
  folderId: z.number().nullable().optional(),
});

const ListPromptsSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  category: PromptCategorySchema.optional(),
  folderId: z.number().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "usageCount"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const SearchPromptsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).default(20),
  category: PromptCategorySchema.optional(),
});

const RunPromptSchema = z.object({
  promptId: z.number(),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  modelId: z.string().optional(),
});

const CreateVersionSchema = z.object({
  promptId: z.number(),
  content: z.string().min(1),
  changeNote: z.string().max(500).optional(),
});

const RestoreVersionSchema = z.object({
  promptId: z.number(),
  versionId: z.number(),
});

const ChainStepSchema = z.object({
  promptId: z.number(),
  order: z.number().min(0),
  inputMapping: z.record(z.string(), z.string()).optional(),
  condition: z.string().optional(),
});

const CreateChainSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  steps: z.array(ChainStepSchema).min(1),
});

const UpdateChainSchema = z.object({
  chainId: z.number(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  steps: z.array(ChainStepSchema).optional(),
});

const RunChainSchema = z.object({
  chainId: z.number(),
  initialVariables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  modelId: z.string().optional(),
});

const MarketplaceListSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  category: PromptCategorySchema.optional(),
  sortBy: z.enum(["popular", "recent", "rating", "downloads"]).default("popular"),
  search: z.string().optional(),
});

const PublishPromptSchema = z.object({
  promptId: z.number(),
  visibility: PromptVisibilitySchema.default("public"),
  price: z.number().min(0).default(0),
});

const RatePromptSchema = z.object({
  promptId: z.number(),
  rating: z.number().min(1).max(5),
  review: z.string().max(1000).optional(),
});

const AnalyticsTimeRangeSchema = z.enum(["day", "week", "month", "year", "all"]);

const GetPromptAnalyticsSchema = z.object({
  promptId: z.number(),
  timeRange: AnalyticsTimeRangeSchema.default("month"),
});

const GetUserStatsSchema = z.object({
  timeRange: AnalyticsTimeRangeSchema.default("month"),
});

// ============================================================================
// Prompts Router
// ============================================================================

export const promptsRouter = router({
  // ============================================================================
  // Prompts CRUD
  // ============================================================================

  list: protectedProcedure
    .input(ListPromptsSchema)
    .query(async ({ ctx, input }) => {
      return {
        prompts: [] as Array<{
          id: number;
          name: string;
          description: string | null;
          content: string;
          category: string;
          tags: string[];
          variables: z.infer<typeof VariableSchema>[];
          usageCount: number;
          createdAt: Date;
          updatedAt: Date;
        }>,
        total: 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  get: protectedProcedure
    .input(z.object({ promptId: z.number() }))
    .query(async ({ ctx, input }) => {
      return {
        id: input.promptId,
        name: "",
        description: null as string | null,
        content: "",
        category: "general" as const,
        tags: [] as string[],
        variables: [] as z.infer<typeof VariableSchema>[],
        folderId: null as number | null,
        usageCount: 0,
        lastUsedAt: null as Date | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  create: protectedProcedure
    .input(CreatePromptSchema)
    .mutation(async ({ ctx, input }) => {
      return {
        id: Date.now(),
        name: input.name,
        description: input.description || null,
        content: input.content,
        category: input.category,
        tags: input.tags || [],
        variables: input.variables || [],
        folderId: input.folderId || null,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  update: protectedProcedure
    .input(UpdatePromptSchema)
    .mutation(async ({ ctx, input }) => {
      return { success: true, promptId: input.promptId };
    }),

  delete: protectedProcedure
    .input(z.object({ promptId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return { success: true };
    }),

  search: protectedProcedure
    .input(SearchPromptsSchema)
    .query(async ({ ctx, input }) => {
      return {
        prompts: [] as Array<{
          id: number;
          name: string;
          description: string | null;
          content: string;
          category: string;
          matchScore: number;
        }>,
        total: 0,
      };
    }),

  run: protectedProcedure
    .input(RunPromptSchema)
    .mutation(async ({ ctx, input }) => {
      return {
        success: true,
        promptId: input.promptId,
        result: "",
        tokensUsed: 0,
        latencyMs: 0,
        runId: Date.now(),
      };
    }),

  // ============================================================================
  // Versions
  // ============================================================================

  versions: router({
    list: protectedProcedure
      .input(z.object({ promptId: z.number() }))
      .query(async ({ ctx, input }) => {
        return {
          versions: [] as Array<{
            id: number;
            versionNumber: number;
            content: string;
            changeNote: string | null;
            createdAt: Date;
          }>,
        };
      }),

    create: protectedProcedure
      .input(CreateVersionSchema)
      .mutation(async ({ ctx, input }) => {
        return {
          id: Date.now(),
          versionNumber: 1,
          content: input.content,
          changeNote: input.changeNote || null,
          createdAt: new Date(),
        };
      }),

    restore: protectedProcedure
      .input(RestoreVersionSchema)
      .mutation(async ({ ctx, input }) => {
        return { success: true, promptId: input.promptId };
      }),
  }),

  // ============================================================================
  // Chains
  // ============================================================================

  chains: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        return {
          chains: [] as Array<{
            id: number;
            name: string;
            description: string | null;
            stepCount: number;
            usageCount: number;
            createdAt: Date;
            updatedAt: Date;
          }>,
        };
      }),

    get: protectedProcedure
      .input(z.object({ chainId: z.number() }))
      .query(async ({ ctx, input }) => {
        return {
          id: input.chainId,
          name: "",
          description: null as string | null,
          steps: [] as z.infer<typeof ChainStepSchema>[],
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),

    create: protectedProcedure
      .input(CreateChainSchema)
      .mutation(async ({ ctx, input }) => {
        return {
          id: Date.now(),
          name: input.name,
          description: input.description || null,
          steps: input.steps,
          createdAt: new Date(),
        };
      }),

    update: protectedProcedure
      .input(UpdateChainSchema)
      .mutation(async ({ ctx, input }) => {
        return { success: true, chainId: input.chainId };
      }),

    delete: protectedProcedure
      .input(z.object({ chainId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return { success: true };
      }),

    run: protectedProcedure
      .input(RunChainSchema)
      .mutation(async ({ ctx, input }) => {
        return {
          success: true,
          chainId: input.chainId,
          results: [] as Array<{
            stepOrder: number;
            promptId: number;
            result: string;
            tokensUsed: number;
            latencyMs: number;
          }>,
          totalTokensUsed: 0,
          totalLatencyMs: 0,
          runId: Date.now(),
        };
      }),
  }),

  // ============================================================================
  // Analytics
  // ============================================================================

  analytics: router({
    getForPrompt: protectedProcedure
      .input(GetPromptAnalyticsSchema)
      .query(async ({ ctx, input }) => {
        return {
          promptId: input.promptId,
          timeRange: input.timeRange,
          totalRuns: 0,
          totalTokens: 0,
          averageLatencyMs: 0,
          runsByDay: [] as Array<{ date: string; count: number }>,
          tokensByDay: [] as Array<{ date: string; tokens: number }>,
          successRate: 100,
          lastRunAt: null as Date | null,
        };
      }),

    getUserStats: protectedProcedure
      .input(GetUserStatsSchema)
      .query(async ({ ctx, input }) => {
        return {
          timeRange: input.timeRange,
          totalPrompts: 0,
          totalChains: 0,
          totalRuns: 0,
          totalTokensUsed: 0,
          estimatedCost: 0,
          mostUsedPrompts: [] as Array<{ id: number; name: string; usageCount: number }>,
          runsByDay: [] as Array<{ date: string; count: number }>,
          promptsByCategory: [] as Array<{ category: string; count: number }>,
        };
      }),
  }),

  // ============================================================================
  // Marketplace
  // ============================================================================

  marketplace: router({
    list: publicProcedure
      .input(MarketplaceListSchema)
      .query(async ({ input }) => {
        return {
          prompts: [] as Array<{
            id: number;
            name: string;
            description: string | null;
            category: string;
            authorName: string;
            authorId: number;
            downloads: number;
            rating: number;
            ratingCount: number;
            price: number;
            tags: string[];
            createdAt: Date;
          }>,
          total: 0,
          limit: input.limit,
          offset: input.offset,
        };
      }),

    publish: protectedProcedure
      .input(PublishPromptSchema)
      .mutation(async ({ ctx, input }) => {
        return {
          success: true,
          promptId: input.promptId,
          visibility: input.visibility,
          marketplaceId: Date.now(),
        };
      }),

    download: protectedProcedure
      .input(z.object({ promptId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return {
          success: true,
          newPromptId: Date.now(),
          originalPromptId: input.promptId,
        };
      }),

    rate: protectedProcedure
      .input(RatePromptSchema)
      .mutation(async ({ ctx, input }) => {
        return {
          success: true,
          promptId: input.promptId,
          rating: input.rating,
        };
      }),
  }),

  // ============================================================================
  // Favorites
  // ============================================================================

  favorites: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        return {
          favorites: [] as Array<{
            id: number;
            promptId: number;
            promptName: string;
            promptDescription: string | null;
            addedAt: Date;
          }>,
        };
      }),

    toggle: protectedProcedure
      .input(z.object({ promptId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return {
          success: true,
          promptId: input.promptId,
          isFavorited: true,
        };
      }),
  }),
});

export type PromptsRouter = typeof promptsRouter;
