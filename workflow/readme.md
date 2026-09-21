## AICIBA

A dictionary between any two languages, in Alfred.

### Usage

- `c word` — look up a word. Either configured language works: type one in the definition language and you get its headword back.
- `c` alone — browse recent lookups.
- Set a **Hotkey**, or use the **Universal Action**, to look up selected text anywhere.

An entry opens with the word itself, then one row per part of speech:

| | |
| --- | --- |
| <kbd>↩</kbd> on the word | Hear it pronounced |
| <kbd>↩</kbd> on a meaning | Copy that part of speech's meanings |
| <kbd>⌥</kbd><kbd>↩</kbd> | Pronounce, from any row |
| <kbd>⌘</kbd><kbd>C</kbd> on the word | Copy the whole entry |
| <kbd>⌘</kbd><kbd>L</kbd> | Show the whole entry in Large Type |

Alfred stays open when you play or copy, so hearing a word does not dismiss what you were reading — <kbd>⎋</kbd> closes it.

Typing costs nothing: rows come from the cache. A source is consulted only when you press <kbd>↩</kbd> on *Look up …* — a curated dictionary for the pair it ships with, about half a second, with IPA and real bilingual examples; your AI provider for every other pair, and for anything unlisted. Misspellings come back as suggestions, with no model call at all. Answers are shared with the `ciba` command line tool, so a word looked up in either is instant in the other.

Pronunciation is a real recording wherever one exists — a dozen languages, American or British for English (**Accent**) — cached after the first play, with macOS speech covering the rest.

### Setup

Everything here mirrors `ciba --config`: leave a field empty and the workflow follows the CLI's provider, model, key and language pair. Set **Look Up** and **Define In** to point Alfred at a different dictionary than the terminal.

**Keyword** changes `c` if it collides with something. Keep **Model** small — a dictionary entry is recall, not reasoning: about two seconds on `gpt-5.4-mini`, over a minute and a half on `gpt-5.4-pro`.

Needs Node.js 18 or newer. Alfred does not see the PATH your shell sets up, so if it cannot find yours, run `which node` and paste the path into **Node Path**.
