/** Deduplicate first loads, retry temporary failures and release failed keys. */
export function createLayerLoader() {
  const loaded = new Set<string>();
  const pending = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  const load = (key: string, action: () => Promise<boolean>) => {
    if (disposed || loaded.has(key) || pending.has(key)) return;
    pending.add(key);
    const attempt = async (number: number) => {
      let ok = false;
      try { ok = await action(); } catch { /* handled like an HTTP failure */ }
      if (disposed) return;
      if (ok) {
        loaded.add(key);
        pending.delete(key);
      } else if (number < 3) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          void attempt(number + 1);
        }, number * 2000);
        timers.add(timer);
      } else {
        // A later user toggle can try again, even after the retry budget ends.
        pending.delete(key);
      }
    };
    void attempt(1);
  };
  return {
    load,
    dispose() {
      disposed = true;
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}
