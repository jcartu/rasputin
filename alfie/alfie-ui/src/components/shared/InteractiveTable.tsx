"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Download,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc" | "none";

type SortState = {
  index: number | null;
  direction: SortDirection;
};

const buildCsv = (headers: string[], rows: string[][]): string => {
  const escapeValue = (value: string) => {
    const safeValue = value ?? "";
    const escaped = safeValue.replace(/"/g, '""');
    const needsQuotes = /[",\n]/.test(escaped);
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [headers, ...rows].map(row =>
    row.map(cell => escapeValue(cell ?? "")).join(",")
  );
  return lines.join("\n");
};

const normalizeValue = (value?: string) => (value ?? "").trim();

const toSafeFilename = (title?: string) => {
  if (!title) return "table-data";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
};

export function InteractiveTable({
  headers,
  rows,
  title,
}: {
  headers: string[];
  rows: string[][];
  title?: string;
}) {
  const [filterText, setFilterText] = useState("");
  const [sortState, setSortState] = useState<SortState>({
    index: null,
    direction: "none",
  });
  const [copied, setCopied] = useState(false);

  const normalizedFilter = filterText.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedFilter) return rows;
    return rows.filter(row =>
      row.some(cell =>
        normalizeValue(cell).toLowerCase().includes(normalizedFilter)
      )
    );
  }, [rows, normalizedFilter]);

  const headerKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return headers.map(header => {
      const base = normalizeValue(header) || "column";
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}-${count}`;
    });
  }, [headers]);

  const sortedRows = useMemo(() => {
    if (sortState.index === null || sortState.direction === "none") {
      return filteredRows;
    }

    const directionMultiplier = sortState.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const aValue = normalizeValue(a[sortState.index ?? 0]);
      const bValue = normalizeValue(b[sortState.index ?? 0]);
      return (
        aValue.localeCompare(bValue, undefined, {
          numeric: true,
          sensitivity: "base",
        }) * directionMultiplier
      );
    });
  }, [filteredRows, sortState]);

  const rowKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return sortedRows.map(row => {
      const base = row.map(cell => normalizeValue(cell)).join("||") || "row";
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}-${count}`;
    });
  }, [sortedRows]);

  const totalRows = rows.length;
  const visibleRows = sortedRows.length;

  const toggleSort = (index: number) => {
    setSortState(prev => {
      if (prev.index !== index) {
        return { index, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { index, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { index: null, direction: "none" };
      }
      return { index, direction: "asc" };
    });
  };

  const handleExport = () => {
    const csv = buildCsv(headers, sortedRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${toSafeFilename(title)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const csv = buildCsv(headers, sortedRows);
    await navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg border border-border/50 bg-card/30 overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {title && (
              <Badge variant="outline" className="text-xs">
                {title}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Showing {visibleRows} of {totalRows} rows
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copied" : "Copy CSV"}
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filterText}
            onChange={event => setFilterText(event.target.value)}
            placeholder="Filter rows"
            className={cn(
              "w-full rounded-lg border border-border/60 bg-background/60",
              "py-2.5 pl-9 pr-9 text-sm text-foreground",
              "placeholder:text-muted-foreground focus:outline-none",
              "focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            )}
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              aria-label="Clear filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="max-h-[420px] w-full">
        <div className="min-w-full">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/50 border-b border-border/50 sticky top-0 z-10">
              <tr>
                {headers.map((header, index) => {
                  const isSorted = sortState.index === index;
                  const icon = !isSorted
                    ? ArrowUpDown
                    : sortState.direction === "asc"
                    ? ArrowUp
                    : ArrowDown;
                  const Icon = icon;

                  return (
                    <th
                      key={headerKeys[index]}
                      className="px-4 py-3 text-left font-semibold text-foreground"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(index)}
                        className="inline-flex items-center gap-2 hover:text-primary transition-colors"
                      >
                        <span>{header}</span>
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isSorted
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(headers.length, 1)}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No matching rows
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, rowIndex) => (
                  <tr
                    key={rowKeys[rowIndex]}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {headers.map((_, colIndex) => (
                      <td
                        key={`${rowKeys[rowIndex]}-${headerKeys[colIndex]}`}
                        className="px-4 py-3 border-t border-border/30 text-foreground/90"
                      >
                        {row[colIndex] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}
