import { CloudRain, Wind, Thermometer, CloudLightning, Sun, Cloud, Snowflake } from 'lucide-react';
import { motion } from 'framer-motion';
import { WeatherData } from '../types';
import { getWeatherDescription } from '../services/weatherService';

interface WeatherCardProps {
  weather: WeatherData;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  const getIcon = (code: number) => {
    if (code >= 95) return <CloudLightning className="w-12 h-12 text-yellow-400" />;
    if (code >= 85) return <Snowflake className="w-12 h-12 text-white" />;
    if (code >= 80) return <CloudRain className="w-12 h-12 text-blue-400" />;
    if (code >= 71) return <Snowflake className="w-12 h-12 text-slate-200" />;
    if (code >= 61) return <CloudRain className="w-12 h-12 text-blue-300" />;
    if (code >= 51) return <CloudRain className="w-12 h-12 text-blue-200" />;
    if (code >= 3) return <Cloud className="w-12 h-12 text-zinc-400" />;
    if (code <= 2) return <Sun className="w-12 h-12 text-orange-400" />;
    return <Sun className="w-12 h-12 text-zinc-400" />;
  };

  const isStormy = weather.current.weatherCode >= 95;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-8 relative overflow-hidden"
    >
      {/* Decorative pulse for storm warning */}
      {isStormy && (
        <motion.div 
          animate={{ opacity: [0, 0.2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-yellow-500/10 pointer-events-none"
        />
      )}

      <div className="flex flex-col items-center gap-6">
        <div 
          role="img" 
          aria-label={getWeatherDescription(weather.current.weatherCode)}
          className="p-4 bg-zinc-900 rounded-full"
        >
          {getIcon(weather.current.weatherCode)}
        </div>

        <div className="text-center space-y-1">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.3em]">Analysis</p>
          <h2 className="text-3xl font-bold text-zinc-100 uppercase tracking-tight">{getWeatherDescription(weather.current.weatherCode)}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <DetailItem 
            icon={<Thermometer className="w-5 h-5 text-rose-400" />} 
            label="Temp" 
            value={`${Math.round(weather.current.temperature2m)}°F`} 
            alt={`Temperature is ${Math.round(weather.current.temperature2m)} degrees fahrenheit`}
          />
          <DetailItem 
            icon={<Thermometer className="w-5 h-5 text-orange-400" />} 
            label="Feels Like" 
            value={`${Math.round(weather.current.apparentTemperature)}°F`} 
            alt={`Feels like temperature is ${Math.round(weather.current.apparentTemperature)} degrees fahrenheit`}
          />
          <DetailItem 
            icon={<Wind className="w-5 h-5 text-sky-400" />} 
            label="Wind" 
            value={`${Math.round(weather.current.windSpeed10m)} mph`} 
            alt={`Wind speed is ${Math.round(weather.current.windSpeed10m)} miles per hour`}
          />
          <DetailItem 
            icon={<CloudRain className="w-5 h-5 text-blue-400" />} 
            label="Percip." 
            value={`${weather.current.precipitation} in`} 
            alt={`Precipitation is ${weather.current.precipitation} inches`}
          />
          <DetailItem 
            icon={<CloudRain className="w-5 h-5 text-zinc-500 opacity-50" />} 
            label="Humidity" 
            value={`${weather.current.relativeHumidity2m}%`} 
            alt={`Relative humidity is ${weather.current.relativeHumidity2m} percent`}
          />
        </div>
      </div>
    </motion.div>
  );
}

function DetailItem({ icon, label, value, alt }: { icon: React.ReactNode, label: string, value: string, alt: string }) {
  return (
    <div 
      className="bg-zinc-900 p-4 rounded-2xl flex flex-col gap-1 border border-zinc-800"
      aria-label={alt}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-tighter">{label}</span>
      </div>
      <span className="text-xl font-bold text-zinc-100">{value}</span>
    </div>
  );
}
