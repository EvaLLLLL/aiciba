# aiciba

A dictionary between any two languages, in your terminal and in Alfred.

## Install

```bash
npm install -g aiciba
```

## Usage

```bash
ciba <word>       # look up a word
ciba -l           # browse history
ciba --config     # languages, provider, model, API key
ciba --clear      # clear history
ciba --version    # show version
ciba --help       # show all commands
```

`ciba --config` asks which language you look words up in and which language definitions are written in — any language the model knows, whether or not it is on the list. Either one works at the prompt: with a Japanese–English dictionary configured, `ciba gratitude` returns the entry for 感謝.

## How a lookup is answered

| | takes | covers |
| --- | --- | --- |
| cache | instant | anything looked up before |
| dictionary | ~0.5s | English↔Chinese — IPA, distinct senses, bilingual examples, spelling corrections |
| your AI provider | ~2s | every other language pair, and words no dictionary lists |

The dictionary is Youdao's public endpoint: no key, but not a published API either, so anything it refuses falls through to the model.

Everything lands in `~/.aiciba` — one history per language pair, 500 words each. `AICIBA_HOME` moves it. `AICIBA_API_KEY`, `AICIBA_PROVIDER`, `AICIBA_MODEL`, `AICIBA_ENTRY_LANGUAGE` and `AICIBA_DEFINITION_LANGUAGE` override the stored config, which is how the Alfred workflow passes its own settings.

## Alfred workflow

Alfred 5 with Powerpack. Download `AICIBA.alfredworkflow` from
[Releases](https://github.com/EvaLLLLL/aiciba/releases) and double-click it, or
build your own:

```bash
pnpm build:workflow
```

`c <word>` looks up, `c` alone browses history, and a Hotkey or Universal Action looks up selected text. Typing only reads the cache; a source is consulted when you press <kbd>↩</kbd> on *Look up …*.

| | |
| --- | --- |
| <kbd>↩</kbd> on the word | play the pronunciation |
| <kbd>↩</kbd> on a meaning | copy those meanings |
| <kbd>⌥</kbd><kbd>↩</kbd> | play the pronunciation, from any row |
| <kbd>⌘</kbd><kbd>C</kbd> on the word / <kbd>⌘</kbd><kbd>L</kbd> anywhere | the whole entry, copied or in Large Type |

Alfred stays open when you play or copy, so <kbd>⎋</kbd> dismisses it.

Its Configuration mirrors `ciba --config`; leave a field empty to follow the CLI. The workflow bundles everything but Node 18+ — and Alfred runs scripts without your shell's PATH, so paste `which node` into **Node Path** if it cannot find yours.

## Supported providers

| Provider  | Models                                                      |
| --------- | ----------------------------------------------------------- |
| Anthropic | claude-haiku-4-5-20251001, claude-sonnet-5, claude-opus-4-8 |
| OpenAI    | gpt-5.4-mini, gpt-5.4-nano, gpt-5.6                         |
| Gemini    | gemini-3.8-flash, gemini-3.1-pro-preview                    |

Pick a small one: a dictionary entry is recall, not reasoning. `gpt-5.4-mini` answers in about two seconds, `gpt-5.4-pro` in over a minute and a half — for the same three lines.

## Layout

| | |
| --- | --- |
| `src/core` | the dictionary itself — cache, sources, config, languages |
| `src/cli` | the `ciba` command |
| `src/alfred` | the workflow's two entry points: script filter and lookup |
| `workflow` | what gets packaged — info.plist, shell wrappers, icon |

## License

MIT

---

*Inspired by [iCIBA (爱词霸)](https://www.iciba.com), the dictionary that accompanied a generation of Chinese English learners.*
