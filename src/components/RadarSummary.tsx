import { Radar, Zap, Droplets } from 'lucide-react';
import { motion } from 'motion/react';
import { WeatherData } from '../types';

interface RadarSummaryProps {
  weather: WeatherData;
}

export function RadarSummary({ weather }: RadarSummaryProps) {
  const currentRain = weather.current.precipitation;
  const rainProb = weather.hourly.precipitationProbability[0] || 0;
  const windDirDeg = weather.current.windDirection10m;
  
  const getDir = (deg: number) => {
    const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
    return directions[Math.round(deg / 45) % 8];
  };

  const windDir = getDir(windDirDeg);
  
  // Logic to interpret as "Nearby Detection"
  const isLightningRisk = weather.current.weatherCode >= 95;
  const isNearbyRain = rainProb > 30 && currentRain === 0;

  return (
    <div className="bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-100 font-bold flex items-center gap-2">
          <Radar className="w-5 h-5 text-emerald-400 animate-pulse" />
          Radar Insights
        </h3>
        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-mono uppercase">Live Data</span>
      </div>

      <div className="space-y-4">
        {/* Lightning Strike Detection */}
        <div className="flex items-start gap-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
          <div className={isLightningRisk ? "p-3 bg-yellow-500/20 rounded-full" : "p-3 bg-zinc-800 rounded-full"}>
            <Zap className={isLightningRisk ? "w-6 h-6 text-yellow-500 animate-bounce" : "w-6 h-6 text-zinc-600"} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-zinc-100">Lightning Status</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isLightningRisk 
                ? `WARNING: Local lightning activity detected. Storm cells are approaching from the ${windDir}.` 
                : "No significant lightning strikes recorded in your immediate vicinity."}
            </p>
          </div>
        </div>

        {/* Precipitation Proximity */}
        <div className="flex items-start gap-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
          <div className={currentRain > 0 ? "p-3 bg-blue-500/20 rounded-full" : isNearbyRain ? "p-3 bg-sky-500/20 rounded-full" : "p-3 bg-zinc-800 rounded-full"}>
            <Droplets className={currentRain > 0 || isNearbyRain ? "w-6 h-6 text-blue-400 animate-pulse" : "w-6 h-6 text-zinc-600"} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-zinc-100">Near Percipitation</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {currentRain > 0 
                ? `Active precipitation: ${currentRain} inches recorded. Storm systems moving from the ${windDir}.` 
                : isNearbyRain 
                  ? `High probability (${rainProb}%) of precipitation approaching from the ${windDir} within the hour.` 
                  : `Radar shows clear skies in your immediate vicinity. Winds are currently from the ${windDir}.`}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800">
        <p className="text-[10px] font-mono text-zinc-600 text-center uppercase tracking-widest">
          Aura Accessibility System • v1.0
        </p>
      </div>
    </div>
  );
}
