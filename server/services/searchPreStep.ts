/**
 * Search Pre-Step Service
 * Uses Perplexity Sonar to fetch current web information before consensus queries
 * This ensures all models have access to up-to-date 2026 data
 */

const SONAR_API_KEY = process.env.SONAR_API_KEY;

export interface SearchContext {
  query: string;
  searchResults: string;
  citations: string[];
  timestamp: string;
}

/**
 * Performs a web search using Perplexity Sonar to get current information
 * Returns formatted context that can be injected into model prompts
 */
export async function performSearchPreStep(
  userQuery: string
): Promise<SearchContext | null> {
  if (!SONAR_API_KEY) {
    console.warn(
      "[SearchPreStep] SONAR_API_KEY not configured, skipping search"
    );
    return null;
  }

  const startTime = Date.now();
  console.log(
    `[SearchPreStep] Starting web search for: "${userQuery.substring(0, 100)}..."`
  );

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SONAR_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar-pro", // Use sonar-pro for better search results
        messages: [
          {
            role: "system",
            content: `You are a research assistant. Your task is to search the web and provide current, factual information about the user's query. Focus on:
1. The most recent and up-to-date information (especially for 2025-2026)
2. Key facts, statistics, and developments
3. Multiple perspectives if the topic is debated
4. Specific dates, names, and numbers when available

Format your response as a concise research brief that another AI can use as context. Include source citations where possible.`,
          },
          {
            role: "user",
            content: `Search for current information about: ${userQuery}

Provide a research brief with the latest facts and developments. Focus on information from 2025-2026 if relevant.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3, // Lower temperature for more factual responses
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[SearchPreStep] Sonar API error: ${response.status} - ${errorText}`
      );
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    const latencyMs = Date.now() - startTime;
    console.log(
      `[SearchPreStep] Search completed in ${latencyMs}ms, ${content.length} chars`
    );

    return {
      query: userQuery,
      searchResults: content,
      citations: citations,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[SearchPreStep] Error performing search:", error);
    return null;
  }
}

/**
 * Formats search context into a system prompt addition
 */
export function formatSearchContextForPrompt(context: SearchContext): string {
  let prompt = `\n\n---\n## CURRENT WEB RESEARCH (as of ${context.timestamp})\n\nThe following information was retrieved from a web search to ensure you have access to the latest data:\n\n${context.searchResults}`;

  if (context.citations && context.citations.length > 0) {
    prompt += `\n\n### Sources:\n${context.citations.map((c, i) => `[${i + 1}] ${c}`).join("\n")}`;
  }

  prompt += `\n\n---\n\nPlease use this current information to inform your response. If the search results conflict with your training data, prefer the search results as they represent more recent information.\n`;

  return prompt;
}

/**
 * Determines if a query would benefit from a search pre-step
 * Some queries (like creative writing or math) don't need current web data
 */
export function shouldPerformSearch(query: string): boolean {
  const lowercaseQuery = query.toLowerCase();

  // Skip search for certain types of queries
  const skipPatterns = [
    /^(write|create|compose|generate).*(poem|story|song|essay|code|function)/i,
    /^(calculate|compute|solve|what is \d)/i,
    /^(explain|define|what does .* mean)/i,
    /^(translate|convert)/i,
    /^(help me|how do i|how to).*(write|code|program)/i,
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(lowercaseQuery)) {
      console.log(`[SearchPreStep] Skipping search for query type: ${pattern}`);
      return false;
    }
  }

  // Prioritize search for queries that likely need current information
  const searchPatterns = [
    /\b(2024|2025|2026|current|latest|recent|now|today|this year|this month)\b/i,
    /\b(news|update|announcement|release|launch)\b/i,
    /\b(price|stock|market|economy|inflation)\b/i,
    /\b(president|election|government|policy|law)\b/i,
    /\b(who is|what is|where is|when did)\b/i,
    /\b(compare|vs|versus|difference between)\b/i,
    /\b(best|top|leading|popular)\b/i,
  ];

  for (const pattern of searchPatterns) {
    if (pattern.test(lowercaseQuery)) {
      console.log(
        `[SearchPreStep] Search recommended for query pattern: ${pattern}`
      );
      return true;
    }
  }

  // Default: perform search for most queries to ensure fresh data
  // This is more aggressive but ensures models have current context
  console.log(`[SearchPreStep] Default: performing search for general query`);
  return true;
}
