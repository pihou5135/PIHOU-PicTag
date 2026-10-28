import test from 'node:test';
import assert from 'node:assert/strict';

const base = {
  enableCrop: false, cropWidth: 1000, cropHeight: 800,
  enableResize: false, resizeWidth: 500, resizeHeight: 500, maintainAspectRatio: true,
  text: '水印 Hello', fontSize: 72, fontWeight: '700', color: '#19a488', opacity: 0.45,
  marginX: 37, marginY: 25, usePrefix: false, enableTextWatermark: false,
  watermarkImage: null, watermarkOpacity: 0.6, watermarkScale: 0.5,
  watermarkPosition: 'bottom-right', enableImageWatermark: false,
  enableFormatConversion: false, targetFormat: 'image/png', enableSizeLimit: false, maxFileSizeMB: 10,
};
const source = { width: 1000, height: 800, name: 'source' };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
let moduleNumber = 0;

function fakeCanvas() {
  const operations = [];
  const state = () => ({
    font: '', fillStyle: '', globalAlpha: 1, textAlign: '', textBaseline: '', fontKerning: 'auto',
    shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
  });
  let transform = [1, 0, 0, 1, 0, 0];
  const styles = () => Object.fromEntries(Object.keys(state()).map(key => [key, context[key]]));
  const context = {
    ...state(),
    setTransform: (...values) => { transform = values; operations.push({ kind: 'transform', values }); },
    drawImage: (...args) => operations.push({ kind: 'image', args, styles: styles(), transform: [...transform] }),
    fillText: (...args) => operations.push({ kind: 'text', args, styles: styles(), transform: [...transform] }),
  };
  const dimensions = { width: 17, height: 19 };
  const canvas = {
    get width() { return dimensions.width; },
    set width(value) { dimensions.width = value; Object.assign(context, state()); operations.push({ kind: 'width', value }); },
    get height() { return dimensions.height; },
    set height(value) { dimensions.height = value; Object.assign(context, state()); operations.push({ kind: 'height', value }); },
    getContext(type) { assert.equal(type, '2d'); return context; },
    toDataURL(...args) { operations.push({ kind: 'encode', args }); return `data:${args[0]};base64,AA==`; },
  };
  return { canvas, operations, drawings: () => operations.filter(op => op.kind === 'image' || op.kind === 'text') };
}

async function withRuntime(callback, { fontLoad = async () => [], imageLoad = async () => ({ width: 100, height: 60 }), imageDecode = async () => {} } = {}) {
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  const originalWarn = console.warn;
  const fontCalls = [], imageCalls = [], decodeCalls = [], canvases = [], warnings = [];
  globalThis.document = {
    fonts: { load: (...args) => { fontCalls.push(args); return fontLoad(...args); } },
    createElement(name) { assert.equal(name, 'canvas'); const mock = fakeCanvas(); canvases.push(mock); return mock.canvas; },
  };
  globalThis.Image = class {
    decode() { decodeCalls.push(this.url); return imageDecode(this.url, decodeCalls.filter(url => url === this.url).length); }
    set src(value) {
      this.url = value;
      imageCalls.push(value);
      const attempt = imageCalls.filter(url => url === value).length;
      Promise.resolve().then(() => imageLoad(value, attempt)).then(dimensions => {
        Object.assign(this, dimensions);
        this.onload?.();
      }, error => this.onerror?.(error));
    }
  };
  console.warn = (...args) => warnings.push(args);
  try {
    const url = new URL('../services/canvasUtils.ts', import.meta.url);
    url.searchParams.set('test', String(++moduleNumber));
    const api = await import(url.href);
    await callback({ ...api, fontCalls, imageCalls, decodeCalls, canvases, warnings });
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalImage === undefined) delete globalThis.Image;
    else globalThis.Image = originalImage;
    console.warn = originalWarn;
  }
}

test('default composition draws the original without loading disabled watermarks or encoding', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, fontCalls, imageCalls }) => {
    const mock = fakeCanvas();
    assert.equal(await renderCompositionToCanvas(mock.canvas, source, base), true);
    assert.deepEqual([mock.canvas.width, mock.canvas.height], [1000, 800]);
    assert.deepEqual(mock.drawings().map(call => call.args), [[source, 0, 0, 1000, 800]]);
    assert.equal(mock.drawings()[0].styles.globalAlpha, 1);
    assert.equal(mock.drawings()[0].styles.imageSmoothingQuality, 'high');
    assert.deepEqual(fontCalls, []);
    assert.deepEqual(imageCalls, []);
    assert.equal(mock.operations.some(op => op.kind === 'encode'), false);
  });
});

test('text uses all existing styles, actual-output margins, prefix, and shadows', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, fontCalls }) => {
    const mock = fakeCanvas();
    await renderCompositionToCanvas(mock.canvas, source, { ...base, enableTextWatermark: true, usePrefix: true });
    const text = mock.drawings()[1];
    assert.deepEqual(text.args, ['* 水印 Hello', 37, 775]);
    assert.equal(text.styles.font, '700 72px "Noto Sans SC"');
    assert.equal(text.styles.fillStyle, '#19a488');
    assert.equal(text.styles.globalAlpha, 0.45);
    assert.equal(text.styles.textAlign, 'left');
    assert.equal(text.styles.textBaseline, 'bottom');
    assert.equal(text.styles.fontKerning, 'normal');
    assert.equal(text.styles.shadowBlur, 6);
    assert.equal(text.styles.shadowOffsetX, 3);
    assert.equal(text.styles.shadowOffsetY, 3);
    assert.equal(text.styles.shadowColor, 'rgba(0, 0, 0, 0.6)');
    assert.deepEqual(fontCalls, [['700 72px "Noto Sans SC"', '* 水印 Hello']]);
  });
});

test('prefix is not duplicated and empty or disabled text is not drawn or loaded', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, fontCalls }) => {
    const mock = fakeCanvas();
    await renderCompositionToCanvas(mock.canvas, source, { ...base, enableTextWatermark: true, usePrefix: true, text: '* 已有前缀' });
    assert.equal(mock.drawings()[1].args[0], '* 已有前缀');
    for (const override of [{ text: '' }, { enableTextWatermark: false }]) {
      const empty = fakeCanvas();
      await renderCompositionToCanvas(empty.canvas, source, { ...base, enableTextWatermark: true, ...override });
      assert.equal(empty.drawings().length, 1);
    }
    assert.equal(fontCalls.length, 1);
  });
});

for (const [position, x, y] of [
  ['center', 475, 385], ['bottom-right', 913, 745], ['bottom-left', 37, 745],
  ['top-right', 913, 25], ['top-left', 37, 25],
]) {
  test(`image watermark ${position} keeps its original scale, opacity, and margins`, async () => {
    await withRuntime(async ({ renderCompositionToCanvas }) => {
      const mock = fakeCanvas();
      await renderCompositionToCanvas(mock.canvas, source, {
        ...base, enableImageWatermark: true, watermarkImage: 'data:watermark', watermarkPosition: position,
      });
      const watermark = mock.drawings()[1];
      assert.deepEqual(watermark.args.slice(1), [x, y, 50, 30]);
      assert.equal(watermark.styles.globalAlpha, 0.6);
      assert.equal(watermark.styles.shadowColor, 'transparent');
      assert.equal(watermark.styles.shadowBlur, 0);
      assert.equal(watermark.styles.shadowOffsetX, 0);
      assert.equal(watermark.styles.shadowOffsetY, 0);
    });
  });
}

for (const [position, x, y] of [
  ['center', 475, 385], ['bottom-right', 913, 745], ['bottom-left', 37, 745],
  ['top-right', 913, 25], ['top-left', 37, 25],
]) {
  test(`image watermark ${position} applies signed fractional offsets without moving text or source`, async () => {
    await withRuntime(async ({ renderCompositionToCanvas }) => {
      const mock = fakeCanvas();
      await renderCompositionToCanvas(mock.canvas, source, {
        ...base, enableTextWatermark: true, enableImageWatermark: true,
        watermarkImage: 'offset', watermarkPosition: position,
        watermarkOffsetX: 18.5, watermarkOffsetY: -42.25,
      });
      assert.deepEqual(mock.drawings()[0].args, [source, 0, 0, 1000, 800]);
      assert.deepEqual(mock.drawings()[1].args, ['水印 Hello', 37, 775]);
      assert.deepEqual(mock.drawings()[2].args.slice(1), [x + 18.5, y - 42.25, 50, 30]);
    });
  });
}

test('missing and non-finite image offsets fall back independently to zero for old presets', async () => {
  await withRuntime(async ({ renderCompositionToCanvas }) => {
    for (const [offsets, x, y] of [
      [{}, 913, 745],
      [{ watermarkOffsetX: NaN, watermarkOffsetY: -12 }, 913, 733],
      [{ watermarkOffsetX: -8.5, watermarkOffsetY: Infinity }, 904.5, 745],
      [{ watermarkOffsetX: -Infinity, watermarkOffsetY: NaN }, 913, 745],
      [{ watermarkOffsetX: '20', watermarkOffsetY: null }, 913, 745],
    ]) {
      const mock = fakeCanvas();
      await renderCompositionToCanvas(mock.canvas, source, {
        ...base, enableImageWatermark: true, watermarkImage: 'offset', ...offsets,
      });
      assert.deepEqual(mock.drawings()[1].args.slice(1), [x, y, 50, 30]);
    }
  });
});

test('image offsets are not clamped when a user places the watermark outside the canvas', async () => {
  await withRuntime(async ({ renderCompositionToCanvas }) => {
    const mock = fakeCanvas();
    await renderCompositionToCanvas(mock.canvas, source, {
      ...base, enableImageWatermark: true, watermarkImage: 'offset', watermarkPosition: 'top-left',
      watermarkOffsetX: -100, watermarkOffsetY: 900,
    });
    assert.deepEqual(mock.drawings()[1].args.slice(1), [-63, 925, 50, 30]);
  });
});

for (const [sizeSettings, dimensions, watermarkXY] of [
  [{ enableResize: true, resizeWidth: 500, resizeHeight: 500, maintainAspectRatio: true }, [500, 400], [430, 336]],
  [{ enableResize: true, resizeWidth: 300, resizeHeight: 700, maintainAspectRatio: false }, [300, 700], [230, 636]],
  [{ enableCrop: true, cropWidth: 401.8, cropHeight: 599.9 }, [401, 599], [331, 535]],
]) {
  test(`image offsets use actual ${dimensions.join('x')} output coordinates after crop or resize`, async () => {
    await withRuntime(async ({ renderCompositionToCanvas }) => {
      const mock = fakeCanvas();
      await renderCompositionToCanvas(mock.canvas, source, {
        ...base, ...sizeSettings, enableImageWatermark: true, watermarkImage: 'offset',
        watermarkOffsetX: 17, watermarkOffsetY: -9,
      }, 130, -75, 0.6);
      assert.deepEqual([mock.canvas.width, mock.canvas.height], dimensions);
      assert.deepEqual(mock.drawings()[1].args.slice(1), [...watermarkXY, 50, 30]);
    });
  });
}

test('thumbnail and full render share crop and watermark coordinates with explicitly scaled shadows', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, fontCalls, imageCalls }) => {
    const full = fakeCanvas(), thumbnail = fakeCanvas();
    const image = { width: 1200, height: 800 };
    const settings = { ...base, enableCrop: true, cropWidth: 900, cropHeight: 600,
      enableTextWatermark: true, enableImageWatermark: true, watermarkImage: 'data:watermark',
      watermarkOffsetX: -123.5, watermarkOffsetY: 18.25 };
    await Promise.all([
      renderCompositionToCanvas(full.canvas, image, settings, -50, 33, 0.7),
      renderCompositionToCanvas(thumbnail.canvas, image, settings, -50, 33, 0.7, { maxDimension: 300 }),
    ]);
    assert.deepEqual([thumbnail.canvas.width, thumbnail.canvas.height], [300, 200]);
    assert.deepEqual(full.drawings().map(op => op.args), thumbnail.drawings().map(op => op.args));
    assert.deepEqual(full.drawings()[0].args, [image, -20, 53, 840, 560]);
    assert.deepEqual(full.drawings()[2].args.slice(1), [689.5, 563.25, 50, 30]);
    assert.deepEqual(full.drawings().map(op => op.kind), ['image', 'text', 'image']);
    for (const op of thumbnail.drawings()) assert.deepEqual(op.transform, [1 / 3, 0, 0, 1 / 3, 0, 0]);
    assert.equal(full.drawings()[1].styles.shadowBlur, 6);
    assert.equal(thumbnail.drawings()[1].styles.shadowBlur, 2);
    assert.equal(thumbnail.drawings()[1].styles.shadowOffsetX, 1);
    assert.equal(thumbnail.drawings()[1].styles.shadowOffsetY, 1);
    assert.equal(fontCalls.length, 1);
    assert.equal(imageCalls.length, 1);
    assert.equal(thumbnail.operations.some(op => op.kind === 'encode'), false);
  });
});

test('bitmap rounding keeps output coordinates and per-axis shadows aligned, without upscaling', async () => {
  await withRuntime(async ({ renderCompositionToCanvas }) => {
    const mock = fakeCanvas();
    await renderCompositionToCanvas(mock.canvas, { width: 1001, height: 667 }, { ...base, enableTextWatermark: true }, 0, 0, 1, { maxDimension: 300 });
    assert.deepEqual([mock.canvas.width, mock.canvas.height], [300, 200]);
    assert.deepEqual(mock.drawings()[0].transform, [300 / 1001, 0, 0, 200 / 667, 0, 0]);
    assert.deepEqual(mock.drawings()[0].args.slice(1), [0, 0, 1001, 667]);
    assert.equal(mock.drawings()[1].styles.shadowOffsetX, 3 * 300 / 1001);
    assert.equal(mock.drawings()[1].styles.shadowOffsetY, 3 * 200 / 667);
    const largeCap = fakeCanvas();
    await renderCompositionToCanvas(largeCap.canvas, source, base, 0, 0, 1, { maxDimension: 2000 });
    assert.deepEqual([largeCap.canvas.width, largeCap.canvas.height], [1000, 800]);
  });
});

test('already stale previews neither request resources nor mutate the canvas', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, fontCalls, imageCalls }) => {
    const mock = fakeCanvas();
    const result = await renderCompositionToCanvas(mock.canvas, source,
      { ...base, enableTextWatermark: true, enableImageWatermark: true, watermarkImage: 'data:unused' },
      0, 0, 1, { isCurrent: () => false });
    assert.equal(result, false);
    assert.deepEqual(mock.operations, []);
    assert.deepEqual(fontCalls, []);
    assert.deepEqual(imageCalls, []);
  });
});

test('canvas is unchanged until both resources are ready and stale waiting work is discarded', async () => {
  const font = deferred(), watermark = deferred();
  await withRuntime(async ({ renderCompositionToCanvas }) => {
    const mock = fakeCanvas();
    let current = true;
    const result = renderCompositionToCanvas(mock.canvas, source,
      { ...base, enableTextWatermark: true, enableImageWatermark: true, watermarkImage: 'data:slow' },
      0, 0, 1, { isCurrent: () => current });
    await tick();
    assert.deepEqual(mock.operations, []);
    watermark.resolve({ width: 100, height: 60 });
    await tick();
    assert.deepEqual(mock.operations, []);
    current = false;
    font.resolve([]);
    assert.equal(await result, false);
    assert.deepEqual(mock.operations, []);
    assert.deepEqual([mock.canvas.width, mock.canvas.height], [17, 19]);
  }, { fontLoad: () => font.promise, imageLoad: () => watermark.promise });
});

test('a late old watermark cannot overwrite a newer completed render on the same canvas', async () => {
  const old = deferred();
  await withRuntime(async ({ renderCompositionToCanvas }) => {
    const mock = fakeCanvas();
    let revision = 1;
    const oldResult = renderCompositionToCanvas(mock.canvas, source,
      { ...base, enableImageWatermark: true, watermarkImage: 'old' }, 0, 0, 1, { isCurrent: () => revision === 1 });
    await tick();
    revision = 2;
    assert.equal(await renderCompositionToCanvas(mock.canvas, source,
      { ...base, enableImageWatermark: true, watermarkImage: 'new' }, 0, 0, 1, { isCurrent: () => revision === 2 }), true);
    const count = mock.operations.length;
    assert.equal(mock.drawings()[1].args[0].url, 'new');
    old.resolve({ width: 200, height: 200 });
    assert.equal(await oldResult, false);
    assert.equal(mock.operations.length, count);
  }, { imageLoad: url => url === 'old' ? old.promise : Promise.resolve({ width: 100, height: 60 }) });
});

test('render snapshots prevent settings mutation while waiting from mixing versions', async () => {
  const font = deferred();
  await withRuntime(async ({ renderCompositionToCanvas }) => {
    const mock = fakeCanvas();
    const settings = { ...base, enableTextWatermark: true, text: 'first', marginX: 20 };
    const result = renderCompositionToCanvas(mock.canvas, source, settings);
    settings.text = 'second'; settings.marginX = 90; settings.opacity = 0.9;
    font.resolve([]);
    await result;
    assert.deepEqual(mock.drawings()[1].args, ['first', 20, 775]);
    assert.equal(mock.drawings()[1].styles.globalAlpha, 0.45);
  }, { fontLoad: () => font.promise });
});

test('watermark failures are explicit, leave the old canvas intact, and can retry', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, imageCalls }) => {
    const mock = fakeCanvas();
    const settings = { ...base, enableImageWatermark: true, watermarkImage: 'retry' };
    await assert.rejects(renderCompositionToCanvas(mock.canvas, source, settings), /图片水印加载失败/);
    assert.deepEqual(mock.operations, []);
    assert.equal(await renderCompositionToCanvas(mock.canvas, source, settings), true);
    assert.equal(imageCalls.length, 2);
    assert.equal(mock.drawings().length, 2);
  }, { imageLoad: (url, attempt) => attempt === 1 ? Promise.reject(new Error('decode failed')) : Promise.resolve({ width: 100, height: 60 }) });
});

test('stale resource failures return false without showing errors or drawing', async () => {
  const watermark = deferred();
  await withRuntime(async ({ renderCompositionToCanvas }) => {
    const mock = fakeCanvas();
    let current = true;
    const result = renderCompositionToCanvas(mock.canvas, source,
      { ...base, enableImageWatermark: true, watermarkImage: 'failed-old' }, 0, 0, 1, { isCurrent: () => current });
    await tick(); current = false; watermark.reject(new Error('failed'));
    assert.equal(await result, false);
    assert.deepEqual(mock.operations, []);
  }, { imageLoad: () => watermark.promise });
});

test('pending and resolved watermark loads are shared between cards', async () => {
  const watermark = deferred();
  await withRuntime(async ({ renderCompositionToCanvas, imageCalls }) => {
    const settings = { ...base, enableImageWatermark: true, watermarkImage: 'shared' };
    const first = renderCompositionToCanvas(fakeCanvas().canvas, source, settings);
    const second = renderCompositionToCanvas(fakeCanvas().canvas, source, settings);
    await tick();
    assert.deepEqual(imageCalls, ['shared']);
    watermark.resolve({ width: 100, height: 60 });
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    await renderCompositionToCanvas(fakeCanvas().canvas, source, settings);
    assert.deepEqual(imageCalls, ['shared']);
  }, { imageLoad: () => watermark.promise });
});

test('watermark cache is bounded to four LRU resources', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, imageCalls }) => {
    const render = watermarkImage => renderCompositionToCanvas(fakeCanvas().canvas, source,
      { ...base, enableImageWatermark: true, watermarkImage });
    for (const url of ['a', 'b', 'c', 'd', 'a', 'e', 'a', 'b']) await render(url);
    assert.deepEqual(imageCalls, ['a', 'b', 'c', 'd', 'e', 'b']);
  });
});

test('pending font work is shared, and failed font loads use fallback then retry', async () => {
  const font = deferred();
  let attempts = 0;
  await withRuntime(async ({ renderCompositionToCanvas, fontCalls, warnings }) => {
    const settings = { ...base, enableTextWatermark: true };
    const one = fakeCanvas(), two = fakeCanvas();
    const results = [renderCompositionToCanvas(one.canvas, source, settings), renderCompositionToCanvas(two.canvas, source, settings)];
    await tick(); assert.equal(fontCalls.length, 1);
    font.reject(new Error('font temporarily unavailable'));
    assert.deepEqual(await Promise.all(results), [true, true]);
    assert.equal(one.drawings()[1].args[0], '水印 Hello');
    assert.equal(warnings.length, 2);
    await renderCompositionToCanvas(fakeCanvas().canvas, source, settings);
    await renderCompositionToCanvas(fakeCanvas().canvas, source, settings);
    assert.equal(fontCalls.length, 2);
  }, { fontLoad: () => ++attempts === 1 ? font.promise : Promise.resolve([]) });
});

test('font cache is bounded and keys include the actual text needed for glyph loading', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, fontCalls }) => {
    for (let i = 0; i < 33; i++) await renderCompositionToCanvas(fakeCanvas().canvas, source,
      { ...base, enableTextWatermark: true, text: `字形${i}` });
    await renderCompositionToCanvas(fakeCanvas().canvas, source, { ...base, enableTextWatermark: true, text: '字形0' });
    assert.equal(fontCalls.length, 34);
    assert.equal(fontCalls[33][1], '字形0');
  });
});

test('export reuses the full composition and encodes only after all layers, in the requested format', async () => {
  await withRuntime(async ({ renderCompositionToCanvas, processImageWithWatermark, canvases }) => {
    const settings = { ...base, enableCrop: true, cropWidth: 900, cropHeight: 600,
      enableTextWatermark: true, enableImageWatermark: true, watermarkImage: 'export',
      watermarkOffsetX: 70.5, watermarkOffsetY: -92,
      enableFormatConversion: true, targetFormat: 'image/png' };
    const preview = fakeCanvas();
    await renderCompositionToCanvas(preview.canvas, source, settings, 10, -20, 0.8);
    assert.equal(await processImageWithWatermark(source, settings, 10, -20, 0.8, 'image/jpeg'), 'data:image/png;base64,AA==');
    assert.deepEqual(canvases[0].drawings(), preview.drawings());
    assert.deepEqual(canvases[0].drawings()[2].args.slice(1), [883.5, 453, 50, 30]);
    assert.deepEqual([canvases[0].canvas.width, canvases[0].canvas.height], [900, 600]);
    assert.deepEqual(canvases[0].operations.at(-1), { kind: 'encode', args: ['image/png', 1] });
    assert.equal(preview.operations.some(op => op.kind === 'encode'), false);
  });
});

test('export fails instead of silently encoding an image without the selected watermark', async () => {
  await withRuntime(async ({ processImageWithWatermark, canvases }) => {
    await assert.rejects(processImageWithWatermark(source,
      { ...base, enableImageWatermark: true, watermarkImage: 'broken' }), /图片水印加载失败/);
    assert.deepEqual(canvases[0].operations, []);
  }, { imageLoad: async () => { throw new Error('broken image'); } });
});


test('watermark decode is awaited and cached; decode failure is explicit and retryable', async () => {
  const decoded = deferred();
  await withRuntime(async ({ renderCompositionToCanvas, imageCalls, decodeCalls }) => {
    const settings = { ...base, enableImageWatermark: true, watermarkImage: 'decode-retry' };
    const first = fakeCanvas();
    const failed = renderCompositionToCanvas(first.canvas, source, settings);
    await tick();
    assert.deepEqual(decodeCalls, ['decode-retry']);
    assert.deepEqual(first.operations, []);
    decoded.reject(new Error('decode failed'));
    await assert.rejects(failed, /图片水印加载失败/);
    assert.deepEqual(first.operations, []);
    await renderCompositionToCanvas(fakeCanvas().canvas, source, settings);
    await renderCompositionToCanvas(fakeCanvas().canvas, source, settings);
    assert.deepEqual(imageCalls, ['decode-retry', 'decode-retry']);
    assert.deepEqual(decodeCalls, ['decode-retry', 'decode-retry']);
  }, { imageDecode: (url, attempt) => attempt === 1 ? decoded.promise : Promise.resolve() });
});
