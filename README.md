<div align="center">

<img src="https://raw.githubusercontent.com/EvaLLLLL/aiciba/main/assets/banner.png" alt="aiciba — a dictionary between any two languages" width="760">

<p>
  <a href="https://www.npmjs.com/package/aiciba"><img alt="npm" src="https://img.shields.io/npm/v/aiciba?color=f07cc1&labelColor=2b2b38&logo=npm&logoColor=white"></a>
  <a href="https://github.com/EvaLLLLL/aiciba/releases/latest"><img alt="Alfred workflow" src="https://img.shields.io/github/v/release/EvaLLLLL/aiciba?color=f07cc1&labelColor=2b2b38&label=alfred%20workflow"></a>
  <a href="https://github.com/EvaLLLLL/aiciba/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/EvaLLLLL/aiciba/ci.yml?branch=main&labelColor=2b2b38"></a>
  <img alt="node" src="https://img.shields.io/node/v/aiciba?color=5ee9a6&labelColor=2b2b38">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/npm/l/aiciba?color=6fd8e8&labelColor=2b2b38"></a>
</p>

<p><b>Look a word up without leaving what you were doing.</b><br>
A curated dictionary answers in about half a second; AI covers everything it has never heard of.</p>

</div>

<br>

<img src="https://raw.githubusercontent.com/EvaLLLLL/aiciba/main/assets/demo.png" alt="ciba printing a definition with phonetics, senses and an example sentence" width="100%">

## Install

### Terminal

```bash
npm install -g aiciba
```

### Alfred

Download **`AICIBA.alfredworkflow`** from the [releases](https://github.com/EvaLLLLL/aiciba/releases) page, then double-click the file to import it.

## Usage

```bash
ciba <word>       # look up a word
ciba -l           # browse history
ciba --config     # languages, provider, model, API key
ciba --clear      # clear history
ciba --version    # show version
ciba --help       # show all commands
```

`ciba --config` sets the pair — any two languages the model knows. **Either one works at the prompt:** with a Japanese–English dictionary, `ciba gratitude` returns 感謝.

## How a lookup is answered

|                      | takes   | covers                                                                           |
| :------------------- | :------ | :------------------------------------------------------------------------------- |
| **cache**            | instant | anything looked up before                                                        |
| **dictionary**       | ~0.5s   | the pair it ships with — IPA, distinct senses, bilingual examples, spelling corrections |
| **your AI provider** | ~2s     | every other pair, and words no dictionary lists                                         |

The dictionary is Youdao's public endpoint — no key, but not a published API either, so any pair it does not carry, and anything it refuses, falls through to the model.

Everything lands in `~/.aiciba`: one history per pair, 500 words each. `AICIBA_HOME` moves it; `AICIBA_API_KEY`, `AICIBA_PROVIDER`, `AICIBA_MODEL`, `AICIBA_ENTRY_LANGUAGE` and `AICIBA_DEFINITION_LANGUAGE` override the stored config — how the workflow passes its own settings.

## In Alfred

`c <word>` looks up, `c` alone browses history, and a Hotkey or Universal Action looks up selected text. Typing only reads the cache — nothing is fetched until <kbd>↩</kbd> on *Look up …*.

|                                                                          |                                          |
| :----------------------------------------------------------------------- | :--------------------------------------- |
| <kbd>↩</kbd> on the word                                                 | play the pronunciation                   |
| <kbd>↩</kbd> on a meaning                                                | copy those meanings                      |
| <kbd>↩</kbd> on a history row                                            | open that entry, in place                |
| <kbd>⌥</kbd><kbd>↩</kbd>                                                 | play the pronunciation, from any row     |
| <kbd>⌘</kbd><kbd>C</kbd> on the word / <kbd>⌘</kbd><kbd>L</kbd> anywhere | the whole entry, copied or in Large Type |

Alfred stays open when you play or copy — <kbd>⎋</kbd> dismisses it. Pronunciation is a real recording where one exists (a dozen languages, American or British for English), cached after the first play, with macOS speech covering the rest.

Its Configuration mirrors `ciba --config`; leave a field empty to follow the CLI. Needs Node 18+, and Alfred ignores your shell's PATH — paste `which node` into **Node Path** if it cannot find yours.

## Supported providers

| Provider      | Models                                                            |
| :------------ | :---------------------------------------------------------------- |
| **Anthropic** | `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-4-8` |
| **OpenAI**    | `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.6`                         |
| **Gemini**    | `gemini-3.8-flash`, `gemini-3.1-pro-preview`                      |

Pick a small one: a dictionary entry is recall, not reasoning. `gpt-5.4-mini` answers in ~2s, `gpt-5.4-pro` in over a minute and a half — for the same three lines.

## Development

```bash
pnpm dev <word>        # run the CLI from source
pnpm test              # 53 tests
pnpm build:workflow    # → dist-workflow/AICIBA.alfredworkflow
```

`src/core` is the dictionary — cache, sources, config, languages; `src/cli` the `ciba` command; `src/alfred` the workflow's two entry points; `workflow` what gets packaged.

## License

MIT

<div align="center">
<br>
<sub>Inspired by <a href="https://www.iciba.com">iCIBA (爱词霸)</a>, the dictionary that accompanied a generation of Chinese English learners.</sub>
</div>
