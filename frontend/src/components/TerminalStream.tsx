"use client";

import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface TerminalStreamProps {
  logs: any[];
}

export default function TerminalStream({ logs }: TerminalStreamProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const printedIds = useRef<Set<string | number>>(new Set());

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: "rgba(0, 0, 0, 0)", 
        foreground: "#00FF00", 
        cursor: "#00FF00",
        selectionBackground: "rgba(0, 255, 0, 0.2)",
        black: "#000000",
        red: "#FF0000",
        green: "#00FF00",
        yellow: "#FFFF00",
        blue: "#0000FF",
        magenta: "#FF00FF",
        cyan: "#00FFFF",
        white: "#FFFFFF",
      },
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 10,
      lineHeight: 1.2,
      cursorBlink: true,
      convertEol: true,
      disableStdin: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    
    // Tiny delay to ensure parent dimension hydration
    setTimeout(() => {
      try {
        if (
          terminalRef.current && 
          terminalRef.current.clientWidth > 0 && 
          terminalRef.current.clientHeight > 0 &&
          (term as any)._core?._renderService
        ) {
          fitAddon.fit();
        }
      } catch (e) {
        console.warn("Fit addon resize warning:", e);
      }
    }, 100);

    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[32m[SYSTEM LOGGING DAEMON ONLINE]\x1b[0m");

    return () => {
      term.dispose();
    };
  }, []);

  // Write new logs to the terminal
  useEffect(() => {
    const term = termInstance.current;
    if (!term || !term.element) return;
    
    // Guard against xterm internals not being fully initialized
    if (!(term as any)._core?._renderService) return;

    if (logs.length === 0) {
      term.clear();
      term.writeln("\x1b[33m[NO ACTIVE LOG TELEMETRY FOR WORKSPACE]\x1b[0m");
      printedIds.current.clear();
      return;
    }

    logs.forEach((log) => {
      const logKey = log.id !== undefined ? log.id : `${log.task_type}-${log.status}-${log.log_output}`;
      if (!printedIds.current.has(logKey)) {
        printedIds.current.add(logKey);
        
        // Format timestamp
        let timestamp = "00:00:00";
        if (log.created_at) {
          const parts = log.created_at.split("T");
          if (parts[1]) {
            timestamp = parts[1].split(".")[0];
          } else {
            timestamp = log.created_at;
          }
        } else {
          const now = new Date();
          timestamp = now.toTimeString().split(" ")[0];
        }
        
        let colorCode = "\x1b[37m"; // White
        if (log.status === "running") {
          colorCode = "\x1b[36m"; // Cyan
        } else if (log.status === "completed") {
          colorCode = "\x1b[32m"; // Green
        } else if (log.status === "failed") {
          colorCode = "\x1b[31m"; // Red
        }

        term.writeln(`\x1b[90m[${timestamp}]\x1b[0m ${colorCode}${log.log_output}\x1b[0m`);
      }
    });

    try {
      term.scrollToBottom();
    } catch (e) {
      // Ignore scroll errors if layout is hidden
    }
  }, [logs]);

  // Handle container resizing
  useEffect(() => {
    const handleResize = () => {
      try {
        if (
          fitAddonRef.current && 
          terminalRef.current && 
          termInstance.current && 
          (termInstance.current as any)._core?._renderService
        ) {
          // Only attempt to fit if the container is actually rendered and has dimensions
          if (terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
            fitAddonRef.current.fit();
          }
        }
      } catch (e) {
        // Suppress layout recalculation warnings
      }
    };
    window.addEventListener("resize", handleResize);
    
    // Poll resize logic when bottom height transitions
    const resizeInterval = setInterval(handleResize, 100);
    setTimeout(() => clearInterval(resizeInterval), 1000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(resizeInterval);
    };
  }, [logs]);

  return (
    <div className="w-full h-full relative p-3 bg-black/30 border border-white/10 rounded-xl overflow-hidden shadow-inner shadow-black/85">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
