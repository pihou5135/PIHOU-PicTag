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
    FileReader, Image, console, localStorage: { getItem: () => JSON.stringify(presets), setItem() {} },
  })(require, module, module.exports);
  const panel = {
    settings: { text: '', color: '#ffffff', fontWeight: '700', enableTextWatermark: true, enableImageWatermark: true, watermarkImage: 'data:image/png;base64,old', watermarkScale: 1, watermarkOpacity: 1 },
    readers, decoders, readStates,
    render() {
      cursor = 0;
      tree = module.exports.default({ settings: panel.settings, setSettings(next) { panel.settings = typeof next === 'function' ? next(panel.settings) : next; }, onApplyAll() {}, isProcessing: false, onWatermarkReadStateChange(reading) { readStates.push(reading); } });
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
