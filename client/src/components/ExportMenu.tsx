import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileType,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  TableCell,
  TableRow,
  Table,
  WidthType,
  BorderStyle,
} from "docx";

export interface ExportContent {
  title: string;
  content: string;
  metadata?: {
    date?: string;
    mode?: string;
    model?: string;
    toolsUsed?: string[];
    duration?: string;
  };
  // For structured data (tables)
  tables?: Array<{
    headers: string[];
    rows: string[][];
  }>;
}

interface ExportMenuProps {
  content: ExportContent;
  variant?: "icon" | "button";
  size?: "sm" | "default" | "lg";
  className?: string;
}

type ExportFormat = "md" | "xlsx" | "docx" | "pdf";

export function ExportMenu({
  content,
  variant = "icon",
  size = "default",
  className = "",
}: ExportMenuProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [success, setSuccess] = useState<ExportFormat | null>(null);

  const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9]/gi, "-").substring(0, 50);
  };

  const showSuccess = (format: ExportFormat) => {
    setSuccess(format);
    setTimeout(() => setSuccess(null), 2000);
  };

  // Parse markdown content into structured sections
  const parseContent = (markdown: string) => {
    const lines = markdown.split("\n");
    const sections: Array<{
      type: "heading" | "paragraph" | "code" | "list" | "table";
      level?: number;
      content: string;
      items?: string[];
      tableData?: { headers: string[]; rows: string[][] };
    }> = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        sections.push({
          type: "heading",
          level: headingMatch[1].length,
          content: headingMatch[2],
        });
        i++;
        continue;
      }

      // Code block
      if (line.startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        sections.push({ type: "code", content: codeLines.join("\n") });
        i++;
        continue;
      }

      // Table
      if (line.includes("|") && lines[i + 1]?.match(/^\|[\s-:|]+\|$/)) {
        const headers = line
          .split("|")
          .filter(c => c.trim())
          .map(c => c.trim());
        const rows: string[][] = [];
        i += 2; // Skip header and separator
        while (i < lines.length && lines[i].includes("|")) {
          rows.push(
            lines[i]
              .split("|")
              .filter(c => c.trim())
              .map(c => c.trim())
          );
          i++;
        }
        sections.push({
          type: "table",
          content: "",
          tableData: { headers, rows },
        });
        continue;
      }

      // List
      if (line.match(/^[-*]\s+/)) {
        const items: string[] = [];
        while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
          items.push(lines[i].replace(/^[-*]\s+/, ""));
          i++;
        }
        sections.push({ type: "list", content: "", items });
        continue;
      }

      // Paragraph
      if (line.trim()) {
        sections.push({ type: "paragraph", content: line });
      }
      i++;
    }

    return sections;
  };

  // Export as Markdown
  const exportMarkdown = async () => {
    setExporting("md");
    try {
      let markdown = `# ${content.title}\n\n`;

      if (content.metadata) {
        markdown += `---\n`;
        if (content.metadata.date)
          markdown += `Date: ${content.metadata.date}\n`;
        if (content.metadata.mode)
          markdown += `Mode: ${content.metadata.mode}\n`;
        if (content.metadata.model)
          markdown += `Model: ${content.metadata.model}\n`;
        if (content.metadata.duration)
          markdown += `Duration: ${content.metadata.duration}\n`;
        if (content.metadata.toolsUsed?.length)
          markdown += `Tools: ${content.metadata.toolsUsed.join(", ")}\n`;
        markdown += `---\n\n`;
      }

      markdown += content.content;

      const blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8",
      });
      saveAs(blob, `${sanitizeFilename(content.title)}.md`);
      showSuccess("md");
    } finally {
      setExporting(null);
    }
  };

  // Export as Excel
  const exportExcel = async () => {
    setExporting("xlsx");
    try {
      const wb = XLSX.utils.book_new();

      // Main content sheet
      const contentRows: string[][] = [["Title", content.title], [""]];

      if (content.metadata) {
        if (content.metadata.date)
          contentRows.push(["Date", content.metadata.date]);
        if (content.metadata.mode)
          contentRows.push(["Mode", content.metadata.mode]);
        if (content.metadata.model)
          contentRows.push(["Model", content.metadata.model]);
        if (content.metadata.duration)
          contentRows.push(["Duration", content.metadata.duration]);
        if (content.metadata.toolsUsed?.length)
          contentRows.push(["Tools", content.metadata.toolsUsed.join(", ")]);
        contentRows.push([""]);
      }

      // Parse content and add to sheet
      const sections = parseContent(content.content);
      for (const section of sections) {
        if (section.type === "heading") {
          contentRows.push([section.content]);
        } else if (section.type === "paragraph") {
          contentRows.push([section.content]);
        } else if (section.type === "list" && section.items) {
          for (const item of section.items) {
            contentRows.push([`• ${item}`]);
          }
        } else if (section.type === "code") {
          contentRows.push(["[Code]", section.content]);
        }
        contentRows.push([""]);
      }

      const ws = XLSX.utils.aoa_to_sheet(contentRows);

      // Set column widths
      ws["!cols"] = [{ wch: 20 }, { wch: 80 }];

      XLSX.utils.book_append_sheet(wb, ws, "Content");

      // Add table sheets if present
      if (content.tables) {
        content.tables.forEach((table, idx) => {
          const tableData = [table.headers, ...table.rows];
          const tableWs = XLSX.utils.aoa_to_sheet(tableData);
          XLSX.utils.book_append_sheet(wb, tableWs, `Table ${idx + 1}`);
        });
      }

      // Also extract inline tables from content
      const inlineTables = sections.filter(s => s.type === "table");
      inlineTables.forEach((table, idx) => {
        if (table.tableData) {
          const tableData = [table.tableData.headers, ...table.tableData.rows];
          const tableWs = XLSX.utils.aoa_to_sheet(tableData);
          XLSX.utils.book_append_sheet(wb, tableWs, `Data ${idx + 1}`);
        }
      });

      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `${sanitizeFilename(content.title)}.xlsx`);
      showSuccess("xlsx");
    } finally {
      setExporting(null);
    }
  };

  // Export as DOCX
  const exportDocx = async () => {
    setExporting("docx");
    try {
      const children: (Paragraph | Table)[] = [];

      // Title
      children.push(
        new Paragraph({
          text: content.title,
          heading: HeadingLevel.TITLE,
          spacing: { after: 400 },
        })
      );

      // Metadata
      if (content.metadata) {
        const metaText: string[] = [];
        if (content.metadata.date)
          metaText.push(`Date: ${content.metadata.date}`);
        if (content.metadata.mode)
          metaText.push(`Mode: ${content.metadata.mode}`);
        if (content.metadata.model)
          metaText.push(`Model: ${content.metadata.model}`);
        if (content.metadata.duration)
          metaText.push(`Duration: ${content.metadata.duration}`);
        if (content.metadata.toolsUsed?.length)
          metaText.push(`Tools: ${content.metadata.toolsUsed.join(", ")}`);

        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: metaText.join(" | "),
                italics: true,
                color: "666666",
                size: 20,
              }),
            ],
            spacing: { after: 400 },
          })
        );
      }

      // Parse and add content
      const sections = parseContent(content.content);
      for (const section of sections) {
        if (section.type === "heading") {
          const level =
            section.level === 1
              ? HeadingLevel.HEADING_1
              : section.level === 2
                ? HeadingLevel.HEADING_2
                : section.level === 3
                  ? HeadingLevel.HEADING_3
                  : HeadingLevel.HEADING_4;
          children.push(
            new Paragraph({
              text: section.content,
              heading: level,
              spacing: { before: 300, after: 200 },
            })
          );
        } else if (section.type === "paragraph") {
          children.push(
            new Paragraph({
              text: section.content,
              spacing: { after: 200 },
            })
          );
        } else if (section.type === "list" && section.items) {
          for (const item of section.items) {
            children.push(
              new Paragraph({
                text: `• ${item}`,
                spacing: { after: 100 },
                indent: { left: 720 },
              })
            );
          }
        } else if (section.type === "code") {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.content,
                  font: "Consolas",
                  size: 18,
                }),
              ],
              shading: { fill: "f5f5f5" },
              spacing: { before: 200, after: 200 },
            })
          );
        } else if (section.type === "table" && section.tableData) {
          const tableRows = [
            new TableRow({
              children: section.tableData.headers.map(
                header =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: header, bold: true })],
                      }),
                    ],
                    shading: { fill: "e0e0e0" },
                  })
              ),
            }),
            ...section.tableData.rows.map(
              row =>
                new TableRow({
                  children: row.map(
                    cell =>
                      new TableCell({
                        children: [new Paragraph({ text: cell })],
                      })
                  ),
                })
            ),
          ];

          children.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                insideHorizontal: {
                  style: BorderStyle.SINGLE,
                  size: 1,
                  color: "cccccc",
                },
                insideVertical: {
                  style: BorderStyle.SINGLE,
                  size: 1,
                  color: "cccccc",
                },
              },
            })
          );
        }
      }

      const doc = new Document({
        sections: [{ children }],
        creator: "RASPUTIN",
        title: content.title,
      });

      const buffer = await Packer.toBlob(doc);
      saveAs(buffer, `${sanitizeFilename(content.title)}.docx`);
      showSuccess("docx");
    } finally {
      setExporting(null);
    }
  };

  // Export as PDF (using print)
  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${content.title}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.6;
              color: #1a1a1a;
            }
            h1 {
              color: #00d9c0;
              border-bottom: 3px solid #00d9c0;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            h2 { color: #333; margin-top: 32px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
            h3 { color: #444; margin-top: 24px; }
            .metadata {
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              padding: 16px 20px;
              border-radius: 8px;
              margin-bottom: 24px;
              font-size: 14px;
              color: #666;
              border-left: 4px solid #00d9c0;
            }
            hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
            pre {
              background: #1e1e1e;
              color: #d4d4d4;
              padding: 16px;
              border-radius: 8px;
              overflow-x: auto;
              font-family: 'Consolas', 'Monaco', monospace;
              font-size: 13px;
            }
            code {
              background: #f5f5f5;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Consolas', 'Monaco', monospace;
              font-size: 0.9em;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 10px 12px;
              text-align: left;
            }
            th {
              background: linear-gradient(135deg, #00d9c0 0%, #00b4a0 100%);
              color: white;
              font-weight: 600;
            }
            tr:nth-child(even) { background: #f9f9f9; }
            ul, ol { padding-left: 24px; }
            li { margin: 6px 0; }
            blockquote {
              border-left: 4px solid #00d9c0;
              margin: 16px 0;
              padding: 12px 20px;
              background: #f8f9fa;
              font-style: italic;
            }
            .footer {
              margin-top: 48px;
              padding-top: 16px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #999;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>${content.title}</h1>
          ${
            content.metadata
              ? `<div class="metadata">
              ${content.metadata.date ? `<strong>Date:</strong> ${content.metadata.date} ` : ""}
              ${content.metadata.mode ? `<strong>Mode:</strong> ${content.metadata.mode} ` : ""}
              ${content.metadata.model ? `<strong>Model:</strong> ${content.metadata.model} ` : ""}
              ${content.metadata.duration ? `<strong>Duration:</strong> ${content.metadata.duration} ` : ""}
              ${content.metadata.toolsUsed?.length ? `<strong>Tools:</strong> ${content.metadata.toolsUsed.join(", ")}` : ""}
            </div>`
              : ""
          }
          ${content.content
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/```[\s\S]*?```/g, match => {
              const code = match.replace(/```\w*\n?/g, "").replace(/```$/g, "");
              return `<pre>${code}</pre>`;
            })
            .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
            .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
            .replace(/<\/ul>\s*<ul>/g, "")
            .replace(/---/g, "<hr>")
            .replace(/\n\n/g, "</p><p>")
            .replace(/^\|(.+)\|$/gm, (match, content) => {
              const cells = content.split("|").map((c: string) => c.trim());
              return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join("")}</tr>`;
            })}
          <div class="footer">
            Generated by RASPUTIN - ${new Date().toLocaleDateString()}
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
      showSuccess("pdf");
    } finally {
      setExporting(null);
    }
  };

  const formats: Array<{
    format: ExportFormat;
    label: string;
    icon: React.ReactNode;
    action: () => Promise<void>;
    description: string;
  }> = [
    {
      format: "md",
      label: "Markdown",
      icon: <FileText className="h-4 w-4" />,
      action: exportMarkdown,
      description: "Plain text with formatting",
    },
    {
      format: "xlsx",
      label: "Excel",
      icon: <FileSpreadsheet className="h-4 w-4" />,
      action: exportExcel,
      description: "Spreadsheet format",
    },
    {
      format: "docx",
      label: "Word",
      icon: <FileType className="h-4 w-4" />,
      action: exportDocx,
      description: "Microsoft Word document",
    },
    {
      format: "pdf",
      label: "PDF",
      icon: <FileText className="h-4 w-4" />,
      action: exportPDF,
      description: "Print-ready document",
    },
  ];

  const buttonSizeClasses = {
    sm: "h-7 w-7",
    default: "h-9 w-9",
    lg: "h-10 w-10",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className={`${buttonSizeClasses[size]} hover:bg-primary/10 hover:text-primary transition-colors ${className}`}
            title="Export"
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size={size}
            className={`gap-2 hover:bg-primary/10 hover:border-primary/50 transition-colors ${className}`}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-background/95 backdrop-blur-lg border-border/50"
      >
        <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
          <Download className="h-3.5 w-3.5" />
          Export as
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.map(({ format, label, icon, action, description }) => (
          <DropdownMenuItem
            key={format}
            onClick={action}
            disabled={exporting !== null}
            className="flex items-center gap-3 py-2.5 cursor-pointer focus:bg-primary/10 focus:text-primary"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50">
              {exporting === format ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : success === format ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <span className="text-muted-foreground">{icon}</span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">
                {description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
