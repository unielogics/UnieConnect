'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then((m) => m.GeoJSON), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((m) => m.CircleMarker), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false });

export const NAME_TO_CODE: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
  Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
  Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'Puerto Rico': 'PR',
};

type Metric = 'demand' | 'orders' | 'revenue';
type WarehousePin = {
  id: string;
  code?: string;
  name?: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  inventoryUnits?: number;
  activeSkus?: number;
  status?: string;
};

const STATE_CENTERS: Record<string, [number, number]> = {
  AL: [32.806671, -86.79113], AK: [61.370716, -152.404419], AZ: [33.729759, -111.431221], AR: [34.969704, -92.373123],
  CA: [36.116203, -119.681564], CO: [39.059811, -105.311104], CT: [41.597782, -72.755371], DE: [39.318523, -75.507141],
  DC: [38.897438, -77.026817], FL: [27.766279, -81.686783], GA: [33.040619, -83.643074], HI: [21.094318, -157.498337],
  ID: [44.240459, -114.478828], IL: [40.349457, -88.986137], IN: [39.849426, -86.258278], IA: [42.011539, -93.210526],
  KS: [38.5266, -96.726486], KY: [37.66814, -84.670067], LA: [31.169546, -91.867805], ME: [44.693947, -69.381927],
  MD: [39.063946, -76.802101], MA: [42.230171, -71.530106], MI: [43.326618, -84.536095], MN: [45.694454, -93.900192],
  MS: [32.741646, -89.678696], MO: [38.456085, -92.288368], MT: [46.921925, -110.454353], NE: [41.12537, -98.268082],
  NV: [38.313515, -117.055374], NH: [43.452492, -71.563896], NJ: [40.298904, -74.521011], NM: [34.840515, -106.248482],
  NY: [42.165726, -74.948051], NC: [35.630066, -79.806419], ND: [47.528912, -99.784012], OH: [40.388783, -82.764915],
  OK: [35.565342, -96.928917], OR: [44.572021, -122.070938], PA: [40.590752, -77.209755], RI: [41.680893, -71.51178],
  SC: [33.856892, -80.945007], SD: [44.299782, -99.438828], TN: [35.747845, -86.692345], TX: [31.054487, -97.563461],
  UT: [40.150032, -111.862434], VT: [44.045876, -72.710686], VA: [37.769337, -78.169968], WA: [47.400902, -121.490494],
  WV: [38.491226, -80.954453], WI: [44.268543, -89.616508], WY: [42.755966, -107.30249],
};

export const HeatmapMap = ({
  byState,
  metric,
  maxVal,
  fmtV,
  onSelectState,
  onHover,
  warehouses = [],
}: {
  byState: Record<string, { demand: number; orders: number; revenue: number }>;
  metric: Metric;
  maxVal: number;
  fmtV: (v: number) => string;
  onSelectState: (code: string) => void;
  onHover: (code: string | null) => void;
  warehouses?: WarehousePin[];
}) => {
  const [geo, setGeo] = useState<any>(null);

  useEffect(() => {
    fetch('/us-states.geojson')
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(null));
  }, []);

  const valueFor = (name: string) => {
    const d = byState[NAME_TO_CODE[name]];
    if (!d) return 0;
    return metric === 'demand' ? d.demand : metric === 'orders' ? d.orders : d.revenue;
  };

  const colorFor = (v: number) => {
    const intensity = Math.max(0, Math.min(1, v / (maxVal || 1)));
    return `rgba(109, 40, 217, ${(0.06 + intensity * 0.85).toFixed(3)})`;
  };

  const style = (feature: any) => ({
    fillColor: colorFor(valueFor(feature?.properties?.name)),
    weight: 1,
    color: 'rgba(120,120,140,0.5)',
    fillOpacity: 1,
  });

  const onEachFeature = (feature: any, layer: any) => {
    const name: string = feature?.properties?.name || '';
    const code = NAME_TO_CODE[name];
    const v = valueFor(name);
    layer.bindTooltip(
      `<strong>${name}</strong><br/>${metric}: ${fmtV(v)}`,
      { sticky: true, direction: 'top', opacity: 0.95 }
    );
    layer.on({
      mouseover: (e: any) => {
        e.target.setStyle({ weight: 2.5, color: '#6d28d9', fillOpacity: 1 });
        e.target.bringToFront();
        if (code) onHover(code);
      },
      mouseout: (e: any) => {
        e.target.setStyle(style(feature));
        onHover(null);
      },
      click: () => {
        if (code) onSelectState(code);
      },
    });
  };

  return (
    <div style={{ height: 460, width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer
        center={[39.5, -98.35] as any}
        zoom={4}
        minZoom={3}
        maxZoom={8}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: 'var(--bg-sunken)' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        {geo && (
          <GeoJSON
            key={`${metric}-${maxVal}`}
            data={geo}
            style={style as any}
            onEachFeature={onEachFeature as any}
          />
        )}
        {warehouses.map((w) => {
          const fallback = w.state ? STATE_CENTERS[String(w.state).toUpperCase()] : null;
          const lat = Number.isFinite(Number(w.latitude)) ? Number(w.latitude) : fallback?.[0];
          const lng = Number.isFinite(Number(w.longitude)) ? Number(w.longitude) : fallback?.[1];
          if (lat == null || lng == null) return null;
          const label = w.code || w.name || 'Warehouse';
          return (
            <CircleMarker
              key={w.id}
              center={[lat, lng] as any}
              radius={8}
              pathOptions={{
                color: '#4c1d95',
                weight: 2,
                fillColor: '#7c3aed',
                fillOpacity: 0.95,
              } as any}
            >
              <Tooltip direction="top" opacity={0.96}>
                <strong>{label}</strong>
                <br />
                {[w.city, w.state].filter(Boolean).join(', ') || 'Warehouse'}
                <br />
                {(w.inventoryUnits || 0).toLocaleString()}u · {(w.activeSkus || 0).toLocaleString()} SKUs
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};
