import type {
  Report,
  ReportSection,
  HeroSection,
  MetricsSection,
  ChartSection,
  TableSection,
  TextSection,
  InsightsSection,
  TimelineSection,
  ComparisonSection,
  CodeSection,
  ImageSection,
  ImageGallerySection,
} from "./types";
import { getBaseTemplate, escapeHtml } from "./template";

export class ReportBuilder {
  private chartCounter = 0;
  private tableCounter = 0;
  private chartsScripts: string[] = [];

  build(report: Report): string {
    this.chartCounter = 0;
    this.tableCounter = 0;
    this.chartsScripts = [];

    const sectionsHtml = report.sections
      .map(s => this.renderSection(s))
      .join("\n");
    const chartsScript =
      this.chartsScripts.length > 0
        ? `<script>\ndocument.addEventListener('DOMContentLoaded', function() {\n${this.chartsScripts.join("\n")}\n});\n</script>`
        : "";

    return getBaseTemplate(report.config)
      .replace("{{CONTENT}}", sectionsHtml)
      .replace("{{CHARTS_SCRIPT}}", chartsScript);
  }

  private renderSection(section: ReportSection): string {
    switch (section.type) {
      case "hero":
        return this.renderHero(section);
      case "metrics":
        return this.renderMetrics(section);
      case "chart":
        return this.renderChart(section);
      case "table":
        return this.renderTable(section);
      case "text":
        return this.renderText(section);
      case "insights":
        return this.renderInsights(section);
      case "timeline":
        return this.renderTimeline(section);
      case "comparison":
        return this.renderComparison(section);
      case "code":
        return this.renderCode(section);
      case "divider":
        return '<div class="divider"></div>';
      case "image":
        return this.renderImage(section);
      case "image_gallery":
        return this.renderImageGallery(section);
      default:
        return "";
    }
  }

  private renderHero(section: HeroSection): string {
    const statsHtml =
      section.stats
        ?.map(stat => {
          const prefix = stat.prefix || "";
          const suffix = stat.suffix || "";
          const value =
            typeof stat.value === "number" ? stat.value : stat.value;
          return `
        <div class="hero-stat">
          <div class="value" data-count="${value}" data-prefix="${prefix}" data-suffix="${suffix}">${prefix}0${suffix}</div>
          <div class="label">${escapeHtml(stat.label)}</div>
        </div>`;
        })
        .join("") || "";

    return `
    <section class="hero">
      ${
        section.badge
          ? `
        <div class="hero-badge">
          <span class="dot"></span>
          ${escapeHtml(section.badge)}
        </div>
      `
          : ""
      }
      <h1>${escapeHtml(section.title)}</h1>
      ${section.subtitle ? `<p class="subtitle">${escapeHtml(section.subtitle)}</p>` : ""}
      ${statsHtml ? `<div class="hero-stats">${statsHtml}</div>` : ""}
    </section>`;
  }

  private renderMetrics(section: MetricsSection): string {
    const cardsHtml = section.cards
      .map(card => {
        const changeHtml =
          card.changePercent !== undefined
            ? `
        <div class="change ${card.changePercent >= 0 ? "positive" : "negative"}">
          ${card.changePercent >= 0 ? "↑" : "↓"} ${Math.abs(card.changePercent)}%
        </div>
      `
            : "";

        return `
        <div class="metric-card fade-in">
          ${card.icon ? `<div class="icon">${card.icon}</div>` : ""}
          <div class="value">${escapeHtml(String(card.value))}</div>
          <div class="title">${escapeHtml(card.title)}</div>
          ${card.subtitle ? `<div class="subtitle" style="color: var(--text-dark); font-size: 0.8rem;">${escapeHtml(card.subtitle)}</div>` : ""}
          ${changeHtml}
        </div>`;
      })
      .join("");

    return `
    <section>
      <div class="container">
        ${
          section.title
            ? `
          <div class="section-header fade-in">
            <h2>${escapeHtml(section.title)}</h2>
          </div>
        `
            : ""
        }
        <div class="metrics-grid">
          ${cardsHtml}
        </div>
      </div>
    </section>`;
  }

  private renderChart(section: ChartSection): string {
    const chartId = `chart_${this.chartCounter++}`;
    const height = section.height || 350;

    const chartConfig = {
      type: section.chartType,
      data: section.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom" as const,
            labels: { padding: 20, usePointStyle: true },
          },
        },
        scales:
          section.chartType === "bar" || section.chartType === "line"
            ? {
                y: {
                  beginAtZero: true,
                  grid: { color: "rgba(255,255,255,0.05)" },
                },
                x: { grid: { display: false } },
              }
            : undefined,
      },
    };

    this.chartsScripts.push(`
      new Chart(document.getElementById('${chartId}'), ${JSON.stringify(chartConfig)});
    `);

    return `
    <section>
      <div class="container">
        <div class="chart-section fade-in">
          <div class="chart-header">
            <h3 class="chart-title">${escapeHtml(section.title)}</h3>
          </div>
          <div class="chart-container" style="height: ${height}px;">
            <canvas id="${chartId}"></canvas>
          </div>
        </div>
      </div>
    </section>`;
  }

  private renderTable(section: TableSection): string {
    const tableId = `table_${this.tableCounter++}`;

    const renderTableBody = (
      rows: Record<string, unknown>[],
      showRank: boolean
    ) => {
      return rows
        .map((row, idx) => {
          const cells = section.columns
            .map(col => {
              const value = row[col.key];
              const align = col.align || "left";
              let displayValue = String(value ?? "");

              if (col.format === "currency") {
                displayValue = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(Number(value));
              } else if (col.format === "percent") {
                displayValue = `${Number(value).toFixed(1)}%`;
              } else if (col.format === "number") {
                displayValue = Number(value).toLocaleString();
              } else if (col.format === "badge") {
                displayValue = `<span class="badge">${escapeHtml(String(value))}</span>`;
              }

              return `<td style="text-align: ${align};">${col.format === "badge" ? displayValue : escapeHtml(displayValue)}</td>`;
            })
            .join("");

          const rankCell = showRank
            ? `
          <td class="rank">
            <span class="rank-badge ${idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : "default"}">
              ${idx + 1}
            </span>
          </td>
        `
            : "";

          return `<tr>${rankCell}${cells}</tr>`;
        })
        .join("");
    };

    const headerCells = section.columns
      .map(
        col =>
          `<th style="text-align: ${col.align || "left"};">${escapeHtml(col.header)}</th>`
      )
      .join("");
    const rankHeader = section.showRank ? '<th class="rank">Rank</th>' : "";

    let tabsHtml = "";
    let contentHtml = "";

    if (section.tabs && section.tabs.length > 0) {
      tabsHtml = `
        <div class="table-tabs">
          ${section.tabs
            .map(
              (tab, idx) => `
            <button class="table-tab ${idx === 0 ? "active" : ""}" data-tab="${tab.key}">
              ${tab.icon || ""} ${escapeHtml(tab.label)}
            </button>
          `
            )
            .join("")}
        </div>
      `;

      contentHtml = section.tabs
        .map(
          (tab, idx) => `
        <div class="tab-content" data-tab="${tab.key}" style="display: ${idx === 0 ? "block" : "none"};">
          <table class="data-table">
            <thead><tr>${rankHeader}${headerCells}</tr></thead>
            <tbody>${renderTableBody(tab.rows, section.showRank || false)}</tbody>
          </table>
        </div>
      `
        )
        .join("");
    } else {
      contentHtml = `
        <table class="data-table">
          <thead><tr>${rankHeader}${headerCells}</tr></thead>
          <tbody>${renderTableBody(section.rows, section.showRank || false)}</tbody>
        </table>
      `;
    }

    return `
    <section>
      <div class="container">
        <div class="table-section fade-in" id="${tableId}">
          ${
            section.title
              ? `
            <div class="table-header">
              <h3 class="table-title">${escapeHtml(section.title)}</h3>
            </div>
          `
              : ""
          }
          ${tabsHtml}
          ${contentHtml}
        </div>
      </div>
    </section>`;
  }

  private renderText(section: TextSection): string {
    const htmlContent = this.markdownToHtml(section.markdownContent);

    return `
    <section>
      <div class="container">
        <div class="text-section fade-in">
          ${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ""}
          <div class="text-content">${htmlContent}</div>
        </div>
      </div>
    </section>`;
  }

  private renderInsights(section: InsightsSection): string {
    const insightsHtml = section.insights
      .map(
        insight => `
      <div class="insight-card fade-in">
        <div class="insight-icon" ${insight.color ? `style="background: ${insight.color};"` : ""}>
          ${insight.icon}
        </div>
        <h4>${escapeHtml(insight.title)}</h4>
        <p>${escapeHtml(insight.description)}</p>
      </div>
    `
      )
      .join("");

    return `
    <section>
      <div class="container">
        ${
          section.title
            ? `
          <div class="section-header fade-in">
            <h2>${escapeHtml(section.title)}</h2>
            ${section.subtitle ? `<p>${escapeHtml(section.subtitle)}</p>` : ""}
          </div>
        `
            : ""
        }
        <div class="insights-grid">
          ${insightsHtml}
        </div>
      </div>
    </section>`;
  }

  private renderTimeline(section: TimelineSection): string {
    const eventsHtml = section.events
      .map(
        event => `
      <div class="timeline-item ${event.status || ""}">
        <div class="timeline-date">${escapeHtml(event.date)}</div>
        <div class="timeline-title">${event.icon || ""} ${escapeHtml(event.title)}</div>
        ${event.description ? `<div class="timeline-desc">${escapeHtml(event.description)}</div>` : ""}
      </div>
    `
      )
      .join("");

    return `
    <section>
      <div class="container">
        ${
          section.title
            ? `
          <div class="section-header fade-in">
            <h2>${escapeHtml(section.title)}</h2>
          </div>
        `
            : ""
        }
        <div class="timeline fade-in">
          ${eventsHtml}
        </div>
      </div>
    </section>`;
  }

  private renderComparison(section: ComparisonSection): string {
    const cardsHtml = section.items
      .map(
        item => `
      <div class="comparison-card fade-in">
        ${item.icon ? `<div class="icon">${item.icon}</div>` : ""}
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="comparison-metrics">
          ${item.metrics
            .map(
              m => `
            <div class="comparison-metric">
              <span class="label">${escapeHtml(m.label)}</span>
              <span class="value">${escapeHtml(String(m.value))}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("");

    return `
    <section>
      <div class="container">
        ${
          section.title
            ? `
          <div class="section-header fade-in">
            <h2>${escapeHtml(section.title)}</h2>
          </div>
        `
            : ""
        }
        <div class="comparison-grid">
          ${cardsHtml}
        </div>
      </div>
    </section>`;
  }

  private renderCode(section: CodeSection): string {
    return `
    <section>
      <div class="container">
        <div class="code-section fade-in">
          ${
            section.title
              ? `
            <div class="code-header">
              <span class="code-title" style="color: #fff;">${escapeHtml(section.title)}</span>
              <span class="code-language">${escapeHtml(section.language)}</span>
            </div>
          `
              : `
            <div class="code-header">
              <span></span>
              <span class="code-language">${escapeHtml(section.language)}</span>
            </div>
          `
          }
          <pre><code class="language-${escapeHtml(section.language)}">${escapeHtml(section.code)}</code></pre>
        </div>
      </div>
    </section>`;
  }

  private renderImage(section: ImageSection): string {
    const width = section.width || "100%";
    return `
    <section>
      <div class="container">
        <div class="image-section fade-in">
          <img src="${escapeHtml(section.url)}" alt="${escapeHtml(section.alt || "")}" style="max-width: ${width}; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);" onerror="this.style.display='none'">
          ${section.caption ? `<p class="image-caption" style="text-align: center; color: var(--text-dark); margin-top: 0.75rem; font-size: 0.9rem;">${escapeHtml(section.caption)}</p>` : ""}
        </div>
      </div>
    </section>`;
  }

  private renderImageGallery(section: ImageGallerySection): string {
    const imagesHtml = section.images
      .map(
        img => `
      <div class="gallery-item">
        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || "")}" style="width: 100%; border-radius: 8px; aspect-ratio: 16/9; object-fit: cover;" onerror="this.parentElement.style.display='none'">
        ${img.caption ? `<p class="gallery-caption" style="color: var(--text-dark); font-size: 0.8rem; margin-top: 0.5rem;">${escapeHtml(img.caption)}</p>` : ""}
      </div>
    `
      )
      .join("");

    return `
    <section>
      <div class="container">
        ${
          section.title
            ? `
          <div class="section-header fade-in">
            <h2>${escapeHtml(section.title)}</h2>
          </div>
        `
            : ""
        }
        <div class="image-gallery fade-in" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
          ${imagesHtml}
        </div>
      </div>
    </section>`;
  }

  private markdownToHtml(markdown: string): string {
    let html = escapeHtml(markdown);

    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`(.+?)`/g, "<code>$1</code>");
    html = html.replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank">$1</a>'
    );
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>[\s\S]*<\/li>)/g, "<ul>$1</ul>");
    html = html.replace(/<\/ul>\s*<ul>/g, "");
    html = html.replace(/\n\n/g, "</p><p>");
    html = `<p>${html}</p>`;
    html = html.replace(/<p><h/g, "<h").replace(/<\/h(\d)><\/p>/g, "</h$1>");
    html = html.replace(/<p><ul>/g, "<ul>").replace(/<\/ul><\/p>/g, "</ul>");

    return html;
  }
}

export function buildReport(report: Report): string {
  const builder = new ReportBuilder();
  return builder.build(report);
}
