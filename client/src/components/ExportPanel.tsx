import { useState } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileType,
  Loader2,
  CheckCircle2,
  Share2,
  FileCode,
  Copy,
  Archive,
  Printer,
} from "lucide-react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TableCell,
  TableRow,
  Table,
  WidthType,
  BorderStyle,
} from "docx";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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
  tables?: Array<{
    headers: string[];
    rows: string[][];
  }>;
  artifacts?: Array<{
    filename?: string;
    type: string;
    url?: string;
    downloadUrl?: string;
    path?: string;
    content?: string;
  }>;
}

type ExportFormat =
  | "md"
  | "xlsx"
  | "docx"
  | "pdf"
  | "html"
  | "link"
  | "copy"
  | "zip";

interface ExportPanelProps {
  content: ExportContent;
  className?: string;
}

const getFileIcon = (filename: string, type: string) => {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ||
    type === "image"
  ) {
    return {
      icon: <FileText className="w-5 h-5 text-pink-400" />,
      bg: "from-pink-500/20 to-purple-500/20",
    };
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return {
      icon: <FileSpreadsheet className="w-5 h-5 text-green-400" />,
      bg: "from-green-500/20 to-emerald-500/20",
    };
  }
  if (["docx", "doc"].includes(ext)) {
    return {
      icon: <FileType className="w-5 h-5 text-blue-400" />,
      bg: "from-blue-500/20 to-indigo-500/20",
    };
  }
  if (["pdf"].includes(ext) || type === "pdf") {
    return {
      icon: <FileText className="w-5 h-5 text-red-400" />,
      bg: "from-red-500/20 to-orange-500/20",
    };
  }
  if (["js", "ts", "tsx", "py", "html", "css", "json"].includes(ext)) {
    return {
      icon: <FileCode className="w-5 h-5 text-yellow-400" />,
      bg: "from-yellow-500/20 to-amber-500/20",
    };
  }
  return {
    icon: <FileText className="w-5 h-5 text-cyan-400" />,
    bg: "from-cyan-500/20 to-blue-500/20",
  };
};

export function ExportPanel({ content, className = "" }: ExportPanelProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [success, setSuccess] = useState<ExportFormat | null>(null);
  const [fetchedDocContent, setFetchedDocContent] = useState<string | null>(
    null
  );
  const [exportingPdfPath, setExportingPdfPath] = useState<string | null>(null);
  const exportReportPdf = trpc.jarvis.exportReportPdf.useMutation();

  const getDocumentContent = async (): Promise<string> => {
    if (fetchedDocContent !== null) {
      return fetchedDocContent || content.content;
    }

    const docArtifact = content.artifacts?.find(
      a =>
        a.filename?.match(/\.(md|txt|markdown)$/i) ||
        (a.type === "file" && a.filename?.match(/report|forecast|analysis/i))
    );

    if (docArtifact) {
      if (docArtifact.content && docArtifact.content.length > 100) {
        setFetchedDocContent(docArtifact.content);
        return docArtifact.content;
      }

      const url = docArtifact.downloadUrl || docArtifact.url;
      if (url) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            if (text && text.length > 50) {
              setFetchedDocContent(text);
              return text;
            }
          }
        } catch (e) {
          console.error("Failed to fetch document content:", e);
        }
      }
    }

    setFetchedDocContent(content.content);
    return content.content;
  };

  const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9]/gi, "-").substring(0, 50);
  };

  const showSuccess = (format: ExportFormat) => {
    setSuccess(format);
    setTimeout(() => setSuccess(null), 2000);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

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

      if (line.includes("|") && lines[i + 1]?.match(/^\|[\s-:|]+\|$/)) {
        const headers = line
          .split("|")
          .filter(c => c.trim())
          .map(c => c.trim());
        const rows: string[][] = [];
        i += 2;
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

      if (line.match(/^[-*]\s+/)) {
        const items: string[] = [];
        while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
          items.push(lines[i].replace(/^[-*]\s+/, ""));
          i++;
        }
        sections.push({ type: "list", content: "", items });
        continue;
      }

      if (line.trim()) {
        sections.push({ type: "paragraph", content: line });
      }
      i++;
    }
    return sections;
  };

  const exportMarkdown = async () => {
    setExporting("md");
    try {
      const docContent = await getDocumentContent();
      let markdown = `# ${content.title}\n\n`;
      if (content.metadata) {
        markdown += `---\n`;
        Object.entries(content.metadata).forEach(([key, value]) => {
          if (value)
            markdown += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(value) ? value.join(", ") : value}\n`;
        });
        markdown += `---\n\n`;
      }
      markdown += docContent;
      const blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8",
      });
      saveAs(blob, `${sanitizeFilename(content.title)}.md`);
      showSuccess("md");
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting("xlsx");
    try {
      const docContent = await getDocumentContent();
      const wb = XLSX.utils.book_new();
      const contentRows: string[][] = [["Title", content.title], [""]];

      const sections = parseContent(docContent);
      sections.forEach(section => {
        if (section.type === "heading") contentRows.push([section.content]);
        else if (section.type === "paragraph")
          contentRows.push([section.content]);
        else if (section.type === "list")
          section.items?.forEach(item => contentRows.push([`• ${item}`]));
        else if (section.type === "code")
          contentRows.push(["[Code]", section.content]);
        contentRows.push([""]);
      });

      const ws = XLSX.utils.aoa_to_sheet(contentRows);
      ws["!cols"] = [{ wch: 20 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(wb, ws, "Content");

      const allTables = [
        ...(content.tables || []),
        ...sections
          .filter(s => s.type === "table" && s.tableData)
          .map(s => s.tableData!),
      ];
      allTables.forEach((table, idx) => {
        const tableWs = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
        XLSX.utils.book_append_sheet(wb, tableWs, `Data ${idx + 1}`);
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

  const exportDocx = async () => {
    setExporting("docx");
    try {
      const docContent = await getDocumentContent();
      const children: (Paragraph | Table)[] = [];
      children.push(
        new Paragraph({
          text: content.title,
          heading: HeadingLevel.TITLE,
          spacing: { after: 400 },
        })
      );

      const sections = parseContent(docContent);
      for (const section of sections) {
        if (section.type === "heading") {
          children.push(
            new Paragraph({
              text: section.content,
              heading:
                section.level === 1
                  ? HeadingLevel.HEADING_1
                  : HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            })
          );
        } else if (section.type === "paragraph") {
          children.push(
            new Paragraph({ text: section.content, spacing: { after: 200 } })
          );
        } else if (section.type === "list") {
          section.items?.forEach(item =>
            children.push(
              new Paragraph({
                text: `• ${item}`,
                spacing: { after: 100 },
                indent: { left: 720 },
              })
            )
          );
        } else if (section.type === "table" && section.tableData) {
          const rows = [
            section.tableData.headers,
            ...section.tableData.rows,
          ].map(
            row =>
              new TableRow({
                children: row.map(
                  cell =>
                    new TableCell({ children: [new Paragraph({ text: cell })] })
                ),
              })
          );
          children.push(
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                insideVertical: { style: BorderStyle.SINGLE, size: 1 },
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

  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const docContent = await getDocumentContent();
      const htmlContent = `<!DOCTYPE html><html><body><h1>${content.title}</h1><div>${docContent.replace(/\n/g, "<br>")}</div></body></html>`;

      const response = await fetch("/api/files/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: htmlContent,
          filename: `${sanitizeFilename(content.title)}.pdf`,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        saveAs(blob, `${sanitizeFilename(content.title)}.pdf`);
        showSuccess("pdf");
      } else {
        throw new Error("PDF export failed");
      }
    } catch (e) {
      toast.error("Using browser print as fallback");
      window.print();
      showSuccess("pdf");
    } finally {
      setExporting(null);
    }
  };

  const exportHTML = async () => {
    setExporting("html");
    try {
      const docContent = await getDocumentContent();
      const html = `<!DOCTYPE html>
<html>
<head><title>${content.title}</title>
<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:1rem;background:#111;color:#eee}pre{background:#222;padding:1rem;border-radius:4px;overflow:auto}blockquote{border-left:4px solid #00d9c0;padding-left:1rem;color:#aaa}</style>
</head>
<body><h1>${content.title}</h1>${docContent.replace(/\n/g, "<br>")}</body>
</html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      saveAs(blob, `${sanitizeFilename(content.title)}.html`);
      showSuccess("html");
    } finally {
      setExporting(null);
    }
  };

  const copyToClipboard = async () => {
    setExporting("copy");
    try {
      const docContent = await getDocumentContent();
      await navigator.clipboard.writeText(docContent);
      showSuccess("copy");
      toast.success("Copied to clipboard");
    } finally {
      setExporting(null);
    }
  };

  const ExportTile = ({
    format,
    icon,
    label,
    desc,
    onClick,
    colorClass,
  }: {
    format: ExportFormat;
    icon: React.ReactNode;
    label: string;
    desc: string;
    onClick: () => void;
    colorClass: string;
  }) => {
    const isExporting = exporting === format;
    const isSuccess = success === format;

    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        disabled={exporting !== null}
        className={cn(
          "relative flex flex-col items-start p-4 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-all text-left group overflow-hidden",
          isSuccess && "border-green-500/50 bg-green-500/10"
        )}
      >
        <div
          className={cn(
            "p-2 rounded-lg mb-3 transition-colors",
            colorClass,
            "bg-opacity-10 text-opacity-100"
          )}
        >
          {isExporting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            icon
          )}
        </div>
        <div className="font-semibold text-sm mb-1">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>

        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </motion.button>
    );
  };

  return (
    <div className={cn("w-full space-y-6", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Export Report
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ExportTile
          format="pdf"
          label="PDF Document"
          desc="Professional format"
          icon={<FileText className="w-5 h-5 text-red-400" />}
          onClick={exportPDF}
          colorClass="bg-red-500/20 text-red-400"
        />
        <ExportTile
          format="docx"
          label="Word Document"
          desc="Editable document"
          icon={<FileType className="w-5 h-5 text-blue-400" />}
          onClick={exportDocx}
          colorClass="bg-blue-500/20 text-blue-400"
        />
        <ExportTile
          format="xlsx"
          label="Excel Spreadsheet"
          desc="Data & tables"
          icon={<FileSpreadsheet className="w-5 h-5 text-green-400" />}
          onClick={exportExcel}
          colorClass="bg-green-500/20 text-green-400"
        />
        <ExportTile
          format="html"
          label="Web Page"
          desc="Standalone HTML"
          icon={<Share2 className="w-5 h-5 text-orange-400" />}
          onClick={exportHTML}
          colorClass="bg-orange-500/20 text-orange-400"
        />
        <ExportTile
          format="md"
          label="Markdown"
          desc="Raw text format"
          icon={<FileCode className="w-5 h-5 text-slate-400" />}
          onClick={exportMarkdown}
          colorClass="bg-slate-500/20 text-slate-400"
        />
        <ExportTile
          format="copy"
          label="Copy Text"
          desc="To clipboard"
          icon={<Copy className="w-5 h-5 text-yellow-400" />}
          onClick={copyToClipboard}
          colorClass="bg-yellow-500/20 text-yellow-400"
        />
      </div>

      {content.artifacts && content.artifacts.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border/40">
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold">Generated Files</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {content.artifacts.map((artifact, i) => {
              const iconInfo = getFileIcon(
                artifact.filename || "",
                artifact.type
              );
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/30 transition-colors group"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0",
                      iconInfo.bg
                    )}
                  >
                    {iconInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {artifact.filename || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {artifact.type}
                    </div>
                  </div>
                  {artifact.filename?.endsWith(".html") && artifact.path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={exportingPdfPath === artifact.path}
                      onClick={async () => {
                        if (!artifact.path) return;
                        setExportingPdfPath(artifact.path);
                        try {
                          const result = await exportReportPdf.mutateAsync({
                            htmlPath: artifact.path,
                          });
                          const byteArray = Uint8Array.from(
                            atob(result.base64),
                            c => c.charCodeAt(0)
                          );
                          const blob = new Blob([byteArray], {
                            type: "application/pdf",
                          });
                          saveAs(blob, result.fileName);
                          toast.success("PDF exported successfully");
                        } catch (err) {
                          toast.error(
                            `PDF export failed: ${err instanceof Error ? err.message : "Unknown error"}`
                          );
                        } finally {
                          setExportingPdfPath(null);
                        }
                      }}
                      title="Export to PDF"
                    >
                      {exportingPdfPath === artifact.path ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = artifact.downloadUrl || artifact.url || "";
                      a.download = artifact.filename || "download";
                      a.click();
                    }}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
