'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { modelsUrl } = require('../lib/endpoint');

test('modelsUrl derives /models from chat completions endpoints', () => {
  assert.equal(modelsUrl('https://openrouter.ai/api/v1/chat/completions'), 'https://openrouter.ai/api/v1/models');
  assert.equal(modelsUrl('https://api.groq.com/openai/v1/chat/completions'), 'https://api.groq.com/openai/v1/models');
});

test('modelsUrl handles responses endpoints and trailing slashes', () => {
  assert.equal(modelsUrl('https://api.openai.com/v1/responses'), 'https://api.openai.com/v1/models');
  assert.equal(modelsUrl('https://openrouter.ai/api/v1/chat/completions/'), 'https://openrouter.ai/api/v1/models');
});

test('modelsUrl appends /models when the endpoint has no known suffix', () => {
  assert.equal(modelsUrl('https://gateway.example/v1'), 'https://gateway.example/v1/models');
  assert.equal(modelsUrl('https://gateway.example/'), 'https://gateway.example/models');
});

test('modelsUrl preserves query parameters', () => {
  assert.equal(
    modelsUrl('https://gateway.example/v1/chat/completions?api-version=2024-02-01'),
    'https://gateway.example/v1/models?api-version=2024-02-01'
  );
});

test('modelsUrl returns null for invalid endpoints', () => {
  assert.equal(modelsUrl('not a url'), null);
  assert.equal(modelsUrl(''), null);
  assert.equal(modelsUrl(undefined), null);
});
