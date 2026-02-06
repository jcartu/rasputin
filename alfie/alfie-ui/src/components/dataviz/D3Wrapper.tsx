'use client';

import { memo, useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { Download, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataSet, D3Config, D3RenderFunction } from '@/lib/dataviz/types';

interface D3WrapperProps {
  data: DataSet;
  render: D3RenderFunction;
  config?: D3Config;
  className?: string;
  dependencies?: unknown[];
}

export const D3Wrapper = memo(function D3Wrapper({
  data,
  render,
  config = {},
  className,
  dependencies = [],
}: D3WrapperProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    width = 600,
    height = 400,
    margin = { top: 40, right: 20, bottom: 50, left: 60 },
    animate = true,
  } = config;

  const renderVisualization = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = isFullscreen ? window.innerWidth - 80 : width;
    const h = isFullscreen ? window.innerHeight - 120 : height;

    svg
      .attr('width', w)
      .attr('height', h)
      .attr('viewBox', `0 0 ${w} ${h}`);

    const effectiveConfig: D3Config = {
      ...config,
      width: w,
      height: h,
      margin,
    };

    try {
      render(svg as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>, data, effectiveConfig);
    } catch (error) {
      console.error('D3 render error:', error);
      svg.append('text')
        .attr('x', w / 2)
        .attr('y', h / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'hsl(var(--destructive))')
        .text('Error rendering visualization');
    }
  }, [data, render, config, width, height, margin, isFullscreen, ...dependencies]);

  useEffect(() => {
    renderVisualization();
  }, [renderVisualization]);

  const handleExport = useCallback((format: 'svg' | 'png') => {
    const svg = svgRef.current;
    if (!svg) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      downloadBlob(blob, `visualization-${Date.now()}.svg`);
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
          if (blob) downloadBlob(blob, `visualization-${Date.now()}.png`);
        });
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  }, []);

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
          onClick={renderVisualization}
          className="p-1.5 rounded-md bg-muted/80 hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
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

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ minHeight: height }}
      />
    </motion.div>
  );
});

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default D3Wrapper;
