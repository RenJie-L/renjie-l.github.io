import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const dist = resolve(process.cwd(), 'dist');
const headOf = (html) => html.slice(0, html.indexOf('</head>'));

test('the production build contains the primary routes and search bundle', async () => {
  const expectedFiles = [
    'index.html',
    'writing/index.html',
    'projects/index.html',
    'en/index.html',
    'en/projects/index.html',
    'experiments/genshin/index.html',
    'experiments/gaussian-splat/index.html',
    'en/experiments/gaussian-splat/index.html',
    'pagefind/pagefind.js',
  ];

  await Promise.all(expectedFiles.map((file) => access(resolve(dist, file))));
});

test('Gaussian splat experiences expose camera, performance, and localized help controls', async () => {
  const [chinese, english] = await Promise.all([
    readFile(resolve(dist, 'experiments/gaussian-splat/index.html'), 'utf8'),
    readFile(resolve(dist, 'en/experiments/gaussian-splat/index.html'), 'utf8'),
  ]);

  for (const html of [chinese, english]) {
    assert.match(html, /data-camera-mode="orbit"/);
    assert.match(html, /data-camera-mode="fly"/);
    assert.match(html, /data-performance-mode/);
    assert.match(html, /data-help-dialog/);
  }

  assert.match(chinese, /场景操作指南/);
  assert.match(chinese, /性能模式/);
  assert.match(english, /Explore the scene/);
  assert.match(english, /Performance mode/);
});

test('localized indexes emit canonical URLs without false translation alternates', async () => {
  const [home, writing, englishWriting] = await Promise.all([
    readFile(resolve(dist, 'index.html'), 'utf8'),
    readFile(resolve(dist, 'writing/index.html'), 'utf8'),
    readFile(resolve(dist, 'en/writing/index.html'), 'utf8'),
  ]);

  assert.match(
    home,
    /<link rel="canonical" href="https:\/\/renjie-l\.github\.io\/">/,
  );
  assert.match(
    writing,
    /<link rel="canonical" href="https:\/\/renjie-l\.github\.io\/writing\/">/,
  );
  assert.doesNotMatch(headOf(writing), /<link rel="alternate" hreflang="en"/);
  assert.doesNotMatch(
    headOf(englishWriting),
    /<link rel="alternate" hreflang="zh-CN"/,
  );
});

test('the sitemap does not pair placeholder locale indexes as translations', async () => {
  const sitemap = await readFile(resolve(dist, 'sitemap-0.xml'), 'utf8');

  for (const route of ['archive/', 'writing/', 'en/archive/', 'en/writing/']) {
    const marker = `<loc>https://renjie-l.github.io/${route}</loc>`;
    const markerIndex = sitemap.indexOf(marker);
    assert.notEqual(markerIndex, -1, `missing sitemap entry for /${route}`);

    const entryStart = sitemap.lastIndexOf('<url>', markerIndex);
    const entryEnd = sitemap.indexOf('</url>', markerIndex);
    const entry = sitemap.slice(entryStart, entryEnd);
    assert.doesNotMatch(entry, /xhtml:link/);
  }
});
