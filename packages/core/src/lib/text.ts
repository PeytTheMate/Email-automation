export function normalizeWhitespace(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function lines(input: string) {
  return normalizeWhitespace(input)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function containsAny(haystack: string, patterns: string[]) {
  const lowered = haystack.toLowerCase();
  return patterns.some((pattern) => lowered.includes(pattern));
}

export function sentenceCase(input: string) {
  if (!input) {
    return input;
  }

  return input.charAt(0).toUpperCase() + input.slice(1);
}
