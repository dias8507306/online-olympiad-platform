// node --test tests/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, isCorrect, findProblem, publicProblems } from '../api/_lib/problems.js';
import { nameKey, normName, validName } from '../api/_lib/db.js';

test('name: same child written differently gives same key', () => {
  const k = nameKey('Әли Серік');
  for (const v of ['әли серік', '  Әли   Серік ', 'Серік Әли', 'Али Серик', 'АЛИ СЕРИК', 'Әли-Серік']) assert.equal(nameKey(v), k, v);
  assert.notEqual(nameKey('Аружан Серік'), k);
  assert.equal(nameKey('Айгерім Нұрлан'), nameKey('Айгерим Нурлан'));
  assert.equal(normName('  әли   серік '), 'Әли Серік');
});

test('name must be first + last name', () => {
  for (const v of ['Әли Серік', 'али серик', 'Ali Serik', 'Әли Серік Нұрланұлы']) assert.ok(validName(v), v);
  for (const v of ['', 'Әли', 'Ә Серік', '123 456', 'Әли С']) assert.ok(!validName(v), v);
});

test('answer parsing: exactly one number', () => {
  const ok = { '57': 57, ' 57 ': 57, '1275': 1275, '1 275': 1275, '1,275': 1275, '75°': 75, '5000 тг': 5000, 'Жауабы 59': 59, '2,5': 2.5 };
  for (const [k, v] of Object.entries(ok)) assert.equal(parseAnswer(k), v, k);
  for (const k of ['', 'абв', '57 немесе 58', '57, 58']) assert.equal(parseAnswer(k), null, k);
});

test('correctness', () => {
  assert.ok(isCorrect(findProblem('56-d7'), '1 275'));
  assert.ok(isCorrect(findProblem('34-d1'), '57'));
  assert.ok(!isCorrect(findProblem('34-d1'), '58'));
});

test('parents never receive answers or future problems', () => {
  const pub = publicProblems('34', '2026-11-08');
  assert.deepEqual(pub.map((p) => p.status), ['closed', 'closed', 'open', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  assert.ok(pub.every((p) => !('answer' in p)));
  assert.ok(!('kk' in pub[3]));
});
