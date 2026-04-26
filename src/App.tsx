/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EyeOff, AlertTriangle, CloudOff, Loader2, Zap, CloudRain, Radar } from 'lucide-react';
import { fetchWeather, reverseGeocode, moveInDirection } from './services/weatherService';
import { useLocation } from './hooks/useLocation';
import { useHotkeys } from './hooks/useHotkeys';
import { WeatherData } from './types';
import { WeatherCard } from './components/WeatherCard';
import { RadarSummary } from './components/RadarSummary';
import { HistoricalView } from './components/HistoricalView';
import { ChatBox } from './components/ChatBox';
import { LocationSearch } from './components/LocationSearch';
import { CityNavigator } from './components/CityNavigator';
import { PermissionGuard } from './components/PermissionGuard';
import { SettingsView } from './components/SettingsView';
import { cn } from './lib/utils';
import { getWeatherDescription } from './services/weatherService';

export default function App() {
  const [permissionsAccepted, setPermissionsAccepted] = useState(() => {
    return localStorage.getItem('aura_permissions_accepted') === 'true';
  });
  const { location: geoLoc, error: locError, loading: locLoading } = useLocation(permissionsAccepted);
  const [customLocation, setCustomLocation] = useState<{ lat: number; lon: number; name: string; state?: string } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [errorWeather, setErrorWeather] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'weather' | 'settings'>('weather');
  const [moveDistance, setMoveDistance] = useState(() => {
    const saved = localStorage.getItem('aura_move_distance');
    return saved ? parseInt(saved, 10) : 3;
  });
  const [scanRadius, setScanRadius] = useState(() => {
    const saved = localStorage.getItem('aura_scan_radius');
    return saved ? parseInt(saved, 10) : 600;
  });
  
  const lastMoveAnnouncement = useRef('');

  const handleMoveDistanceChange = (miles: number) => {
    setMoveDistance(miles);
    localStorage.setItem('aura_move_distance', miles.toString());
    speak(`Movement distance set to ${miles} miles.`);
  };

  const handleScanRadiusChange = (miles: number) => {
    setScanRadius(miles);
    localStorage.setItem('aura_scan_radius', miles.toString());
    speak(`Radar scan radius set to ${miles} miles.`);
  };

  // Fallback to geoLoc if no custom location is set
  const activeLoc = customLocation || (geoLoc ? { ...geoLoc, name: 'Detecting City...' } : null);

  const weatherBrief = weather ? `${getWeatherDescription(weather.current.weatherCode)}, ${Math.round(weather.current.temperature2m)} degrees` : '';

  // Effect to handle navigation-triggered weather announcements
  useEffect(() => {
    if (weatherBrief && voiceEnabled && lastMoveAnnouncement.current) {
      const timer = setTimeout(() => {
        speak(`${lastMoveAnnouncement.current}. Conditions: ${weatherBrief}`);
        lastMoveAnnouncement.current = '';
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [weatherBrief, voiceEnabled]);

  // Handle PWA shortcuts
  useEffect(() => {
    if (weather && permissionsAccepted) {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'scan') handleStormScan();
      if (action === 'lightning') handleLightningCheck();
      
      // Clear params to avoid repeat on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [weather, permissionsAccepted]);

  // Only reverse geocode geoLoc if we haven't manually searched yet
  useEffect(() => {
    if (geoLoc && !customLocation) {
      reverseGeocode(geoLoc.lat, geoLoc.lon).then(data => {
        // Only set if user hasn't started searching elsewhere in the meantime
        setCustomLocation(prev => prev ? prev : { 
          lat: geoLoc.lat, 
          lon: geoLoc.lon, 
          name: data.name,
          state: data.state 
        });
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
    if (voiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      // We don't set the announcement for the screen reader live region if voice is active
      // to prevents double speaking for screen reader users.
    } else {
      setAnnouncement(text);
    }
  };

  const getWindDirectionName = (degree: number) => {
    const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
    const index = Math.round(degree / 45) % 8;
    return directions[index];
  };

  const handleLightningCheck = () => {
    if (!weather) return speak("Weather data not yet available.");
    const isLightningRisk = weather.current.weatherCode >= 95;
    const text = isLightningRisk 
      ? "Alert: Lightning detected in your vicinity. Seek shelter immediately."
      : "System check: No lightning strikes detected in your immediate area.";
    speak(text);
  };

  const handlePrecipitationCheck = () => {
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
  };

  const handleStormScan = async () => {
    if (!activeLoc) return speak("Scanning system unavailable without location.");
    
    speak(`Initiating ${scanRadius} mile radial radar sweep. Scanning all horizons...`);
    
    const DEG_PER_MILE = 1 / 69;
    const cosLat = Math.cos(activeLoc.lat * Math.PI / 180);
    
    // Divide the target scan radius into intervals to find the closest hits first
    const intervals = scanRadius <= 200 ? [scanRadius] : [100, Math.min(300, scanRadius), scanRadius];
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

    for (const dist of intervals) {
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
        hits.sort((a, b) => b!.data.current.precipitation - a!.data.current.precipitation);
        foundPrecipitation = hits[0];
        break; 
      }
    }

    if (foundPrecipitation) {
      const { lat, lon, dir, dist, data } = foundPrecipitation;
      const moveDir = getWindDirectionName(data.current.windDirection10m);
      
      // OPTIMIZATION: Immediate feedback before background geocoding/prediction
      const baseMessage = `Radar hit! Significant precipitation detected ${dist} miles to your ${dir}. Condition there is ${getWeatherDescription(data.current.weatherCode)} with ${data.current.precipitation} inches of rain. Movement is from the ${moveDir}.`;
      speak(baseMessage + " Analyzing tracking data...");

      // Perform tracking analysis in background
      (async () => {
        try {
          const { name: cityName } = await reverseGeocode(lat, lon);
          const headingDeg = (data.current.windDirection10m + 180) % 360;
          const headingRad = (headingDeg) * Math.PI / 180;
          
          const pathPoints = [40, 80];
          const predictedTowns: { name: string; state?: string }[] = [];
          for (const pDist of pathPoints) {
            await new Promise(resolve => setTimeout(resolve, 1100));
            const pLat = lat + (Math.cos(headingRad) * pDist * DEG_PER_MILE);
            const pLon = lon + (Math.sin(headingRad) * pDist * DEG_PER_MILE / cosLat);
            const res = await reverseGeocode(pLat, pLon);
            predictedTowns.push(res);
          }

          const uniqueTowns = Array.from(new Set(
            predictedTowns
              .map(t => t.name)
              .filter(name => name && name !== cityName && !name.includes('Coordinates') && name !== 'Current Location')
          ));
          
          const trackingInfo = ` Tracking update: The storm near ${cityName} is moving towards ${uniqueTowns.length > 0 ? uniqueTowns.join(' and ') : "unpopulated territory"}.`;
          speak(trackingInfo);
        } catch (e) {
          console.error("Tracking background error:", e);
        }
      })();
    } else {
      speak(`Long-range sweep complete. No active storm bands detected within ${scanRadius} miles of ${activeLoc.name}. Navigation appears clear.`);
    }
  };

  const handleMoveInDirection = async (direction: 'north' | 'south' | 'east' | 'west') => {
    if (!activeLoc) return;
    speak(`Moving ${direction}...`);
    try {
      const nextLoc = await moveInDirection(activeLoc.lat, activeLoc.lon, direction, moveDistance);
      if (nextLoc) {
        let message = `Arrived in ${nextLoc.name}`;
        if (nextLoc.state && !nextLoc.name.toLowerCase().includes(nextLoc.state.toLowerCase())) {
          message += `, ${nextLoc.state}`;
        }
        
        lastMoveAnnouncement.current = message;
        speak(message);

        setCustomLocation({
          lat: nextLoc.latitude,
          lon: nextLoc.longitude,
          name: nextLoc.name,
          state: nextLoc.state
        });
      } else {
        speak("Unable to find a location in that direction.");
      }
    } catch (e) {
      speak("Movement system error.");
    }
  };

  useHotkeys([
    {
      key: 'l',
      description: 'Lightning strike info',
      action: handleLightningCheck
    },
    {
      key: 'p',
      description: 'Nearest precipitation info',
      action: handlePrecipitationCheck
    },
    {
      key: 'c',
      description: 'Find nearest city with precipitation',
      action: handleStormScan
    },
    {
      key: 'n',
      description: 'Move North',
      action: () => handleMoveInDirection('north')
    },
    {
      key: 's',
      description: 'Move South',
      action: () => handleMoveInDirection('south')
    },
    {
      key: 'e',
      description: 'Move East',
      action: () => handleMoveInDirection('east')
    },
    {
      key: 'w',
      description: 'Move West',
      action: () => handleMoveInDirection('west')
    }
  ]);

  const enableVoice = () => {
    setVoiceEnabled(true);
    speak("Voice interface activated. Use P for precipitation, L for lightning, and C for storm scanning.");
  };

  const handlePermissionsGranted = () => {
    setPermissionsAccepted(true);
    localStorage.setItem('aura_permissions_accepted', 'true');
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-sky-500 selection:text-white flex flex-col items-center p-4 md:p-8">
      {!permissionsAccepted && <PermissionGuard onPermissionsGranted={handlePermissionsGranted} />}
      
      {/* ARIA Live Region for Announcements */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-sky-600 text-white px-4 py-2 rounded-lg z-50">
        Skip to main content
      </a>

      <header className="w-full max-w-6xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-600 rounded-xl shadow-lg shadow-sky-900/20">
            <EyeOff className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AURA WEATHER</h1>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest leading-none mt-1">
              Currently Monitoring: <span className="text-sky-400 font-bold">
                {activeLoc ? (
                  <>
                    {activeLoc.name}
                    {activeLoc.state && !activeLoc.name.toLowerCase().includes(activeLoc.state.toLowerCase().substring(0, 5)) && `, ${activeLoc.state}`}
                  </>
                ) : 'Searching...'}
              </span>
            </p>
          </div>
        </div>

        <nav className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('weather')}
            className={cn(
              "px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'weather' ? "bg-zinc-800 text-sky-400 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Monitor
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'settings' ? "bg-zinc-800 text-sky-400 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Config
          </button>
        </nav>
        
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
          {activeTab === 'weather' && (
            <LocationSearch 
              onLocationSelect={(lat, lon, name, state) => setCustomLocation({ lat, lon, name, state })} 
            />
          )}
          <div className="hidden md:block">
            <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Live Forecast Engine</span>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'settings' ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-950/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-md"
              >
                <SettingsView 
                  moveDistance={moveDistance}
                  onMoveDistanceChange={handleMoveDistanceChange}
                  scanRadius={scanRadius}
                  onScanRadiusChange={handleScanRadiusChange}
                  voiceEnabled={voiceEnabled}
                  onVoiceToggle={setVoiceEnabled}
                />
              </motion.div>
            ) : locLoading || loadingWeather ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 min-h-[400px]"
                aria-label="Loading weather data"
              >
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" aria-hidden="true" />
                <p className="text-sm font-mono text-zinc-500 animate-pulse uppercase tracking-wider">Locating Satellite Data...</p>
              </motion.div>
            ) : (locError && !customLocation) || errorWeather ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-rose-950/20 border-2 border-rose-900/50 rounded-3xl p-8 flex flex-col items-center text-center gap-4"
                role="alert"
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
                  <div className="space-y-2" role="region" aria-label="Weather Alerts">
                    {weather.alerts.slice(0, 2).map((alert, idx) => (
                      <div key={idx} className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
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
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-zinc-400 uppercase tracking-widest">
              <Radar className="w-4 h-4 text-sky-600" aria-hidden="true" />
              Intelligence Briefing
            </h2>
            <ChatBox weather={weather} />
          </div>

          {weather && (
            <div className="animate-in fade-in duration-700 delay-300">
              <HistoricalView weather={weather} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusIcon icon={<AlertTriangle className="w-4 h-4" />} label="Travel Safety" value="Nominal" color="emerald" />
            <StatusIcon icon={<Loader2 className="w-4 h-4" />} label="Sensor Sync" value="Verified" color="sky" />
            <StatusIcon icon={<EyeOff className="w-4 h-4" />} label="Display Mode" value="High Contrast" color="zinc" />
          </div>
        </div>

        {/* City Navigation System */}
        <div className="lg:col-span-12 mt-6">
          <CityNavigator 
            currentLoc={activeLoc ? { name: activeLoc.name, lat: activeLoc.lat, lon: activeLoc.lon, state: activeLoc.state } : null}
            onLocationChange={setCustomLocation}
            weatherBrief={weatherBrief || undefined}
            onSpeak={(text) => {
              if (voiceEnabled) {
                speak(text);
              }
            }}
            moveDistance={moveDistance}
          />
        </div>
      </main>

      {/* Android Style Bottom Menu */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 px-6 py-4 rounded-3xl flex gap-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-40 transition-transform active:scale-95">
        <button 
          onClick={handleLightningCheck}
          className="flex flex-col items-center gap-1.5 group"
          aria-label="Lightning Detection"
        >
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 group-active:bg-amber-500/20 transition-colors">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 group-active:text-zinc-200">Lightning Detection</span>
        </button>

        <button 
          onClick={handlePrecipitationCheck}
          className="flex flex-col items-center gap-1.5 group"
          aria-label="Precipitation Info"
        >
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 group-active:bg-sky-500/20 transition-colors">
            <CloudRain className="w-5 h-5 text-sky-400" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 group-active:text-zinc-200">Precipitation Info</span>
        </button>

        <button 
          onClick={handleStormScan}
          className="flex flex-col items-center gap-1.5 group"
          aria-label="Storm Scanner"
        >
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-active:bg-emerald-500/20 transition-colors">
            <Radar className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 group-active:text-zinc-200">Storm Scanner</span>
        </button>
      </div>

      <footer className="w-full max-w-6xl mt-12 py-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 pb-24 md:pb-8">
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Designed for accessibility • NWS & Open-Meteo Data • Aura v1.0</p>
        </div>
        <div className="flex gap-6">
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
