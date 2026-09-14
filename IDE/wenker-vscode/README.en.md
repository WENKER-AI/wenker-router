[tiếng Việt](README.md) · **English** · [简体中文](README.zh.md) · [Français](README.fr.md)

# WENKER - VS Code model provider

Brings **every WENKER Router model** (`http://localhost:3600`) directly into the
VS Code model list: Chat, Copilot Edit, Agent, and every partner that uses the
model picker. This is the "approach B" way of doing things: rather than building
yet another IDE from scratch, it hooks into VS Code's official API so that it
becomes a real model provider.

## Models available as soon as it runs

1. Start the router: `start.bat` or `node server/index.js`.
2. Install this extension (the `.vsix` file).
3. Open the Chat panel → click the model picker → the **WENKER (local router)** group.

No further configuration is needed. By default the extension only shows
**free models that require no API key**, meaning you can pick one and run immediately.

## Installing from a .vsix file

```
code --install-extension wenker-0.1.1.vsix --force
```

Or inside VS Code: `Ctrl+Shift+P` → **Extensions: Install from VSIX...**

### Self-check: does VS Code actually see the models?

`Ctrl+Shift+P` → **WENKER: Self-check — how many models does VS Code see?**
This command calls `vscode.lm.selectChatModels({vendor:"wenker"})` — i.e. it asks
**VS Code itself**, not the extension's own report — then opens a markdown table
listing every id the model picker receives. If the number of ids is lower than the
number of models the extension generates, it means VS Code is skipping models
because of duplicate identifiers.

## Configuration

| Setting | Default | Meaning |
|---|---|---|
| `wenker.baseUrl` | `http://localhost:3600/v1` | The router's base URL. Change it when running on a different port/machine. |
| `wenker.modelFilter` | `free` | `no-key` = only models that don't require an API key · `free` = all free models · `all` = everything |
| `wenker.maxOutputTokens` | `4096` | Maximum output tokens declared to VS Code |
| `wenker.maxInputTokensCap` | `128000` | Context ceiling actually used inside VS Code (see note below) |
| `wenker.requestTimeoutMs` | `120000` | Maximum wait time per request |
| `wenker.adminKey` | `""` | Admin-role API key, only needed when using admin commands from another machine |

### About `maxInputTokensCap`

Some free sources declare a context of up to **1,000,000 tokens** (for example
`wenker-gemini-2.5-free`), but in practice many of them cannot actually serve that
much. VS Code uses `maxInputTokens` to decide how to truncate chat history, so
declaring too large a value causes content to be lost **silently, with no error**.
The extension therefore caps the value at `maxInputTokensCap` (default 128K) and
notes it clearly in the tooltip when the router declares something larger. Raise it
only when you are certain that source really works at that size.

## Commands

| Command | Purpose |
|---|---|
| `WENKER: Reload model list` | Calls `/v1/models` again and tells VS Code to redraw the list |
| `WENKER: Check connection + routing` | Opens a report table: is the server alive, how many models, which groups need no key, which sources are live per probe |
| `WENKER: Install a .addon file` | Pick a `.addon` file → calls `POST /api/addons/install` |
| `WENKER: List installed add-ons` | Opens a table of the add-ons currently on the router |
| `WENKER: Open dashboard + Playground` | Opens `http://localhost:3600` in the browser |
| `WENKER: Self-check — how many models does VS Code see?` | Directly calls `vscode.lm.selectChatModels()` and opens an id table, used to detect models VS Code silently skips |

## How it works (and why no configuration is needed)

The extension does not store a static model list. Each time VS Code asks, it calls
the router's `GET /v1/models` and filters by `modelFilter`. Whenever the router adds
a provider or model, this side sees it right away — you only need to run
`Reload model list`.

It uses `vscode.lm.registerLanguageModelChatProvider` plus the
`languageModelChatProviders` contribution point — a **stable** API, not a proposed
API, so no experimental-adaptation mechanism has to be enabled.

## Real limitations (stated plainly)

- **Anonymous free sources run out of budget**: pollinations (the `wenker-*` group)
  returns `402 Payment Required` / "reached its budget" when the quota is gone. That
  is an upstream limit, not an extension bug. Use `WENKER: Check connection` to find
  live sources, or add your own free keys for Groq/Gemini/OpenRouter... via the
  dashboard and switch `modelFilter` to `all`.
- **No image or tool-calling support**: `capabilities.imageInput` and `toolCalling`
  are hard-coded to `false`, because the router cannot guarantee complete
  function-calling across 181 different sources. Declaring `true` would make VS Code
  send a format the upstream cannot read.
- **Token estimation is approximate**: `provideTokenCount` uses a rough 4
  chars/token ratio. The router does not run each upstream's own tokenizer.
- **Remote add-on install needs an admin key**: from the local machine the guard lets
  it through; from another machine you must send `x-wenker-admin-key` (the extension
  prompts for it when needed).

## Why some models are named `provider/model-name`

VS Code identifies each model by a `vendor/id` (or `vendor/group/id`) string and
**silently skips** any model whose identifier duplicates one registered earlier —
the window log prints `[LM] Model wenker/default is already registered. Skipping.`.

The router, however, has 6 local providers (vllm, sglang, aphrodite, xinference,
openwebui-proxy, openllm/llamacpp) that all name their model `default`. Keeping the
bare name would leave only 1 of those 6 models in the picker. The extension therefore
automatically renames the colliding models to `provider/id`, for example
`llamacpp/default`.

Two points worth stating plainly:

- The router accepts the `provider/id` form (`POST /v1/chat/completions` returns 200
  for `wenker-cloud/wenker-deepseek-r1-free`).
- The `*/default` group only **appears in the list** for completeness; an actual call
  will fail if you are not running that runtime on `localhost:8000/4000/...`. That is
  the truth of the matter, not a routing bug.
