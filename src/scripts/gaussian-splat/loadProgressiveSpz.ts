export function loadProgressiveSpz(options: {
  url: string;
  budget: number;
  signal: AbortSignal;
  onProgress: (loaded: number, total: number) => void;
  onPreview: (fileBytes: ArrayBuffer, bounds: number[]) => Promise<void>;
}): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./SpzStreamWorker.ts', import.meta.url),
      { type: 'module' },
    );
    const cleanup = () => {
      worker.terminate();
      options.signal.removeEventListener('abort', abort);
    };
    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const abort = () =>
      fail(new DOMException('Scene load cancelled', 'AbortError'));
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) {
      abort();
      return;
    }
    worker.onerror = (event) => fail(new Error(event.message));
    worker.onmessage = async ({ data }) => {
      try {
        if (data.type === 'progress')
          options.onProgress(data.loaded, data.total);
        if (data.type === 'preview') {
          await options.onPreview(data.fileBytes, data.bounds);
          if (!options.signal.aborted) worker.postMessage({ type: 'ack' });
        }
        if (data.type === 'complete') {
          cleanup();
          resolve(data.fileBytes);
        }
        if (data.type === 'error') fail(new Error(data.message));
      } catch (error) {
        fail(error);
      }
    };
    worker.postMessage({
      type: 'load',
      url: options.url,
      budget: options.budget,
    });
  });
}
