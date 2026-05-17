'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then((m) => m.GeoJSON), { ssr: false });

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

export const HeatmapMap = ({
  byState,
  metric,
  maxVal,
  fmtV,
  onSelectState,
  onHover,
}: {
  byState: Record<string, { demand: number; orders: number; revenue: number }>;
  metric: Metric;
  maxVal: number;
  fmtV: (v: number) => string;
  onSelectState: (code: string) => void;
  onHover: (code: string | null) => void;
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
      </MapContainer>
    </div>
  );
};
