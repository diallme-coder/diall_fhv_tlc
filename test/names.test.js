import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameMatches } from '../lib/names.js';

test('matches in any order, case, and punctuation', () => {
  assert.ok(nameMatches('Jane Doe', 'DOE,JANE,A'));
  assert.ok(nameMatches('doe, jane', 'DOE,JANE,A'));
  assert.ok(nameMatches('Jane A Doe', 'DOE,JANE,A'));
});

test('rejects wrong or partial names', () => {
  assert.ok(!nameMatches('Jane Smith', 'DOE,JANE,A'));
  assert.ok(!nameMatches('Jane', 'DOE,JANE,A')); // one token is not enough
  assert.ok(!nameMatches('', 'DOE,JANE,A'));
});

test('ignores accents and hyphens', () => {
  assert.ok(nameMatches('José Núñez', 'NUNEZ,JOSE'));
  assert.ok(nameMatches('Ana Lopez-Diaz', 'LOPEZ DIAZ,ANA'));
});
