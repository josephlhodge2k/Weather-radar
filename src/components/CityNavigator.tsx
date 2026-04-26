import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { moveInDirection, LocationInfo } from '../services/weatherService';

interface CityNavigatorProps {
  currentLoc: { name: string; lat: number; lon: number; state?: string } | null;
  onLocationChange: (loc: { name: string; lat: number; lon: number; state?: string }) => void;
  weatherBrief?: string;
  onSpeak: (text: string) => void;
  moveDistance?: number;
}

export const CityNavigator: React.FC<CityNavigatorProps> = ({ 
  currentLoc, 
  onLocationChange, 
  weatherBrief, 
  onSpeak,
  moveDistance = 3
}) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const lastState = useRef<string | undefined>(currentLoc?.state);
  const lastAnnouncementRef = useRef('');

  // Sync lastState if it's currently undefined but provided in props
  if (lastState.current === undefined && currentLoc?.state) {
    lastState.current = currentLoc.state;
  }

  const handleMove = async (direction: 'north' | 'south' | 'east' | 'west') => {
    if (!currentLoc || isNavigating) return;

    setIsNavigating(true);
    onSpeak(`Moving ${direction}...`);

    try {
      const nextLoc = await moveInDirection(currentLoc.lat, currentLoc.lon, direction, moveDistance);
      
      if (nextLoc) {
        let message = `Arrived in ${nextLoc.name}`;
        
        // Only announce state if it actually changed
        if (nextLoc.state && lastState.current && nextLoc.state !== lastState.current) {
          message += `, entering the state of ${nextLoc.state}`;
        }
        
        lastState.current = nextLoc.state;
        lastAnnouncementRef.current = message;
        onSpeak(message);
        
        onLocationChange({
          name: nextLoc.name,
          lat: nextLoc.latitude,
          lon: nextLoc.longitude,
          state: nextLoc.state
        });
      } else {
        onSpeak('Unable to reach a new destination in that direction.');
      }
    } catch (error) {
      onSpeak('Navigation system error. Please try again.');
    } finally {
      setIsNavigating(false);
    }
  };

  // Effect to append weather brief to announcement when it arrives
  React.useEffect(() => {
    if (weatherBrief && lastAnnouncementRef.current.startsWith('Arrived')) {
      // Small timeout to ensure the "Arrived" message is processed if they happen close together
      const timer = setTimeout(() => {
        onSpeak(`${lastAnnouncementRef.current}. Conditions: ${weatherBrief}`);
        lastAnnouncementRef.current = ''; // Reset after speaking
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [weatherBrief, onSpeak]);

  return (
    <section className="bg-zinc-900/50 border-2 border-zinc-800 rounded-3xl p-6 mt-6 shadow-xl" aria-labelledby="nav-heading">
      <div className="flex items-center gap-2 mb-6">
        <Compass className="w-5 h-5 text-sky-500" />
        <h2 id="nav-heading" className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Global Mobility System
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="flex flex-col items-center">
          <div className="relative w-48 h-48 flex items-center justify-center bg-zinc-950 rounded-full border border-zinc-800 shadow-inner">
            {/* Center Display */}
            <div className="text-center z-10 px-2">
              <p className="text-[9px] font-mono text-zinc-600 uppercase mb-1">Position</p>
              <p className="text-[10px] font-bold text-sky-400 leading-tight max-w-[120px] line-clamp-2">
                {currentLoc?.name || 'Unknown'}
              </p>
            </div>

            {/* Navigation Grid (Cross Pattern) */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-2">
              <div /> {/* 0,0 */}
              <NavButton 
                onClick={() => handleMove('north')} 
                disabled={isNavigating} 
                label="Move North"
                icon={<ChevronUp className="w-6 h-6" />}
                className="col-start-2 justify-self-center self-start"
              />
              <div /> {/* 0,2 */}

              <NavButton 
                onClick={() => handleMove('west')} 
                disabled={isNavigating} 
                label="Move West"
                icon={<ChevronLeft className="w-6 h-6" />}
                className="row-start-2 col-start-1 justify-self-start self-center"
              />
              <div /> {/* Center */}
              <NavButton 
                onClick={() => handleMove('east')} 
                disabled={isNavigating} 
                label="Move East"
                icon={<ChevronRight className="w-6 h-6" />}
                className="row-start-2 col-start-3 justify-self-end self-center"
              />

              <div /> {/* 2,0 */}
              <NavButton 
                onClick={() => handleMove('south')} 
                disabled={isNavigating} 
                label="Move South"
                icon={<ChevronDown className="w-6 h-6" />}
                className="row-start-3 col-start-2 justify-self-center self-end"
              />
              <div /> {/* 2,2 */}
            </div>
            
            {/* Compass Rings */}
            <div className="absolute inset-4 border border-zinc-800/50 rounded-full animate-spin-slow pointer-events-none" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 h-24 flex items-center justify-center text-center">
            <p className="text-sm text-zinc-400 italic">
              {isNavigating ? 'Calculating trajectory...' : 'Use direction controllers to explore weather patterns in neighboring regions.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

interface NavButtonProps {
  onClick: () => void;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
  className: string;
}

const NavButton: React.FC<NavButtonProps> = ({ onClick, disabled, label, icon, className }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={`p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sky-500 hover:text-sky-400 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg ${className}`}
  >
    {icon}
  </motion.button>
);
