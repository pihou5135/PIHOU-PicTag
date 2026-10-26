// Node.js 22.18+ / 24+: node --test tests/coverage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { getImageGeometry, EDGE_LABELS } from '../services/coverage.ts';
import { processImageWithWatermark } from '../services/canvasUtils.ts';

const settings = {
  enableCrop: true, cropWidth: 600, cropHeight: 400,
  enableResize: false, resizeWidth: 500, resizeHeight: 500, maintainAspectRatio: true,
};
const edges = (width, height, x = 0, y = 0, scale = 1, overrides = {}) =>
  getImageGeometry(width, height, { ...settings, ...overrides }, x, y, scale).uncoveredEdges;

test('default and exact crop coverage have no warning', () => {
  assert.deepEqual(edges(600, 400), []);
  assert.deepEqual(edges(1200, 800, 0, 0, 0.5), []);
  assert.deepEqual(edges(1200, 800), []);
});

test('shrinking below the output exposes all four edges', () => {
  assert.deepEqual(edges(600, 400, 0, 0, 0.9), ['top', 'right', 'bottom', 'left']);
});

for (const [edge, x, y] of [['top', 0, 1], ['right', -1, 0], ['bottom', 0, -1], ['left', 1, 0]]) {
  test(`reports only ${edge} when dragged one output pixel past that edge`, () => {
    assert.deepEqual(edges(600, 400, x, y), [edge]);
  });
}

test('enlarged images can move inside their excess without warnings', () => {
  assert.deepEqual(edges(600, 400, 300, 200, 2), []);
  assert.deepEqual(edges(600, 400, -300, -200, 2), []);
  assert.deepEqual(edges(600, 400, 300.25, 200, 2), ['left']);
});

test('landscape, portrait, and square output use the actual dimensions', () => {
  assert.deepEqual(edges(1200, 300), ['top', 'bottom']);
  assert.deepEqual(edges(300, 1200), ['right', 'left']);
  assert.deepEqual(edges(800, 400, 0, 0, 1, { cropWidth: 400, cropHeight: 800 }), ['top', 'bottom']);
  assert.deepEqual(edges(400, 800, 0, 0, 2, { cropWidth: 800, cropHeight: 800 }), []);
});

test('canvas dimensions are truncated before centering, matching the exported canvas', () => {
  const geometry = getImageGeometry(600, 400, { ...settings, cropWidth: 600.9, cropHeight: 400.8 });
  assert.equal(geometry.canvasWidth, 600);
  assert.equal(geometry.canvasHeight, 400);
  assert.equal(geometry.drawX, 0);
  assert.equal(geometry.drawY, 0);
  assert.deepEqual(geometry.uncoveredEdges, []);
});

test('floating point roundoff is ignored but a real subpixel gap is reported', () => {
  assert.deepEqual(edges(600, 400, 0, 0, 1 - Number.EPSILON), []);
  assert.deepEqual(edges(600, 400, 1e-6), ['left']);
  assert.deepEqual(edges(600, 400, -1e-6), ['right']);
});

test('only output geometry matters, without preview size or pixel sampling', () => {
  const input = { ...settings, previewWidth: 80, devicePixelRatio: 3, transparentBorder: true };
  assert.deepEqual(getImageGeometry(600, 400, input).uncoveredEdges, []);
  assert.deepEqual(getImageGeometry(600, 400, { ...input, previewWidth: 1000, devicePixelRatio: 1 }, 1).uncoveredEdges, ['left']);
});

test('correction, reset, changing source, and disabling crop leave no stale warning', () => {
  assert.deepEqual(edges(600, 400, 10), ['left']);
  assert.deepEqual(edges(600, 400, 0), []);
  assert.deepEqual(edges(600, 400, 0, 0, 0.5), ['top', 'right', 'bottom', 'left']);
  assert.deepEqual(edges(600, 400, 0, 0, 1), []);
  assert.deepEqual(edges(1200, 800, 10), []);
  assert.deepEqual(edges(600, 400, 100, 100, 0.2, { enableCrop: false }), []);
});

test('resize with and without aspect ratio fully covers its output, independent of crop offsets', () => {
  const fit = getImageGeometry(800, 600, { ...settings, enableCrop: false, enableResize: true }, 100, 100, 0.2);
  assert.deepEqual([fit.canvasWidth, fit.canvasHeight, fit.drawX, fit.drawY, fit.drawWidth, fit.drawHeight], [500, 375, 0, 0, 500, 375]);
  assert.deepEqual(fit.uncoveredEdges, []);
  const stretch = getImageGeometry(800, 600, { ...settings, enableCrop: false, enableResize: true, maintainAspectRatio: false });
  assert.deepEqual([stretch.drawWidth, stretch.drawHeight], [500, 500]);
  assert.deepEqual(stretch.uncoveredEdges, []);
});

test('crop remains the output boundary when resize is also enabled', () => {
  const geometry = getImageGeometry(600, 400, { ...settings, enableResize: true }, 2);
  assert.deepEqual([geometry.canvasWidth, geometry.canvasHeight], [600, 400]);
  assert.deepEqual(geometry.uncoveredEdges, ['left']);
});

test('mixed batch results remain specific to each source rectangle', () => {
  const sources = [[600, 400, 0, 0, 1], [600, 400, 0, 0, 0.8], [1200, 800, 50, -50, 1]];
  assert.deepEqual(sources.map(args => edges(...args)), [[], ['top', 'right', 'bottom', 'left'], []]);
  assert.deepEqual(EDGE_LABELS, { top: '上', right: '右', bottom: '下', left: '左' });
});

test('PNG and JPEG Canvas drawing uses the same rectangle, without drawing warning graphics', async () => {
  const originalDocument = globalThis.document;
  try {
    for (const format of ['image/png', 'image/jpeg']) {
      const calls = [];
      const context = { drawImage: (...args) => calls.push(args) };
      const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: mime => `data:${mime};base64,AA==` };
      globalThis.document = {
        fonts: { load: async () => {} },
        createElement: name => { assert.equal(name, 'canvas'); return canvas; },
      };
      const image = { width: 800, height: 600 };
      const crop = { ...settings, cropWidth: 501.8, cropHeight: 400.8, enableTextWatermark: false, enableImageWatermark: false };
      const geometry = getImageGeometry(800, 600, crop, 12.5, -10, 0.45);
      const result = await processImageWithWatermark(image, crop, 12.5, -10, 0.45, format);
      assert.deepEqual([canvas.width, canvas.height], [501, 400]);
      assert.deepEqual(calls, [[image, geometry.drawX, geometry.drawY, geometry.drawWidth, geometry.drawHeight]]);
      assert.equal(result, `data:${format};base64,AA==`);
    }
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
