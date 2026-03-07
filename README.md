# aiciba

AI-powered English-Chinese dictionary in your terminal.

## Install

```bash
npm install -g aiciba
```

## Usage

```bash
ciba <word>       # look up a word
ciba -l           # browse history
ciba --config     # change provider / model / API key
ciba --clear      # clear history
ciba --version    # show version
```

On first run, you'll be prompted to choose a provider (Anthropic, OpenAI, or Google Gemini) and enter your API key.

## Supported Providers

| Provider  | Models                                                        |
| --------- | ------------------------------------------------------------- |
| Anthropic | claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-6 |
| OpenAI    | gpt-5-mini-2025-08-07, gpt-5.4-pro-2026-03-05                 |
| Gemini    | gemini-3.1-flash-lite-preview, gemini-3.1-pro-preview         |

## License

MIT

---

*Inspired by [iCIBA (爱词霸)](https://www.iciba.com), the dictionary that accompanied a generation of Chinese English learners.*
