import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLayerLoader } from './layer-loader';

afterEach(() => vi.useRealTimers());

describe('layer recovery', () => {
  it('retries failed first loads without a second toggle, then keeps the result', async () => {
    vi.useFakeTimers();
    const loader = createLayerLoader();
    const fetch = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    loader.load('satellites', fetch);
    loader.load('satellites', fetch);
    await vi.advanceTimersByTimeAsync(2000);
    loader.load('satellites', fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    loader.dispose();
  });

  it('bounds automatic retries and permits a later manual retry', async () => {
    vi.useFakeTimers();
    const loader = createLayerLoader();
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    loader.load('fires', fetch);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(3);
    fetch.mockResolvedValue(true);
    loader.load('fires', fetch);
    expect(fetch).toHaveBeenCalledTimes(4);
    loader.dispose();
  });

  it('stops pending retries on unmount, including an in-flight failure', async () => {
    vi.useFakeTimers();
    const loader = createLayerLoader();
    const fetch = vi.fn().mockResolvedValue(false);
    loader.load('weather', fetch);
    loader.dispose();
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
