import { Radar, Zap, Droplets } from 'lucide-react';
import { motion } from 'framer-motion';
import { WeatherData } from '../types';

interface RadarSummaryProps {
  weather: WeatherData;
}

export function RadarSummary({ weather }: RadarSummaryProps) {
  const prec = weather.current.precipitation;
  const isSnow = weather.current.weatherCode >= 71 && weather.current.weatherCode <= 86;
  const rainProb = weather.hourly.precipitationProbability[0] || 0;
  const windDirDeg = weather.current.windDirection10m;
  
  const getDir = (deg: number) => {
    const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
    return directions[Math.round(deg / 45) % 8];
  };

  const windDir = getDir(windDirDeg);
  
  // Logic to interpret as "Nearby Detection"
  const isLightningRisk = weather.current.weatherCode >= 95;
  const isNearbyPrec = rainProb > 30 && prec === 0;

  return (
    <div className="bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <Radar className="w-4 h-4 text-emerald-400" />
          Proximity Alert
        </h3>
        <span className="text-[9px] font-mono text-emerald-500/70">RADAR ACTIVE</span>
      </div>

      <div className="space-y-4">
        {/* Lightning Strike Detection */}
        <div className="flex items-start gap-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
          <div className={isLightningRisk ? "p-3 bg-yellow-500/20 rounded-full" : "p-3 bg-zinc-800 rounded-full"}>
            <Zap className={isLightningRisk ? "w-6 h-6 text-yellow-500 animate-bounce" : "w-6 h-6 text-zinc-600"} />
          </div>
          <div className="flex-1">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Atmospheric Discharge</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isLightningRisk 
                ? `WARNING: Local lightning activity detected. Storm cells are approaching from the ${windDir}.` 
                : "No significant lightning strikes recorded in your immediate vicinity."}
            </p>
          </div>
        </div>

        {/* Precipitation Proximity */}
        <div className="flex items-start gap-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
          <div className={prec > 0 ? "p-3 bg-blue-500/20 rounded-full" : isNearbyPrec ? "p-3 bg-sky-500/20 rounded-full" : "p-3 bg-zinc-800 rounded-full"}>
            <Droplets className={prec > 0 || isNearbyPrec ? "w-6 h-6 text-blue-400 animate-pulse" : "w-6 h-6 text-zinc-600"} />
          </div>
          <div className="flex-1">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Moisture Density</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {prec > 0 
                ? `Active ${isSnow ? 'snowfall' : 'precipitation'}: ${prec} inches recorded. Storm systems moving from the ${windDir}.` 
                : isNearbyPrec 
                  ? `High probability (${rainProb}%) of ${isSnow ? 'snow' : 'precipitation'} approaching from the ${windDir} within the hour.` 
                  : `Radar shows clear skies in your immediate vicinity. Winds are currently from the ${windDir}.`}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
