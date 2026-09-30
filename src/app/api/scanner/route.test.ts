import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/ssrf-guard', () => ({
  validateHost: vi.fn().mockResolvedValue({ ok: true }),
  isRateLimited: vi.fn().mockReturnValue(false),
  getClientIp: () => 'test',
}));
import { GET } from './route';
import { validateHost } from '@/lib/ssrf-guard';
beforeEach(() => {
  vi.stubEnv('SCANNER_URL', 'https://scanner.example/');
  vi.stubEnv('SCANNER_KEY', 'test-secret');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ports":[]}', { status: 200 })));
  vi.mocked(validateHost).mockResolvedValue({ ok: true });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('scanner route', () => {
  it('returns an actionable JSON response when configuration is missing', async () => {
    vi.stubEnv('SCANNER_URL', '');
    const result = await GET(new Request('https://app.example/api/scanner'));
    expect(result.status).toBe(503);
    expect((await result.json()).configured).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects private targets and unavailable scan types without contacting the scanner', async () => {
    vi.mocked(validateHost).mockResolvedValueOnce({ ok: false, reason: 'private' });
    expect((await GET(new Request('https://app.example/api/scanner?target=127.0.0.1'))).status).toBe(403);
    expect((await GET(new Request('https://app.example/api/scanner?target=example.com&type=deep'))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('forwards a configured supported request without caching it', async () => {
    const result = await GET(new Request('https://app.example/api/scanner?target=example.com&type=ssl'));
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith('https://scanner.example/scan/ssl?key=test-secret&target=example.com', expect.objectContaining({ redirect: 'error', cache: 'no-store' }));
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
});
