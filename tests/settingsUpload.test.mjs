import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the component's actual event callbacks with controlled FileReader
// and image completion order. Browser/React integration is verified separately.
const compiled = ts.transpileModule(readFileSync(new URL('../components/SettingsPanel.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

const createPanel = (presets = []) => {
  const slots = [];
  const readers = [];
  const decoders = [];
  const readStates = [];
  const settingsUpdates = [];
  const storageWrites = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const equal = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat() } }),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useId() { cursor++; return 'settings-test'; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (equal(slots[i]?.deps, deps)) return;
      const previous = slots[i];
      slots[i] = { deps };
      effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); });
    },
  };
  class FileReader {
    static LOADING = 1;
    readyState = 0;
    result = null;
    constructor() { readers.push(this); }
    readAsDataURL(file) { this.file = file; this.readyState = 1; }
    abort() { this.aborted = true; this.readyState = 2; this.onabort?.(); }
    finish(value) { this.readyState = 2; this.result = value; this.onload?.(); }
  }
  class Image {
    naturalWidth = 0;
    naturalHeight = 0;
    src = '';
    constructor() { decoders.push(this); }
    finish() { this.naturalWidth = 20; this.naturalHeight = 10; this.onload?.(); }
  }
  const module = { exports: {} };
  const require = name => {
    if (name === 'react') return React;
    if (name === '../constants') return { FONT_WEIGHTS: [] };
    if (name === 'lucide-react') return new Proxy({}, { get: (_, name) => String(name) });
    throw new Error('Unexpected import: ' + name);
  };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {
    FileReader, Image, console, localStorage: { getItem: () => JSON.stringify(presets), setItem(key, value) { storageWrites.push({ key, value }); } },
  })(require, module, module.exports);
  const panel = {
    settings: { text: '', color: '#ffffff', fontWeight: '700', enableTextWatermark: true, enableImageWatermark: true, watermarkImage: 'data:image/png;base64,old', watermarkScale: 1, watermarkOpacity: 1 },
    readers, decoders, readStates, settingsUpdates, storageWrites, isProcessing: false,
    render() {
      cursor = 0;
      tree = module.exports.default({ settings: panel.settings, setSettings(next) { panel.settings = typeof next === 'function' ? next(panel.settings) : next; settingsUpdates.push(panel.settings); }, onApplyAll() {}, isProcessing: panel.isProcessing, onWatermarkReadStateChange(reading) { readStates.push(reading); } });
      const pending = effects; effects = [];
      pending.forEach(run => run());
      return tree;
    },
    find(predicate) {
      const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (predicate(node)) return node;
        for (const child of node.props?.children ?? []) { const found = visit(child); if (found) return found; }
      };
      const result = visit(tree);
      assert.ok(result, 'component element should exist');
      return result;
    },
    choose(name = 'watermark.png', type = 'image/png') {
      const input = panel.find(n => n.type === 'input' && n.props.type === 'file');
      const target = { files: [{ name, type }], value: name };
      input.props.onChange({ currentTarget: target });
      assert.equal(target.value, '', 'same-file selection must remain possible');
      panel.render();
      return readers.at(-1);
    },
    click(label) { panel.find(n => n.props?.['aria-label'] === label).props.onClick(); panel.render(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
  panel.render(); panel.render();
  return panel;
};

test('latest file wins even when a canceled FileReader callback is already queued', () => {
  const panel = createPanel();
  const a = panel.choose('a.png');
  const staleLoad = a.onload;
  const b = panel.choose('b.png');
  assert.equal(a.aborted, true);
  assert.equal(panel.readStates.at(-1), true, 'parent export guard learns about the pending read immediately');
  assert.equal(panel.settings.watermarkImage, 'data:image/png;base64,old');
  assert.equal(panel.find(n => n.type === 'button' && n.props.onClick && n.props.disabled === true).props.disabled, true);
  a.result = 'data:image/png;base64,a'; staleLoad();
  assert.equal(panel.decoders.length, 0);
  b.finish('data:image/png;base64,b');
  panel.decoders.at(-1).finish(); panel.render();
  assert.equal(panel.settings.watermarkImage, 'data:image/png;base64,b');
  assert.equal(panel.readStates.at(-1), false);
});

test('latest image wins when decoding the previous selection finishes late', () => {
  const panel = createPanel();
  panel.choose('a.png').finish('data:image/png;base64,a');
  const a = panel.decoders[0];
  const staleDecode = a.onload;
  panel.choose('b.png').finish('data:image/png;base64,b');
  panel.decoders[1].finish();
  a.naturalWidth = a.naturalHeight = 20; staleDecode();
  assert.equal(panel.settings.watermarkImage, 'data:image/png;base64,b');
  assert.equal(panel.readStates.at(-1), false);
});

for (const action of ['remove', 'disable', 'preset', 'unmount']) {
  test(`${action} invalidates pending decoding without resurrecting the selected image`, () => {
    const preset = { id: 'saved', name: 'Saved watermark', settings: { enableImageWatermark: true, watermarkImage: 'data:image/png;base64,preset' } };
    const panel = createPanel([preset]);
    panel.choose().finish('data:image/png;base64,new');
    const image = panel.decoders[0];
    const staleDecode = image.onload;
    if (action === 'remove') panel.click('移除水印图片');
    if (action === 'disable') panel.click('图片水印');
    if (action === 'preset') {
      panel.find(n => n.type === 'button' && n.props.children.includes('Saved watermark')).props.onClick();
      panel.render();
    }
    if (action === 'unmount') panel.unmount();
    image.naturalWidth = image.naturalHeight = 20; staleDecode();
    const expected = action === 'remove' ? null : action === 'preset' ? 'data:image/png;base64,preset' : 'data:image/png;base64,old';
    assert.equal(panel.settings.watermarkImage, expected);
    assert.equal(panel.readStates.at(-1), false);
    if (action === 'disable') {
      assert.equal(panel.settings.enableImageWatermark, false);
      assert.equal(panel.settings.enableTextWatermark, true);
    }
  });
}

for (const failure of ['read', 'invalid-result', 'decode']) {
  test(`${failure} failure preserves current watermark and exposes an error`, () => {
    const panel = createPanel();
    const reader = panel.choose();
    if (failure === 'read') reader.onerror();
    if (failure === 'invalid-result') reader.finish(null);
    if (failure === 'decode') {
      reader.finish('data:image/png;base64,broken');
      panel.decoders.at(-1).onerror();
    }
    panel.render();
    assert.equal(panel.settings.watermarkImage, 'data:image/png;base64,old');
    assert.ok(panel.find(n => n.props?.role === 'alert'));
    assert.equal(panel.readStates.at(-1), false);
    panel.choose(); // Retrying the identical file is allowed after failure.
    assert.equal(panel.readers.length, 2);
  });
}


const stepInput = panel => panel.find(n => n.props?.['aria-label'] === '每次移动距离');
const directionPad = panel => panel.find(n => n.props?.role === 'group' && n.props['aria-label'] === '移动图片水印');
const changeStep = (panel, value) => {
  stepInput(panel).props.onChange({ target: { value: String(value) } });
  panel.render();
};
const pressDirection = (panel, key, modifiers = {}) => {
  let prevented = false;
  directionPad(panel).props.onKeyDown({ key, preventDefault() { prevented = true; }, ...modifiers });
  panel.render();
  return prevented;
};
const loadPreset = (panel, name) => {
  panel.find(n => n.type === 'button' && n.props.children.includes(name)).props.onClick();
  panel.render(); panel.render();
};

for (const [direction, x, y] of [['上', 0, -10], ['下', 0, 10], ['左', -10, 0], ['右', 10, 0]]) {
  test(`${direction} button moves only the corresponding image coordinate at the default step`, () => {
    const panel = createPanel();
    panel.settings = { ...panel.settings, text: 'Text stays put', marginX: 60, marginY: 80, watermarkPosition: 'bottom-right' };
    panel.render();
    const before = { ...panel.settings };
    assert.equal(stepInput(panel).props.value, 10);
    panel.click(`图片水印向${direction}移动`);
    assert.deepEqual({ ...panel.settings }, { ...before, watermarkOffsetX: x, watermarkOffsetY: y });
  });
}

test('movement distance selects 1, 10 or 50 pixels without moving the image or changing settings', () => {
  const panel = createPanel();
  const before = { ...panel.settings };
  changeStep(panel, 1);
  assert.deepEqual({ ...panel.settings }, before);
  panel.click('图片水印向左移动');
  assert.equal(panel.settings.watermarkOffsetX, -1);
  changeStep(panel, 50);
  panel.click('图片水印向下移动');
  assert.equal(panel.settings.watermarkOffsetY, 50);
  changeStep(panel, 10);
  panel.click('图片水印向右移动');
  assert.equal(panel.settings.watermarkOffsetX, 9);
  changeStep(panel, 999);
  assert.equal(stepInput(panel).props.value, 10, 'unexpected selection is ignored');
});

test('rapid clicks before a render accumulate using the latest settings', () => {
  const panel = createPanel();
  const right = panel.find(n => n.props?.['aria-label'] === '图片水印向右移动').props.onClick;
  right(); right(); right();
  panel.render();
  assert.equal(panel.settings.watermarkOffsetX, 30);
  assert.equal(panel.settings.watermarkOffsetY, 0);
});

test('direction keys act only on the direction pad and leave native Enter, Space and modified shortcuts alone', () => {
  const panel = createPanel();
  assert.ok(directionPad(panel).props.children.every(n => n.type === 'button'), 'step selector is outside the keyboard handler group');
  assert.equal(pressDirection(panel, 'ArrowUp'), true);
  assert.equal(panel.settings.watermarkOffsetY, -10);
  assert.equal(pressDirection(panel, 'ArrowRight'), true);
  assert.equal(panel.settings.watermarkOffsetX, 10);
  assert.equal(pressDirection(panel, 'ArrowDown'), true);
  assert.equal(panel.settings.watermarkOffsetY, 0);
  assert.equal(pressDirection(panel, 'ArrowLeft'), true);
  assert.equal(panel.settings.watermarkOffsetX, 0);
  const count = panel.settingsUpdates.length;
  for (const key of ['Enter', ' ', 'Tab']) assert.equal(pressDirection(panel, key), false);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) assert.equal(pressDirection(panel, 'ArrowLeft', { [modifier]: true }), false);
  assert.equal(panel.settingsUpdates.length, count);
});

test('reset clears both image offsets atomically without changing text, margins or image appearance', () => {
  const panel = createPanel();
  panel.settings = { ...panel.settings, text: 'Keep', marginX: 20, marginY: 40, watermarkPosition: 'center', watermarkOpacity: 0.5, watermarkOffsetX: -100.25, watermarkOffsetY: 40.5 };
  panel.render();
  const before = { ...panel.settings };
  const count = panel.settingsUpdates.length;
  panel.click('重置图片水印位置');
  assert.equal(panel.settingsUpdates.length, count + 1);
  assert.deepEqual({ ...panel.settings }, { ...before, watermarkOffsetX: 0, watermarkOffsetY: 0 });
});

test('legacy partial presets restore zero offsets while retaining unrelated existing settings', () => {
  const panel = createPanel([{ id: 'old', name: 'Old preset', settings: { fontSize: 99 } }]);
  panel.click('图片水印向左移动'); panel.click('图片水印向下移动');
  const image = panel.settings.watermarkImage;
  loadPreset(panel, 'Old preset');
  assert.equal(panel.settings.watermarkOffsetX, 0);
  assert.equal(panel.settings.watermarkOffsetY, 0);
  assert.equal(panel.settings.fontSize, 99);
  assert.equal(panel.settings.watermarkImage, image);
});

test('new presets restore their own fractional offsets and the next move starts from that position', () => {
  const panel = createPanel([{ id: 'new', name: 'New preset', settings: { watermarkOffsetX: -18.75, watermarkOffsetY: 31.5 } }]);
  changeStep(panel, 1);
  loadPreset(panel, 'New preset');
  assert.equal(panel.settings.watermarkOffsetX, -18.75);
  assert.equal(panel.settings.watermarkOffsetY, 31.5);
  assert.equal(stepInput(panel).props.value, 1, 'step remains an operation option');
  panel.click('图片水印向右移动');
  assert.equal(panel.settings.watermarkOffsetX, -17.75);
});

test('non-finite previous offsets safely start at zero', () => {
  const panel = createPanel();
  panel.settings = { ...panel.settings, watermarkOffsetX: NaN, watermarkOffsetY: Infinity };
  panel.render();
  panel.click('图片水印向右移动');
  assert.equal(panel.settings.watermarkOffsetX, 10);
  assert.equal(panel.settings.watermarkOffsetY, 0);
});

for (const disabledBy of ['processing', 'image-disabled']) {
  test(`${disabledBy} disables image controls and makes direction/reset handlers inert`, () => {
    const panel = createPanel();
    panel.settings = { ...panel.settings, watermarkOffsetX: 25, watermarkOffsetY: -35 };
    if (disabledBy === 'processing') panel.isProcessing = true;
    else panel.settings.enableImageWatermark = false;
    panel.render();
    assert.equal(panel.find(n => n.type === 'fieldset').props.disabled, true);
    const count = panel.settingsUpdates.length;
    panel.click('图片水印向上移动');
    panel.click('重置图片水印位置');
    assert.equal(pressDirection(panel, 'ArrowRight'), false);
    assert.equal(panel.settingsUpdates.length, count);
    assert.equal(panel.settings.watermarkOffsetX, 25);
    assert.equal(panel.settings.watermarkOffsetY, -35);
  });
}

test('changing anchor, replacing, disabling and removing an image retain chosen offsets', () => {
  const panel = createPanel();
  panel.click('图片水印向左移动'); panel.click('图片水印向下移动');
  panel.find(n => n.props?.['aria-label'] === '图片水印位置').props.onChange({ target: { value: 'top-left' } });
  panel.render();
  panel.choose().finish('data:image/png;base64,replacement');
  panel.decoders.at(-1).finish(); panel.render();
  panel.click('图片水印'); panel.click('图片水印');
  panel.click('移除水印图片');
  assert.equal(panel.settings.watermarkOffsetX, -10);
  assert.equal(panel.settings.watermarkOffsetY, 10);
  assert.equal(panel.settings.watermarkPosition, 'top-left');
  assert.equal(panel.settings.watermarkImage, null);
});

test('saved presets include position but never the temporary movement distance', () => {
  const panel = createPanel();
  changeStep(panel, 50);
  panel.click('图片水印向上移动');
  panel.find(n => n.type === 'button' && n.props.children.some(c => typeof c === 'string' && c.trim() === '保存当前为预设')).props.onClick();
  panel.render();
  panel.find(n => n.type === 'input' && n.props.placeholder === '预设名称...').props.onChange({ target: { value: 'Moved logo' } });
  panel.render();
  panel.find(n => n.type === 'button' && n.props.children.some(c => typeof c === 'string' && c.trim() === '确定')).props.onClick();
  const saved = JSON.parse(panel.storageWrites.at(-1).value)[0];
  assert.equal(saved.name, 'Moved logo');
  assert.equal(saved.settings.watermarkOffsetY, -50);
  assert.deepEqual(saved.settings, { ...panel.settings });
  assert.equal(Object.keys(saved.settings).some(key => /step/i.test(key)), false);
});
