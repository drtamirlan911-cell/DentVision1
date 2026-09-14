/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const LITERAL_COLOUR = /\btext-(white|black|gray-\d{2,3}|slate-\d{2,3})\b|\btext-\[#[0-9a-fA-F]{3,8}\]/
const SELF_FILLED = /\bbg-(?!transparent)[\w[\]#./-]+/
const HEADING_TAG = /<h[1-3]\b[^>]*>/g
const CLASS_ATTR = /class[nN]ame=(?:"[^"]*"|'[^']*'|\{`[^`]*`\}|\{[^{}]*\})/g
const INLINE_FONT_STACK = /font-\['/
const OFF_SCALE_SIZE = /text-\[\d+(px|rem)\]/
const INLINE_STYLE = /style=\{\{[^}]*\}\}/g
const INLINE_LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
const TRANSLUCENT_WASH = /\b(?:rgba|hsla)\([^)]*,\s*0?\.[0-5]\d*\s*\)/g
const SHADOW_DECL = /\bbox-?[Ss]hadow\s*:/
const FOREIGN_TOKEN = /(?<![\w-])(?:text-muted-foreground|text-primary-foreground|text-foreground|text-primary|text-destructive|bg-primary|bg-muted|bg-surface|bg-accent|border-border|border-input|ring-ring)(?![-\w])/g
const HAND_ROLLED_SPINNER = /animate-spin(?=[^"'`]*rounded-full)(?=[^"'`]*border)|rounded-full(?=[^"'`]*animate-spin)(?=[^"'`]*border-)/
const NATIVE_DIALOG = /(?<![\w$.])(?:window\.)?(?:confirm|alert|prompt)\s*\(/g

function pageFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...pageFiles(path))
    else if (entry.name.endsWith('.tsx')) found.push(path)
  }
  return found
}

function guardedFiles(): string[] {
  return [...pageFiles(resolve(ROOT, 'src/pages')), ...pageFiles(resolve(ROOT, 'src/components'))]
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function violationsFor(pattern: RegExp, predicate?: (match: RegExpMatchArray, file: string) => boolean) {
  const violations: Array<{ file: string; line: number; snippet: string }> = []
  for (const absolute of guardedFiles()) {
    const file = relative(ROOT, absolute)
    const source = readFileSync(absolute, 'utf8')
    for (const match of source.matchAll(pattern)) {
      if (predicate && !predicate(match, file)) continue
      violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: match[0].replace(/\s+/g, ' ').slice(0, 160) })
    }
  }
  return violations
}

function format(violations: Array<{ file: string; line: number; snippet: string }>): string {
  return violations.map((v) => `${v.file}:${v.line}\n    ${v.snippet}`).join('\n')
}

function themeTokens(theme: 'dark' | 'light'): Record<string, string> {
  const css = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf8')
  const start = theme === 'light' ? css.indexOf('html.light {') : css.indexOf(':root,')
  expect(start, `${theme} theme block not found`).toBeGreaterThan(-1)
  const end = css.indexOf('\n  }', start)
  const block = css.slice(start, end === -1 ? undefined : end)
  const found: Record<string, string> = {}
  for (const match of block.matchAll(/(--dv-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) found[match[1]] = match[2]
  return found
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('design tokens in page markup', () => {
  it('finds a substantial page/component surface', () => expect(guardedFiles().length).toBeGreaterThan(150))

  it('rejects literal foreground colours on page markup', () => {
    const violations = violationsFor(CLASS_ATTR, (match) => LITERAL_COLOUR.test(match[0]) && !SELF_FILLED.test(match[0]))
    expect(violations, `Use semantic design tokens:\n${format(violations)}`).toEqual([])
  })

  it('rejects raw brand gold classes', () => {
    const violations = violationsFor(/\b[\w-]+-\[#C9A96E\][^\s"'`]*/gi)
    expect(violations, `Use the dv-gold token:\n${format(violations)}`).toEqual([])
  })

  it('rejects inline font stacks', () => {
    const violations = violationsFor(new RegExp(INLINE_FONT_STACK, 'g'))
    expect(violations, `Use font-serif:\n${format(violations)}`).toEqual([])
  })

  it('rejects off-scale heading sizes', () => {
    const violations = violationsFor(HEADING_TAG, (match) => OFF_SCALE_SIZE.test(match[0]))
    expect(violations, `Use the type scale:\n${format(violations)}`).toEqual([])
  })

  it('rejects literal colours in inline styles', () => {
    const violations = violationsFor(INLINE_STYLE, (match) => {
      const body = match[0].replace(TRANSLUCENT_WASH, '').replace(SHADOW_DECL, '')
      return INLINE_LITERAL_COLOUR.test(body) && !/var\(--/.test(body)
    })
    expect(violations, `Move colours into design tokens:\n${format(violations)}`).toEqual([])
  })

  it('rejects foreign design-system colour tokens', () => {
    const violations = violationsFor(CLASS_ATTR, (match) => FOREIGN_TOKEN.test(match[0]))
    expect(violations, `Use DentVision semantic tokens:\n${format(violations)}`).toEqual([])
  })

  it('rejects hand-rolled content spinners', () => {
    const violations = violationsFor(CLASS_ATTR, (match, file) => !file.startsWith('src/components/ui/ds/') && HAND_ROLLED_SPINNER.test(match[0]))
    expect(violations, `Use Skeleton/Button loading primitives:\n${format(violations)}`).toEqual([])
  })

  it('rejects native browser dialogs', () => {
    const violations = violationsFor(NATIVE_DIALOG)
    expect(violations, `Use ConfirmModal:\n${format(violations)}`).toEqual([])
  })

  it('keeps the exception list empty after Shop cleanup', () => {
    const exceptions: Array<{ file: string; line: number }> = []
    expect(exceptions).toEqual([])
  })
})

describe('theme colour resolvers', () => {
  const load = async () => ((await import('../../tailwind.config.js' as any)) as any).default as any

  async function varBackedTokens(): Promise<Array<[string, (arg: { opacityValue?: string | number }) => string]>> {
    const config = await load()
    const found: Array<[string, (arg: { opacityValue?: string | number }) => string]> = []
    const walk = (node: unknown, prefix: string) => {
      if (typeof node === 'function') {
        found.push([prefix, node as (arg: { opacityValue?: string | number }) => string])
        return
      }
      if (!node || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) walk(value, key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key)
    }
    walk(config.theme.extend.colors, '')
    return found
  }

  it('exposes the core surface/text/border token families', async () => {
    const names = (await varBackedTokens()).map(([name]) => name)
    expect(names).toContain('surface-0')
    expect(names).toContain('txt-primary')
    expect(names).toContain('bdr-subtle')
    expect(names.length).toBeGreaterThan(10)
  })

  it('resolves opacity modifiers through color-mix', async () => {
    for (const [name, resolver] of await varBackedTokens()) {
      expect(resolver({ opacityValue: 0.5 }), name).toMatch(/^color-mix\(in srgb, var\(--dv-[\w-]+\) 50%, transparent\)$/)
    }
  })

  it('keeps plain token utilities as CSS variables', async () => {
    for (const [name, resolver] of await varBackedTokens()) {
      expect(resolver({ opacityValue: undefined }), name).toMatch(/^var\(--dv-[\w-]+\)$/)
      expect(resolver({ opacityValue: 'var(--tw-bg-opacity)' }), name).toMatch(/^var\(--dv-[\w-]+\)$/)
    }
  })
})

describe('brand accent contrast', () => {
  const AA = 4.5
  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: gold text clears AA on primary surfaces`, () => {
      const t = themeTokens(theme)
      expect(contrast(t['--dv-gold'], t['--dv-surface-0'])).toBeGreaterThanOrEqual(AA)
      expect(contrast(t['--dv-gold'], t['--dv-surface-1'])).toBeGreaterThanOrEqual(AA)
    })

    it(`${theme}: gold foreground clears AA on solid and gradient fills`, () => {
      const t = themeTokens(theme)
      expect(contrast(t['--dv-gold-on'], t['--dv-gold'])).toBeGreaterThanOrEqual(AA)
      expect(contrast(t['--dv-gold-on'], t['--dv-gold-from'])).toBeGreaterThanOrEqual(AA)
      expect(contrast(t['--dv-gold-on'], t['--dv-gold-to'])).toBeGreaterThanOrEqual(AA)
    })

    it(`${theme}: gold text clears AA on its tint`, () => {
      const t = themeTokens(theme)
      const hex = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16))
      const mix = (fg: number[], bg: number[], alpha: number) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha))
      const toHex = (values: number[]) => `#${values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
      for (const surface of ['--dv-surface-0', '--dv-surface-1']) {
        for (const alpha of [0.1, 0.15]) {
          const tint = toHex(mix(hex(t['--dv-gold']), hex(t[surface]), alpha))
          expect(contrast(t['--dv-gold'], tint)).toBeGreaterThanOrEqual(AA)
        }
      }
    })

    it(`${theme}: gold contrast ramp is monotonic`, () => {
      const t = themeTokens(theme)
      const steps = ['--dv-gold-light', '--dv-gold', '--dv-gold-dim'].map((key) => contrast(t[key], t['--dv-surface-0']))
      const ascending = steps[0] < steps[1] && steps[1] < steps[2]
      const descending = steps[0] > steps[1] && steps[1] > steps[2]
      expect(ascending || descending).toBe(true)
    })
  }
})

describe('text contrast ladder', () => {
  const AA = 4.5
  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: primary/secondary/muted clear AA on both surfaces`, () => {
      const t = themeTokens(theme)
      for (const key of ['--dv-text-primary', '--dv-text-secondary', '--dv-text-muted']) {
        for (const surface of ['--dv-surface-0', '--dv-surface-1']) expect(contrast(t[key], t[surface])).toBeGreaterThanOrEqual(AA)
      }
    })

    it(`${theme}: text emphasis ladder is monotonic`, () => {
      const t = themeTokens(theme)
      const steps = ['--dv-text-primary', '--dv-text-secondary', '--dv-text-muted', '--dv-text-ghost'].map((key) => contrast(t[key], t['--dv-surface-0']))
      for (let i = 1; i < steps.length; i += 1) expect(steps[i]).toBeLessThan(steps[i - 1])
    })
  }
})
