/** DentVision money is KZT. Soft-correct LLM slips into rubles. */
export function preferTengeCurrency(text: string): string {
  if (!text) return text;
  // Digits with internal spaces/separators, optional compact suffix (2.4М / 450К).
  const amount = String.raw`(\d+(?:[\s.,]\d+)*(?:[KkКкMmМм])?)`;
  return text
    .replace(new RegExp(`${amount}\\s*₽`, 'g'), '$1 ₸')
    .replace(new RegExp(`${amount}\\s*RUB\\b`, 'gi'), '$1 ₸')
    // Avoid \\b with Cyrillic — JS word boundaries are ASCII-only.
    .replace(new RegExp(`${amount}\\s*руб(?:л(?:ей|я|ь))?\\.?`, 'gi'), '$1 ₸')
    .replace(/в рублях/gi, 'в тенге')
    .replace(/рубл(?:ей|я|ь)/gi, 'тенге');
}
