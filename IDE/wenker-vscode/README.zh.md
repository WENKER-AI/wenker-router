[tiếng Việt](README.md) · [English](README.en.md) · **简体中文** · [Français](README.fr.md)

# WENKER - VS Code 模型提供方

把 **WENKER Router 的全部模型**（`http://localhost:3600`）直接引入 VS Code 的模型
列表：Chat、Copilot Edit、Agent，以及任何使用模型选择器的合作伙伴。这就是
"方案 B" 的做法：不去自己再造一个 IDE，而是依托 VS Code 的官方 API，让它成为一个
真正的模型提供方。

## 一运行就有模型

1. 启动 router：`start.bat` 或 `node server/index.js`。
2. 安装本扩展（`.vsix` 文件）。
3. 打开 Chat 面板 → 点击模型选择器 → **WENKER (local router)** 分组。

无需任何额外配置。默认情况下，扩展只显示**免费且不需要 API key 的模型**，
也就是说选上即可立即运行。

## 从 .vsix 文件安装

```
code --install-extension wenker-0.1.1.vsix --force
```

或在 VS Code 内：`Ctrl+Shift+P` → **Extensions: Install from VSIX...**

### 自检：VS Code 真的看到模型了吗？

`Ctrl+Shift+P` → **WENKER: 自检 — VS Code 当前看到多少个模型？**
该命令调用 `vscode.lm.selectChatModels({vendor:"wenker"})` —— 也就是问 **VS Code 本身**，
而不是扩展自报 —— 然后打开一个 markdown 表格，列出模型选择器实际收到的每个 id。
如果 id 数量少于扩展生成的模型数量，说明 VS Code 正因为 identifier 重复而跳过某些模型。

## 配置

| 设置项 | 默认值 | 含义 |
|---|---|---|
| `wenker.baseUrl` | `http://localhost:3600/v1` | router 的 Base URL。在其他端口/机器上运行时需修改。 |
| `wenker.modelFilter` | `free` | `no-key` = 仅不要求 API key 的模型 · `free` = 所有免费模型 · `all` = 全部 |
| `wenker.maxOutputTokens` | `4096` | 向 VS Code 声明的最大输出 token 数 |
| `wenker.maxInputTokensCap` | `128000` | 在 VS Code 内实际使用的上下文上限（见下方说明） |
| `wenker.requestTimeoutMs` | `120000` | 每个请求的最长等待时间 |
| `wenker.adminKey` | `""` | admin 角色的 API key，仅在从其他机器使用管理命令时才需要 |

### 关于 `maxInputTokensCap`

某些免费来源声称上下文可达 **1,000,000 token**（例如 `wenker-gemini-2.5-free`），
但实际上其中很多来源根本无法服务到那个量级。VS Code 用 `maxInputTokens` 来决定如何
裁剪聊天历史，因此把值声明得过大，会导致内容被**静默丢弃、不报错**。所以扩展按
`maxInputTokensCap`（默认 128K）封顶该值，并在 router 声明更大值时于 tooltip 中注明。
只有当你确信该来源真能用到那么大时，才把它调高。

## 命令

| 命令 | 作用 |
|---|---|
| `WENKER: 重新加载模型列表` | 再次调用 `/v1/models`，通知 VS Code 重绘列表 |
| `WENKER: 检查连接 + 路由` | 打开报告表格：服务器是否存活、有多少模型、哪些分组不需要 key、按探测哪些来源在线 |
| `WENKER: 安装一个 .addon 文件` | 选择 `.addon` 文件 → 调用 `POST /api/addons/install` |
| `WENKER: 列出已安装的 add-on` | 打开 router 上现有 add-on 的表格 |
| `WENKER: 打开 dashboard + Playground` | 在浏览器中打开 `http://localhost:3600` |
| `WENKER: 自检 — VS Code 当前看到多少个模型？` | 直接调用 `vscode.lm.selectChatModels()` 并打开 id 表格，用于发现被 VS Code 静默跳过的模型 |

## 工作原理（以及为什么无需配置）

扩展不保存静态模型列表。每次 VS Code 询问时，它调用 router 的 `GET /v1/models`
并按 `modelFilter` 过滤。router 新增任何 provider 或 model，这一侧都能立刻看到，
只需运行 `重新加载模型列表`。

它使用 `vscode.lm.registerLanguageModelChatProvider` 加上
`languageModelChatProviders` 贡献点 —— 这是**稳定** API，不是 proposed API，
因此无需开启任何实验性适配机制。

## 真实的局限（如实说明）

- **匿名免费来源会用尽预算**：pollinations（`wenker-*` 分组）在额度耗尽时返回
  `402 Payment Required` / "reached its budget"。这是上游的限制，不是扩展的 bug。
  用 `WENKER: 检查连接` 寻找在线来源，或通过 dashboard 自行添加
  Groq/Gemini/OpenRouter... 的免费 key，并把 `modelFilter` 改为 `all`。
- **不支持图像和 tool calling**：`capabilities.imageInput` 与 `toolCalling` 固定为
  `false`，因为 router 无法对 181 个不同来源保证完整的 function-calling。声明为
  `true` 会让 VS Code 发送上游无法读取的格式。
- **token 估算不精确**：`provideTokenCount` 使用约 4 字符/token 的近似值。
  router 不会运行各上游自己的 tokenizer。
- **远程安装 add-on 需要 admin key**：从本机访问时 guard 会放行；从其他机器则必须
  发送 `x-wenker-admin-key`（扩展需要时会主动询问）。

## 为什么某些模型命名为 `provider/模型名`

VS Code 用 `vendor/id`（或 `vendor/group/id`）字符串来标识每个模型，并会**静默跳过**
identifier 与已注册模型重复的那些 —— 窗口日志会打印
`[LM] Model wenker/default is already registered. Skipping.`。

而 router 有 6 个本地 provider（vllm、sglang、aphrodite、xinference、
openwebui-proxy、openllm/llamacpp）都把模型命名为 `default`。若保留裸名，6 个模型
在选择器里只会剩下 1 个。因此扩展会自动把冲突的模型重命名为 `provider/id`，
例如 `llamacpp/default`。

有两点需要如实说明：

- router 接受 `provider/id` 这种标识名（对 `wenker-cloud/wenker-deepseek-r1-free`
  的 `POST /v1/chat/completions` 返回 200）。
- `*/default` 分组只是**出现在列表中**以求完整；如果你没有在 `localhost:8000/4000/...`
  上运行对应 runtime，实际调用会失败。这是事实，不是路由 bug。
