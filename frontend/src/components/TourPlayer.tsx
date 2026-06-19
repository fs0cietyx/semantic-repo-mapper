import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ChevronRight, ChevronLeft, X, Map } from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  message: string;
  target: {
    node_id: string;
    type: string;
    line_range?: [number, number];
  };
}

interface Tour {
  id: string;
  title: string;
  description: string;
  steps: TourStep[];
}

interface TourPlayerProps {
  repoId: string;
  onClose: () => void;
  onStepChange: (step: TourStep) => void;
}

export default function TourPlayer({ repoId, onClose, onStepChange }: TourPlayerProps) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTours = async () => {
      try {
        const resp = await fetch(`http://127.0.0.1:8000/api/repository/${repoId}/tours`);
        const data = await resp.json();
        setTours(data.tours || []);
      } catch (err) {
        console.error("Failed to fetch tours", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTours();
  }, [repoId]);

  const handleStartTour = (tour: Tour) => {
    setActiveTour(tour);
    setCurrentStepIndex(0);
    onStepChange(tour.steps[0]);
  };

  const handleNextStep = () => {
    if (activeTour && currentStepIndex < activeTour.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onStepChange(activeTour.steps[nextIndex]);
    }
  };

  const handlePrevStep = () => {
    if (activeTour && currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      onStepChange(activeTour.steps[prevIndex]);
    }
  };

  if (loading) return null;

  return (
    <div className="fixed bottom-12 right-4 z-[500] w-80 pointer-events-auto">
      <AnimatePresence mode="wait">
        {!activeTour ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="win95-bg win95-border p-2 shadow-2xl"
          >
            <div className="win95-title-bar mb-2">
              <div className="flex items-center gap-1.5 ml-1">
                <Map className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold">Narrative Tours</span>
              </div>
              <button onClick={onClose} className="win95-button h-4 w-4 text-[8px]">X</button>
            </div>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
              {tours.length > 0 ? tours.map(tour => (
                <div key={tour.id} className="win95-border-inset bg-white p-2 hover:bg-[#eee] cursor-pointer" onClick={() => handleStartTour(tour)}>
                  <div className="text-[11px] font-bold text-[#000080]">{tour.title}</div>
                  <div className="text-[9px] text-black/60 leading-tight mt-1">{tour.description}</div>
                  <div className="mt-2 flex justify-end">
                    <button className="win95-button px-2 py-0.5 text-[9px] font-bold gap-1">
                      <Play className="h-2.5 w-2.5 fill-black" /> START
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-[10px] text-black/40 text-center py-4 italic">No tours available for this repo.</div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="active-step"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="win95-bg win95-border p-2 shadow-2xl"
          >
            <div className="win95-title-bar mb-2">
              <div className="flex items-center gap-1.5 ml-1">
                <Map className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold truncate max-w-[180px]">{activeTour.title}</span>
              </div>
              <div className="text-[9px] font-bold opacity-60 mr-2">{currentStepIndex + 1} / {activeTour.steps.length}</div>
              <button onClick={() => setActiveTour(null)} className="win95-button h-4 w-4 text-[8px]">X</button>
            </div>
            
            <div className="win95-border-inset bg-white p-3 min-h-[100px] flex flex-col">
              <div className="text-[10px] font-bold text-[#000080] mb-1 uppercase tracking-tighter">
                {activeTour.steps[currentStepIndex].title}
              </div>
              <div className="text-[11px] text-black leading-relaxed flex-1 italic">
                &quot;{activeTour.steps[currentStepIndex].message}&quot;
              </div>
              
              <div className="mt-3 pt-2 border-t border-[#c0c0c0] flex justify-between items-center">
                <button 
                  onClick={handlePrevStep}
                  disabled={currentStepIndex === 0}
                  className="win95-button px-2 py-1 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-[8px] font-bold uppercase opacity-40">Target: {activeTour.steps[currentStepIndex].target.node_id.split('/').pop()}</div>
                <button 
                  onClick={handleNextStep}
                  disabled={currentStepIndex === activeTour.steps.length - 1}
                  className="win95-button px-2 py-1 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
