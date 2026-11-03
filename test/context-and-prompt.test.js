'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'extension.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// Extract pure helper functions from extension.js by compiling helper functions together
const helpersScope = new Function('path', 'vscode', `
  const ALLOWED_TYPES = ['feat','fix','perf','refactor','style','docs','test','build','ci','chore','revert'];
  ${source.match(/function cleanGitPath[\s\S]*?\n\}/)[0]}
  ${source.match(/function buildServiceMap[\s\S]*?\n\}/)[0]}
  ${source.match(/function detectIntent[\s\S]*?\n\}/)[0]}
  ${source.match(/function extractSymbols[\s\S]*?\n\}/)[0]}
  ${source.match(/function summariseFile[\s\S]*?\n\}/)[0]}
  return { cleanGitPath, buildServiceMap, detectIntent, extractSymbols, summariseFile };
`)(path, {});

const { cleanGitPath, buildServiceMap, detectIntent, summariseFile } = helpersScope;
const buildUserPromptMatch = source.match(/function buildUserPrompt\([\s\S]*?\n\}/);
const buildUserPrompt = new Function(`${buildUserPromptMatch[0]}; return buildUserPrompt;`)();

function createMockContext() {
  return {
    repo_meta: {
      repo_name: 'qr-pictrs',
      default_branch: 'main',
      current_branch: 'main',
      commit_language: 'auto',
      languages: ['py', 'md'],
      service_map: { docs: 'docs' }
    },
    intent_signals: {
      branch_hints: [],
      previous_commits_touching_same_symbols: []
    },
    file_summaries: [{ path: 'README.md', change_kind: 'modified' }],
    test_changes: [],
    project_tree: ['./ [Staged] [Modified]'],
    open_tabs: [],
    heavy_diff_snapshots: [],
    diffs: 'diff --git a/README.md b/README.md\n- See TEST_READY.md\n+ See docs/TEST_READY.md'
  };
}

test('cleanGitPath and buildServiceMap sanitize quoted git paths', () => {
  assert.equal(cleanGitPath('"docs/TEST_READY.md"'), 'docs/TEST_READY.md');
  assert.equal(cleanGitPath('"\\"docs/TEST_READY.md"'), 'docs/TEST_READY.md');

  const files = [
    '"\\"docs/TEST_READY.md"',
    'docs/guide.md',
    'photosort/scanner.py',
    'scripts/deploy.sh',
    'README.md'
  ];
  const map = buildServiceMap(files);
  assert.deepEqual(map, {
    docs: 'docs',
    photosort: 'photosort',
    scripts: 'scripts'
  });
  assert.equal(Object.keys(map).includes('"docs'), false);
});

test('detectIntent and summariseFile classify docs and tests with low risk even if diff mentions fix', () => {
  const docDiffWithFixWord = `@@ -71,4 +71,4 @@
 - Real-asset tests guard with \`pytest.skip\` when files are absent.
 - Naming: adversarial test; fix-phase regressions in tests/unit/test_review_phase.py.
-- TEST_READY.md: E2E tier certification.
+- docs/TEST_READY.md: E2E tier certification.`;

  const agentsSummary = summariseFile('AGENTS.md', docDiffWithFixWord);
  assert.equal(agentsSummary.intent_guess, 'docs');
  assert.equal(agentsSummary.risk, 'low');
  assert.equal(agentsSummary.high_level, 'documentation update');

  const readmeSummary = summariseFile('README.md', docDiffWithFixWord);
  assert.equal(readmeSummary.intent_guess, 'docs');
  assert.equal(readmeSummary.risk, 'low');

  const testSummary = summariseFile('tests/unit/test_sample.py', '+def test_run(): pass');
  assert.equal(testSummary.intent_guess, 'test');
  assert.equal(testSummary.risk, 'low');
});

test('detectIntent only scans added lines for code files', () => {
  const codeDiffWithContextFix = `@@ -10,4 +10,4 @@
 // This is an old bug fix from 2021
 function render() {
-  const count = 1;
+  const count = 2;
 }`;

  assert.equal(detectIntent(codeDiffWithContextFix, 'src/render.js'), 'unknown');

  const codeDiffWithRealFix = `@@ -10,4 +10,4 @@
 function render() {
-  const count = 1;
+  // fix: prevent null pointer exception
+  const count = value || 0;
 }`;

  assert.equal(detectIntent(codeDiffWithRealFix, 'src/render.js'), 'bugfix');
});

test('COMMIT_SCHEMA_OBJECT allows empty body array (minItems: 0)', () => {
  assert.match(source, /body:\s*\{[\s\S]*?minItems:\s*0/);
});

test('buildUserPrompt supports custom instructionPrompt and taskPrompt overrides', () => {
  const ctx = createMockContext();

  const overridden = buildUserPrompt(ctx, {
    instructionPrompt: 'Custom instructions text.',
    taskPrompt: 'Custom task text.',
    customInstructions: 'Always use active voice.'
  });

  assert.ok(overridden.includes('<instructions>\nCustom instructions text.\n</instructions>'));
  assert.ok(overridden.includes('<user_instructions>\nAlways use active voice.\n</user_instructions>'));
  assert.ok(overridden.includes('<task>\nCustom task text.\n- Comply strictly with all directives provided in <user_instructions>.\n</task>'));
});
