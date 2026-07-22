import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { env } from '../config/env';

export interface ReportCoordinates {
  latitude: number;
  longitude: number;
  locationAccuracy?: number;
}

interface ReportLocationPickerProps {
  value: ReportCoordinates;
  onChange: (value: ReportCoordinates) => void;
}

export function ReportLocationPicker({ value, onChange }: ReportLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);
  const [loaded, setLoaded] = useState(false);
  const [baseMapError, setBaseMapError] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (containerRef.current === null) return;

    const initialValue = initialValueRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: env.mapStyleUrl,
      center: [initialValue.longitude, initialValue.latitude],
      zoom: 16,
      attributionControl: { compact: true },
    });
    const marker = new maplibregl.Marker({ color: '#0969e8', draggable: true })
      .setLngLat([initialValue.longitude, initialValue.latitude])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    marker.on('dragend', () => {
      const point = marker.getLngLat();
      onChangeRef.current({ latitude: point.lat, longitude: point.lng });
    });
    map.on('click', (event) => {
      marker.setLngLat(event.lngLat);
      onChangeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    });
    map.on('load', () => setLoaded(true));
    map.on('error', () => {
      if (!map.loaded()) setBaseMapError(true);
    });

    return () => {
      marker.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const center: [number, number] = [value.longitude, value.latitude];
    markerRef.current?.setLngLat(center);
    mapRef.current?.easeTo({ center, essential: false });
  }, [value.latitude, value.longitude]);

  return (
    <div
      className="relative min-h-80 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-card"
      role="region"
      aria-label="Mapa para corrigir a localização do problema"
    >
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {!loaded ? (
        <p
          className="absolute inset-x-4 top-4 rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm font-semibold text-slate-700 shadow-card"
          role="status"
        >
          {baseMapError
            ? 'O mapa-base está indisponível. Ajuste as coordenadas nos campos abaixo.'
            : 'Carregando mapa para correção do ponto...'}
        </p>
      ) : null}
      <p className="pointer-events-none absolute bottom-5 left-4 right-4 rounded-xl bg-ink/90 px-3 py-2 text-center text-xs font-bold text-white shadow-card backdrop-blur">
        Arraste o marcador ou toque no ponto exato do problema.
      </p>
    </div>
  );
}
