import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_DIR = path.resolve('src');
const TEXT_EXTENSIONS = new Set([
  '.astro',
  '.css',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const TENCENT_IMAGE_URL =
  /(?:https?:)?\/\/qhstaticssl\.kujiale\.com\/[^\s"'()<>]+/g;
const WEBP_TRANSFORM = 'imageMogr2/format/webp';

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(entryPath);
      return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

const violations = [];
const files = await collectSourceFiles(SOURCE_DIR);

for (const file of files) {
  const source = await readFile(file, 'utf8');

  for (const match of source.matchAll(TENCENT_IMAGE_URL)) {
    if (match[0].includes(WEBP_TRANSFORM)) continue;
    violations.push({
      file: path.relative(process.cwd(), file),
      line: lineNumberAt(source, match.index ?? 0),
      url: match[0],
    });
  }
}

if (violations.length > 0) {
  console.error(
    'Tencent Cloud image URLs must include ?imageMogr2/format/webp:',
  );
  for (const violation of violations) {
    console.error(
      `  ${violation.file}:${violation.line}\n    ${violation.url}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${files.length} source files: all Tencent Cloud images request WebP.`,
  );
}
