'use client';

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import * as d3Geo from 'd3-geo';
import { motion } from 'framer-motion';
import { Download, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeoPoint, GeoRegion, MapConfig } from '@/lib/dataviz/types';

const DEFAULT_COLOR_SCALE = [
  'hsl(210, 100%, 95%)',
  'hsl(210, 80%, 80%)',
  'hsl(210, 70%, 65%)',
  'hsl(210, 60%, 50%)',
  'hsl(210, 50%, 35%)',
];

interface GeoMapProps {
  data: GeoPoint[] | GeoRegion[];
  config?: MapConfig;
  geoJson?: GeoJSON.FeatureCollection;
  className?: string;
  onPointClick?: (point: GeoPoint) => void;
  onRegionClick?: (region: GeoRegion) => void;
}

export const GeoMap = memo(function GeoMap({
  data,
  config = { type: 'points' },
  geoJson,
  className,
  onPointClick,
  onRegionClick,
}: GeoMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [loadedGeoJson, setLoadedGeoJson] = useState<GeoJSON.FeatureCollection | null>(geoJson || null);

  const {
    type = 'points',
    center,
    zoom = 1,
    projection: projectionType = 'mercator',
    geoJsonUrl,
    valueField = 'value',
    idField = 'id',
    colorScale = DEFAULT_COLOR_SCALE,
    showLegend = true,
    showTooltip = true,
    width = 600,
    height = 400,
  } = config;

  useEffect(() => {
    if (geoJsonUrl && !geoJson) {
      fetch(geoJsonUrl)
        .then((res) => res.json())
        .then((data) => setLoadedGeoJson(data))
        .catch(console.error);
    }
  }, [geoJsonUrl, geoJson]);

  const renderMap = useCallback(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    svg.selectAll('*').remove();

    const w = isFullscreen ? window.innerWidth - 80 : width;
    const h = isFullscreen ? window.innerHeight - 120 : height;

    svg.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);

    let projection: d3.GeoProjection;
    switch (projectionType) {
      case 'equalEarth':
        projection = d3Geo.geoEqualEarth();
        break;
      case 'orthographic':
        projection = d3Geo.geoOrthographic();
        break;
      case 'albersUsa':
        projection = d3Geo.geoAlbersUsa();
        break;
      default:
        projection = d3Geo.geoMercator();
    }

    projection
      .scale(zoom * 100)
      .translate([w / 2, h / 2]);

    if (center && projectionType !== 'albersUsa') {
      projection.center(center);
    }

    const path = d3Geo.geoPath().projection(projection);

    const g = svg.append('g');

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    (svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior);

    if (loadedGeoJson && (type === 'choropleth' || type === 'points')) {
      const regionData = data as GeoRegion[];
      const valueMap = new Map(regionData.map((r) => [r[idField as keyof GeoRegion], r.value]));
      const values = regionData.map((r) => r.value);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      const colorScaleFn = d3.scaleQuantize<string>()
        .domain([minVal, maxVal])
        .range(colorScale);

      g.append('g')
        .selectAll('path')
        .data(loadedGeoJson.features)
        .join('path')
        .attr('d', path as unknown as string)
        .attr('fill', (feature) => {
          if (type === 'choropleth') {
            const id = feature.properties?.[idField] || feature.id;
            const value = valueMap.get(id);
            return value !== undefined ? colorScaleFn(value) : 'hsl(var(--muted))';
          }
          return 'hsl(var(--muted))';
        })
        .attr('stroke', 'hsl(var(--border))')
        .attr('stroke-width', 0.5)
        .style('cursor', onRegionClick ? 'pointer' : 'default')
        .on('mouseenter', function(event, feature) {
          if (!showTooltip) return;
          d3.select(this).attr('opacity', 0.8);
          const id = feature.properties?.[idField] || feature.id;
          const value = valueMap.get(id);
          const regionInfo = regionData.find((r) => r[idField as keyof GeoRegion] === id);
          setTooltip({
            x: event.pageX,
            y: event.pageY,
            content: `${regionInfo?.label || id}: ${value?.toLocaleString() || 'N/A'}`,
          });
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', 1);
          setTooltip(null);
        })
        .on('click', (event, feature) => {
          if (onRegionClick) {
            const id = feature.properties?.[idField] || feature.id;
            const region = (data as GeoRegion[]).find((r) => r[idField as keyof GeoRegion] === id);
            if (region) onRegionClick(region);
          }
        });

      if (showLegend && type === 'choropleth') {
        const legendWidth = 200;
        const legendHeight = 10;
        const legendX = w - legendWidth - 20;
        const legendY = h - 40;

        const legendScale = d3.scaleLinear()
          .domain([minVal, maxVal])
          .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale).ticks(5).tickSize(legendHeight);

        const legend = svg.append('g')
          .attr('transform', `translate(${legendX}, ${legendY})`);

        const defs = svg.append('defs');
        const linearGradient = defs.append('linearGradient')
          .attr('id', 'legend-gradient');

        colorScale.forEach((color, i) => {
          linearGradient.append('stop')
            .attr('offset', `${(i / (colorScale.length - 1)) * 100}%`)
            .attr('stop-color', color);
        });

        legend.append('rect')
          .attr('width', legendWidth)
          .attr('height', legendHeight)
          .attr('fill', 'url(#legend-gradient)');

        legend.append('g')
          .attr('transform', `translate(0, ${legendHeight})`)
          .call(legendAxis)
          .select('.domain')
          .remove();
      }
    }

    if (type === 'points' || type === 'bubble') {
      const points = data as GeoPoint[];
      const values = points.map((p) => p.value || 1);
      const maxValue = Math.max(...values);

      const radiusScale = d3.scaleSqrt()
        .domain([0, maxValue])
        .range([3, type === 'bubble' ? 30 : 8]);

      g.append('g')
        .selectAll('circle')
        .data(points)
        .join('circle')
        .attr('cx', (d) => {
          const coords = projection([d.lng, d.lat]);
          return coords ? coords[0] : 0;
        })
        .attr('cy', (d) => {
          const coords = projection([d.lng, d.lat]);
          return coords ? coords[1] : 0;
        })
        .attr('r', (d) => radiusScale(d.value || 1))
        .attr('fill', (d) => d.color || 'hsl(262, 83%, 58%)')
        .attr('fill-opacity', 0.7)
        .attr('stroke', 'hsl(var(--background))')
        .attr('stroke-width', 1)
        .style('cursor', onPointClick ? 'pointer' : 'default')
        .on('mouseenter', function(event, d) {
          if (!showTooltip) return;
          d3.select(this).attr('fill-opacity', 1);
          setTooltip({
            x: event.pageX,
            y: event.pageY,
            content: `${d.label || 'Point'}: ${d.value?.toLocaleString() || ''}`,
          });
        })
        .on('mouseleave', function() {
          d3.select(this).attr('fill-opacity', 0.7);
          setTooltip(null);
        })
        .on('click', (event, d) => {
          if (onPointClick) onPointClick(d);
        });
    }

    if (type === 'heatmap') {
      const points = data as GeoPoint[];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loadedGeoJson, isFullscreen, width, height, projectionType, zoom, center, type, idField, colorScale, showLegend, showTooltip, onPointClick, onRegionClick]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  const handleExport = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleReset = useCallback(() => {
    renderMap();
  }, [renderMap]);

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
          onClick={handleReset}
          className="p-1.5 rounded-md bg-muted/80 hover:bg-muted transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleExport}
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

      <svg
        ref={svgRef}
        className="w-full h-full bg-[hsl(var(--card))]"
        style={{ minHeight: height }}
      />

      {tooltip && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg text-sm"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
        >
          {tooltip.content}
        </div>
      )}
    </motion.div>
  );
});

export default GeoMap;
