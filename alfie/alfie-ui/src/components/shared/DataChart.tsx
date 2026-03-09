'use client';

import { memo, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16'];

interface Dataset {
  label: string;
  data: number[];
  color?: string;
}

interface DataChartProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  labels: string[];
  datasets: Dataset[];
  title?: string;
  width?: number;
  height?: number;
}

const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

function getMaxValue(datasets: Dataset[]): number {
  const max = Math.max(...datasets.flatMap((d) => d.data), 0);
  return max === 0 ? 1 : max * 1.1;
}

function niceGridLines(max: number, count = 5): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

function BarChart({ labels, datasets, w, h }: { labels: string[]; datasets: Dataset[]; w: number; h: number }) {
  const maxVal = getMaxValue(datasets);
  const gridLines = niceGridLines(maxVal);
  const chartW = w - PADDING.left - PADDING.right;
  const chartH = h - PADDING.top - PADDING.bottom;
  const groupCount = labels.length || 1;
  const barCount = datasets.length;
  const groupWidth = chartW / groupCount;
  const barWidth = Math.min(groupWidth / (barCount + 1), 40);
  const barGap = (groupWidth - barWidth * barCount) / (barCount + 1);

  return (
    <g>
      {gridLines.map((val) => {
        const y = PADDING.top + chartH - (val / maxVal) * chartH;
        return (
          <g key={`grid-${val}`}>
            <line x1={PADDING.left} y1={y} x2={w - PADDING.right} y2={y} stroke="hsl(var(--border))" strokeOpacity={0.3} strokeDasharray="4" />
            <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{val % 1 === 0 ? val : val.toFixed(1)}</text>
          </g>
        );
      })}
      {labels.map((label, li) => {
        const groupX = PADDING.left + li * groupWidth;
        return (
          <g key={`group-${li}`}>
            <text x={groupX + groupWidth / 2} y={h - PADDING.bottom + 16} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{label.length > 10 ? `${label.slice(0, 9)}…` : label}</text>
            {datasets.map((ds, di) => {
              const val = ds.data[li] ?? 0;
              const barH = (val / maxVal) * chartH;
              const x = groupX + barGap + di * (barWidth + barGap);
              const y = PADDING.top + chartH - barH;
              const color = ds.color || COLORS[di % COLORS.length];
              return (
                <rect key={`bar-${li}-${di}`} x={x} y={y} width={barWidth} height={Math.max(barH, 0)} rx={3} fill={color} fillOpacity={0.85}>
                  <title>{`${ds.label}: ${val}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function LineChart({ labels, datasets, w, h, fill }: { labels: string[]; datasets: Dataset[]; w: number; h: number; fill?: boolean }) {
  const maxVal = getMaxValue(datasets);
  const gridLines = niceGridLines(maxVal);
  const chartW = w - PADDING.left - PADDING.right;
  const chartH = h - PADDING.top - PADDING.bottom;
  const pointCount = labels.length || 1;
  const stepX = pointCount > 1 ? chartW / (pointCount - 1) : chartW / 2;

  return (
    <g>
      {gridLines.map((val) => {
        const y = PADDING.top + chartH - (val / maxVal) * chartH;
        return (
          <g key={`grid-${val}`}>
            <line x1={PADDING.left} y1={y} x2={w - PADDING.right} y2={y} stroke="hsl(var(--border))" strokeOpacity={0.3} strokeDasharray="4" />
            <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{val % 1 === 0 ? val : val.toFixed(1)}</text>
          </g>
        );
      })}
      {labels.map((label, i) => {
        const x = PADDING.left + i * stepX;
        return <text key={`label-${i}`} x={x} y={h - PADDING.bottom + 16} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{label.length > 10 ? `${label.slice(0, 9)}…` : label}</text>;
      })}
      {datasets.map((ds, di) => {
        const color = ds.color || COLORS[di % COLORS.length];
        const points = ds.data.map((val, i) => {
          const x = PADDING.left + i * stepX;
          const y = PADDING.top + chartH - ((val ?? 0) / maxVal) * chartH;
          return { x, y, val };
        });
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const areaD = fill ? `${pathD} L${points[points.length - 1]?.x ?? 0},${PADDING.top + chartH} L${points[0]?.x ?? 0},${PADDING.top + chartH} Z` : '';

        return (
          <g key={`line-${di}`}>
            {fill && <path d={areaD} fill={color} fillOpacity={0.15} />}
            <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={`dot-${di}-${i}`} cx={p.x} cy={p.y} r={4} fill={color} stroke="hsl(var(--background))" strokeWidth={2}>
                <title>{`${ds.label}: ${p.val}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function PieChart({ datasets, w, h }: { datasets: Dataset[]; w: number; h: number }) {
  const data = datasets[0]?.data ?? [];
  const total = data.reduce((a, b) => a + (b ?? 0), 0) || 1;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 30;
  let cumAngle = -Math.PI / 2;

  const slices = data.map((val, i) => {
    const angle = ((val ?? 0) / total) * Math.PI * 2;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const midAngle = startAngle + angle / 2;
    const labelR = radius + 16;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const color = datasets[0]?.color ? undefined : COLORS[i % COLORS.length];
    const pct = Math.round(((val ?? 0) / total) * 100);

    return { x1, y1, x2, y2, largeArc, color: color || COLORS[i % COLORS.length], lx, ly, pct, val };
  });

  return (
    <g>
      {slices.map((s, i) => (
        <g key={`slice-${i}`}>
          <path
            d={`M${cx},${cy} L${s.x1},${s.y1} A${radius},${radius} 0 ${s.largeArc} 1 ${s.x2},${s.y2} Z`}
            fill={s.color}
            fillOpacity={0.85}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            <title>{`${s.val} (${s.pct}%)`}</title>
          </path>
          {s.pct >= 5 && (
            <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="hsl(var(--muted-foreground))">{s.pct}%</text>
          )}
        </g>
      ))}
    </g>
  );
}

export const DataChart = memo(function DataChart({
  type,
  labels,
  datasets,
  title,
  width = 600,
  height = 360,
}: DataChartProps) {
  const validDatasets = useMemo(
    () => datasets.filter((d) => Array.isArray(d.data) && d.data.length > 0),
    [datasets]
  );

  if (validDatasets.length === 0 || (type !== 'pie' && labels.length === 0)) {
    return null;
  }

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div className="my-4 rounded-xl border border-border/50 bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{typeLabel} Chart</Badge>
          {title && <span className="text-sm font-medium text-foreground">{title}</span>}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {type === 'bar' && <BarChart labels={labels} datasets={validDatasets} w={width} h={height} />}
        {type === 'line' && <LineChart labels={labels} datasets={validDatasets} w={width} h={height} />}
        {type === 'area' && <LineChart labels={labels} datasets={validDatasets} w={width} h={height} fill />}
        {type === 'pie' && <PieChart datasets={validDatasets} w={width} h={height} />}
      </svg>

      {validDatasets.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/30">
          {validDatasets.map((ds, i) => (
            <div key={ds.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ds.color || COLORS[i % COLORS.length] }} />
              {ds.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
