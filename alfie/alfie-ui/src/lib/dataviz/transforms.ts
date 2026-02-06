import Papa from 'papaparse';
import type {
  DataSet,
  DataRow,
  DataValue,
  ColumnType,
  ColumnMeta,
  DataSchema,
  CSVParseOptions,
  CSVParseResult,
  AggregateFunction,
  GroupByConfig,
  SortDirection,
  FilterOperator,
} from './types';

export function parseCSV(
  input: string | File,
  options: CSVParseOptions = {}
): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    const handleComplete = (results: Papa.ParseResult<DataRow>) => {
      const data = results.data as DataSet;
      const errors = results.errors.map((e) => ({
        row: e.row ?? 0,
        message: e.message,
      }));
      
      const schema = inferSchema(data);
      
      resolve({
        data,
        schema,
        errors: errors.length > 0 ? errors : undefined,
        meta: {
          delimiter: results.meta.delimiter,
          linebreak: results.meta.linebreak,
          fields: results.meta.fields || [],
        },
      });
    };

    const baseConfig = {
      delimiter: options.delimiter || '',
      header: options.header !== false,
      skipEmptyLines: options.skipEmptyLines !== false,
      dynamicTyping: options.dynamicTyping !== false,
      preview: options.preview,
      transformHeader: options.transformHeader || ((h: string) => h.trim()),
    };

    if (typeof input === 'string') {
      Papa.parse<DataRow>(input, {
        ...baseConfig,
        complete: handleComplete,
      });
    } else {
      Papa.parse<DataRow, File>(input, {
        ...baseConfig,
        complete: handleComplete,
        error: (error: Error) => reject(error),
      });
    }
  });
}

export function inferColumnType(values: DataValue[]): ColumnType {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) return 'unknown';

  const allNumbers = nonNullValues.every((v) => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      const num = parseFloat(v);
      return !isNaN(num) && isFinite(num);
    }
    return false;
  });
  if (allNumbers) return 'number';

  const allBooleans = nonNullValues.every((v) => {
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      return ['true', 'false', 'yes', 'no', '1', '0'].includes(lower);
    }
    return false;
  });
  if (allBooleans) return 'boolean';

  const allDates = nonNullValues.every((v) => {
    if (v instanceof Date) return !isNaN(v.getTime());
    if (typeof v === 'string') {
      const date = new Date(v);
      return !isNaN(date.getTime()) && v.match(/\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}/);
    }
    return false;
  });
  if (allDates) return 'date';

  return 'string';
}

export function inferSchema(data: DataSet): DataSchema {
  if (data.length === 0) {
    return { columns: [], rowCount: 0 };
  }

  const columnNames = Object.keys(data[0]);
  const columns: ColumnMeta[] = columnNames.map((name) => {
    const values = data.map((row) => row[name]);
    const type = inferColumnType(values);
    const nonNullValues = values.filter((v) => v !== null && v !== undefined);
    const uniqueValues = new Set(nonNullValues.map(String));

    const meta: ColumnMeta = {
      name,
      type,
      nullable: nonNullValues.length < values.length,
      unique: uniqueValues.size,
    };

    if (type === 'number') {
      const nums = nonNullValues.map((v) => Number(v)).filter((n) => !isNaN(n));
      if (nums.length > 0) {
        meta.min = Math.min(...nums);
        meta.max = Math.max(...nums);
        meta.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const sorted = [...nums].sort((a, b) => a - b);
        meta.median = sorted[Math.floor(sorted.length / 2)];
      }
    } else if (type === 'date') {
      const dates = nonNullValues
        .map((v) => (v instanceof Date ? v : new Date(String(v))))
        .filter((d) => !isNaN(d.getTime()));
      if (dates.length > 0) {
        meta.min = new Date(Math.min(...dates.map((d) => d.getTime())));
        meta.max = new Date(Math.max(...dates.map((d) => d.getTime())));
      }
    }

    const counts = new Map<string, number>();
    nonNullValues.forEach((v) => {
      const key = String(v);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    let maxCount = 0;
    let mode: string | undefined;
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count;
        mode = value;
      }
    });
    if (mode !== undefined) {
      meta.mode = type === 'number' ? Number(mode) : mode;
    }

    return meta;
  });

  return { columns, rowCount: data.length };
}

export function coerceValue(value: DataValue, type: ColumnType): DataValue {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'number': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      return isNaN(num) ? null : num;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const lower = String(value).toLowerCase();
      if (['true', 'yes', '1'].includes(lower)) return true;
      if (['false', 'no', '0'].includes(lower)) return false;
      return null;
    }
    case 'date': {
      if (value instanceof Date) return value;
      const date = new Date(String(value));
      return isNaN(date.getTime()) ? null : date;
    }
    case 'string':
      return String(value);
    default:
      return value;
  }
}

export function sortData(
  data: DataSet,
  column: string,
  direction: SortDirection
): DataSet {
  if (!direction) return data;

  return [...data].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    if (aVal === null || aVal === undefined) return direction === 'asc' ? 1 : -1;
    if (bVal === null || bVal === undefined) return direction === 'asc' ? -1 : 1;

    let comparison = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else if (aVal instanceof Date && bVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return direction === 'asc' ? comparison : -comparison;
  });
}

export function filterData(
  data: DataSet,
  column: string,
  operator: FilterOperator
): DataSet {
  return data.filter((row) => {
    const value = row[column];

    switch (operator.type) {
      case 'equals':
        return value === operator.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(operator.value).toLowerCase());
      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(operator.value).toLowerCase());
      case 'endsWith':
        return String(value).toLowerCase().endsWith(String(operator.value).toLowerCase());
      case 'gt':
        return Number(value) > Number(operator.value);
      case 'gte':
        return Number(value) >= Number(operator.value);
      case 'lt':
        return Number(value) < Number(operator.value);
      case 'lte':
        return Number(value) <= Number(operator.value);
      case 'between': {
        const numVal = Number(value);
        return numVal >= Number(operator.value) && numVal <= Number(operator.value2);
      }
      case 'in':
        return Array.isArray(operator.value) && operator.value.includes(value);
      case 'isNull':
        return value === null || value === undefined;
      case 'isNotNull':
        return value !== null && value !== undefined;
      default:
        return true;
    }
  });
}

export function aggregate(values: DataValue[], fn: AggregateFunction): DataValue {
  const nums = values
    .filter((v) => v !== null && v !== undefined)
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((n) => !isNaN(n));

  switch (fn) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);
    case 'mean':
      return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case 'median': {
      if (nums.length === 0) return null;
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case 'min':
      return nums.length > 0 ? Math.min(...nums) : null;
    case 'max':
      return nums.length > 0 ? Math.max(...nums) : null;
    case 'count':
      return values.filter((v) => v !== null && v !== undefined).length;
    case 'first':
      return values.find((v) => v !== null && v !== undefined) ?? null;
    case 'last':
      return [...values].reverse().find((v) => v !== null && v !== undefined) ?? null;
    default:
      return null;
  }
}

export function groupBy(data: DataSet, config: GroupByConfig): DataSet {
  const groups = new Map<string, DataRow[]>();

  data.forEach((row) => {
    const key = String(row[config.groupField] ?? '');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  });

  const result: DataSet = [];
  groups.forEach((rows, key) => {
    const aggregated: DataRow = {
      [config.groupField]: key,
    };

    config.aggregations.forEach((agg) => {
      const values = rows.map((r) => r[agg.field]);
      const fieldName = agg.alias || `${agg.fn}_${agg.field}`;
      aggregated[fieldName] = aggregate(values, agg.fn);
    });

    result.push(aggregated);
  });

  return result;
}

export function pivot(
  data: DataSet,
  indexField: string,
  pivotField: string,
  valueField: string,
  aggFn: AggregateFunction = 'sum'
): DataSet {
  const pivotValues = Array.from(new Set(data.map((row) => String(row[pivotField]))));
  const groups = new Map<string, Map<string, DataValue[]>>();

  data.forEach((row) => {
    const indexKey = String(row[indexField] ?? '');
    const pivotKey = String(row[pivotField] ?? '');
    const value = row[valueField];

    if (!groups.has(indexKey)) {
      groups.set(indexKey, new Map());
    }
    const pivotMap = groups.get(indexKey)!;
    if (!pivotMap.has(pivotKey)) {
      pivotMap.set(pivotKey, []);
    }
    pivotMap.get(pivotKey)!.push(value);
  });

  const result: DataSet = [];
  groups.forEach((pivotMap, indexKey) => {
    const row: DataRow = { [indexField]: indexKey };
    pivotValues.forEach((pv) => {
      const values = pivotMap.get(pv) || [];
      row[pv] = aggregate(values, aggFn);
    });
    result.push(row);
  });

  return result;
}

export function unpivot(
  data: DataSet,
  idColumns: string[],
  valueColumns: string[],
  variableName: string = 'variable',
  valueName: string = 'value'
): DataSet {
  const result: DataSet = [];

  for (const row of data) {
    for (const col of valueColumns) {
      const newRow: DataRow = {};
      for (const id of idColumns) {
        newRow[id] = row[id];
      }
      newRow[variableName] = col;
      newRow[valueName] = row[col];
      result.push(newRow);
    }
  }

  return result;
}

function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function sampleData(data: DataSet, n: number, seed?: number): DataSet {
  if (n >= data.length) return data;

  const shuffled = [...data];
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, n);
}

export function sliceData(data: DataSet, start: number, end?: number): DataSet {
  return data.slice(start, end);
}

export function mapColumns(
  data: DataSet,
  transforms: Record<string, (value: DataValue, row: DataRow) => DataValue>
): DataSet {
  return data.map((row) => {
    const newRow = { ...row };
    Object.entries(transforms).forEach(([col, fn]) => {
      newRow[col] = fn(row[col], row);
    });
    return newRow;
  });
}

export function addColumn(
  data: DataSet,
  name: string,
  compute: (row: DataRow, index: number) => DataValue
): DataSet {
  return data.map((row, i) => ({
    ...row,
    [name]: compute(row, i),
  }));
}

export function dropColumns(data: DataSet, columns: string[]): DataSet {
  return data.map((row) => {
    const newRow = { ...row };
    for (const col of columns) {
      delete newRow[col];
    }
    return newRow;
  });
}

export function renameColumns(data: DataSet, mapping: Record<string, string>): DataSet {
  return data.map((row) => {
    const newRow: DataRow = {};
    Object.entries(row).forEach(([key, value]) => {
      const newKey = mapping[key] || key;
      newRow[newKey] = value;
    });
    return newRow;
  });
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCSV(data: DataSet, includeHeaders: boolean = true): string {
  if (data.length === 0) return '';

  const columns = Object.keys(data[0]);
  const rows: string[] = [];

  if (includeHeaders) {
    rows.push(columns.map((c) => escapeCSVField(c)).join(','));
  }

  data.forEach((row) => {
    const values = columns.map((col) => escapeCSVField(String(row[col] ?? '')));
    rows.push(values.join(','));
  });

  return rows.join('\n');
}

export function toJSON(data: DataSet, pretty: boolean = true): string {
  return JSON.stringify(data, null, pretty ? 2 : undefined);
}

export function fillNA(
  data: DataSet,
  column: string,
  value: DataValue | 'forward' | 'backward' | 'mean' | 'median'
): DataSet {
  let fillValue: DataValue = null;

  if (value === 'mean' || value === 'median') {
    const values = data.map((r) => r[column]).filter((v) => v !== null && v !== undefined);
    fillValue = aggregate(values, value);
  } else if (value !== 'forward' && value !== 'backward') {
    fillValue = value;
  }

  const result = [...data];
  
  if (value === 'forward') {
    let lastValue: DataValue = null;
    for (let i = 0; i < result.length; i++) {
      if (result[i][column] !== null && result[i][column] !== undefined) {
        lastValue = result[i][column];
      } else {
        result[i] = { ...result[i], [column]: lastValue };
      }
    }
  } else if (value === 'backward') {
    let lastValue: DataValue = null;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i][column] !== null && result[i][column] !== undefined) {
        lastValue = result[i][column];
      } else {
        result[i] = { ...result[i], [column]: lastValue };
      }
    }
  } else {
    return data.map((row) => ({
      ...row,
      [column]: row[column] === null || row[column] === undefined ? fillValue : row[column],
    }));
  }

  return result;
}

export function join(
  left: DataSet,
  right: DataSet,
  leftKey: string,
  rightKey: string,
  type: 'inner' | 'left' | 'right' | 'outer' = 'inner'
): DataSet {
  const rightIndex = new Map<string, DataRow[]>();
  right.forEach((row) => {
    const key = String(row[rightKey] ?? '');
    if (!rightIndex.has(key)) {
      rightIndex.set(key, []);
    }
    rightIndex.get(key)!.push(row);
  });

  const result: DataSet = [];
  const matchedRightKeys = new Set<string>();

  left.forEach((leftRow) => {
    const key = String(leftRow[leftKey] ?? '');
    const rightRows = rightIndex.get(key) || [];

    if (rightRows.length > 0) {
      matchedRightKeys.add(key);
      rightRows.forEach((rightRow) => {
        result.push({ ...leftRow, ...rightRow });
      });
    } else if (type === 'left' || type === 'outer') {
      result.push({ ...leftRow });
    }
  });

  if (type === 'right' || type === 'outer') {
    right.forEach((rightRow) => {
      const key = String(rightRow[rightKey] ?? '');
      if (!matchedRightKeys.has(key)) {
        result.push({ ...rightRow });
      }
    });
  }

  return result;
}
