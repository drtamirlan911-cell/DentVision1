import { describe, expect, it } from 'vitest';
import { stripHtmlTags } from './helpers.js';

describe('stripHtmlTags', () => {
  it('removes a script tag and its wrapping angle brackets', () => {
    expect(stripHtmlTags('<script>alert("xss")</script>')).not.toContain('<script>');
    expect(stripHtmlTags('<script>alert("xss")</script>')).not.toContain('</script>');
  });

  it('removes any HTML tag, keeping the text content', () => {
    expect(stripHtmlTags('<b>Ivan</b>')).toBe('Ivan');
    expect(stripHtmlTags('Ivan <img src=x onerror=alert(1)>')).toBe('Ivan');
  });

  it('leaves plain text untouched', () => {
    expect(stripHtmlTags("O'Brien-Smith")).toBe("O'Brien-Smith");
    expect(stripHtmlTags('García-López')).toBe('García-López');
  });

  it('trims surrounding whitespace and handles empty/nullish input', () => {
    expect(stripHtmlTags('  Ivan  ')).toBe('Ivan');
    expect(stripHtmlTags('')).toBe('');
    expect(stripHtmlTags(undefined)).toBe('');
    expect(stripHtmlTags(null)).toBe('');
  });
});
