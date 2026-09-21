/**
 * Strips what cannot be part of a word while keeping every script: letters,
 * the marks that modify them, digits and the punctuation that lives inside
 * words. A dictionary that can be pointed at any language cannot assume Latin
 * and Han.
 */
export function sanitize(input: string): string {
  // Trimmed last so the result is stable under a second pass: stripping "!"
  // from "hello ! " would otherwise leave a trailing space behind.
  return input.replace(/[^\p{L}\p{M}\s'’\-]/gu, '').trim()
}
