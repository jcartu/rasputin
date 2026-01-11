export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  credibilityScore: number;
  credibilityReason: string;
  retrievedAt: number;
}

export interface Citation {
  id: string;
  claim: string;
  sources: ResearchSource[];
  confidence: number;
}

export interface ResearchConflict {
  topic: string;
  claims: { claim: string; sources: string[] }[];
  resolution?: string;
}

export interface DeepResearchResult {
  query: string;
  sources: ResearchSource[];
  citations: Citation[];
  conflicts: ResearchConflict[];
  synthesis: string;
  depth: number;
  totalQueries: number;
  researchTimeMs: number;
}

const CREDIBILITY_SCORES: Record<string, { score: number; reason: string }> = {
  "arxiv.org": { score: 0.95, reason: "Peer-reviewed preprint archive" },
  "nature.com": { score: 0.98, reason: "Premier scientific journal" },
  "science.org": { score: 0.98, reason: "Premier scientific journal" },
  "ieee.org": { score: 0.95, reason: "Technical standards organization" },
  "acm.org": { score: 0.95, reason: "Computing research society" },
  "nih.gov": { score: 0.97, reason: "Government health research" },
  "pubmed.ncbi.nlm.nih.gov": {
    score: 0.96,
    reason: "Medical literature database",
  },
  "scholar.google.com": { score: 0.85, reason: "Academic search aggregator" },
  gov: { score: 0.9, reason: "Government source" },
  edu: { score: 0.88, reason: "Educational institution" },
  "who.int": { score: 0.92, reason: "World Health Organization" },
  "reuters.com": { score: 0.88, reason: "Major wire service" },
  "apnews.com": { score: 0.88, reason: "Major wire service" },
  "bbc.com": { score: 0.85, reason: "Major news organization" },
  "nytimes.com": { score: 0.82, reason: "Major newspaper" },
  "washingtonpost.com": { score: 0.82, reason: "Major newspaper" },
  "theguardian.com": { score: 0.8, reason: "Major newspaper" },
  "techcrunch.com": { score: 0.75, reason: "Tech news outlet" },
  "wired.com": { score: 0.75, reason: "Tech publication" },
  "arstechnica.com": { score: 0.78, reason: "Tech journalism" },
  "theverge.com": { score: 0.72, reason: "Tech news" },
  "blog.google": { score: 0.8, reason: "Official company blog" },
  "openai.com": { score: 0.82, reason: "Official company source" },
  "anthropic.com": { score: 0.82, reason: "Official company source" },
  "microsoft.com": { score: 0.78, reason: "Official company source" },
  "wikipedia.org": { score: 0.7, reason: "Community-edited encyclopedia" },
  default: { score: 0.5, reason: "Unknown source credibility" },
};

export function scoreSourceCredibility(url: string): {
  score: number;
  reason: string;
} {
  try {
    const domain = new URL(url).hostname.replace("www.", "");

    if (CREDIBILITY_SCORES[domain]) {
      return CREDIBILITY_SCORES[domain];
    }

    const tld = domain.split(".").pop() || "";
    if (tld === "gov" || tld === "edu") {
      return CREDIBILITY_SCORES[tld];
    }

    for (const key of Object.keys(CREDIBILITY_SCORES)) {
      if (domain.includes(key)) {
        return CREDIBILITY_SCORES[key];
      }
    }

    return CREDIBILITY_SCORES.default;
  } catch {
    return CREDIBILITY_SCORES.default;
  }
}

export function generateSearchQueries(topic: string): string[] {
  const queries: string[] = [topic];
  const words = topic.toLowerCase().split(/\s+/);

  if (
    words.some(w =>
      ["latest", "recent", "new", "current", "2024", "2025", "2026"].includes(w)
    )
  ) {
    queries.push(`${topic} news`);
    queries.push(`${topic} developments`);
  }

  if (words.some(w => ["how", "what", "why", "when"].includes(w))) {
    queries.push(`${topic} explained`);
    queries.push(`${topic} overview`);
  }

  queries.push(`${topic} research papers`);
  queries.push(`${topic} applications`);

  return queries.slice(0, 5);
}

export function extractCitations(
  content: string,
  sources: ResearchSource[]
): Citation[] {
  const citations: Citation[] = [];
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);

  let citationId = 1;
  for (const sentence of sentences) {
    const relevantSources = sources.filter(source => {
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      const snippetWords = source.snippet.toLowerCase().split(/\s+/);
      const overlap = sentenceWords.filter(w =>
        snippetWords.includes(w)
      ).length;
      return overlap > 3;
    });

    if (relevantSources.length > 0) {
      citations.push({
        id: `cite-${citationId++}`,
        claim: sentence.trim(),
        sources: relevantSources,
        confidence:
          relevantSources.reduce((sum, s) => sum + s.credibilityScore, 0) /
          relevantSources.length,
      });
    }
  }

  return citations;
}

export function detectConflicts(citations: Citation[]): ResearchConflict[] {
  const conflicts: ResearchConflict[] = [];
  const claimsByTopic = new Map<string, Citation[]>();

  for (const citation of citations) {
    const keywords = citation.claim
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 5);

    for (const keyword of keywords) {
      if (!claimsByTopic.has(keyword)) {
        claimsByTopic.set(keyword, []);
      }
      claimsByTopic.get(keyword)!.push(citation);
    }
  }

  const contradictoryPairs = [
    ["increase", "decrease"],
    ["rise", "fall"],
    ["grow", "shrink"],
    ["positive", "negative"],
    ["success", "failure"],
    ["yes", "no"],
    ["true", "false"],
    ["better", "worse"],
  ];

  const topicEntries = Array.from(claimsByTopic.entries());
  for (const [topic, claims] of topicEntries) {
    if (claims.length < 2) continue;

    for (const [pos, neg] of contradictoryPairs) {
      const posClaims = claims.filter((c: Citation) =>
        c.claim.toLowerCase().includes(pos)
      );
      const negClaims = claims.filter((c: Citation) =>
        c.claim.toLowerCase().includes(neg)
      );

      if (posClaims.length > 0 && negClaims.length > 0) {
        conflicts.push({
          topic,
          claims: [
            {
              claim: posClaims[0].claim,
              sources: posClaims[0].sources.map((s: ResearchSource) => s.url),
            },
            {
              claim: negClaims[0].claim,
              sources: negClaims[0].sources.map((s: ResearchSource) => s.url),
            },
          ],
        });
        break;
      }
    }
  }

  return conflicts.slice(0, 5);
}

export function formatResearchReport(result: DeepResearchResult): string {
  const lines: string[] = [];

  lines.push(`## Deep Research Report: ${result.query}\n`);
  lines.push(
    `*${result.totalQueries} queries across ${result.sources.length} sources in ${(result.researchTimeMs / 1000).toFixed(1)}s*\n`
  );

  lines.push(`### Summary\n`);
  lines.push(result.synthesis + "\n");

  if (result.sources.length > 0) {
    lines.push(`### Sources (by credibility)\n`);
    const sortedSources = [...result.sources].sort(
      (a, b) => b.credibilityScore - a.credibilityScore
    );
    for (const source of sortedSources.slice(0, 10)) {
      const stars = "★".repeat(Math.round(source.credibilityScore * 5));
      lines.push(
        `- ${stars} [${source.title}](${source.url}) - ${source.credibilityReason}`
      );
    }
    lines.push("");
  }

  if (result.conflicts.length > 0) {
    lines.push(`### ⚠️ Conflicting Information Detected\n`);
    for (const conflict of result.conflicts) {
      lines.push(`**Topic: ${conflict.topic}**`);
      for (const claim of conflict.claims) {
        lines.push(`- "${claim.claim.slice(0, 100)}..." [${claim.sources[0]}]`);
      }
      lines.push("");
    }
  }

  if (result.citations.length > 0) {
    lines.push(`### Key Citations\n`);
    for (const citation of result.citations.slice(0, 10)) {
      const confidence = (citation.confidence * 100).toFixed(0);
      lines.push(`> ${citation.claim.slice(0, 150)}...`);
      lines.push(
        `> *Confidence: ${confidence}% | Sources: ${citation.sources.length}*\n`
      );
    }
  }

  return lines.join("\n");
}

export function shouldDeepen(
  currentDepth: number,
  maxDepth: number,
  conflictsFound: number,
  unansweredQuestions: number
): boolean {
  if (currentDepth >= maxDepth) return false;
  if (conflictsFound > 2) return true;
  if (unansweredQuestions > 3) return true;
  return false;
}

export function generateFollowUpQueries(
  originalQuery: string,
  synthesis: string,
  conflicts: ResearchConflict[]
): string[] {
  const followUps: string[] = [];

  for (const conflict of conflicts.slice(0, 2)) {
    followUps.push(`${conflict.topic} evidence comparison`);
  }

  const potentialTopics = synthesis
    .match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g)
    ?.slice(0, 3);
  if (potentialTopics) {
    for (const topic of potentialTopics) {
      followUps.push(`${topic} details`);
    }
  }

  return followUps.slice(0, 3);
}
