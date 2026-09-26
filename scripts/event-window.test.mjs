import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

const load = async (path) => {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};
const { withGetReadyTime, eventPhase, displayStart, displayDuration, getReadyLength } = await load('../src/utils/eventWindow.ts');
const { calculateTimeReserve } = await load('../src/utils/timeReserve.ts');

const soccer = { id: 'soccer', name: 'Soccer Game', is_event: true, prep_minutes: 30, scheduled_time: '14:00', duration: 105 };

test('the get-ready time becomes part of the event block', () => {
  const block = withGetReadyTime(soccer);
  assert.equal(block.scheduled_time, '13:30');
  assert.equal(block.duration, 135);
  assert.equal(displayStart(block), '14:00');
  assert.equal(displayDuration(block), 105);
  assert.equal(getReadyLength(block), 30);
});

test('getting ready, then the event itself', () => {
  const block = withGetReadyTime(soccer);
  assert.equal(eventPhase(block, 13 * 60 + 45), 'prep');
  assert.equal(eventPhase(block, 14 * 60), 'event');
  assert.equal(eventPhase(block, 15 * 60), 'event');
  assert.equal(eventPhase({ name: 'Reading', scheduled_time: '14:00', duration: 20 }, 14 * 60), null);
});

test('get-ready time never starts before the child is up', () => {
  const block = withGetReadyTime({ ...soccer, scheduled_time: '07:10' }, 7 * 60);
  assert.equal(block.scheduled_time, '07:00');
  assert.equal(getReadyLength(block), 10);
  assert.equal(displayDuration(block), 105);
});

test('tasks and events without get-ready time are unchanged', () => {
  const task = { id: 't', name: 'Homework', scheduled_time: '16:00', duration: 30 };
  assert.equal(withGetReadyTime(task), task);
  const noPrep = withGetReadyTime({ ...soccer, prep_minutes: 0 });
  assert.equal(noPrep.scheduled_time, '14:00');
  assert.equal(noPrep.duration, 105);
});

test('free time ends when getting ready starts, not at kick-off', () => {
  const day = [
    { id: 'lunch', name: 'Lunch', scheduled_time: '12:00', duration: 30 },
    withGetReadyTime(soccer),
  ];
  const { freeWindows } = calculateTimeReserve(day, [], new Date(2026, 8, 26, 12, 40));
  assert.equal(freeWindows.length, 1);
  assert.equal(freeWindows[0].start, (12 * 60 + 30) * 60);
  assert.equal(freeWindows[0].end, (13 * 60 + 30) * 60);
});

test('a late must-do task never eats into an event', () => {
  const day = [
    { id: 'homework', name: 'Homework', scheduled_time: '12:00', duration: 30, is_important: true },
    { ...withGetReadyTime(soccer), late_policy: 'keep' },
  ];
  const { losses } = calculateTimeReserve(day, [], new Date(2026, 8, 26, 13, 45));
  assert.equal(losses.soccer, undefined);
});
