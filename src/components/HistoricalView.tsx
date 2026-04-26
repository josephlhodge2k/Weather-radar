import React from 'react';
import { History } from 'lucide-react';
import { WeatherData } from '../types';

interface HistoricalViewProps {
  weather: WeatherData;
}

export const HistoricalView: React.FC<HistoricalViewProps> = ({ weather }) => {
  if (!weather.historical) return null;

  const { tempMax, tempMin, date, recordMax, recordMin, recordMaxYear, recordMinYear } = weather.historical;
  
  // Use date components to avoid timezone shifts when parsing YYYY-MM-DD
  const [y, m, d] = date.split('-').map(Number);
  const formattedDate = new Date(y, m - 1, d).toLocaleDateString(undefined, { 
    month: 'long', 
    day: 'numeric'
  });

  return (
    <section 
      aria-labelledby="historical-heading"
      className="bg-zinc-950/40 border border-zinc-800 p-6 rounded-3xl space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
          <History className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="historical-heading" className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Climatology & Records</h2>
          <p className="text-[10px] text-zinc-600 font-mono">Statistical analysis for {formattedDate}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-bold px-1 flex items-center gap-2">
            <span className="w-1 h-1 bg-zinc-600 rounded-full" />
            Climatology Base
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">High</p>
              <p className="text-2xl font-light text-zinc-200">{tempMax}°</p>
            </div>
            <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Low</p>
              <p className="text-2xl font-light text-zinc-200">{tempMin}°</p>
            </div>
          </div>
        </div>

        {(recordMax !== undefined && recordMin !== undefined) && (
          <div>
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-bold px-1 flex items-center gap-2">
            <span className="w-1 h-1 bg-zinc-600 rounded-full" />
            System Records
          </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/20 text-center">
                <p className="text-[10px] uppercase tracking-wider text-rose-500/60 mb-1">Record High</p>
                <div className="flex flex-col">
                  <p className="text-2xl font-light text-rose-200">{recordMax}°</p>
                  <p className="text-[9px] text-rose-500/40 font-mono mt-1">{recordMaxYear}</p>
                </div>
              </div>
              <div className="p-4 bg-sky-500/5 rounded-2xl border border-sky-500/20 text-center">
                <p className="text-[10px] uppercase tracking-wider text-sky-500/60 mb-1">Record Low</p>
                <div className="flex flex-col">
                  <p className="text-2xl font-light text-sky-200">{recordMin}°</p>
                  <p className="text-[9px] text-sky-500/40 font-mono mt-1">{recordMinYear}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-[11px] text-zinc-500 italic leading-relaxed text-center px-4 border-t border-zinc-900 pt-4">
        {recordMax !== undefined ? 
          `The historical record for this date was ${recordMax}° set in ${recordMaxYear}, while the coldest ever recorded was ${recordMin}° in ${recordMinYear}.` :
          `On this day one year ago, the high was ${tempMax} degrees and the low was ${tempMin} degrees.`
        }
      </p>
    </section>
  );
};
