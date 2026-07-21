/** DentVision money is KZT. Soft-correct LLM slips into rubles. */
export function preferTengeCurrency(text: string): string {
  if (!text) return text;
  return text
    .replace(/(\d[\d\s.,]*)\s*₽/g, '$1 ₸')
    .replace(/(\d[\d\s.,]*)\s*RUB\b/gi, '$1 ₸')
    // Avoid \b with Cyrillic — JS word boundaries are ASCII-only.
    .replace(/(\d[\d\s.,]*)\s*руб(?:л(?:ей|я|ь))?\.?/gi, '$1 ₸')
    .replace(/в рублях/gi, 'в тенге')
    .replace(/рубл(?:ей|я|ь)/gi, 'тенге');
}
