import { useEffect, useRef, useState } from 'react';
import { Box, Alert, Typography, Skeleton, ToggleButton, Stack } from '@mui/material';
import { loadGoogleMaps } from '../services/googleMapsLoader';
import type { LatLng } from '../types';

interface Props {
  origin: LatLng;
  waypoint?: LatLng;
  destination: LatLng;
  geometry: LatLng[];
  originLabel: string;
  waypointLabel?: string;
  destinationLabel: string;
}

export default function MapView({ origin, waypoint, destination, geometry, originLabel, waypointLabel, destinationLabel }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const trafficLayerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTraffic, setShowTraffic] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const google = (window as any).google;

        const map = new google.maps.Map(mapRef.current, {
          center: origin,
          zoom: 11,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true
        });
        mapInstanceRef.current = map;

        const routeLine = new google.maps.Polyline({
          path: geometry,
          geodesic: true,
          strokeColor: '#2F6FED',
          strokeOpacity: 0.95,
          strokeWeight: 5
        });
        routeLine.setMap(map);

        const dot = (color: string) => ({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#141C1C',
          strokeWeight: 2
        });

        new google.maps.Marker({ position: origin, map, title: originLabel, icon: dot('#79DD22') });
        if (waypoint) {
          new google.maps.Marker({ position: waypoint, map, title: waypointLabel, icon: dot('#FFB020') });
        }
        new google.maps.Marker({ position: destination, map, title: destinationLabel, icon: dot('#FF5A5F') });

        const bounds = new google.maps.LatLngBounds();
        geometry.forEach((p) => bounds.extend(p));
        bounds.extend(origin);
        bounds.extend(destination);
        map.fitBounds(bounds, 40);

        trafficLayerRef.current = new google.maps.TrafficLayer();

        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Erro ao carregar o mapa.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [origin, waypoint, destination, geometry, originLabel, waypointLabel, destinationLabel]);

  const toggleTraffic = () => {
    if (!trafficLayerRef.current || !mapInstanceRef.current) return;
    if (showTraffic) {
      trafficLayerRef.current.setMap(null);
    } else {
      trafficLayerRef.current.setMap(mapInstanceRef.current);
    }
    setShowTraffic(!showTraffic);
  };

  if (error) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert>
        <Typography variant="body2" color="text.secondary">
          O restante da previsão (distância, tempo, consumo) continua funcionando normalmente.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {!loading && (
        <Stack direction="row" sx={{ mb: 1 }}>
          <ToggleButton
            value="traffic"
            selected={showTraffic}
            onChange={toggleTraffic}
            size="small"
            sx={{ textTransform: 'none', borderRadius: '10px' }}
          >
            🚦 Trânsito em tempo real
          </ToggleButton>
        </Stack>
      )}
      <Box sx={{ position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>
        {loading && <Skeleton variant="rectangular" width="100%" height={380} sx={{ borderRadius: '16px' }} />}
        <Box ref={mapRef} sx={{ width: '100%', height: 380, display: loading ? 'none' : 'block' }} />
      </Box>
    </Box>
  );
}
