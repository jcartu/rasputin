/**
 * JARVIS Report Generation Types
 * Supports beautiful, interactive HTML reports with charts, tables, and visualizations
 */

export type ReportTheme = "dark" | "light" | "purple" | "blue" | "green" | "rasputin";

export interface ReportConfig {
  title: string;
  subtitle?: string;
  theme?: ReportTheme;
  showNavigation?: boolean;
  showFooter?: boolean;
  generatedBy?: string;
  date?: string;
}

export interface HeroSection {
  type: "hero";
  badge?: string;
  title: string;
  subtitle?: string;
  stats?: HeroStat[];
}

export interface HeroStat {
  value: number | string;
  label: string;
  prefix?: string;
  suffix?: string;
}

export interface MetricCard {
  title: string;
  value: string | number;
  subtitle?: string;
  changePercent?: number;
  icon?: string;
  color?: string;
}

export interface MetricsSection {
  type: "metrics";
  title?: string;
  cards: MetricCard[];
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }[];
}

export interface ChartSection {
  type: "chart";
  title: string;
  chartType: "bar" | "line" | "doughnut" | "pie" | "radar" | "polarArea";
  data: ChartData;
  height?: number;
}

export interface TableColumn {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  format?: "text" | "number" | "currency" | "percent" | "badge";
}

export interface TableSection {
  type: "table";
  title?: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  showRank?: boolean;
  tabs?: {
    key: string;
    label: string;
    icon?: string;
    rows: Record<string, unknown>[];
  }[];
}

export interface TextSection {
  type: "text";
  title?: string;
  markdownContent: string;
}

export interface InsightCard {
  icon: string;
  title: string;
  description: string;
  color?: string;
}

export interface InsightsSection {
  type: "insights";
  title?: string;
  subtitle?: string;
  insights: InsightCard[];
}

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  icon?: string;
  status?: "completed" | "in_progress" | "pending";
}

export interface TimelineSection {
  type: "timeline";
  title?: string;
  events: TimelineEvent[];
}

export interface ComparisonItem {
  name: string;
  icon?: string;
  metrics: { label: string; value: string | number }[];
}

export interface ComparisonSection {
  type: "comparison";
  title?: string;
  items: ComparisonItem[];
}

export interface CodeSection {
  type: "code";
  title?: string;
  language: string;
  code: string;
}

export interface DividerSection {
  type: "divider";
}

export interface ImageSection {
  type: "image";
  url: string;
  alt?: string;
  caption?: string;
  width?: string;
}

export interface ImageGallerySection {
  type: "image_gallery";
  title?: string;
  images: Array<{
    url: string;
    alt?: string;
    caption?: string;
  }>;
}

export type ReportSection =
  | HeroSection
  | MetricsSection
  | ChartSection
  | TableSection
  | TextSection
  | InsightsSection
  | TimelineSection
  | ComparisonSection
  | CodeSection
  | DividerSection
  | ImageSection
  | ImageGallerySection;

export interface Report {
  config: ReportConfig;
  sections: ReportSection[];
}
