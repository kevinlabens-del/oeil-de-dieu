import Hls from 'hls.js';

/** One player lifetime: bounded recovery and complete cleanup on camera change. */
export function attachLiveVideo(video: HTMLVideoElement, url: string, callbacks: {
  ready: () => void;
  loading: () => void;
  failed: () => void;
}) {
  let disposed = false;
  let retries = 0;
  let recovery: ReturnType<typeof setTimeout> | undefined;
  let hls: Hls | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const clearDeadline = () => clearTimeout(deadline);
  const fail = () => {
    if (disposed) return;
    // A terminal failure removes the video from the viewer. Late media events
    // must not resurrect an empty element after that failed session.
    disposed = true;
    clearDeadline();
    clearTimeout(recovery);
    hls?.stopLoad();
    hls?.destroy();
    hls = undefined;
    video.pause();
    video.removeAttribute('src');
    video.load();
    callbacks.failed();
  };
  const armDeadline = () => {
    clearDeadline();
    deadline = setTimeout(fail, 20000);
  };
  const ready = () => {
    if (disposed) return;
    clearDeadline();
    callbacks.ready();
  };
  const play = () => {
    if (!disposed) void video.play().catch(() => { /* native controls allow a user gesture */ });
  };
  const waiting = () => {
    if (disposed) return;
    callbacks.loading();
    armDeadline();
  };
  video.addEventListener('playing', ready);
  video.addEventListener('loadeddata', ready);
  video.addEventListener('waiting', waiting);
  video.addEventListener('error', fail);
  armDeadline();

  if (Hls.isSupported()) {
    hls = new Hls({
      enableWorker: false,
      lowLatencyMode: true,
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 5,
      maxLiveSyncPlaybackRate: 1.5,
      backBufferLength: 15,
      maxBufferLength: 8,
    });
    hls.on(Hls.Events.MANIFEST_PARSED, play);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (disposed || !data.fatal) return;
      if (retries++ >= 2) { fail(); return; }
      waiting();
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        clearTimeout(recovery);
        recovery = setTimeout(() => { if (!disposed) hls?.startLoad(); }, 1500);
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls?.recoverMediaError();
      } else fail();
    });
    hls.loadSource(url);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', play);
    play();
  } else fail();

  return () => {
    disposed = true;
    clearDeadline();
    clearTimeout(recovery);
    video.removeEventListener('playing', ready);
    video.removeEventListener('loadeddata', ready);
    video.removeEventListener('waiting', waiting);
    video.removeEventListener('error', fail);
    video.removeEventListener('loadedmetadata', play);
    hls?.destroy();
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
}
