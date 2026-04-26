import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Ruler, Info, ShieldCheck, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface SettingsViewProps {
  moveDistance: number;
  onMoveDistanceChange: (miles: number) => void;
  scanRadius: number;
  onScanRadiusChange: (miles: number) => void;
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  onVoiceSelect: (uri: string) => void;
  speechRate: number;
  onSpeechRateChange: (rate: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  moveDistance, 
  onMoveDistanceChange,
  scanRadius,
  onScanRadiusChange,
  voiceEnabled,
  onVoiceToggle,
  voices,
  selectedVoiceURI,
  onVoiceSelect,
  speechRate,
  onSpeechRateChange
}) => {
  const distances = [3, 5, 10, 15, 20, 25, 30, 50, 100];
  const radiusOptions = [75, 100, 200, 300, 400, 500, 600];
  const rateOptions = [0.5, 0.75, 0.85, 1, 1.1, 1.25, 1.5, 1.75, 2];

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
        
        <div className="relative">
          <select 
            value={moveDistance}
            onChange={(e) => onMoveDistanceChange(Number(e.target.value))}
            className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer"
          >
            {distances.map((d) => (
              <option key={d} value={d}>
                {d} Miles
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            <Settings className="w-4 h-4" />
          </div>
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
        
        <div className="relative">
          <select 
            value={scanRadius}
            onChange={(e) => onScanRadiusChange(Number(e.target.value))}
            className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
          >
            {radiusOptions.map((r) => (
              <option key={r} value={r}>
                {r} mi
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            <Settings className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="h-px bg-zinc-800/50" />

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-zinc-100">Voice Interface</h2>
          </div>
          <button
            onClick={() => onVoiceToggle(!voiceEnabled)}
            aria-label={`${voiceEnabled ? 'Disable' : 'Enable'} Voice Interface`}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
              voiceEnabled ? "bg-emerald-600" : "bg-zinc-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                voiceEnabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <p className="text-zinc-400 text-sm mb-6">
          Toggle auditory weather reports and system alerts. 
        </p>
      </div>

      <div className="h-px bg-zinc-800/50" />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-5 h-5 text-sky-400" />
          <h2 className="text-xl font-bold text-zinc-100">Voice Selection</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-6">
          Choose your preferred voice for reports. 
          Windows users may have access to "Natural" voices.
        </p>

        <div className="space-y-3">
          {!voiceEnabled ? (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 text-sm italic">
              Enable the "Voice Interface" toggle above to configure these options.
            </div>
          ) : voices.length === 0 ? (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 text-sm italic">
              Loading system voices...
            </div>
          ) : (
            <div className="relative">
              <select 
                value={selectedVoiceURI || ''}
                onChange={(e) => onVoiceSelect(e.target.value)}
                className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer text-sm"
              >
                <option value="" disabled>Select a voice...</option>
                {voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <Volume2 className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-zinc-800/50" />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-zinc-100">Voice Speed</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-6">
          Adjust the speech rate for reports. Higher values are faster.
        </p>
        
        <div className="relative">
          <select 
            value={speechRate}
            onChange={(e) => onSpeechRateChange(Number(e.target.value))}
            className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
          >
            {rateOptions.map((r) => (
              <option key={r} value={r}>
                {r === 1 ? "1.0 (Normal)" : `${r}x Speed`}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            <Settings className="w-4 h-4" />
          </div>
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
            <span className="text-zinc-300 font-mono">1.3</span>
          </div>
        </div>
      </div>
    </div>
  );
};
