'use client';

import { memo, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Columns,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sortData, filterData, toCSV, toJSON } from '@/lib/dataviz/transforms';
import type {
  DataSet,
  DataRow,
  DataValue,
  TableConfig,
  SortState,
  ColumnFilter,
  FilterOperator,
} from '@/lib/dataviz/types';

interface DataTableProps {
  data: DataSet;
  config?: TableConfig;
  className?: string;
  onRowClick?: (row: DataRow, index: number) => void;
  onSelectionChange?: (selectedRows: DataRow[]) => void;
}

export const DataTable = memo(function DataTable({
  data,
  config = {},
  className,
  onRowClick,
  onSelectionChange,
}: DataTableProps) {
  const {
    columns: configColumns,
    sortable = true,
    filterable = true,
    paginated = true,
    pageSize = 20,
    selectable = false,
    stickyHeader = true,
    striped = true,
    compact = false,
    showRowNumbers = false,
    maxHeight,
  } = config;

  const allColumns = useMemo(() => {
    if (configColumns?.length) return configColumns;
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data, configColumns]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(allColumns));
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const processedData = useMemo(() => {
    let result = [...data];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          String(val ?? '').toLowerCase().includes(query)
        )
      );
    }

    filters.forEach((f) => {
      result = filterData(result, f.column, f.operator);
    });

    if (sort) {
      result = sortData(result, sort.column, sort.direction);
    }

    return result;
  }, [data, searchQuery, filters, sort]);

  const paginatedData = useMemo(() => {
    if (!paginated) return processedData;
    const start = page * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, paginated, page, pageSize]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  const handleSort = useCallback((column: string) => {
    if (!sortable) return;
    setSort((prev) => {
      if (prev?.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      return null;
    });
  }, [sortable]);

  const handleFilter = useCallback((column: string, operator: FilterOperator) => {
    setFilters((prev) => {
      const existing = prev.findIndex((f) => f.column === column);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { column, operator };
        return updated;
      }
      return [...prev, { column, operator }];
    });
    setActiveFilterColumn(null);
    setPage(0);
  }, []);

  const removeFilter = useCallback((column: string) => {
    setFilters((prev) => prev.filter((f) => f.column !== column));
    setPage(0);
  }, []);

  const toggleRowSelection = useCallback((index: number) => {
    if (!selectable) return;
    setSelectedRows((prev) => {
      const updated = new Set(prev);
      if (updated.has(index)) {
        updated.delete(index);
      } else {
        updated.add(index);
      }
      if (onSelectionChange) {
        const selected = Array.from(updated).map((i) => processedData[i]);
        onSelectionChange(selected);
      }
      return updated;
    });
  }, [selectable, onSelectionChange, processedData]);

  const toggleAllSelection = useCallback(() => {
    if (!selectable) return;
    setSelectedRows((prev) => {
      if (prev.size === processedData.length) {
        onSelectionChange?.([]);
        return new Set();
      }
      const all = new Set(processedData.map((_, i) => i));
      onSelectionChange?.(processedData);
      return all;
    });
  }, [selectable, processedData, onSelectionChange]);

  const handleExport = useCallback((format: 'csv' | 'json') => {
    const exportData = processedData.map((row) => {
      const filtered: DataRow = {};
      Array.from(visibleColumns).forEach((col) => {
        filtered[col] = row[col];
      });
      return filtered;
    });

    const content = format === 'csv' ? toCSV(exportData) : toJSON(exportData);
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [processedData, visibleColumns]);

  const displayColumns = allColumns.filter((col) => visibleColumns.has(col));

  return (
    <div className={cn('rounded-xl border border-border bg-card/50 overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 p-3 border-b border-border bg-muted/30">
        {filterable && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {filters.length > 0 && (
            <div className="flex items-center gap-1">
              {filters.map((f) => (
                <span
                  key={f.column}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                >
                  {f.column}: {f.operator.type}
                  <button
                    type="button"
                    onClick={() => removeFilter(f.column)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              title="Column visibility"
            >
              <Columns className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showColumnPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-1 z-20 w-48 p-2 rounded-lg border border-border bg-popover shadow-lg"
                >
                  {allColumns.map((col) => (
                    <label
                      key={col}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col)}
                        onChange={() => {
                          setVisibleColumns((prev) => {
                            const updated = new Set(prev);
                            if (updated.has(col)) {
                              updated.delete(col);
                            } else {
                              updated.add(col);
                            }
                            return updated;
                          });
                        }}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                          visibleColumns.has(col)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border'
                        )}
                      >
                        {visibleColumns.has(col) && <Check className="w-3 h-3" />}
                      </span>
                      <span className="truncate">{col}</span>
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="overflow-auto"
        style={{ maxHeight: maxHeight || 500 }}
      >
        <table className="w-full text-sm">
          <thead className={cn(stickyHeader && 'sticky top-0 z-10 bg-card')}>
            <tr className="border-b border-border">
              {selectable && (
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === processedData.length && processedData.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded border-border"
                  />
                </th>
              )}
              {showRowNumbers && (
                <th className="w-12 px-3 py-3 text-left text-muted-foreground font-medium">#</th>
              )}
              {displayColumns.map((col) => (
                <th
                  key={col}
                  className={cn(
                    'px-4 py-3 text-left font-semibold',
                    sortable && 'cursor-pointer hover:bg-muted/50 select-none'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className="flex items-center gap-1"
                    >
                      {col}
                      {sort?.column === col && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          {sort.direction === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          )}
                        </motion.span>
                      )}
                    </button>
                    {filterable && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveFilterColumn(activeFilterColumn === col ? null : col)}
                          className={cn(
                            'p-1 rounded hover:bg-muted transition-colors',
                            filters.some((f) => f.column === col) && 'text-primary'
                          )}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                        <AnimatePresence>
                          {activeFilterColumn === col && (
                            <FilterPopover
                              column={col}
                              data={data}
                              onFilter={handleFilter}
                              onClose={() => setActiveFilterColumn(null)}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => {
              const globalIndex = paginated ? page * pageSize + rowIndex : rowIndex;
              return (
                <motion.tr
                  key={globalIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: rowIndex * 0.01 }}
                  onClick={() => onRowClick?.(row, globalIndex)}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    striped && rowIndex % 2 === 1 && 'bg-muted/20',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    selectedRows.has(globalIndex) && 'bg-primary/10'
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(globalIndex)}
                        onChange={() => toggleRowSelection(globalIndex)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-border"
                      />
                    </td>
                  )}
                  {showRowNumbers && (
                    <td className="px-3 py-2 text-muted-foreground">{globalIndex + 1}</td>
                  )}
                  {displayColumns.map((col) => (
                    <td
                      key={col}
                      className={cn('px-4', compact ? 'py-1.5' : 'py-2.5')}
                    >
                      <CellValue value={row[col]} />
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <span className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, processedData.length)} of{' '}
            {processedData.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm px-3">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

function CellValue({ value }: { value: DataValue }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          value ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
        )}
      >
        {value ? 'true' : 'false'}
      </span>
    );
  }
  if (value instanceof Date) {
    return <span>{value.toLocaleString()}</span>;
  }
  if (typeof value === 'number') {
    return <span className="font-mono">{value.toLocaleString()}</span>;
  }
  const str = String(value);
  if (str.length > 100) {
    return <span title={str}>{str.slice(0, 100)}...</span>;
  }
  return <span>{str}</span>;
}

interface FilterPopoverProps {
  column: string;
  data: DataSet;
  onFilter: (column: string, operator: FilterOperator) => void;
  onClose: () => void;
}

function FilterPopover({ column, data, onFilter, onClose }: FilterPopoverProps) {
  const [filterType, setFilterType] = useState<FilterOperator['type']>('contains');
  const [filterValue, setFilterValue] = useState('');
  const [filterValue2, setFilterValue2] = useState('');

  const uniqueValues = useMemo(() => {
    const values = new Set(data.map((row) => String(row[column] ?? '')));
    return Array.from(values).slice(0, 20);
  }, [data, column]);

  const handleApply = () => {
    const operator: FilterOperator = {
      type: filterType,
      value: filterValue,
      ...(filterType === 'between' && { value2: filterValue2 }),
    };
    onFilter(column, operator);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute left-0 top-full mt-1 z-20 w-64 p-3 rounded-lg border border-border bg-popover shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value as FilterOperator['type'])}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background mb-2"
      >
        <option value="contains">Contains</option>
        <option value="equals">Equals</option>
        <option value="startsWith">Starts with</option>
        <option value="endsWith">Ends with</option>
        <option value="gt">Greater than</option>
        <option value="gte">Greater or equal</option>
        <option value="lt">Less than</option>
        <option value="lte">Less or equal</option>
        <option value="between">Between</option>
        <option value="isNull">Is null</option>
        <option value="isNotNull">Is not null</option>
      </select>

      {!['isNull', 'isNotNull'].includes(filterType) && (
        <>
          <input
            type="text"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Value"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background mb-2"
            list={`filter-${column}-suggestions`}
          />
          <datalist id={`filter-${column}-suggestions`}>
            {uniqueValues.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </>
      )}

      {filterType === 'between' && (
        <input
          type="text"
          value={filterValue2}
          onChange={(e) => setFilterValue2(e.target.value)}
          placeholder="Value 2"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background mb-2"
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

export default DataTable;
