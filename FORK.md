# Fork notes

Personal fork of [kargnas/vscode-ext-ai-commit](https://github.com/kargnas/vscode-ext-ai-commit),
carrying a fix that has not been merged upstream.

Upstream issue: [kargnas/vscode-ext-ai-commit#17](https://github.com/kargnas/vscode-ext-ai-commit/issues/17)

## Why this fork exists

`httpPost()` attached diagnostic metadata to the same object it later
serialized, so every request body contained a `__meta` property holding a
second copy of the system and user prompts. OpenRouter's gateway does not
reject unknown top-level fields, so the leak went unnoticed there; strict
OpenAI-compatible endpoints do reject them. Groq answers with:

```json
{ "error": { "message": "property '__meta' is unsupported", "type": "invalid_request_error" } }
```

The fix keeps the metadata for the "Show Last Payload" command but removes it
from the wire body on both transports (fetch and curl).

## Branch layout

| Branch | Purpose |
| --- | --- |
| `main` | untouched mirror of `upstream/main` |
| `fix/meta-leak-request-body` | the fix, its tests, and this file |

Keeping the fix off `main` means `git fetch upstream && git rebase upstream/main`
never fights local commits, and `gh repo sync` stays safe.

## Changes

- `lib/serialize.js` — `toRequestBody()` strips `__meta` before serialization.
- `extension.js` — `lastPayload` is a copy instead of an alias; both transports
  use `toRequestBody()`.
- `test/serialize.test.js` — serializer unit tests plus a tripwire that fails if
  `extension.js` regresses to serializing the diagnostic payload.
- `package.json` — `npm test` runs `node --test test/`.
- `.vscodeignore` — excludes `test/**`, `output/**`, `FORK.md` from the VSIX.
- `scripts/package-codium.sh` — packages and installs into Codium.

## Build and install

```bash
npm ci
npm test
./scripts/package-codium.sh
```

Then reload the editor window.

The script packages committed `HEAD` (via `git archive`) into a temp directory,
bumps the patch version **there only**, and installs the result. The committed
`package.json` keeps upstream's version, so rebases stay clean.

## Version policy

The installed build is always `upstream + 1` patch:

- an upstream release of the same number cannot silently replace the patched build;
- an upstream release two or more patches ahead will replace it via auto-update —
  re-run the packaging script afterwards, or install upstream once it contains the fix.

## Shared extension directory

On this machine `~/.vscode-oss/extensions` is a symlink to
`~/.antigravity-ide/extensions`. Codium and the Antigravity IDE therefore read the
same extension directory, so this patched build is active in both. That is
intentional: the fix is provider compatibility, not editor-specific.

## Syncing with upstream

```bash
git fetch upstream
git rebase upstream/main          # on fix/meta-leak-request-body
npm ci && npm test
./scripts/package-codium.sh
```

If upstream ever ships this fix, drop the branch and install from the marketplace:

```bash
git switch main && git reset --hard upstream/main
```

## Verification used

1. `npm test` — serializer and tripwire tests.
2. `npx @vscode/vsce package` — mirrors the upstream CI packaging step.
3. Local echo server — confirmed the wire body contains only `model`,
   `messages`, `temperature`, and `response_format`, while "Show Last Payload"
   still renders `payload.__meta.prompts`.
4. Live Groq request against a custom `chat/completions` endpoint.
