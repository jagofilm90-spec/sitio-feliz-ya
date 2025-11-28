import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

interface GoogleMapsAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  className?: string;
}

declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

let isGoogleMapsLoaded = false;
let isGoogleMapsLoading = false;
const loadCallbacks: (() => void)[] = [];

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve) => {
    if (isGoogleMapsLoaded) {
      resolve();
      return;
    }

    if (isGoogleMapsLoading) {
      loadCallbacks.push(resolve);
      return;
    }

    isGoogleMapsLoading = true;

    window.initGoogleMaps = () => {
      isGoogleMapsLoaded = true;
      isGoogleMapsLoading = false;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
};

const GoogleMapsAddressAutocomplete = ({
  value,
  onChange,
  placeholder = "Buscar dirección...",
  id,
  required,
  className,
}: GoogleMapsAddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setError("Google Maps API key no configurada");
      setIsLoading(false);
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
        setIsLoading(false);
        if (inputRef.current && window.google) {
          autocompleteRef.current = new window.google.maps.places.Autocomplete(
            inputRef.current,
            {
              types: ["address"],
              componentRestrictions: { country: "mx" },
              fields: ["formatted_address", "geometry", "name"],
            }
          );

          autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current?.getPlace();
            if (place?.formatted_address) {
              onChange(place.formatted_address);
            } else if (place?.name) {
              onChange(place.name);
            }
          });
        }
      })
      .catch((err) => {
        console.error("Error loading Google Maps:", err);
        setError("Error al cargar Google Maps");
        setIsLoading(false);
      });

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onChange]);

  if (error) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`pl-10 ${className || ""}`}
          autoComplete="off"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading ? (
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      ) : (
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      )}
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoading ? "Cargando Google Maps..." : placeholder}
        required={required}
        disabled={isLoading}
        className={`pl-10 ${className || ""}`}
        autoComplete="off"
      />
    </div>
  );
};

export default GoogleMapsAddressAutocomplete;
