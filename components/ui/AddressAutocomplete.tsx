"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";

export interface AddressResult {
  address: string;
  city: string;
  postal_code: string;
  full: string; // display string
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  label = "Adresse",
  placeholder = "Rue de la Loi 12, Bruxelles",
  required,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("countrycodes", "be,fr,lu,nl");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "5");
      url.searchParams.set("q", q);

      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "fr" },
      });
      if (!res.ok) return;
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      // Silently fail — user can still type manually
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 500);
  };

  const handleSelect = (item: NominatimResult) => {
    const addr = item.address;
    const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
    const city = addr.city || addr.town || addr.village || addr.municipality || "";
    const postal = addr.postcode?.split(";")[0] || "";

    const result: AddressResult = {
      address: street,
      city,
      postal_code: postal,
      full: item.display_name,
    };

    onChange(street || item.display_name);
    onSelect(result);
    setSuggestions([]);
    setOpen(false);
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <MapPin className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full h-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3.5 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((item) => {
            const addr = item.address;
            const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
            const city = addr.city || addr.town || addr.village || addr.municipality || "";
            const postal = addr.postcode?.split(";")[0] || "";
            const line1 = [street, postal, city].filter(Boolean).join(", ") || item.display_name;
            // Shorten long display names for the secondary line
            const parts = item.display_name.split(",");
            const line2 = parts.length > 3 ? parts.slice(-3).join(",").trim() : "";

            return (
              <button
                key={item.place_id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 last:border-0"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{line1}</p>
                  {line2 && <p className="text-xs text-slate-400 truncate">{line2}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
