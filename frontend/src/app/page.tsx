"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import { 
  Search, Map, FileCode, Folder, ChevronRight, X, Play, GitBranch, AlertTriangle, FileText,
  Terminal as TerminalIcon, Cpu, Activity, LayoutGrid, Monitor, Mail, ChevronDown, Shield, Database, Layout, Wrench, FileQuestion, Code
} from "lucide-react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

const GraphOSCanvas = dynamic(() => import("../components/GraphOSCanvas"), { ssr: false });
const TerminalStream = dynamic(() => import("../components/TerminalStream"), { ssr: false });
const TourPlayer = dynamic(() => import("../components/TourPlayer"), { ssr: false });
const GithubSettings = dynamic(() => import("../components/GithubSettings"), { ssr: false });
const RecruiterReport = dynamic(() => import("../components/RecruiterReport"), { ssr: false });
const GraphSettingsPanel = dynamic(() => import("../components/GraphSettingsPanel"), { ssr: false });

interface CodeNode {
  id: string;
  name: string;
  friendly_name?: string;
  type: string;
  summary?: string;
  importance?: number;
  complexity?: number;
  coupling?: number;
  parent?: string;
}

interface CodeEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

// Translate raw tech names and types to clean, non-CS concepts
export function translateToNonCS(name: string, type: string) {
  const lowerName = name.toLowerCase();
  const lowerType = type.toLowerCase();
  let friendlyName = name;
  let friendlyType = "System Component";
  
  if (lowerName.includes("auth") || lowerName.includes("login") || lowerName.includes("signin") || lowerName.includes("security") || lowerName.includes("session") || lowerName.includes("verify") || lowerName.includes("permission")) {
    friendlyName = "Gatekeeper (Security)";
    friendlyType = "Security Guard";
  } else if (lowerName.includes("db") || lowerName.includes("database") || lowerName.includes("model") || lowerName.includes("schema") || lowerName.includes("sql") || lowerName.includes("store") || lowerName.includes("cache") || lowerName.includes("repo")) {
    friendlyName = "Storage Safe (Data)";
    friendlyType = "Data Storage";
  } else if (lowerName.includes("api") || lowerName.includes("route") || lowerName.includes("controller") || lowerName.includes("endpoint") || lowerName.includes("handler") || lowerName.includes("server") || lowerName.includes("client")) {
    friendlyName = "Reception desk (Requests)";
    friendlyType = "Message Deliverer";
  } else if (lowerName.includes("service") || lowerName.includes("logic") || lowerName.includes("worker") || lowerName.includes("engine") || lowerName.includes("process") || lowerName.includes("main") || lowerName.includes("app")) {
    friendlyName = "Operations Room (Engine)";
    friendlyType = "Engine Room";
  } else if (lowerName.includes("ui") || lowerName.includes("component") || lowerName.includes("view") || lowerName.includes("page") || lowerName.includes("screen") || lowerName.includes("css") || lowerName.includes("style") || lowerName.includes("canvas") || lowerName.includes("panel")) {
    friendlyName = "Showroom Visual Display";
    friendlyType = "Visual Display";
  } else if (lowerName.includes("config") || lowerName.includes("setting") || lowerName.includes("env") || lowerName.includes("setup") || lowerName.includes("init")) {
    friendlyName = "System Switchboard";
    friendlyType = "Control Dials";
  } else if (lowerName.includes("util") || lowerName.includes("helper") || lowerName.includes("tool") || lowerName.includes("lib")) {
    friendlyName = "Toolbox (Handy utilities)";
    friendlyType = "Utility Toolbox";
  } else if (lowerName.includes("readme") || lowerName.includes("doc")) {
    friendlyName = "Welcome Manual";
    friendlyType = "Instruction Guide";
  } else {
    // Strip out extension and replace underscores/dashes with spaces
    const cleanName = name.replace(/\.[^/.]+$/, "").replace(/[_\-]/g, " ");
    friendlyName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    
    if (lowerType === "folder") {
      friendlyType = "Department Section";
    } else {
      friendlyType = "Specialized Machine";
    }
  }
  
  return { friendlyName, friendlyType };
}

function SidebarIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t === "security guard" || t === "gatekeeper") return <Shield className="h-3.5 w-3.5 text-rose-600" />;
  if (t === "data storage" || t === "vault") return <Database className="h-3.5 w-3.5 text-blue-600" />;
  if (t === "message deliverer" || t === "reception") return <Mail className="h-3.5 w-3.5 text-amber-600" />;
  if (t === "engine room" || t === "operations") return <Cpu className="h-3.5 w-3.5 text-purple-600 animate-pulse" />;
  if (t === "visual display" || t === "showroom") return <Layout className="h-3.5 w-3.5 text-green-600" />;
  if (t === "control dials" || t === "switchboard") return <SlidersIcon className="h-3.5 w-3.5 text-slate-600" />;
  if (t === "utility toolbox" || t === "toolbox") return <Wrench className="h-3.5 w-3.5 text-indigo-600" />;
  if (t === "department section" || t === "folder") return <Folder className="h-3.5 w-3.5 fill-[#ffff80] text-amber-700" />;
  return <FileQuestion className="h-3.5 w-3.5 text-slate-500" />;
}

// Dummy helper for icon rendering
function SlidersIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="2" y1="14" x2="6" y2="14" />
      <line x1="10" y1="8" x2="14" y2="8" />
      <line x1="18" y1="16" x2="22" y2="16" />
    </svg>
  );
}

// Recursive Sidebar Item
function FileExplorerItem({ node, allNodes, onSelect, selectedId }: { node: CodeNode, allNodes: CodeNode[], onSelect: (n: CodeNode) => void, selectedId?: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const children = allNodes.filter(n => n.parent === node.id);
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col">
      <div 
        onClick={() => {
          onSelect(node);
          if (hasChildren) setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-2.5 p-1.5 cursor-pointer select-none transition-all duration-100 border-b border-[#dfdfdf]/30 ${selectedId === node.id ? 'bg-[#000080] text-white shadow-sm' : 'hover:bg-[#dfdfdf] text-black'}`}
      >
        <div className="w-3.5 flex items-center justify-center">
          {hasChildren && (isOpen ? <ChevronDown className="h-3 w-3 opacity-60" /> : <ChevronRight className="h-3 w-3 opacity-60" />)}
        </div>
        <SidebarIcon type={node.type} />
        <span className="text-[10px] font-win truncate tracking-tight font-semibold" title={node.name}>{node.name.split("/").pop() || node.name}</span>
      </div>
      {hasChildren && isOpen && (
        <div className="pl-4 border-l-2 border-dashed border-[#808080]/30 ml-3.5 mt-0.5 space-y-0.5">
          {children.map(child => (
            <FileExplorerItem key={child.id} node={child} allNodes={allNodes} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BackgroundPhoneLogo() {
  return (
    <a href="https://github.com/fs0cietyx" target="_blank" rel="noreferrer" className="absolute left-[48.5%] md:left-[47.5%] lg:left-[48.5%] -translate-x-1/2 bottom-[33%] z-20 w-12 h-12 flex items-center justify-center cursor-pointer pointer-events-auto group overflow-hidden rounded-full">
      <motion.div className="relative" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0.8, 1, 0.9, 1, 0.8], scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white group-hover:fill-[#00ff88] transition-colors duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] group-hover:drop-shadow-[0_0_12px_rgba(0,255,136,0.8)]" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
      </motion.div>
    </a>
  );
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [repoId, setRepoId] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [importStatus, setImportStatus] = useState<string>("none");
  const [progress, setProgress] = useState<number>(0);
  const [nodes, setNodes] = useState<CodeNode[]>([]);
  const [edges, setEdges] = useState<CodeEdge[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<CodeNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [isWorkspaceLaunched, setIsWorkspaceLaunched] = useState(false);
  const [isGraphMaximized, setIsGraphMaximized] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isGithubSettingsOpen, setIsGithubSettingsOpen] = useState(false);
  const [isRecruiterReportOpen, setIsRecruiterReportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nervousSystemAnswer, setNervousSystemAnswer] = useState<string | null>(null);
  const [isGraphSettingsOpen, setIsGraphSettingsOpen] = useState(false);
  const [sourceCodeModal, setSourceCodeModal] = useState({ isOpen: false, content: "", filename: "", loading: false });
  const [graphConfig, setGraphConfig] = useState({
    nodeSpacing: 30,
    edgeLength: 150,
    nodeSizeMultiplier: 1,
    edgeWidthMultiplier: 1
  });

  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isMyComputerOpen, setIsMyComputerOpen] = useState(false);
  const [systemTime, setSystemTime] = useState("");

  // Gemini rate limiting & dynamic explanations state
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [rateLimitLimit, setRateLimitLimit] = useState(15);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(15);
  const [rateLimitReset, setRateLimitReset] = useState(0);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const terminalControls = useDragControls();
  const graphControls = useDragControls();
  const myComputerControls = useDragControls();

  useEffect(() => {
    const updateTime = () => setSystemTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Tick down the rate limit reset timer
  useEffect(() => {
    if (rateLimitReset <= 0) return;
    const timer = setInterval(() => {
      setRateLimitReset(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitReset]);

  const fetchNodeExplanation = useCallback(async (nodeId: string, currentRepoId: string) => {
    if (!currentRepoId) return;
    setExplanationLoading(true);
    setRateLimitError(null);
    setAiExplanation("");
    try {
      const backendUrl = "http://127.0.0.1:8000";
      const resp = await fetch(`${backendUrl}/api/repository/${currentRepoId}/explain/${encodeURIComponent(nodeId)}`);
      
      const limit = resp.headers.get("X-RateLimit-Limit");
      const remaining = resp.headers.get("X-RateLimit-Remaining");
      const reset = resp.headers.get("X-RateLimit-Reset");
      if (limit) setRateLimitLimit(parseInt(limit));
      if (remaining) setRateLimitRemaining(parseInt(remaining));
      if (reset) setRateLimitReset(parseInt(reset));

      if (resp.status === 429) {
        const errData = await resp.json();
        setRateLimitError(errData.detail || "Rate limit exceeded.");
        return;
      }

      if (resp.ok) {
        const data = await resp.json();
        setAiExplanation(data.explanation);
      } else {
        setAiExplanation("Could not resolve semantic explanation.");
      }
    } catch (err) {
      console.error("Failed to fetch node explanation", err);
      setAiExplanation("Error communicating with AI engine.");
    } finally {
      setExplanationLoading(false);
    }
  }, []);

  const fetchEdgeExplanation = useCallback(async (edge: any, currentRepoId: string) => {
    if (!currentRepoId) return;
    setExplanationLoading(true);
    setRateLimitError(null);
    setAiExplanation("");
    try {
      const backendUrl = "http://127.0.0.1:8000";
      const resp = await fetch(
        `${backendUrl}/api/repository/${currentRepoId}/explain-edge?source=${encodeURIComponent(edge.source)}&target=${encodeURIComponent(edge.target)}&type=${encodeURIComponent(edge.type)}`
      );
      
      const limit = resp.headers.get("X-RateLimit-Limit");
      const remaining = resp.headers.get("X-RateLimit-Remaining");
      const reset = resp.headers.get("X-RateLimit-Reset");
      if (limit) setRateLimitLimit(parseInt(limit));
      if (remaining) setRateLimitRemaining(parseInt(remaining));
      if (reset) setRateLimitReset(parseInt(reset));

      if (resp.status === 429) {
        const errData = await resp.json();
        setRateLimitError(errData.detail || "Rate limit exceeded.");
        return;
      }

      if (resp.ok) {
        const data = await resp.json();
        setAiExplanation(data.explanation);
      } else {
        setAiExplanation("Could not resolve relationship explanation.");
      }
    } catch (err) {
      console.error("Failed to fetch edge explanation", err);
      setAiExplanation("Error communicating with AI engine.");
    } finally {
      setExplanationLoading(false);
    }
  }, []);

  const handleNodeSelection = useCallback((node: CodeNode) => {
    setSelectedEdge(null);
    setSelectedNode(node);
    fetchNodeExplanation(node.id, repoId);
  }, [fetchNodeExplanation, repoId]);

  const handleEdgeSelection = useCallback((edge: any) => {
    setSelectedNode(null);
    setSelectedEdge(edge);
    fetchEdgeExplanation(edge, repoId);
  }, [fetchEdgeExplanation, repoId]);

  const handleAnalyzeImpact = useCallback(async () => {
    if (!selectedNode || !repoId) return;
    
    try {
      const backendUrl = "http://127.0.0.1:8000";
      const resp = await fetch(`${backendUrl}/api/repository/${repoId}/impact/${selectedNode.id}`);
      if (resp.ok) {
        const data = await resp.json();
        // Dispatch event for GraphOSCanvas
        window.dispatchEvent(new CustomEvent('show-impact', { detail: { impact_radius: data.impact_radius } }));
      }
    } catch (err) {
      console.error("[NERVOUS_SYSTEM] Impact analysis failed:", err);
    }
  }, [selectedNode, repoId]);

  const handleSimulateFlow = useCallback(async () => {
    if (!selectedNode || !repoId) return;
    
    try {
      const backendUrl = "http://127.0.0.1:8000";
      const resp = await fetch(`${backendUrl}/api/repository/${repoId}/trace/${selectedNode.id}`);
      if (resp.ok) {
        const data = await resp.json();
        // Dispatch custom event for GraphOSCanvas
        window.dispatchEvent(new CustomEvent('play-trace', { detail: { trace: data.trace } }));
      }
    } catch (err) {
      console.error("[NERVOUS_SYSTEM] Trace resolution failed:", err);
    }
  }, [selectedNode, repoId]);

  const handleFetchSource = useCallback(async () => {
    if (!selectedNode || !repoId) return;
    setSourceCodeModal({ isOpen: true, content: "Fetching source from secure sandbox...", filename: selectedNode.name, loading: true });
    
    try {
      const backendUrl = "http://127.0.0.1:8000";
      const resp = await fetch(`${backendUrl}/api/repository/${repoId}/source/${encodeURIComponent(selectedNode.id)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSourceCodeModal({ isOpen: true, content: data.content, filename: selectedNode.name, loading: false });
      } else {
        const err = await resp.json();
        setSourceCodeModal({ isOpen: true, content: `Error: ${err.detail}`, filename: selectedNode.name, loading: false });
      }
    } catch (err) {
      setSourceCodeModal({ isOpen: true, content: "Failed to connect to Source OS.", filename: selectedNode.name, loading: false });
    }
  }, [selectedNode, repoId]);

  const handleSearch = useCallback(async (e: React.FormEvent, customQuery?: string) => {
    if (e && e.preventDefault) e.preventDefault();
    const queryToSearch = customQuery || searchQuery;
    if (!repoId || !queryToSearch) return;
    
    try {
      const backendUrl = "http://127.0.0.1:8000";
      const resp = await fetch(`${backendUrl}/api/repository/${repoId}/search?q=${encodeURIComponent(queryToSearch)}`);
      if (resp.ok) {
        const data = await resp.json();
        // If Gemini predicted a flow, animate it!
        if (data.predicted_trace && data.predicted_trace.length > 0) {
           window.dispatchEvent(new CustomEvent('play-trace', { detail: { trace: data.predicted_trace } }));
        } else if (data.results && data.results.length > 0) {
           // For Semantic Search (Ask the Nervous System), we light up the entire matching cluster at once
           const clusterNodes = data.results.map((r: any) => ({ id: r.id }));
           window.dispatchEvent(new CustomEvent('semantic-highlight', { detail: { cluster: clusterNodes } }));
        }
        
        if (data.answer) {
           setNervousSystemAnswer(data.answer);
        }
      }
    } catch (err) {
      console.error("Search failed", err);
    }
  }, [repoId, searchQuery]);



  const handleTourStepChange = useCallback((step: any) => {
    const targetId = step.target.node_id || step.target;
    const node = nodes.find(n => n.id === targetId);
    if (node) {
      handleNodeSelection(node);
      window.dispatchEvent(new CustomEvent('focus-node', { detail: { nodeId: targetId } }));
    }
  }, [nodes, handleNodeSelection]);

  const handleSimulationFallback = useCallback(() => {
    setImportStatus("completed");
    setProgress(100);
    setRepoId("fs0cietyx-neural-sim");
    const newNodes: CodeNode[] = [];
    const newEdges: CodeEdge[] = [];
    const domains = ["AUTHENTICATION", "PAYMENTS", "NEURAL_ENGINE", "DATABASE", "INFRASTRUCTURE"];
    domains.forEach(d => {
      const transDomain = translateToNonCS(d, "domain");
      newNodes.push({ id: d, name: transDomain.friendlyName, type: transDomain.friendlyType, importance: 10 });
      for (let i = 0; i < 3; i++) {
         const folderId = `${d}/folder_${i}`;
         const transFolder = translateToNonCS(`module_${i}`, "folder");
         newNodes.push({ id: folderId, name: transFolder.friendlyName, type: transFolder.friendlyType, importance: 8, parent: d });
         newEdges.push({ id: `e_${folderId}`, source: d, target: folderId, type: "CONTAINS" });
         for (let j = 0; j < 5; j++) {
           const fileId = `${folderId}/file_${j}.ts`;
           const transFile = translateToNonCS(`component_${j}.ts`, "file");
           newNodes.push({ id: fileId, name: transFile.friendlyName, type: transFile.friendlyType, importance: 6, parent: folderId, complexity: Math.random() * 100 });
           newEdges.push({ id: `e_${fileId}`, source: folderId, target: fileId, type: "CONTAINS" });
         }
      }
    });
    setNodes(newNodes);
    setEdges(newEdges);
    setIsWorkspaceLaunched(true);
  }, []);

  const handleImport = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!repoUrl) return;

    const backendUrl = "http://127.0.0.1:8000";
    setImportStatus("starting");
    setProgress(2);
    setLogs([{ id: Date.now(), log_output: `[OS] BRIDGE_INITIATED_AT_${backendUrl}`, status: "running" }]);

    try {
      const resp = await fetch(`${backendUrl}/api/repository/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl })
      });
      
      if (!resp.ok) throw new Error(`Handshake failed: ${resp.status}`);
      
      const data = await resp.json();
      const currentRepoId = data.repo_id;
      setRepoId(currentRepoId);

      const poll = setInterval(async () => {
        try {
          const [sResp, lResp] = await Promise.all([
            fetch(`${backendUrl}/api/repository/${currentRepoId}/status`),
            fetch(`${backendUrl}/api/repository/${currentRepoId}/logs`)
          ]);
          
          if (!sResp.ok || !lResp.ok) return;
          const sData = await sResp.json();
          const lData = await lResp.json();

          setImportStatus(sData.status);
          setProgress(sData.progress);
          if (sData.description) {
            setRepoDescription(sData.description);
          }
          setLogs(lData);

          if (sData.status === "completed") {
            clearInterval(poll);
            const gResp = await fetch(`${backendUrl}/api/repository/${currentRepoId}/graph`);
            const gData = await gResp.json();
            
            // Translate all nodes to friendly non-CS ones
            const translatedNodes = gData.nodes.map((n: any) => {
              const { friendlyName, friendlyType } = translateToNonCS(n.name, n.type);
              return {
                ...n,
                friendly_name: friendlyName,
                type: friendlyType
              };
            });
            
            setNodes(translatedNodes);
            setEdges(gData.edges);
            setIsWorkspaceLaunched(true);
          } else if (sData.status === "failed") {
            clearInterval(poll);
          }
        } catch (err) { console.error("Poll error", err); }
      }, 1500);

    } catch (err) {
      console.error("FATAL", err);
      setLogs(prev => [...prev, { id: Date.now(), log_output: `[CRITICAL] SYSTEM_OFFLINE`, status: "failed" }]);
      setTimeout(() => handleSimulationFallback(), 1500);
    }
  }, [repoUrl, handleSimulationFallback]);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none font-sans flex flex-col">
      <div className="absolute inset-0 z-0 w-full h-full pointer-events-none overflow-hidden">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover transform-gpu">
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260427_054418_a6d194f0-ac86-4df9-abe5-ded73e596d7c.mp4" type="video/mp4" />
        </video>
      </div>

      <BackgroundPhoneLogo />

      <div className="absolute top-4 left-4 z-20 flex flex-col gap-6">
        <button onDoubleClick={() => setIsMyComputerOpen(true)} className="flex flex-col items-center gap-1 w-16 group outline-none cursor-pointer">
          <img src="https://win98icons.alexmeub.com/icons/png/computer_explorer-5.png" alt="My PC" className="w-8 h-8 pointer-events-none group-focus:brightness-75 shadow-lg" />
          <span className="text-[10px] text-white font-bold text-center drop-shadow-md">My PC</span>
        </button>
      </div>

      <div className="flex-1 relative z-30 pointer-events-none">
        {!isWorkspaceLaunched && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div drag dragControls={terminalControls} dragListener={false} className="pointer-events-auto w-[95%] max-w-lg win95-bg win95-border flex flex-col shadow-2xl">
              <div onPointerDown={(e) => terminalControls.start(e)} className="win95-title-bar cursor-grab active:cursor-grabbing shrink-0">
                <div className="flex items-center gap-1.5 ml-1"><TerminalIcon className="h-4 w-4 text-white fill-white/20" /><span className="text-[11px] font-bold tracking-tight">fs0cietyx Terminal</span></div>
                <div className="flex gap-1 mr-1">
                  <button className="win95-button h-[18px] w-[18px] flex items-center justify-center text-black font-bold">_</button>
                  <button className="win95-button h-[18px] w-[18px] flex items-center justify-center text-black font-bold">□</button>
                  <button onClick={() => setImportStatus("none")} className="win95-button h-[18px] w-[18px] flex items-center justify-center text-black font-bold text-[10px]">X</button>
                </div>
              </div>
              <div className="p-2 flex flex-col gap-2 bg-[#c0c0c0]">
                <div className="h-64 bg-black win95-border-inset p-2 relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none z-10 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px]" />
                  {importStatus === "none" ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <pre className="text-[#00FF00] font-mono text-[8px] sm:text-[10px] leading-tight select-none animate-pulse">
{`   __      ___          _      _             
  / _|___ / _ \\ __ _ __(_)___ | |_ _  ___ __ 
 |  _(_-<| | | / _| |  | / -_)|  _| || \\ \\ / 
 |_| /__/ \\___/\\__|\\__||_\\___| \\__|\\_, /_\\_\\ 
                                   |__/      `}
                      </pre>
                      <div className="mt-4 text-[#00FF00]/80 font-mono text-[9px] uppercase tracking-widest">Awaiting GitHub Specification...</div>
                    </div>
                  ) : <TerminalStream logs={logs} />}
                </div>
                <div className="flex items-center gap-2 p-1">
                  <span className="text-[11px] font-bold text-black font-win">URL:</span>
                  <form onSubmit={handleImport} className="flex-1 flex gap-2">
                    <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="flex-1 bg-white win95-border-inset px-2 py-1 text-[11px] focus:outline-none text-black font-sans shadow-inner" placeholder="github.com/..." style={{ color: 'black' }} />
                    <button type="submit" disabled={importStatus !== "none" && importStatus !== "completed"} className="win95-button text-xs font-bold text-black px-4 disabled:opacity-50">Execute</button>
                  </form>
                </div>
                <div className="h-4 bg-[#c0c0c0] win95-border-inset flex items-center p-[2px]"><div className="h-full bg-[#000080] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              </div>
            </motion.div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {isWorkspaceLaunched && (
            <div className={`absolute ${isGraphMaximized ? 'inset-0' : 'inset-0 flex items-center justify-center'}`}>
              <motion.div drag={!isGraphMaximized} dragControls={graphControls} dragListener={false} initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`pointer-events-auto win95-bg win95-border flex flex-col shadow-2xl relative ${isGraphMaximized ? 'w-full h-full z-[200]' : 'w-[98%] h-[95%]'}`}>
                <div onPointerDown={(e) => !isGraphMaximized && graphControls.start(e)} className={`win95-title-bar ${isGraphMaximized ? '' : 'cursor-grab active:cursor-grabbing'} shrink-0 !h-8`}>
                  <div className="flex items-center gap-2 ml-1"><img src="https://win98icons.alexmeub.com/icons/png/directory_open_file_mydocs-4.png" className="h-4 w-4" alt="vault" /><span className="text-[11px] font-bold uppercase font-win truncate">fs0cietyx explorer.exe - {repoId}</span></div>
                  
                  {/* Natural Language Flow Search HUD */}
                  <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4 h-6 bg-white win95-border-inset flex items-center px-2 group">
                     <Search className="h-3 w-3 text-black/40 group-focus-within:text-blue-800 transition-colors" />
                     <input 
                       type="text" 
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       placeholder="Ask the Nervous System... (e.g. 'how does auth work?')"
                       className="flex-1 bg-transparent border-none outline-none text-[10px] px-2 text-black font-win italic"
                     />
                     <button type="submit" className="hidden" />
                  </form>

                  <div className="flex gap-1 mr-1">
                      {/* Add Graph Config Toggle Button */}
                      <button 
                        onClick={() => setIsGraphSettingsOpen(!isGraphSettingsOpen)}
                        className={`p-2 hover:bg-white/10 rounded transition-colors ${isGraphSettingsOpen ? 'bg-white/20 text-[#00ff88]' : 'text-[#888] hover:text-white'}`}
                        title="Graph Configuration"
                      >
                        <SlidersIcon className="h-4 w-4" />
                      </button>

                    <button onClick={() => setIsGraphMaximized(!isGraphMaximized)} className="win95-button h-[22px] w-[22px] flex items-center justify-center text-black font-bold">□</button>
                    <button onClick={() => setIsWorkspaceLaunched(false)} className="win95-button h-[22px] w-[22px] flex items-center justify-center text-black font-bold text-xs">X</button>
                  </div>
                </div>

                <div className="flex-1 flex win95-bg overflow-hidden p-1 gap-1">
                  <div className="w-[300px] win95-border-inset bg-white flex flex-col shrink-0">
                    <div className="bg-[#c0c0c0] border-b border-[#808080] px-2 py-1 flex items-center justify-between">
                       <span className="text-[10px] font-bold text-black font-win uppercase tracking-tighter">Repository_Vault</span>
                       <Monitor className="h-3.5 w-3.5 text-black/40" />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                      <div className="space-y-0.5">
                        {nodes.filter(n => !n.parent).map(n => (
                           <FileExplorerItem key={n.id} node={n} allNodes={nodes} onSelect={handleNodeSelection} selectedId={selectedNode?.id} />
                        ))}
                      </div>
                    </div>
                  </div>

                   <div className="flex-1 win95-border-inset bg-[#050505] relative shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
                    {nodes.length > 0 && (
                      <GraphOSCanvas 
                        nodesData={nodes} 
                        edgesData={edges} 
                        onNodeClick={handleNodeSelection} 
                        onEdgeClick={handleEdgeSelection}
                        config={graphConfig}
                      />
                    )}
                    {isGraphSettingsOpen && (
                      <GraphSettingsPanel 
                        config={graphConfig}
                        setConfig={setGraphConfig}
                        onClose={() => setIsGraphSettingsOpen(false)}
                      />
                    )}
                  </div>

                  <div className="w-[320px] win95-border-inset bg-[#c0c0c0] flex flex-col shrink-0 p-2">
                    <div className="win95-border-inset bg-white h-full p-4 overflow-y-auto custom-scrollbar flex flex-col justify-between">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center justify-between border-b border-[#c0c0c0] pb-1 mb-2">
                          <div className="text-[10px] font-bold text-[#000080] uppercase tracking-[0.2em]">Component_Profile</div>
                        </div>
                        
                        {selectedNode ? (
                          <div className="space-y-4">
                             <div>
                                <div className="text-black font-bold text-base leading-tight font-win break-all">{selectedNode.friendly_name || selectedNode.name}</div>
                                <div className="text-[9px] text-black/60 font-mono mt-1 break-all">{selectedNode.id}</div>
                                <div className="text-[9px] text-[#000080] font-bold uppercase mt-1 tracking-widest">{selectedNode.type} SYNAPSE</div>
                             </div>
                             
                             <div className="win95-border-inset bg-[#fdfdfd] p-3">
                                <label className="text-[8px] font-bold text-black uppercase block mb-1 tracking-tighter opacity-60">Non-Technical Translation (AI)</label>
                                {explanationLoading ? (
                                  <div className="text-[11px] leading-relaxed text-blue-800 italic animate-pulse">Resolving cognitive metaphor...</div>
                                ) : (
                                  <p className="text-[11px] leading-relaxed text-black italic font-serif">
                                     &quot;{aiExplanation || selectedNode.summary || 'Awaiting AST mapping translation...'}&quot;
                                  </p>
                                )}
                             </div>

                             <div className="space-y-1">
                               <div className="flex items-center justify-between text-[8px] font-bold uppercase opacity-60">
                                 <span>Structural Intelligence</span>
                                 <span>Metrics_v1</span>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                 <div className="win95-border-inset bg-[#f0f0f0] p-1.5 flex flex-col items-center">
                                    <span className="text-[7px] font-bold uppercase text-black/50">Complexity</span>
                                    <span className="text-rose-700 font-bold text-lg font-win">{(selectedNode as any).complexity?.toFixed(1) || '0.2'}</span>
                                 </div>
                                 <div className="win95-border-inset bg-[#f0f0f0] p-1.5 flex flex-col items-center">
                                    <span className="text-[7px] font-bold uppercase text-black/50">Coupling</span>
                                    <span className="text-blue-800 font-bold text-lg font-win">{(selectedNode as any).coupling?.toFixed(1) || '0.1'}</span>
                                 </div>
                               </div>
                             </div>

                             <div className="flex flex-col gap-1.5">
                               <button onClick={() => setIsTourActive(true)} className="win95-button w-full py-4 font-bold text-black text-[11px] flex items-center justify-center gap-2 shadow-inner border-[#000080] border-2 bg-[#dfdfdf] hover:bg-white transition-colors">
                                  <Map className="h-4 w-4" /> LAUNCH CODEBASE TOUR
                               </button>

                               {selectedNode.type === "file" || selectedNode.type.includes("Machine") || selectedNode.type.includes("Toolbox") ? (
                                  <button onClick={handleFetchSource} className="win95-button w-full py-2 font-bold text-black text-[10px] flex items-center justify-center gap-1.5 mt-1">
                                    <Code className="h-3.5 w-3.5" /> INSPECT SOURCE CODE
                                  </button>
                               ) : null}
                               
                               {/* Ask the Nervous System Button */}
                               <div className="pt-2 border-t border-[#c0c0c0]">
                                  <button onClick={() => {
                                      const question = window.prompt("Ask the Nervous System about " + selectedNode.name + ":");
                                      if (question) {
                                          setSearchQuery(question);
                                          handleSearch({ preventDefault: () => {} } as any, question);
                                      }
                                  }} className="win95-button w-full py-2 font-bold text-[#000080] text-[10px] flex items-center justify-center gap-1.5">
                                     <Cpu className="h-3.5 w-3.5 animate-pulse" /> ASK THE NERVOUS SYSTEM
                                  </button>
                               </div>
                             </div>

                             <div className="pt-2 border-t border-[#c0c0c0] opacity-40">
                               <div className="text-[7px] font-mono leading-tight">
                                 UUID: {selectedNode.id}<br/>
                                 SYNAPSE_STATUS: OPTIMAL
                               </div>
                             </div>
                          </div>
                        ) : selectedEdge ? (
                          <div className="space-y-4">
                             <div>
                                <div className="text-black font-bold text-sm leading-tight font-win break-all">Connection Relationship</div>
                                <div className="text-[9px] text-[#000080] font-bold uppercase mt-1 tracking-widest">{selectedEdge.type} LINK</div>
                                <div className="text-[8px] text-black/60 font-mono mt-2 p-1.5 bg-[#f5f5f5] win95-border-inset break-all">
                                   <strong>FROM:</strong> {selectedEdge.source.split("/").pop()}<br/>
                                   <strong>TO:</strong> {selectedEdge.target.split("/").pop()}
                                </div>
                             </div>
                             
                             <div className="win95-border-inset bg-[#fdfdfd] p-3">
                                <label className="text-[8px] font-bold text-black uppercase block mb-1 tracking-tighter opacity-60">Non-Technical Relationship (AI)</label>
                                {explanationLoading ? (
                                  <div className="text-[11px] leading-relaxed text-blue-800 italic animate-pulse">Interpreting connection logic...</div>
                                ) : (
                                  <p className="text-[11px] leading-relaxed text-black italic font-serif">
                                     &quot;{aiExplanation || 'Awaiting connection translation...'}&quot;
                                  </p>
                                )}
                             </div>
                             
                             <div className="pt-2 border-t border-[#c0c0c0] opacity-40">
                               <div className="text-[7px] font-mono leading-tight">
                                 REL_ID: {selectedEdge.id}
                               </div>
                             </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col gap-6 justify-center">
                             <div className="h-32 flex flex-col items-center justify-center opacity-20 gap-3 grayscale">
                                <LayoutGrid className="h-10 w-10 text-black" />
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-center">Repository Overview</p>
                             </div>
                             
                             <div className="win95-border-inset bg-[#ffffcc] p-3 border border-[#808080]">
                                <div className="text-[9px] font-bold text-black uppercase mb-1.5">Project Summary</div>
                                <p className="text-[10px] text-black leading-relaxed whitespace-pre-wrap">
                                  {repoDescription ? repoDescription : "Select any node (module) or connection line to reveal non-technical translation explanations and modularity reports."}
                                </p>
                             </div>
                             <button onClick={() => setIsRecruiterReportOpen(true)} className="win95-button w-full py-1.5 font-bold text-xs">GENERATE_FULL_REPORT</button>
                          </div>
                        )}
                      </div>

                      {/* Gemini API Usage Rate Limiter Widget */}
                      <div className="mt-4 p-2 bg-[#dfdfdf] win95-border text-black text-[9px] font-win space-y-1">
                        <div className="font-bold border-b border-[#808080] pb-1 uppercase tracking-tight flex items-center justify-between">
                          <span>Gemini Free-Tier API</span>
                          <span className={rateLimitRemaining > 0 ? "text-green-700 font-bold" : "text-rose-700 font-bold"}>
                            {rateLimitRemaining > 0 ? "Ready" : "Rate Limited"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rate Limit:</span>
                          <span>{rateLimitLimit} RPM</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Quota Remaining:</span>
                          <span className="font-bold">{rateLimitRemaining} / {rateLimitLimit}</span>
                        </div>
                        <div className="h-3 bg-white win95-border-inset p-[1px] relative overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${rateLimitRemaining < 3 ? 'bg-rose-600' : rateLimitRemaining < 7 ? 'bg-yellow-500' : 'bg-green-600'}`} 
                            style={{ width: `${(rateLimitRemaining / rateLimitLimit) * 100}%` }}
                          />
                        </div>
                        {rateLimitReset > 0 && (
                          <div className="text-[8px] italic text-rose-700 text-right">
                            Resets in {rateLimitReset}s
                          </div>
                        )}
                        {rateLimitError && (
                          <div className="text-[8px] font-bold text-white bg-rose-700 p-1 win95-border border-rose-900 animate-pulse mt-1">
                            WARNING: {rateLimitError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isMyComputerOpen && (
            <div className="absolute inset-0 flex items-center justify-center z-[250]">
              <motion.div drag dragControls={myComputerControls} dragListener={false} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="pointer-events-auto w-80 win95-bg win95-border flex flex-col shadow-2xl">
                <div onPointerDown={(e) => myComputerControls.start(e)} className="win95-title-bar cursor-grab active:cursor-grabbing"><div className="flex items-center gap-1.5 ml-1"><Monitor className="h-3.5 w-3.5" /><span className="text-[10px] font-bold">My Computer</span></div><button onClick={() => setIsMyComputerOpen(false)} className="win95-button h-4 w-4 flex items-center justify-center text-black font-bold text-[8px]">X</button></div>
                <div className="p-4 flex flex-col gap-3 font-win text-black">
                  <div className="text-xs font-bold border-b border-black pb-2 uppercase tracking-widest">Social Links</div>
                  <a href="https://instagram.com/fushigurp" target="_blank" className="flex items-center gap-3 p-2 hover:bg-[#000080] hover:text-white transition-none group font-bold"><Monitor className="h-4 w-4" />Instagram @fushigurp</a>
                  <a href="https://github.com/fs0cietyx" target="_blank" className="flex items-center gap-3 p-2 hover:bg-[#000080] hover:text-white transition-none group font-bold"><GitBranch className="h-4 w-4" />GitHub /fs0cietyx</a>
                  <a href="mailto:mainakbiswas22@gmail.com" className="flex items-center gap-3 p-2 hover:bg-[#000080] hover:text-white transition-none group font-bold"><Mail className="h-4 w-4" />Email Contact</a>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {nervousSystemAnswer && (
            <div className="absolute inset-0 flex items-center justify-center z-[500]">
              <div className="absolute inset-0 bg-black/20" onClick={() => setNervousSystemAnswer(null)}></div>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-[450px] win95-bg win95-border flex flex-col shadow-2xl z-10 pointer-events-auto">
                <div className="win95-title-bar cursor-default shrink-0">
                  <div className="flex items-center gap-1.5 ml-1"><Cpu className="h-4 w-4 animate-pulse text-white" /><span className="text-[11px] font-bold">Nervous System Response</span></div>
                  <button onClick={() => setNervousSystemAnswer(null)} className="win95-button h-4 w-4 flex items-center justify-center text-black font-bold text-[10px]">X</button>
                </div>
                <div className="p-4 flex gap-4 bg-[#c0c0c0]">
                  <Cpu className="h-8 w-8 text-[#000080] shrink-0" />
                  <div 
                    className="flex-1 text-[11px] font-win text-black whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar markdown-body"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(nervousSystemAnswer) as string) }}
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Source Code Modal */}
        <AnimatePresence>
          {sourceCodeModal.isOpen && (
            <div className="absolute inset-0 flex items-center justify-center z-[600]">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSourceCodeModal({ ...sourceCodeModal, isOpen: false })}></div>
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="w-[80vw] max-w-[1000px] h-[80vh] win95-bg win95-border flex flex-col shadow-2xl z-10 pointer-events-auto">
                <div className="win95-title-bar cursor-default shrink-0">
                  <div className="flex items-center gap-1.5 ml-1">
                    <FileCode className="h-4 w-4 text-white" />
                    <span className="text-[11px] font-bold uppercase truncate max-w-[400px]">Notepad - {sourceCodeModal.filename}</span>
                  </div>
                  <div className="flex gap-1 mr-1">
                    <button onClick={() => setSourceCodeModal({ ...sourceCodeModal, isOpen: false })} className="win95-button h-[20px] w-[20px] flex items-center justify-center text-black font-bold text-xs">X</button>
                  </div>
                </div>
                
                {/* Format options bar */}
                <div className="bg-[#c0c0c0] px-2 py-1 border-b border-[#808080] flex gap-4 text-[10px] font-win text-black">
                   <span className="hover:bg-[#000080] hover:text-white px-1 cursor-pointer">File</span>
                   <span className="hover:bg-[#000080] hover:text-white px-1 cursor-pointer">Edit</span>
                   <span className="hover:bg-[#000080] hover:text-white px-1 cursor-pointer">Search</span>
                   <span className="hover:bg-[#000080] hover:text-white px-1 cursor-pointer">Help</span>
                </div>

                <div className="flex-1 overflow-hidden m-1 win95-border-inset bg-white relative">
                   {sourceCodeModal.loading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                         <div className="text-[#000080] font-bold font-win animate-pulse">Loading Source...</div>
                      </div>
                   )}
                   {/* We use basic <pre> since it natively escapes HTML, preventing XSS without running markdown parsing. */}
                   <SyntaxHighlighter
                     language={sourceCodeModal.filename.split('.').pop() || 'text'}
                     style={dracula}
                     customStyle={{ margin: 0, height: '100%', fontSize: '11px', background: '#1e1e1e' }}
                     showLineNumbers={true}
                     wrapLines={true}
                   >
                     {sourceCodeModal.content}
                   </SyntaxHighlighter>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>


        {isTourActive && repoId && (
          <TourPlayer 
            repoId={repoId} 
            onClose={() => setIsTourActive(false)} 
            onStepChange={handleTourStepChange} 
          />
        )}

        {isGithubSettingsOpen && (
          <GithubSettings onClose={() => setIsGithubSettingsOpen(false)} />
        )}

        {isRecruiterReportOpen && repoId && (
          <RecruiterReport repoId={repoId} onClose={() => setIsRecruiterReportOpen(false)} />
        )}
      </div>

      <div className="h-8 win95-bg border-t-2 border-white flex items-center px-1 gap-1 z-[300] relative shadow-[0_-1px_0_#dfdfdf]">
        <button onClick={() => setIsStartMenuOpen(!isStartMenuOpen)} className={`win95-button flex items-center gap-1 px-2 h-6 ${isStartMenuOpen ? 'win95-border-inset !shadow-none' : ''}`}>
          <div className="w-4 h-4 bg-[#008080] grid grid-cols-2 gap-0.5 shrink-0"><div className="w-1.5 h-1.5 bg-red-500 shadow-[0.5px_0.5px_0_#000]"></div><div className="w-1.5 h-1.5 bg-green-500 shadow-[0.5px_0.5px_0_#000]"></div><div className="w-1.5 h-1.5 bg-blue-500 shadow-[0.5px_0.5px_0_#000]"></div><div className="w-1.5 h-1.5 bg-yellow-500 shadow-[0.5px_0.5px_0_#000]"></div></div>
          <span className="text-[11px] font-bold text-black font-win italic pr-1">Start</span>
        </button>
        <div className="h-6 w-[2px] bg-[#808080] mx-1 border-l border-white"></div>
        <div className="flex-1 flex gap-1 h-6 overflow-hidden">
          <div className={`win95-button flex items-center gap-1.5 px-2 font-win ${!isWorkspaceLaunched ? 'win95-border-inset !bg-[#dfdfdf]' : ''}`}><TerminalIcon className="h-3.5 w-3.5 text-black" /><span className="text-[10px] text-black font-bold truncate">Terminal</span></div>
          {isWorkspaceLaunched && <div className="win95-button win95-border-inset !bg-[#dfdfdf] flex items-center gap-1.5 px-2 font-win border-2 border-black"><img src="https://win98icons.alexmeub.com/icons/png/directory_open_file_mydocs-4.png" className="h-3 w-3" alt="Vault" /><span className="text-[10px] text-black font-bold truncate ml-1">Explorer</span></div>}
        </div>
        <div className="win95-border-inset px-2 h-6 flex items-center gap-2 bg-[#c0c0c0] font-win text-[10px] font-bold text-black"><Cpu className="h-3.5 w-3.5 animate-pulse" /><span className="tabular-nums">{systemTime}</span></div>
      </div>

      <AnimatePresence>
        {isStartMenuOpen && (
          <>
            <div className="fixed inset-0 z-[350]" onClick={() => setIsStartMenuOpen(false)}></div>
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="absolute bottom-8 left-0 mb-1 w-52 win95-bg win95-border z-[400] flex shadow-2xl font-win">
              <div className="w-6 bg-[#808080] flex items-end justify-center pb-2 shrink-0"><span className="text-white font-bold text-xs -rotate-90 whitespace-nowrap opacity-60">Windows 95</span></div>
              <div className="flex-1 py-1 text-black text-[11px] font-bold">
                <div className="px-3 py-1.5 hover:bg-[#000080] hover:text-white flex items-center gap-3"><Monitor className="h-4 w-4" />Programs</div>
                <div className="px-3 py-1.5 hover:bg-[#000080] hover:text-white flex items-center gap-3"><Folder className="h-4 w-4" />Documents</div>
                <div onClick={() => { setIsGithubSettingsOpen(true); setIsStartMenuOpen(false); }} className="px-3 py-1.5 hover:bg-[#000080] hover:text-white flex items-center gap-3 cursor-pointer"><GitBranch className="h-4 w-4" />GitHub Settings...</div>
                <div onClick={() => { setIsRecruiterReportOpen(true); setIsStartMenuOpen(false); }} className="px-3 py-1.5 hover:bg-[#000080] hover:text-white flex items-center gap-3 cursor-pointer"><FileText className="h-4 w-4" />Recruiter Report...</div>
                <div className="h-[1px] bg-[#808080] mx-1 my-1 border-b border-white"></div>
                <div onClick={() => window.location.reload()} className="px-3 py-1.5 hover:bg-[#000080] hover:text-white flex items-center gap-3"><Monitor className="h-4 w-4" />Shut Down...</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .win95-bg { background-color: #c0c0c0; }
        .win95-border { border: 2px solid; border-color: #dfdfdf #0a0a0a #0a0a0a #dfdfdf; box-shadow: inset 1px 1px #fff, inset -1px -1px #808080; }
        .win95-border-inset { border: 2px solid; border-color: #808080 #fff #fff #808080; box-shadow: inset 1px 1px #0a0a0a, inset -1px -1px #dfdfdf; }
        .win95-button { background-color: #c0c0c0; border: 2px solid; border-color: #dfdfdf #0a0a0a #0a0a0a #dfdfdf; box-shadow: inset 1px 1px #fff, inset -1px -1px #808080; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .win95-button:active { border-color: #808080 #fff #fff #808080; box-shadow: inset 1px 1px #0a0a0a, inset -1px -1px #dfdfdf; transform: translate(0.5px, 0.5px); }
        .win95-title-bar { background-color: #000080; height: 24px; display: flex; align-items: center; justify-content: space-between; color: white; padding: 0 4px; }
        .font-win { font-family: 'MS Sans Serif', Arial, sans-serif; }
        @font-face { font-family: 'MS Sans Serif'; src: url('https://fonts.cdnfonts.com/s/14899/MS Sans Serif.woff') format('woff'); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #dfdfdf; border-left: 1px solid #808080; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c0c0c0; border: 1px solid; border-color: #fff #808080 #808080 #fff; }
      `}</style>
    </div>
  );
}
