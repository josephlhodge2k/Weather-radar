import { WeatherData } from '../types';

const USER_AGENT = 'AuraWeatherApp/1.0 (josephlhodge@gmail.com)';

// Helper to check if a response is from NWS and successful
async function tryNWS(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    // 1. Get metadata for point
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!pointRes.ok) return null; // Outside US or service down
    
    const pointData = await pointRes.json();
    const forecastUrl = pointData.properties.forecastHourly || pointData.properties.forecast;
    const observationStationsUrl = pointData.properties.observationStations;

    // 2. We need "Current", "Hourly/Forecast", and "Alerts"
    // To get the most "current" data, we look at the latest observation
    const [obsStationsRes, forecastRes, alertsRes] = await Promise.all([
      fetch(observationStationsUrl, { headers: { 'User-Agent': USER_AGENT } }),
      fetch(forecastUrl, { headers: { 'User-Agent': USER_AGENT } }),
      fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { 
        headers: { 'User-Agent': USER_AGENT } 
      })
    ]);

    if (!obsStationsRes.ok || !forecastRes.ok) return null;

    const obsStationsData = await obsStationsRes.json();
    const firstStationUrl = obsStationsData.features[0]?.id;
    if (!firstStationUrl) return null;

    const [latestObsRes, forecastData, alertsData] = await Promise.all([
      fetch(`${firstStationUrl}/observations/latest`, { headers: { 'User-Agent': USER_AGENT } }),
      forecastRes.json(),
      alertsRes.ok ? alertsRes.json() : { features: [] }
    ]);

    if (!latestObsRes.ok) return null;
    const latestObsData = await latestObsRes.json();
    const obs = latestObsData.properties;
    const periods = forecastData.properties.periods;

    const alerts = alertsData.features.map((f: any) => ({
      event: f.properties.event,
      headline: f.properties.headline,
      description: f.properties.description,
      severity: f.properties.severity,
      certainty: f.properties.certainty,
      instruction: f.properties.instruction
    }));

    // Map NWS to our WeatherData interface
    // NWS values are often in Celsius, we need to handle or trust they are consistent
    const tempF = obs.temperature?.value ? (obs.temperature.value * 9/5 + 32) : (periods[0]?.temperature || 70);
    
    return {
      latitude: lat,
      longitude: lon,
      current: {
        temperature2m: Math.round(tempF),
        relativeHumidity2m: Math.round(obs.relativeHumidity?.value || 0),
        apparentTemperature: Math.round(obs.heatIndex?.value || tempF), 
        isDay: periods[0]?.isDaytime ?? true,
        precipitation: (obs.precipitationLastHour?.value || 0) / 25.4, // mm to inches
        rain: (obs.textDescription || '').toLowerCase().includes('rain') ? 0.1 : 0, 
        showers: (obs.textDescription || '').toLowerCase().includes('showers') ? 0.1 : 0,
        snowfall: 0,
        weatherCode: mapNWSToCode(obs.textDescription || ''),
        windSpeed10m: Math.round((obs.windSpeed?.value || 0) * 0.621371), // km/h to mph
        windDirection10m: obs.windDirection?.value || 0,
      },
      hourly: {
        time: periods.slice(0, 24).map((p: any) => p.startTime),
        precipitationProbability: periods.slice(0, 24).map((p: any) => p.probabilityOfPrecipitation?.value || 0),
      },
      alerts
    };
  } catch (e) {
    console.error("NWS Fetch Error:", e);
    return null;
  }
}

function mapNWSToCode(desc: string): number {
  const d = desc.toLowerCase();
  if (d.includes('thunderstorm')) return 95;
  if (d.includes('heavy rain')) return 65;
  if (d.includes('rain')) return 63;
  if (d.includes('drizzle')) return 51;
  if (d.includes('snow')) return 73;
  if (d.includes('fog')) return 45;
  if (d.includes('cloudy')) return 3;
  if (d.includes('partly')) return 2;
  if (d.includes('clear') || d.includes('fair')) return 0;
  return 1;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  // Try NWS first for US users
  const nwsData = await tryNWS(lat, lon);
  if (nwsData) return nwsData;

  // Fallback to Open-Meteo
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch weather data');
  
  const data = await response.json();
  
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    current: {
      temperature2m: data.current.temperature_2m,
      relativeHumidity2m: data.current.relative_humidity_2m,
      apparentTemperature: data.current.apparent_temperature,
      isDay: data.current.is_day === 1,
      precipitation: data.current.precipitation,
      rain: data.current.rain,
      showers: data.current.showers,
      snowfall: data.current.snowfall,
      weatherCode: data.current.weather_code,
      windSpeed10m: data.current.wind_speed_10m,
      windDirection10m: data.current.wind_direction_10m,
    },
    hourly: {
      time: data.hourly.time,
      precipitationProbability: data.hourly.precipitation_probability,
    }
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  // Use Nominatim (OSM) for reverse geocoding
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  try {
    const response = await fetch(url, { 
      headers: { 
        'Accept-Language': 'en',
        'User-Agent': 'AuraWeatherApp/1.0' 
      } 
    });
    if (!response.ok) throw new Error('Reverse geocoding failed');
    const data = await response.json();
    const addr = data.address;
    
    // Prefer city-level names, then fallback to county/state
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb;
    const county = addr.county;
    const state = addr.state;
    const country = addr.country;

    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (county && state) return `${county}, ${state}`;
    if (county) return county;
    if (state) return state;
    if (country) return country;
    
    return 'Detected Location';
  } catch (e) {
    console.error('Reverse Geocode Error:', e);
    return 'Current Location';
  }
}

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  
  const response = await fetch(url);
  if (!response.ok) return [];
  
  const data = await response.json();
  return data.results || [];
}

// Open-Meteo Weather Codes interpretation for screen readers
export function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return descriptions[code] || 'Unknown weather conditions';
}
