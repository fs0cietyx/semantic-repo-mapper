"use client";

import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

interface MacroCanvasProps {
  nodesData: Array<{
    id: string;
    name: string;
    type: string;
    summary?: string;
    importance?: number;
    x?: number;
    y?: number;
  }>;
  edgesData: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
  onNodeClick: (node: any) => void;
}

export default function MacroCanvas({
  nodesData,
  edgesData,
  onNodeClick,
}: MacroCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Convert nodesData and edgesData to Cytoscape format
    const elements: cytoscape.ElementDefinition[] = [];

    // Filter out repository root nodes if we want, or map everything
    nodesData.forEach((n) => {
      const hasCoords = n.x !== undefined && n.x !== null && n.y !== undefined && n.y !== null;
      
      elements.push({
        group: "nodes",
        data: {
          id: n.id,
          label: n.name,
          type: n.type,
          raw: n,
        },
        // Position at server coordinates if available, scaled for cytoscape space
        position: hasCoords ? { x: n.x! * 1.5, y: n.y! * 1.5 } : undefined,
      });
    });

    edgesData.forEach((e) => {
      elements.push({
        group: "edges",
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
        },
      });
    });

    // Initialize cytoscape instance
    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: "node",
          style: {
            "label": "data(label)",
            "color": "#e2e8f0",
            "font-size": "10px",
            "font-family": "ui-sans-serif, system-ui, sans-serif",
            "font-weight": "bold",
            "text-valign": "center",
            "text-halign": "center",
            "background-color": "#27272a",
            "border-width": "1.5px",
            "border-color": "#52525b",
            "width": "60px",
            "height": "32px",
            "shape": "round-rectangle",
            "text-wrap": "ellipsis",
            "text-max-width": "50px",
            "overlay-opacity": 0,
            "transition-property": "border-color, background-color, width, height",
            "transition-duration": 0.2,
          },
        },
        {
          selector: "node[type = 'repository']",
          style: {
            "background-color": "#0f3736",
            "border-color": "#0d9488",
            "width": "75px",
            "height": "38px",
          },
        },
        {
          selector: "node[type = 'folder']",
          style: {
            "background-color": "#0c2e4e",
            "border-color": "#0284c7",
            "width": "65px",
            "height": "34px",
          },
        },
        {
          selector: "node[type = 'file']",
          style: {
            "background-color": "#18181b",
            "border-color": "#71717a",
          },
        },
        {
          selector: "node[type = 'class']",
          style: {
            "background-color": "#2e1065",
            "border-color": "#9333ea",
          },
        },
        {
          selector: "node[type = 'function']",
          style: {
            "background-color": "#451a03",
            "border-color": "#d97706",
            "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#14b8a6",
            "border-width": "3px",
            "background-color": "#115e59",
          },
        },
        {
          selector: "edge",
          style: {
            "width": 1.5,
            "line-color": "#3f3f46",
            "target-arrow-color": "#3f3f46",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "overlay-opacity": 0,
            "arrow-scale": 0.8,
            "control-point-step-size": 40,
          },
        },
        {
          selector: "edge[type = 'IMPORTS']",
          style: {
            "line-color": "#2563eb",
            "target-arrow-color": "#2563eb",
          },
        },
        {
          selector: "edge[type = 'CALLS']",
          style: {
            "line-color": "#d97706",
            "target-arrow-color": "#d97706",
            "line-style": "dashed",
          },
        },
      ],
    });

    cyRef.current = cy;

    // Determine layout: run cose force layout if nodes lack coordinates
    const unpositionedNodes = nodesData.filter(
      (n) => n.x === undefined || n.x === null || n.y === undefined || n.y === null
    );

    if (unpositionedNodes.length > 0) {
      // Run force-directed layout
      cy.layout({
        name: "cose",
        idealEdgeLength: () => 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 40,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: () => 400000,
        edgeElasticity: () => 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      } as any).run();
    } else {
      // Fit the viewport to coordinates
      cy.fit(undefined, 40);
    }

    // Tap/Click node listener
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      onNodeClick(node.data("raw"));
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [nodesData, edgesData, onNodeClick]);

  return (
    <div className="w-full h-full relative bg-zinc-950">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Visual Canvas Info Indicator */}
      <div className="absolute bottom-4 right-4 z-10 bg-zinc-900/90 border border-zinc-800 text-[10px] text-zinc-500 rounded-lg px-2.5 py-1 font-semibold uppercase tracking-wider">
        Cytoscape.js Canvas View
      </div>
    </div>
  );
}
