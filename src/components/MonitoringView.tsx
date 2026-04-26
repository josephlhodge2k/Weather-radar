import React from 'react';
import { Shield, Clock, MapPin, Play, Square, BellRing, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export interface MonitorSettings {
  radius: number;
  interval: number;
  location?: {
    name: string;
    lat: number;
    lon: number;
  };
}

interface MonitoringViewProps {
  settings: MonitorSettings;
  onSettingsChange: (settings: MonitorSettings) => void;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  lastScanTime: Date | null;
  onSearchLocation: (query: string) => Promise<{ name: string; lat: number; lon: number } | null>;
}

export function MonitoringView({
  settings,
  onSettingsChange,
  isMonitoring,
  onToggleMonitoring,
  lastScanTime,
  onSearchLocation
}: MonitoringViewProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);

  const intervals = [
    { label: '1 Min', value: 1 },
    { label: '5 Min', value: 5 },
    { label: '10 Min', value: 10 },
    { label: '15 Min', value: 15 },
    { label: '30 Min', value: 30 },
    { label: '1 Hour', value: 60 },
  ];

  const radii = [
    { label: '50 Mi', value: 50 },
    { label: '100 Mi', value: 100 },
    { label: '250 Mi', value: 250 },
    { label: '500 Mi', value: 500 },
    { label: '750 Mi', value: 750 },
  ];

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const loc = await onSearchLocation(searchQuery);
      if (loc) {
        onSettingsChange({ ...settings, location: loc });
        setSearchQuery('');
      } else {
        alert("Location not found. Please try a different City or ZIP Code.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Storm Sentry
          </h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-1">Autonomous Perimeter Defense</p>
        </div>
        <button
          onClick={onToggleMonitoring}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg",
            isMonitoring 
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20" 
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
          )}
        >
          {isMonitoring ? (
            <>
              <Square className="w-4 h-4 fill-white" />
              Stop Monitoring
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              Begin Watch
            </>
          )}
        </button>
      </div>

      {/* Target Location Configuration */}
      <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <MapPin className="w-4 h-4" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Target Location</h3>
        </div>
        
        <form onSubmit={handleLocationSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter City or ZIP Code..."
            className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
          >
            {isSearching ? "Searching..." : "Set Location"}
          </button>
        </form>

        <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Active Perimeter Center</span>
            <span className="text-sm font-bold text-zinc-200">
              {settings.location ? settings.location.name : "System Default (Home Location)"}
            </span>
          </div>
          {settings.location && (
            <button 
              onClick={() => onSettingsChange({ ...settings, location: undefined })}
              className="p-1 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 text-[10px] font-bold rounded-lg transition-all"
            >
              Reset to Home
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frequency Control */}
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="w-4 h-4" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Scan Frequency</h3>
          </div>
          <select
            value={settings.interval}
            onChange={(e) => onSettingsChange({ ...settings, interval: parseInt(e.target.value, 10) })}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer"
          >
            {intervals.map((freq) => (
              <option key={freq.value} value={freq.value}>
                Every {freq.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-zinc-500 leading-relaxed italic">
            How often the system will automatically perform a long-range radar sweep.
          </p>
        </div>

        {/* Radius Control */}
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <MapPin className="w-4 h-4" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Watch Perimeter</h3>
          </div>
          <select
            value={settings.radius}
            onChange={(e) => onSettingsChange({ ...settings, radius: parseInt(e.target.value, 10) })}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none cursor-pointer"
          >
            {radii.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} Radius
              </option>
            ))}
          </select>
          <p className="text-[10px] text-zinc-500 leading-relaxed italic">
            The radius around your current location to monitor for significant weather systems.
          </p>
        </div>
      </div>

      {/* Status Card */}
      <div className={cn(
        "p-6 rounded-3xl border transition-all duration-500",
        isMonitoring 
          ? "bg-emerald-950/20 border-emerald-500/30" 
          : "bg-zinc-900/30 border-zinc-800"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isMonitoring ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"
            )} />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {isMonitoring ? "System Armed & Monitoring" : "Sentry Offline"}
            </span>
          </div>
          {lastScanTime && (
            <span className="text-[10px] font-mono text-zinc-600">
              Last sweep: {lastScanTime.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2 text-emerald-500">
              <BellRing className="w-3 h-3" />
              <h4 className="text-[9px] font-black uppercase tracking-widest leading-none">Auto-Alerts</h4>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              When active, Aura will automatically announce significant threats detected within your {settings.radius} mile perimeter.
            </p>
          </div>
          <div className="flex-1 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2 text-sky-500">
              <Info className="w-3 h-3" />
              <h4 className="text-[9px] font-black uppercase tracking-widest leading-none">Voice Integration</h4>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Ensure Voice Interface is enabled in Config for audible background updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
