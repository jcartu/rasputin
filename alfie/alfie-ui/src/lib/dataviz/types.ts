// DataViz Type Definitions

export type DataValue = string | number | boolean | Date | null | undefined;

export interface DataRow {
  [key: string]: DataValue;
}

export type DataSet = DataRow[];

// Column type inference
export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'unknown';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  nullable: boolean;
  unique: number;
  min?: number | Date;
  max?: number | Date;
  mean?: number;
  median?: number;
  mode?: DataValue;
}

export interface DataSchema {
  columns: ColumnMeta[];
  rowCount: number;
}

// Chart Types
export type ChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'area' | 'histogram';

export interface ChartConfig {
  type: ChartType;
  title?: string;
  xField?: string;
  yField?: string;
  colorField?: string;
  sizeField?: string;
  groupField?: string;
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
  width?: number;
  height?: number;
  animate?: boolean;
  interactive?: boolean;
}

export interface LineChartConfig extends ChartConfig {
  type: 'line';
  curve?: 'linear' | 'step' | 'natural' | 'monotone';
  strokeWidth?: number;
  showPoints?: boolean;
  showArea?: boolean;
}

export interface BarChartConfig extends ChartConfig {
  type: 'bar';
  orientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  grouped?: boolean;
  barPadding?: number;
}

export interface ScatterChartConfig extends ChartConfig {
  type: 'scatter';
  pointSize?: number;
  opacity?: number;
  showTrendline?: boolean;
}

export interface PieChartConfig extends ChartConfig {
  type: 'pie';
  valueField: string;
  labelField: string;
  donut?: boolean;
  innerRadius?: number;
  showLabels?: boolean;
  showValues?: boolean;
}

export interface AreaChartConfig extends ChartConfig {
  type: 'area';
  stacked?: boolean;
  opacity?: number;
  curve?: 'linear' | 'step' | 'natural' | 'monotone';
}

export interface HistogramConfig extends ChartConfig {
  type: 'histogram';
  bins?: number;
  normalize?: boolean;
}

export type AnyChartConfig =
  | LineChartConfig
  | BarChartConfig
  | ScatterChartConfig
  | PieChartConfig
  | AreaChartConfig
  | HistogramConfig;

// Table Types
export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string;
  direction: SortDirection;
}

export interface FilterOperator {
  type: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'isNull' | 'isNotNull';
  value?: DataValue | DataValue[];
  value2?: DataValue; // for 'between'
}

export interface ColumnFilter {
  column: string;
  operator: FilterOperator;
}

export interface TableConfig {
  columns?: string[];
  sortable?: boolean;
  filterable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  selectable?: boolean;
  resizable?: boolean;
  stickyHeader?: boolean;
  striped?: boolean;
  compact?: boolean;
  showRowNumbers?: boolean;
  maxHeight?: number;
}

// Network/Graph Types
export interface GraphNode {
  id: string;
  label?: string;
  group?: string | number;
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  data?: Record<string, DataValue>;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
  label?: string;
  color?: string;
  data?: Record<string, DataValue>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NetworkConfig {
  layout?: 'force' | 'circular' | 'hierarchical' | 'radial';
  directed?: boolean;
  nodeSize?: number | ((node: GraphNode) => number);
  edgeWidth?: number | ((edge: GraphEdge) => number);
  nodeColor?: string | ((node: GraphNode) => string);
  edgeColor?: string | ((edge: GraphEdge) => string);
  showLabels?: boolean;
  showEdgeLabels?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableNodeDrag?: boolean;
  width?: number;
  height?: number;
  charge?: number;
  linkDistance?: number;
}

// Map Types
export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string;
  value?: number;
  color?: string;
  data?: Record<string, DataValue>;
}

export interface GeoRegion {
  id: string;
  value: number;
  label?: string;
  data?: Record<string, DataValue>;
}

export interface MapConfig {
  type?: 'points' | 'choropleth' | 'heatmap' | 'bubble';
  center?: [number, number];
  zoom?: number;
  projection?: 'mercator' | 'equalEarth' | 'orthographic' | 'albersUsa';
  geoJsonUrl?: string;
  valueField?: string;
  idField?: string;
  colorScale?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  width?: number;
  height?: number;
}

// D3 Custom Visualization
export interface D3Config {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  animate?: boolean;
  interactive?: boolean;
}

export type D3RenderFunction = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: DataSet,
  config: D3Config
) => void;

// CSV Import
export interface CSVParseOptions {
  delimiter?: string;
  header?: boolean;
  skipEmptyLines?: boolean;
  transformHeader?: (header: string) => string;
  dynamicTyping?: boolean;
  preview?: number;
}

export interface CSVParseResult {
  data: DataSet;
  schema: DataSchema;
  errors?: Array<{ row: number; message: string }>;
  meta: {
    delimiter: string;
    linebreak: string;
    fields: string[];
  };
}

// Data Transformation
export type AggregateFunction = 'sum' | 'mean' | 'median' | 'min' | 'max' | 'count' | 'first' | 'last';

export interface GroupByConfig {
  groupField: string;
  aggregations: Array<{
    field: string;
    fn: AggregateFunction;
    alias?: string;
  }>;
}

export interface TransformOperation {
  type: 'filter' | 'sort' | 'map' | 'groupBy' | 'pivot' | 'unpivot' | 'slice' | 'sample';
  config: unknown;
}

// Combined DataViz Configuration
export type VizType = 'chart' | 'table' | 'network' | 'map' | 'custom';

export interface DataVizConfig {
  type: VizType;
  data: DataSet | GraphData | GeoPoint[] | GeoRegion[];
  chartConfig?: AnyChartConfig;
  tableConfig?: TableConfig;
  networkConfig?: NetworkConfig;
  mapConfig?: MapConfig;
  d3Config?: D3Config;
  d3Render?: D3RenderFunction;
  title?: string;
  description?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

// Export/Import
export interface ExportOptions {
  format: 'csv' | 'json' | 'svg' | 'png';
  filename?: string;
  includeHeaders?: boolean;
}
