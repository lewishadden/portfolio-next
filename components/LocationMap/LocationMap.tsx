'use client';

import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const PETERBOROUGH: [number, number] = [52.5695, -0.2405];

export const LocationMap = () => {
  return (
    <MapContainer
      center={PETERBOROUGH}
      zoom={12}
      zoomControl={false}
      attributionControl
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      className="location-map__canvas"
      aria-hidden="true"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
    </MapContainer>
  );
};

export default LocationMap;
