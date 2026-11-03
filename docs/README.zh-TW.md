# LLM 提交訊息

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/kargnas.llm-commit-message?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)
[![Blog](https://img.shields.io/badge/Blog-kargn.as-green)](https://kargn.as)

讓 AI 自動分析你的程式碼變更,產生高品質的 git 提交訊息。透過 [OpenRouter](https://openrouter.ai) 支援 GPT、Claude、Gemini 等各種大型語言模型。

[English](../README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | **繁體中文-台灣** | [繁體中文-香港](README.zh-HK.md) | [日本語](README.ja.md)

## ✨ 主要功能

### 🎯 一鍵產生提交訊息
在原始檔控制面板點選閃亮按鈕(✨),幾秒鐘就能得到符合 Conventional Commit 規範的完美提交訊息。

### 🧠 豐富的情境資訊收集
不只是看程式碼變更,還會深入分析整個專案環境:

- **暫存區差異** - 詳細分析實際程式碼變更與補丁細節
- **專案樹狀結構** - 理解工作區的檔案架構與修改狀態
- **最近的提交紀錄** - 每個修改檔案最多包含 10 筆歷史提交,保持風格一致
- **開啟的分頁** - 目前編輯器中正在處理的檔案
- **終端機記錄** - 最近執行的指令輸出
- **大量差異處理** - 對於變更較多的檔案(3 個以上程式碼區塊),會包含完整檔案快照

### 🌐 透過 OpenRouter 支援多種 AI 模型
自由選擇最新的 AI 模型:

- **OpenAI**: GPT-4、GPT-4 Turbo、GPT-3.5
- **Anthropic**: Claude 3.5 Sonnet、Claude 3 Opus
- **Google**: Gemini 2.5 Flash、Gemini Pro
- **Meta**: Llama 3
- **Mistral**: Mixtral 8x7B
- 還有更多模型可供選擇...

預設模型: `google/gemini-2.5-flash-lite` (速度快、成本低)

### 📝 自動產生 Conventional Commits 格式
產生的訊息自動遵循 [Conventional Commits](https://www.conventionalcommits.org/) 標準:

```
<type>(<scope>): <subject>

<body>
```

**類型**: `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`、`ci`、`build`

### 🌍 多語言提交訊息
可以用你習慣的語言撰寫提交訊息:
- 將 `kargnas.aiCommit.commitLanguage` 設為 `"ko"` 產生韓文,`"ja"` 產生日文,`"auto"` 則使用英文

### 🔍 除錯與透明度
- **完整請求記錄** - 所有 API 請求都會記錄到輸出面板
- **「查看最後的酬載」** - 檢視發送給 AI 的確切提示詞與情境資訊
- **原始回應記錄** - 可以查看解析前模型回傳的原始內容

### 🏢 多倉庫工作區支援
在多個 git 倉庫中工作?沒問題:
- 自動偵測目前工作的倉庫
- 不確定時會提示你選擇
- 為每個倉庫維護獨立的情境資訊

## 📦 安裝

1. 從 [VS Code 市集](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)安裝
2. 在 [OpenRouter](https://openrouter.ai/keys) 取得 API 金鑰
3. 開啟 VS Code 設定 (⌘+, 或 Ctrl+,)
4. 搜尋 "kargnas commit"
5. 將 API 金鑰貼到 `Kargnas Commit AI: API Key` 中

## 🚀 使用方式

1. **在原始檔控制面板中暫存你的變更**
2. **點選提交訊息輸入框旁邊的閃亮按鈕(✨)**
3. **稍等幾秒讓 AI 分析你的改動**
4. **檢視產生的訊息** - 需要的話可以修改
5. **提交!**

### 沒有暫存的變更?
如果你在沒有暫存任何內容的情況下點選按鈕,擴充功能會詢問是否要自動暫存所有變更。

## ⚙️ 設定

| 設定 | 預設值 | 說明 |
|------|--------|------|
| `kargnas.aiCommit.apiKey` | `""` | OpenRouter API 金鑰 (必要) |
| `kargnas.aiCommit.autoStage` | `false` | 無暫存變更時無需確認自動全部暫存 |
| `kargnas.aiCommit.model` | `"google/gemini-2.5-flash-lite"` | OpenRouter 模型 ID |
| `kargnas.aiCommit.endpoint` | OpenRouter API | 自訂 API 端點 (進階) |
| `kargnas.aiCommit.commitLanguage` | `"auto"` | 提交訊息語言 (例如 `"ko"`、`"ja"`) |
| `kargnas.aiCommit.transport` | `"fetch"` | HTTP 傳輸方式 (`"fetch"` 或 `"curl"`) |
| `kargnas.aiCommit.requestTimeoutMs` | `25000` | API 請求逾時時間(毫秒) |
| `kargnas.aiCommit.logRawResponse` | `true` | 將原始 API 回應記錄到輸出面板 |
| `kargnas.aiCommit.contextIncludeGlobs` | `["**/*"]` | 包含在情境中的檔案模式 |
| `kargnas.aiCommit.contextIgnoreGlobs` | `["**/*.lock", "dist/**", ...]` | 從情境中排除的檔案模式 |
| `kargnas.aiCommit.maxFilePatchBytes` | `12000` | 單一檔案差異的最大位元組數 |
| `kargnas.aiCommit.maxPatchBytes` | `50000` | 總差異的最大位元組數 |
| `kargnas.aiCommit.previousCommitLimit` | `10` | 包含的最近提交數量 |
| `kargnas.aiCommit.openTabsLimit` | `10` | 包含的開啟分頁數量 |
| `kargnas.aiCommit.terminalLogLines` | `20` | 包含的終端機記錄行數 |
| `kargnas.aiCommit.projectTreeMaxEntries` | `400` | 專案樹狀結構的最大條目數 |
| `kargnas.aiCommit.logPromptMaxChars` | `0` | 提示詞記錄截斷長度(0 = 無限制) |

### 設定範例

```json
{
  "kargnas.aiCommit.apiKey": "sk-or-v1-...",
  "kargnas.aiCommit.model": "anthropic/claude-3.5-sonnet",
  "kargnas.aiCommit.commitLanguage": "ko",
  "kargnas.aiCommit.logPromptMaxChars": 0
}
```

## 🤔 為什麼選擇這個擴充功能?

### 對比 GitHub Copilot
- **更多模型選擇**: 透過 OpenRouter 可使用 100 多種模型
- **更豐富的情境資訊**: 包含專案樹狀結構、終端機記錄、開啟的分頁
- **更透明**: 完整的請求/回應記錄
- **可客製化**: 可以精細調整情境資訊收集與格式化

### 對比其他 AI 提交工具
- **情境深度**: 大多數工具只傳送差異,我們傳送專案架構、最近提交與編輯器狀態
- **多倉庫感知**: 正確處理工作區資料夾
- **Conventional Commits**: 強制使用業界標準格式
- **除錯友善**: 「查看最後的酬載」指令便於排查問題
- **大量差異處理**: 智慧截斷與必要時的完整檔案快照

### 對比手動撰寫提交訊息
- **一致性**: 每則訊息都遵循相同的高品質格式
- **速度**: 幾秒鐘完成原本需要幾分鐘的工作
- **細節**: AI 能發現你可能忽略的模式與關聯
- **學習**: 瞭解如何建構優秀的提交訊息

## 🛠️ 指令

- **AI Commit** (`kargnas.aiCommit.generate`) - 從暫存的變更產生提交訊息
- **Ping OpenRouter** (`kargnas.aiCommit.pingOpenRouter`) - 測試 API 連線
- **Show Last Payload** (`kargnas.aiCommit.showLastPayload`) - 查看發送給 AI 的最後一個提示詞
- **Show Logs** (`kargnas.aiCommit.showLogs`) - 需要時開啟 AI Commit 輸出通道
- **Open in GitHub** (`kargnas.aiCommit.openInGitHub`) - 在 GitHub 中開啟目前檔案(額外功能!)

## 🐛 疑難排解

### "No API key configured"
在設定中新增 OpenRouter API 金鑰。在 [openrouter.ai/keys](https://openrouter.ai/keys) 取得。

### "API request failed"
- 檢查網路連線
- 驗證 API 金鑰是否正確
- 嘗試執行 "Ping OpenRouter" 指令
- 查看輸出面板 (檢視 → 輸出 → "kargnas - Commit AI") 的錯誤訊息

### 產生了空的提交訊息
- 擴充功能有本地備援機制: `chore: update files`
- 檢查 API 金鑰是否有額度
- 嘗試其他模型
- 使用 "Show Last Payload" 查看傳送了什麼情境資訊

### 產生的訊息語言不對
將 `kargnas.aiCommit.commitLanguage` 設為你想要的語言代碼(例如 `"ko"`、`"ja"`)

## 📄 授權

MIT © [Sangrak Choi](https://kargn.as)

## 🔗 連結

- [GitHub 倉庫](https://github.com/kargnas/vscode-ext-ai-commit)
- [VS Code 市集](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)
- [OpenRouter](https://openrouter.ai)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [作者部落格](https://kargn.as)

---

**享受更聰明的提交體驗!** ✨
