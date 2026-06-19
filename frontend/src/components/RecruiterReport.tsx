import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Share2, BarChart3, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface RecruiterReportProps {
  repoId: string;
  onClose: () => void;
}

export default function RecruiterReport({ repoId, onClose }: RecruiterReportProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const resp = await fetch(`http://127.0.0.1:8000/api/repository/${repoId}/recruiter-report`);
        if (resp.ok) {
          const data = await resp.json();
          setReport(data);
        }
      } catch (err) {
        console.error("Failed to fetch recruiter report", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [repoId]);

  if (loading) return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
      <div className="win95-bg win95-border p-8 flex flex-col items-center gap-4">
        <BarChart3 className="h-12 w-12 text-black animate-bounce" />
        <span className="text-xs font-bold font-win uppercase tracking-widest animate-pulse">Analyzing_Nervous_System...</span>
      </div>
    </div>
  );

  if (!report) return null;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="win95-bg win95-border w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="win95-title-bar shrink-0">
          <div className="flex items-center gap-1.5 ml-1">
            <FileText className="h-4 w-4" />
            <span className="text-[11px] font-bold uppercase tracking-tight">Recruiter Intelligence Report - {report.repo_name}</span>
          </div>
          <button onClick={onClose} className="win95-button h-5 w-5 text-[10px]">X</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white m-1 win95-border-inset text-black font-serif">
          {/* Header */}
          <div className="border-b-4 border-black pb-4 mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">Architectural_Index</h1>
              <p className="text-xs font-mono opacity-60">ID: {repoId} {"//"} GENERATED_AT: {new Date(report.generated_at).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">System_Health</div>
              <div className="text-5xl font-black text-[#000080] leading-none">{report.intelligence.modularity || 72}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Col: Executive Summary */}
            <div className="md:col-span-2 space-y-8">
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest border-b border-black/10 mb-3 flex items-center gap-2">
                   <Zap className="h-3.5 w-3.5 text-yellow-600" /> Executive_Summary
                </h2>
                <p className="text-sm leading-relaxed italic pr-4">
                  &quot;{report.intelligence.debt_summary}&quot;
                </p>
              </section>

              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest border-b border-black/10 mb-3 flex items-center gap-2">
                   <AlertTriangle className="h-3.5 w-3.5 text-rose-700" /> Critical_Bottlenecks
                </h2>
                <div className="space-y-3">
                  {report.intelligence.bottlenecks?.map((b: any, idx: number) => (
                    <div key={idx} className="flex gap-4 items-start">
                      <div className="bg-rose-100 text-rose-900 px-2 py-0.5 text-[10px] font-bold shrink-0">HIGH_RISK</div>
                      <p className="text-sm">{b}</p>
                    </div>
                  )) || <p className="text-sm opacity-40 italic">No critical bottlenecks detected.</p>}
                </div>
              </section>
            </div>

            {/* Right Col: Metadata & Metrics */}
            <div className="space-y-6">
              <div className="win95-bg win95-border p-3">
                 <div className="text-[10px] font-bold uppercase text-black mb-3">Graph_Metircs</div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                       <span className="opacity-60">Total_Symbols:</span>
                       <span className="font-bold">{report.metrics.node_count}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                       <span className="opacity-60">Nervous_Links:</span>
                       <span className="font-bold">{report.metrics.edge_count}</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-black/10">
                       <div className="text-[10px] font-bold uppercase mb-2">Stability_Score</div>
                       <div className="h-3 bg-black/10 p-[1.5px] win95-border-inset">
                          <div className="h-full bg-green-700" style={{ width: '88%' }} />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-[#f0f0f0] border border-black/20 p-4 space-y-4">
                 <div className="flex items-center gap-2 text-[#000080]">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase">Recruiter_Verified</span>
                 </div>
                 <p className="text-[10px] leading-tight opacity-60">
                   This report is generated via static analysis of AST relationships and semantic AI interpretation.
                 </p>
              </div>
            </div>
          </div>

          {/* Footer Branding */}
          <div className="mt-16 pt-4 border-t-2 border-black flex justify-between items-end grayscale opacity-30">
            <div className="text-[9px] font-bold uppercase tracking-[0.4em]">fs0cietyx_Software_Nervous_System</div>
            <div className="text-[8px] font-mono">VER_1.0.0_STABLE</div>
          </div>
        </div>

        <div className="win95-bg p-3 flex justify-end gap-3 shrink-0">
          <button className="win95-button px-6 py-1.5 font-bold text-xs flex items-center gap-2">
             <Download className="h-3.5 w-3.5" /> EXPORT_PDF
          </button>
          <button className="win95-button px-6 py-1.5 font-bold text-xs flex items-center gap-2">
             <Share2 className="h-3.5 w-3.5" /> SHARE_URL
          </button>
          <button onClick={onClose} className="win95-button px-8 py-1.5 font-bold text-xs">
             CLOSE
          </button>
        </div>
      </motion.div>
    </div>
  );
}
