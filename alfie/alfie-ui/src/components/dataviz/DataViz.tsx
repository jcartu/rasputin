'use client';

import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Table2,
  Share2,
  MapPin,
  Code2,
  Download,
  Settings,
  Maximize2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chart } from './Chart';
import { DataTable } from './DataTable';
import { NetworkGraph } from './NetworkGraph';
import { GeoMap } from './GeoMap';
import { D3Wrapper } from './D3Wrapper';
import type {
  DataVizConfig,
  DataSet,
  GraphData,
  GeoPoint,
  GeoRegion,
  VizType,
} from '@/lib/dataviz/types';

interface DataVizProps {
  config: DataVizConfig;
  className?: string;
  inline?: boolean;
}

const VIZ_ICONS: Record<VizType, React.ComponentType<{ className?: string }>> = {
  chart: BarChart3,
  table: Table2,
  network: Share2,
  map: MapPin,
  custom: Code2,
};

export const DataViz = memo(function DataViz({
  config,
  className,
  inline = false,
}: DataVizProps) {
  const [showInfo, setShowInfo] = useState(false);

  const { type, data, title, description, width, height } = config;

  const Icon = VIZ_ICONS[type];

  const containerStyle = useMemo(() => ({
    width: typeof width === 'number' ? `${width}px` : width || '100%',
    maxWidth: '100%',
  }), [width]);

  const renderVisualization = () => {
    switch (type) {
      case 'chart':
        if (!config.chartConfig) return <EmptyState message="No chart configuration provided" />;
        return (
          <Chart
            data={data as DataSet}
            config={config.chartConfig}
            className="border-0 rounded-none"
          />
        );

      case 'table':
        return (
          <DataTable
            data={data as DataSet}
            config={config.tableConfig}
            className="border-0 rounded-none"
          />
        );

      case 'network':
        if (!isGraphData(data)) return <EmptyState message="Invalid network data format" />;
        return (
          <NetworkGraph
            data={data}
            config={config.networkConfig}
            className="border-0 rounded-none"
          />
        );

      case 'map':
        return (
          <GeoMap
            data={data as GeoPoint[] | GeoRegion[]}
            config={config.mapConfig}
            className="border-0 rounded-none"
          />
        );

      case 'custom':
        if (!config.d3Render) return <EmptyState message="No custom render function provided" />;
        return (
          <D3Wrapper
            data={data as DataSet}
            render={config.d3Render}
            config={config.d3Config}
            className="border-0 rounded-none"
          />
        );

      default:
        return <EmptyState message={`Unknown visualization type: ${type}`} />;
    }
  };

  if (inline) {
    return (
      <div className={cn('my-4', className)} style={containerStyle}>
        {renderVisualization()}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        'rounded-xl border border-border bg-card overflow-hidden',
        className
      )}
      style={containerStyle}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {(title || description) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              {title && <h3 className="font-semibold text-sm">{title}</h3>}
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          </div>

          {description && (
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Info className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showInfo && description && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-3 bg-muted/20 border-b border-border text-sm text-muted-foreground"
          >
            {description}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative" style={{ minHeight: height || 'auto' }}>
        {renderVisualization()}
      </div>
    </motion.div>
  );
});

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

function isGraphData(data: unknown): data is GraphData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.nodes) && Array.isArray(d.edges);
}

export default DataViz;
