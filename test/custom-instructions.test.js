'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'extension.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// Extract pure buildUserPrompt function from extension.js for direct behavioral testing
const buildUserPromptMatch = source.match(/function buildUserPrompt\([\s\S]*?\n\}/);
if (!buildUserPromptMatch) {
  throw new Error('Could not find buildUserPrompt in extension.js');
}
const buildUserPrompt = new Function(`${buildUserPromptMatch[0]}; return buildUserPrompt;`)();

function createMockContext() {
  return {
    repo_meta: {
      repo_name: 'test-repo',
      default_branch: 'main',
      current_branch: 'feat/test',
      commit_language: 'auto',
      languages: ['js'],
      service_map: {}
    },
    intent_signals: {
      branch_hints: [],
      previous_commits_touching_same_symbols: []
    },
    file_summaries: [{ path: 'test.js', change_kind: 'modified' }],
    test_changes: [],
    project_tree: ['./ [Staged] [Modified]'],
    open_tabs: ['test.js'],
    heavy_diff_snapshots: [],
    diffs: 'diff --git a/test.js b/test.js\n+console.log(1);'
  };
}

test('customInstructions setting is declared in package.json', () => {
  const setting = pkg.contributes.configuration.properties['kargnas.aiCommit.customInstructions'];
  assert.ok(setting, 'kargnas.aiCommit.customInstructions must be declared');
  assert.equal(setting.type, 'string');
  assert.equal(setting.default, '');
  assert.equal(setting.editPresentation, 'multilineText');
  assert.match(setting.description, /Custom instructions/);
});

test('systemPrompt setting has disambiguating description in package.json', () => {
  const setting = pkg.contributes.configuration.properties['kargnas.aiCommit.systemPrompt'];
  assert.ok(setting, 'kargnas.aiCommit.systemPrompt must be declared');
  assert.match(setting.description, /System role\/persona/);
  assert.match(setting.description, /customInstructions/);
});

test('getConfig reads customInstructions and generate passes it to buildUserPrompt', () => {
  assert.match(source, /readSetting\(c,\s*'customInstructions'\)/);
  assert.match(source, /\bcustomInstructions\s*[,}]/);
  assert.match(source, /buildUserPrompt\(context,\s*cfg\.customInstructions\)/);
});

test('buildUserPrompt omits user_instructions when empty or whitespace', () => {
  const ctx = createMockContext();

  const emptyPrompt = buildUserPrompt(ctx, '');
  assert.equal(emptyPrompt.includes('<user_instructions>'), false);
  assert.equal(emptyPrompt.includes('Comply strictly with all directives provided in <user_instructions>'), false);

  const undefPrompt = buildUserPrompt(ctx, undefined);
  assert.equal(undefPrompt.includes('<user_instructions>'), false);
  assert.equal(undefPrompt.includes('Comply strictly with all directives provided in <user_instructions>'), false);

  const wsPrompt = buildUserPrompt(ctx, '   \n  \t  ');
  assert.equal(wsPrompt.includes('<user_instructions>'), false);
  assert.equal(wsPrompt.includes('Comply strictly with all directives provided in <user_instructions>'), false);
});

test('buildUserPrompt injects user_instructions tag and task directive when provided', () => {
  const ctx = createMockContext();
  const custom = 'Always use present tense.\nMention PROJ ticket numbers.';
  const prompt = buildUserPrompt(ctx, custom);

  assert.ok(prompt.includes('</instructions>\n\n<user_instructions>\nAlways use present tense.\nMention PROJ ticket numbers.\n</user_instructions>'));
  assert.ok(prompt.includes('- Comply strictly with all directives provided in <user_instructions>.'));
});
