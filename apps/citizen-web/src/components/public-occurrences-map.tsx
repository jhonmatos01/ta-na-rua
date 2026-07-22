import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import maplibregl, { GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { env } from '../config/env';
import type { MapPoint } from '../features/occurrences/occurrence-contracts';

const SOURCE_ID = 'public-occurrences';
const CLUSTER_LAYER_ID = 'occurrence-clusters';
const CLUSTER_COUNT_LAYER_ID = 'occurrence-cluster-count';
const POINT_LAYER_ID = 'occurrence-points';

interface MapFocus {
  latitude: number;
  longitude: number;
  zoom: number;
  requestId: number;
}

interface PublicOccurrencesMapProps {
  points: MapPoint[];
  focus?: MapFocus;
  onSelect: (occurrenceId: string) => void;
}

function toFeatureCollection(points: MapPoint[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      },
      properties: {
        id: point.id,
        title: point.title,
        status: point.status,
        category: point.category ?? 'Sem categoria',
        confirmationCount: point.confirmationCount,
      },
    })),
  };
}

export function PublicOccurrencesMap({ points, focus, onSelect }: PublicOccurrencesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const pointsRef = useRef(points);
  const [loaded, setLoaded] = useState(false);
  const [baseMapError, setBaseMapError] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (containerRef.current === null) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: env.mapStyleUrl,
      center: [env.defaultMapLongitude, env.defaultMapLatitude],
      zoom: env.defaultMapZoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toFeatureCollection(pointsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 54,
      });
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#22c55e', 10, '#f59e0b', 30, '#ef4444'],
          'circle-radius': ['step', ['get', 'point_count'], 19, 10, 25, 30, 32],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-opacity': 0.92,
        },
      });
      if (map.getStyle().glyphs) {
        map.addLayer({
          id: CLUSTER_COUNT_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 13,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });
      }
      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#0969e8',
          'circle-radius': 9,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });

      map.on('click', CLUSTER_LAYER_ID, (event) => {
        void (async () => {
          const feature = map.queryRenderedFeatures(event.point, {
            layers: [CLUSTER_LAYER_ID],
          })[0];
          const clusterId = Number(feature?.properties?.cluster_id);
          if (!Number.isFinite(clusterId) || feature?.geometry.type !== 'Point') return;
          const source = map.getSource(SOURCE_ID) as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom,
          });
        })();
      });
      map.on('click', POINT_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as Record<string, unknown> | null | undefined;
        const occurrenceId = properties?.id;
        if (typeof occurrenceId === 'string') onSelectRef.current(occurrenceId);
      });
      map.on('mouseenter', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseenter', POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseleave', POINT_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
      setLoaded(true);
    });
    map.on('error', () => {
      if (!map.loaded()) setBaseMapError(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const source = mapRef.current?.getSource(SOURCE_ID);
    if (source instanceof GeoJSONSource) source.setData(toFeatureCollection(points));
  }, [loaded, points]);

  useEffect(() => {
    if (focus === undefined) return;
    mapRef.current?.flyTo({
      center: [focus.longitude, focus.latitude],
      zoom: focus.zoom,
      essential: false,
    });
  }, [focus]);

  return (
    <div
      className="relative min-h-[28rem] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-card lg:min-h-[40rem]"
      role="region"
      aria-label="Mapa interativo de ocorrências públicas"
    >
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {!loaded ? (
        <div
          className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm font-semibold text-slate-700 shadow-card backdrop-blur"
          role="status"
        >
          {baseMapError
            ? 'O mapa base está indisponível. A lista de ocorrências continua acessível.'
            : 'Carregando mapa público...'}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-6 left-4 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-card backdrop-blur">
        {points.length} {points.length === 1 ? 'ponto público' : 'pontos públicos'}
      </div>
    </div>
  );
}
