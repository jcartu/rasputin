'use client';

import { memo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Table,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCSV } from '@/lib/dataviz/transforms';
import type { DataSet, DataSchema, CSVParseOptions, CSVParseResult } from '@/lib/dataviz/types';

interface CSVImportProps {
  onImport: (data: DataSet, schema: DataSchema) => void;
  options?: CSVParseOptions;
  className?: string;
  accept?: string;
  maxSize?: number;
  showPreview?: boolean;
  previewRows?: number;
}

export const CSVImport = memo(function CSVImport({
  onImport,
  options = {},
  className,
  accept = '.csv,.tsv,.txt',
  maxSize = 50 * 1024 * 1024,
  showPreview = true,
  previewRows = 5,
}: CSVImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CSVParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setPreview(null);

    if (file.size > maxSize) {
      setError(`File too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
      return;
    }

    setIsLoading(true);

    try {
      const previewResult = await parseCSV(file, { ...options, preview: previewRows });
      
      if (showPreview) {
        setPreview(previewResult);
      } else {
        const fullResult = await parseCSV(file, options);
        onImport(fullResult.data, fullResult.schema);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setIsLoading(false);
    }
  }, [maxSize, options, showPreview, previewRows, onImport]);

  const handleConfirmImport = useCallback(async () => {
    if (!preview) return;

    setIsLoading(true);
    try {
      const fullResult = await parseCSV(fileInputRef.current?.files?.[0] as File, options);
      onImport(fullResult.data, fullResult.schema);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      setIsLoading(false);
    }
  }, [preview, options, onImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      setIsLoading(true);
      try {
        const result = await parseCSV(text, options);
        if (showPreview) {
          setPreview(result);
        } else {
          onImport(result.data, result.schema);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse pasted data');
      } finally {
        setIsLoading(false);
      }
    }
  }, [options, showPreview, onImport]);

  return (
    <div className={cn('space-y-4', className)}>
      <motion.div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          isLoading && 'pointer-events-none opacity-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        animate={{ scale: isDragging ? 1.02 : 1 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center justify-center text-center">
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : (
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
          )}

          <h3 className="text-lg font-semibold mb-2">
            {isLoading ? 'Processing...' : 'Drop CSV file here'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse, or paste data from clipboard
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>Supports CSV, TSV • Max {(maxSize / 1024 / 1024).toFixed(0)}MB</span>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-destructive/10 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-primary" />
                <div>
                  <h4 className="font-semibold">Preview</h4>
                  <p className="text-xs text-muted-foreground">
                    {preview.schema.rowCount} rows • {preview.schema.columns.length} columns
                    {preview.errors && preview.errors.length > 0 && (
                      <span className="text-amber-500 ml-2">
                        ({preview.errors.length} warnings)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {preview.schema.columns.map((col) => (
                  <span
                    key={col.name}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted"
                  >
                    <span className="font-medium">{col.name}</span>
                    <span className="text-muted-foreground">({col.type})</span>
                  </span>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {preview.schema.columns.map((col) => (
                        <th key={col.name} className="px-3 py-2 text-left font-medium">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.slice(0, previewRows).map((row, rowIdx) => (
                      <tr key={`row-${rowIdx}-${JSON.stringify(row).slice(0, 50)}`} className="border-t border-border/50">
                        {preview.schema.columns.map((col) => (
                          <td key={col.name} className="px-3 py-2 truncate max-w-[200px]">
                            {String(row[col.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.errors && preview.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 text-sm">
                  <p className="font-medium mb-1">Parse warnings:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {preview.errors.slice(0, 3).map((err) => (
                      <li key={`${err.row}-${err.message}`}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                    {preview.errors.length > 3 && (
                      <li>...and {preview.errors.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Import Full Data
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default CSVImport;
