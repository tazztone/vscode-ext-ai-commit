# LLM コミットメッセージ

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/kargnas.llm-commit-message?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)
[![Blog](https://img.shields.io/badge/Blog-kargn.as-green)](https://kargn.as)

AI がコードの変更内容を分析して、高品質な git コミットメッセージを自動生成します。[OpenRouter](https://openrouter.ai) を通じて GPT、Claude、Gemini など様々な LLM を使えます。

[English](../README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文-台灣](README.zh-TW.md) | [繁體中文-香港](README.zh-HK.md) | **日本語**

## ✨ 主な機能

### 🎯 ワンクリックでコミットメッセージ生成
ソース管理パネルのキラキラボタン(✨)をクリックするだけ。数秒で Conventional Commit 規約に沿った完璧なコミットメッセージが生成されます。

### 🧠 豊富なコンテキスト収集
単なる差分だけでなく、プロジェクト全体を理解してメッセージを作成します:

- **ステージされた差分** - 実際のコード変更とパッチの詳細を分析
- **プロジェクトツリー** - ワークスペースのファイル構造と変更状態を把握
- **最近のコミット履歴** - 変更されたファイルごとに最大10件の過去コミットを参照
- **開いているタブ一覧** - エディタで現在作業中のファイル
- **ターミナルログ** - 最近実行したコマンドの出力
- **大量差分の処理** - 変更が多いファイル(3つ以上のハンク)は完全なスナップショットを含む

### 🌐 OpenRouter で多様な AI モデルを使用
お好みの最新 AI モデルを自由に選択できます:

- **OpenAI**: GPT-4、GPT-4 Turbo、GPT-3.5
- **Anthropic**: Claude 3.5 Sonnet、Claude 3 Opus
- **Google**: Gemini 2.5 Flash、Gemini Pro
- **Meta**: Llama 3
- **Mistral**: Mixtral 8x7B
- その他多数のモデル...

デフォルトモデル: `google/gemini-2.5-flash-lite` (高速で低コスト)

### 📝 Conventional Commits フォーマット自動生成
[Conventional Commits](https://www.conventionalcommits.org/) 標準に従ったメッセージを自動生成します:

```
<type>(<scope>): <subject>

<body>
```

**タイプ**: `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`、`ci`、`build`

### 🌍 多言語コミットメッセージ
お好みの言語でコミットメッセージを作成できます:
- `kargnas.aiCommit.commitLanguage` を `"ko"` に設定すると韓国語、`"ja"` で日本語、`"auto"` は英語で生成されます

### 🔍 デバッグと透明性
- **完全なリクエストログ** - すべての API リクエストが出力パネルに記録されます
- **「最後のペイロードを表示」** - AI に送信した正確なプロンプトとコンテキストを確認
- **生レスポンスログ** - パース前にモデルが返した生データを確認可能

### 🏢 マルチリポジトリワークスペース対応
複数の git リポジトリで作業していますか?問題ありません:
- 現在作業中のリポジトリを自動検出
- 曖昧な場合は選択を促します
- 各リポジトリごとに独立したコンテキストを維持

## 📦 インストール

1. [VS Code マーケットプレイス](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)からインストール
2. [OpenRouter](https://openrouter.ai/keys) で API キーを取得
3. VS Code 設定を開く (⌘+, または Ctrl+,)
4. "kargnas commit" を検索
5. `Kargnas Commit AI: API Key` に API キーを貼り付け

## 🚀 使い方

1. **ソース管理パネルで変更をステージ**
2. **コミットメッセージ入力欄の隣のキラキラボタン(✨)をクリック**
3. **AI が分析する間、数秒待つ**
4. **生成されたメッセージを確認** - 必要なら編集
5. **コミット!**

### ステージされた変更がない場合
ステージせずにボタンをクリックすると、すべての変更を自動的にステージするか尋ねられます。

## ⚙️ 設定

| 設定 | デフォルト値 | 説明 |
|------|------------|------|
| `kargnas.aiCommit.apiKey` | `""` | OpenRouter API キー (必須) |
| `kargnas.aiCommit.autoStage` | `false` | ステージされた変更がない場合に確認なしで自動ステージ |
| `kargnas.aiCommit.model` | `"google/gemini-2.5-flash-lite"` | OpenRouter モデル ID |
| `kargnas.aiCommit.endpoint` | OpenRouter API | カスタム API エンドポイント (上級者向け) |
| `kargnas.aiCommit.commitLanguage` | `"auto"` | コミットメッセージの言語 (例: `"ko"`、`"ja"`) |
| `kargnas.aiCommit.transport` | `"fetch"` | HTTP 転送方式 (`"fetch"` または `"curl"`) |
| `kargnas.aiCommit.requestTimeoutMs` | `25000` | API リクエストタイムアウト (ミリ秒) |
| `kargnas.aiCommit.logRawResponse` | `true` | 生 API レスポンスを出力パネルに記録 |
| `kargnas.aiCommit.contextIncludeGlobs` | `["**/*"]` | コンテキストに含めるファイルパターン |
| `kargnas.aiCommit.contextIgnoreGlobs` | `["**/*.lock", "dist/**", ...]` | コンテキストから除外するファイルパターン |
| `kargnas.aiCommit.maxFilePatchBytes` | `12000` | ファイルごとの最大差分サイズ |
| `kargnas.aiCommit.maxPatchBytes` | `50000` | 全体の最大差分サイズ |
| `kargnas.aiCommit.previousCommitLimit` | `10` | 含める最近のコミット数 |
| `kargnas.aiCommit.openTabsLimit` | `10` | 含める開いているタブ数 |
| `kargnas.aiCommit.terminalLogLines` | `20` | 含めるターミナルログ行数 |
| `kargnas.aiCommit.projectTreeMaxEntries` | `400` | プロジェクトツリーの最大エントリ数 |
| `kargnas.aiCommit.logPromptMaxChars` | `0` | プロンプトログの切り捨て長さ (0 = 無制限) |

### 設定例

```json
{
  "kargnas.aiCommit.apiKey": "sk-or-v1-...",
  "kargnas.aiCommit.model": "anthropic/claude-3.5-sonnet",
  "kargnas.aiCommit.commitLanguage": "ja",
  "kargnas.aiCommit.logPromptMaxChars": 0
}
```

## 🤔 なぜこの拡張機能を使うのか?

### GitHub Copilot との比較
- **より多くのモデル**: OpenRouter を通じて100以上のモデルを選択可能
- **豊富なコンテキスト**: プロジェクトツリー、ターミナルログ、開いているタブを含む
- **透明性**: 完全なリクエスト/レスポンスログ
- **カスタマイズ可能**: コンテキスト収集とフォーマットを細かく調整可能

### 他の AI コミットツールとの比較
- **コンテキストの深さ**: ほとんどのツールは差分のみ送信。私たちはプロジェクト構造、最近のコミット、エディタ状態も送信
- **マルチリポジトリ認識**: ワークスペースフォルダを適切に処理
- **Conventional Commits**: 業界標準フォーマットを強制
- **デバッグフレンドリー**: 「最後のペイロードを表示」コマンドでトラブルシューティングが簡単
- **大量差分の処理**: スマートな切り捨てと必要時の完全ファイルスナップショット

### 手動コミットメッセージとの比較
- **一貫性**: すべてのメッセージが同じ高品質フォーマットに従う
- **速度**: 数分かかることが数秒で完了
- **詳細**: AI が見落としがちなパターンや関係性を発見
- **学習**: 優れたコミットメッセージの構成方法を学べる

## 🛠️ コマンド

- **AI Commit** (`kargnas.aiCommit.generate`) - ステージされた変更からコミットメッセージを生成
- **Ping OpenRouter** (`kargnas.aiCommit.pingOpenRouter`) - API 接続をテスト
- **Show Last Payload** (`kargnas.aiCommit.showLastPayload`) - AI に送信した最後のプロンプトを表示
- **Show Logs** (`kargnas.aiCommit.showLogs`) - 必要なときに AI Commit の出力チャンネルを開く
- **Open in GitHub** (`kargnas.aiCommit.openInGitHub`) - 現在のファイルを GitHub で開く (ボーナス機能!)

## 🐛 トラブルシューティング

### "No API key configured"
設定に OpenRouter API キーを追加してください。[openrouter.ai/keys](https://openrouter.ai/keys) で取得できます。

### "API request failed"
- インターネット接続を確認
- API キーが正しいか確認
- "Ping OpenRouter" コマンドを実行してみる
- 出力パネル (表示 → 出力 → "kargnas - Commit AI") でエラーを確認

### 空のコミットメッセージが生成された
- 拡張機能にはローカルフォールバックがあります: `chore: update files`
- API キーにクレジットがあるか確認
- 別のモデルを試してみる
- "Show Last Payload" でどんなコンテキストが送信されたか確認

### 生成されたメッセージの言語が違う
`kargnas.aiCommit.commitLanguage` を希望の言語コードに設定してください (例: `"ko"`、`"ja"`)

## 📄 ライセンス

MIT © [Sangrak Choi](https://kargn.as)

## 🔗 リンク

- [GitHub リポジトリ](https://github.com/kargnas/vscode-ext-ai-commit)
- [VS Code マーケットプレイス](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)
- [OpenRouter](https://openrouter.ai)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [作者のブログ](https://kargn.as)

---

**より賢いコミットを楽しもう!** ✨
