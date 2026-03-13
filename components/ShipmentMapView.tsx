'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';

// Leaflet CSS required for correct map layout
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon - run on client
if (typeof window !== 'undefined') {
  import('leaflet').then((L) => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  });
}

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

const PIN_COLORS = { 'ship-from': '#2563eb', 'ship-to': '#059669', default: '#4338ca' } as const;

function createNumberedIcon(num: number, type?: 'ship-from' | 'ship-to') {
  if (typeof window === 'undefined') return undefined;
  const L = require('leaflet');
  const color = type ? PIN_COLORS[type] : PIN_COLORS.default;
  return L.divIcon({
    className: 'numbered-marker',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${color};color:white;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const UseMap = dynamic(
  () =>
    import('react-leaflet').then((mod) => {
      function MapController({ pins: p, fitBounds }: { pins: Array<{ lat: number; lng: number }>; fitBounds: boolean }) {
        const map = mod.useMap();

        // invalidateSize: fixes partial map when container was hidden/collapsed
        useEffect(() => {
          if (!map) return;
          const invalidate = () => {
            try {
              map.invalidateSize();
            } catch (_) {}
          };
          invalidate();
          const t1 = setTimeout(invalidate, 100);
          const t2 = setTimeout(invalidate, 300);
          return () => {
            clearTimeout(t1);
            clearTimeout(t2);
          };
        }, [map]);

        // fitBounds when pins change
        useEffect(() => {
          if (!map || p.length === 0 || !fitBounds) return;
          const L = require('leaflet');
          const pts = p.map((x) => L.latLng(x.lat, x.lng));
          const bounds =
            p.length === 1
              ? L.latLngBounds(
                  L.latLng(p[0].lat - 0.02, p[0].lng - 0.02),
                  L.latLng(p[0].lat + 0.02, p[0].lng + 0.02)
                )
              : L.latLngBounds(pts);
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
          const t = setTimeout(() => {
            try {
              map.invalidateSize();
            } catch (_) {}
          }, 150);
          return () => clearTimeout(t);
        }, [map, fitBounds, p.length, p.map((x) => `${x.lat},${x.lng}`).join('|')]);

        return null;
      }
      return MapController;
    }),
  { ssr: false }
);

export type MapPin = {
  lat: number;
  lng: number;
  label: string;
  index: 1 | 2 | 3;
  /** Pin type for color: ship-from (blue) vs ship-to (green) */
  type?: 'ship-from' | 'ship-to';
};

interface ShipmentMapViewProps {
  pins: MapPin[];
  center?: [number, number];
  zoom?: number;
  fitBounds?: boolean;
  style?: React.CSSProperties;
}

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

export function ShipmentMapView({
  pins,
  center,
  zoom = DEFAULT_ZOOM,
  fitBounds = false,
  style,
}: ShipmentMapViewProps) {
  const firstPin = pins[0];
  const mapCenter: [number, number] =
    center ?? (firstPin ? [firstPin.lat, firstPin.lng] : DEFAULT_CENTER);

  return (
    <div
      style={{
        position: 'relative',
        height: 320,
        minHeight: 320,
        width: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          minWidth: 300,
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={zoom}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pins.map((pin, i) => (
            <Marker
              key={`${pin.lat}-${pin.lng}-${i}`}
              position={[pin.lat, pin.lng]}
              icon={createNumberedIcon(pin.index, pin.type)}
            >
              <Popup>
                <strong>
                  {pin.index}. {pin.label}
                </strong>
              </Popup>
            </Marker>
          ))}
          <UseMap pins={pins} fitBounds={fitBounds && pins.length > 0} />
        </MapContainer>
      </div>
    </div>
  );
}
