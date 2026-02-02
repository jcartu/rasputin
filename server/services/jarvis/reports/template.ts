import type { ReportConfig, ReportTheme } from "./types";

const THEME_COLORS: Record<ReportTheme, Record<string, string>> = {
  dark: {
    primary: "#6366f1",
    primaryDark: "#4f46e5",
    secondary: "#ec4899",
    accent: "#f59e0b",
    success: "#10b981",
    info: "#3b82f6",
    warning: "#f59e0b",
    error: "#ef4444",
    dark: "#0f172a",
    darker: "#020617",
    light: "#f8fafc",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
    textDark: "#64748b",
    glass: "rgba(255,255,255,0.05)",
    glassBorder: "rgba(255,255,255,0.1)",
    gradientStart: "#0f172a",
    gradientMid: "#1e1b4b",
    gradientEnd: "#0f172a",
  },
  light: {
    primary: "#6366f1",
    primaryDark: "#4f46e5",
    secondary: "#ec4899",
    accent: "#f59e0b",
    success: "#10b981",
    info: "#3b82f6",
    warning: "#f59e0b",
    error: "#ef4444",
    dark: "#f8fafc",
    darker: "#ffffff",
    light: "#0f172a",
    text: "#1e293b",
    textMuted: "#64748b",
    textDark: "#94a3b8",
    glass: "rgba(0,0,0,0.03)",
    glassBorder: "rgba(0,0,0,0.08)",
    gradientStart: "#f8fafc",
    gradientMid: "#e0e7ff",
    gradientEnd: "#f8fafc",
  },
  purple: {
    primary: "#8b5cf6",
    primaryDark: "#7c3aed",
    secondary: "#f472b6",
    accent: "#fbbf24",
    success: "#34d399",
    info: "#60a5fa",
    warning: "#fbbf24",
    error: "#f87171",
    dark: "#1e1033",
    darker: "#0f0a1a",
    light: "#f8fafc",
    text: "#e2e8f0",
    textMuted: "#a5b4fc",
    textDark: "#7c3aed",
    glass: "rgba(139,92,246,0.1)",
    glassBorder: "rgba(139,92,246,0.2)",
    gradientStart: "#1e1033",
    gradientMid: "#2e1065",
    gradientEnd: "#1e1033",
  },
  blue: {
    primary: "#3b82f6",
    primaryDark: "#2563eb",
    secondary: "#06b6d4",
    accent: "#f59e0b",
    success: "#10b981",
    info: "#0ea5e9",
    warning: "#f59e0b",
    error: "#ef4444",
    dark: "#0c1929",
    darker: "#030712",
    light: "#f8fafc",
    text: "#e2e8f0",
    textMuted: "#93c5fd",
    textDark: "#3b82f6",
    glass: "rgba(59,130,246,0.1)",
    glassBorder: "rgba(59,130,246,0.2)",
    gradientStart: "#0c1929",
    gradientMid: "#1e3a5f",
    gradientEnd: "#0c1929",
  },
  green: {
    primary: "#10b981",
    primaryDark: "#059669",
    secondary: "#06b6d4",
    accent: "#f59e0b",
    success: "#22c55e",
    info: "#3b82f6",
    warning: "#f59e0b",
    error: "#ef4444",
    dark: "#0a1f1a",
    darker: "#030f0c",
    light: "#f8fafc",
    text: "#e2e8f0",
    textMuted: "#6ee7b7",
    textDark: "#10b981",
    glass: "rgba(16,185,129,0.1)",
    glassBorder: "rgba(16,185,129,0.2)",
    gradientStart: "#0a1f1a",
    gradientMid: "#134e4a",
    gradientEnd: "#0a1f1a",
  },
  rasputin: {
    primary: "#22d3ee",
    primaryDark: "#06b6d4",
    secondary: "#60a5fa",
    accent: "#a855f7",
    success: "#10b981",
    info: "#22d3ee",
    warning: "#fbbf24",
    error: "#f87171",
    dark: "#1a1a2e",
    darker: "#0d1117",
    light: "#f8fafc",
    text: "rgba(255,255,255,0.9)",
    textMuted: "rgba(255,255,255,0.5)",
    textDark: "#22d3ee",
    glass: "rgba(34,211,238,0.08)",
    glassBorder: "rgba(34,211,238,0.15)",
    gradientStart: "#0d1117",
    gradientMid: "#0d0d1a",
    gradientEnd: "#0d1117",
  },
};

export function getBaseTemplate(config: ReportConfig): string {
  const theme = config.theme || "dark";
  const colors = THEME_COLORS[theme];
  const date =
    config.date ||
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(config.title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        :root {
            --primary: ${colors.primary};
            --primary-dark: ${colors.primaryDark};
            --secondary: ${colors.secondary};
            --accent: ${colors.accent};
            --success: ${colors.success};
            --info: ${colors.info};
            --warning: ${colors.warning};
            --error: ${colors.error};
            --dark: ${colors.dark};
            --darker: ${colors.darker};
            --light: ${colors.light};
            --text: ${colors.text};
            --text-muted: ${colors.textMuted};
            --text-dark: ${colors.textDark};
            --glass: ${colors.glass};
            --glass-border: ${colors.glassBorder};
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.7;
            color: var(--text);
            background: var(--darker);
            overflow-x: hidden;
        }
        
        .bg-animation {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            background: linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.gradientMid} 50%, ${colors.gradientEnd} 100%);
        }
        
        .bg-animation::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                radial-gradient(circle at 20% 80%, ${colors.primary}26 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, ${colors.secondary}26 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, ${colors.accent}1a 0%, transparent 40%);
            animation: pulse 15s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        /* Hero */
        .hero {
            min-height: 60vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 60px 20px;
            position: relative;
        }
        
        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: var(--glass);
            border: 1px solid var(--glass-border);
            padding: 8px 20px;
            border-radius: 50px;
            font-size: 0.85rem;
            color: var(--primary);
            margin-bottom: 30px;
            animation: fadeInUp 0.8s ease;
        }
        
        .hero-badge .dot {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            animation: blink 2s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        .hero h1 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: clamp(2.5rem, 6vw, 4rem);
            font-weight: 700;
            background: linear-gradient(135deg, #fff 0%, var(--text-muted) 50%, var(--secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
            animation: fadeInUp 0.8s ease 0.2s both;
        }
        
        .hero .subtitle {
            font-size: clamp(1rem, 2vw, 1.3rem);
            color: var(--text-muted);
            max-width: 700px;
            margin-bottom: 40px;
            animation: fadeInUp 0.8s ease 0.4s both;
        }
        
        .hero-stats {
            display: flex;
            gap: 40px;
            flex-wrap: wrap;
            justify-content: center;
            animation: fadeInUp 0.8s ease 0.6s both;
        }
        
        .hero-stat {
            text-align: center;
        }
        
        .hero-stat .value {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 2.5rem;
            font-weight: 700;
            color: #fff;
        }
        
        .hero-stat .label {
            font-size: 0.85rem;
            color: var(--text-dark);
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Sections */
        section {
            padding: 80px 0;
            position: relative;
        }
        
        .section-header {
            text-align: center;
            margin-bottom: 50px;
        }
        
        .section-header h2 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: clamp(1.8rem, 4vw, 2.5rem);
            font-weight: 700;
            color: #fff;
            margin-bottom: 15px;
        }
        
        .section-header p {
            color: var(--text-dark);
            font-size: 1.1rem;
            max-width: 600px;
            margin: 0 auto;
        }
        
        /* Metrics Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .metric-card {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 24px;
            transition: all 0.3s ease;
        }
        
        .metric-card:hover {
            transform: translateY(-4px);
            border-color: var(--primary);
            box-shadow: 0 20px 40px -20px var(--primary);
        }
        
        .metric-card .icon {
            font-size: 2rem;
            margin-bottom: 12px;
        }
        
        .metric-card .value {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 2rem;
            font-weight: 700;
            color: #fff;
        }
        
        .metric-card .title {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin-top: 4px;
        }
        
        .metric-card .change {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.85rem;
            margin-top: 8px;
            padding: 4px 10px;
            border-radius: 20px;
        }
        
        .metric-card .change.positive {
            background: rgba(16,185,129,0.15);
            color: var(--success);
        }
        
        .metric-card .change.negative {
            background: rgba(239,68,68,0.15);
            color: var(--error);
        }
        
        /* Chart Section */
        .chart-section {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
        }
        
        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }
        
        .chart-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.3rem;
            color: #fff;
        }
        
        .chart-container {
            position: relative;
            height: 350px;
        }
        
        /* Tables */
        .table-section {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 30px;
        }
        
        .table-header {
            padding: 20px 25px;
            border-bottom: 1px solid var(--glass-border);
        }
        
        .table-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.3rem;
            color: #fff;
        }
        
        .table-tabs {
            display: flex;
            gap: 8px;
            padding: 15px 25px;
            border-bottom: 1px solid var(--glass-border);
            flex-wrap: wrap;
        }
        
        .table-tab {
            padding: 10px 18px;
            border-radius: 10px;
            border: 1px solid var(--glass-border);
            background: transparent;
            color: var(--text-muted);
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .table-tab:hover {
            border-color: #fff;
            color: #fff;
        }
        
        .table-tab.active {
            background: var(--primary);
            border-color: var(--primary);
            color: #fff;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .data-table th {
            background: rgba(0,0,0,0.2);
            padding: 16px 20px;
            text-align: left;
            font-weight: 600;
            color: var(--text-muted);
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .data-table td {
            padding: 14px 20px;
            border-bottom: 1px solid var(--glass-border);
            transition: all 0.3s;
        }
        
        .data-table tr:hover td {
            background: rgba(99, 102, 241, 0.08);
        }
        
        .data-table tr:last-child td {
            border-bottom: none;
        }
        
        .rank-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 0.85rem;
        }
        
        .rank-badge.gold { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; }
        .rank-badge.silver { background: linear-gradient(135deg, #e2e8f0, #94a3b8); color: #000; }
        .rank-badge.bronze { background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; }
        .rank-badge.default { background: var(--glass); color: var(--text-dark); }
        
        .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
            background: var(--glass);
            border: 1px solid var(--glass-border);
            color: var(--text-muted);
        }
        
        /* Insights Grid */
        .insights-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .insight-card {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 25px;
            transition: all 0.3s;
        }
        
        .insight-card:hover {
            transform: translateY(-4px);
            border-color: var(--primary);
        }
        
        .insight-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            margin-bottom: 16px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
        }
        
        .insight-card h4 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.1rem;
            color: #fff;
            margin-bottom: 10px;
        }
        
        .insight-card p {
            color: var(--text-dark);
            font-size: 0.9rem;
            line-height: 1.6;
        }
        
        /* Timeline */
        .timeline {
            position: relative;
            padding-left: 30px;
        }
        
        .timeline::before {
            content: '';
            position: absolute;
            left: 8px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: var(--glass-border);
        }
        
        .timeline-item {
            position: relative;
            padding-bottom: 30px;
        }
        
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -26px;
            top: 4px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--primary);
            border: 2px solid var(--darker);
        }
        
        .timeline-item.completed::before { background: var(--success); }
        .timeline-item.in_progress::before { background: var(--warning); animation: blink 1.5s infinite; }
        .timeline-item.pending::before { background: var(--text-dark); }
        
        .timeline-date {
            font-size: 0.8rem;
            color: var(--text-dark);
            margin-bottom: 6px;
        }
        
        .timeline-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1rem;
            color: #fff;
            margin-bottom: 4px;
        }
        
        .timeline-desc {
            font-size: 0.9rem;
            color: var(--text-muted);
        }
        
        /* Text Section */
        .text-section {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
        }
        
        .text-section h3 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.3rem;
            color: #fff;
            margin-bottom: 16px;
        }
        
        .text-content {
            color: var(--text-muted);
            line-height: 1.8;
        }
        
        .text-content h1, .text-content h2, .text-content h3, .text-content h4 {
            color: #fff;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        
        .text-content p { margin-bottom: 14px; }
        .text-content ul, .text-content ol { margin-left: 20px; margin-bottom: 14px; }
        .text-content li { margin-bottom: 6px; }
        .text-content strong { color: #fff; }
        .text-content a { color: var(--primary); text-decoration: none; }
        .text-content a:hover { text-decoration: underline; }
        .text-content code {
            background: rgba(0,0,0,0.3);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9em;
        }
        
        /* Code Block */
        .code-section {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 30px;
        }
        
        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            background: rgba(0,0,0,0.2);
            border-bottom: 1px solid var(--glass-border);
        }
        
        .code-language {
            font-size: 0.8rem;
            color: var(--text-muted);
            text-transform: uppercase;
        }
        
        .code-section pre {
            margin: 0;
            padding: 20px;
            overflow-x: auto;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9rem;
            line-height: 1.5;
        }
        
        /* Comparison */
        .comparison-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .comparison-card {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
        }
        
        .comparison-card .name {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.2rem;
            color: #fff;
            margin-bottom: 20px;
        }
        
        .comparison-card .icon {
            font-size: 2.5rem;
            margin-bottom: 12px;
        }
        
        .comparison-metrics {
            display: grid;
            gap: 12px;
        }
        
        .comparison-metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--glass-border);
        }
        
        .comparison-metric:last-child { border-bottom: none; }
        .comparison-metric .label { color: var(--text-dark); font-size: 0.9rem; }
        .comparison-metric .value { color: #fff; font-weight: 600; }
        
        /* Divider */
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--glass-border), transparent);
            margin: 40px 0;
        }
        
        /* Footer */
        footer {
            background: rgba(0,0,0,0.2);
            border-top: 1px solid var(--glass-border);
            padding: 40px 20px;
            text-align: center;
            margin-top: 40px;
        }
        
        footer p {
            color: var(--text-dark);
            font-size: 0.9rem;
        }
        
        .generated-by {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
            padding: 8px 16px;
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            font-size: 0.8rem;
            color: var(--text-muted);
        }
        
        /* Animations */
        .fade-in {
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.6s ease;
        }
        
        .fade-in.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .hero { min-height: 50vh; padding: 40px 20px; }
            .hero-stats { gap: 20px; }
            .hero-stat .value { font-size: 2rem; }
            section { padding: 50px 0; }
            .chart-section, .table-section, .text-section { padding: 20px; }
            .chart-container { height: 280px; }
            .data-table th, .data-table td { padding: 10px 12px; }
        }
        
        /* Print styles */
        @media print {
            .bg-animation { display: none; }
            body { background: #fff; color: #000; }
            .hero, section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="bg-animation"></div>
    
    <main>
        {{CONTENT}}
    </main>
    
    ${
      config.showFooter !== false
        ? `
    <footer>
        <p>Generated on ${date}</p>
        ${config.generatedBy ? `<div class="generated-by">Powered by ${escapeHtml(config.generatedBy)}</div>` : ""}
    </footer>
    `
        : ""
    }
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Fade in animations
            const fadeElements = document.querySelectorAll('.fade-in');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            }, { threshold: 0.1 });
            
            fadeElements.forEach(el => observer.observe(el));
            
            // Animated counters
            document.querySelectorAll('[data-count]').forEach(el => {
                const target = parseInt(el.dataset.count);
                const prefix = el.dataset.prefix || '';
                const suffix = el.dataset.suffix || '';
                let current = 0;
                const increment = target / 50;
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    el.textContent = prefix + Math.round(current).toLocaleString() + suffix;
                }, 30);
            });
            
            // Tab switching
            document.querySelectorAll('.table-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    const tableId = this.closest('.table-section').id;
                    const tabKey = this.dataset.tab;
                    
                    this.closest('.table-tabs').querySelectorAll('.table-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    document.querySelectorAll(\`#\${tableId} .tab-content\`).forEach(content => {
                        content.style.display = content.dataset.tab === tabKey ? 'block' : 'none';
                    });
                });
            });
            
            // Code highlighting
            if (typeof hljs !== 'undefined') {
                hljs.highlightAll();
            }
        });
        
        // Chart.js default config
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = '${colors.textMuted}';
            Chart.defaults.borderColor = '${colors.glassBorder}';
            Chart.defaults.font.family = "'Inter', sans-serif";
        }
    </script>
    
    {{CHARTS_SCRIPT}}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

export { escapeHtml };
