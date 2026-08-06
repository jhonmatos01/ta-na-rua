import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import maplibregl, { GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { HeatmapCell } from './api';
import { config } from './config';

const SOURCE_ID = 'municipal-heatmap';
const HEAT_LAYER_ID = 'municipal-heatmap-density';
const CELL_LAYER_ID = 'municipal-heatmap-cells';
const CELL_COUNT_LAYER_ID = 'municipal-heatmap-counts';
const CELL_HIT_LAYER_ID = 'municipal-heatmap-hit-area';

function toFeatureCollection(cells: HeatmapCell[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell, index) => ({
      type: 'Feature',
      id: index,
      geometry: {
        type: 'Point',
        coordinates: [cell.longitude, cell.latitude],
      },
      properties: {
        occurrenceCount: cell.occurrenceCount,
        averagePriorityScore: cell.averagePriorityScore,
      },
    })),
  };
}

function fitToCells(map: MapLibreMap, cells: HeatmapCell[]): void {
  if (cells.length === 0) return;
  if (cells.length === 1) {
    const cell = cells[0]!;
    map.easeTo({ center: [cell.longitude, cell.latitude], zoom: 14, essential: false });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const cell of cells) bounds.extend([cell.longitude, cell.latitude]);
  map.fitBounds(bounds, {
    padding: 58,
    maxZoom: 14,
    duration: 700,
    essential: false,
  });
}

export function MunicipalHeatmap({ cells, loading }: { cells: HeatmapCell[]; loading: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const cellsRef = useRef(cells);
  const [loaded, setLoaded] = useState(false);
  const [baseMapError, setBaseMapError] = useState(false);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    if (containerRef.current === null) return;

    const container = containerRef.current;
    const map = new maplibregl.Map({
      container,
      style: config.mapStyleUrl,
      center: [config.defaultMapLongitude, config.defaultMapLatitude],
      zoom: config.defaultMapZoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toFeatureCollection(cellsRef.current),
      });
      map.addLayer({
        id: HEAT_LAYER_ID,
        type: 'heatmap',
        source: SOURCE_ID,
        maxzoom: 17,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'occurrenceCount'],
            1,
            0.28,
            10,
            0.72,
            40,
            1,
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1.1, 14, 1.8],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 30, 12, 48, 16, 70],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.72, 15, 0.9],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(30, 136, 229, 0)',
            0.16,
            'rgba(39, 174, 239, 0.65)',
            0.34,
            'rgba(59, 211, 137, 0.78)',
            0.55,
            'rgba(255, 222, 70, 0.88)',
            0.76,
            'rgba(255, 137, 43, 0.94)',
            1,
            'rgba(226, 52, 47, 0.98)',
          ],
        },
      });
      map.addLayer({
        id: CELL_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'occurrenceCount'],
            1,
            6,
            10,
            11,
            40,
            17,
          ],
          'circle-color': [
            'step',
            ['get', 'occurrenceCount'],
            '#1687e8',
            4,
            '#16a46a',
            10,
            '#f3b51b',
            20,
            '#f06a31',
            40,
            '#df3434',
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.72, 14, 0.9],
          'circle-blur': 0.08,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      if (map.getStyle().glyphs) {
        map.addLayer({
          id: CELL_COUNT_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['to-string', ['get', 'occurrenceCount']],
            'text-size': 11,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(5, 27, 59, 0.45)',
            'text-halo-width': 1,
          },
        });
      }
      map.addLayer({
        id: CELL_HIT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'occurrenceCount'],
            1,
            16,
            10,
            24,
            40,
            32,
          ],
          'circle-color': '#000000',
          'circle-opacity': 0.01,
        },
      });

      map.on('click', CELL_HIT_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (feature?.geometry.type !== 'Point') return;
        const count = Number(feature.properties?.occurrenceCount ?? 0);
        const priority = Number(feature.properties?.averagePriorityScore ?? 0);
        const content = document.createElement('div');
        content.className = 'heatmap-popup';
        const title = document.createElement('strong');
        title.textContent = `${count} ${count === 1 ? 'ocorrência' : 'ocorrências'} nesta área`;
        const detail = document.createElement('span');
        detail.textContent = `Prioridade média: ${priority.toFixed(1)}`;
        content.append(title, detail);
        new maplibregl.Popup({ offset: 12, closeButton: true })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setDOMContent(content)
          .addTo(map);
      });
      map.on('mouseenter', CELL_HIT_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', CELL_HIT_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });

      setLoaded(true);
      map.resize();
      fitToCells(map, cellsRef.current);
    });
    map.on('error', () => {
      if (!map.loaded()) setBaseMapError(true);
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const source = mapRef.current?.getSource(SOURCE_ID);
    if (source instanceof GeoJSONSource) source.setData(toFeatureCollection(cells));
    if (mapRef.current) fitToCells(mapRef.current, cells);
  }, [cells, loaded]);

  return (
    <div
      className="municipal-heatmap"
      role="region"
      aria-label="Mapa de calor das ocorrências municipais"
      aria-busy={loading}
    >
      <div ref={containerRef} className="municipal-heatmap__canvas" />
      {!loaded && (
        <div className="municipal-heatmap__message" role="status">
          {baseMapError
            ? 'O mapa viário está indisponível. Os indicadores territoriais continuam acessíveis.'
            : 'Carregando mapa viário…'}
        </div>
      )}
      {loaded && !loading && cells.length === 0 && (
        <div className="municipal-heatmap__message">
          Nenhuma concentração encontrada para os filtros atuais.
        </div>
      )}
      <div className="heatmap-legend" aria-label="Escala de concentração">
        <span>Baixa concentração</span>
        <i aria-hidden="true" />
        <span>Alta concentração</span>
      </div>
      <div className="heatmap-privacy-note">
        <span aria-hidden="true">▦</span>
        Células agregadas — nenhum morador é identificado
      </div>
    </div>
  );
}
