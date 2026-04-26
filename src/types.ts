export interface WeatherAlert {
  event: string;
  headline: string;
  description: string;
  severity: string;
  certainty: string;
  instruction?: string;
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  current: {
    temperature2m: number;
    relativeHumidity2m: number;
    apparentTemperature: number;
    isDay: boolean;
    precipitation: number;
    rain: number;
    showers: number;
    snowfall: number;
    weatherCode: number;
    windSpeed10m: number;
    windDirection10m: number;
    lightningPotential?: number; // Only some models provide this
  };
  hourly: {
    time: string[];
    temperature2m: number[];
    precipitationProbability: number[];
    weatherCode: number[];
  };
  daily: {
    time: string[];
    temperature2mMax: number[];
    temperature2mMin: number[];
    precipitationSum: number[];
    weatherCode: number[];
  };
  alerts?: WeatherAlert[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
