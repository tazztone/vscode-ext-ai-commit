'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'extension.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('getConfig is async and every call site awaits it', () => {
  assert.match(source, /async function getConfig\(\)/);
  assert.equal((source.match(/getConfig\(\)/g) || []).length, 4, 'definition plus three call sites');
  assert.equal((source.match(/await getConfig\(\)/g) || []).length, 3);
  assert.equal(/=\s*getConfig\(\)/.test(source), false, 'every getConfig() call must be awaited');
});

test('getConfig reads the key from SecretStorage, not the settings file', () => {
  assert.equal(source.includes("readSetting(c, 'apiKey')"), false);
  assert.match(source, /await readStoredApiKey\(endpointRaw\)/);
});

test('both API key commands are declared in package.json', () => {
  const commands = pkg.contributes.commands.map(entry => entry.command);

  assert.ok(commands.includes('kargnas.aiCommit.setApiKey'));
  assert.ok(commands.includes('kargnas.aiCommit.clearApiKey'));
  assert.match(
    pkg.contributes.configuration.properties['kargnas.aiCommit.apiKey'].deprecationMessage,
    /SecretStorage/
  );
});
