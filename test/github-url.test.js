'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { gitRemoteToGitHubUrl } = require('../lib/github-url');

test('parses SCP-style SSH remotes', () => {
  assert.equal(gitRemoteToGitHubUrl('git@github.com:kargnas/vscode-ext-ai-commit.git'), 'https://github.com/kargnas/vscode-ext-ai-commit');
  assert.equal(gitRemoteToGitHubUrl('git@github.com:kargnas/vscode-ext-ai-commit'), 'https://github.com/kargnas/vscode-ext-ai-commit');
  assert.equal(gitRemoteToGitHubUrl('git@github.com:org/sub/repo.git'), 'https://github.com/org/sub/repo');
});

test('parses HTTPS remotes with and without token authentication', () => {
  assert.equal(gitRemoteToGitHubUrl('https://github.com/kargnas/vscode-ext-ai-commit.git'), 'https://github.com/kargnas/vscode-ext-ai-commit');
  assert.equal(gitRemoteToGitHubUrl('https://token@github.com/kargnas/vscode-ext-ai-commit.git'), 'https://github.com/kargnas/vscode-ext-ai-commit');
  assert.equal(gitRemoteToGitHubUrl('https://user:pass@github.com/kargnas/vscode-ext-ai-commit.git'), 'https://github.com/kargnas/vscode-ext-ai-commit');
});

test('parses SSH URL schemes with standard and custom ports', () => {
  assert.equal(gitRemoteToGitHubUrl('ssh://git@github.com/kargnas/vscode-ext-ai-commit.git'), 'https://github.com/kargnas/vscode-ext-ai-commit');
  assert.equal(gitRemoteToGitHubUrl('ssh://git@github.com:22/kargnas/vscode-ext-ai-commit.git'), 'https://github.com/kargnas/vscode-ext-ai-commit');
});

test('handles trailing slashes and whitespace', () => {
  assert.equal(gitRemoteToGitHubUrl('  https://github.com/kargnas/vscode-ext-ai-commit.git/  '), 'https://github.com/kargnas/vscode-ext-ai-commit');
  assert.equal(gitRemoteToGitHubUrl('git@github.com:kargnas/vscode-ext-ai-commit.git/'), 'https://github.com/kargnas/vscode-ext-ai-commit');
});

test('rejects non-GitHub remotes and malformed URLs', () => {
  assert.equal(gitRemoteToGitHubUrl('git@gitlab.com:kargnas/repo.git'), null);
  assert.equal(gitRemoteToGitHubUrl('https://bitbucket.org/kargnas/repo.git'), null);
  assert.equal(gitRemoteToGitHubUrl('not-a-url'), null);
  assert.equal(gitRemoteToGitHubUrl(''), null);
  assert.equal(gitRemoteToGitHubUrl(null), null);
  assert.equal(gitRemoteToGitHubUrl(undefined), null);
});
