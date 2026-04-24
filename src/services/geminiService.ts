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
      alerts: weather.alerts?.map(a => a.event)
    }) : 'Location unknown'}
    
    Key Instructions:
    1. Always use descriptive language. Instead of "it's raining", say "there is a steady light rain falling right now".
    2. Focus on safety and practical advice (e.g., "It's quite cold, make sure to wear a heavy coat").
    3. Be empathetic and professional.
    4. Keep responses relatively short so they are easy to listen to.
    5. If asked about radar, interpret the data provided: if precipitation is > 0, tell them how intense it is and which way it is moving (use wind_direction_deg as a guide for cardinal directions like North, East etc).
  `;

  try {
    // Convert history to Gemini format
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
      config: {
        systemInstruction,
      }
    });

    return result.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm having trouble connecting to my weather brain right now. I'll be back as soon as the signal clears.";
  }
}
