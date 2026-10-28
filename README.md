# LLM Commit Message

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/kargnas.llm-commit-message?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message) [![Blog](https://img.shields.io/badge/Blog-kargn.as-green)](https://kargn.as)

AI-powered git commit message generator for VS Code. One click, perfect [Conventional Commits](https://www.conventionalcommits.org/).

🌏 [한국어](docs/README.ko.md) | [简体中文](docs/README.zh-CN.md) | [繁體中文-台灣](docs/README.zh-TW.md) | [繁體中文-香港](docs/README.zh-HK.md) | [日本語](docs/README.ja.md)

## How It Works

1. Stage your changes
2. Click ✨ in the Source Control panel
3. Done — commit message generated

## What Makes It Good

**Deep context** — not just the diff. Collects project tree, recent commits per file, open tabs, terminal output, and full file snapshots for complex changes.

**Any model** — GPT, Claude, Gemini, Llama, Mistral via [OpenRouter](https://openrouter.ai). Default: `google/gemini-2.5-flash-lite`.

**Multi-repo** — handles workspaces with multiple git repos.

**Transparent** — every API request logged. `Show Last Payload` command to see exactly what was sent.

## Setup

1. Install from [Marketplace](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)
2. Get an API key from [OpenRouter](https://openrouter.ai/keys)
3. Run **Commit AI: Set API Key** and paste the key

## API Keys

API keys live in VS Code's SecretStorage (the OS keyring), never in `settings.json`. One key is stored per endpoint host, so switching between OpenRouter and another OpenAI-compatible provider keeps each key separate.

1. Run **Commit AI: Set API Key**
2. Paste the key for the endpoint configured in `kargnas.aiCommit.endpoint`

**Commit AI: Clear API Key** removes the key for the current endpoint.

Notes:

- SecretStorage is per machine and is **not** synced by Settings Sync. Set the key again on each machine.
- On Linux, SecretStorage depends on the system keyring (gnome-keyring or KWallet). Without one, Chromium falls back to a weaker store.
- Upgrading from a version that kept the key in `settings.json` migrates it automatically and removes the plaintext copy. Rotate the key if that file was ever synced or committed.

## Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kargnas.aiCommit.apiKey` | — | Deprecated; use **Commit AI: Set API Key** |
| `kargnas.aiCommit.model` | `google/gemini-2.5-flash-lite` | Model ID |
| `kargnas.aiCommit.commitLanguage` | `auto` | Output language (`ko`, `ja`, etc.) |
| `kargnas.aiCommit.maxPatchBytes` | `50000` | Max total diff size |
| `kargnas.aiCommit.previousCommitLimit` | `10` | Recent commits for context |
| `kargnas.aiCommit.transport` | `fetch` | HTTP transport (`fetch` or `curl`) |

[All settings →](https://github.com/kargnas/vscode-ext-ai-commit/blob/main/package.json)

## Commands

- **AI Commit** — Generate commit message from staged changes
- **Set API Key** — Store the key for the configured endpoint in SecretStorage
- **Clear API Key** — Remove the stored key for the configured endpoint
- **Ping Endpoint** — Test the configured endpoint and its key
- **Show Last Payload** — Debug prompt/context
- **Show Logs** — Open the AI Commit output channel on demand
- **Open in GitHub** — Open current file on GitHub

## Troubleshooting

### `401` — no key for this endpoint

Keys are stored per endpoint host. After changing `kargnas.aiCommit.endpoint`, run **Commit AI: Set API Key** once for the new host.

## License

MIT © [Sangrak Choi](https://kargn.as)

---

[GitHub](https://github.com/kargnas/vscode-ext-ai-commit) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message) · [OpenRouter](https://openrouter.ai)
