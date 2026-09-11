import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/scripts/gaussian-splat/SpzPreview.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { SpzPreview } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function fixture(version, sh = 0) {
  const count = 7;
  const widths = [9, 1, 3, 3, version === 3 ? 4 : 3];
  const bytes = new Uint8Array(
    16 + count * (widths.reduce((a, b) => a + b) + [0, 9, 24, 45][sh]),
  );
  const header = new DataView(bytes.buffer);
  header.setUint32(0, 0x5053474e, true);
  header.setUint32(4, version, true);
  header.setUint32(8, count, true);
  bytes[12] = sh;
  bytes[13] = 12;
  bytes[14] = 1;
  for (let i = 16; i < bytes.length; i++) bytes[i] = (i * 37) % 256;
  return { bytes, count, widths };
}

for (const version of [2, 3]) {
  test(`v${version}: every split point yields byte-identical base attributes`, () => {
    const { bytes, count, widths } = fixture(version, 3);
    for (let split = 0; split <= bytes.length; split++) {
      const parser = new SpzPreview();
      parser.push(bytes.subarray(0, split));
      parser.push(bytes.subarray(split));
      const snapshot = parser.snapshot(count);
      const expected = bytes.slice(
        0,
        16 + count * widths.reduce((a, b) => a + b),
      );
      expected[12] = 0;
      assert.deepEqual(snapshot.bytes, expected);
      assert.equal(parser.available, count);
      parser.finish();
    }
  });
  test(`v${version}: preview only includes complete rotations and samples matching attributes`, () => {
    const { bytes, count, widths } = fixture(version);
    const parser = new SpzPreview();
    const end = 16 + count * 16 + widths[4] * 5;
    for (const byte of bytes.subarray(0, end - 1))
      parser.push(Uint8Array.of(byte));
    assert.equal(parser.available, 4);
    const snapshot = parser.snapshot(2);
    let from = 16,
      to = 16;
    for (const width of widths) {
      for (const [output, input] of [
        [0, 0],
        [1, 2],
      ]) {
        assert.deepEqual(
          snapshot.bytes.slice(to + output * width, to + (output + 1) * width),
          bytes.slice(from + input * width, from + (input + 1) * width),
        );
      }
      from += count * width;
      to += 2 * width;
    }
    assert.throws(() => parser.finish(), /Truncated/);
  });
}

test('rejects unsupported headers and excess data before using them', () => {
  const { bytes } = fixture(3);
  for (const mutate of [
    (b) => {
      b[0] = 0;
    },
    (b) => {
      b[4] = 4;
    },
    (b) => {
      b[12] = 4;
    },
    (b) => {
      b[14] = 2;
    },
  ]) {
    const invalid = bytes.slice();
    mutate(invalid);
    assert.throws(() => new SpzPreview().push(invalid));
  }
  const parser = new SpzPreview();
  parser.push(bytes);
  assert.throws(() => parser.push(Uint8Array.of(0)), /Unexpected/);
});

// Execute the real browser worker protocol in a Node worker, against a local chunked HTTP response.
test('worker streams a preview, waits for acknowledgement, and returns original gzip bytes', async () => {
  const { Worker } = await import('node:worker_threads');
  const { createServer } = await import('node:http');
  const { gzipSync, gunzipSync } = await import('node:zlib');
  const workerSource = await readFile(
    new URL(
      '../src/scripts/gaussian-splat/SpzStreamWorker.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const parserUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  const workerCompiled = ts
    .transpileModule(workerSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    })
    .outputText.replace("'./SpzPreview'", JSON.stringify(parserUrl));
  const workerUrl = `data:text/javascript;base64,${Buffer.from(workerCompiled).toString('base64')}`;
  const { bytes, count } = fixture(3, 3);
  const gzip = gzipSync(bytes);
  let corrupt = false;
  const server = createServer((_request, response) => {
    const output = Buffer.from(gzip);
    if (corrupt) output[output.length - 8] ^= 1;
    for (let i = 0; i < output.length; i += 7)
      response.write(output.subarray(i, i + 7));
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const run = () =>
    new Promise((resolve, reject) => {
      const bootstrap = `import { parentPort } from 'node:worker_threads';
      globalThis.self = { postMessage: (data, options) => parentPort.postMessage(data, options?.transfer) };
      await import(${JSON.stringify(workerUrl)});
      parentPort.on('message', data => self.onmessage({data}));`;
      const worker = new Worker(
        new URL(
          `data:text/javascript;base64,${Buffer.from(bootstrap).toString('base64')}`,
        ),
      );
      let previews = 0;
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timed out'));
      }, 15000);
      const finish = (error, value) => {
        clearTimeout(timer);
        worker.terminate();
        if (error) reject(error);
        else resolve(value);
      };
      worker.on('error', (error) => finish(error));
      worker.on('message', (data) => {
        try {
          if (data.type === 'preview') {
            previews++;
            const decoded = gunzipSync(new Uint8Array(data.fileBytes));
            assert.equal(decoded.readUInt32LE(8), count);
            assert.equal(decoded[12], 0);
            assert.equal(decoded.length, 16 + count * 20);
            worker.postMessage({ type: 'ack' });
          }
          if (data.type === 'complete') {
            assert.ok(previews > 0);
            assert.deepEqual(
              new Uint8Array(data.fileBytes),
              new Uint8Array(gzip),
            );
            finish(null, 'complete');
          }
          if (data.type === 'error') finish(null, 'error');
        } catch (error) {
          finish(error);
        }
      });
      worker.postMessage({
        type: 'load',
        url: `http://127.0.0.1:${server.address().port}/test.spz`,
        budget: 32,
      });
    });
  try {
    assert.equal(await run(), 'complete');
    corrupt = true;
    assert.equal(
      await run(),
      'error',
      'Gzip checksum failures must not publish a complete scene',
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
