'use client';

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { Download, Maximize2, Minimize2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GraphData, GraphNode, GraphEdge, NetworkConfig } from '@/lib/dataviz/types';

const DEFAULT_COLORS = [
  'hsl(262, 83%, 58%)',
  'hsl(187, 92%, 45%)',
  'hsl(142, 76%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(280, 75%, 60%)',
];

interface NetworkGraphProps {
  data: GraphData;
  config?: NetworkConfig;
  className?: string;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
}

interface SimulationNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  weight?: number;
  label?: string;
  color?: string;
}

export const NetworkGraph = memo(function NetworkGraph({
  data,
  config = {},
  className,
  onNodeClick,
  onEdgeClick,
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);

  const {
    layout = 'force',
    directed = false,
    nodeSize = 8,
    edgeWidth = 1,
    nodeColor,
    edgeColor,
    showLabels = true,
    showEdgeLabels = false,
    enableZoom = true,
    enablePan = true,
    enableNodeDrag = true,
    width = 600,
    height = 400,
    charge = -200,
    linkDistance = 60,
  } = config;

  const getNodeSize = useCallback((node: GraphNode): number => {
    if (typeof nodeSize === 'function') return nodeSize(node);
    return node.size || nodeSize;
  }, [nodeSize]);

  const getNodeColor = useCallback((node: GraphNode): string => {
    if (typeof nodeColor === 'function') return nodeColor(node);
    if (node.color) return node.color;
    if (nodeColor) return nodeColor;
    if (node.group !== undefined) {
      const groupIndex = typeof node.group === 'number' ? node.group : parseInt(String(node.group), 10) || 0;
      return DEFAULT_COLORS[groupIndex % DEFAULT_COLORS.length];
    }
    return DEFAULT_COLORS[0];
  }, [nodeColor]);

  const getEdgeWidth = useCallback((edge: GraphEdge): number => {
    if (typeof edgeWidth === 'function') return edgeWidth(edge);
    return edge.weight ? Math.sqrt(edge.weight) : edgeWidth;
  }, [edgeWidth]);

  const getEdgeColor = useCallback((edge: GraphEdge): string => {
    if (typeof edgeColor === 'function') return edgeColor(edge);
    return edge.color || edgeColor || 'hsl(var(--muted-foreground))';
  }, [edgeColor]);

  const renderGraph = useCallback(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    svg.selectAll('*').remove();

    const w = isFullscreen ? window.innerWidth - 80 : width;
    const h = isFullscreen ? window.innerHeight - 120 : height;

    svg.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);

    const g = svg.append('g');

    if (enableZoom || enablePan) {
      const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
          setZoom(event.transform.k);
        });
      (svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior);
    }

    const nodes: SimulationNode[] = data.nodes.map((n) => ({ ...n }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: SimulationLink[] = data.edges.map((e) => ({
      source: nodeMap.get(e.source) || e.source,
      target: nodeMap.get(e.target) || e.target,
      weight: e.weight,
      label: e.label,
      color: e.color,
    }));

    if (layout === 'force') {
      const simulation = d3.forceSimulation<SimulationNode>(nodes)
        .force('link', d3.forceLink<SimulationNode, SimulationLink>(links)
          .id((d) => d.id)
          .distance(linkDistance))
        .force('charge', d3.forceManyBody().strength(charge))
        .force('center', d3.forceCenter(w / 2, h / 2))
        .force('collision', d3.forceCollide().radius((d) => getNodeSize(d as SimulationNode) + 5));

      simulationRef.current = simulation;

      if (directed) {
        svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '-0 -5 10 10')
          .attr('refX', 20)
          .attr('refY', 0)
          .attr('orient', 'auto')
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .append('path')
          .attr('d', 'M 0,-5 L 10,0 L 0,5')
          .attr('fill', 'hsl(var(--muted-foreground))');
      }

      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', (d) => getEdgeColor(d as GraphEdge))
        .attr('stroke-width', (d) => getEdgeWidth(d as GraphEdge))
        .attr('stroke-opacity', 0.6)
        .attr('marker-end', directed ? 'url(#arrowhead)' : null)
        .style('cursor', onEdgeClick ? 'pointer' : 'default')
        .on('click', (event, d) => {
          if (onEdgeClick) {
            const originalEdge = data.edges.find(
              (e) => e.source === (d.source as SimulationNode).id && e.target === (d.target as SimulationNode).id
            );
            if (originalEdge) onEdgeClick(originalEdge);
          }
        });

      let edgeLabels: d3.Selection<SVGTextElement, SimulationLink, SVGGElement, unknown> | null = null;
      if (showEdgeLabels) {
        edgeLabels = g.append('g')
          .selectAll<SVGTextElement, SimulationLink>('text')
          .data(links.filter((l) => l.label))
          .join('text')
          .text((d) => d.label || '')
          .attr('font-size', 10)
          .attr('fill', 'hsl(var(--muted-foreground))')
          .attr('text-anchor', 'middle');
      }

      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .style('cursor', enableNodeDrag ? 'grab' : (onNodeClick ? 'pointer' : 'default'));

      node.append('circle')
        .attr('r', (d) => getNodeSize(d))
        .attr('fill', (d) => getNodeColor(d))
        .attr('stroke', 'hsl(var(--background))')
        .attr('stroke-width', 2);

      if (showLabels) {
        node.append('text')
          .text((d) => d.label || d.id)
          .attr('x', (d) => getNodeSize(d) + 4)
          .attr('y', 4)
          .attr('font-size', 11)
          .attr('fill', 'hsl(var(--foreground))');
      }

      node.on('click', (event, d) => {
        if (onNodeClick) {
          const originalNode = data.nodes.find((n) => n.id === d.id);
          if (originalNode) onNodeClick(originalNode);
        }
      });

      if (enableNodeDrag) {
        const drag = d3.drag<SVGGElement, SimulationNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          });

        (node as d3.Selection<SVGGElement, SimulationNode, SVGGElement, unknown>).call(drag);
      }

      simulation.on('tick', () => {
        link
          .attr('x1', (d) => (d.source as SimulationNode).x || 0)
          .attr('y1', (d) => (d.source as SimulationNode).y || 0)
          .attr('x2', (d) => (d.target as SimulationNode).x || 0)
          .attr('y2', (d) => (d.target as SimulationNode).y || 0);

        if (edgeLabels) {
          edgeLabels
            .attr('x', (d) => (((d.source as SimulationNode).x || 0) + ((d.target as SimulationNode).x || 0)) / 2)
            .attr('y', (d) => (((d.source as SimulationNode).y || 0) + ((d.target as SimulationNode).y || 0)) / 2);
        }

        node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
      });
    } else if (layout === 'circular') {
      const angleStep = (2 * Math.PI) / nodes.length;
      const radius = Math.min(w, h) / 2 - 50;

      nodes.forEach((node, i) => {
        node.x = w / 2 + radius * Math.cos(i * angleStep - Math.PI / 2);
        node.y = h / 2 + radius * Math.sin(i * angleStep - Math.PI / 2);
      });

      g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('x1', (d) => (d.source as SimulationNode).x || 0)
        .attr('y1', (d) => (d.source as SimulationNode).y || 0)
        .attr('x2', (d) => (d.target as SimulationNode).x || 0)
        .attr('y2', (d) => (d.target as SimulationNode).y || 0)
        .attr('stroke', (d) => getEdgeColor(d as GraphEdge))
        .attr('stroke-width', (d) => getEdgeWidth(d as GraphEdge))
        .attr('stroke-opacity', 0.6);

      const nodeGroups = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`)
        .style('cursor', onNodeClick ? 'pointer' : 'default')
        .on('click', (event, d) => {
          if (onNodeClick) {
            const originalNode = data.nodes.find((n) => n.id === d.id);
            if (originalNode) onNodeClick(originalNode);
          }
        });

      nodeGroups.append('circle')
        .attr('r', (d) => getNodeSize(d))
        .attr('fill', (d) => getNodeColor(d))
        .attr('stroke', 'hsl(var(--background))')
        .attr('stroke-width', 2);

      if (showLabels) {
        nodeGroups.append('text')
          .text((d) => d.label || d.id)
          .attr('x', (d) => getNodeSize(d) + 4)
          .attr('y', 4)
          .attr('font-size', 11)
          .attr('fill', 'hsl(var(--foreground))');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isFullscreen, width, height, layout, directed, showLabels, showEdgeLabels, enableZoom, enablePan, enableNodeDrag, charge, linkDistance, getNodeSize, getNodeColor, getEdgeWidth, getEdgeColor, onNodeClick, onEdgeClick]);

  useEffect(() => {
    renderGraph();

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [renderGraph]);

  const handleReset = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
    renderGraph();
  }, [renderGraph]);

  const handleExport = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
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
          onClick={handleReset}
          className="p-1.5 rounded-md bg-muted/80 hover:bg-muted transition-colors"
          title="Reset"
        >
          <RefreshCw className="w-4 h-4" />
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

      {enableZoom && (
        <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
          <div className="px-2 py-1 text-xs bg-muted/80 rounded-md text-center">
            {(zoom * 100).toFixed(0)}%
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ minHeight: height }}
      />
    </motion.div>
  );
});

export default NetworkGraph;
