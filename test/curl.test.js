'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCurlArgs, formatCurlHeaders } = require('../lib/curl');

const CFG = {
  apiKey: 'gsk_secret_value',
  referer: 'https://kargn.as',
  title: 'kargnas'
};

test('curl arguments reference header and body files, never the key', () => {
  const args = buildCurlArgs({
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    headerFile: '/tmp/dir/headers',
    bodyFile: '/tmp/dir/body.json',
    timeoutMs: 25000
  });

  assert.deepEqual(args, [
    '-sS', '-L',
    '--max-time', '25',
    '-H', '@/tmp/dir/headers',
    '-d', '@/tmp/dir/body.json',
    'https://api.groq.com/openai/v1/chat/completions'
  ]);
  assert.equal(args.join(' ').includes(CFG.apiKey), false);
});

test('curl headers carry the authorization and metadata one per line', () => {
  const headers = formatCurlHeaders(CFG).trimEnd().split('\n');

  assert.deepEqual(headers, [
    'Authorization: Bearer gsk_secret_value',
    'Content-Type: application/json',
    'HTTP-Referer: https://kargn.as',
    'X-Title: kargnas',
    'Accept: application/json'
  ]);
});

test('curl headers strip CR/LF so values cannot inject headers', () => {
  const headers = formatCurlHeaders({ apiKey: 'k', referer: 'a\r\nX-Evil: 1', title: 'b\nc' });
  const lines = headers.trimEnd().split('\n');

  assert.equal(lines.some(line => line.startsWith('X-Evil:')), false);
  assert.equal(lines.includes('HTTP-Referer: a X-Evil: 1'), true);
  assert.equal(lines.includes('X-Title: b c'), true);
});

test('timeout is rounded up to whole seconds with a floor of one', () => {
  const base = { endpoint: 'https://x', headerFile: 'h', bodyFile: 'b' };

  assert.equal(buildCurlArgs({ ...base, timeoutMs: 1 })[3], '1');
  assert.equal(buildCurlArgs({ ...base, timeoutMs: 25001 })[3], '26');
  assert.equal(buildCurlArgs({ ...base, timeoutMs: 0 })[3], '25');
});
