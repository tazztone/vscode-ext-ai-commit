'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { endpointOrigin } = require('../lib/endpoint');

test('endpointOrigin keeps scheme, host and port only', () => {
  assert.equal(endpointOrigin('https://openrouter.ai/api/v1/chat/completions'), 'https://openrouter.ai');
  assert.equal(endpointOrigin('http://localhost:11434/v1/chat/completions'), 'http://localhost:11434');
  assert.equal(endpointOrigin('https://api.groq.com/openai/v1/chat/completions'), 'https://api.groq.com');
});

test('endpointOrigin treats chat and responses paths as the same origin', () => {
  assert.equal(
    endpointOrigin('https://openrouter.ai/api/v1/chat/completions'),
    endpointOrigin('https://openrouter.ai/api/v1/responses')
  );
});

test('endpointOrigin trims input and lowercases the host', () => {
  assert.equal(endpointOrigin('  https://API.Groq.com/openai/v1/chat/completions  '), 'https://api.groq.com');
});

test('endpointOrigin falls back to the raw value for invalid URLs', () => {
  assert.equal(endpointOrigin('not a url'), 'not a url');
  assert.equal(endpointOrigin(''), '');
  assert.equal(endpointOrigin(undefined), '');
});
