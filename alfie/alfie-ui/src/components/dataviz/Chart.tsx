'use client';

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import * as Plot from '@observablehq/plot';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  DataSet,
  AnyChartConfig,
  LineChartConfig,
  BarChartConfig,
  ScatterChartConfig,
  PieChartConfig,
  AreaChartConfig,
  HistogramConfig,
} from '@/lib/dataviz/types';

const DEFAULT_COLORS = [
  'hsl(262, 83%, 58%)',
  'hsl(187, 92%, 45%)',
  'hsl(142, 76%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(280, 75%, 60%)',
  'hsl(210, 79%, 55%)',
  'hsl(330, 80%, 55%)',
];

type CurveType = 'linear' | 'step' | 'natural' | 'monotone-x';

interface ChartProps {
  data: DataSet;
  config: AnyChartConfig;
  className?: string;
  onDataPointClick?: (point: Record<string, unknown>) => void;
}

export const Chart = memo(function Chart({
  data,
  config,
  className,
  onDataPointClick,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);

  const colors = config.colors || DEFAULT_COLORS;
  const width = config.width || 600;
  const height = config.height || 400;

  const buildPlot = useCallback(() => {
    if (!containerRef.current || data.length === 0) return null;

    const baseOptions: Plot.PlotOptions = {
      width: isFullscreen ? window.innerWidth - 80 : width,
      height: isFullscreen ? window.innerHeight - 120 : height,
      style: {
        background: 'transparent',
        overflow: 'visible',
      },
      marginLeft: 60,
      marginRight: 20,
      marginTop: 40,
      marginBottom: 50,
    };

    if (config.showGrid !== false) {
      baseOptions.grid = true;
    }

    if (config.xLabel || config.xField) {
      baseOptions.x = { label: config.xLabel || config.xField };
    }
    if (config.yLabel || config.yField) {
      baseOptions.y = { label: config.yLabel || config.yField };
    }

    if (config.title) {
      baseOptions.title = config.title;
    }

    let marks: Plot.Markish[] = [];

    switch (config.type) {
      case 'line':
        marks = buildLineChart(data, config as LineChartConfig, colors);
        break;
      case 'bar':
        marks = buildBarChart(data, config as BarChartConfig, colors);
        break;
      case 'scatter':
        marks = buildScatterChart(data, config as ScatterChartConfig, colors);
        break;
      case 'pie':
        return buildPieChart(data, config as PieChartConfig, colors, width, height);
      case 'area':
        marks = buildAreaChart(data, config as AreaChartConfig, colors);
        break;
      case 'histogram':
        marks = buildHistogram(data, config as HistogramConfig, colors);
        break;
    }

    if (config.showLegend !== false && config.colorField) {
      const colorDomain = Array.from(new Set(data.map((d) => String(d[config.colorField!]))));
      baseOptions.color = {
        legend: true,
        domain: colorDomain,
        range: colors,
      };
    }

    return Plot.plot({ ...baseOptions, marks });
  }, [data, config, colors, width, height, isFullscreen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    const plot = buildPlot();
    if (plot) {
      container.appendChild(plot);

      if (config.interactive !== false && onDataPointClick) {
        const svg = container.querySelector('svg');
        if (svg) {
          svg.querySelectorAll('circle, rect, path').forEach((el) => {
            el.addEventListener('click', (e) => {
              const target = e.target as SVGElement;
              const index = target.getAttribute('data-index');
              if (index !== null) {
                onDataPointClick(data[parseInt(index)] as Record<string, unknown>);
              }
            });
          });
        }
      }
    }

    return () => {
      container.innerHTML = '';
    };
  }, [buildPlot, config.interactive, onDataPointClick, data]);

  const handleExport = useCallback(
    (format: 'svg' | 'png') => {
      const container = containerRef.current;
      if (!container) return;

      const svg = container.querySelector('svg');
      if (!svg) return;

      if (format === 'svg') {
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        downloadBlob(blob, `chart-${Date.now()}.svg`);
      } else {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx?.scale(2, 2);
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) downloadBlob(blob, `chart-${Date.now()}.png`);
          });
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      }
    },
    []
  );

  return (
    <motion.div
      className={cn(
        'relative rounded-xl border border-border bg-card/50 overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50 bg-background',
        className
      )}
      layout
    >
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button
          type="button"
          onClick={() => handleExport('svg')}
          className="p-1.5 rounded-md bg-muted/80 hover:bg-muted transition-colors"
          title="Export SVG"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded-md bg-muted/80 hover:bg-muted transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center p-4"
        style={{ minHeight: height }}
      />

      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute pointer-events-none z-20 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg text-sm"
            style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}
          >
            {tooltip.content}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

function getCurve(curve: string): CurveType {
  const curveMap: Record<string, CurveType> = {
    linear: 'linear',
    step: 'step',
    natural: 'natural',
    monotone: 'monotone-x',
  };
  return curveMap[curve] || 'linear';
}

function buildLineChart(
  data: DataSet,
  config: LineChartConfig,
  colors: string[]
): Plot.Markish[] {
  const marks: Plot.Markish[] = [];
  const { xField, yField, colorField, curve = 'linear', strokeWidth = 2, showPoints = true, showArea = false } = config;

  if (!xField || !yField) return marks;

  const curveValue = getCurve(curve);

  if (showArea) {
    marks.push(
      Plot.areaY(data, {
        x: xField,
        y: yField,
        ...(colorField && { fill: colorField }),
        fillOpacity: 0.2,
        curve: curveValue,
      })
    );
  }

  marks.push(
    Plot.lineY(data, {
      x: xField,
      y: yField,
      ...(colorField && { stroke: colorField }),
      strokeWidth,
      curve: curveValue,
    })
  );

  if (showPoints) {
    marks.push(
      Plot.dot(data, {
        x: xField,
        y: yField,
        ...(colorField && { fill: colorField }),
        r: 4,
        tip: true,
      })
    );
  }

  return marks;
}

function buildBarChart(
  data: DataSet,
  config: BarChartConfig,
  colors: string[]
): Plot.Markish[] {
  const marks: Plot.Markish[] = [];
  const { xField, yField, colorField, orientation = 'vertical' } = config;

  if (!xField || !yField) return marks;

  if (orientation === 'vertical') {
    marks.push(
      Plot.barY(data, {
        x: xField,
        y: yField,
        ...(colorField && { fill: colorField }),
        tip: true,
      })
    );
  } else {
    marks.push(
      Plot.barX(data, {
        x: yField,
        y: xField,
        ...(colorField && { fill: colorField }),
        tip: true,
      })
    );
  }

  marks.push(Plot.ruleY([0]));

  return marks;
}

function buildScatterChart(
  data: DataSet,
  config: ScatterChartConfig,
  colors: string[]
): Plot.Markish[] {
  const marks: Plot.Markish[] = [];
  const { xField, yField, colorField, sizeField, pointSize = 6, opacity = 0.7, showTrendline = false } = config;

  if (!xField || !yField) return marks;

  marks.push(
    Plot.dot(data, {
      x: xField,
      y: yField,
      ...(colorField && { fill: colorField }),
      ...(sizeField ? { r: sizeField } : { r: pointSize }),
      fillOpacity: opacity,
      tip: true,
    })
  );

  if (showTrendline) {
    marks.push(
      Plot.linearRegressionY(data, {
        x: xField,
        y: yField,
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeDasharray: '4,4',
      })
    );
  }

  return marks;
}

function buildPieChart(
  data: DataSet,
  config: PieChartConfig,
  colors: string[],
  width: number,
  height: number
): SVGSVGElement {
  const { valueField, labelField, donut = false, innerRadius = 0, showLabels = true, showValues = true } = config;

  const total = data.reduce((sum, item) => sum + Number(item[valueField] || 0), 0);
  const size = Math.min(width, height);
  const radius = size / 2 - 40;
  const innerR = donut ? radius * 0.5 : innerRadius;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${width / 2}, ${height / 2})`);

  let startAngle = 0;
  data.forEach((item, i) => {
    const value = Number(item[valueField] || 0);
    const angle = (value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = Math.cos(startAngle) * radius;
    const y1 = Math.sin(startAngle) * radius;
    const x2 = Math.cos(endAngle) * radius;
    const y2 = Math.sin(endAngle) * radius;

    const ix1 = Math.cos(startAngle) * innerR;
    const iy1 = Math.sin(startAngle) * innerR;
    const ix2 = Math.cos(endAngle) * innerR;
    const iy2 = Math.sin(endAngle) * innerR;

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathData = innerR > 0
      ? `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
      : `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    path.setAttribute('d', pathData);
    path.setAttribute('fill', colors[i % colors.length]);
    path.setAttribute('stroke', 'var(--background)');
    path.setAttribute('stroke-width', '2');
    path.style.cursor = 'pointer';
    path.style.transition = 'opacity 0.2s';
    
    const handleMouseEnter = () => { path.style.opacity = '0.8'; };
    const handleMouseLeave = () => { path.style.opacity = '1'; };
    path.addEventListener('mouseenter', handleMouseEnter);
    path.addEventListener('mouseleave', handleMouseLeave);

    g.appendChild(path);

    if (showLabels && angle > 0.2) {
      const midAngle = startAngle + angle / 2;
      const labelRadius = radius * 0.7;
      const lx = Math.cos(midAngle) * labelRadius;
      const ly = Math.sin(midAngle) * labelRadius;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(lx));
      text.setAttribute('y', String(ly));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', '500');

      const label = String(item[labelField] || '');
      const percentage = ((value / total) * 100).toFixed(1);
      text.textContent = showValues ? `${label} (${percentage}%)` : label;

      g.appendChild(text);
    }

    startAngle = endAngle;
  });

  svg.appendChild(g);
  return svg;
}

function buildAreaChart(
  data: DataSet,
  config: AreaChartConfig,
  colors: string[]
): Plot.Markish[] {
  const marks: Plot.Markish[] = [];
  const { xField, yField, colorField, stacked = false, opacity = 0.5, curve = 'linear' } = config;

  if (!xField || !yField) return marks;

  const curveValue = getCurve(curve);

  if (stacked && colorField) {
    marks.push(
      Plot.areaY(data, Plot.stackY({
        x: xField,
        y: yField,
        fill: colorField,
        fillOpacity: opacity,
        curve: curveValue,
      }))
    );
    marks.push(
      Plot.lineY(data, Plot.stackY({
        x: xField,
        y: yField,
        stroke: colorField,
        strokeWidth: 2,
        curve: curveValue,
      }))
    );
  } else {
    marks.push(
      Plot.areaY(data, {
        x: xField,
        y: yField,
        ...(colorField && { fill: colorField }),
        fillOpacity: opacity,
        curve: curveValue,
      })
    );
    marks.push(
      Plot.lineY(data, {
        x: xField,
        y: yField,
        ...(colorField && { stroke: colorField }),
        strokeWidth: 2,
        curve: curveValue,
      })
    );
  }

  marks.push(Plot.ruleY([0]));

  return marks;
}

function buildHistogram(
  data: DataSet,
  config: HistogramConfig,
  colors: string[]
): Plot.Markish[] {
  const marks: Plot.Markish[] = [];
  const { xField, bins = 20, colorField } = config;

  if (!xField) return marks;

  marks.push(
    Plot.rectY(data, Plot.binX({ y: 'count' }, {
      x: xField,
      ...(colorField && { fill: colorField }),
      thresholds: bins,
    }))
  );

  marks.push(Plot.ruleY([0]));

  return marks;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default Chart;
