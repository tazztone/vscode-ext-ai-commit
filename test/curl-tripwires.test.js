'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');

test('the curl transport never puts the key in the command arguments', () => {
  const start = source.indexOf('async function viaCurl(){');
  const end = source.indexOf("if (cfg.transport === 'curl')", start);

  assert.ok(start > 0 && end > start, 'viaCurl must exist');
  const viaCurl = source.slice(start, end);
  assert.equal(viaCurl.includes('Bearer'), false);
  assert.match(viaCurl, /buildCurlArgs\(/);
  assert.match(viaCurl, /fs\.rmSync\(dir/);
});
