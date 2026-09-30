import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ supported: true, players: [] as any[] }));
vi.mock('hls.js', () => ({ default: class {
  static isSupported = () => mock.supported;
  static Events = { MANIFEST_PARSED: 'manifest', ERROR: 'error' };
  static ErrorTypes = { NETWORK_ERROR: 'network', MEDIA_ERROR: 'media' };
  handlers = new Map<string, (...args: any[]) => void>();
  startLoad = vi.fn(); stopLoad = vi.fn(); destroy = vi.fn();
  recoverMediaError = vi.fn(); loadSource = vi.fn(); attachMedia = vi.fn();
  constructor() { mock.players.push(this); }
  on(event: string, fn: (...args: any[]) => void) { this.handlers.set(event, fn); }
} }));
import { attachLiveVideo } from './live-video';

function fixture(native = '') {
  const video = Object.assign(new EventTarget(), {
    src: '', play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(),
    removeAttribute: vi.fn(), canPlayType: () => native,
  });
  const callbacks = { ready: vi.fn(), loading: vi.fn(), failed: vi.fn() };
  const dispose = attachLiveVideo(video as unknown as HTMLVideoElement, 'https://camera.example/live.m3u8', callbacks);
  return { video, callbacks, dispose };
}
beforeEach(() => { vi.useFakeTimers(); mock.supported = true; mock.players = []; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('live camera lifecycle', () => {
  it('does not claim playback just because the manifest arrived', () => {
    const { callbacks, video, dispose } = fixture();
    mock.players[0].handlers.get('manifest')();
    expect(callbacks.ready).not.toHaveBeenCalled();
    video.dispatchEvent(new Event('playing'));
    expect(callbacks.ready).toHaveBeenCalledOnce();
    dispose();
  });
  it('limits recovery attempts and reports an unavailable feed', async () => {
    const { callbacks, video, dispose } = fixture();
    const player = mock.players[0];
    for (let i = 0; i < 3; i++) {
      player.handlers.get('error')('error', { fatal: true, type: 'network' });
      await vi.advanceTimersByTimeAsync(1500);
    }
    expect(player.startLoad).toHaveBeenCalledTimes(2);
    expect(callbacks.failed).toHaveBeenCalledOnce();
    expect(player.stopLoad).toHaveBeenCalledOnce();
    video.dispatchEvent(new Event('playing'));
    video.dispatchEvent(new Event('error'));
    expect(callbacks.ready).not.toHaveBeenCalled();
    expect(callbacks.failed).toHaveBeenCalledOnce();
    dispose();
    expect(player.destroy).toHaveBeenCalledOnce();
  });
  it('cancels recovery and releases the stream when the viewer closes', async () => {
    const { callbacks, video, dispose } = fixture();
    const player = mock.players[0];
    player.handlers.get('error')('error', { fatal: true, type: 'network' });
    dispose();
    await vi.advanceTimersByTimeAsync(25000);
    video.dispatchEvent(new Event('playing'));
    expect(player.destroy).toHaveBeenCalledOnce();
    expect(player.startLoad).not.toHaveBeenCalled();
    expect(callbacks.ready).not.toHaveBeenCalled();
    expect(callbacks.failed).not.toHaveBeenCalled();
  });
  it('uses native HLS and removes its listeners on close', () => {
    mock.supported = false;
    const { video, callbacks, dispose } = fixture('probably');
    expect(video.src).toContain('live.m3u8');
    video.dispatchEvent(new Event('loadeddata'));
    expect(callbacks.ready).toHaveBeenCalledOnce();
    dispose();
    video.dispatchEvent(new Event('loadeddata'));
    expect(callbacks.ready).toHaveBeenCalledOnce();
  });
  it('reports unsupported and stalled sources instead of loading forever', async () => {
    mock.supported = false;
    const unsupported = fixture();
    expect(unsupported.callbacks.failed).toHaveBeenCalledOnce();
    unsupported.dispose();
    mock.supported = true;
    const stalled = fixture();
    await vi.advanceTimersByTimeAsync(20000);
    expect(stalled.callbacks.failed).toHaveBeenCalledOnce();
    stalled.dispose();
  });
});
