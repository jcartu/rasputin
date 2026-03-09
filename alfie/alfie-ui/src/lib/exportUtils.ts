const ensureExtension = (filename: string, extension: string): string => {
  if (filename.toLowerCase().endsWith(extension)) return filename;
  return `${filename}${extension}`;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeCsvField = (value: string): string => {
  const needsEscaping = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsEscaping ? `"${escaped}"` : escaped;
};

const stripMarkdown = (content: string): string => {
  let text = content;
  text = text.replace(/```([\s\S]*?)```/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^\s*>\s?/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/^\s*[-_]{3,}\s*$/gm, "");
  return text;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

export const exportAsMarkdown = (content: string, filename: string): void => {
  const safeName = ensureExtension(filename, ".md");
  const blob = new Blob([content], { type: "text/markdown" });
  downloadBlob(blob, safeName);
};

export const exportAsHTML = (
  content: string,
  title: string,
  filename: string
): void => {
  const safeName = ensureExtension(filename, ".html");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        font-family: "IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", monospace;
        background: #0b0d12;
        color: #e6e9ef;
        line-height: 1.6;
      }
      .page {
        max-width: 920px;
        margin: 0 auto;
        padding: 48px 24px 64px;
      }
      header {
        margin-bottom: 32px;
      }
      h1 {
        font-size: 28px;
        letter-spacing: 0.02em;
        margin: 0 0 8px;
      }
      .meta {
        font-size: 12px;
        color: #9aa3b2;
      }
      .content {
        background: #121622;
        border: 1px solid #20273a;
        border-radius: 16px;
        padding: 24px;
        overflow-x: auto;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Exported from ALFIE</div>
      </header>
      <section class="content">
        <pre>${escapeHtml(content)}</pre>
      </section>
    </div>
  </body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  downloadBlob(blob, safeName);
};

export const exportAsText = (content: string, filename: string): void => {
  const safeName = ensureExtension(filename, ".txt");
  const stripped = stripMarkdown(content);
  const blob = new Blob([stripped], { type: "text/plain" });
  downloadBlob(blob, safeName);
};

export const exportAsCSV = (
  headers: string[],
  rows: string[][],
  filename: string
): void => {
  const safeName = ensureExtension(filename, ".csv");
  const lines = [
    headers.map(header => escapeCsvField(header)).join(","),
    ...rows.map(row => row.map(cell => escapeCsvField(cell)).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, safeName);
};
