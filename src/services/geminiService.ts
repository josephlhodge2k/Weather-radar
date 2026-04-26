import { GoogleGenAI } from "@google/genai";
import { ChatMessage, WeatherData } from "../types";
import { getWeatherDescription } from "./weatherService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function sendMessage(
  history: ChatMessage[],
  message: string,
  weather: WeatherData | null
) {
  if (!process.env.GEMINI_API_KEY) {
    return "The assistant's brain is not configured yet (missing API key). Please check your environment settings.";
  }

  const systemInstruction = `
    You are Aura, a weather assistant designed for the blind. 
    Your goal is to provide clear, concise, and highly descriptive weather information.
    
    Context:
    - Current Location Weather: ${weather ? JSON.stringify({
      temp: `${weather.current.temperature2m}°F`,
      feels_like: `${weather.current.apparentTemperature}°F`,
      condition: getWeatherDescription(weather.current.weatherCode),
      precipitation: `${weather.current.precipitation} inches`,
      wind: `${weather.current.windSpeed10m}mph`,
      wind_direction_deg: weather.current.windDirection10m,
      alerts: weather.alerts?.map(a => a.event),
      historical_last_year: weather.historical ? `High ${weather.historical.tempMax}F, Low ${weather.historical.tempMin}F` : 'Not available',
      all_time_records: weather.historical?.recordMax ? `Max: ${weather.historical.recordMax}F (${weather.historical.recordMaxYear}), Min: ${weather.historical.recordMin}F (${weather.historical.recordMinYear})` : 'Not available',
      forecast_daily: weather.daily?.time?.map((t, i) => ({
        date: t,
        max: `${weather.daily.temperature2mMax[i]}°F`,
        min: `${weather.daily.temperature2mMin[i]}°F`,
        condition: getWeatherDescription(weather.daily.weatherCode[i]),
        precip_prob: (weather.hourly?.precipitationProbability && (i * 24) < weather.hourly.precipitationProbability.length) 
          ? `${weather.hourly.precipitationProbability[i * 24]}%` 
          : 'Check report'
      })).slice(0, 10) || [],
      forecast_hourly_next_12: weather.hourly?.time?.map((t, i) => ({
        time: t,
        temp: `${weather.hourly.temperature2m[i]}°F`,
        precip_prob: `${weather.hourly.precipitationProbability[i]}%`,
        condition: getWeatherDescription(weather.hourly.weatherCode[i])
      })).slice(0, 12) || []
    }, null, 2) : 'Location unknown'}
    
    Key Instructions:
    1. Always use descriptive language. Instead of "it's raining", say "there is a steady light rain falling right now".
    2. Focus on safety and practical advice (e.g., "It's quite cold, make sure to wear a heavy coat").
    3. Be empathetic and professional.
    4. Keep responses relatively short so they are easy to listen to.
    5. If asked about radar, interpret the data provided: if precipitation is > 0, tell them how intense it is and which way it is moving (use wind_direction_deg as a guide for cardinal directions like North, East etc).
    6. Use the forecast data to answer questions about tomorrow or the upcoming week. If a user asks "will it rain tomorrow", check the daily and hourly forecast entries for tomorrow's date.
  `;

  try {
    const contents = [
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction,
      },
    });

    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm having trouble connecting to my weather brain right now. I'll be back as soon as the signal clears.";
  }
}
