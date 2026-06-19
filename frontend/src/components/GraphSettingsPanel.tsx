import React from "react";
import { SlidersIcon, Settings } from "lucide-react";

interface GraphConfig {
  nodeSpacing: number;
  edgeLength: number;
  nodeSizeMultiplier: number;
  edgeWidthMultiplier: number;
}

interface GraphSettingsPanelProps {
  config: GraphConfig;
  setConfig: React.Dispatch<React.SetStateAction<GraphConfig>>;
  onClose: () => void;
}

export default function GraphSettingsPanel({ config, setConfig, onClose }: GraphSettingsPanelProps) {
  const handleChange = (key: keyof GraphConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="absolute top-12 right-6 w-80 win95-bg win95-border shadow-md z-50 text-black font-win select-none flex flex-col">
      <div className="win95-title-bar cursor-move">
        <div className="flex items-center gap-1.5 px-1">
          <Settings className="h-3 w-3 text-white" />
          <span>Graph Settings</span>
        </div>
        <button onClick={onClose} className="win95-button h-[16px] w-[16px] flex items-center justify-center text-black font-bold text-[10px] mr-0.5">
          X
        </button>
      </div>

      <div className="p-3 space-y-4">
        
        {/* Force Simulation */}
        <fieldset className="border border-[#dfdfdf] border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-2 relative">
          <legend className="px-1 text-[11px] bg-[#c0c0c0] absolute -top-2 left-2">Force Simulation</legend>
          
          <div className="space-y-3 mt-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span>Repel Force</span>
                <span>{config.nodeSpacing}</span>
              </div>
              <input 
                type="range" min="10" max="200" value={config.nodeSpacing} 
                onChange={(e) => handleChange("nodeSpacing", parseInt(e.target.value))}
                className="w-full win95-border-inset bg-white h-4 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#c0c0c0] [&::-webkit-slider-thumb]:win95-border" 
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span>Link Distance</span>
                <span>{config.edgeLength}</span>
              </div>
              <input 
                type="range" min="50" max="500" value={config.edgeLength} 
                onChange={(e) => handleChange("edgeLength", parseInt(e.target.value))}
                className="w-full win95-border-inset bg-white h-4 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#c0c0c0] [&::-webkit-slider-thumb]:win95-border" 
              />
            </div>
          </div>
        </fieldset>

        {/* Visual Adjustments */}
        <fieldset className="border border-[#dfdfdf] border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-2 relative">
          <legend className="px-1 text-[11px] bg-[#c0c0c0] absolute -top-2 left-2">Visual Adjustments</legend>
          
          <div className="space-y-3 mt-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span>Node Size</span>
                <span>{config.nodeSizeMultiplier.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.5" max="3" step="0.1" value={config.nodeSizeMultiplier} 
                onChange={(e) => handleChange("nodeSizeMultiplier", parseFloat(e.target.value))}
                className="w-full win95-border-inset bg-white h-4 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#c0c0c0] [&::-webkit-slider-thumb]:win95-border" 
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span>Link Thickness</span>
                <span>{config.edgeWidthMultiplier.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.2" max="5" step="0.1" value={config.edgeWidthMultiplier} 
                onChange={(e) => handleChange("edgeWidthMultiplier", parseFloat(e.target.value))}
                className="w-full win95-border-inset bg-white h-4 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#c0c0c0] [&::-webkit-slider-thumb]:win95-border" 
              />
            </div>
          </div>
        </fieldset>
        
        <div className="flex justify-end mt-2">
          <button onClick={onClose} className="win95-button text-[11px] px-4 py-1">
            OK
          </button>
        </div>

      </div>
    </div>
  );
}
