'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');

test('the ping command does not hardcode the OpenRouter host', () => {
  assert.equal(source.includes("'https://openrouter.ai/api/v1/models'"), false);
  assert.match(source, /modelsUrl\(cfg\.endpointRaw\)/);
});
