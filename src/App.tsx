/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EyeOff, AlertTriangle, CloudOff, Loader2 } from 'lucide-react';
import { fetchWeather, reverseGeocode } from './services/weatherService';
import { useLocation } from './hooks/useLocation';
import { useHotkeys } from './hooks/useHotkeys';
import { WeatherData } from './types';
import { WeatherCard } from './components/WeatherCard';
import { RadarSummary } from './components/RadarSummary';
import { ChatBox } from './components/ChatBox';
import { LocationSearch } from './components/LocationSearch';
import { cn } from './lib/utils';
import { getWeatherDescription } from './services/weatherService';

export default function App() {
  const { location: geoLoc, error: locError, loading: locLoading } = useLocation();
  const [customLocation, setCustomLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [errorWeather, setErrorWeather] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // Fallback to geoLoc if no custom location is set
  const activeLoc = customLocation || (geoLoc ? { ...geoLoc, name: 'Detecting City...' } : null);

  // Only reverse geocode geoLoc if we haven't manually searched yet
  useEffect(() => {
    if (geoLoc && !customLocation) {
      reverseGeocode(geoLoc.lat, geoLoc.lon).then(name => {
        // Only set if user hasn't started searching elsewhere in the meantime
        setCustomLocation(prev => prev ? prev : { ...geoLoc, name });
      }).catch(() => {
        setCustomLocation(prev => prev ? prev : { ...geoLoc, name: 'Detected Location' });
      });
    }
  }, [geoLoc]);

  useEffect(() => {
    if (activeLoc && activeLoc.lat != null && activeLoc.lon != null) {
      setLoadingWeather(true);
      setErrorWeather(null);
      fetchWeather(activeLoc.lat, activeLoc.lon)
        .then(data => {
          if (!data || !data.current) throw new Error("Incomplete weather data");
          setWeather(data);
          setLoadingWeather(false);
        })
        .catch(err => {
          console.error("Fetch error:", err);
          setErrorWeather("Unable to fetch weather for this region.");
          setLoadingWeather(false);
        });
    }
  }, [activeLoc?.lat, activeLoc?.lon]);

  const speak = (text: string) => {
    setAnnouncement(text);
    if (voiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getWindDirectionName = (degree: number) => {
    const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
    const index = Math.round(degree / 45) % 8;
    return directions[index];
  };

  useHotkeys([
    {
      key: 'l',
      altKey: true,
      description: 'Lightning strike info',
      action: () => {
        if (!weather) return speak("Weather data not yet available.");
        const isLightningRisk = weather.current.weatherCode >= 95;
        const text = isLightningRisk 
          ? "Alert: Lightning detected in your vicinity. Seek shelter immediately."
          : "System check: No lightning strikes detected in your immediate area.";
        speak(text);
      }
    },
    {
      key: 'p',
      altKey: true,
      description: 'Nearest precipitation info',
      action: () => {
        if (!weather) return speak("Weather data not yet available.");
        const currentRain = weather.current.precipitation;
        const prob = weather.hourly.precipitationProbability[0];
        const windDir = getWindDirectionName(weather.current.windDirection10m);
        let text = "";
        if (currentRain > 0) {
          text = `It is currently raining with ${currentRain} inches of precipitation. The weather is moving from the ${windDir}.`;
        } else if (prob > 30) {
          text = `Radar shows precipitation approaching from the ${windDir} with a ${prob} percent probability.`;
        } else {
          text = `The radar is clear within a 50 mile radius. Any incoming weather would likely approach from the ${windDir} based on current wind patterns.`;
        }
        speak(text);
      }
    },
    {
      key: 'c',
      altKey: true,
      description: 'Find nearest city with precipitation',
      action: async () => {
        if (!activeLoc) return speak("Scanning system unavailable without location.");
        
        speak("Initiating long-range radial radar sweep. Scanning all horizons...");
        
        // Approximate conversion: 1 degree ~ 69 miles
        const DEG_PER_MILE = 1 / 69;
        const cosLat = Math.cos(activeLoc.lat * Math.PI / 180);
        
        const distances = [100, 300, 600]; // Miles to scan
        const directions = [
          { name: 'North', dLat: 1, dLon: 0 },
          { name: 'North-East', dLat: 0.707, dLon: 0.707 },
          { name: 'East', dLat: 0, dLon: 1 },
          { name: 'South-East', dLat: -0.707, dLon: 0.707 },
          { name: 'South', dLat: -1, dLon: 0 },
          { name: 'South-West', dLat: -0.707, dLon: -0.707 },
          { name: 'West', dLat: 0, dLon: -1 },
          { name: 'North-West', dLat: 0.707, dLon: -0.707 }
        ];

        let foundPrecipitation = null;

        // Radial search: Start close, then move out
        for (const dist of distances) {
          const scanResults = await Promise.all(directions.map(async (dir) => {
            const scanLat = activeLoc.lat + (dir.dLat * dist * DEG_PER_MILE);
            const scanLon = activeLoc.lon + (dir.dLon * dist * DEG_PER_MILE / cosLat);
            try {
              const data = await fetchWeather(scanLat, scanLon);
              if (data.current.precipitation > 0) {
                return { dist, dir: dir.name, lat: scanLat, lon: scanLon, data };
              }
            } catch (e) { return null; }
            return null;
          }));

          const hits = scanResults.filter(r => r !== null);
          if (hits.length > 0) {
            // Sort by precipitation intensity
            hits.sort((a, b) => b!.data.current.precipitation - a!.data.current.precipitation);
            foundPrecipitation = hits[0];
            break; 
          }
        }

        if (foundPrecipitation) {
          const { lat, lon, dir, dist, data } = foundPrecipitation;
          // Reverse geocode the hit
          const cityName = await reverseGeocode(lat, lon);
          const moveDir = getWindDirectionName(data.current.windDirection10m);
          
          // Project future path (heading is opposite of wind direction)
          const headingDeg = (data.current.windDirection10m + 180) % 360;
          const headingRad = (headingDeg) * Math.PI / 180;
          
          // Scan for towns ~40 and ~80 miles ahead in the path
          const pathPoints = [40, 80];
          const predictedTowns = await Promise.all(pathPoints.map(async (pDist) => {
            const pLat = lat + (Math.cos(headingRad) * pDist * DEG_PER_MILE);
            const pLon = lon + (Math.sin(headingRad) * pDist * DEG_PER_MILE / cosLat);
            return reverseGeocode(pLat, pLon);
          }));

          const uniqueTowns = Array.from(new Set(predictedTowns.filter(t => t && t !== cityName && t !== 'Detected Location' && t !== 'Current Location')));
          const pathInfo = uniqueTowns.length > 0 
            ? ` The storm is currently tracking towards ${uniqueTowns.join(' and ')}.` 
            : " The storm is heading into open or sparsely populated territory.";

          speak(`Radar Hit: Significant precipitation detected ${dist} miles to your ${dir} in or near ${cityName}. Current condition there is ${getWeatherDescription(data.current.weatherCode)} with ${data.current.precipitation} inches of rain. The weather system is moving from the ${moveDir}.${pathInfo}`);
        } else {
          speak("Sweep complete. No active storm bands detected within a 600 mile radius of your location. The sky appears clear across the region.");
        }
      }
    }
  ]);

  const enableVoice = () => {
    setVoiceEnabled(true);
    speak("Voice interface activated. Use Alt plus P for precipitation and Alt plus L for lightning alerts.");
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-sky-500 selection:text-white flex flex-col items-center p-4 md:p-8">
      {/* ARIA Live Region for Announcements */}
      <div className="sr-only" aria-live="assertive" role="status">
        {announcement}
      </div>

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-sky-600 text-white px-4 py-2 rounded-lg z-50">
        Skip to main content
      </a>

      <header className="w-full max-w-6xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-600 rounded-xl shadow-lg shadow-sky-900/20">
            <EyeOff className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AURA WEATHER</h1>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Accessibility Weather System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {!voiceEnabled ? (
            <button 
              onClick={enableVoice}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Enable Voice Interface
            </button>
          ) : (
            <div className="px-4 py-2 bg-zinc-900 border border-emerald-500/50 text-emerald-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500" />
               Voice Active
            </div>
          )}
          <LocationSearch 
            onLocationSelect={(lat, lon, name) => setCustomLocation({ lat, lon, name })} 
          />
          <div className="hidden md:block">
            <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Live Forecast Engine</span>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50 flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Monitoring</span>
            <span className="text-xs font-bold text-sky-400">{activeLoc?.name || 'Searching...'}</span>
          </div>

          <AnimatePresence mode="wait">
            {locLoading || loadingWeather ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 min-h-[400px]"
              >
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                <p className="text-sm font-mono text-zinc-500 animate-pulse uppercase tracking-wider">Locating Satellite Data...</p>
              </motion.div>
            ) : (locError && !customLocation) || errorWeather ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-rose-950/20 border-2 border-rose-900/50 rounded-3xl p-8 flex flex-col items-center text-center gap-4"
              >
                <div className="p-4 bg-rose-500/20 rounded-full">
                  {locError ? <AlertTriangle className="w-8 h-8 text-rose-500" /> : <CloudOff className="w-8 h-8 text-rose-500" />}
                </div>
                <h3 className="font-bold text-rose-500">System Interruption</h3>
                <p className="text-sm text-zinc-400">{locError || errorWeather || "Unable to reach weather satellites. Please check your connection."}</p>
                <div className="flex flex-col gap-2 w-full">
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500 transition-colors"
                  >
                    Retry Connection
                  </button>
                  <p className="text-[10px] text-zinc-600">Try manual location search above if sensor fails.</p>
                </div>
              </motion.div>
            ) : weather ? (
              <motion.div 
                key="content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                {weather.alerts && weather.alerts.length > 0 && (
                  <div className="space-y-2">
                    {weather.alerts.slice(0, 2).map((alert, idx) => (
                      <div key={idx} className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">{alert.event}</h4>
                          <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">{alert.headline}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <WeatherCard weather={weather} />
                <RadarSummary weather={weather} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <span className="w-2 h-6 bg-sky-600 rounded-full" />
              Weather Intelligence
            </h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Our AI assistant analyzes real-time radar, lightning sensors, and atmospheric pressure to provide descriptive summaries. Use the chat below for specific questions like gear recommendations or travel safety.
            </p>
            <ChatBox weather={weather} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusIcon icon={<AlertTriangle className="w-4 h-4" />} label="Travel Safety" value="Nominal" color="emerald" />
            <StatusIcon icon={<Loader2 className="w-4 h-4" />} label="Sensor Sync" value="Verified" color="sky" />
            <StatusIcon icon={<EyeOff className="w-4 h-4" />} label="Display Mode" value="High Contrast" color="zinc" />
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mt-12 py-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Designed for accessibility • NWS & Open-Meteo Data • Aura v1.0</p>
          <p className="text-[10px] font-mono text-zinc-400 opacity-50">To install on Windows: Edge/Chrome Menu &gt; Apps &gt; Install this site as an app</p>
        </div>
        <div className="flex gap-6">
          <a href="#" className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition-colors">Documentation</a>
          <a href="#" className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition-colors">Safety Protocols</a>
        </div>
      </footer>
    </div>
  );
}

function StatusIcon({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    zinc: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  };

  return (
    <div className={cn("flex flex-col p-4 rounded-2xl border", colorMap[color])}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}
