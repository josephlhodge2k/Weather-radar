import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { searchLocations, GeocodingResult } from '../services/weatherService';
import { cn } from '../lib/utils';

interface LocationSearchProps {
  onLocationSelect: (lat: number, lon: number, name: string) => void;
}

export function LocationSearch({ onLocationSelect }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true);
        const data = await searchLocations(query);
        setResults(data);
        setIsSearching(false);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-sm" ref={dropdownRef}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-zinc-500 group-focus-within:text-sky-500 transition-colors" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter city name..."
          className="block w-full pl-10 pr-10 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all text-sm"
          aria-label="Search city for weather"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-zinc-300 text-zinc-500"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          role="listbox"
        >
          {isSearching ? (
            <div className="p-4 flex items-center justify-center gap-2 text-zinc-500 text-xs font-mono">
              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
              Searching data...
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((res, index) => (
                <li key={`${res.id}-${res.latitude}-${res.longitude}-${index}`}>
                  <button
                    onClick={() => {
                      onLocationSelect(res.latitude, res.longitude, res.name);
                      setQuery('');
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex flex-col">
                      <span className="text-zinc-100 font-medium text-sm">{res.name}</span>
                      <span className="text-zinc-500 text-[10px] uppercase font-mono tracking-wider">
                        {res.admin1 ? `${res.admin1}, ` : ''}{res.country}
                      </span>
                    </div>
                    <MapPin className="h-4 w-4 text-zinc-700 group-hover:text-sky-500 transition-colors" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-zinc-500 text-xs italic">
              No regions found matching your query.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
