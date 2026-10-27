// Real Chrome checks using an existing Playwright module; never installs packages.
const { chromium } = require(process.env.PICTAG_PLAYWRIGHT_MODULE || 'playwright');
const JSZip = require('jszip');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve(__dirname, '../output/playwright/2026-10-27-watermark');
const testUrl = process.env.PICTAG_TEST_URL || 'http://127.0.0.1:4173';
// PICTAG_WATERMARK_FOCUS=format reruns the transparent-area format check only.
const formatFocus = process.env.PICTAG_WATERMARK_FOCUS === 'format';
const reportName = formatFocus ? 'format-results.json' : 'results.json';

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2, acceptDownloads: true });
  await context.addInitScript(() => {
    localStorage.setItem('pictag_presets', JSON.stringify([
      { id: 'half', name: '测试文字透明度', settings: { opacity: 0.35 } },
      { id: 'full', name: '测试文字不透明', settings: { opacity: 1 } },
      { id: 'prefix', name: '测试前缀开启', settings: { usePrefix: true } },
      { id: 'no-prefix', name: '测试前缀关闭', settings: { usePrefix: false } },
    ]));
    window.__encodeCount = 0;
    const encode = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) { window.__encodeCount++; return encode.apply(this, args); };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const checks = [], errors = [], measurements = {}, downloads = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('download', d => downloads.push(d));
  const pass = name => { checks.push(name); console.log('PASS', name); };
  const card = name => page.getByRole('group', { name: '图片 ' + name, exact: true });
  const canvas = name => card(name).getByTestId('live-preview');
  const ready = async name => {
    await card(name).scrollIntoViewIfNeeded();
    await page.waitForFunction(name => {
      const c = [...document.querySelectorAll('[data-image-card]')].find(c => c.dataset.imageName === name);
      return c?.querySelector('[data-preview-state]')?.dataset.previewState === 'ready';
    }, name);
  };
  const change = async (name, action) => {
    await card(name).scrollIntoViewIfNeeded();
    const rev = +(await canvas(name).getAttribute('data-preview-revision'));
    await action();
    await page.waitForFunction(({ name, rev }) => {
      const c = [...document.querySelectorAll('[data-image-card]')].find(c => c.dataset.imageName === name);
      return c?.querySelector('[data-preview-state]')?.dataset.previewState === 'ready' && +c.querySelector('canvas').dataset.previewRevision > rev;
    }, { name, rev });
  };
  const range = async (locator, value) => {
    const min = Number(await locator.getAttribute('min')), step = Number(await locator.getAttribute('step'));
    await locator.focus(); await locator.press('Home');
    for (let i = 0; i < Math.round((value - min) / step); i++) await locator.press('ArrowRight');
    assert.ok(Math.abs(Number(await locator.inputValue()) - value) < 1e-8);
  };
  const stats = async name => canvas(name).evaluate(c => {
    const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let hash = 2166136261;
    const red = [], green = [];
    for (let i = 0; i < pixels.length; i += 4) {
      hash = Math.imul(hash ^ pixels[i], 16777619); hash = Math.imul(hash ^ pixels[i + 1], 16777619);
      hash = Math.imul(hash ^ pixels[i + 2], 16777619); hash = Math.imul(hash ^ pixels[i + 3], 16777619);
      const point = [i / 4 % c.width, Math.floor(i / 4 / c.width)];
      if (pixels[i] > 180 && pixels[i + 1] < 80 && pixels[i + 2] < 80 && pixels[i + 3] > 100) red.push(point);
      if (pixels[i + 1] > 180 && pixels[i] < 80 && pixels[i + 2] < 80 && pixels[i + 3] > 100) green.push(point);
    }
    const bounds = points => points.length ? { count: points.length, x: Math.min(...points.map(p => p[0])), y: Math.min(...points.map(p => p[1])), right: Math.max(...points.map(p => p[0])), bottom: Math.max(...points.map(p => p[1])) } : { count: 0 };
    return { width: c.width, height: c.height, revision: +c.dataset.previewRevision, hash, red: bounds(red), green: bounds(green) };
  });
  const fixture = async (name, width, height, color) => {
    const data = await page.evaluate(({ width, height, color }) => {
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, width, height);
      return c.toDataURL('image/png').split(',')[1];
    }, { width, height, color });
    const filename = path.join(out, name); await fs.writeFile(filename, Buffer.from(data, 'base64')); return filename;
  };
  const upload = async files => { await page.locator('input[type=file][multiple]').setInputFiles(files); await card(path.basename(files.at(-1))).waitFor(); };
  const text = page.getByLabel('标签文本', { exact: true });
  const logoInput = page.getByLabel('选择或替换水印图片', { exact: true });
  const processAll = async () => {
    await page.getByRole('button', { name: '应用到所有图片', exact: true }).click();
    await page.getByRole('button', { name: '下载 source.png', exact: true }).waitFor();
    await page.getByRole('button', { name: '应用到所有图片', exact: true }).waitFor();
  };
  const download = async (action, filename) => {
    const promise = page.waitForEvent('download');
    await action();
    if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: '仍然导出', exact: true }).click();
    const d = await promise; await d.saveAs(path.join(out, filename)); return fs.readFile(path.join(out, filename));
  };
  const compareExport = async (name, buffer, mime, threshold, background = null) => {
    const result = await canvas(name).evaluate(async (c, { data, mime, background }) => {
      const img = new Image(); img.src = `data:${mime};base64,${data}`; await img.decode();
      const down = document.createElement('canvas'); down.width = c.width; down.height = c.height;
      const ctx = down.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, c.width, c.height);
      let preview = c;
      if (background) {
        preview = document.createElement('canvas'); preview.width = c.width; preview.height = c.height;
        const previewContext = preview.getContext('2d'); previewContext.fillStyle = background;
        previewContext.fillRect(0, 0, c.width, c.height); previewContext.drawImage(c, 0, 0);
      }
      const a = preview.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const b = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, max = 0, over40 = 0;
      for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); sum += d; max = Math.max(max, d); if (d > 40) over40++; }
      return { width: img.width, height: img.height, meanAbsoluteDifference: sum / a.length, maxDifference: max, channelsOver40Fraction: over40 / a.length, corner: [...ctx.getImageData(1, 1, 1, 1).data] };
    }, { data: buffer.toString('base64'), mime, background });
    assert.ok(result.meanAbsoluteDifference < threshold, JSON.stringify(result));
    return result;
  };
  try {
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    const source = await fixture('source.png', 600, 600, '#204060');
    const second = await fixture('second.png', 900, 600, '#204060');
    const red = await fixture('logo-red.png', 100, 60, '#ff0000');
    const green = await fixture('logo-green.png', 100, 60, '#00ff00');
    await upload([source, second]); await ready('source.png'); await ready('second.png');
    if (formatFocus) {
      await change('source.png', () => text.fill('FORMAT LIVE'));
      await change('source.png', () => page.getByLabel('文字颜色值', { exact: true }).fill('#00FF00'));
      await change('source.png', () => logoInput.setInputFiles(red));
      await change('source.png', () => page.getByLabel('图片水印位置', { exact: true }).selectOption('center'));
      const crop = page.getByText('统一裁切尺寸', { exact: true }).locator('..').locator('input[type=checkbox]');
      await change('source.png', () => crop.check());
      await change('source.png', () => page.getByText('宽度 (W)', { exact: true }).locator('..').locator('input').fill('600'));
      await change('source.png', () => page.getByText('高度 (H)', { exact: true }).locator('..').locator('input').fill('600'));
      await change('source.png', () => range(page.getByRole('slider', { name: '缩放 source.png', exact: true }), 0.5));
      const transparentComposition = await stats('source.png');
      await canvas('source.png').evaluate(c => { window.__formatReferencePixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; });
      assert.ok(transparentComposition.red.count > 100); assert.ok(transparentComposition.green.count > 100);
      assert.equal(await canvas('source.png').evaluate(c => getComputedStyle(c).backgroundColor), 'rgba(0, 0, 0, 0)');
      const format = page.getByText('目标导出格式', { exact: true }).locator('..').locator('input[type=checkbox]');
      await change('source.png', () => format.check());
      assert.equal(await canvas('source.png').evaluate(c => getComputedStyle(c).backgroundColor), 'rgb(0, 0, 0)');
      const jpegComposition = await stats('source.png');
      assert.deepEqual(jpegComposition.red, transparentComposition.red, 'JPEG background keeps image watermark placement');
      assert.deepEqual(jpegComposition.green, transparentComposition.green, 'JPEG background keeps text watermark placement');
      await processAll();
      const jpeg = await download(() => page.getByRole('button', { name: '下载 source.png', exact: true }).click(), 'format-gap.jpg');
      measurements.jpegGap = await compareExport('source.png', jpeg, 'image/jpeg', 7, '#000000');
      assert.equal(measurements.jpegGap.corner[3], 255);
      assert.ok(measurements.jpegGap.corner.slice(0, 3).every(value => value < 4));
      await page.screenshot({ path: out + '/05-jpeg-black-preview.png', fullPage: true });
      await change('source.png', () => page.getByRole('button', { name: 'PNG', exact: true }).click());
      assert.equal(await canvas('source.png').evaluate(c => getComputedStyle(c).backgroundColor), 'rgba(0, 0, 0, 0)');
      measurements.beforeFormat = transparentComposition;
      measurements.afterPNGSwitch = await stats('source.png');
      assert.deepEqual(measurements.afterPNGSwitch.red, transparentComposition.red, 'image watermark bounds and solid pixels retain identical placement');
      assert.deepEqual(measurements.afterPNGSwitch.green, transparentComposition.green, 'text watermark bounds and solid pixels retain identical placement');
      measurements.formatSwitchPixelDifference = await canvas('source.png').evaluate(c => {
        const before = window.__formatReferencePixels, after = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let sum = 0, changed = 0, maxDifference = 0, edgeChannels = 0, minX = c.width, minY = c.height, maxX = -1, maxY = -1;
        for (let i = 0; i < before.length; i++) {
          const delta = Math.abs(before[i] - after[i]); sum += delta; maxDifference = Math.max(maxDifference, delta);
          if (delta) {
            changed++; const x = Math.floor(i / 4) % c.width, y = Math.floor(i / 4 / c.width);
            minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
            if (Math.abs(x - 99.5) < 2 || Math.abs(x - 298.5) < 2 || Math.abs(y - 99.5) < 2 || Math.abs(y - 298.5) < 2) edgeChannels++;
          }
        }
        return { meanAbsoluteDifference: sum / before.length, changedChannelFraction: changed / before.length, maxDifference, changedPixelBounds: [minX, minY, maxX, maxY], changedChannelsAtSourceEdges: edgeChannels, changedChannels: changed };
      });
      assert.ok(measurements.formatSwitchPixelDifference.meanAbsoluteDifference < 1, 'only minor rasterization differences are permitted');
      await processAll();
      const png = await download(() => page.getByRole('button', { name: '下载 source.png', exact: true }).click(), 'format-gap.png');
      measurements.pngGap = await compareExport('source.png', png, 'image/png', 5);
      assert.equal(measurements.pngGap.corner[3], 0);
      await page.screenshot({ path: out + '/06-png-transparent-preview.png', fullPage: true });
      measurements.identicalInputControl = await page.evaluate(async ({ sourceData, watermarkData }) => {
        const { renderCompositionToCanvas, loadImage } = await import('/services/canvasUtils.ts');
        const { DEFAULT_SETTINGS } = await import('/constants.ts');
        const settings = { ...DEFAULT_SETTINGS, text: 'FORMAT LIVE', color: '#00FF00', watermarkImage: watermarkData, watermarkPosition: 'center', enableCrop: true, cropWidth: 600, cropHeight: 600 };
        const original = await loadImage(sourceData), c = document.createElement('canvas');
        let prior, first; const draws = [];
        for (let n = 0; n < 6; n++) {
          await renderCompositionToCanvas(c, original, settings, 0, 0, 0.5, { maxDimension: 398 });
          const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let hash = 2166136261, sum = 0, changed = 0;
          for (let i = 0; i < pixels.length; i++) { hash = Math.imul(hash ^ pixels[i], 16777619); if (prior) { sum += Math.abs(prior[i] - pixels[i]); if (prior[i] !== pixels[i]) changed++; } }
          draws.push({ draw: n + 1, hash, differenceFromPrevious: prior ? sum / pixels.length : 0, changedChannelFraction: changed / pixels.length });
          prior = pixels; first ||= pixels;
        }
        return { description: 'Same renderer, canvas, image and settings on every draw; no format or UI changes. Readback after each draw.', draws };
      }, { sourceData: 'data:image/png;base64,' + (await fs.readFile(source)).toString('base64'), watermarkData: 'data:image/png;base64,' + (await fs.readFile(red)).toString('base64') });
      pass('crop gap JPEG uses computed black preview background and opaque black export; PNG restores transparent background/alpha with identical watermark layout');
      assert.deepEqual(errors, []);
      await fs.writeFile(out + '/' + reportName, JSON.stringify({ status: 'passed', checks, measurements, downloads: downloads.length, pageErrors: errors, url: testUrl, viewport: '1500x1000', deviceScaleFactor: 2 }, null, 2));
      console.log('RESULT focused format preview passed;', downloads.length, 'downloads verified');
      return;
    }
    await page.evaluate(() => { window.__encodeCount = 0; });
    await change('source.png', () => text.fill('LIVE'));
    assert.equal(await page.getByRole('button', { name: '下载 source.png', exact: true }).count(), 0);
    let before = await stats('source.png');
    await change('source.png', () => page.getByLabel('字号 (px)', { exact: true }).fill('80'));
    assert.notEqual((await stats('source.png')).hash, before.hash);
    await change('source.png', () => page.getByLabel('文字颜色值', { exact: true }).fill('#00FF00'));
    assert.ok((await stats('source.png')).green.count > 100);
    before = await stats('source.png');
    await change('source.png', () => page.getByLabel('字体粗细', { exact: true }).selectOption('100'));
    assert.notEqual((await stats('source.png')).hash, before.hash);
    await change('source.png', () => page.getByLabel('字体粗细', { exact: true }).selectOption('900'));
    before = await stats('source.png');
    await change('source.png', () => page.getByLabel('左边距 (X)', { exact: true }).fill('100'));
    await change('source.png', () => page.getByLabel('底边距 (Y)', { exact: true }).fill('100'));
    const shifted = await stats('source.png'); assert.ok(shifted.green.x > before.green.x); assert.ok(shifted.green.y < before.green.y);
    await change('source.png', () => page.getByRole('button', { name: '测试文字透明度', exact: true }).click());
    const half = await stats('source.png'); assert.notEqual(half.hash, shifted.hash); assert.equal(half.green.count, 0);
    await change('source.png', () => page.getByRole('button', { name: '测试文字不透明', exact: true }).click());
    const noPrefix = await stats('source.png');
    await change('source.png', () => page.getByRole('button', { name: '测试前缀开启', exact: true }).click());
    assert.ok((await stats('source.png')).green.right > noPrefix.green.right);
    await change('source.png', () => page.getByRole('button', { name: '测试前缀关闭', exact: true }).click());
    await change('source.png', () => page.getByRole('button', { name: '文字水印', exact: true }).click());
    assert.equal((await stats('source.png')).green.count, 0);
    await change('source.png', () => page.getByRole('button', { name: '文字水印', exact: true }).click());
    assert.ok((await stats('source.png')).green.count > 0);
    pass('text, size, color, weight, margins, existing opacity/prefix presets and toggle update before Apply');

    await change('source.png', () => page.getByRole('button', { name: '文字水印', exact: true }).click());
    await change('source.png', () => page.getByLabel('左边距 (X)', { exact: true }).fill('40'));
    await change('source.png', () => page.getByLabel('底边距 (Y)', { exact: true }).fill('30'));
    await change('source.png', () => logoInput.setInputFiles(red));
    assert.ok((await stats('source.png')).red.count > 1000);
    for (const position of ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      if (await page.getByLabel('图片水印位置', { exact: true }).inputValue() !== position) await change('source.png', () => page.getByLabel('图片水印位置', { exact: true }).selectOption(position));
      const s = await stats('source.png'), ratio = s.width / 600;
      const x = position === 'center' ? 250 : position.endsWith('left') ? 40 : 460;
      const y = position === 'center' ? 270 : position.startsWith('top') ? 30 : 510;
      assert.ok(Math.abs(s.red.x - x * ratio) < 2, `${position} x ${JSON.stringify(s)}`);
      assert.ok(Math.abs(s.red.y - y * ratio) < 2, `${position} y ${JSON.stringify(s)}`);
    }
    before = await stats('source.png');
    await change('source.png', () => range(page.getByLabel('图片水印缩放比例', { exact: true }), 2));
    assert.ok((await stats('source.png')).red.count > before.red.count * 3.5);
    await change('source.png', () => range(page.getByLabel('图片水印不透明度', { exact: true }), 0.4));
    assert.equal((await stats('source.png')).red.count, 0);
    await change('source.png', () => range(page.getByLabel('图片水印不透明度', { exact: true }), 1));
    await change('source.png', () => logoInput.setInputFiles(green));
    assert.equal((await stats('source.png')).red.count, 0); assert.ok((await stats('source.png')).green.count > 1000);
    await change('source.png', () => page.getByRole('button', { name: '图片水印', exact: true }).click());
    assert.equal((await stats('source.png')).green.count, 0);
    await change('source.png', () => page.getByRole('button', { name: '图片水印', exact: true }).click());
    assert.ok((await stats('source.png')).green.count > 1000);
    await change('source.png', () => page.getByRole('button', { name: '移除水印图片', exact: true }).click());
    assert.equal((await stats('source.png')).green.count, 0);
    assert.equal(await logoInput.count(), 1);
    pass('image first selection, replacement, remove, toggle, scale, opacity and all five positions render correctly');

    await change('source.png', () => logoInput.setInputFiles(red));
    await change('source.png', () => range(page.getByLabel('图片水印缩放比例', { exact: true }), 1));
    await change('source.png', () => page.getByLabel('图片水印位置', { exact: true }).selectOption('top-left'));
    await change('source.png', () => page.getByRole('button', { name: '文字水印', exact: true }).click());
    await change('source.png', () => page.getByLabel('字号 (px)', { exact: true }).fill('48'));
    await change('source.png', () => text.fill('PNG/JPEG LIVE'));
    await ready('second.png'); assert.ok((await stats('second.png')).red.count > 0); assert.ok((await stats('second.png')).green.count > 0);
    await page.screenshot({ path: out + '/01-live-before-apply.png', fullPage: true });
    await page.evaluate(() => {
      const original = document.fonts.load.bind(document.fonts);
      document.fonts.load = (font, text) => Promise.all([original(font, text), new Promise(resolve => setTimeout(resolve, String(text).includes('SLOW') ? 700 : 0))]).then(([fonts]) => fonts);
    });
    await text.fill('SLOW OLDER'); await page.waitForTimeout(80);
    await change('source.png', () => text.fill('LATEST TEXT'));
    const latest = await stats('source.png'); await page.waitForTimeout(800); assert.equal((await stats('source.png')).hash, latest.hash);
    await page.evaluate(() => {
      const read = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function (file) {
        if (file.name.includes('logo-red')) {
          const original = this.onload;
          this.onload = event => { setTimeout(() => original?.call(this, event), 600); };
        }
        return read.call(this, file);
      };
    });
    await logoInput.setInputFiles(red); await page.waitForTimeout(50);
    await change('source.png', () => logoInput.setInputFiles(green));
    before = await stats('source.png'); await page.waitForTimeout(750);
    assert.equal((await stats('source.png')).hash, before.hash); assert.equal(before.red.count, 0);
    await text.fill('SLOW REMOVED'); await page.waitForTimeout(50);
    await page.getByRole('button', { name: '移除 second.png', exact: true }).click();
    await upload([second]); await ready('second.png');
    await change('source.png', () => text.fill('LATEST BOTH'));
    await ready('second.png'); const replaced = await stats('second.png'); await page.waitForTimeout(800); assert.equal((await stats('second.png')).hash, replaced.hash);
    assert.equal(await page.evaluate(() => window.__encodeCount), 0);
    pass('delayed font and FileReader completions cannot overwrite latest settings or replacement card; edits never encode');

    const crop = page.getByText('统一裁切尺寸', { exact: true }).locator('..').locator('input[type=checkbox]');
    await change('source.png', () => crop.check());
    await change('source.png', () => page.getByText('宽度 (W)', { exact: true }).locator('..').locator('input').fill('600'));
    await change('source.png', () => page.getByText('高度 (H)', { exact: true }).locator('..').locator('input').fill('600'));
    await change('source.png', () => range(page.getByRole('slider', { name: '缩放 source.png', exact: true }), 0.5));
    assert.equal(await card('source.png').locator('[data-uncovered-edge]').count(), 4);
    assert.equal(await card('second.png').locator('[data-uncovered-edge]').count(), 0);
    await card('source.png').focus(); await change('source.png', () => card('source.png').press('ArrowRight'));
    await page.screenshot({ path: out + '/02-live-crop-and-watermark.png', fullPage: true });
    await change('source.png', () => page.getByRole('button', { name: '复位 source.png', exact: true }).click());
    pass('global watermarks coexist with independent crop/scale/offset and geometric warning overlays');

    await change('source.png', () => text.fill('EXPORT LIVE'));
    await processAll(); await ready('source.png');
    const png = await download(() => page.getByRole('button', { name: '下载 source.png', exact: true }).click(), 'matched.png');
    measurements.png = await compareExport('source.png', png, 'image/png', 5);
    const zipData = await download(() => page.getByRole('button', { name: '批量导出 ZIP', exact: true }).click(), 'matched.zip');
    const zip = await JSZip.loadAsync(zipData);
    assert.deepEqual(Object.keys(zip.files).sort(), ['second.png', 'source.png']);
    assert.deepEqual(await zip.file('source.png').async('nodebuffer'), png);
    const format = page.getByText('目标导出格式', { exact: true }).locator('..').locator('input[type=checkbox]');
    await change('source.png', () => format.check()); await processAll();
    const jpeg = await download(() => page.getByRole('button', { name: '下载 source.png', exact: true }).click(), 'matched.jpg');
    measurements.jpeg = await compareExport('source.png', jpeg, 'image/jpeg', 7);
    assert.equal(measurements.png.width, 600); assert.equal(measurements.jpeg.width, 600);
    await change('source.png', () => range(page.getByRole('slider', { name: '缩放 source.png', exact: true }), 0.5));
    await page.getByRole('button', { name: 'PNG', exact: true }).click(); await processAll();
    const gapPng = await download(() => page.getByRole('button', { name: '下载 source.png', exact: true }).click(), 'uncovered.png');
    measurements.uncovered = await compareExport('source.png', gapPng, 'image/png', 5);
    assert.equal(measurements.uncovered.corner[3], 0);
    await page.screenshot({ path: out + '/03-processed-watermark.png', fullPage: true });
    pass('actual PNG/JPEG and ZIP match preview composition within resampling tolerance; DOM warning stripes stay out of exports');

    await logoInput.setInputFiles(red); await page.waitForTimeout(60);
    assert.equal(await page.getByRole('button', { name: '应用到所有图片', exact: true }).isEnabled(), false);
    assert.equal(await page.getByRole('button', { name: '下载 source.png', exact: true }).isEnabled(), false);
    assert.equal(await page.getByRole('button', { name: '批量导出 ZIP', exact: true }).isEnabled(), false);
    await page.getByRole('button', { name: '应用到所有图片', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="下载 source.png"]'));
    await ready('source.png'); assert.ok((await stats('source.png')).red.count > 1000);
    pass('pending watermark replacement blocks Apply/single/ZIP exports, then invalidates old result and previews latest image');

    await page.getByRole('button', { name: '清空', exact: true }).click();
    await crop.uncheck();
    const big = await fixture('large-source.png', 4096, 3072, '#204060');
    const bulk = Array.from({ length: 36 }, (_, i) => ({ name: `batch-${String(i).padStart(2, '0')}.png`, mimeType: 'image/png', buffer: null }));
    const bigBytes = await fs.readFile(big); for (const f of bulk) f.buffer = bigBytes;
    await page.locator('input[type=file][multiple]').setInputFiles(bulk);
    await card('batch-35.png').waitFor(); await ready('batch-00.png');
    await page.waitForTimeout(300);
    const batch = await page.locator('[data-image-card]').evaluateAll(cards => cards.map(c => {
      const canvas = c.querySelector('canvas'); return { name: c.dataset.imageName, state: c.querySelector('[data-preview-state]').dataset.previewState, revision: +canvas.dataset.previewRevision, width: canvas.width, height: canvas.height };
    }));
    assert.ok(batch.filter(c => c.revision === 0).length > 15, JSON.stringify(batch));
    assert.ok(batch.every(c => c.width <= 1024 && c.height <= 1024));
    await page.evaluate(() => { window.__encodeCount = 0; });
    await change('batch-00.png', () => text.fill('BATCH LATEST'));
    assert.equal(+(await canvas('batch-35.png').getAttribute('data-preview-revision')), 0);
    await ready('batch-35.png'); assert.ok(+(await canvas('batch-35.png').getAttribute('data-preview-revision')) > 0);
    assert.equal(await page.evaluate(() => window.__encodeCount), 0);
    measurements.batch = { count: batch.length, initiallyUnpainted: batch.filter(c => c.revision === 0).length, largestBitmapDimension: Math.max(...batch.map(c => Math.max(c.width, c.height))) };
    await page.screenshot({ path: out + '/04-visible-batch.png', fullPage: true });
    pass('36 large source images draw only visible/nearby cards, remain <=1024px, and render latest settings when scrolled into view');
    assert.deepEqual(errors, []);
    await fs.writeFile(out + '/' + reportName, JSON.stringify({ status: 'passed', checks, measurements, downloads: downloads.length, pageErrors: errors, url: testUrl, viewport: '1500x1000', deviceScaleFactor: 2 }, null, 2));
    console.log('RESULT', checks.length, 'watermark scenarios passed;', downloads.length, 'downloads verified');
  } catch (error) {
    await page.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {});
    await fs.writeFile(out + '/failure-snapshot.yml', await page.locator('body').ariaSnapshot()).catch(() => {});
    await fs.writeFile(out + '/' + reportName, JSON.stringify({ status: 'failed', checks, measurements, error: String(error), pageErrors: errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
