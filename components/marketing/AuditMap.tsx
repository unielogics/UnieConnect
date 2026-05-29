'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useSiteTheme } from './theme';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then((m) => m.GeoJSON), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((m) => m.CircleMarker), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false });

const NAME_TO_CODE: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
  Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
  Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

// Approximate state centroids [lat, lng] — used to place warehouse pins.
const CENTROID: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AZ: [34.2, -111.6], AR: [34.9, -92.4], CA: [37.2, -119.3], CO: [39.0, -105.5],
  CT: [41.6, -72.7], DE: [39.0, -75.5], DC: [38.9, -77.0], FL: [28.6, -81.5], GA: [32.7, -83.4],
  ID: [44.1, -114.7], IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.0, -93.5], KS: [38.5, -98.4],
  KY: [37.5, -85.3], LA: [31.0, -92.0], ME: [45.4, -69.2], MD: [39.0, -76.8], MA: [42.3, -71.8],
  MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7], MO: [38.4, -92.5], MT: [47.0, -109.6],
  NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.1, -74.7], NM: [34.4, -106.1],
  NY: [42.9, -75.5], NC: [35.5, -79.4], ND: [47.5, -100.3], OH: [40.3, -82.8], OK: [35.6, -97.5],
  OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2],
  TN: [35.9, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44.0, -72.7], VA: [37.5, -78.9],
  WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43.0, -107.5],
};

// Deterministic pseudo-demand per state (mirrors the prototype's heatmap weighting).
const demandFor = (code: string): number => {
  let h = 0;
  for (const c of code) h += c.charCodeAt(0);
  return 0.2 + ((h * 7) % 80) / 100; // 0.2 .. 1.0
};

export type AuditMapProps = {
  originStates: string[];
  proposedStates: string[];
};

const AuditMap = ({ originStates, proposedStates }: AuditMapProps) => {
  const theme = useSiteTheme();
  const [geo, setGeo] = useState<any>(null);

  useEffect(() => {
    fetch('/us-states.geojson')
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(null));
  }, []);

  const tileUrl =
    theme === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

  const style = (feature: any) => {
    const code = NAME_TO_CODE[feature?.properties?.name];
    const v = code ? demandFor(code) : 0;
    return {
      fillColor: `rgba(139, 92, 255, ${(0.08 + v * 0.62).toFixed(3)})`,
      weight: 1,
      color: theme === 'light' ? 'rgba(124,70,255,0.35)' : 'rgba(165,134,255,0.32)',
      fillOpacity: 1,
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const name: string = feature?.properties?.name || '';
    const code = NAME_TO_CODE[name];
    const v = code ? Math.round(demandFor(code) * 100) : 0;
    const role = code && originStates.includes(code)
      ? ' · your origin'
      : code && proposedStates.includes(code)
        ? ' · proposed node'
        : '';
    layer.bindTooltip(`<strong>${name}</strong><br/>demand index: ${v}${role}`, {
      sticky: true, direction: 'top', opacity: 0.96,
    });
    layer.on({
      mouseover: (e: any) => { e.target.setStyle({ weight: 2.5, color: '#a586ff' }); e.target.bringToFront(); },
      mouseout: (e: any) => { e.target.setStyle(style(feature)); },
    });
  };

  return (
    <div className="uc-leaflet">
      <MapContainer
        center={[38.5, -96] as any}
        zoom={4}
        minZoom={3}
        maxZoom={7}
        scrollWheelZoom={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer key={theme} url={tileUrl} />
        {geo && (
          <GeoJSON key={`geo-${theme}`} data={geo} style={style as any} onEachFeature={onEachFeature as any} />
        )}

        {originStates.filter((s) => CENTROID[s]).map((s) => (
          <CircleMarker
            key={`o-${s}`}
            center={CENTROID[s] as any}
            radius={9}
            pathOptions={{ color: '#a586ff', weight: 2.5, fillColor: '#a586ff', fillOpacity: 0.85 }}
          >
            <Tooltip direction="top">Your origin · {s}</Tooltip>
          </CircleMarker>
        ))}

        {proposedStates.filter((s) => CENTROID[s]).map((s) => (
          <CircleMarker
            key={`p-${s}`}
            center={CENTROID[s] as any}
            radius={10}
            pathOptions={{ color: '#36e0a8', weight: 2.5, dashArray: '4 3', fill: false }}
          >
            <Tooltip direction="top">Cortex-proposed node · {s}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};

export default AuditMap;
