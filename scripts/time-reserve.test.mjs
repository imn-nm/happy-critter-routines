import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/utils/timeReserve.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { calculateTimeReserve: calculate } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const now = minute => new Date(2026, 8, 13, 12, minute);
const tasks = [
  { id: 'lunch', name: 'Lunch', scheduled_time: '12:00', duration: 20, is_important: true },
  { id: 'school', name: 'School', scheduled_time: '12:30', duration: 360 },
  { id: 'story', name: 'Storytime', scheduled_time: '18:30', duration: 20, is_fun_time: true },
  { id: 'bed', name: 'Bedtime', scheduled_time: '18:50', duration: 10 },
];
test('on-time task shows the full free reserve before any loss', () => {
  assert.equal(calculate(tasks, [], now(17)).reserve.remainingSeconds, 600);
});
test('unallocated time protects an activity much later in the day', () => {
  const result = calculate(tasks, [], now(25));
  assert.equal(result.reserve.id, 'free-time');
  assert.equal(result.reserve.remainingSeconds, 300);
  assert.equal(result.losses.story, 0);
});
test('exhaustion hands off to the optional activity and never normal tasks', () => {
  const result = calculate(tasks, [], now(35));
  assert.equal(result.reserve.name, 'Storytime');
  assert.equal(result.reserve.remainingSeconds, 900);
  assert.equal(result.losses.school, undefined);
  assert.equal(result.losses.bed, undefined);
});
test('completion retains losses and stops accumulating them', () => {
  const completed = tasks.map(t => t.id === 'lunch' ? { ...t, isCompleted: true } : t);
  const records = [{ task_id: 'lunch', completed_at: '2026-09-13T19:35:00Z' }];
  assert.equal(calculate(completed, records, now(50)).reserve.remainingSeconds, 900);
});
test('overlapping unfinished tasks never spend the same minute twice', () => {
  const overlapping = [...tasks, { id: 'other', name: 'Other', scheduled_time: '12:05', duration: 15, is_important: true }];
  assert.equal(calculate(overlapping, [], now(35)).losses.story, 300);
});
test('all reserves exhausted stays at zero', () => {
  assert.equal(calculate(tasks, [], now(55)).reserve.remainingSeconds, 0);
});
test('no eligible reserve shows no invented loss', () => {
  assert.equal(calculate([tasks[0]], [], now(55)).reserve, null);
});
test('spent gaps have a later available start and the same fixed end', () => {
  const result = calculate(tasks, [], now(25));
  assert.deepEqual(result.freeWindows[0], { originalStart: 44400, start: 44700, end: 45000 });
});
test('an activity already in progress also reflects real time passing', () => {
  const completed = tasks.map(t => t.id === 'lunch' ? { ...t, isCompleted: true } : t);
  const records = [{ task_id: 'lunch', completed_at: '2026-09-13T19:20:00Z' }];
  assert.equal(calculate(completed, records, new Date(2026, 8, 13, 18, 40)).reserve.remainingSeconds, 600);
});
test('moving past one gap does not refill the free-time bar', () => {
  const day = [
    { id: 'first', name: 'First', scheduled_time: '12:00', duration: 10 },
    { id: 'second', name: 'Second', scheduled_time: '12:20', duration: 10 },
    { id: 'third', name: 'Third', scheduled_time: '12:40', duration: 10 },
  ];
  const before = calculate(day, [], now(19)).reserve;
  const after = calculate(day, [], now(21)).reserve;
  assert.equal(before.totalSeconds, after.totalSeconds);
  assert.ok(after.remainingSeconds < before.remainingSeconds);
});
