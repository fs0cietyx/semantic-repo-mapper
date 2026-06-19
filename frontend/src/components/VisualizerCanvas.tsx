"use client";

import React, { useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import CustomNode from "./CustomNode";

interface VisualizerCanvasProps {
  nodesData: Array<{
    id: string;
    name: string;
    type: string;
    summary?: string;
    importance?: number;
    x?: number;
    y?: number;
    isExpanded?: boolean;
    hasChildren?: boolean;
  }>;
  edgesData: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
  layoutMode?: "circular" | "vertical";
  onNodeClick: (node: any) => void;
  onNodeDoubleClick?: (node: any) => void;
  onToggleExpand?: (id: string) => void;
  activeTracePath?: string[];
  traceStepIndex?: number;
  heatmapMode?: "none" | "complexity" | "coupling" | "attack_surface" | "tech_debt";
  selectedNodeId?: string | null;
}

export default function VisualizerCanvas({
  nodesData,
  edgesData,
  layoutMode = "circular",
  onNodeClick,
  onNodeDoubleClick,
  onToggleExpand,
  activeTracePath = [],
  traceStepIndex = -1,
  heatmapMode = "none",
  selectedNodeId = null,
}: VisualizerCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypesMemo = React.useMemo(() => ({ codeNode: CustomNode }), []);

  useEffect(() => {
    // Helper to find parent ID for AST nodes
    const getParentId = (id: string, type: string): string => {
      if (type === "class" || type === "function") {
        const parts = id.split("::");
        if (parts.length > 2 && type === "function") {
          return `${parts[0]}::${parts[1]}`;
        }
        return parts[0];
      }
      if (id.includes("/")) {
        return id.split("/").slice(0, -1).join("/");
      }
      return "";
    };

    // Build coords map for quick parent lookup
    const coordsMap: Record<string, { x: number; y: number }> = {};
    nodesData.forEach((n) => {
      if (n.x !== undefined && n.x !== null && n.y !== undefined && n.y !== null) {
        coordsMap[n.id] = { x: n.x, y: n.y };
      }
    });

    // Group children lacking coordinates by parent
    const parentToChildren: Record<string, typeof nodesData> = {};
    nodesData.forEach((n) => {
      const hasCoords = n.x !== undefined && n.x !== null && n.y !== undefined && n.y !== null;
      if (!hasCoords) {
        const pId = getParentId(n.id, n.type);
        if (pId) {
          if (!parentToChildren[pId]) {
            parentToChildren[pId] = [];
          }
          parentToChildren[pId].push(n);
        }
      }
    });

    // Sort sibling lists for stable positioning
    Object.keys(parentToChildren).forEach((pId) => {
      parentToChildren[pId].sort((a, b) => a.id.localeCompare(b.id));
    });

    const parsedNodes: Node[] = nodesData.map((n, idx) => {
      let x = n.x;
      let y = n.y;
      const hasServerCoords = x !== undefined && x !== null && y !== undefined && y !== null;

      if (!hasServerCoords) {
        if (layoutMode === "vertical") {
          x = 400;
          y = 80 + idx * 110;
        } else {
          const pId = getParentId(n.id, n.type);
          const pCoords = coordsMap[pId];
          const siblings = parentToChildren[pId] || [];
          if (pCoords && siblings.length > 0) {
            const siblingIndex = siblings.findIndex((s) => s.id === n.id);
            const horizontalSpacing = 240;
            const verticalOffset = 155;
            x = pCoords.x + (siblingIndex - (siblings.length - 1) / 2) * horizontalSpacing;
            y = pCoords.y + verticalOffset;
            coordsMap[n.id] = { x, y };
          } else {
            // Spiral layout fallback
            const angle = idx * 0.4;
            const radius = 180 + idx * 25;
            x = 400 + radius * Math.cos(angle);
            y = 300 + radius * Math.sin(angle);
            coordsMap[n.id] = { x, y };
          }
        }
      }

      const isActiveInTrace = activeTracePath ? activeTracePath.includes(n.id) : false;
      const isCurrentInTrace = activeTracePath && traceStepIndex !== undefined && traceStepIndex >= 0 && activeTracePath[traceStepIndex] === n.id;

      // Click Dimming logic: Dim node if it is not selected and is not a direct neighbor of the selected node
      const isDimmed = selectedNodeId
        ? (n.id !== selectedNodeId && !edgesData.some(e =>
            (e.source === selectedNodeId && e.target === n.id) ||
            (e.target === selectedNodeId && e.source === n.id)
          ))
        : false;

      return {
        id: n.id,
        type: "codeNode",
        position: { x: x!, y: y! },
        data: {
          label: n.name,
          raw: n,
          isExpanded: n.isExpanded,
          hasChildren: n.hasChildren,
          onToggleExpand,
          isActiveInTrace,
          isCurrentInTrace,
          heatmapMode,
          isDimmed,
        },
      };
    });

    const parsedEdges: Edge[] = edgesData.map((e) => {
      // Check if this edge lies on the active path of the trace animation
      let isEdgeActive = false;
      if (activeTracePath && traceStepIndex >= 0 && traceStepIndex < activeTracePath.length - 1) {
        const sourceId = activeTracePath[traceStepIndex];
        const targetId = activeTracePath[traceStepIndex + 1];
        if (sourceId && targetId) {
          isEdgeActive = (e.source === sourceId && e.target === targetId);
        }
      }

      // Check if connected to selected node
      const isConnectedToSelected = selectedNodeId
        ? (e.source === selectedNodeId || e.target === selectedNodeId)
        : false;

      let edgeColor = "#64748b";
      let edgeWidth = 2;
      let isAnimated = e.type === "CALLS" || layoutMode === "vertical" || isEdgeActive;
      let edgeFilter = undefined;
      let labelOpacity = 1.0;

      if (selectedNodeId) {
        if (isConnectedToSelected) {
          isAnimated = true;
          edgeWidth = 3.5;
          if (e.source === selectedNodeId) {
            // Outgoing calls: Cyan neon pipe
            edgeColor = "#06b6d4";
            edgeFilter = "drop-shadow(0 0 10px rgba(6, 182, 212, 0.8))";
          } else {
            // Incoming backlinks: Amber neon pipe
            edgeColor = "#f59e0b";
            edgeFilter = "drop-shadow(0 0 10px rgba(245, 158, 11, 0.8))";
          }
        } else {
          isAnimated = false;
          edgeWidth = 1;
          edgeColor = "#27272a"; // Zinc-800
          labelOpacity = 0.15;
        }
      } else if (isEdgeActive) {
        edgeColor = "#06b6d4";
        edgeWidth = 4;
        edgeFilter = "drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))";
      } else {
        edgeColor = e.type === "CALLS" || layoutMode === "vertical"
          ? "#f59e0b"
          : e.type === "IMPORTS"
            ? "#3b82f6"
            : "#64748b";
      }

      let descriptiveLabel = e.type.toLowerCase();
      if (e.type === 'IMPORTS') descriptiveLabel = "requires functionality from";
      else if (e.type === 'CALLS') descriptiveLabel = "triggers / uses";
      else if (e.type === 'EXTENDS') descriptiveLabel = "builds upon";
      else if (e.type === 'ROUTES_TO') descriptiveLabel = "handles requests via";
      else if (e.type === 'CONTAINS') descriptiveLabel = "";

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: isAnimated,
        label: descriptiveLabel,
        style: {
          stroke: edgeColor,
          strokeWidth: edgeWidth,
          filter: edgeFilter,
          opacity: selectedNodeId && !isConnectedToSelected ? 0.15 : 1.0,
          transition: "all 0.3s ease",
        },
        labelStyle: { fill: "#94a3b8", fontSize: 9, fontWeight: "bold", opacity: labelOpacity },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
      };
    });

    setNodes(parsedNodes);
    setEdges(parsedEdges);
  }, [nodesData, edgesData, setNodes, setEdges, layoutMode, onToggleExpand, activeTracePath, traceStepIndex, heatmapMode, selectedNodeId]);

  return (
    <div className="w-full h-full bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypesMemo}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node.data.raw)}
        onNodeDoubleClick={(_, node) => onNodeDoubleClick && onNodeDoubleClick(node.data.raw)}
        fitView
      >
        <Background color="#18181b" gap={16} size={1} />
        <Controls className="bg-zinc-900/90 border border-zinc-700 rounded-lg text-white" />
        <MiniMap
          nodeColor={(n) => {
            const rawNode = n.data?.raw;
            if (rawNode?.type === "repository") return "#0f766e";
            if (rawNode?.type === "folder") return "#0369a1";
            if (rawNode?.type === "file") return "#475569";
            if (rawNode?.type === "class") return "#6b21a8";
            if (rawNode?.type === "function") return "#b45309";
            return "#3f3f46";
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
          className="bg-zinc-900/80 border border-zinc-700 rounded-lg hidden sm:block"
        />
      </ReactFlow>
    </div>
  );
}
