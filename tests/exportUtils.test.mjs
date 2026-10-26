// Run with Node.js 22.18+ / 24+: node --test tests/exportUtils.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { getExportFilename, getUniqueExportFilename, getExportEntries } from '../services/exportUtils.ts';

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

test('real ZIP preserves all ready payloads and unique MIME-based names', async () => {
  const images = [
    ['photo.webp', 'image/webp'], ['photo.jpeg', 'image/jpeg'],
    ['photo.png', 'image/png'], ['photo (2).png', 'image/png'],
    ['photo.webp', 'image/png'], ['PHOTO.png', 'image/png'],
  ].map(([name, mime], index) => ({
    file: { name }, status: 'done',
    processedUrl: `data:${mime};base64,${Buffer.from('payload-' + index).toString('base64')}`,
  }));
  images.push({ file: { name: 'pending.png' }, status: 'pending', processedUrl: null });
  const entries = getExportEntries(images);
  assert.deepEqual(entries.map(entry => entry.filename), [
    'photo.webp', 'photo.jpg', 'photo.png', 'photo (2).png', 'photo (3).png', 'PHOTO (4).png',
  ]);
  const zip = new JSZip();
  entries.forEach(entry => zip.file(entry.filename, entry.base64, { base64: true }));
  const archive = await JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer' }));
  assert.equal(Object.keys(archive.files).length, 6);
  for (const [index, entry] of entries.entries()) {
    assert.equal(await archive.file(entry.filename).async('string'), 'payload-' + index);
  }
});

test('single export keeps actual output URL and MIME extension', () => {
  for (const [mime, extension] of [['image/webp', 'webp'], ['image/jpeg', 'jpg'], ['image/png', 'png']]) {
    const image = { file: { name: 'photo.jpeg' }, status: 'done', processedUrl: `data:${mime};base64,AA==` };
    const [entry] = getExportEntries([image]);
    assert.equal(entry.url, image.processedUrl);
    assert.equal(entry.filename, 'photo.' + extension);
  }
});
