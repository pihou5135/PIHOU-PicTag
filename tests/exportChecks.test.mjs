import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoverageIssues } from '../services/exportChecks.ts';

const settings = { enableCrop: true, cropWidth: 100, cropHeight: 100 };
const image = (id, overrides = {}) => ({
  id, file: { name: id + '.png' }, width: 100, height: 100,
  offsetX: 0, offsetY: 0, scale: 1, status: 'done', processedUrl: 'data:image/png;base64,AA==',
  ...overrides,
});

test('mixed batch names only affected, ready images and their exact edges', () => {
  const issues = getCoverageIssues([
    image('full'), image('left-gap', { offsetX: 10 }),
    image('small', { scale: 0.5 }), image('pending', { scale: 0.5, status: 'pending' }),
    image('no-output', { scale: 0.5, processedUrl: null }),
  ], settings);
  assert.deepEqual(issues.map(issue => issue.id), ['left-gap', 'small']);
  assert.deepEqual(issues[0].edges, ['左']);
  assert.deepEqual(new Set(issues[1].edges), new Set(['上', '右', '下', '左']));
});

test('fixed geometry, reset settings, and new images do not retain old warnings', () => {
  assert.equal(getCoverageIssues([image('a', { offsetY: 1 })], settings).length, 1);
  assert.deepEqual(getCoverageIssues([image('a')], settings), []);
  assert.deepEqual(getCoverageIssues([image('a', { scale: 0.5 })], { ...settings, enableCrop: false }), []);
  assert.deepEqual(getCoverageIssues([image('replacement')], settings), []);
});
