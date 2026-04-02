"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

export interface PlaceResult {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
  fullAddress: string;
}

interface Props {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  defaultValue?: string;
}

declare global {
  interface Window {
    google: typeof google;
    __gmapsLoading?: boolean;
    __gmapsLoaded?: boolean;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.__gmapsLoaded) return Promise.resolve();
  if (window.__gmapsLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.__gmapsLoaded) { clearInterval(check); resolve(); }
      }, 100);
    });
  }
  window.__gmapsLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    script.onload = () => { window.__gmapsLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function PlacesAutocomplete({ onSelect, placeholder, defaultValue }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [value, setValue] = useState(defaultValue || "");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !inputRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ar" },
      fields: ["address_components", "geometry", "formatted_address"],
      types: ["address"],
    });

    const listener = autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (!place.address_components) return;

      let street = "";
      let number = "";
      let neighborhood = "";
      let city = "";
      let province = "";
      let postalCode = "";

      for (const comp of place.address_components) {
        const types = comp.types;
        if (types.includes("route")) street = comp.long_name;
        if (types.includes("street_number")) number = comp.long_name;
        if (types.includes("sublocality_level_1") || types.includes("neighborhood")) {
          neighborhood = comp.long_name;
        }
        if (types.includes("locality") || types.includes("administrative_area_level_2")) {
          city = comp.long_name;
        }
        if (types.includes("administrative_area_level_1")) province = comp.long_name;
        if (types.includes("postal_code")) postalCode = comp.long_name;
      }

      const formatted = place.formatted_address || "";
      setValue(formatted);

      onSelect({
        street,
        number,
        neighborhood,
        city,
        province,
        postalCode,
        lat: place.geometry?.location?.lat() ?? 0,
        lng: place.geometry?.location?.lng() ?? 0,
        fullAddress: formatted,
      });
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [ready, onSelect]);

  if (!apiKey) return null;

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
        {loading ? (
          <Loader2 size={16} className="text-gray-400 animate-spin" />
        ) : (
          <MapPin size={16} className="text-green-700" />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "Buscar dirección..."}
        autoComplete="off"
        className="w-full pl-9 pr-3 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-colors"
      />
    </div>
  );
}
