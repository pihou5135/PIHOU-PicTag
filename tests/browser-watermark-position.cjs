// Local Chrome integration checks. Uses an existing Playwright module; never installs software.
const { chromium } = require(process.env.PICTAG_PLAYWRIGHT_MODULE || 'playwright');
const JSZip = require('jszip');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve(__dirname, '../output/playwright/2026-10-27-watermark-directions');
const url = process.env.PICTAG_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2, acceptDownloads: true });
  await context.addInitScript(() => {
    localStorage.setItem('pictag_presets', JSON.stringify([
      { id: 'legacy', name: '旧版无偏移预设', settings: { watermarkPosition: 'top-left' } },
      { id: 'offset', name: '新版带偏移预设', settings: { watermarkOffsetX: 33.5, watermarkOffsetY: -22.25 } },
    ]));
    window.__encodeCount = 0;
    const encode = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) { window.__encodeCount++; return encode.apply(this, args); };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], checks = [], measurements = {}, downloads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', download => downloads.push(download));
  const pass = name => { checks.push(name); console.log('PASS', name); };
  const card = name => page.getByRole('group', { name: '图片 ' + name, exact: true });
  const canvas = name => card(name).getByTestId('live-preview');
  const sourceName = 'source.png';
  const directionGroup = page.getByRole('group', { name: '移动图片水印', exact: true });
  const stepInput = page.getByLabel('每次移动距离', { exact: true });
  const directionNames = { up: '上', down: '下', left: '左', right: '右' };
  const directionButton = direction => page.getByRole('button', { name: `图片水印向${directionNames[direction]}移动`, exact: true });
  const logoInput = page.getByLabel('选择或替换水印图片', { exact: true });
  const positionInput = page.getByLabel('图片水印位置', { exact: true });
  const ready = async (name = sourceName) => {
    await card(name).scrollIntoViewIfNeeded();
    await page.waitForFunction(name => {
      const el = [...document.querySelectorAll('[data-image-card]')].find(el => el.dataset.imageName === name);
      return el?.querySelector('[data-preview-state]')?.dataset.previewState === 'ready';
    }, name);
  };
  const change = async action => {
    await ready();
    const rev = +(await canvas(sourceName).getAttribute('data-preview-revision'));
    await action();
    await page.waitForFunction(rev => {
      const el = [...document.querySelectorAll('[data-image-card]')].find(el => el.dataset.imageName === 'source.png');
      return el?.querySelector('[data-preview-state]')?.dataset.previewState === 'ready' && +el.querySelector('canvas').dataset.previewRevision > rev;
    }, rev);
  };
  const fill = async (input, value) => {
    if (await input.inputValue() !== String(value)) await change(() => input.fill(String(value)));
  };
  const position = async value => { if (await positionInput.inputValue() !== value) await change(() => positionInput.selectOption(value)); };
  const reset = () => change(() => page.getByRole('button', { name: '重置图片水印位置', exact: true }).click());
  const moveTo = async (x, y) => {
    assert.ok(Number.isInteger(x) && Number.isInteger(y));
    await reset();
    for (const [value, positive, negative] of [[x, 'right', 'left'], [y, 'down', 'up']]) {
      let remaining = Math.abs(value);
      for (const step of [50, 10, 1]) {
        const count = Math.floor(remaining / step); remaining %= step;
        if (!count) continue;
        await stepInput.selectOption(String(step));
        await change(async () => { for (let i = 0; i < count; i++) await directionButton(value > 0 ? positive : negative).click(); });
      }
    }
  };
  const stats = async (name = sourceName) => canvas(name).evaluate(c => {
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const bounds = { red: { count: 0, x: c.width, y: c.height, right: -1, bottom: -1 }, green: { count: 0, x: c.width, y: c.height, right: -1, bottom: -1 } };
    for (let i = 0; i < data.length; i += 4) {
      const name = data[i] > 180 && data[i + 1] < 80 && data[i + 2] < 80 ? 'red' : data[i + 1] > 180 && data[i] < 80 && data[i + 2] < 80 ? 'green' : null;
      if (!name || data[i + 3] < 100) continue;
      const b = bounds[name], x = i / 4 % c.width, y = Math.floor(i / 4 / c.width);
      b.count++; b.x = Math.min(b.x, x); b.y = Math.min(b.y, y); b.right = Math.max(b.right, x); b.bottom = Math.max(b.bottom, y);
    }
    return { width: c.width, height: c.height, revision: +c.dataset.previewRevision, ...bounds };
  });
  const assertRect = (s, outputWidth, outputHeight, x, y, width = 120, height = 60) => {
    const expected = { x: x * s.width / outputWidth, y: y * s.height / outputHeight, right: (x + width) * s.width / outputWidth - 1, bottom: (y + height) * s.height / outputHeight - 1 };
    for (const key of ['x', 'y', 'right', 'bottom']) assert.ok(Math.abs(s.red[key] - expected[key]) < 2, key + ' ' + JSON.stringify({ actual: s.red, expected }));
  };
  const assertText = (a, b) => {
    assert.ok(a.count > 0 && b.count > 0);
    for (const key of ['x', 'y', 'right', 'bottom']) assert.ok(Math.abs(a[key] - b[key]) <= 1, 'text remained in place: ' + JSON.stringify({ a, b }));
    assert.ok(Math.abs(a.count - b.count) <= 3, 'text remained fully visible');
  };
  const fixture = async (name, width, height, color) => {
    const png = await page.evaluate(({ width, height, color }) => { const c = document.createElement('canvas'); c.width = width; c.height = height; const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, width, height); return c.toDataURL('image/png').split(',')[1]; }, { width, height, color });
    const file = path.join(out, name); await fs.writeFile(file, Buffer.from(png, 'base64')); return file;
  };
  const range = async (input, value) => {
    const min = Number(await input.getAttribute('min')), step = Number(await input.getAttribute('step'));
    await input.focus(); await input.press('Home');
    for (let i = 0; i < Math.round((value - min) / step); i++) await input.press('ArrowRight');
  };
  const processAll = async () => {
    await page.getByRole('button', { name: '应用到所有图片', exact: true }).click();
    await page.getByRole('button', { name: '下载 source.png', exact: true }).waitFor();
  };
  const download = async (action, name) => {
    const pending = page.waitForEvent('download'); await action();
    if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: '仍然导出', exact: true }).click();
    const file = await pending; await file.saveAs(path.join(out, name)); return fs.readFile(path.join(out, name));
  };
  const compare = async (buffer, mime, threshold, background = null) => {
    const result = await canvas(sourceName).evaluate(async (c, { data, mime, background }) => {
      const img = new Image(); img.src = `data:${mime};base64,${data}`; await img.decode();
      const d = document.createElement('canvas'); d.width = c.width; d.height = c.height;
      const ctx = d.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, d.width, d.height);
      const p = document.createElement('canvas'); p.width = c.width; p.height = c.height; const pc = p.getContext('2d');
      if (background) { pc.fillStyle = background; pc.fillRect(0, 0, p.width, p.height); } pc.drawImage(c, 0, 0);
      const a = pc.getImageData(0, 0, c.width, c.height).data, b = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, over40 = 0; for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); sum += delta; if (delta > 40) over40++; }
      return { width: img.width, height: img.height, meanAbsoluteDifference: sum / a.length, channelsOver40Fraction: over40 / a.length, corner: [...ctx.getImageData(1, 1, 1, 1).data] };
    }, { data: buffer.toString('base64'), mime, background });
    assert.ok(result.meanAbsoluteDifference < threshold, JSON.stringify(result)); return result;
  };
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const source = await fixture('source.png', 800, 600, '#204060');
    const portrait = await fixture('portrait.png', 600, 900, '#204060');
    const logo = await fixture('logo-red.png', 120, 60, '#ff0000');
    const replacement = await fixture('logo-replacement.png', 80, 80, '#ff0000');
    await page.locator('input[type=file][multiple]').setInputFiles([source, portrait]); await ready(); await ready('portrait.png');
    await change(() => page.getByLabel('标签文本', { exact: true }).fill('TEXT LIVE'));
    await fill(page.getByLabel('字号 (px)', { exact: true }), 40);
    await change(() => page.getByLabel('文字颜色值', { exact: true }).fill('#00FF00'));
    await change(() => logoInput.setInputFiles(logo));
    await directionGroup.waitFor();
    assert.equal(await stepInput.inputValue(), '10', 'default nudge distance');
    assert.equal(await directionGroup.locator('select').count(), 0, 'distance select must be outside keyboard movement group');
    assert.equal(await page.getByLabel('图片水印水平偏移 (px)', { exact: true }).count(), 0, 'signed inputs are replaced by direction controls');
    await page.evaluate(() => { window.__encodeCount = 0; });
    await change(() => page.getByRole('button', { name: '文字水印', exact: true }).click());
    await moveTo(20, -10);
    for (const anchor of ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      await position(anchor);
      const expectedX = (anchor === 'center' ? 340 : anchor.endsWith('left') ? 60 : 620) + 20;
      const expectedY = (anchor === 'center' ? 270 : anchor.startsWith('top') ? 60 : 480) - 10;
      assertRect(await stats(), 800, 600, expectedX, expectedY);
    }
    pass('direction controls are available without signed inputs; all five anchors retain image movement');

    await position('top-left');
    await reset();
    await change(() => page.getByRole('button', { name: '文字水印', exact: true }).click());
    const textReference = (await stats()).green;
    let x = 0, y = 0;
    const stepDirections = [['right', 10, 0], ['down', 0, 10], ['left', -10, 0], ['up', 0, -10]];
    await stepInput.selectOption('10');
    for (const [direction, dx, dy] of stepDirections) {
      await change(() => directionButton(direction).click()); x += dx; y += dy;
      const s = await stats(); assertRect(s, 800, 600, 60 + x, 60 + y); assertText(s.green, textReference);
    }
    assert.equal(x, 0); assert.equal(y, 0);
    await stepInput.selectOption('1'); await change(() => directionButton('right').click());
    assertRect(await stats(), 800, 600, 61, 60);
    await stepInput.selectOption('50'); await change(() => directionButton('down').click());
    assertRect(await stats(), 800, 600, 61, 110);
    await reset();
    await stepInput.selectOption('10');
    await change(async () => { for (let i = 0; i < 3; i++) await directionButton('right').click(); });
    assertRect(await stats(), 800, 600, 90, 60);
    assertText((await stats()).green, textReference);
    pass('four direction buttons move only their own axis, use 1/10/50-pixel distances and accumulate repeated clicks; text stays still');

    await reset();
    const beforeSelect = await stats();
    await stepInput.focus();
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape']) await stepInput.press(key);
    assert.deepEqual((await stats()).red, beforeSelect.red, 'arrow keys on distance selector must not move image');
    // macOS headless Chrome does not commit native select option changes from
    // synthetic key events here. Verify its real change event separately.
    await stepInput.selectOption('50'); assert.equal(await stepInput.inputValue(), '50');
    assert.deepEqual((await stats()).red, beforeSelect.red, 'changing distance must not move image');
    await stepInput.selectOption('10'); assert.equal(await stepInput.inputValue(), '10');
    measurements.nativeSelectKeyboard = 'Arrow keys did not move the image; native option keyboard selection was not verified in macOS headless Chrome. Option changes were verified with selectOption.';
    await directionButton('right').focus();
    x = y = 0;
    for (const [key, dx, dy] of [['ArrowUp', 0, -10], ['ArrowRight', 10, 0], ['ArrowDown', 0, 10], ['ArrowLeft', -10, 0]]) {
      await change(() => directionButton('right').press(key)); x += dx; y += dy;
      assertRect(await stats(), 800, 600, 60 + x, 60 + y); assertText((await stats()).green, textReference);
    }
    await change(() => directionButton('right').press('Enter'));
    assertRect(await stats(), 800, 600, 70, 60);
    await change(() => directionButton('right').press('Space'));
    assertRect(await stats(), 800, 600, 80, 60);
    pass('focused direction buttons support four arrow keys and native Enter/Space; select arrow keys and distance changes never move the watermark');

    await position('bottom-left'); await reset();
    const overlapped = await stats();
    assert.ok(overlapped.green.count < textReference.count, 'initial image watermark overlaps text');
    await page.screenshot({ path: out + '/01-before-move.png', fullPage: true });
    await stepInput.selectOption('50');
    await change(async () => { await directionButton('up').click(); await directionButton('up').click(); });
    const separated = await stats(); assertText(separated.green, textReference);
    assert.ok(separated.red.bottom < separated.green.y, 'up button separates the two watermarks');
    measurements.overlap = { beforeTextPixels: overlapped.green.count, afterTextPixels: separated.green.count, referenceTextPixels: textReference.count };
    await page.screenshot({ path: out + '/02-after-move.png', fullPage: true });
    assert.equal(await page.getByLabel('左边距 (X)', { exact: true }).inputValue(), '60');
    assert.equal(await page.getByLabel('底边距 (Y)', { exact: true }).inputValue(), '60');
    pass('pressing Up twice visibly resolves overlapping text and image watermarks; reset preserves text and margins');

    await change(() => page.getByRole('button', { name: '旧版无偏移预设', exact: true }).click());
    assertRect(await stats(), 800, 600, 60, 60);
    await change(() => page.getByRole('button', { name: '新版带偏移预设', exact: true }).click());
    assertRect(await stats(), 800, 600, 93.5, 37.75);
    await stepInput.selectOption('1'); await change(() => directionButton('right').click());
    assertRect(await stats(), 800, 600, 94.5, 37.75);
    await page.getByRole('button', { name: '保存当前为预设', exact: true }).click();
    await page.getByPlaceholder('预设名称...').fill('保存方向移动测试');
    await page.getByRole('button', { name: '确定', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pictag_presets')).find(p => p.name === '保存方向移动测试'));
    assert.equal(saved.settings.watermarkOffsetX, 34.5); assert.equal(saved.settings.watermarkOffsetY, -22.25);
    await reset(); await change(() => page.getByRole('button', { name: '保存方向移动测试', exact: true }).click());
    assertRect(await stats(), 800, 600, 94.5, 37.75);
    pass('legacy presets restore zero offsets; fractional saved offsets remain compatible and direction changes save/restore correctly');

    await moveTo(40, 20);
    assertRect(await stats(), 800, 600, 100, 80);
    await change(() => logoInput.setInputFiles(replacement)); assertRect(await stats(), 800, 600, 100, 80, 80, 80);
    await change(() => page.getByRole('button', { name: '移除水印图片', exact: true }).click());
    assert.equal((await stats()).red.count, 0);
    await change(() => logoInput.setInputFiles(logo));
    assertRect(await stats(), 800, 600, 100, 80);
    await ready('portrait.png'); assertRect(await stats('portrait.png'), 600, 900, 100, 80);
    assert.equal(await page.evaluate(() => window.__encodeCount), 0, 'editing never encodes');
    pass('image replacement/removal/reselection and mixed dimensions preserve image position; editing performs no image encoding');

    const resize = page.getByText('调整图片尺寸', { exact: true }).locator('..').locator('input[type=checkbox]');
    await change(() => resize.check());
    await fill(page.getByText('目标宽度', { exact: true }).locator('..').locator('input'), 400);
    await fill(page.getByText('目标高度', { exact: true }).locator('..').locator('input'), 400);
    assertRect(await stats(), 400, 300, 100, 80);
    await ready('portrait.png'); assertRect(await stats('portrait.png'), 266, 400, 100, 80);
    await change(() => resize.uncheck());
    const crop = page.getByText('统一裁切尺寸', { exact: true }).locator('..').locator('input[type=checkbox]');
    await change(() => crop.check());
    await fill(page.getByText('宽度 (W)', { exact: true }).locator('..').locator('input'), 600);
    await fill(page.getByText('高度 (H)', { exact: true }).locator('..').locator('input'), 600);
    await change(() => range(page.getByRole('slider', { name: '缩放 source.png', exact: true }), .5));
    const edgesBefore = await card(sourceName).locator('[data-uncovered-edge]').evaluateAll(nodes => nodes.map(n => n.dataset.uncoveredEdge).sort());
    assert.equal(edgesBefore.length, 4);
    await stepInput.selectOption('10');
    await change(async () => { await directionButton('right').click(); await directionButton('down').click(); });
    assertRect(await stats(), 600, 600, 110, 90);
    const edgesAfter = await card(sourceName).locator('[data-uncovered-edge]').evaluateAll(nodes => nodes.map(n => n.dataset.uncoveredEdge).sort());
    assert.deepEqual(edgesAfter, edgesBefore);
    await page.screenshot({ path: out + '/03-crop-move.png', fullPage: true });
    pass('resized and cropped outputs use final output pixels; watermark movement leaves source coverage warnings unchanged');

    await processAll();
    const png = await download(() => page.getByRole('button', { name: '下载 source.png', exact: true }).click(), 'directions.png');
    measurements.png = await compare(png, 'image/png', 5); assert.equal(measurements.png.corner[3], 0);
    const zipped = await download(() => page.getByRole('button', { name: '批量导出 ZIP', exact: true }).click(), 'directions.zip');
    const zip = await JSZip.loadAsync(zipped); assert.deepEqual(Object.keys(zip.files).sort(), ['portrait.png', 'source.png']);
    assert.deepEqual(await zip.file('source.png').async('nodebuffer'), png);
    await change(() => directionButton('right').click());
    assert.equal(await page.getByRole('button', { name: '下载 source.png', exact: true }).count(), 0, 'position edits invalidate old export');
    const format = page.getByText('目标导出格式', { exact: true }).locator('..').locator('input[type=checkbox]');
    await change(() => format.check()); await processAll();
    const jpeg = await download(() => page.getByRole('button', { name: '下载 source.png', exact: true }).click(), 'directions.jpg');
    measurements.jpeg = await compare(jpeg, 'image/jpeg', 7, '#000000');
    assert.equal(measurements.jpeg.corner[3], 255); assert.ok(measurements.jpeg.corner.slice(0, 3).every(v => v < 4));
    assert.equal(measurements.png.width, 600); assert.equal(measurements.jpeg.height, 600);
    pass('actual PNG/JPEG/ZIP align with preview; crop warning overlays stay out of exports and direction changes invalidate old downloads');
    assert.deepEqual(errors, []);
    await fs.writeFile(out + '/results.json', JSON.stringify({ status: 'passed', checks, measurements, downloads: downloads.length, pageErrors: errors, url, viewport: '1500x1000', deviceScaleFactor: 2 }, null, 2));
    console.log('RESULT', checks.length, 'direction scenarios passed;', downloads.length, 'downloads checked');
  } catch (error) {
    await page.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {});
    await fs.writeFile(out + '/failure-snapshot.yml', await page.locator('body').ariaSnapshot()).catch(() => {});
    await fs.writeFile(out + '/results.json', JSON.stringify({ status: 'failed', checks, measurements, error: String(error), pageErrors: errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
