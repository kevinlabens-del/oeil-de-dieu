import { describe, expect, it } from 'vitest';
import { parseSharedView } from './shared-view';
describe('shared map location', () => {
  it('restores longitude, latitude and zoom, including zero coordinates', () => {
    expect(parseSharedView('?lat=48.578&lon=-3.826&zoom=13')).toEqual({ lat: 48.578, lng: -3.826, zoom: 13 });
    expect(parseSharedView('?lat=0&lon=0')).toEqual({ lat: 0, lng: 0, zoom: 8 });
  });
  it('rejects missing, invalid and out-of-range values', () => {
    for (const query of ['', '?zoom=5', '?lat=&lon=2', '?lat=1&lon=2&zoom=', '?lat=NaN&lon=2', '?lat=91&lon=0', '?lat=0&lon=181', '?lat=1&lon=1&zoom=99']) {
      expect(parseSharedView(query)).toBeNull();
    }
  });
});
