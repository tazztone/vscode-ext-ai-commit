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
3. Set `kargnas.aiCommit.apiKey` in VS Code settings

## Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kargnas.aiCommit.apiKey` | — | OpenRouter API key |
| `kargnas.aiCommit.model` | `google/gemini-2.5-flash-lite` | Model ID |
| `kargnas.aiCommit.commitLanguage` | `auto` | Output language (`ko`, `ja`, etc.) |
| `kargnas.aiCommit.maxPatchBytes` | `50000` | Max total diff size |
| `kargnas.aiCommit.previousCommitLimit` | `10` | Recent commits for context |
| `kargnas.aiCommit.transport` | `fetch` | HTTP transport (`fetch` or `curl`) |

[All settings →](https://github.com/kargnas/vscode-ext-ai-commit/blob/main/package.json)

## Commands

- **AI Commit** — Generate commit message from staged changes
- **Ping OpenRouter** — Test API connection
- **Show Last Payload** — Debug prompt/context
- **Show Logs** — Open the AI Commit output channel on demand
- **Open in GitHub** — Open current file on GitHub

## Troubleshooting

### `HTTP 413` — request too large

Some providers enforce a per-minute input-token budget. Groq's on-demand tier,
for example, caps input tokens per minute (ITPM) per model, so the default
context budget can be rejected in a single request:

```
Request too large for model ... on input tokens per minute (ITPM):
Limit 7000, Requested 7772
```

This is a provider quota, not a malformed payload. Shrink the context budget in
settings:

- `kargnas.aiCommit.maxPatchBytes` — lower from `50000` (e.g. `16000`)
- `kargnas.aiCommit.heavyDiffMaxFiles` — set `0` to drop full-file snapshots
- `kargnas.aiCommit.projectTreeMaxEntries`, `openTabsLimit`,
  `terminalLogLines`, `previousCommitLimit` — lower or zero out

The budget is per minute, so consecutive runs count against the same limit.

## License

MIT © [Sangrak Choi](https://kargn.as)

---

[GitHub](https://github.com/kargnas/vscode-ext-ai-commit) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message) · [OpenRouter](https://openrouter.ai)
