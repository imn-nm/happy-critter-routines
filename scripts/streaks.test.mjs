import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

// The database side (counting beads, paying stars) is tested in
// scripts/sql/streaks.test.sql; this is the child screen's side: what it
// cheers when it next looks.
const load = async (path) => {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};
const { celebrationFor } = await load('../src/components/round/streakSeen.ts');

test('first look: nothing to cheer, just remember', () => {
  assert.equal(celebrationFor({ rounds: 0, count: 3 }, null), null);
});

test('a new bead since last time hops in', () => {
  assert.equal(celebrationFor({ rounds: 0, count: 3 }, { rounds: 0, count: 2 }), 'bead');
});

test('two beads while the screen was asleep still cheers once', () => {
  assert.equal(celebrationFor({ rounds: 0, count: 4 }, { rounds: 0, count: 2 }), 'bead');
});

test('a finished round is the big star, even though the beads went back to 0', () => {
  assert.equal(celebrationFor({ rounds: 1, count: 0 }, { rounds: 0, count: 4 }), 'round');
});

test('"Not this time" empties the beads without a sound', () => {
  assert.equal(celebrationFor({ rounds: 0, count: 0 }, { rounds: 0, count: 3 }), null);
});

test("a parent's undo of the finishing yes is never cheered", () => {
  assert.equal(celebrationFor({ rounds: 0, count: 4 }, { rounds: 1, count: 0 }), null);
});

test('nothing changed, nothing to cheer', () => {
  assert.equal(celebrationFor({ rounds: 2, count: 1 }, { rounds: 2, count: 1 }), null);
});
