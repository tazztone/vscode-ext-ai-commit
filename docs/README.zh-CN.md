# LLM 提交信息

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/kargnas.llm-commit-message?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)
[![Blog](https://img.shields.io/badge/Blog-kargn.as-green)](https://kargn.as)

AI 自动分析你的代码改动,生成高质量的 git 提交信息。支持通过 [OpenRouter](https://openrouter.ai) 使用 GPT、Claude、Gemini 等各种大语言模型。

[English](../README.md) | [한국어](README.ko.md) | **简体中文** | [繁體中文-台灣](README.zh-TW.md) | [繁體中文-香港](README.zh-HK.md) | [日本語](README.ja.md)

## ✨ 核心功能

### 🎯 一键生成提交信息
在源代码管理面板点击星星(✨)按钮,几秒钟就能得到符合 Conventional Commit 规范的完美提交信息。

### 🧠 丰富的上下文收集
不只是看代码改动,还会分析整个项目环境:

- **暂存区差异** - 详细分析实际代码变更和补丁细节
- **项目树** - 了解工作区的文件结构和修改状态
- **最近提交记录** - 每个修改文件最多包含10条历史提交,保持风格一致
- **打开的标签页** - 当前编辑器中正在处理的文件
- **终端日志** - 最近执行的命令输出
- **大量差异处理** - 对于变更较多的文件(3个以上代码块),会包含完整文件快照

### 🌐 通过 OpenRouter 支持多种 AI 模型
自由选择最新的 AI 模型:

- **OpenAI**: GPT-4、GPT-4 Turbo、GPT-3.5
- **Anthropic**: Claude 3.5 Sonnet、Claude 3 Opus
- **Google**: Gemini 2.5 Flash、Gemini Pro
- **Meta**: Llama 3
- **Mistral**: Mixtral 8x7B
- 还有更多模型可供选择...

默认模型: `google/gemini-2.5-flash-lite` (速度快,成本低)

### 📝 自动生成 Conventional Commits 格式
生成的信息自动遵循 [Conventional Commits](https://www.conventionalcommits.org/) 标准:

```
<type>(<scope>): <subject>

<body>
```

**类型**: `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`、`ci`、`build`

### 🌍 多语言提交信息
可以用你习惯的语言编写提交信息:
- 将 `kargnas.aiCommit.commitLanguage` 设为 `"ko"` 生成韩语,`"ja"` 生成日语,`"auto"` 则使用英语

### 🔍 调试与透明度
- **完整请求日志** - 所有 API 请求都会记录到输出面板
- **"查看最后的载荷"** - 查看发送给 AI 的确切提示词和上下文
- **原始响应日志** - 可以查看解析前模型返回的原始内容

### 🏢 多仓库工作区支持
在多个 git 仓库中工作?没问题:
- 自动检测当前工作的仓库
- 不确定时会提示你选择
- 为每个仓库维护独立的上下文

## 📦 安装

1. 从 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)安装
2. 在 [OpenRouter](https://openrouter.ai/keys) 获取 API 密钥
3. 打开 VS Code 设置 (⌘+, 或 Ctrl+,)
4. 搜索 "kargnas commit"
5. 将 API 密钥粘贴到 `Kargnas Commit AI: API Key` 中

## 🚀 使用方法

1. **在源代码管理面板中暂存你的更改**
2. **点击提交信息输入框旁边的星星按钮(✨)**
3. **等待几秒让 AI 分析你的改动**
4. **检查生成的信息** - 需要的话可以修改
5. **提交!**

### 没有暂存的更改?
如果你在没有暂存任何内容的情况下点击按钮,插件会询问是否要自动暂存所有更改。

## ⚙️ 配置

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `kargnas.aiCommit.apiKey` | `""` | OpenRouter API 密钥 (必需) |
| `kargnas.aiCommit.autoStage` | `false` | 无暂存更改时无需确认自动全部暂存 |
| `kargnas.aiCommit.model` | `"google/gemini-2.5-flash-lite"` | OpenRouter 模型 ID |
| `kargnas.aiCommit.endpoint` | OpenRouter API | 自定义 API 端点 (高级) |
| `kargnas.aiCommit.commitLanguage` | `"auto"` | 提交信息语言 (如 `"ko"`、`"ja"`) |
| `kargnas.aiCommit.transport` | `"fetch"` | HTTP 传输方式 (`"fetch"` 或 `"curl"`) |
| `kargnas.aiCommit.requestTimeoutMs` | `25000` | API 请求超时时间(毫秒) |
| `kargnas.aiCommit.logRawResponse` | `true` | 将原始 API 响应记录到输出面板 |
| `kargnas.aiCommit.contextIncludeGlobs` | `["**/*"]` | 包含在上下文中的文件模式 |
| `kargnas.aiCommit.contextIgnoreGlobs` | `["**/*.lock", "dist/**", ...]` | 从上下文中排除的文件模式 |
| `kargnas.aiCommit.maxFilePatchBytes` | `12000` | 单个文件差异的最大字节数 |
| `kargnas.aiCommit.maxPatchBytes` | `50000` | 总差异的最大字节数 |
| `kargnas.aiCommit.previousCommitLimit` | `10` | 包含的最近提交数量 |
| `kargnas.aiCommit.openTabsLimit` | `10` | 包含的打开标签页数量 |
| `kargnas.aiCommit.terminalLogLines` | `20` | 包含的终端日志行数 |
| `kargnas.aiCommit.projectTreeMaxEntries` | `400` | 项目树的最大条目数 |
| `kargnas.aiCommit.logPromptMaxChars` | `0` | 提示词日志截断长度(0 = 无限制) |

### 配置示例

```json
{
  "kargnas.aiCommit.apiKey": "sk-or-v1-...",
  "kargnas.aiCommit.model": "anthropic/claude-3.5-sonnet",
  "kargnas.aiCommit.commitLanguage": "ko",
  "kargnas.aiCommit.logPromptMaxChars": 0
}
```

## 🤔 为什么选择这个插件?

### 对比 GitHub Copilot
- **更多模型选择**: 通过 OpenRouter 可使用100多种模型
- **更丰富的上下文**: 包含项目树、终端日志、打开的标签页
- **更透明**: 完整的请求/响应日志
- **可定制**: 可以精细调整上下文收集和格式化

### 对比其他 AI 提交工具
- **上下文深度**: 大多数工具只发送差异,我们发送项目结构、最近提交和编辑器状态
- **多仓库感知**: 正确处理工作区文件夹
- **Conventional Commits**: 强制使用行业标准格式
- **调试友好**: "查看最后的载荷"命令便于排查问题
- **大量差异处理**: 智能截断和必要时的完整文件快照

### 对比手动编写提交信息
- **一致性**: 每条信息都遵循相同的高质量格式
- **速度**: 几秒钟完成原本需要几分钟的工作
- **细节**: AI 能发现你可能忽略的模式和关系
- **学习**: 了解如何构建优秀的提交信息

## 🛠️ 命令

- **AI Commit** (`kargnas.aiCommit.generate`) - 从暂存的更改生成提交信息
- **Ping OpenRouter** (`kargnas.aiCommit.pingOpenRouter`) - 测试 API 连接
- **Show Last Payload** (`kargnas.aiCommit.showLastPayload`) - 查看发送给 AI 的最后一个提示词
- **Show Logs** (`kargnas.aiCommit.showLogs`) - 需要时打开 AI Commit 输出通道
- **Open in GitHub** (`kargnas.aiCommit.openInGitHub`) - 在 GitHub 中打开当前文件(额外功能!)

## 🐛 故障排除

### "No API key configured"
在设置中添加 OpenRouter API 密钥。在 [openrouter.ai/keys](https://openrouter.ai/keys) 获取。

### "API request failed"
- 检查网络连接
- 验证 API 密钥是否正确
- 尝试运行 "Ping OpenRouter" 命令
- 查看输出面板 (视图 → 输出 → "kargnas - Commit AI") 的错误信息

### 生成了空的提交信息
- 插件有本地回退机制: `chore: update files`
- 检查 API 密钥是否有额度
- 尝试其他模型
- 使用 "Show Last Payload" 查看发送了什么上下文

### 生成的信息语言不对
将 `kargnas.aiCommit.commitLanguage` 设为你想要的语言代码(如 `"ko"`、`"ja"`)

## 📄 许可证

MIT © [Sangrak Choi](https://kargn.as)

## 🔗 链接

- [GitHub 仓库](https://github.com/kargnas/vscode-ext-ai-commit)
- [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=kargnas.llm-commit-message)
- [OpenRouter](https://openrouter.ai)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [作者博客](https://kargn.as)

---

**享受更智能的提交体验!** ✨
