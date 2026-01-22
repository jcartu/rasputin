import type {
  Report,
  ReportTheme,
  HeroStat,
  ChartData,
  InsightCard,
  MetricCard,
} from "./types";

export interface ResearchReportData {
  title: string;
  subtitle?: string;
  badge?: string;
  theme?: ReportTheme;
  summary: string;
  keyFindings: string[];
  metrics?: MetricCard[];
  chartData?: {
    title: string;
    chartType: "bar" | "line" | "pie" | "doughnut";
    data: ChartData;
  };
  sections?: Array<{ title: string; content: string }>;
  insights?: InsightCard[];
  conclusion?: string;
}

export function createResearchReport(data: ResearchReportData): Report {
  const sections: Report["sections"] = [];

  sections.push({
    type: "hero",
    badge: data.badge || "Research Report",
    title: data.title,
    subtitle: data.subtitle,
    stats: data.metrics?.slice(0, 4).map(m => ({
      value: m.value,
      label: m.title,
    })),
  });

  sections.push({
    type: "text",
    title: "Executive Summary",
    markdownContent: data.summary,
  });

  if (data.keyFindings.length > 0) {
    sections.push({
      type: "insights",
      title: "Key Findings",
      insights: data.keyFindings.map((finding, i) => ({
        icon: ["💡", "🔍", "📊", "🎯", "⚡", "🚀"][i % 6],
        title: `Finding ${i + 1}`,
        description: finding,
      })),
    });
  }

  if (data.metrics && data.metrics.length > 0) {
    sections.push({
      type: "metrics",
      title: "Key Metrics",
      cards: data.metrics,
    });
  }

  if (data.chartData) {
    sections.push({
      type: "chart",
      title: data.chartData.title,
      chartType: data.chartData.chartType,
      data: data.chartData.data,
    });
  }

  if (data.sections) {
    for (const section of data.sections) {
      sections.push({
        type: "text",
        title: section.title,
        markdownContent: section.content,
      });
    }
  }

  if (data.insights && data.insights.length > 0) {
    sections.push({
      type: "insights",
      title: "Strategic Insights",
      insights: data.insights,
    });
  }

  if (data.conclusion) {
    sections.push({
      type: "text",
      title: "Conclusion",
      markdownContent: data.conclusion,
    });
  }

  return {
    config: {
      title: data.title,
      subtitle: data.subtitle,
      theme: data.theme || "dark",
      showFooter: true,
      generatedBy: "JARVIS AI Research",
    },
    sections,
  };
}

export interface DashboardData {
  title: string;
  subtitle?: string;
  theme?: ReportTheme;
  stats: HeroStat[];
  metrics: MetricCard[];
  charts: Array<{
    title: string;
    chartType: "bar" | "line" | "doughnut" | "pie";
    data: ChartData;
  }>;
  tables?: Array<{
    title: string;
    columns: Array<{ key: string; header: string }>;
    rows: Array<Record<string, unknown>>;
    showRank?: boolean;
  }>;
}

export function createDashboardReport(data: DashboardData): Report {
  const sections: Report["sections"] = [];

  sections.push({
    type: "hero",
    badge: "Live Dashboard",
    title: data.title,
    subtitle: data.subtitle,
    stats: data.stats,
  });

  sections.push({
    type: "metrics",
    cards: data.metrics,
  });

  for (const chart of data.charts) {
    sections.push({
      type: "chart",
      title: chart.title,
      chartType: chart.chartType,
      data: chart.data,
    });
  }

  if (data.tables) {
    for (const table of data.tables) {
      sections.push({
        type: "table",
        title: table.title,
        columns: table.columns,
        rows: table.rows,
        showRank: table.showRank,
      });
    }
  }

  return {
    config: {
      title: data.title,
      subtitle: data.subtitle,
      theme: data.theme || "dark",
      showFooter: true,
      generatedBy: "JARVIS AI",
    },
    sections,
  };
}

export interface ComparisonReportData {
  title: string;
  subtitle?: string;
  theme?: ReportTheme;
  items: Array<{
    name: string;
    icon?: string;
    metrics: Array<{ label: string; value: string | number }>;
  }>;
  chartComparison?: {
    title: string;
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  };
  verdict?: {
    winner: string;
    reason: string;
  };
}

export function createComparisonReport(data: ComparisonReportData): Report {
  const sections: Report["sections"] = [];

  sections.push({
    type: "hero",
    badge: "Comparison Analysis",
    title: data.title,
    subtitle: data.subtitle,
    stats: [{ value: data.items.length, label: "Options Compared" }],
  });

  sections.push({
    type: "comparison",
    title: "Side-by-Side Comparison",
    items: data.items,
  });

  if (data.chartComparison) {
    sections.push({
      type: "chart",
      title: data.chartComparison.title,
      chartType: "bar",
      data: {
        labels: data.chartComparison.labels,
        datasets: data.chartComparison.datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ["#6366f1", "#ec4899", "#10b981", "#f59e0b"][i % 4],
        })),
      },
    });
  }

  if (data.verdict) {
    sections.push({
      type: "insights",
      title: "Verdict",
      insights: [
        {
          icon: "🏆",
          title: `Winner: ${data.verdict.winner}`,
          description: data.verdict.reason,
        },
      ],
    });
  }

  return {
    config: {
      title: data.title,
      subtitle: data.subtitle,
      theme: data.theme || "dark",
      showFooter: true,
      generatedBy: "JARVIS AI Analysis",
    },
    sections,
  };
}

export interface TimelineReportData {
  title: string;
  subtitle?: string;
  theme?: ReportTheme;
  overview?: string;
  events: Array<{
    date: string;
    title: string;
    description?: string;
    icon?: string;
    status?: "completed" | "in_progress" | "pending";
  }>;
  milestoneMetrics?: MetricCard[];
}

export function createTimelineReport(data: TimelineReportData): Report {
  const sections: Report["sections"] = [];

  const completedCount = data.events.filter(
    e => e.status === "completed"
  ).length;
  const inProgressCount = data.events.filter(
    e => e.status === "in_progress"
  ).length;

  sections.push({
    type: "hero",
    badge: "Timeline",
    title: data.title,
    subtitle: data.subtitle,
    stats: [
      { value: data.events.length, label: "Total Events" },
      { value: completedCount, label: "Completed" },
      { value: inProgressCount, label: "In Progress" },
    ],
  });

  if (data.overview) {
    sections.push({
      type: "text",
      title: "Overview",
      markdownContent: data.overview,
    });
  }

  if (data.milestoneMetrics && data.milestoneMetrics.length > 0) {
    sections.push({
      type: "metrics",
      title: "Key Milestones",
      cards: data.milestoneMetrics,
    });
  }

  sections.push({
    type: "timeline",
    title: "Event Timeline",
    events: data.events,
  });

  return {
    config: {
      title: data.title,
      subtitle: data.subtitle,
      theme: data.theme || "dark",
      showFooter: true,
      generatedBy: "JARVIS AI",
    },
    sections,
  };
}
