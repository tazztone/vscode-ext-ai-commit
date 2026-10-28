const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { normalizeApiKey, secretKeyFor } = require('./lib/api-key');
const { endpointOrigin, modelsUrl } = require('./lib/endpoint');
const { buildCurlArgs, formatCurlHeaders } = require('./lib/curl');

let out;
let secretsApi = null;
let lastPayload = null;
let lastContext = null;
let terminalBuffer = [];
let terminalRemainder = '';
let terminalBufferHardLimit = 800;
let prProviderWarnedNoKey = false;
let prProviderRegistered = false;
const OUTPUT_CHANNEL_NAME = 'Kargnas - AI Commit';
const SETTINGS_PREFIX = 'kargnas.aiCommit';

function log(...args){ (out||=vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME)).appendLine(args.join(' ')); }
function show(){ (out||=vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME)).show(true); }
function logSection(title, body){ log(`[${title}]`); (body||'').split(/\r?\n/).forEach(line=>log(line)); }

function stripAnsi(text){
  if(!text) return '';
  return String(text)
    .replace(/\u001b\[[0-9;:?]*[ -\/]*[@-~]/g, '') // CSI sequences
    .replace(/[\u0007\u0008]/g, '');
}

function pushTerminalData(chunk){
  if(!chunk) return;
  const sanitized = stripAnsi(chunk).replace(/\r/g, '\n');
  const merged = terminalRemainder + sanitized;
  const parts = merged.split('\n');
  terminalRemainder = parts.pop() || '';
  for(const line of parts){
    terminalBuffer.push(line);
    if(terminalBuffer.length > terminalBufferHardLimit){
      terminalBuffer = terminalBuffer.slice(-terminalBufferHardLimit);
    }
  }
}

function setTerminalBufferHardLimit(limit){
  const parsed = Number(limit);
  if(Number.isFinite(parsed) && parsed > 50){
    terminalBufferHardLimit = Math.floor(parsed);
  }
  if(terminalBuffer.length > terminalBufferHardLimit){
    terminalBuffer = terminalBuffer.slice(-terminalBufferHardLimit);
  }
}

function getTerminalSnapshot(lines){
  const count = Math.max(0, Math.min(Number(lines) || 0, terminalBuffer.length));
  if(!count) return [];
  return terminalBuffer.slice(-count);
}

function clampNumber(value, fallback, min, max){
  const num = Number(value);
  if(!Number.isFinite(num)) return fallback;
  let result = Math.floor(num);
  if(typeof min === 'number' && result < min) result = min;
  if(typeof max === 'number' && result > max) result = max;
  return result;
}

function readSetting(config, suffix){
  return config.get(`${SETTINGS_PREFIX}.${suffix}`);
}

const ALLOWED_TYPES = ['feat','fix','perf','refactor','style','docs','test','build','ci','chore','revert'];

const COMMIT_SCHEMA_OBJECT = {
  type: 'object',
  additionalProperties: false,
  required: ['type','scope','subject','body','breaking_change','issues','rationale'],
  properties: {
    type: { type: 'string', enum: ALLOWED_TYPES },
    scope: { type: 'string', description: 'lowercase scope token or empty string', default: '' },
    subject: {
      type: 'string',
      minLength: 8,
      maxLength: 72,
      description: 'Imperative summary listing concrete values such as versions, configuration keys, or renamed services.'
    },
    body: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      description: 'Each entry is a terse fragment (e.g., "env config cleanup") covering one significant change.',
      items: {
        type: 'string',
        minLength: 4,
        maxLength: 120
      }
    },
    breaking_change: { type: 'string', description: 'Explanation for BREAKING CHANGE or empty string' },
    issues: { type: 'array', items: { type: 'string' }, description: 'Issue references such as "Closes #123"' },
    rationale: { type: 'string', description: 'Internal audit note (not part of commit message)' }
  }
};

const COMMIT_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'commit_message',
    description: 'Structured Conventional Commit payload for kargnas-commit-ai',
    strict: true,
    schema: COMMIT_SCHEMA_OBJECT
  }
};

const SYSTEM_PROMPT = `<role>You are a senior engineer who produces precise Conventional Commit payloads.</role>

<requirements>
- Follow the commit_message schema exactly and emit JSON only (no code fences).
- Map commit types precisely: feat for capability or DX gains, fix for bug remediation, chore for maintenance/config housekeeping, perf for measurable performance gains; docs/test/build/ci/style/refactor only when that theme dominates.
- Scope must be a single lowercase module or folder token (e.g., context, config, infra) or empty.
- Subject must be imperative, ≤72 characters, combine all primary changes into one sentence, and include literal values (old→new versions, configuration keys, renamed services, numeric limits).
- Respect any language_instruction rigidly: render the subject, body fragments, and rationale in that locale—even if prior commits or diffs use another language—while keeping the Conventional Commit type/scope tokens in English.
 - Respect any language_instruction rigidly: render the subject, body fragments, and rationale in that locale—even if prior commits or diffs use another language—while keeping the Conventional Commit type/scope tokens in English. If you cannot comply, output a schema-valid object with subject LANGUAGE_POLICY_VIOLATION and an empty body array.
- Body must be an array of terse fragments (≤12 words, no trailing punctuation); each entry cites the touched artifact/key/value and ends with an action noun such as "cleanup", "addition", "removal", or "sync".
- Enumerate every significant change from the supplied context in order of impact.
 - Never invent data or reference git metadata; rely solely on the provided context and diffs, and avoid filler such as "This commit".
 - After composing the response, double-check that every narrative string satisfies the language_instruction before returning it.
</requirements>

<output_format>Return exactly one commit_message JSON object.</output_format>`;

const PR_SYSTEM_PROMPT = `<role>You compose reviewer-friendly GitHub pull request titles and descriptions.</role>

<requirements>
- Follow the pull_request schema exactly and emit JSON only (no code fences).
- Title must be ≤ 90 characters, imperative, and highlight the most tangible change for the end users / little bit more focused on frontend. (identifiers, config keys, versions, endpoints) without emojis.
- Body must be GitHub-flavoured Markdown containing, in order, the sections: "## Summary" (concise explanation of this PR), "## Features" (bullet list; write "- not run" if no signals), and "## Risks" (bullet list; default to "- low" if nothing notable). Append a "## Linked Issues" section only when issue references are provided; list each as "- <reference>: <short insight>".
- In the "## Features" section, each bullet must answer both what changed and why it was done (e.g., "- raise cache TTL to 5m — avoids stale match stats"). When intent is unclear, acknowledge the gap explicitly. Focus on the features that impact to the end users.
- Call out implementation rationale, design intent, and notable trade-offs where relevant; prefer concrete reasoning over generic phrasing.
- Surface breaking or high-risk changes explicitly in Summary and Risks.
- Use only supplied commits, diffs, and issue context—never speculate about unstated work.
- When diffs show user-visible copy or API changes, quote the new literal values directly.
</requirements>

<output_format>Return exactly one pull_request JSON object.</output_format>`;

const PR_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'pull_request',
    description: 'Structured pull request title and body for kargnas-commit-ai',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'body'],
      properties: {
        title: { type: 'string', minLength: 8, maxLength: 120 },
        body: { type: 'string', minLength: 20, maxLength: 6000 }
      }
    }
  }
};

function normalizeEndpoint(url, allowRewrite){
  try {
    const u = new URL(url);
    if (allowRewrite && u.pathname === '/api/v1/responses') {
      u.pathname = '/api/alpha/responses';
      log(`Endpoint normalized: ${url} -> ${u.toString()}`);
      return u.toString();
    }
    return url;
  } catch { return url; }
}
function normalizeModel(model){
  if (model === 'google/gemini-flash-lite-latest') return 'google/gemini-2.5-flash-lite';
  return model;
}

async function getConfig(){
  const c = vscode.workspace.getConfiguration();
  const commitLanguageRaw = readSetting(c, 'commitLanguage');
  const commitLanguage = commitLanguageRaw === undefined ? '' : String(commitLanguageRaw || '').trim();
  const endpointRaw = readSetting(c, 'endpoint') || 'https://openrouter.ai/api/v1/chat/completions';
  const endpoint = normalizeEndpoint(endpointRaw, !!readSetting(c, 'endpointRewrite'));
  const compat = c.get('dish-ai-commit.features.branchName.systemPrompt', '');
  const apiKey = await readStoredApiKey(endpointRaw);
  return {
    apiKey,
    model: normalizeModel(readSetting(c, 'model') || 'google/gemini-2.5-flash-lite'),
    endpointRaw,
    endpoint,
    transport: readSetting(c, 'transport') || 'fetch',
    timeoutMs: readSetting(c, 'requestTimeoutMs') || 25000,
    logRaw: !!readSetting(c, 'logRawResponse'),
    include: readSetting(c, 'contextIncludeGlobs') || ['**/*'],
    ignore: readSetting(c, 'contextIgnoreGlobs') || ['**/*.lock','dist/**','build/**','out/**','**/*.svg','**/*.png','**/*.jpg'],
    maxFilePatchBytes: readSetting(c, 'maxFilePatchBytes') || 12000,
    maxPatchBytes: readSetting(c, 'maxPatchBytes') || 50000,
    referer: readSetting(c, 'referer') || 'https://kargn.as',
    title: readSetting(c, 'title') || 'kargnas',
    systemPrompt: (compat ? compat + '\n\n' : '') + (readSetting(c, 'systemPrompt') || SYSTEM_PROMPT),
    previousCommitLimit: clampNumber(readSetting(c, 'previousCommitLimit'), 10, 1, 25),
    openTabsLimit: clampNumber(readSetting(c, 'openTabsLimit'), 10, 0, 40),
    terminalLogLines: clampNumber(readSetting(c, 'terminalLogLines'), 20, 0, 200),
    projectTreeMaxEntries: clampNumber(readSetting(c, 'projectTreeMaxEntries'), 400, 50, 1200),
    heavyDiffMaxLines: clampNumber(readSetting(c, 'heavyDiffMaxLines'), 500, 50, 1000),
    heavyDiffMaxFiles: clampNumber(readSetting(c, 'heavyDiffMaxFiles'), 3, 0, 6),
    logPromptMaxChars: clampNumber(readSetting(c, 'logPromptMaxChars'), 0, 0, 1000000),
    commitLanguage
  };
}

function currentEndpoint(){
  return readSetting(vscode.workspace.getConfiguration(), 'endpoint') || 'https://openrouter.ai/api/v1/chat/completions';
}

async function readStoredApiKey(endpoint){
  let secret = '';
  try {
    secret = normalizeApiKey(await secretsApi?.get(secretKeyFor(endpoint)));
  } catch(e){
    log(`[secrets] could not read the API key for ${endpointOrigin(endpoint)}: ${e?.message || e}`);
  }
  if(secret) return secret;

  const legacy = normalizeApiKey(readSetting(vscode.workspace.getConfiguration(), 'apiKey'));
  if(legacy){
    log('[secrets] using the deprecated settings.json API key; run "Commit AI: Set API Key" to move it to SecretStorage');
  }
  return legacy;
}

async function migrateLegacyApiKey(context){
  const legacy = normalizeApiKey(readSetting(vscode.workspace.getConfiguration(), 'apiKey'));
  if(!legacy) return;

  const endpoint = currentEndpoint();
  const origin = endpointOrigin(endpoint);
  const id = secretKeyFor(endpoint);
  let stored = '';
  try {
    stored = normalizeApiKey(await context.secrets.get(id));
  } catch(e){
    log(`[secrets] could not read SecretStorage; keeping the settings.json API key: ${e?.message || e}`);
    return;
  }

  let migrated = false;
  if(!stored){
    try {
      await context.secrets.store(id, legacy);
      stored = normalizeApiKey(await context.secrets.get(id));
    } catch(e){
      log(`[secrets] could not store the API key; keeping the settings.json copy: ${e?.message || e}`);
      return;
    }
    if(!stored){
      log('[secrets] SecretStorage did not persist the API key; keeping the settings.json copy');
      return;
    }
    migrated = true;
    log(`[secrets] moved the settings.json API key to SecretStorage for ${origin}`);
  } else if(stored !== legacy){
    log(`[secrets] a different key is already stored for ${origin}; the settings.json copy is ignored`);
  }

  const removed = await removeLegacyApiKeySetting(legacy);
  if(migrated && !hasLegacyApiKeySetting()){
    vscode.window.showInformationMessage('API key moved to SecretStorage. Settings Sync does not sync secrets — set the key again on your other machines.');
  } else if(migrated && hasLegacyApiKeySetting()){
    vscode.window.showWarningMessage('API key stored in SecretStorage, but the plaintext copy in settings.json could not be removed.');
  } else if(!migrated && removed){
    log('[secrets] removed a stale plaintext API key; the stored secret is unchanged');
  }
}

function hasLegacyApiKeySetting(){
  try {
    const inspected = vscode.workspace.getConfiguration().inspect(`${SETTINGS_PREFIX}.apiKey`) || {};
    return ['globalValue','workspaceValue','workspaceFolderValue']
      .some(property => normalizeApiKey(inspected[property]));
  } catch {
    return false;
  }
}

async function removeLegacyApiKeySetting(expected){
  const config = vscode.workspace.getConfiguration();
  const section = `${SETTINGS_PREFIX}.apiKey`;
  const levels = [
    ['globalValue', vscode.ConfigurationTarget.Global, 'user'],
    ['workspaceValue', vscode.ConfigurationTarget.Workspace, 'workspace'],
    ['workspaceFolderValue', vscode.ConfigurationTarget.WorkspaceFolder, 'workspace folder']
  ];

  let removed = false;
  for(const [property, target, label] of levels){
    let value;
    try {
      value = normalizeApiKey((config.inspect(section) || {})[property]);
    } catch {
      continue;
    }
    if(!value) continue;
    if(expected && value !== expected){
      log(`[secrets] leaving the ${label} API key in place because it changed during migration`);
      continue;
    }
    try {
      await config.update(section, undefined, target);
      removed = true;
      log(`[secrets] removed the plaintext API key from ${label} settings`);
    } catch(e){
      log(`[secrets] could not remove the ${label} API key: ${e?.message || e}`);
    }
  }

  try {
    const inspected = config.inspect(section) || {};
    const languageScoped = ['globalLanguageValue','workspaceLanguageValue','workspaceFolderLanguageValue']
      .some(property => normalizeApiKey(inspected[property]));
    if(languageScoped) log('[secrets] a language-scoped apiKey override is still set; remove it manually');
  } catch {}

  return removed;
}

async function setApiKey(context){
  const endpoint = currentEndpoint();
  const origin = endpointOrigin(endpoint);
  const value = await vscode.window.showInputBox({
    title: 'Commit AI: Set API Key',
    prompt: `Stored in SecretStorage for ${origin} — not in settings.json.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: input => normalizeApiKey(input) ? undefined : 'API key cannot be empty.'
  });
  if(value === undefined) return;

  const key = normalizeApiKey(value);
  try {
    await context.secrets.store(secretKeyFor(endpoint), key);
  } catch(e){
    vscode.window.showErrorMessage(`Could not store the API key: ${e?.message || e}`);
    return;
  }

  await removeLegacyApiKeySetting('');
  vscode.window.showInformationMessage(`API key saved for ${origin}.`);
}

async function clearApiKey(context){
  const endpoint = currentEndpoint();
  const origin = endpointOrigin(endpoint);
  const choice = await vscode.window.showWarningMessage(
    `Remove the API key stored for ${origin}?`,
    { modal: true },
    'Remove'
  );
  if(choice !== 'Remove') return;

  try {
    await context.secrets.delete(secretKeyFor(endpoint));
  } catch(e){
    vscode.window.showErrorMessage(`Could not remove the API key: ${e?.message || e}`);
    return;
  }
  await removeLegacyApiKeySetting('');
  vscode.window.showInformationMessage(`API key removed for ${origin}.`);
}

async function getGitAPI(){
  const ext = vscode.extensions.getExtension('vscode.git');
  if(!ext) throw new Error('Git extension not found');
  if(!ext.isActive) await ext.activate();
  return ext.exports.getAPI(1);
}

function looksLikeRepository(candidate){
  return !!candidate && typeof candidate === 'object' && candidate.rootUri instanceof vscode.Uri && candidate.state;
}

function resolveRepositoryFromArg(api, arg){
  if(!arg) return null;
  if(Array.isArray(arg)){
    for(const item of arg){
      const repo = resolveRepositoryFromArg(api, item);
      if(repo) return repo;
    }
    return null;
  }
  if(looksLikeRepository(arg)) return arg;
  const direct = arg.repository || arg.repo || arg.sourceControl || arg.scm;
  if(direct){
    const repo = resolveRepositoryFromArg(api, direct);
    if(repo) return repo;
  }
  if(arg.resourceGroup){
    const repo = resolveRepositoryFromArg(api, arg.resourceGroup);
    if(repo) return repo;
  }
  if(arg.resourceStates){
    const repo = resolveRepositoryFromArg(api, arg.resourceStates);
    if(repo) return repo;
  }
  if(arg.resourceGroups){
    const repo = resolveRepositoryFromArg(api, arg.resourceGroups);
    if(repo) return repo;
  }
  const uri = arg.resourceUri || arg.originalUri || arg.uri;
  if(uri instanceof vscode.Uri){
    const repo = api.getRepository(uri);
    if(repo) return repo;
  }
  return null;
}

async function resolveRepository(api, commandArgs){
  const repoFromArgs = resolveRepositoryFromArg(api, commandArgs);
  if(repoFromArgs) return repoFromArgs;

  const selected = api.repositories.find(r=> r.ui && r.ui.selected);
  if(selected) return selected;

  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  if(activeUri){
    const repo = api.getRepository(activeUri);
    if(repo) return repo;
  }

  if(api.repositories.length === 1) return api.repositories[0];
  if(api.repositories.length === 0) return null;

  const picks = api.repositories.map(repo=>{
    const fsPath = repo.rootUri?.fsPath || '';
    const label = fsPath ? path.basename(fsPath) || fsPath : '(unknown)';
    return { label, description: fsPath, repo };
  });

  const choice = await vscode.window.showQuickPick(picks, {
    title: 'Commit AI: Select Git repository',
    placeHolder: 'Choose the Git repository to use'
  });
  return choice?.repo || null;
}

function execFile(bin, args, cwd){
  return new Promise((resolve, reject)=>{
    cp.execFile(bin, args, { cwd, maxBuffer: 32*1024*1024 }, (err, stdout, stderr)=>{
      if(err) return reject(new Error(stderr || err?.message || String(err)));
      resolve({ stdout, stderr });
    });
  });
}

async function ensureStagedOrOfferStageAll(repo){
  const count = repo.state.indexChanges?.length || 0;
  if(count>0) return true;
  const pick = await vscode.window.showWarningMessage('No staged changes. Stage all and continue?', 'Stage all', 'Cancel');
  if(pick !== 'Stage all') return false;
  await vscode.commands.executeCommand('git.stageAll');
  await new Promise(r=>setTimeout(r, 200));
  try { await repo.status(); } catch {}
  return (repo.state.indexChanges?.length || 0) > 0;
}

async function runGit(cwd, args, allowEmpty = true){
  try {
    const { stdout } = await execFile('git', args, cwd);
    return stdout.trimEnd();
  } catch (err){
    if(!allowEmpty) throw err;
    log(`[warn] git ${args.join(' ')} failed: ${err.message}`);
    return '';
  }
}

function parseLanguages(files){
  const map = new Map();
  const extToLang = {
    '.ts':'ts','.tsx':'ts','.js':'js','.jsx':'js','.mjs':'js','.cjs':'js','.php':'php','.py':'py','.rb':'rb','.java':'java','.cs':'cs','.go':'go','.rs':'rs','.swift':'swift','.kt':'kt','.m':'objc','.mm':'objc','.sql':'sql','.sh':'sh','.yml':'yml','.yaml':'yml','.json':'json','.md':'md','.css':'css','.scss':'scss','.less':'less','.html':'html'
  };
  files.forEach(rel=>{
    const ext = path.extname(rel).toLowerCase();
    const lang = extToLang[ext];
    if(lang) map.set(lang, true);
  });
  return Array.from(map.keys()).sort();
}

function buildServiceMap(files){
  const map = {};
  files.forEach(rel=>{
    const parts = rel.split('/');
    if(parts.length > 1){
      const key = parts[0];
      if(!map[key]) map[key] = key;
    }
  });
  return map;
}

function parseBranchHints(branch){
  const hints = [];
  const lowered = branch.toLowerCase();
  ALLOWED_TYPES.forEach(type=>{ if(lowered.includes(type)) hints.push(type); });
  const ticketMatches = branch.match(/\d+/g);
  if(ticketMatches) hints.push(...ticketMatches);
  const issueMatches = branch.match(/[A-Z]+-\d+/g);
  if(issueMatches) hints.push(...issueMatches);
  return Array.from(new Set(hints));
}

function detectIntent(diffText){
  const lower = diffText.toLowerCase();
  if(/n\+1|bug|fix|issue|error|exception/.test(lower)) return 'bugfix';
  if(/perf|cache|latency|optimi[sz]e|memo/.test(lower)) return 'perf';
  if(/refactor|cleanup|rename/.test(lower)) return 'refactor';
  if(/style|format|whitespace/.test(lower)) return 'style';
  return 'unknown';
}

function extractSymbols(diffText){
  const symbols = new Set();
  diffText.split('\n').forEach(line=>{
    if(line.startsWith('+') || line.startsWith('-')){
      const stripped = line.slice(1);
      const fnMatch = stripped.match(/function\s+([\w$]+)/);
      if(fnMatch) symbols.add(fnMatch[1]);
      const clsMatch = stripped.match(/class\s+([\w$]+)/);
      if(clsMatch) symbols.add(clsMatch[1]);
      const methodMatch = stripped.match(/([\w$]+)\s*\([^)]*\)\s*\{/);
      if(methodMatch && methodMatch[1].length <= 40) symbols.add(methodMatch[1]);
    }
  });
  return Array.from(symbols).slice(0, 10);
}

function cleanJsonFence(text){
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fence) return fence[1].trim();
  return text.trim();
}

function parseJSONSafely(text){
  try { return JSON.parse(text); } catch {}
  const cleaned = cleanJsonFence(text);
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if(first !== -1 && last !== -1){
    try { return JSON.parse(cleaned.slice(first, last+1)); } catch {}
  }
  return null;
}

function normaliseLanguagePreference(pref){
  if(pref === null || pref === undefined) return 'auto';
  const value = String(pref).trim();
  return value ? value : 'auto';
}

function buildLanguageInstruction(pref){
  const value = normaliseLanguagePreference(pref);
  if(value.toLowerCase() === 'auto') return '';
  return `<language_instruction>All narrative fields (subject, body fragments, rationale) must be written in ${value}. Ignore the language used in prior commits or diffs. If producing valid ${value} narrative text is impossible, emit LANGUAGE_POLICY_VIOLATION in the subject and use an empty body array. Keep the Conventional Commit type/scope tokens in English.</language_instruction>`;
}

function buildPullRequestLanguageInstruction(pref){
  const value = normaliseLanguagePreference(pref);
  if(value.toLowerCase() === 'auto') return '';
  return `<language_instruction>Render the pull request title, section headings, and bullet text in ${value}. If you cannot comply fully, return title LANGUAGE_POLICY_VIOLATION and an empty body.</language_instruction>`;
}

async function buildProjectTree(repo, cwd, cfg, stagedStatusMap){
  const trackedRes = await execFile('git', ['ls-files'], cwd).catch(()=>({ stdout:'' }));
  const untrackedRes = await execFile('git', ['ls-files','--others','--exclude-standard'], cwd).catch(()=>({ stdout:'' }));
  const normalize = (p)=>{
    // Remove git's quoting for special characters
    let cleaned = p.trim();
    if(cleaned.startsWith('"') && cleaned.endsWith('"')){
      cleaned = cleaned.slice(1, -1);
      // Unescape git's escape sequences (handles octal like \345)
      cleaned = cleaned.replace(/\\([0-7]{3})/g, (_, oct) => {
        return String.fromCharCode(parseInt(oct, 8));
      });
      cleaned = cleaned.replace(/\\([\\"])/g, '$1');
    }
    // Normalize path separators and filter invalid paths
    cleaned = cleaned.split('\\').join('/');
    // Reject paths with suspicious patterns
    if(cleaned.includes('//') || cleaned.includes('/../') || cleaned.startsWith('..')) return null;
    return cleaned;
  };
  const tracked = trackedRes.stdout.split('\n').map(normalize).filter(Boolean);
  const untracked = untrackedRes.stdout.split('\n').map(normalize).filter(Boolean);
  const statusMap = new Map();
  const ensure = (rel)=>{
    if(!statusMap.has(rel)) statusMap.set(rel, { staged:false, unstaged:false, merge:false, untracked:false, codes:new Set() });
    return statusMap.get(rel);
  };

  const addChanges = (changes, key)=>{
    (changes||[]).forEach(change=>{
      const uri = change.originalUri?.fsPath || change.resourceUri?.fsPath || change.uri?.fsPath;
      if(!uri) return;
      const rel = path.relative(cwd, uri);
      if(!rel || rel.startsWith('..')) return;
      const norm = normalize(rel);
      ensure(norm)[key] = true;
      const statusCode = stagedStatusMap?.get(norm);
      if(statusCode){ ensure(norm).codes.add(statusCode); }
    });
  };

  addChanges(repo.state.indexChanges, 'staged');
  addChanges(repo.state.workingTreeChanges, 'unstaged');
  addChanges(repo.state.mergeChanges, 'merge');
  untracked.forEach(rel=>{
    if(!rel) return;
    ensure(rel).untracked = true;
    ensure(rel).codes.add('A');
  });

  const explicitStatusMap = stagedStatusMap || new Map();
  explicitStatusMap.forEach((code, rel)=>{
    ensure(rel).codes.add(code);
  });

  const allFiles = Array.from(new Set([...tracked, ...untracked, ...statusMap.keys()])).sort();
  const withSignals = allFiles.filter(rel=>{
    const info = statusMap.get(rel);
    if(!info) return false;
    return info.merge || info.staged || info.unstaged || info.untracked || (info.codes && info.codes.size);
  });
  const candidateFiles = withSignals.length ? withSignals : allFiles;
  const maxEntries = cfg?.projectTreeMaxEntries || 400;
  const limitedFiles = candidateFiles.slice(0, maxEntries);

  const root = createTreeNode('.', '', true);
  const seenPaths = new Set();
  const maxDepth = 20; // Prevent too deep trees

  limitedFiles.forEach(rel=>{
    // Prevent duplicates and circular references
    if(seenPaths.has(rel)) return;
    seenPaths.add(rel);

    const info = statusMap.get(rel);
    const parts = rel.split('/').filter(Boolean); // Remove empty parts
    if(!parts.length || parts.length > maxDepth) return;

    // Skip paths with suspicious patterns
    if(parts.some(part => !part || !part.trim() || part === '.' || part === '..' || part.startsWith(' ') || part.endsWith(' ') || part.length > 255)) return;

    let node = root;
    let depth = 0;
    parts.forEach((part, idx)=>{
      if(depth++ >= maxDepth) return; // Safety check
      const isLeaf = idx === parts.length - 1;
      const key = part;
      if(!node.children.has(key)){
        node.children.set(key, createTreeNode(part, node.fullPath ? `${node.fullPath}/${part}` : part, !isLeaf));
      }
      node = node.children.get(key);
      if(isLeaf){
        node.isDir = false;
        node.info = info ? cloneStatusInfo(info) : createStatusInfo();
      }
    });
  });

  propagateNodeFlags(root);
  const lines = [];
  const rootLabels = flagsToLabels(root.flags);
  const rootLine = rootLabels.length ? `./ ${rootLabels.map(label=>`[${label}]`).join(' ')}` : './';
  lines.push(rootLine.trim());
  renderTree(root, '', lines, maxEntries);
  return lines.slice(0, maxEntries);
}

function createStatusInfo(init){
  const base = { merge:false, staged:false, unstaged:false, untracked:false, codes:new Set() };
  if(init){
    base.merge = !!init.merge;
    base.staged = !!init.staged;
    base.unstaged = !!init.unstaged;
    base.untracked = !!init.untracked;
    if(init.codes){ Array.from(init.codes).forEach(code=>base.codes.add(code)); }
  }
  return base;
}

function cloneStatusInfo(info){
  return createStatusInfo(info);
}

function createTreeNode(name, fullPath, isDir){
  return {
    name,
    fullPath,
    isDir,
    children: new Map(),
    info: null,
    flags: createStatusInfo(),
    codes: new Set()
  };
}

function mergeFlags(target, source){
  if(!source) return target;
  target.merge = target.merge || !!source.merge;
  target.staged = target.staged || !!source.staged;
  target.unstaged = target.unstaged || !!source.unstaged;
  target.untracked = target.untracked || !!source.untracked;
  if(source.codes){
    Array.from(source.codes).forEach(code=> target.codes.add(code));
  }
  return target;
}

function propagateNodeFlags(node){
  if(node.info){
    mergeFlags(node.flags, node.info);
  }
  for(const child of node.children.values()){
    propagateNodeFlags(child);
    mergeFlags(node.flags, child.flags);
  }
}

function renderTree(node, prefix, lines, maxEntries, visited = new Set(), depth = 0){
  const maxDepth = 25; // Hard limit for rendering depth

  // Prevent circular reference in tree rendering
  if(visited.has(node.fullPath)) {
    lines.push(prefix + '(circular reference detected)');
    return;
  }

  // Prevent too deep trees
  if(depth >= maxDepth) {
    lines.push(prefix + '(max depth reached)');
    return;
  }

  visited.add(node.fullPath);

  const entries = Array.from(node.children.values()).sort(compareTreeNodes);
  const count = entries.length;
  entries.forEach((child, index)=>{
    if(lines.length >= maxEntries) return;
    const isLast = index === count - 1;
    const connector = isLast ? '└─ ' : '├─ ';
    const childPrefix = prefix + (isLast ? '   ' : '│  ');
    lines.push(prefix + connector + formatTreeNode(child));
    if(lines.length >= maxEntries) return;
    if(child.isDir && child.children.size){
      renderTree(child, childPrefix, lines, maxEntries, visited, depth + 1);
    }
  });
}

function compareTreeNodes(a, b){
  if(a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function formatTreeNode(node){
  const name = node.isDir ? `${node.name}/` : node.name;
  const labels = flagsToLabels(node.flags);
  if(!labels.length) return name;
  return `${name} ${labels.map(label=>`[${label}]`).join(' ')}`.trim();
}

function flagsToLabels(flags){
  const seen = new Set();
  if(flags?.merge) seen.add('Conflict');
  if(flags?.untracked) seen.add('New');
  if(flags?.unstaged) seen.add('Modified');
  if(flags?.staged) seen.add('Staged');
  if(flags?.codes){
    Array.from(flags.codes).forEach(code=>{
      const label = codeToLabel(code);
      if(label) seen.add(label);
    });
  }
  return Array.from(seen.values());
}

function codeToLabel(code){
  if(!code) return '';
  const c = String(code).charAt(0).toUpperCase();
  switch(c){
    case 'A': return 'New';
    case 'M': return 'Modified';
    case 'D': return 'Deleted';
    case 'R': return 'Renamed';
    case 'C': return 'Copied';
    case 'U': return 'Unmerged';
    default: return '';
  }
}

function parseNameStatusToMap(lines){
  const map = new Map();
  (lines||[]).forEach(line=>{
    if(!line) return;
    const parts = line.split('\t');
    if(parts.length < 2) return;
    const statusRaw = parts[0] || '';
    const statusCode = statusRaw.replace(/[0-9]/g, '') || statusRaw;
    let lastPath = parts[parts.length - 1];
    if(lastPath){
      // Remove git's quoting for special characters
      if(lastPath.startsWith('"') && lastPath.endsWith('"')){
        lastPath = lastPath.slice(1, -1);
        // Unescape git's octal sequences
        lastPath = lastPath.replace(/\\([0-7]{3})/g, (_, oct) => {
          return String.fromCharCode(parseInt(oct, 8));
        });
        lastPath = lastPath.replace(/\\([\\"])/g, '$1');
      }
      const normalized = lastPath.split('\\').join('/');
      // Skip invalid paths
      if(normalized.includes('//') || normalized.includes('/../') || normalized.startsWith('..')) return;
      map.set(normalized, statusCode.charAt(0).toUpperCase());
    }
  });
  return map;
}

function parseDiffByFile(diff){
  const result = {};
  if(!diff) return result;
  const lines = diff.split('\n');
  let currentFile = null;
  let buffer = [];
  const flush = ()=>{
    if(currentFile && buffer.length){
      result[currentFile] = buffer.join('\n');
    }
  };
  for(const line of lines){
    if(line.startsWith('diff --git ')){
      flush();
      buffer = [line];
      const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
      currentFile = match ? match[2] : null;
    } else if(buffer){
      buffer.push(line);
    }
  }
  flush();
  return result;
}

function parseHunks(diff){
  const entries = [];
  if(!diff) return entries;
  const lines = diff.split('\n');
  let current = null;
  for(const line of lines){
    if(line.startsWith('diff --git ')){
      if(current) entries.push(current);
      const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
      current = { file: match ? match[2] : '', hunks: [] };
    } else if(current && line.startsWith('@@ ')){
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if(match){
        const start = Number(match[1]);
        const count = match[2] ? Number(match[2]) : 1;
        current.hunks.push({ header: line, start, count });
      }
    }
  }
  if(current) entries.push(current);
  return entries;
}

function summariseFile(pathname, diffText){
  const change_kind = pathname.includes(' -> ') ? 'renamed' : 'modified';
  const symbols_changed = extractSymbols(diffText);
  const intent_guess = detectIntent(diffText);
  let high_level = 'auto-summary unavailable';
  if(intent_guess === 'bugfix') high_level = 'potential bug fix indicators detected';
  else if(intent_guess === 'perf') high_level = 'performance-oriented change';
  else if(intent_guess === 'refactor') high_level = 'structural refactor indications';
  else if(intent_guess === 'style') high_level = 'formatting adjustments';
  const risk = intent_guess === 'bugfix' ? 'medium' : 'unknown';
  return { path: pathname, change_kind, symbols_changed, high_level, intent_guess, risk };
}

function displayPathFromUri(uriString){
  if(!uriString) return '';
  try {
    const parsed = vscode.Uri.parse(uriString);
    const rel = vscode.workspace.asRelativePath(parsed, false);
    return rel || parsed.fsPath || parsed.path || uriString;
  } catch {
    return String(uriString);
  }
}

function inferPathFromPatch(patchText){
  if(!patchText) return '';
  const diffLine = patchText.match(/^diff --git a\/([^\s]+) b\/([^\s]+)/m);
  if(diffLine) return diffLine[2].trim();
  const plusLine = patchText.match(/^\+\+\+\s+b\/(.*)$/m);
  if(plusLine) return plusLine[1].trim();
  return '';
}

function normalizePullRequestPatches(patches, limit){
  const enforceLimit = Number.isFinite(limit) && limit > 0;
  let remaining = enforceLimit ? Number(limit) : 0;
  let truncated = false;
  const seenSummaries = new Set();
  const summaries = [];
  const sections = [];

  const iterable = Array.isArray(patches) ? patches : [];
  for(const entry of iterable){
    if(!entry) continue;
    let patchText = '';
    let displayPath = '';
    if(typeof entry === 'string'){
      patchText = entry;
    } else if(typeof entry === 'object'){
      patchText = String(entry.patch || '');
      displayPath = displayPathFromUri(entry.fileUri) || displayPathFromUri(entry.previousFileUri) || '';
    }
    if(!patchText) continue;
    const trimmed = patchText.trim();
    if(!trimmed) continue;
    if(!displayPath) displayPath = inferPathFromPatch(trimmed);
    if(displayPath && !seenSummaries.has(displayPath)){
      seenSummaries.add(displayPath);
      try {
        summaries.push(summariseFile(displayPath, trimmed));
      } catch {
        // ignore summarise failures
      }
    }
    let chunk = trimmed;
    if(enforceLimit){
      if(remaining <= 0){
        truncated = true;
        break;
      }
      if(chunk.length > remaining){
        chunk = chunk.slice(0, remaining);
        truncated = true;
      }
      remaining -= chunk.length;
    }
    const block = displayPath ? `# ${displayPath}\n${chunk}` : chunk;
    sections.push(block.trim());
    if(enforceLimit && remaining <= 0){
      truncated = true;
      break;
    }
  }

  return {
    diffText: sections.join('\n\n'),
    fileSummaries: summaries.slice(0, 25),
    truncated
  };
}

function normaliseIssueContext(issues){
  if(!Array.isArray(issues)) return [];
  return issues
    .map(issue => ({
      reference: String(issue?.reference || '').trim(),
      summary: String(issue?.content || '').trim().slice(0, 300)
    }))
    .filter(item => item.reference);
}

function normaliseCommitMessages(messages){
  if(!Array.isArray(messages)) return [];
  return messages.map(msg => String(msg || '').trim()).filter(Boolean).slice(0, 20);
}

function preparePullRequestPromptData(prContext, cfg){
  const commits = normaliseCommitMessages(prContext?.commitMessages);
  const issues = normaliseIssueContext(prContext?.issues).slice(0, 10);
  const patchInfo = normalizePullRequestPatches(prContext?.patches, cfg?.maxPatchBytes || 50000);
  return { commits, issues, patchInfo };
}

function buildPullRequestUserPrompt(prData){
  const commitsSection = prData.commits.length
    ? prData.commits.map((msg, idx) => `${idx + 1}. ${msg}`).join('\n')
    : 'none';
  const issuesSection = prData.issues.length
    ? prData.issues.map(issue => `- ${issue.reference}: ${issue.summary || 'no additional context'}`).join('\n')
    : 'none';
  const fileSummariesJson = prData.patchInfo.fileSummaries.length
    ? JSON.stringify(prData.patchInfo.fileSummaries, null, 2)
    : '[]';
  const diffSection = prData.patchInfo.diffText || '(no diff provided)';
  const truncatedNote = prData.patchInfo.truncated ? '\n[diff truncated due to size limit]' : '';

  return `<pull_request_context>
<commit_messages>
${commitsSection}
</commit_messages>
<issues>
${issuesSection}
</issues>
<file_summaries_json>
${fileSummariesJson}
</file_summaries_json>
<diff_snippets>
${diffSection}${truncatedNote}
</diff_snippets>
</pull_request_context>

<task>
Craft a pull request title and body that satisfy all system requirements.
Address missing information explicitly instead of inventing it, and keep the body concise but complete.
</task>`;
}

function collectOpenTabs(cwd, limit){
  const max = Math.max(0, Number(limit) || 0);
  if(max === 0) return [];
  const entries = new Map();
  const order = [];
  const toRel = (uri)=>{
    if(!uri?.fsPath) return null;
    const rel = path.relative(cwd, uri.fsPath);
    if(!rel || rel.startsWith('..')) return null;
    return rel || '.';
  };

  const record = (label, meta)=>{
    if(!label) return;
    if(!entries.has(label)){
      entries.set(label, new Set());
      order.push(label);
    }
    const set = entries.get(label);
    (meta||[]).filter(Boolean).forEach(tag=> set.add(tag));
  };

  const describeTab = (tab)=>{
    if(!tab) return null;
    const input = tab.input;
    const candidate = input?.uri || input?.modified || input?.original || input?.notebookUri || null;
    const label = toRel(candidate) || tab.label;
    if(!label) return null;
    const meta = [];
    if(tab.isActive) meta.push('Active');
    if(tab.isDirty) meta.push('Dirty');
    if(tab.isPinned) meta.push('Pinned');
    if(tab.isPreview) meta.push('Preview');
    return { label, meta };
  };

  const groups = vscode.window.tabGroups?.all || [];
  const activeGroup = vscode.window.tabGroups?.activeTabGroup;
  if(activeGroup){
    activeGroup.tabs.forEach(tab=>{
      const info = describeTab(tab);
      if(info) record(info.label, info.meta);
    });
  }
  groups.forEach(group=>{
    if(group === activeGroup) return;
    group.tabs.forEach(tab=>{
      const info = describeTab(tab);
      if(info) record(info.label, info.meta);
    });
  });

  (vscode.window.visibleTextEditors||[]).forEach(editor=>{
    const label = toRel(editor.document?.uri) || editor.document?.fileName || editor.document?.uri?.toString();
    if(!label) return;
    const meta = [];
    if(editor.document?.isDirty) meta.push('Dirty');
    if(editor === vscode.window.activeTextEditor && !meta.includes('Active')) meta.push('Active');
    record(label, meta);
  });

  const list = order.map(label=>{
    const meta = Array.from(entries.get(label).values());
    return meta.length ? `${label} [${meta.join(', ')}]` : label;
  });

  return list.slice(0, max);
}

async function collectHeavyDiffSnapshots(cwd, hunks, cfg){
  const maxFiles = Math.max(0, Number(cfg?.heavyDiffMaxFiles) || 0);
  if(maxFiles === 0) return [];
  const maxLines = Math.max(10, Number(cfg?.heavyDiffMaxLines) || 500);
  const snapshots = [];
  const seen = new Set();
  for(const entry of hunks){
    const filePath = entry?.file;
    if(!filePath || seen.has(filePath)) continue;
    if(!Array.isArray(entry.hunks) || entry.hunks.length < 3) continue;
    const content = await readStagedFile(cwd, filePath);
    if(!content) continue;
    const truncated = content.split(/\r?\n/).slice(0, maxLines).join('\n');
    snapshots.push({ path: filePath, content: truncated });
    seen.add(filePath);
    if(snapshots.length >= maxFiles) break;
  }
  return snapshots;
}

async function readStagedFile(cwd, relPath){
  if(!relPath) return '';
  try {
    const { stdout } = await execFile('git', ['show', `:${relPath}`], cwd);
    if(stdout && !stdout.includes('\u0000')) return stdout;
  } catch {
    // fall through
  }
  try {
    const abs = path.join(cwd, relPath);
    if(fs.existsSync(abs)){
      const data = fs.readFileSync(abs, 'utf8');
      if(data && !data.includes('\u0000')) return data;
    }
  } catch {
    // ignore
  }
  return '';
}

async function collectHistoryForFiles(cwd, files, limit){
  const maxTotal = Math.max(1, Number(limit) || 1);
  const perFile = Math.min(maxTotal, 25);
  const results = [];
  const seen = new Set();
  for(const file of files){
    if(!file) continue;
    try {
      const { stdout } = await execFile('git', ['log','--pretty=%s','-n', String(perFile),'--', file], cwd);
      stdout.split('\n').map(x=>x.trim()).filter(Boolean).forEach(line=>{
        if(seen.has(line) || !line) return;
        seen.add(line);
        results.push(line);
      });
      if(results.length >= maxTotal) break;
    } catch {
      // ignore
    }
  }
  return results.slice(0, maxTotal);
}

function detectTestChanges(nameStatusLines){
  return nameStatusLines.map(line=>{
    const parts = line.split('\t');
    if(parts.length < 2) return null;
    const status = parts[0];
    const target = parts[parts.length-1];
    if(/test|spec/i.test(target)){
      return { path: target, change: `status=${status}` };
    }
    return null;
  }).filter(Boolean);
}

async function collectContext(repo, cfg){
  const cwd = repo.rootUri.fsPath;
  const commitLanguage = normaliseLanguagePreference(cfg?.commitLanguage);
  const [diffNameStatus, diffUnifiedRaw, diffUnifiedZeroRaw, branch, remoteUrl, defaultBranchRef] = await Promise.all([
    runGit(cwd, ['diff','--name-status','--cached','--find-renames','--relative'], true),
    runGit(cwd, ['diff','--staged','--find-renames','--unified=3'], true),
    runGit(cwd, ['diff','--staged','--find-renames','--unified=0'], true),
    runGit(cwd, ['rev-parse','--abbrev-ref','HEAD'], true),
    runGit(cwd, ['remote','get-url','origin'], true),
    runGit(cwd, ['symbolic-ref','refs/remotes/origin/HEAD'], true)
  ]);

  const diffUnified = diffUnifiedRaw.length > cfg.maxPatchBytes ? diffUnifiedRaw.slice(0, cfg.maxPatchBytes) : diffUnifiedRaw;
  const diffUnifiedZero = diffUnifiedZeroRaw.length > cfg.maxPatchBytes ? diffUnifiedZeroRaw.slice(0, cfg.maxPatchBytes) : diffUnifiedZeroRaw;

  const currentBranch = branch || 'HEAD';
  const defaultBranch = defaultBranchRef ? defaultBranchRef.split('/').pop() : 'main';
  const repoName = remoteUrl ? path.basename(remoteUrl.replace(/\.git$/,'')) : path.basename(cwd);
  const lsFiles = await runGit(cwd, ['ls-files'], true);
  const trackedFiles = lsFiles ? lsFiles.split('\n').filter(Boolean) : [];
  const languages = parseLanguages(trackedFiles);
  const serviceMap = buildServiceMap(trackedFiles);
  const branchHints = parseBranchHints(currentBranch);

  const nameStatusLines = diffNameStatus ? diffNameStatus.split('\n').filter(Boolean) : [];
  const stagedStatusMap = parseNameStatusToMap(nameStatusLines);
  const fileDiffs = parseDiffByFile(diffUnified);
  const heavyHunks = parseHunks(diffUnifiedZero);
  const previousCommits = await collectHistoryForFiles(cwd, Object.keys(fileDiffs), cfg.previousCommitLimit);
  const heavyDiffSnapshots = await collectHeavyDiffSnapshots(cwd, heavyHunks, cfg);
  const openTabs = collectOpenTabs(cwd, cfg.openTabsLimit);
  setTerminalBufferHardLimit(Math.max(cfg.terminalLogLines * 5, 200));
  const terminalRecent = getTerminalSnapshot(cfg.terminalLogLines);

  const fileSummaries = Object.entries(fileDiffs).map(([file, diff])=> summariseFile(file, diff));

  const context = {
    repo_meta: {
      repo_name: repoName,
      default_branch: defaultBranch,
      current_branch: currentBranch,
      commit_language: commitLanguage,
      languages,
      commit_convention: 'Conventional Commits',
      service_map: serviceMap
    },
    intent_signals: {
      branch_hints: branchHints,
      recent_test_failures: [],
      linter_type_errors: [],
      related_issues_summary: [],
      previous_commits_touching_same_symbols: previousCommits
    },
    file_summaries: fileSummaries,
    ast_impact: {
      public_endpoints_changed: [],
      breaking_candidates: []
    },
    routes_schema_changes: [],
    db_schema_changes: [],
    test_changes: detectTestChanges(nameStatusLines),
    diffs: diffUnified,
    project_tree: await buildProjectTree(repo, cwd, cfg, stagedStatusMap),
    open_tabs: openTabs,
    terminal_recent: terminalRecent,
    heavy_diff_snapshots: heavyDiffSnapshots
  };

  lastContext = context;
  return context;
}

function buildUserPrompt(context){
  const meta = context.repo_meta;
  const intent = context.intent_signals;
  const commitLanguage = meta.commit_language || 'auto';
  const fileSummariesJson = JSON.stringify(context.file_summaries, null, 2);
  const astImpactJson = JSON.stringify(context.ast_impact, null, 2);
  const routesJson = JSON.stringify(context.routes_schema_changes, null, 2);
  const dbJson = JSON.stringify(context.db_schema_changes, null, 2);
  const testsJson = JSON.stringify(context.test_changes, null, 2);
  const projectTree = (context.project_tree || []).join('\n');
  const openTabs = (context.open_tabs || []).join('\n');
  const terminalRecent = (context.terminal_recent || []).join('\n');
  const heavySnapshots = (context.heavy_diff_snapshots || []).map(entry=> {
    const header = `# ${entry.path}`;
    const body = entry.content || '';
    return `${header}\n${body}`;
  }).join('\n\n');

  return `<instructions>
Analyze the repository context and staged diffs. Identify every significant, user-visible change and gather the literal values (versions, configuration keys, renamed resources).
</instructions>

<context>
<repo_meta>
<repo_name>${meta.repo_name}</repo_name>
<default_branch>${meta.default_branch}</default_branch>
<current_branch>${meta.current_branch}</current_branch>
<commit_language>${commitLanguage}</commit_language>
<languages>${JSON.stringify(meta.languages)}</languages>
<commit_convention>Conventional Commits</commit_convention>
<service_map>${JSON.stringify(meta.service_map)}</service_map>
</repo_meta>

<intent_signals>
<branch_hints>${JSON.stringify(intent.branch_hints)}</branch_hints>
<recent_test_failures>${JSON.stringify(intent.recent_test_failures)}</recent_test_failures>
<linter_type_errors>${JSON.stringify(intent.linter_type_errors)}</linter_type_errors>
<related_issues>${JSON.stringify(intent.related_issues_summary)}</related_issues>
<previous_commits>${JSON.stringify(intent.previous_commits_touching_same_symbols)}</previous_commits>
</intent_signals>

<project_tree>
${projectTree || '(empty)'}
</project_tree>

<open_tabs>
${openTabs || '(none)'}
</open_tabs>

<terminal_recent>
${terminalRecent || '(none)'}
</terminal_recent>

<file_summaries>
${fileSummariesJson}
</file_summaries>

<diffs>
${context.diffs}
</diffs>

<heavy_diff_snapshots>
${heavySnapshots || '(none)'}
</heavy_diff_snapshots>

<ast_impact>
${astImpactJson}
</ast_impact>

<routes_schema_changes>
${routesJson}
</routes_schema_changes>

<db_schema_changes>
${dbJson}
</db_schema_changes>

<test_changes>
${testsJson}
</test_changes>
</context>

<task>
Produce one commit_message JSON object that satisfies the schema referenced by the system prompt and COMMIT_RESPONSE_FORMAT.
- Choose the commit type per the provided rules (feat for DX/capability gains, fix for bug remediation, chore for routine maintenance) unless another allowed type better matches the dominant change.
- Pick the most representative scope token (single lowercase module/folder name) or "" when ambiguous.
- Craft the subject in the requested language, combine all primary changes in one sentence, and embed explicit values (version changes, renamed services, configuration keys and new values).
- Emit the body as a JSON array of terse fragments in the requested language (e.g., "env config cleanup"), one per significant change, each naming the concrete artifact/key/value and omitting terminal punctuation.
- Cover every significant change surfaced in the context without inventing data or repeating git metadata.
- Ignore the languages used in previous commits or diffs; the subject, body, and rationale must obey the requested language_instruction exactly. If compliance is impossible, emit LANGUAGE_POLICY_VIOLATION per the language_instruction guidance.
</task>`;
}

function buildCommitMessage(parsed){
  const type = (parsed.type || '').trim();
  if(!ALLOWED_TYPES.includes(type)) throw new Error('Model returned unsupported type.');
  const scope = (parsed.scope || '').trim();
  const rawSubject = (parsed.subject || '').trim();
  if(!rawSubject) throw new Error('Model returned empty subject.');
  const prefixRegex = new RegExp(`^(${ALLOWED_TYPES.join('|')})(?:\\([^)]+\\))?:\\s*`, 'i');
  let subject = rawSubject.replace(prefixRegex, '').trim();
  if(!subject) subject = rawSubject;
  const header = scope ? `${type}(${scope}): ${subject}` : `${type}: ${subject}`;
  const lines = [header];
  const bodyField = parsed.body;
  let bodyBlock = '';
  if(Array.isArray(bodyField)){
    const normalized = bodyField.map(entry=> (entry || '').toString().trim()).filter(Boolean);
    if(normalized.length){
      bodyBlock = normalized.map(sentence=> sentence.startsWith('- ') ? sentence : `- ${sentence}`).join('\n');
    }
  }else if(typeof bodyField === 'string'){
    const trimmed = bodyField.trim();
    if(trimmed){
      const sentences = trimmed.split(/\r?\n/).map(line=> line.trim()).filter(Boolean);
      bodyBlock = sentences.map(sentence=> sentence.startsWith('- ') ? sentence : `- ${sentence}`).join('\n');
    }
  }
  if(bodyBlock) lines.push(bodyBlock);
  const footer = [];
  if(parsed.breaking_change){ footer.push(`BREAKING CHANGE: ${parsed.breaking_change}`); }
  if(Array.isArray(parsed.issues)) parsed.issues.filter(Boolean).forEach(issue=> footer.push(issue));
  if(footer.length) lines.push('', footer.join('\n'));
  return lines.join('\n');
}

function isResponses(url){ try { return new URL(url).pathname.includes('/responses'); } catch { return false; } }
function toResponses(messages){
  return messages.map(m => ({ type:'message', role:m.role, content:[{ type:'input_text', text:String(m.content) }] }));
}
function pickFromResponses(resp){
  try { const msg = (resp?.output||[]).find(x => x.type==='message'); return msg ? msg.content.map(p=>p.text||p.delta||'').join('') : ''; } catch { return ''; }
}
function pickFromCompletions(resp){
  try {
    const ch = resp?.choices?.[0]; const m = ch?.message;
    if(typeof m?.content === 'string') return m.content;
    if(Array.isArray(m?.content)) return m.content.map(x=>x.text||x).join('');
    return '';
  } catch { return ''; }
}

function coerceResponse(response){
  if(typeof response === 'string') return response;
  if(isResponsesObject(response)){
    return pickFromResponses(response) || response.output_text || JSON.stringify(response);
  }
  if(response?.choices){
    return pickFromCompletions(response) || JSON.stringify(response);
  }
  return JSON.stringify(response);
}

function isResponsesObject(obj){
  try { return !!obj && Array.isArray(obj.output); } catch { return false; }
}

async function httpPost(cfg, payload, prompts, cancellationToken){
  lastPayload = payload;
  lastPayload.__meta = { prompts };
  const stamp = new Date().toISOString();
  log(`[info] ${stamp} model=${cfg.model}`);
  log(`[info] endpoint=${cfg.endpoint}`);

  const maxChars = cfg.logPromptMaxChars || 0;
  if(prompts?.system){
    const systemContent = maxChars > 0 ? prompts.system.slice(0, maxChars) : prompts.system;
    logSection('system', systemContent);
    if(maxChars > 0 && prompts.system.length > maxChars){
      log(`... (truncated ${prompts.system.length - maxChars} chars)`);
    }
  }
  if(prompts?.user){
    const userContent = maxChars > 0 ? prompts.user.slice(0, maxChars) : prompts.user;
    logSection('user', userContent);
    if(maxChars > 0 && prompts.user.length > maxChars){
      log(`... (truncated ${prompts.user.length - maxChars} chars)`);
    }
  }

  const headers = {
    'Authorization': `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': cfg.referer,
    'X-Title': cfg.title,
    'Accept': 'application/json'
  };

  async function viaFetch(){
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), cfg.timeoutMs);
    let cancelSub;
    if(cancellationToken){
      if(cancellationToken.isCancellationRequested){
        clearTimeout(timeout);
        controller.abort();
        throw new Error('Request cancelled');
      }
      cancelSub = cancellationToken.onCancellationRequested(()=>controller.abort());
    }
    try {
      const res = await fetch(cfg.endpoint, { method:'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
      const text = await res.text();
      if(cfg.logRaw) logSection('response', text.slice(0, 1000));
      if(!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
      const ct = res.headers.get('content-type') || '';
      if(!ct.includes('json')) return text;
      try { return JSON.parse(text); } catch { return text; }
    } catch(err){
      if(err?.name === 'AbortError' || err?.message === 'The user aborted a request.'){
        throw new Error('Request cancelled');
      }
      // fetch() 자체가 실패한 경우(네트워크 오류 등) cause에 상세 원인이 담겨 있음
      if(err?.cause){
        const causeMsg = err.cause?.message || String(err.cause);
        throw new Error(`${err.message} (cause: ${causeMsg})`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
      cancelSub?.dispose?.();
    }
  }

  async function viaCurl(){
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kargnas-commit-ai-'));
    const bodyFile = path.join(dir, 'body.json');
    const headerFile = path.join(dir, 'headers');
    try {
      fs.writeFileSync(bodyFile, JSON.stringify(payload), { mode: 0o600 });
      fs.writeFileSync(headerFile, formatCurlHeaders(cfg), { mode: 0o600 });
      if(cancellationToken?.isCancellationRequested){
        throw new Error('Request cancelled');
      }
      const args = buildCurlArgs({ endpoint: cfg.endpoint, headerFile, bodyFile, timeoutMs: cfg.timeoutMs });
      const { stdout } = await execFile('curl', args, process.cwd());
      if(cfg.logRaw) logSection('response', String(stdout).slice(0,1000));
      try { return JSON.parse(stdout); } catch { return stdout; }
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  }

  if (cfg.transport === 'curl') return await viaCurl();
  return await viaFetch();
}

async function providePullRequestTitleAndDescription(prContext, cancellationToken){
  const cfg = await getConfig();
  if(!cfg.apiKey){
    if(!prProviderWarnedNoKey){
      prProviderWarnedNoKey = true;
      vscode.window.showWarningMessage('PR 제목/본문 생성을 쓰려면 "Commit AI: Set API Key" 명령으로 API 키를 먼저 설정해.');
    }
    return undefined;
  }

  try{
    const languageInstruction = buildPullRequestLanguageInstruction(cfg.commitLanguage);
    const systemPrompt = languageInstruction ? `${PR_SYSTEM_PROMPT}\n${languageInstruction}` : PR_SYSTEM_PROMPT;
    const prepared = preparePullRequestPromptData(prContext || {}, cfg);
    const userPrompt = buildPullRequestUserPrompt(prepared);

    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
    const payload = isResponses(cfg.endpoint)
      ? { model: cfg.model, input: toResponses(messages), temperature: 0.2, max_output_tokens: 1200 }
      : { model: cfg.model, messages, temperature: 0.2, max_tokens: 1200 };

    payload.response_format = PR_RESPONSE_FORMAT;

    const rawResponse = await httpPost(cfg, payload, { system: systemPrompt, user: userPrompt }, cancellationToken);
    if(cancellationToken?.isCancellationRequested) return undefined;

    const text = coerceResponse(rawResponse);
    logSection('pr-model-output', text);
    const parsed = parseJSONSafely(text);
    if(!parsed) throw new Error('Model response was not valid JSON.');

    const title = String(parsed.title || parsed.subject || '').trim();
    const bodyField = parsed.body || parsed.description || '';
    const description = typeof bodyField === 'string' ? bodyField.trim() : '';
    if(!title) throw new Error('Model response did not include a title.');
    const sanitizedBody = description || '## Summary\n- not provided\n\n## Testing\n- not run\n\n## Risks\n- low';
    return { title, description: sanitizedBody };
  }catch(err){
    if(err?.message === 'Request cancelled'){
      log('PR AI request cancelled');
      return undefined;
    }
    const message = err?.message || String(err);
    log('PR AI failed: ' + message);
    vscode.window.showErrorMessage(`PR AI 실패: ${message}`);
    return undefined;
  }
}

function registerPullRequestProvider(context){
  if(prProviderRegistered) return;
  const ghExtension = vscode.extensions.getExtension('GitHub.vscode-pull-request-github');
  if(!ghExtension){
    log('GitHub Pull Requests extension not detected; skipping PR AI integration.');
    return;
  }

  Promise.resolve(ghExtension.activate()).then(api => {
    if(!api?.registerTitleAndDescriptionProvider){
      log('GitHub Pull Requests API missing registerTitleAndDescriptionProvider; unable to attach PR AI.');
      return;
    }
    const providerTitle = 'Commit AI (Copilot override)';
    const disposable = api.registerTitleAndDescriptionProvider(providerTitle, {
      provideTitleAndDescription: (ctx, token) => providePullRequestTitleAndDescription(ctx, token)
    });
    context.subscriptions.push(disposable);
    try {
      const currentSet = api._titleAndDescriptionProviders;
      if(currentSet instanceof Set){
        const reordered = [];
        let ours = null;
        for(const entry of currentSet){
          if(!ours && entry?.title === providerTitle){
            ours = entry;
            continue;
          }
          reordered.push(entry);
        }
        if(ours){
          api._titleAndDescriptionProviders = new Set([ours, ...reordered]);
        }
      }
    }catch(err){
      log('Commit AI: unable to reorder PR providers: ' + (err?.message || err));
    }
    prProviderRegistered = true;
    log('Commit AI: registered pull request title/description provider.');
  }).catch(err => {
    log('Commit AI: failed to register PR provider: ' + (err?.message || err));
  });
}

async function generate(...commandArgs){
  try{
    const api = await getGitAPI();
    const repo = await resolveRepository(api, commandArgs);
    if(!repo) return vscode.window.showErrorMessage('No Git repository open');
    const stagedOk = await ensureStagedOrOfferStageAll(repo);
    if(!stagedOk) { log('Aborted: no staged changes.'); return; }

    const cfg = await getConfig();
    if(!cfg.apiKey) return vscode.window.showErrorMessage('Set an API key first: run "Commit AI: Set API Key".');

    const context = await collectContext(repo, cfg);
    const baseSystemPrompt = cfg.systemPrompt || SYSTEM_PROMPT;
    const languageInstruction = buildLanguageInstruction(cfg.commitLanguage);
    const systemPrompt = languageInstruction ? `${baseSystemPrompt}\n${languageInstruction}` : baseSystemPrompt;
    const userPrompt = buildUserPrompt(context);

    const payload = isResponses(cfg.endpoint)
      ? { model: cfg.model, input: toResponses([{role:'system',content:systemPrompt},{role:'user',content:userPrompt}]), temperature: 0.2, max_output_tokens: 800 }
      : { model: cfg.model, messages: [{role:'system',content:systemPrompt},{role:'user',content:userPrompt}], temperature: 0.2 };

    payload.response_format = COMMIT_RESPONSE_FORMAT;

    const rawResponse = await httpPost(cfg, payload, { system: systemPrompt, user: userPrompt }, undefined);
    const text = coerceResponse(rawResponse);
    logSection('model-output', text);
    const parsed = parseJSONSafely(text);
    if(!parsed){
      vscode.window.showErrorMessage('Model response was not valid JSON. See output for details.');
      return;
    }
    const commitMessage = buildCommitMessage(parsed);
    repo.inputBox.value = commitMessage;
    if(parsed.rationale) logSection('rationale', parsed.rationale);
  }catch(e){
    const errDetail = e?.message || String(e);
    log('Commit AI failed: ' + errDetail);
    // 에러 메시지가 길 경우 showErrorMessage에서 잘릴 수 있으므로 앞 300자만 표시하고 전체는 Output에서 확인하도록 안내
    const displayMsg = errDetail.length > 300
      ? errDetail.slice(0, 300) + '... (see Output for full details)'
      : errDetail;
    vscode.window.showErrorMessage('Commit AI failed: ' + displayMsg);
  }
}

async function ping(){
  try{
    const cfg = await getConfig();
    const url = modelsUrl(cfg.endpointRaw);
    if(!url){
      vscode.window.showErrorMessage('Ping failed: the configured endpoint is not a valid URL.');
      return;
    }

    const headers = { 'Accept': 'application/json' };
    if(cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
    const res = await fetch(url, { method:'GET', headers });
    const text = await res.text();
    log(`Ping GET ${url} -> ${res.status}`);
    log(text.slice(0, 400));

    if(res.ok){
      const suffix = cfg.apiKey ? '' : ' (no API key stored for this endpoint)';
      vscode.window.showInformationMessage(`Ping OK — ${url}${suffix}`);
    } else if(res.status === 401 || res.status === 403){
      vscode.window.showErrorMessage(`API key rejected (${res.status}) by ${endpointOrigin(url)}`);
    } else if(res.status === 404 || res.status === 405){
      vscode.window.showWarningMessage(`${endpointOrigin(url)} reachable; /models is not exposed, so the key could not be validated.`);
    } else {
      vscode.window.showErrorMessage(`Ping failed: HTTP ${res.status}`);
    }
  }catch(e){
    log('Ping failed: ' + (e?.message || e));
    vscode.window.showErrorMessage('Ping failed: ' + (e?.message || e));
  }
}

function showLast(){
  const content = JSON.stringify({ payload:lastPayload, context:lastContext }, null, 2);
  vscode.workspace.openTextDocument({ content, language: 'json' }).then(doc => vscode.window.showTextDocument(doc, { preview:false }));
}

/**
 * Convert git remote URL (SSH or HTTPS) to GitHub web URL
 * SSH: git@github.com:user/repo.git -> https://github.com/user/repo
 * HTTPS: https://github.com/user/repo.git -> https://github.com/user/repo
 */
function gitRemoteToGitHubUrl(remoteUrl){
  if(!remoteUrl) return null;
  const trimmed = remoteUrl.trim();
  
  const sshMatch = trimmed.match(/^git@github\.com[:/](.+?)(?:\.git)?$/);
  if(sshMatch) return `https://github.com/${sshMatch[1]}`;
  
  const sshProtoMatch = trimmed.match(/^ssh:\/\/git@github\.com\/(.+?)(?:\.git)?$/);
  if(sshProtoMatch) return `https://github.com/${sshProtoMatch[1]}`;
  
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?$/);
  if(httpsMatch) return `https://github.com/${httpsMatch[1]}`;
  
  return null;
}

async function openInGitHub(uri){
  try {
    const api = await getGitAPI();
    let fileUri = uri;
    let repo = null;
    
    if(!fileUri){
      const editor = vscode.window.activeTextEditor;
      if(editor && editor.document.uri.scheme === 'file'){
        fileUri = editor.document.uri;
      }
    }
    
    if(fileUri && fileUri.scheme === 'file'){
      repo = api.getRepository(fileUri);
    }
    
    if(!repo){
      repo = await resolveRepository(api, null);
    }
    
    if(!repo){
      vscode.window.showWarningMessage('No Git repository found.');
      return;
    }
    
    const cwd = repo.rootUri.fsPath;
    
    const [remoteUrl, branch] = await Promise.all([
      runGit(cwd, ['remote', 'get-url', 'origin'], true),
      runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], true)
    ]);
    
    const baseUrl = gitRemoteToGitHubUrl(remoteUrl);
    if(!baseUrl){
      vscode.window.showWarningMessage('Remote origin is not a GitHub repository.');
      return;
    }
    
    let githubUrl = baseUrl;
    
    if(fileUri && fileUri.scheme === 'file'){
      const filePath = fileUri.fsPath;
      const relativePath = path.relative(cwd, filePath).replace(/\\/g, '/');
      
      if(relativePath && !relativePath.startsWith('..')){
        githubUrl = `${baseUrl}/blob/${branch || 'main'}/${relativePath}`;
        
        const editor = vscode.window.activeTextEditor;
        if(editor && editor.document.uri.fsPath === filePath){
          const selection = editor.selection;
          if(!selection.isEmpty){
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            githubUrl += startLine === endLine ? `#L${startLine}` : `#L${startLine}-L${endLine}`;
          } else {
            const cursorLine = selection.active.line + 1;
            githubUrl += `#L${cursorLine}`;
          }
        }
      }
    }
    
    const choices = [
      { label: '$(link-external) Open in Browser', value: 'external', description: githubUrl },
      { label: '$(clippy) Copy URL', value: 'copy', description: 'Copy to clipboard' },
      { label: '$(git-pull-request) Pull Requests', value: 'pulls', description: `${baseUrl}/pulls` },
      { label: '$(issues) Issues', value: 'issues', description: `${baseUrl}/issues` },
      { label: '$(play) Actions', value: 'actions', description: `${baseUrl}/actions` }
    ];
    
    const choice = await vscode.window.showQuickPick(choices, {
      placeHolder: 'Select action',
      title: 'Open in GitHub'
    });
    
    if(!choice) return;
    
    const urlMap = {
      external: githubUrl,
      pulls: `${baseUrl}/pulls`,
      issues: `${baseUrl}/issues`,
      actions: `${baseUrl}/actions`
    };
    
    if(choice.value === 'copy'){
      await vscode.env.clipboard.writeText(githubUrl);
      vscode.window.showInformationMessage('GitHub URL copied to clipboard.');
    } else if(urlMap[choice.value]){
      await vscode.env.openExternal(vscode.Uri.parse(urlMap[choice.value]));
    }
    
    log(`Open in GitHub: ${githubUrl}`);
  } catch(e){
    log('Open in GitHub failed: ' + (e?.message || e));
    vscode.window.showErrorMessage('Open in GitHub failed: ' + (e?.message || e));
  }
}

async function activate(context){
  log('Kargnas - AI Commit activated at ' + new Date().toISOString());
  secretsApi = context.secrets;
  try {
    await migrateLegacyApiKey(context);
  } catch(e){
    log('[secrets] migration failed: ' + (e?.message || e));
  }

  // Terminal capture removed: onDidWriteTerminalData requires proposed API
  context.subscriptions.push(vscode.commands.registerCommand('kargnas.aiCommit.generate', generate));
  context.subscriptions.push(vscode.commands.registerCommand('kargnas.aiCommit.pingOpenRouter', ping));
  context.subscriptions.push(vscode.commands.registerCommand('kargnas.aiCommit.setApiKey', () => setApiKey(context)));
  context.subscriptions.push(vscode.commands.registerCommand('kargnas.aiCommit.clearApiKey', () => clearApiKey(context)));
  context.subscriptions.push(vscode.commands.registerCommand('kargnas.aiCommit.showLastPayload', showLast));
  context.subscriptions.push(vscode.commands.registerCommand('kargnas.aiCommit.showLogs', show));
  context.subscriptions.push(vscode.commands.registerCommand('kargnas.aiCommit.openInGitHub', openInGitHub));
  
  registerPullRequestProvider(context);
}

function deactivate(){}

module.exports = { activate, deactivate };
