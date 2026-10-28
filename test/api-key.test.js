'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SECRET_PREFIX, normalizeApiKey, secretKeyFor } = require('../lib/api-key');

test('normalizeApiKey trims strings and rejects other types', () => {
  assert.equal(normalizeApiKey('  gsk_abc  '), 'gsk_abc');
  assert.equal(normalizeApiKey(''), '');
  assert.equal(normalizeApiKey('   '), '');
  assert.equal(normalizeApiKey(undefined), '');
  assert.equal(normalizeApiKey(null), '');
  assert.equal(normalizeApiKey(42), '');
});

test('secretKeyFor stores one key per origin', () => {
  assert.equal(
    secretKeyFor('https://openrouter.ai/api/v1/chat/completions'),
    `${SECRET_PREFIX}::https://openrouter.ai`
  );
  assert.equal(
    secretKeyFor('https://api.groq.com/openai/v1/chat/completions'),
    `${SECRET_PREFIX}::https://api.groq.com`
  );
});

test('secretKeyFor ignores the endpoint path', () => {
  assert.equal(
    secretKeyFor('https://openrouter.ai/api/v1/chat/completions'),
    secretKeyFor('https://openrouter.ai/api/v1/responses')
  );
});

test('secretKeyFor keeps local ports distinct', () => {
  assert.notEqual(secretKeyFor('http://localhost:11434/v1'), secretKeyFor('http://localhost:1234/v1'));
});
