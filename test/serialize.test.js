'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { toRequestBody } = require('../lib/serialize');

const BASE_PAYLOAD = {
  model: 'qwen/qwen3.8-27b',
  messages: [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'user prompt' }
  ],
  temperature: 0.2,
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'commit_message', strict: true, schema: {} }
  }
};

test('strips __meta from the serialized body', () => {
  const body = JSON.parse(toRequestBody({ ...BASE_PAYLOAD, __meta: { prompts: { system: 's', user: 'u' } } }));

  assert.deepEqual(Object.keys(body).sort(), ['messages', 'model', 'response_format', 'temperature']);
  assert.equal('__meta' in body, false);
  assert.equal(toRequestBody({ ...BASE_PAYLOAD, __meta: { prompts: {} } }).includes('__meta'), false);
});

test('preserves the rest of the payload verbatim', () => {
  const body = JSON.parse(toRequestBody({ ...BASE_PAYLOAD, __meta: { prompts: { system: 's', user: 'u' } } }));

  assert.deepEqual(body, BASE_PAYLOAD);
});

test('does not mutate the caller payload', () => {
  const payload = { ...BASE_PAYLOAD, __meta: { prompts: { system: 's', user: 'u' } } };

  toRequestBody(payload);

  assert.deepEqual(payload.__meta, { prompts: { system: 's', user: 'u' } });
});

test('serializes payloads without __meta unchanged', () => {
  assert.deepEqual(JSON.parse(toRequestBody(BASE_PAYLOAD)), BASE_PAYLOAD);
});

test('extension.js never serializes the diagnostic payload directly', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');

  assert.equal(source.includes('lastPayload.__meta ='), false, 'httpPost must not mutate the request payload');
  assert.equal(source.includes('JSON.stringify(payload)'), false, 'every transport must go through toRequestBody');
  assert.equal(
    (source.match(/toRequestBody\(payload\)/g) || []).length,
    2,
    'fetch and curl transports must both use toRequestBody'
  );
});
