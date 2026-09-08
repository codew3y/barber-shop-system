// Free-text sanitization: strip HTML/tags, control chars, and excess
// whitespace. Use on every user-supplied string stored or rendered
// (notes, reasons, bios, names) — defense-in-depth behind Zod.
export function cleanText(input: string, maxLength = 2000): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function cleanOptional(input: unknown, maxLength = 2000): string | undefined {
  if (typeof input !== 'string') return undefined;
  const cleaned = cleanText(input, maxLength);
  return cleaned.length > 0 ? cleaned : undefined;
}
