// Run with Node.js 22.18+ / 24+: node --test tests/exportUtils.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { getExportFilename, getUniqueExportFilename } from '../services/exportUtils.ts';

for (const [mime, extension] of [['image/webp', 'webp'], ['image/jpeg', 'jpg'], ['image/png', 'png']]) {
  test(`actual ${mime} output determines the extension, regardless of source name`, () => {
    for (const source of ['photo.webp', 'photo.jpeg', 'photo.png']) {
      assert.equal(getExportFilename(source, `data:${mime};base64,AA==`), `photo.${extension}`);
    }
  });
}

test('handles extensionless names, multiple dots and hidden names', () => {
  const url = 'data:image/png;base64,AA==';
  assert.equal(getExportFilename('photo', url), 'photo.png');
  assert.equal(getExportFilename('photo.final.webp', url), 'photo.final.png');
  assert.equal(getExportFilename('.photo', url), '.photo.png');
});

test('avoids repeated, numbered and case-insensitive collisions', () => {
  const used = new Set();
  const names = ['photo.png', 'photo (2).png', 'photo.png', 'PHOTO.png', 'photo.webp'];
  assert.deepEqual(names.map(name => getUniqueExportFilename(name, used)),
    ['photo.png', 'photo (2).png', 'photo (3).png', 'PHOTO (4).png', 'photo.webp']);
  assert.equal(getUniqueExportFilename('photo.png', new Set()), 'photo.png');
});

test('ZIP handler keeps every completed image and its payload', async () => {
  const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const body = source.split('const handleDownloadAll = async () => {')[1].split('\n  };')[0];
  const entries = new Map();
  class FakeZip {
    file(name, data, options) {
      assert.equal(options.base64, true);
      assert.equal(entries.has(name), false, 'ZIP entries must not be overwritten');
      entries.set(name, data);
    }
    async generateAsync() { return new Blob(); }
  }
  const images = [
    ['photo.webp', 'image/webp'], ['photo.jpeg', 'image/jpeg'],
    ['photo.png', 'image/png'], ['photo (2).png', 'image/png'],
    ['photo.webp', 'image/png'], ['PHOTO.png', 'image/png'],
  ].map(([name, mime], i) => ({
    file: { name }, status: 'done',
    processedUrl: `data:${mime};base64,${Buffer.from('payload-' + i).toString('base64')}`,
  }));
  images.push({ file: { name: 'pending.png' }, status: 'pending', processedUrl: null });
  const link = { click() {} };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction('images', 'JSZip', 'getExportFilename', 'getUniqueExportFilename', 'URL', 'document', 'alert',
    stripTypeScriptTypes('async function handler() {' + body + '\n}').replace(/^async function handler\(\) \{/, '').replace(/\}\s*$/, ''));
  await run(images, FakeZip, getExportFilename, getUniqueExportFilename,
    { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    { createElement: () => link }, () => assert.fail('unexpected alert'));
  assert.deepEqual([...entries.keys()], [
    'photo.webp', 'photo.jpg', 'photo.png', 'photo (2).png', 'photo (3).png', 'PHOTO (4).png',
  ]);
  assert.deepEqual([...entries.values()], images.slice(0, 6).map(img => img.processedUrl.split(',')[1]));
  assert.match(link.download, /^PicTag_Export_\d+\.zip$/);
});

test('single-download handler uses the shared MIME mapping', () => {
  const source = readFileSync(new URL('../components/ImageCard.tsx', import.meta.url), 'utf8');
  const body = source.split('onClick={() => {')[1].split('\n              }}')[0];
  const run = new Function('image', 'downloadUrl', 'getExportFilename', stripTypeScriptTypes(body));
  for (const [mime, ext] of [['image/webp', 'webp'], ['image/jpeg', 'jpg'], ['image/png', 'png']]) {
    const image = { file: { name: 'photo.jpeg' }, processedUrl: `data:${mime};base64,AA==` };
    run(image, (url, filename) => {
      assert.equal(url, image.processedUrl);
      assert.equal(filename, `photo.${ext}`);
    }, getExportFilename);
  }
});
