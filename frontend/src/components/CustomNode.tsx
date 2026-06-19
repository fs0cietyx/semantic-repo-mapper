"use client";

import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import {
  Folder,
  FolderOpen,
  FileCode,
  Play,
  X,
  Layers,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Terminal,
  Brain,
  Zap,
  Shield,
  Activity,
  Cog,
  Database,
  Cpu,
  Radio,
  Network,
  Server
} from "lucide-react";

interface CustomNodeProps {
  id: string;
  data: {
    label: string;
    raw: {
      id: string;
      name: string;
      type: string;
      summary?: string;
      importance?: number;
      complexity?: number;
      coupling?: number;
      attack_surface?: number;
      tech_debt?: number;
    };
    isExpanded?: boolean;
    hasChildren?: boolean;
    onToggleExpand?: (id: string) => void;
    isActiveInTrace?: boolean;
    isCurrentInTrace?: boolean;
    heatmapMode?: "none" | "complexity" | "coupling" | "attack_surface" | "tech_debt";
    isDimmed?: boolean;
  };
  selected?: boolean;
}

const nodeColors: Record<string, { bg: string; border: string; text: string; iconColor: string }> = {
  repository: { bg: "bg-teal-950/80", border: "border-teal-500/80", text: "text-teal-200", iconColor: "text-teal-400" },
  domain: { bg: "bg-indigo-950/80", border: "border-indigo-500/80", text: "text-indigo-200", iconColor: "text-indigo-400" },
  folder: { bg: "bg-sky-950/70", border: "border-sky-500/60", text: "text-sky-200", iconColor: "text-sky-400" },
  file: { bg: "bg-zinc-900/90", border: "border-zinc-700/80", text: "text-zinc-200", iconColor: "text-teal-400" },
  class: { bg: "bg-purple-950/80", border: "border-purple-500/70", text: "text-purple-200", iconColor: "text-purple-400" },
  function: { bg: "bg-amber-950/80", border: "border-amber-500/70", text: "text-amber-200", iconColor: "text-amber-400" },
  flow_start: { bg: "bg-emerald-950/90", border: "border-emerald-500", text: "text-emerald-200 font-bold", iconColor: "text-emerald-400" },
  flow_step: { bg: "bg-zinc-900/95", border: "border-amber-500/60", text: "text-zinc-100 font-mono", iconColor: "text-amber-400" },
  flow_end: { bg: "bg-rose-950/90", border: "border-rose-500", text: "text-rose-200 font-bold", iconColor: "text-rose-400" },
  api_endpoint: { bg: "bg-violet-950/80", border: "border-violet-500", text: "text-violet-200", iconColor: "text-violet-400" },
  
  // Semantic Types
  api: { bg: "bg-violet-950/85", border: "border-violet-500/80", text: "text-violet-200", iconColor: "text-violet-400" },
  db: { bg: "bg-rose-950/85", border: "border-rose-500/80", text: "text-rose-200", iconColor: "text-rose-400" },
  queue: { bg: "bg-emerald-950/85", border: "border-emerald-500/80", text: "text-emerald-200", iconColor: "text-emerald-400" },
  cache: { bg: "bg-amber-950/85", border: "border-amber-500/80", text: "text-amber-200", iconColor: "text-amber-450" },
  ai: { bg: "bg-teal-950/85", border: "border-teal-500/80", text: "text-teal-200", iconColor: "text-teal-400" },
  auth: { bg: "bg-cyan-950/85", border: "border-cyan-500/80", text: "text-cyan-200", iconColor: "text-cyan-455" },
  websocket: { bg: "bg-pink-950/85", border: "border-pink-500/80", text: "text-pink-200", iconColor: "text-pink-400" },
  worker: { bg: "bg-blue-950/85", border: "border-blue-500/80", text: "text-blue-200", iconColor: "text-blue-455" },
  infra: { bg: "bg-indigo-950/85", border: "border-indigo-500/80", text: "text-indigo-200", iconColor: "text-indigo-400" },
};

function CustomNode({ id, data, selected }: CustomNodeProps) {
  const { label, raw, isExpanded, hasChildren, onToggleExpand, isActiveInTrace, isCurrentInTrace, heatmapMode = "none", isDimmed = false } = data;
  const { type } = raw;

  const style = nodeColors[type] || {
    bg: "bg-zinc-900/90",
    border: "border-zinc-700",
    text: "text-zinc-200",
    iconColor: "text-zinc-400",
  };

  const getIcon = () => {
    switch (type) {
      case "repository":
        return <Layers className={`h-4 w-4 ${style.iconColor}`} />;
      case "domain":
        return <Network className={`h-4 w-4 ${style.iconColor}`} />;
      case "folder":
        return isExpanded ? (
          <FolderOpen className={`h-4 w-4 ${style.iconColor}`} />
        ) : (
          <Folder className={`h-4 w-4 ${style.iconColor}`} />
        );
      case "file":
        return <FileCode className={`h-4 w-4 ${style.iconColor}`} />;
      case "class":
        return <Layers className={`h-4 w-4 ${style.iconColor}`} />;
      case "function":
        return <GitBranch className={`h-4 w-4 ${style.iconColor}`} />;
      case "flow_start":
        return <Play className={`h-4 w-4 ${style.iconColor}`} />;
      case "flow_step":
        return <Terminal className={`h-4 w-4 ${style.iconColor}`} />;
      case "flow_end":
        return <X className={`h-4 w-4 ${style.iconColor}`} />;
      
      // Semantic Icons
      case "api":
        return <Activity className={`h-4 w-4 ${style.iconColor}`} />;
      case "db":
        return <Database className={`h-4 w-4 ${style.iconColor}`} />;
      case "queue":
        return <Server className={`h-4 w-4 ${style.iconColor}`} />;
      case "cache":
        return <Zap className={`h-4 w-4 ${style.iconColor}`} />;
      case "ai":
        return <Brain className={`h-4 w-4 ${style.iconColor}`} />;
      case "auth":
        return <Shield className={`h-4 w-4 ${style.iconColor}`} />;
      case "websocket":
        return <Radio className={`h-4 w-4 ${style.iconColor}`} />;
      case "worker":
        return <Cog className={`h-4 w-4 ${style.iconColor}`} />;
      case "infra":
        return <Cpu className={`h-4 w-4 ${style.iconColor}`} />;
      default:
        return <Terminal className={`h-4 w-4 ${style.iconColor}`} />;
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent node selection / clicking event in React Flow
    if (onToggleExpand) {
      onToggleExpand(id);
    }
  };

  // Determine if it should display the expand button
  const showExpandButton = hasChildren && (type === "folder" || type === "file");

  // Determine heatmap styling override
  const complexity = raw.complexity || 0;
  const coupling = raw.coupling || 0;
  const attack_surface = raw.attack_surface || 0;
  const tech_debt = raw.tech_debt || 0;

  let heatmapStyle = "";
  let heatmapBadge = null;

  if (heatmapMode === "complexity") {
    if (complexity >= 70) {
      heatmapStyle = "border-rose-500 shadow-rose-500/20 ring-2 ring-rose-500/20";
      heatmapBadge = <span className="text-[7px] bg-rose-500/20 text-rose-400 px-1 border border-rose-500/30 font-bold font-mono">HARD TO UNDERSTAND</span>;
    } else if (complexity >= 40) {
      heatmapStyle = "border-amber-500/80 shadow-amber-500/10 ring-1 ring-amber-500/10";
      heatmapBadge = <span className="text-[7px] bg-amber-500/20 text-amber-400 px-1 border border-amber-500/30 font-bold font-mono">NEEDS SOME EFFORT</span>;
    } else {
      heatmapStyle = "border-emerald-500/60 shadow-emerald-500/5";
      heatmapBadge = <span className="text-[7px] bg-emerald-500/10 text-emerald-400 px-1 border border-emerald-500/25 font-mono">EASY TO UNDERSTAND</span>;
    }
  } else if (heatmapMode === "coupling") {
    if (coupling >= 70) {
      heatmapStyle = "border-purple-500 shadow-purple-500/25 ring-2 ring-purple-500/20";
      heatmapBadge = <span className="text-[7px] bg-purple-500/20 text-purple-400 px-1 border border-purple-500/30 font-bold font-mono">HIGHLY DEPENDENT</span>;
    } else if (coupling >= 30) {
      heatmapStyle = "border-indigo-500/80 shadow-indigo-500/10 ring-1 ring-indigo-500/10";
      heatmapBadge = <span className="text-[7px] bg-indigo-500/20 text-indigo-400 px-1 border border-indigo-500/30 font-bold font-mono">MODERATELY CONNECTED</span>;
    } else {
      heatmapStyle = "border-blue-500/60 shadow-blue-500/5";
      heatmapBadge = <span className="text-[7px] bg-blue-500/10 text-blue-400 px-1 border border-blue-500/25 font-mono">STANDALONE</span>;
    }
  } else if (heatmapMode === "attack_surface") {
    if (attack_surface >= 70) {
      heatmapStyle = "border-amber-400 ring-2 ring-amber-400/30 shadow-amber-400/20 animate-pulse";
      heatmapBadge = <span className="text-[7px] bg-amber-400/20 text-amber-300 px-1 border border-amber-400/30 font-bold font-mono">POTENTIAL RISK</span>;
    } else {
      heatmapStyle = "border-zinc-800 opacity-60";
      heatmapBadge = <span className="text-[7px] text-zinc-600 font-mono">SAFE</span>;
    }
  } else if (heatmapMode === "tech_debt") {
    if (tech_debt >= 70) {
      heatmapStyle = "border-red-500 ring-4 ring-red-500/30 shadow-red-500/30 scale-102";
      heatmapBadge = <span className="text-[7px] bg-red-500/20 text-red-400 px-1 border border-red-500/30 font-bold font-mono animate-pulse">NEEDS REWRITE</span>;
    } else if (tech_debt >= 45) {
      heatmapStyle = "border-orange-500/80 shadow-orange-500/10 ring-1 ring-orange-500/10";
      heatmapBadge = <span className="text-[7px] bg-orange-500/20 text-orange-400 px-1 border border-orange-500/30 font-bold font-mono">NEEDS IMPROVEMENT</span>;
    } else {
      heatmapStyle = "border-emerald-500/60 shadow-emerald-500/5";
      heatmapBadge = <span className="text-[7px] bg-emerald-500/10 text-emerald-400 px-1 border border-emerald-500/25 font-mono">WELL WRITTEN</span>;
    }
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 backdrop-blur-md transition-all duration-300 shadow-lg min-w-[150px] max-w-[280px] group ${
        style.bg
      } ${
        isCurrentInTrace
          ? "border-cyan-400 ring-4 ring-cyan-500/50 scale-105 shadow-cyan-500/40 animate-pulse"
          : isActiveInTrace
            ? "border-cyan-500/80 ring-2 ring-cyan-500/20 shadow-cyan-500/10 scale-102"
            : heatmapStyle
              ? heatmapStyle
              : selected
                ? "ring-2 ring-teal-500/50 border-teal-400 scale-105 shadow-teal-500/10"
                : "hover:scale-102 hover:border-zinc-500/80"
      } ${isDimmed ? "opacity-20 blur-[0.4px] scale-98 hover:opacity-40" : ""} ${
        isCurrentInTrace || isActiveInTrace ? "text-cyan-100" : style.text
      }`}
    >
      {/* Target handle at the top */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-1.5 h-1.5 !bg-zinc-700/80 !border-0 opacity-0 group-hover:opacity-100 transition-opacity"
      />

      {/* Node Type Icon */}
      <div className="flex-shrink-0">{getIcon()}</div>

      {/* Node Label & Heatmap Badge */}
      <div className="flex-1 text-left min-w-0 py-0.5 flex flex-col gap-0.5">
        <span className={`text-xs font-semibold leading-none truncate ${
          type === "function" || type === "flow_step" || type === "domain" || type === "api" || type === "db" || type === "queue" || type === "cache" || type === "ai" || type === "auth" || type === "websocket" || type === "worker" || type === "infra" ? "font-mono" : ""
        }`}>
          {label}
        </span>
        {raw.summary && (
          <p className="text-[9px] text-zinc-400 mt-1 leading-tight line-clamp-3 overflow-hidden whitespace-normal break-words">
            {raw.summary}
          </p>
        )}
        {heatmapBadge && (
          <div className="flex select-none self-start mt-0.5">{heatmapBadge}</div>
        )}
      </div>

      {/* Fold/Unfold Toggle Button */}
      {showExpandButton && (
        <button
          onClick={handleToggle}
          className="flex items-center justify-center p-1 rounded-md bg-zinc-950/40 border border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {/* Source handle at the bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-1.5 h-1.5 !bg-zinc-700/80 !border-0 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
}

export default memo(CustomNode);
