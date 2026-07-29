const PROHIBITED_PATTERNS: RegExp[] = [
  /[\s\S]*?(?:how\s+to\s+(?:hack|bomb|make\s+(?:drug|explosive|weapon)))/i,
  /[\s\S]*?(?:инструкци[яю].*?(?:взлом|наркотик|оружие|бомб))/i,
  /(?:SYSADMIN|OVERRIDE|IGNORE ALL|DISREGARD|NEW INSTRUCTION)[^.]*?(?:instruction|prompt|rule|system)/i,
  /(?:ты\s+теперь|отныне\s+ты|забудь\s+все|игнорируй\s+все\s+предыдущие|новые\s+инструкции)/i,
];

export function moderateContent(text: string): { flagged: boolean; categories: string[] } {
  const input = String(text || '');
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(input)) {
      return { flagged: true, categories: ['prohibited_content'] };
    }
  }
  return { flagged: false, categories: [] };
}

export function validateToolArgs(args: Record<string, any>, schema: Record<string, string>): boolean {
  if (typeof args !== 'object' || args === null) return false;
  for (const [key, expectedType] of Object.entries(schema)) {
    if (key in args) {
      const value = args[key];
      switch (expectedType) {
        case 'string':
          if (typeof value !== 'string') return false;
          break;
        case 'number':
          if (typeof value !== 'number' || !Number.isFinite(value)) return false;
          break;
        case 'boolean':
          if (typeof value !== 'boolean') return false;
          break;
        case 'array':
          if (!Array.isArray(value)) return false;
          break;
        case 'object':
          if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
          break;
      }
    }
  }
  return true;
}
