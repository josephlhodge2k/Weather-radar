import { WeatherData } from '../types';

const USER_AGENT = 'AuraWeatherApp/1.0 (josephlhodge@gmail.com)';

const STATE_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

async function tryNWS(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    // 1. Get metadata for point
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Accept': 'application/geo+json'
      }
    }).catch(err => {
      console.warn("NWS Points call connection error:", err);
      return null;
    });
    
    if (!pointRes || !pointRes.ok) return null; // Outside US or service down
    
    const pointData = await pointRes.json();

    // 2. We need "Current", "Hourly/Forecast", and "Alerts"
    const dailyForecastUrl = pointData.properties.forecast;
    const hourlyForecastUrl = pointData.properties.forecastHourly;
    const observationStationsUrl = pointData.properties.observationStations;

    if (!dailyForecastUrl || !hourlyForecastUrl || !observationStationsUrl) return null;

    const fetchOptions = { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' } };

    const [obsStationsRes, dailyRes, hourlyRes, alertsRes] = await Promise.all([
      fetch(observationStationsUrl, fetchOptions).catch(() => null),
      fetch(dailyForecastUrl, fetchOptions).catch(() => null),
      fetch(hourlyForecastUrl, fetchOptions).catch(() => null),
      fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, fetchOptions).catch(() => null)
    ]);


    if (!obsStationsRes?.ok || !dailyRes?.ok || !hourlyRes?.ok) return null;

    const obsStationsData = await obsStationsRes.json();
    const firstStationUrl = obsStationsData.features[0]?.id;
    if (!firstStationUrl) return null;

    const [latestObsRes, dailyForecastData, hourlyForecastData, alertsData] = await Promise.all([
      fetch(`${firstStationUrl}/observations/latest`, fetchOptions).catch(() => null),
      dailyRes.json(),
      hourlyRes.json(),
      alertsRes && alertsRes.ok ? alertsRes.json() : { features: [] }
    ]);

    if (!latestObsRes?.ok) return null;
    const latestObsData = await latestObsRes.json();
    const obs = latestObsData.properties;
    
    const dailyPeriods = dailyForecastData.properties.periods;
    const hourlyPeriods = hourlyForecastData.properties.periods;

    const alerts = alertsData.features.map((f: any) => ({
      event: f.properties.event,
      headline: f.properties.headline,
      description: f.properties.description,
      severity: f.properties.severity,
      certainty: f.properties.certainty,
      instruction: f.properties.instruction
    }));

    const toF = (c: number | null | undefined) => (c !== null && c !== undefined) ? (c * 9/5 + 32) : null;

    const tempF = toF(obs.temperature?.value) || (hourlyPeriods[0]?.temperature || 70);
    const heatIndexF = toF(obs.heatIndex?.value);
    const windChillF = toF(obs.windChill?.value);
    const apparentTempF = heatIndexF || windChillF || tempF;
    
    // Group NWS daily periods (day/night) into single days if possible, or just take the daytime ones
    // NWS "daily" forecast usually gives ~14 periods (7 days, day and night each)
    const dailyTimes: string[] = [];
    const dailyMaxes: number[] = [];
    const dailyMins: number[] = [];
    const dailyPrecSum: number[] = [];
    const dailyCodes: number[] = [];

    for (let i = 0; i < dailyPeriods.length; i++) {
        const p = dailyPeriods[i];
        if (p.isDaytime) {
            dailyTimes.push(p.startTime.split('T')[0]);
            dailyMaxes.push(p.temperature);
            dailyCodes.push(mapNWSToCode(p.shortForecast));
            dailyPrecSum.push(0); // NWS doesn't give a simple "sum" in this format easily
            
            // Try to find matching night for min
            const nextP = dailyPeriods[i+1];
            if (nextP && !nextP.isDaytime) {
                dailyMins.push(nextP.temperature);
            } else {
                dailyMins.push(p.temperature - 15); // Fallback
            }
        }
    }

    return {
      latitude: lat,
      longitude: lon,
      current: {
        temperature2m: Math.round(tempF),
        relativeHumidity2m: Math.round(obs.relativeHumidity?.value || 0),
        apparentTemperature: Math.round(apparentTempF), 
        isDay: hourlyPeriods[0]?.isDaytime ?? true,
        precipitation: (obs.precipitationLastHour?.value || 0) / 25.4, 
        rain: (obs.textDescription || '').toLowerCase().includes('rain') ? 0.1 : 0, 
        showers: (obs.textDescription || '').toLowerCase().includes('showers') ? 0.1 : 0,
        snowfall: 0,
        weatherCode: mapNWSToCode(obs.textDescription || ''),
        windSpeed10m: Math.round((obs.windSpeed?.value || 0) * 0.621371), 
        windDirection10m: obs.windDirection?.value || 0,
      },
      hourly: {
        time: hourlyPeriods.slice(0, 48).map((p: any) => p.startTime),
        temperature2m: hourlyPeriods.slice(0, 48).map((p: any) => p.temperature),
        precipitationProbability: hourlyPeriods.slice(0, 48).map((p: any) => p.probabilityOfPrecipitation?.value || 0),
        weatherCode: hourlyPeriods.slice(0, 48).map((p: any) => mapNWSToCode(p.shortForecast)),
      },
      daily: {
        time: dailyTimes,
        temperature2mMax: dailyMaxes,
        temperature2mMin: dailyMins,
        precipitationSum: dailyPrecSum,
        weatherCode: dailyCodes,
      },
      alerts
    };
  } catch (e) {
    console.warn("NWS service currently unavailable, falling back to Open-Meteo:", e);
    return null;
  }
}

function mapNWSToCode(desc: string): number {
  const d = desc.toLowerCase();
  if (d.includes('tornado')) return 99;
  if (d.includes('hurricane') || d.includes('tropical storm')) return 95;
  if (d.includes('thunderstorm')) return 95;
  if (d.includes('blizzard') || d.includes('heavy snow')) return 75;
  if (d.includes('snow')) return 73;
  if (d.includes('heavy rain')) return 65;
  if (d.includes('rain')) return 63;
  if (d.includes('drizzle')) return 51;
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=10`;

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
      temperature2m: data.hourly.temperature_2m,
      precipitationProbability: data.hourly.precipitation_probability,
      weatherCode: data.hourly.weather_code,
    },
    daily: {
      time: data.daily.time,
      temperature2mMax: data.daily.temperature_2m_max,
      temperature2mMin: data.daily.temperature_2m_min,
      precipitationSum: data.daily.precipitation_sum,
      weatherCode: data.daily.weather_code,
    }
  };
}

export interface LocationInfo {
  name: string;
  latitude: number;
  longitude: number;
  state?: string;
  country?: string;
}

export async function moveInDirection(lat: number, lon: number, direction: 'north' | 'south' | 'east' | 'west', miles: number = 3): Promise<LocationInfo | null> {
  // 1 degree approx 69 miles
  const stepDegrees = miles / 69;
  let targetLat = lat;
  let targetLon = lon;

  switch (direction) {
    case 'north': targetLat += stepDegrees; break;
    case 'south': targetLat -= stepDegrees; break;
    case 'east': targetLon += stepDegrees; break;
    case 'west': targetLon -= stepDegrees; break;
  }

  // Reverse geocode the new point
  try {
    const { name: descriptiveName, state } = await reverseGeocode(targetLat, targetLon);

    return {
      name: descriptiveName,
      latitude: targetLat,
      longitude: targetLon,
      state: state || undefined
    };
  } catch (e) {
    console.error('Move In Direction Error:', e);
    return {
      name: `Position ${targetLat.toFixed(2)}, ${targetLon.toFixed(2)}`,
      latitude: targetLat,
      longitude: targetLon
    };
  }
}

function getDescriptiveFallback(lat: number, lon: number): string {
  // Broad geographic fallbacks
  if (lon < -20 && lon > -90 && lat > -60 && lat < 70) return "the Atlantic Ocean";
  if (lon < -170 || lon > 120) return "the Pacific Ocean";
  if (lon > -100 && lon < -80 && lat > 24 && lat < 30) return "the Gulf of Mexico";
  if (lat > 41 && lat < 49 && lon > -92 && lon < -76) return "the Great Lakes region";
  
  return `Region at ${Math.abs(lat).toFixed(1)} ${lat >= 0 ? 'North' : 'South'}, ${Math.abs(lon).toFixed(1)} ${lon >= 0 ? 'East' : 'West'}`;
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ name: string; state?: string }> {
  // Use Nominatim (OSM) for reverse geocoding
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  try {
    const response = await fetch(url, { 
      headers: { 
        'Accept-Language': 'en',
        'User-Agent': USER_AGENT 
      } 
    });
    if (!response.ok) throw new Error('Reverse geocoding failed');
    const data = await response.json();
    const addr = data.address;
    
    // Prefer city-level names, then water bodies, then fallback to county/state
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.neighbourhood || addr.municipality || addr.locality || addr.city_district || addr.isolated_dwelling || addr.croft || addr.allotments || addr.quarter;
    const water = addr.water || addr.sea || addr.ocean || addr.river || addr.bay || addr.strait || addr.fjord || addr.lagoon || addr.reservoir || addr.pond || addr.lake || addr.canal || addr.stream || addr.coastline;
    const feature = addr.natural || addr.place || addr.tourism || addr.leisure || addr.park || addr.national_park || addr.forest || addr.wood || addr.mountain_range || addr.beach;
    const county = addr.county;
    const state = addr.state;
    const country = addr.country;

    const stateDisplay = state ? (STATE_ABBR[state] || state) : '';

    const parts: string[] = [];
    
    if (city) {
      parts.push(city);
    } else if (water) {
      parts.push(water);
    } else if (feature) {
      parts.push(feature);
    }

    if (county && !water && !feature) parts.push(county);
    if (stateDisplay) parts.push(stateDisplay);
    if (parts.length === 0 && country) parts.push(country);

    let resName = parts.length > 0 ? parts.join(', ') : '';
    
    // Fallback if parts are empty
    if (!resName && data.display_name) {
      // Clean up display name if it's too long
      resName = data.display_name.split(',').slice(0, 3).join(',').trim();
    }

    if (!resName) {
      resName = getDescriptiveFallback(lat, lon);
    }
    if (resName.length > 100) resName = resName.substring(0, 97) + '...';

    return { name: resName, state };
  } catch (e) {
    return { name: getDescriptiveFallback(lat, lon) };
  }
}

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  admin2?: string;
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
