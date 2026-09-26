import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../src/utils/timelineCollision.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const output = { exports: {} };
new Function('require', 'exports', source)(require, output.exports);
const detect = output.exports.timelineCollisionDetection;
const rect = (top, height) => ({ top, bottom: top + height, left: 0, right: 300, width: 300, height });
const targets = [
  { id: 'dragged', rect: rect(0, 60) },
  { id: 'fixed', rect: rect(70, 60) },
  { id: 'gap', rect: rect(140, 200) },
  { id: 'tick-600', rect: rect(168, 28) },
  { id: 'tick-615', rect: rect(196, 28) },
];
const args = (y, containers = targets) => ({
  active: { id: 'dragged' },
  collisionRect: rect(y - 20, 40),
  pointerCoordinates: { x: 150, y },
  droppableContainers: containers,
  droppableRects: new Map(containers.map(c => [c.id, c.rect])),
});

test('a precise time slot wins over its containing gap', () => {
  assert.equal(detect(args(180))[0].id, 'tick-600');
  assert.equal(detect(args(210))[0].id, 'tick-615');
});
test('fixed tasks remain usable as landing references', () => {
  assert.equal(detect(args(90))[0].id, 'fixed');
});
test('the source card cannot mask a drop target', () => {
  assert.ok(detect(args(20)).every(hit => hit.id !== 'dragged'));
});
test('keyboard dragging finds a target without pointer coordinates', () => {
  assert.equal(detect({ ...args(90), pointerCoordinates: null })[0].id, 'fixed');
});
test('expanded or scrolled gap slots use their latest rectangles', () => {
  const moved = targets.map(c => ({ ...c, rect: rect(c.rect.top + 100, c.rect.height) }));
  assert.equal(detect(args(280, moved))[0].id, 'tick-600');
});
