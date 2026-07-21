/** DentVision money is KZT. Soft-correct LLM slips into rubles. */
export function preferTengeCurrency(text: string): string {
  if (!text) return text;
  return text
    .replace(/(\d[\d\s.,]*)\s*₽/g, '$1 ₸')
    .replace(/(\d[\d\s.,]*)\s*RUB\b/gi, '$1 ₸')
    .replace(/(\d[\d\s.,]*)\s*руб(?:л(?:ей|я|ь)?)?\b/gi, '$1 ₸')
    .replace(/\bв рублях\b/gi, 'в тенге')
    .replace(/\bрубл(?:ей|я|ь)\b/gi, 'тенге');
}
