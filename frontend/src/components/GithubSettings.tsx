import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Lock, Save, X, ShieldCheck, Cpu } from 'lucide-react';

interface GithubSettingsProps {
  onClose: () => void;
}

export default function GithubSettings({ onClose }: GithubSettingsProps) {
  const [token, setToken] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const resp = await fetch("http://127.0.0.1:8000/api/settings/system");
        if (resp.ok) {
          const data = await resp.json();
          if (data.github_token_exists) setToken("********");
          if (data.gemini_key_exists) setGeminiKey("********");
        }
      } catch (err) {
        console.error("Failed to fetch system settings", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus("idle");
    try {
      const resp = await fetch("http://127.0.0.1:8000/api/settings/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          github_token: token,
          gemini_api_key: geminiKey
        })
      });
      
      if (resp.ok) {
        setStatus("success");
        setTimeout(onClose, 1000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="win95-bg win95-border w-[400px] p-2 shadow-2xl pointer-events-auto"
      >
        <div className="win95-title-bar mb-4">
          <div className="flex items-center gap-1.5 ml-1">
            <Monitor className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-tight">System Configuration</span>
          </div>
          <button onClick={onClose} className="win95-button h-4 w-4 text-[8px]">X</button>
        </div>

        <div className="flex flex-col gap-4 p-2">
          <div className="win95-border-inset bg-white p-3 flex flex-col gap-4">
            {/* GitHub Token */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                 <Lock className="h-3 w-3 text-black/60" />
                 <label className="text-[10px] font-bold text-black font-win uppercase tracking-tighter">GitHub_PAT:</label>
              </div>
              <input 
                type="password" 
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full bg-white win95-border-inset px-2 py-1.5 text-[11px] font-mono focus:outline-none text-black"
              />
            </div>

            {/* Gemini Key */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                 <Cpu className="h-3 w-3 text-black/60" />
                 <label className="text-[10px] font-bold text-black font-win uppercase tracking-tighter">Gemini_API_Key:</label>
              </div>
              <input 
                type="password" 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-white win95-border-inset px-2 py-1.5 text-[11px] font-mono focus:outline-none text-black"
              />
            </div>
          </div>

          <div className="bg-[#ffffcc] border border-[#808080] p-2 flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-green-700 shrink-0" />
            <p className="text-[9px] text-black italic leading-tight">Tokens and AI keys are stored securely in your local PostgreSQL vault for authenticated ingestion.</p>
          </div>

          <div className="flex justify-end gap-2">
            {status === "success" && <span className="text-[10px] text-green-700 font-bold self-center animate-pulse mr-2">CREDENTIALS_SECURED_</span>}
            {status === "error" && <span className="text-[10px] text-red-700 font-bold self-center mr-2">SYSTEM_ERROR_</span>}
            
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="win95-button px-6 py-1 font-bold text-[11px] flex items-center gap-2"
            >
              <Save className="h-3 w-3" /> OK
            </button>
            <button 
              onClick={onClose}
              className="win95-button px-4 py-1 text-[11px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
