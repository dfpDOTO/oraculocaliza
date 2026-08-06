import type { LatLng } from '../types';

export function buildGoogleMapsUrl(originAddress: string, waypointAddress: string, destinationAddress: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin: originAddress,
    destination: destinationAddress,
    waypoints: waypointAddress,
    travelmode: 'driving',
    avoid: 'tolls',
    dir_action: 'navigate'
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildWazeUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}
