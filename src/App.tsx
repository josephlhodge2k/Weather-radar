/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, AlertTriangle, CloudOff, Loader2, Zap, CloudRain, Radar, Volume2 } from 'lucide-react';
import { fetchWeather, reverseGeocode, moveInDirection } from './services/weatherService';
import { useLocation } from './hooks/useLocation';
import { useHotkeys } from './hooks/useHotkeys';
import { WeatherData } from './types';
import { WeatherCard } from './components/WeatherCard';
import { RadarSummary } from './components/RadarSummary';
import { ChatBox } from './components/ChatBox';
import { LocationSearch } from './components/LocationSearch';
import { CityNavigator } from './components/CityNavigator';
import { PermissionGuard } from './components/PermissionGuard';
import { SettingsView } from './components/SettingsView';
import { MonitoringView, MonitorSettings } from './components/MonitoringView';
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
  const [activeTab, setActiveTab] = useState<'weather' | 'sentry' | 'settings'>('weather');
  const [monitorSettings, setMonitorSettings] = useState<MonitorSettings>(() => {
    const saved = localStorage.getItem('aura_monitor_settings');
    return saved ? JSON.parse(saved) : { radius: 100, interval: 15 };
  });
  const [isMonitoring, setIsMonitoring] = useState(() => {
    return localStorage.getItem('aura_monitoring_active') === 'true';
  });
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [moveDistance, setMoveDistance] = useState(() => {
    const saved = localStorage.getItem('aura_move_distance');
    return saved ? parseInt(saved, 10) : 3;
  });
  const [scanRadius, setScanRadius] = useState(() => {
    const saved = localStorage.getItem('aura_scan_radius');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => {
    return localStorage.getItem('aura_voice_uri') || null;
  });
  const [speechRate, setSpeechRate] = useState(() => {
    const saved = localStorage.getItem('aura_speech_rate');
    return saved ? parseFloat(saved) : 1;
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

  const handleSpeechRateChange = (rate: number) => {
    setSpeechRate(rate);
    localStorage.setItem('aura_speech_rate', rate.toString());
    // Small delay to ensure state is updated before speaking
    setTimeout(() => {
      speak(`Speech rate set to ${rate}.`);
    }, 50);
  };

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        // If no voice is selected, pick a default one (prefer English)
        if (!selectedVoiceURI) {
          // Prefer a clear, common English voice as default
          const defaultVoice = availableVoices.find(v => v.name.includes('Microsoft David') || v.name.includes('Google US English') || v.lang === 'en-US') || 
                               availableVoices.find(v => v.lang.startsWith('en')) || 
                               availableVoices[0];
          if (defaultVoice) {
            setSelectedVoiceURI(defaultVoice.voiceURI);
            localStorage.setItem('aura_voice_uri', defaultVoice.voiceURI);
          }
        }
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleVoiceChange = (uri: string) => {
    setSelectedVoiceURI(uri);
    localStorage.setItem('aura_voice_uri', uri);
    // Brief test of the new voice
    const foundVoice = voices.find(v => v.voiceURI === uri);
    if (foundVoice) {
      const utterance = new SpeechSynthesisUtterance("Voice updated.");
      utterance.voice = foundVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleMonitorSettingsChange = (settings: MonitorSettings) => {
    setMonitorSettings(settings);
    localStorage.setItem('aura_monitor_settings', JSON.stringify(settings));
    const locationMsg = settings.location ? ` centered at ${settings.location.name}` : " at home location";
    speak(`Monitoring perimeter set to ${settings.radius} miles${locationMsg}, updated every ${settings.interval} minutes.`);
  };

  const onMonitorLocationSearch = async (query: string): Promise<{ name: string; lat: number; lon: number } | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'AuraWeatherApp/1.0' } });
      const data = await response.json();
      if (data && data.length > 0) {
        const item = data[0];
        const addr = item.address;
        const name = addr.city || addr.town || addr.village || addr.postcode || item.display_name.split(',')[0];
        return {
          name: `${name}${addr.state ? ', ' + addr.state : ''}`,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon)
        };
      }
    } catch (e) {
      console.error("Monitoring search error:", e);
    }
    return null;
  };

  const toggleMonitoring = () => {
    const newState = !isMonitoring;
    setIsMonitoring(newState);
    localStorage.setItem('aura_monitoring_active', newState.toString());
    if (newState) {
      const locationMsg = monitorSettings.location ? ` near ${monitorSettings.location.name}` : "";
      speak(`Storm Sentry activated. Monitoring a ${monitorSettings.radius} mile radius${locationMsg} every ${monitorSettings.interval} minutes.`);
      // Run first scan immediately
      handleStormScan(monitorSettings.radius, true);
    } else {
      speak("Storm Sentry deactivated.");
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }
    }
  };

  // Setup monitoring interval
  useEffect(() => {
    if (isMonitoring) {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
      
      monitorIntervalRef.current = setInterval(() => {
        handleStormScan(monitorSettings.radius, true);
      }, monitorSettings.interval * 60 * 1000);
    } else {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }
    }

    return () => {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    };
  }, [isMonitoring, monitorSettings.interval, monitorSettings.radius, monitorSettings.location]);

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

  const speak = (text: string, force = false) => {
    // Background monitoring sweeps should always speak if significant, 
    // but users might want to know the system is scanning.
    if ((voiceEnabled || force) && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoiceURI) {
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
      }
      utterance.rate = speechRate;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
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
    const prec = weather.current.precipitation;
    const isSnow = weather.current.weatherCode >= 71 && weather.current.weatherCode <= 86;
    const prob = weather.hourly.precipitationProbability[0];
    const windDir = getWindDirectionName(weather.current.windDirection10m);
    let text = "";
    if (prec > 0) {
      const type = isSnow ? "snowfall" : "rain";
      text = `It is currently ${isSnow ? 'snowing' : 'raining'} with ${prec} inches of ${type}. The weather is moving from the ${windDir}.`;
    } else if (prob > 30) {
      const typeHint = isSnow ? "snowfall" : "precipitation";
      text = `Radar shows ${typeHint} approaching from the ${windDir} with a ${prob} percent probability.`;
    } else {
      text = `The radar is clear within a 50 mile radius. Any incoming weather would likely approach from the ${windDir} based on current wind patterns.`;
    }
    speak(text);
  };

  const handleStormScan = async (overrideRadius?: number, silentIfClear = false) => {
    // If it's a silent scan (from monitoring), check if we have a monitoring-specific location
    const scanLoc = (silentIfClear && monitorSettings.location) ? monitorSettings.location : activeLoc;

    if (!scanLoc) {
      if (!silentIfClear) speak("Scanning system unavailable without location.");
      return;
    }
    
    const radius = overrideRadius || scanRadius;
    if (!silentIfClear) {
      speak(`Initiating ${radius} mile radial radar sweep. Scanning all horizons...`);
    }
    
    setLastScanTime(new Date());

    if (silentIfClear) {
      // In silent mode, we don't announce the START of the scan to avoid constant chatter,
      // but we MUST ensure the results are announced if found.
      console.log(`Storm Sentry performing periodic check for ${scanLoc.name}...`);
    }

    const DEG_PER_MILE = 1 / 69;
    const cosLat = Math.cos(scanLoc.lat * Math.PI / 180);
    
    // Divide the target scan radius into intervals to find the closest hits first
    const intervals: number[] = [];
    for (let d = 50; d <= radius; d += 150) {
      intervals.push(d);
    }
    if (intervals.length === 0 || intervals[intervals.length - 1] !== radius) {
      intervals.push(radius);
    }

    const directions = [
      { name: 'North', dLat: 1, dLon: 0 },
      { name: 'North-North-East', dLat: 0.923, dLon: 0.382 },
      { name: 'North-East', dLat: 0.707, dLon: 0.707 },
      { name: 'East-North-East', dLat: 0.382, dLon: 0.923 },
      { name: 'East', dLat: 0, dLon: 1 },
      { name: 'East-South-East', dLat: -0.382, dLon: 0.923 },
      { name: 'South-East', dLat: -0.707, dLon: 0.707 },
      { name: 'South-South-East', dLat: -0.923, dLon: 0.382 },
      { name: 'South', dLat: -1, dLon: 0 },
      { name: 'South-South-West', dLat: -0.923, dLon: -0.382 },
      { name: 'South-West', dLat: -0.707, dLon: -0.707 },
      { name: 'West-South-West', dLat: -0.382, dLon: -0.923 },
      { name: 'West', dLat: 0, dLon: -1 },
      { name: 'West-North-West', dLat: 0.382, dLon: -0.923 },
      { name: 'North-West', dLat: 0.707, dLon: -0.707 },
      { name: 'North-North-West', dLat: 0.923, dLon: -0.382 }
    ];

    let foundSignificantWeather = null;

    for (const dist of intervals) {
      const scanResults = await Promise.all(directions.map(async (dir) => {
        const scanLat = scanLoc.lat + (dir.dLat * dist * DEG_PER_MILE);
        const scanLon = scanLoc.lon + (dir.dLon * dist * DEG_PER_MILE / cosLat);
        try {
          const data = await fetchWeather(scanLat, scanLon);
          // Check for significant weather:
          // 1. Precipitation (rain/snow)
          // 2. Weather code >= 51 (drizzle/rain/snow/storm)
          // 3. High wind speeds (> 25 mph)
          // 4. Active alerts
          const isSignificant = data.current.precipitation > 0 || 
                               data.current.weatherCode >= 51 || 
                               data.current.windSpeed10m >= 25 ||
                               (data.alerts && data.alerts.length > 0);

          if (isSignificant) {
            return { dist, dir: dir.name, lat: scanLat, lon: scanLon, data };
          }
        } catch (e) { return null; }
        return null;
      }));

      const hits = scanResults.filter(r => r !== null);
      if (hits.length > 0) {
        // Sort by severity: weatherCode first, then precipitation, then wind, then alerts
        hits.sort((a, b) => {
          const alertScoreA = (a!.data.alerts?.length || 0) * 50;
          const alertScoreB = (b!.data.alerts?.length || 0) * 50;
          const scoreA = (a!.data.current.weatherCode * 10) + (a!.data.current.precipitation * 20) + (a!.data.current.windSpeed10m / 5) + alertScoreA;
          const scoreB = (b!.data.current.weatherCode * 10) + (b!.data.current.precipitation * 20) + (b!.data.current.windSpeed10m / 5) + alertScoreB;
          return scoreB - scoreA;
        });
        foundSignificantWeather = hits[0];
        break; 
      }
    }

    if (foundSignificantWeather) {
      const { lat, lon, dir, dist, data } = foundSignificantWeather;
      const moveDir = getWindDirectionName(data.current.windDirection10m);
      
      // Build a more descriptive condition
      let condition = getWeatherDescription(data.current.weatherCode);
      
      // If there's an alert, use the most severe alert event name
      if (data.alerts && data.alerts.length > 0) {
        condition = data.alerts[0].event;
      } else if (data.current.precipitation > 0) {
        const isSnow = data.current.weatherCode >= 71 && data.current.weatherCode <= 86;
        condition = isSnow ? 'Snow' : 'Rain';
        if (data.current.precipitation > 0.1) condition = `Heavy ${condition}`;
      } else if (data.current.windSpeed10m >= 25) {
        condition = 'High Wind';
      }

      const windInfo = data.current.windSpeed10m > 25 ? ` with surface winds of ${Math.round(data.current.windSpeed10m)} mph` : '';
      
      // OPTIMIZATION: Immediate feedback before background geocoding/prediction
      const baseMessage = `Radar hit! Significant weather detected ${dist} miles to your ${dir}. Condition there is ${condition}${windInfo}. Movement is from the ${moveDir}.`;
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
              .filter(name => {
                if (!name || name === 'Current Location') return false;
                if (name === cityName) return false;
                if (name.includes('Region at')) return false;
                // If it's a generic water body and we're already "near" that water body, skip it
                if (cityName.includes(name) || name.includes(cityName)) return false;
                return true;
              })
          ));
          
          let movementDest = '';
          if (uniqueTowns.length > 0) {
            movementDest = `moving towards ${uniqueTowns.join(' and ')}`;
          } else {
            // Determine if destination is likely water or wilderness based on hit location name
            const isWater = cityName.toLowerCase().includes('ocean') || 
                          cityName.toLowerCase().includes('sea') || 
                          cityName.toLowerCase().includes('lake') ||
                          cityName.toLowerCase().includes('bay') ||
                          cityName.toLowerCase().includes('gulf');
            
            movementDest = isWater ? 'moving further out over open water' : 'moving into remote geographic areas';
          }

          const trackingInfo = ` Tracking update: The ${condition.toLowerCase()} system near ${cityName} is ${movementDest}.`;
          speak(trackingInfo);
        } catch (e) {
          console.error("Tracking background error:", e);
        }
      })();
    } else {
      if (!silentIfClear) {
        speak(`Long-range sweep complete. No active storm bands detected within ${radius} miles of ${scanLoc.name}. Navigation appears clear.`);
      }
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
      action: () => handleStormScan()
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

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    if (newState) {
      speak("Voice interface activated. Use P for precipitation, L for lightning, and C for storm scanning.");
    } else {
      window.speechSynthesis.cancel();
    }
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
                    {activeLoc.state && activeLoc.state.toLowerCase() !== activeLoc.name.toLowerCase() && (
                      <span className="opacity-70">, {activeLoc.state}</span>
                    )}
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
            Home
          </button>
          <button
            onClick={() => setActiveTab('sentry')}
            className={cn(
              "px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'sentry' ? "bg-zinc-800 text-sky-400 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Background Storm Monitoring
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
          <button 
            onClick={toggleVoice}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg",
              voiceEnabled 
                ? "bg-zinc-900 border border-emerald-500 text-emerald-400 shadow-emerald-900/10" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", voiceEnabled ? "bg-emerald-500 animate-pulse" : "bg-white")} />
            {voiceEnabled ? "Voice Active" : "Enable Voice Interface"}
          </button>
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

      <main id="main-content" className="w-full max-w-4xl mx-auto flex flex-col gap-6">
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'settings' ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-zinc-950/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-md"
              >
                <SettingsView 
                  moveDistance={moveDistance}
                  onMoveDistanceChange={handleMoveDistanceChange}
                  scanRadius={scanRadius}
                  onScanRadiusChange={handleScanRadiusChange}
                  voiceEnabled={voiceEnabled}
                  onVoiceToggle={setVoiceEnabled}
                  voices={voices}
                  selectedVoiceURI={selectedVoiceURI}
                  onVoiceSelect={handleVoiceChange}
                  speechRate={speechRate}
                  onSpeechRateChange={handleSpeechRateChange}
                />
              </motion.div>
            ) : activeTab === 'sentry' ? (
              <motion.div
                key="sentry"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-zinc-950/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-md"
              >
                <MonitoringView 
                  settings={monitorSettings}
                  onSettingsChange={handleMonitorSettingsChange}
                  isMonitoring={isMonitoring}
                  onToggleMonitoring={toggleMonitoring}
                  lastScanTime={lastScanTime}
                  onSearchLocation={onMonitorLocationSearch}
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
                {weather && (
                  <>
                    <WeatherCard weather={weather} />
                    <RadarSummary weather={weather} />
                    <div className="mt-8">
                      <ChatBox weather={weather} />
                    </div>
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* City Navigation System */}
        {activeTab === 'weather' && (
          <div className="mt-6">
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
        )}
      </main>

      {/* Android Style Bottom Menu */}
      {activeTab === 'weather' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 px-6 py-4 rounded-3xl flex gap-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-40 transition-transform active:scale-95 text-center">
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
            onClick={() => handleStormScan()}
            className="flex flex-col items-center gap-1.5 group"
            aria-label="Storm Scanner"
          >
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-active:bg-emerald-500/20 transition-colors">
              <Radar className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 group-active:text-zinc-200">Storm Scanner</span>
          </button>
        </div>
      )}

      <footer className="w-full max-w-6xl mt-12 py-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 pb-24 md:pb-8">
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Designed for accessibility • NWS & Open-Meteo Data • Aura v1.0</p>
        </div>
        <div className="flex gap-6">
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
