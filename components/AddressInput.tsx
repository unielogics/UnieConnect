import { useEffect, useRef, useState } from 'react';
import { suggestAddress, type ValidatedAddress } from '../lib/address';

function mapCountryToCode(country: string | undefined): string {
  if (!country) return 'US';
  const lower = country.toLowerCase();
  if (lower.includes('united states') || lower === 'usa' || lower === 'us') return 'US';
  if (lower.includes('canada') || lower === 'ca') return 'CA';
  if (lower.includes('mexico') || lower === 'mx') return 'MX';
  if (country.length === 2) return country.toUpperCase();
  return 'US';
}

interface AddressInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: {
    street?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
}

export function AddressInput({ label = 'Search address', value, onChange, onSelectSuggestion }: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<ValidatedAddress[]>([]);
  const [typing, setTyping] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [lastSelected, setLastSelected] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const run = async () => {
      if (!debounced.trim()) {
        setSuggestions([]);
        setHighlight(-1);
        return;
      }
      if (lastSelected && debounced.trim() === lastSelected) {
        setSuggestions([]);
        setHighlight(-1);
        return;
      }
      setTyping(true);
      try {
        const res = await suggestAddress(debounced.trim());
        setSuggestions(res.suggestions || []);
        setHighlight(-1);
      } catch {
        setSuggestions([]);
        setHighlight(-1);
      } finally {
        setTyping(false);
      }
    };
    run();
  }, [debounced]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setHighlight(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectSuggestion = (s: ValidatedAddress) => {
    const street = s.street || s.formatted || '';
    onChange(street);
    setSuggestions([]);
    setHighlight(-1);
    setTyping(false);
    setDebounced(street);
    setLastSelected(street);
    if (onSelectSuggestion) {
      onSelectSuggestion({
        street: s.street,
        city: s.city,
        state: s.state,
        stateCode: s.stateCode,
        postalCode: s.postalCode,
        country: s.country,
        countryCode: mapCountryToCode(s.country),
        latitude: s.latitude,
        longitude: s.longitude,
      });
    }
  };

  return (
    <div className="address-input-wrap" ref={containerRef}>
      {label && <label className="address-input-label">{label}</label>}
      <input
        type="text"
        className="address-input-field"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(-1);
        }}
        placeholder="Start typing address..."
        autoComplete="off"
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((prev) => (prev + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlight >= 0 && highlight < suggestions.length) {
              selectSuggestion(suggestions[highlight]);
            }
          } else if (e.key === 'Escape') {
            setSuggestions([]);
            setHighlight(-1);
          }
        }}
      />
      {typing && <div className="address-input-hint">Searching…</div>}
      {suggestions.length > 0 && (
        <div className="address-input-dropdown">
          {suggestions.map((s, idx) => (
            <button
              key={`${s.formatted}-${idx}`}
              type="button"
              className={`address-input-option ${highlight === idx ? 'highlighted' : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => selectSuggestion(s)}
            >
              {s.formatted || s.street || 'Address'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
