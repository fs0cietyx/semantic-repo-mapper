// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
// @ts-ignore
import cola from "cytoscape-cola";

try {
  cytoscape.use(cola);
} catch (e) {
  console.warn("Cola extension already registered");
}

interface GraphOSCanvasProps {
  nodesData: Array<{
    id: string;
    name: string;
    type: string;
    importance?: number;
    complexity?: number;
    coupling?: number;
  }>;
  edgesData: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
  onNodeClick: (node: any) => void;
  onEdgeClick?: (edge: any) => void;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  config?: {
    nodeSpacing: number;
    edgeLength: number;
    nodeSizeMultiplier: number;
    edgeWidthMultiplier: number;
  };
}

export default function GraphOSCanvas({
  nodesData,
  edgesData,
  onNodeClick,
  onEdgeClick,
  selectedNodeId = null,
  selectedEdgeId = null,
  config = {
    nodeSpacing: 30,
    edgeLength: 150,
    nodeSizeMultiplier: 1,
    edgeWidthMultiplier: 1
  }
}: GraphOSCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [isStable, setIsStable] = useState(false);

  // 1. HARD GUARD: Polling check for physical dimensions
  useEffect(() => {
    let stableTicks = 0;
    const interval = setInterval(() => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          stableTicks++;
          if (stableTicks >= 3) { // Require 3 stable ticks (300ms) to ensure Framer Motion is done
            setIsStable(true);
            clearInterval(interval);
          }
        } else {
          stableTicks = 0;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // 2. SAFE BOOT: Initialize Cytoscape with atomic destruction
  useEffect(() => {
    if (!isStable || !containerRef.current || nodesData.length === 0) return;

    // Safety: Immediate destruction of any rogue instances
    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch (e) {}
      cyRef.current = null;
    }

    try {
      const cy = cytoscape({
        container: containerRef.current,
        elements: [
          ...nodesData.map((n) => ({ group: "nodes" as const, data: { id: n.id, label: n.name, type: n.type, raw: n } })),
          ...edgesData.map((e) => ({ group: "edges" as const, data: { id: e.id, source: e.source, target: e.target, type: e.type } }))
        ],
        boxSelectionEnabled: false,
        hideEdgesOnViewport: false,
        textureOnViewport: false,
        style: [
          // ... styles
          {
            selector: "node",
            style: {
              "background-color": (node: any) => {
                 const type = node.data('type');
                 if (type === 'repository') return "#ffffff";
                 if (type === 'domain') return "#ffcc00";
                 if (type === 'class') return "#ff4444";
                 if (type === 'function' || type === 'method') return "#00ff88";
                 if (type === 'apiendpoint') return "#cc00ff";
                 if (type === 'databasemodel') return "#00ccff";
                 if (type === 'hook') return "#ff8800";
                 if (type === 'file') return "#555555";
                 return "#aaaaaa";
              },
              "width": (node: any) => {
                 const type = node.data('type');
                 let w = 3;
                 if (type === 'repository') w = 10;
                 else if (type === 'domain' || type === 'class') w = 6;
                 else if (type === 'apiendpoint' || type === 'databasemodel') w = 5;
                 const multiplier = node.cy().data('nodeSizeMultiplier') || 1;
                 return w * multiplier;
              },
              "height": (node: any) => {
                 const type = node.data('type');
                 let h = 3;
                 if (type === 'repository') h = 10;
                 else if (type === 'domain' || type === 'class') h = 6;
                 else if (type === 'apiendpoint' || type === 'databasemodel') h = 5;
                 // Read dynamically from cy data if available, else fallback
                 const multiplier = node.cy().data('nodeSizeMultiplier') || 1;
                 return h * multiplier;
              },
              "opacity": 0.9,
              "label": (node: any) => {
                 const type = node.data('type');
                 if (type === 'folder') return "";
                 const name = node.data('raw')?.friendly_name || node.data('label');
                 const summary = node.data('raw')?.summary;
                 if (summary) {
                   const wrapped = summary.replace(/(?![^\n]{1,40}$)([^\n]{1,40})\s/g, '$1\n');
                   return `${name}\n---\n${wrapped}`;
                 }
                 return name;
              },
              "color": "#ffffff",
              "text-wrap": "wrap",
              "font-size": "5px",
              "font-family": "monospace",
              "text-valign": "bottom",
              "text-margin-y": 3,
              "text-background-opacity": 0.5,
              "text-background-color": "#000",
              "text-background-padding": "2px",
              "text-border-radius": "2px",
              "shadow-blur": (node: any) => {
                 return node.data('type') === 'repository' ? 10 : 4;
              },
              "shadow-color": (node: any) => node.style('background-color'),
              "shadow-opacity": 0.8,
            },
          },
          {
            selector: "edge",
            style: {
              "width": (edge: any) => {
                  const multiplier = edge.cy().data('edgeWidthMultiplier') || 1;
                  return 0.5 * multiplier;
              },
              "line-color": "#ffffff",
              "opacity": 0.3,
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
              "target-arrow-scale": 0.5,
              "target-arrow-color": "#ffffff",
              "arrow-scale": 0.6,
              "label": (edge: any) => {
                const type = edge.data('type');
                if (type === 'IMPORTS') return "Requires functionality from";
                if (type === 'CALLS') return "Triggers / Uses";
                if (type === 'EXTENDS') return "Builds upon";
                if (type === 'ROUTES_TO') return "Handles requests via";
                if (type === 'CONTAINS') return "";
                return type;
              },
              "font-size": "3px",
              "color": "#ffffff",
              "text-background-opacity": 0.6,
              "text-background-color": "#000",
              "text-background-padding": "1px",
              "text-opacity": 0.8
            },
          },
          {
            selector: "node.highlighted",
            style: {
              "background-color": "#ffffff",
              "opacity": 1,
              "width": 10,
              "height": 10,
              "label": "data(label)",
              "font-size": "10px",
              "z-index": 100,
              "shadow-blur": 20,
              "shadow-color": "#fff",
            },
          },
          {
            selector: "edge.highlighted",
            style: {
              "opacity": 0.9,
              "width": 1.5,
              "line-color": "#00ff88",
              "target-arrow-color": "#00ff88",
              "z-index": 90,
            },
          },
          {
            selector: "node.trace-active",
            style: {
              "background-color": "#00ff88",
              "shadow-blur": 30,
              "shadow-color": "#00ff88",
              "shadow-opacity": 1,
              "width": 12,
              "height": 12,
              "transition-property": "width height background-color shadow-blur",
              "transition-duration": 300
            }
          },
          {
            selector: "node.impact-active",
            style: {
              "background-color": "#ff0066",
              "shadow-blur": 40,
              "shadow-color": "#ff0066",
              "shadow-opacity": 1,
              "width": 14,
              "height": 14,
              "transition-property": "width height background-color shadow-blur",
              "transition-duration": 500
            }
          },
          {
            selector: "node.semantic-active",
            style: {
              "background-color": "#00ffff", // Cyan glow for semantic search
              "shadow-blur": 50,
              "shadow-color": "#00ffff",
              "shadow-opacity": 1,
              "width": 16,
              "height": 16,
              "transition-property": "width height background-color shadow-blur",
              "transition-duration": 400
            }
          },
          {
            selector: "node.dimmed",
            style: { "opacity": 0.05, "text-opacity": 0 },
          },
          {
            selector: "edge.dimmed",
            style: { "opacity": 0 },
          },
        ],
      });
      cyRef.current = cy;

      // Set initial dynamic data
      cy.data('nodeSizeMultiplier', config.nodeSizeMultiplier);
      cy.data('edgeWidthMultiplier', config.edgeWidthMultiplier);

      cy.on("tap", "node", (evt) => {
        onNodeClick(evt.target.data("raw"));
      });

      cy.on("tap", "edge", (evt) => {
        if (onEdgeClick) {
          const edgeData = evt.target.data();
          onEdgeClick({
            id: edgeData.id,
            source: edgeData.source,
            target: edgeData.target,
            type: edgeData.type
          });
        }
      });

      // Elastic snap-back effect when releasing a dragged node
      cy.on("free", "node", (evt) => {
         evt.target.unlock();
      });

      const layout = cy.layout({
        name: "cola",
        animate: true,
        refresh: 2, 
        infinite: true, // Run continuously for the living graph effect
        fit: false, // Disable auto-fit during infinite loop to prevent viewport dimension errors
        padding: 50,
        randomize: true, // Only true on first boot
        nodeSpacing: (node: any) => node.cy().data('nodeSpacing') || config.nodeSpacing,
        edgeLength: (edge: any) => edge.cy().data('edgeLength') || config.edgeLength,
        unconstrIter: 10,
        userConstIter: 10,
        allConstIter: 10,
        handleDisconnected: true,
      } as any);
      
      layout.run();
      cyRef.current = cy;
      
      // Manually fit at the start since auto-fit is disabled
      setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          cyRef.current.fit(cyRef.current.elements(), 50);
        }
      }, 100);
      
      // Store layout reference directly on cy for cleanup
      (cy as any)._activeLayout = layout;
      
      // Force immediate geometry recalculation safely
      requestAnimationFrame(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          cyRef.current.resize();
        }
      });

    } catch (e) {
      console.error("Cytoscape init error:", e);
    }

    return () => {
      if (cyRef.current) {
        const cy = cyRef.current;
        cyRef.current = null; // Detach immediately to prevent race conditions
        try {
          if ((cy as any)._activeLayout) {
             (cy as any)._activeLayout.stop();
          }
          cy.stop(true); 
          cy.elements().stop(true);
          if (!cy.destroyed()) cy.destroy();
        } catch (e) {
          console.warn("Cytoscape cleanup error:", e);
        }
      }
    };
  }, [isStable, nodesData, edgesData]);

  // 2.5 DYNAMIC CONFIG UPDATES (Instant reactivity without destroying Graph)
  useEffect(() => {
    if (!cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;

    // Update style multipliers
    cy.data('nodeSizeMultiplier', config.nodeSizeMultiplier);
    cy.data('edgeWidthMultiplier', config.edgeWidthMultiplier);
    
    try {
      cy.style().update(); // Force visual recalculation
    } catch (e) {
      console.warn("Style update skipped", e);
    }

    // Only restart the expensive physics layout if the physics values actually changed
    const currentSpacing = cy.data('nodeSpacing');
    const currentLength = cy.data('edgeLength');

    if (currentSpacing !== config.nodeSpacing || currentLength !== config.edgeLength) {
      cy.data('nodeSpacing', config.nodeSpacing);
      cy.data('edgeLength', config.edgeLength);

      try {
        if ((cy as any)._activeLayout) {
          (cy as any)._activeLayout.stop();
        }
        
        const newLayout = cy.layout({
          name: "cola",
          animate: true,
          refresh: 2,
          infinite: true,
          fit: false,
          padding: 50,
          randomize: false, // Smooth transition from current positions
          nodeSpacing: (node: any) => config.nodeSpacing,
          edgeLength: (edge: any) => config.edgeLength,
          unconstrIter: 10,
          userConstIter: 10,
          allConstIter: 10,
          handleDisconnected: true,
        } as any);
        
        newLayout.run();
        (cy as any)._activeLayout = newLayout;
      } catch (e) {
        console.warn("Dynamic layout update error:", e);
      }
    }
  }, [config.nodeSpacing, config.edgeLength, config.nodeSizeMultiplier, config.edgeWidthMultiplier]);

  // 3. UI SYNC
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed()) return;
    cy.batch(() => {
      cy.elements().removeClass("highlighted dimmed");
      if (selectedNodeId) {
        const sel = cy.getElementById(selectedNodeId);
        if (sel.length) {
          const neighborhood = sel.neighborhood().union(sel);
          cy.elements().addClass("dimmed");
          neighborhood.removeClass("dimmed").addClass("highlighted");
          cy.animate({ center: { eles: sel }, zoom: 1.8, duration: 800 });
        }
      } else if (selectedEdgeId) {
        const sel = cy.getElementById(selectedEdgeId);
        if (sel.length) {
          cy.elements().addClass("dimmed");
          sel.removeClass("dimmed").addClass("highlighted");
          sel.connectedNodes().removeClass("dimmed").addClass("highlighted");
        }
      }
    });
  }, [selectedNodeId, selectedEdgeId]);

  // 4. ANIMATION ENGINE: THE NERVOUS PULSE
  useEffect(() => {
    const handlePlayTrace = (event: any) => {
      const traceNodes = event.detail?.trace || [];
      const cy = cyRef.current;
      if (!cy || cy.destroyed() || traceNodes.length === 0) return;

      console.log("[PULSE] Initiating nervous trace:", traceNodes);

      cy.batch(() => {
        cy.elements().removeClass("highlighted dimmed trace-active impact-active semantic-active");
        cy.elements().addClass("dimmed");
      });

      let step = 0;
      const playStep = () => {
        if (step >= traceNodes.length) {
          // Finish trace: dim back to normal after delay
          setTimeout(() => {
            if (!cyRef.current?.destroyed()) {
              cy.elements().removeClass("dimmed highlighted trace-active impact-active semantic-active");
            }
          }, 2000);
          return;
        }

        const nodeData = traceNodes[step];
        const ele = cy.getElementById(nodeData.id);
        
        if (ele.length) {
          ele.removeClass("dimmed").addClass("highlighted trace-active");
          cy.animate({
            center: { eles: ele },
            zoom: 1.5,
            duration: 500
          });
        }

        step++;
        setTimeout(playStep, 800); // 800ms between nerve pulses
      };

      playStep();
    };

    window.addEventListener('play-trace', handlePlayTrace);
    return () => window.removeEventListener('play-trace', handlePlayTrace);
  }, [isStable]);

  // 5. IMPACT VISUALIZER: THE BLAST RADIUS
  useEffect(() => {
    const handleShowImpact = (event: any) => {
      const impactNodes = event.detail?.impact_radius || [];
      const cy = cyRef.current;
      if (!cy || cy.destroyed() || impactNodes.length === 0) return;

      console.log("[IMPACT] Highlighting blast radius:", impactNodes);

      cy.batch(() => {
        cy.elements().removeClass("highlighted dimmed trace-active impact-active semantic-active");
        cy.elements().addClass("dimmed");
        
        // Highlight the impact radius with a specific class
        impactNodes.forEach((node: any) => {
          const ele = cy.getElementById(node.id);
          if (ele.length) {
            ele.removeClass("dimmed").addClass("impact-active");
          }
        });
      });

      // Reset after a long delay (5s) to allow study
      setTimeout(() => {
        if (!cyRef.current?.destroyed()) {
           cy.elements().removeClass("dimmed highlighted trace-active impact-active semantic-active");
        }
      }, 5000);
    };

    window.addEventListener('show-impact', handleShowImpact);
    return () => window.removeEventListener('show-impact', handleShowImpact);
  }, [isStable]);

  // 6. SEMANTIC SEARCH VISUALIZER: THE NERVOUS SYSTEM
  useEffect(() => {
    const handleSemanticHighlight = (event: any) => {
      const clusterNodes = event.detail?.cluster || [];
      const cy = cyRef.current;
      if (!cy || cy.destroyed() || clusterNodes.length === 0) return;

      console.log("[SEMANTIC] Highlighting conceptual cluster:", clusterNodes);

      let targetCollection = cy.collection();

      cy.batch(() => {
        cy.elements().removeClass("highlighted dimmed trace-active impact-active semantic-active");
        cy.elements().addClass("dimmed");
        
        clusterNodes.forEach((node: any) => {
          const ele = cy.getElementById(node.id);
          if (ele.length) {
            ele.removeClass("dimmed").addClass("semantic-active");
            targetCollection = targetCollection.union(ele);
          }
        });
      });

      // Smoothly zoom and fit to the exact cluster
      if (targetCollection.length > 0) {
         cy.animate({
            fit: {
              eles: targetCollection,
              padding: 50
            },
            duration: 800,
            easing: 'ease-in-out'
         });
      }

      // Reset after 8 seconds
      setTimeout(() => {
        if (!cy.destroyed()) {
          cy.elements().removeClass("dimmed highlighted trace-active impact-active semantic-active");
        }
      }, 8000);
    };

    window.addEventListener('semantic-highlight', handleSemanticHighlight);
    return () => window.removeEventListener('semantic-highlight', handleSemanticHighlight);
  }, [isStable]);

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full bg-[#050505] transition-opacity duration-300"
      style={{ opacity: isStable ? 1 : 0 }}
    />
  );
}
