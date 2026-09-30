export function parseSharedView(search: string) {
  const params = new URLSearchParams(search);
  if (!params.get('lat')?.trim() || !params.get('lon')?.trim() || (params.has('zoom') && !params.get('zoom')?.trim())) return null;
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lon'));
  const zoom = params.has('zoom') ? Number(params.get('zoom')) : 8;
  if (![lat, lng, zoom].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || zoom < 0 || zoom > 22) return null;
  return { lat, lng, zoom };
}
