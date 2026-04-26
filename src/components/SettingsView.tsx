import React from 'react';
import { motion } from 'motion/react';
import { Settings, Ruler, Info, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface SettingsViewProps {
  moveDistance: number;
  onMoveDistanceChange: (miles: number) => void;
  scanRadius: number;
  onScanRadiusChange: (miles: number) => void;
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  moveDistance, 
  onMoveDistanceChange,
  scanRadius,
  onScanRadiusChange,
  voiceEnabled,
  onVoiceToggle
}) => {
  const distances = [3, 5, 10, 15, 20, 25, 30, 50, 100];
  const radiusOptions = [75, 100, 200, 300, 400, 500, 600];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-bold text-zinc-100">Movement Granularity</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-6">
          Adjust the distance traveled when using the directional control pad. 
          Smaller distances allow for city-by-city navigation, while larger jumps are better for regional analysis.
        </p>
        
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {distances.map((d) => (
            <button
              key={d}
              onClick={() => onMoveDistanceChange(d)}
              className={cn(
                "p-3 rounded-xl border transition-all text-sm font-medium",
                moveDistance === d 
                  ? "bg-sky-500/20 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
              )}
            >
              {d} Miles
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-zinc-800/50" />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-bold text-zinc-100">Radar Scan Range</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-6">
          Define the maximum distance for the storm scanner radar sweeps.
          Wider ranges provide more early warning, while smaller ranges are faster.
        </p>
        
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {radiusOptions.map((r) => (
            <button
              key={r}
              onClick={() => onScanRadiusChange(r)}
              className={cn(
                "p-3 rounded-xl border transition-all text-sm font-medium",
                scanRadius === r 
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
              )}
            >
              {r} mi
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-zinc-800/50" />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-bold text-zinc-100">App Information</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Version</span>
            <span className="text-zinc-300 font-mono">1.2.4</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Service Status</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Operational
            </div>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Data Sources</span>
            <span className="text-zinc-300">National Weather Service, OSM</span>
          </div>
        </div>
      </div>

      <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-4 flex gap-4">
        <div className="p-2 bg-sky-500/20 rounded-lg shrink-0 h-fit">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h3 className="text-zinc-100 font-semibold mb-1">Privacy Notice</h3>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Aura Weather uses your precise location to provide critical local storm scans. 
            All processing happens in your browser. Locational data is only transmitted to 
            trusted weather APIs and is never stored or tracked.
          </p>
        </div>
      </div>
    </div>
  );
};
