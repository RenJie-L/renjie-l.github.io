import { SpzPreview } from './SpzPreview';

let acknowledge: (() => void) | undefined;
self.onmessage = (event: MessageEvent) => {
  if (event.data.type === 'ack') acknowledge?.();
  if (event.data.type === 'load') {
    load(event.data.url, event.data.budget).catch((error) => {
      self.postMessage({ type: 'error', message: String(error) });
    });
  }
};

async function load(url: string, budget: number) {
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`SPZ download failed: ${response.status}`);
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const total = Number(response.headers.get('Content-Length')) || 0;
  let lastProgress = 0;
  const compressed = response.body.pipeThrough(
    new TransformStream<Uint8Array<ArrayBuffer>, BufferSource>({
      transform(chunk, controller) {
        chunks.push(chunk);
        loaded += chunk.length;
        if (performance.now() - lastProgress > 150) {
          self.postMessage({ type: 'progress', loaded, total });
          lastProgress = performance.now();
        }
        controller.enqueue(chunk);
      },
    }),
  );
  const reader = compressed
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();
  const parser = new SpzPreview();
  let stage = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(value);
      const thresholds = [
        Math.min(65536, parser.count),
        Math.ceil(parser.count / 2),
        parser.count,
      ];
      if (
        stage < thresholds.length &&
        parser.available >= thresholds[stage] &&
        parser.available > 0
      ) {
        // At most three bounded snapshots; never upload a growing multi-million-splat texture.
        const { bytes, bounds, count } = parser.snapshot(budget);
        const fileBytes = await new Response(
          new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),
        ).arrayBuffer();
        const ack = new Promise<void>((resolve) => {
          acknowledge = resolve;
        });
        self.postMessage(
          { type: 'preview', fileBytes, bounds, count },
          { transfer: [fileBytes] },
        );
        await ack;
        acknowledge = undefined;
        while (
          stage < thresholds.length &&
          parser.available >= thresholds[stage]
        )
          stage++;
      }
    }
    parser.finish();
    const fileBytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      fileBytes.set(chunk, offset);
      offset += chunk.length;
    }
    chunks.length = 0;
    self.postMessage(
      { type: 'complete', fileBytes: fileBytes.buffer },
      { transfer: [fileBytes.buffer] },
    );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
