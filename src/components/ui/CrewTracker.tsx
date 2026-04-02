"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadGoogleMaps } from "@/lib/utils/loadGoogleMaps";
import { Navigation2, Clock, MapPin, Loader2 } from "lucide-react";

interface Props {
  assignmentId: string;
  crewName: string;
  clientLat: number | null;
  clientLng: number | null;
  clientAddress: string;
  status: string;
}

interface CrewLocation {
  lat: number;
  lng: number;
  updated_at: string;
}

// Haversine distance in km
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Buenos Aires avg speed ~25 km/h in traffic
function etaMinutes(km: number) {
  return Math.max(1, Math.round((km / 25) * 60));
}

export default function CrewTracker({
  assignmentId,
  crewName,
  clientLat,
  clientLng,
  clientAddress,
  status,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const crewMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const [crewLocation, setCrewLocation] = useState<CrewLocation | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  // Load initial crew location
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("crew_locations")
      .select("lat, lng, updated_at")
      .eq("assignment_id", assignmentId)
      .single()
      .then(({ data }) => {
        if (data) setCrewLocation(data as CrewLocation);
        setLoading(false);
      });
  }, [assignmentId]);

  // Realtime subscription to crew location updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`crew-location-${assignmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crew_locations",
          filter: `assignment_id=eq.${assignmentId}`,
        },
        (payload) => {
          const loc = payload.new as CrewLocation;
          setCrewLocation(loc);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [assignmentId]);

  // Calculate ETA whenever crew location changes
  useEffect(() => {
    if (!crewLocation || !clientLat || !clientLng) return;

    if (apiKey && window.__gmapsLoaded && window.google?.maps?.DirectionsService) {
      // Use Google Directions for accurate ETA
      const svc = new window.google.maps.DirectionsService();
      svc.route(
        {
          origin: { lat: crewLocation.lat, lng: crewLocation.lng },
          destination: { lat: clientLat, lng: clientLng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && result?.routes[0]?.legs[0]) {
            const mins = Math.ceil((result.routes[0].legs[0].duration!.value) / 60);
            setEta(mins);
          } else {
            // Fallback to haversine
            const km = distanceKm(crewLocation.lat, crewLocation.lng, clientLat, clientLng);
            setEta(etaMinutes(km));
          }
        }
      );
    } else {
      // No Google Maps — use haversine
      const km = distanceKm(crewLocation.lat, crewLocation.lng, clientLat, clientLng);
      setEta(etaMinutes(km));
    }
  }, [crewLocation, clientLat, clientLng, apiKey]);

  // Initialize Google Maps
  useEffect(() => {
    if (!apiKey || !mapRef.current || !crewLocation || mapReady) return;

    loadGoogleMaps(apiKey).then(() => {
      if (!mapRef.current) return;

      const center = { lat: crewLocation.lat, lng: crewLocation.lng };

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });

      // Crew marker (car icon)
      const crewMarker = new window.google.maps.Marker({
        position: center,
        map,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#2D6A4F",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: crewName,
        zIndex: 10,
      });

      // Client destination marker
      if (clientLat && clientLng) {
        new window.google.maps.Marker({
          position: { lat: clientLat, lng: clientLng },
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#1a56db",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          title: "Tu domicilio",
          zIndex: 9,
        });

        // Draw route
        const renderer = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#2D6A4F",
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        });

        const svc = new window.google.maps.DirectionsService();
        svc.route(
          {
            origin: center,
            destination: { lat: clientLat, lng: clientLng },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK") renderer.setDirections(result);
          }
        );

        directionsRendererRef.current = renderer;

        // Fit bounds to show both markers
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(center);
        bounds.extend({ lat: clientLat, lng: clientLng });
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }

      mapInstanceRef.current = map;
      crewMarkerRef.current = crewMarker;
      setMapReady(true);
    });
  }, [apiKey, crewLocation, mapReady, crewName, clientLat, clientLng]);

  // Update crew marker position when location changes
  useEffect(() => {
    if (!crewMarkerRef.current || !crewLocation || !mapReady) return;
    const pos = { lat: crewLocation.lat, lng: crewLocation.lng };
    crewMarkerRef.current.setPosition(pos);

    // Redraw route
    if (clientLat && clientLng && directionsRendererRef.current && window.__gmapsLoaded) {
      const svc = new window.google.maps.DirectionsService();
      svc.route(
        {
          origin: pos,
          destination: { lat: clientLat, lng: clientLng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK") directionsRendererRef.current!.setDirections(result);
        }
      );
    }
  }, [crewLocation, mapReady, clientLat, clientLng]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Buscando ubicación del equipo...</span>
      </div>
    );
  }

  if (!crewLocation) {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <Navigation2 size={20} className="text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">El equipo está en camino</p>
          <p className="text-xs text-amber-600 mt-0.5">La ubicación en tiempo real estará disponible en unos minutos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ETA banner */}
      <div className="flex items-center justify-between bg-green-700 text-white rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Navigation2 size={20} className="flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">{crewName} está en camino</p>
            <p className="text-xs opacity-80 flex items-center gap-1 mt-0.5">
              <MapPin size={11} />
              {clientAddress}
            </p>
          </div>
        </div>
        {eta !== null && (
          <div className="text-right flex-shrink-0 ml-3">
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span className="text-xl font-bold">{eta}</span>
            </div>
            <p className="text-xs opacity-80">min</p>
          </div>
        )}
      </div>

      {/* Map */}
      {apiKey ? (
        <div
          ref={mapRef}
          className="w-full rounded-xl overflow-hidden border border-gray-200"
          style={{ height: 240 }}
        />
      ) : (
        // Fallback: static Google Maps link
        <a
          href={`https://www.google.com/maps/dir/${crewLocation.lat},${crewLocation.lng}/${clientLat},${clientLng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-32 bg-gray-100 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <MapPin size={20} className="text-green-700" />
          <span className="text-sm text-gray-600 font-medium">Ver ruta en Google Maps</span>
        </a>
      )}

      <p className="text-xs text-gray-400 text-center">
        Actualizado hace{" "}
        {Math.round((Date.now() - new Date(crewLocation.updated_at).getTime()) / 1000 / 60)} min
      </p>
    </div>
  );
}
