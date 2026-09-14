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
const FOREIGN_TOKEN = new RegExp('(?<![\\w-])(?:' + [
  'text-muted-foreground', 'text-primary-foreground', 'text-foreground',
  'text-primary', 'text-destructive', 'bg-primary', 'bg-muted', 'bg-surface', 'bg-accent',
  'border-border', 'border-input', 'ring-ring',
].join('|') + ')(?![-\\w])')
const HAND_ROLLED_SPINNER = /animate-spin(?=[^"'`]*rounded-full)(?=[^"'`]*border)|rounded-full(?=[^"'`]*animate-spin)(?=[^"'`]*border-)/
const NATIVE_DIALOG = /(?<![\w$.])(?:window\.)?(?:confirm|alert|prompt)\s*\(/g

const ALLOWED_LITERAL_HEADINGS: Array<{ file: string; line: number; why: string }> = []
const ALLOWED_INLINE_COLOURS: Array<{ file: string; line: number; why: string }> = []

function pageFiles(dir = resolve(ROOT, 'src/pages')): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...pageFiles(path))
    else if (entry.name.endsWith('.tsx')) found.push(path)
  }
  return found
}
function lineOf(source: string, index: number): number { return source.slice(0, index).split('\n').length }
interface Violation { file: string; line: number; snippet: string }
function format(violations: Violation[]): string { return violations.map((v) => `${v.file}:${v.line}\n    ${v.snippet}`).join('\n') }

describe('design tokens in page markup', () => {
  const files = [...pageFiles(), ...pageFiles(resolve(ROOT, 'src/components'))]
  it('finds the files it is supposed to be guarding', () => expect(files.length).toBeGreaterThan(150))
  it('paints every piece of text with a token, not a literal colour', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(CLASS_ATTR)) {
        const cls = match[0]
        if (!LITERAL_COLOUR.test(cls) || SELF_FILLED.test(cls)) continue
        const line = lineOf(source, match.index ?? 0)
        if (ALLOWED_LITERAL_HEADINGS.some((a) => a.file === file && a.line === line)) continue
        violations.push({ file, line, snippet: cls.replace(/\s+/g, ' ').slice(0, 140) })
      }
    }
    expect(violations, `Use semantic design tokens:\n${format(violations)}`).toEqual([])
  })
  it('never writes the brand gold as a raw hex', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(/\b[\w-]+-\[#C9A96E\][^\s"'`]*/gi)) violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: match[0] })
    }
    expect(violations, `Use the dv-gold token:\n${format(violations)}`).toEqual([])
  })
  it('never inlines a font stack in place of the font-serif token', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(new RegExp(INLINE_FONT_STACK, 'g'))) {
        const line = lineOf(source, match.index ?? 0); violations.push({ file, line, snippet: source.split('\n')[line - 1].trim().slice(0, 140) })
      }
    }
    expect(violations, `Use font-serif:\n${format(violations)}`).toEqual([])
  })
  it('sizes every heading from the type scale', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(HEADING_TAG)) if (OFF_SCALE_SIZE.test(match[0])) violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: match[0].replace(/\s+/g, ' ').slice(0, 140) })
    }
    expect(violations, `Use the type scale:\n${format(violations)}`).toEqual([]
  })
  it('never paints a colour through an inline style', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(INLINE_STYLE)) {
        const body = match[0].replace(TRANSLUCENT_WASH, '').replace(SHADOW_DECL, '')
        if (!INLINE_LITERAL_COLOUR.test(body) || /var\(--/.test(body)) continue
        const line = lineOf(source, match.index ?? 0)
        if (ALLOWED_INLINE_COLOURS.some((a) => a.file === file && a.line === line)) continue
        violations.push({ file, line, snippet: body.replace(/\s+/g, ' ').slice(0, 140) })
      }
    }
    expect(violations, `Move colours into design tokens:\n${format(violations)}`).toEqual([])
  })
  it('keeps the exception list honest', () => {
    for (const allowed of ALLOWED_LITERAL_HEADINGS) {
      const source = readFileSync(resolve(ROOT, allowed.file), 'utf8'), line = source.split('\n')[allowed.line - 1] ?? ''
      expect(LITERAL_COLOUR.test(line), `${allowed.file}:${allowed.line} no longer has a literal-coloured heading`).toBe(true)
      expect(allowed.why.length).toBeGreaterThan(20)
    }
  })
  it('never names a colour token that does not exist', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(CLASS_ATTR)) if (FOREIGN_TOKEN.test(match[0])) violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: match[0].replace(/\s+/g, ' ').slice(0, 140) })
    }
    expect(violations, `These classes resolve to nothing:\n${format(violations)}`).toEqual([])
  })
  it('shows loading through Skeleton, not a hand-built spinner', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute); if (file.startsWith('src/components/ui/ds/')) continue
      const source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(CLASS_ATTR)) if (HAND_ROLLED_SPINNER.test(match[0])) violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: match[0].replace(/\s+/g, ' ').slice(0, 140) })
    }
    expect(violations, `Use Skeleton / CardSkeleton / ListSkeleton for content, or Button loading:\n${format(violations)}`).toEqual([])
  })
  it('asks for confirmation through ConfirmModal, not a browser dialog', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(NATIVE_DIALOG)) violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: source.slice(match.index ?? 0, (match.index ?? 0) + 90).split('\n')[0] })
    }
    expect(violations, `Use ConfirmModal:\n${format(violations)}`).toEqual([])
  })
})

describe('theme colours honour an opacity modifier', () => {
  const load = async () => ((await import('../../tailwind.config.js' as any)) as any).default as { theme: { extend: { colors: Record<string, unknown> } } }
  type Resolver = (arg: { opacityValue?: string | number }) => string
  async function varBackedTokens(): Promise<Array<[string, Resolver]>> {
    const config = await load(); const found: Array<[string, Resolver]> = []
    const walk = (node: unknown, prefix: string) => {
      if (typeof node === 'function') { found.push([prefix, node as Resolver]); return }
      if (!node || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) walk(value, key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key)
    }
    walk(config.theme.extend.colors, ''); return found
  }
  it('routes the surface, text and border families through the resolver', async () => {
    const names = (await varBackedTokens()).map(([name]) => name)
    expect(names).toContain('surface-0'); expect(names).toContain('txt-primary'); expect(names).toContain('bdr-subtle'); expect(names.length).toBeGreaterThan(10)
  })
  it('produces a real colour for a written modifier', async () => {
    for (const [name, resolve_] of await varBackedTokens()) expect(resolve_({ opacityValue: 0.5 }), name).toMatch(/^color-mix\(in srgb, var\(--dv-[\w-]+\) 50%, transparent\)$/)
  })
  it('leaves the plain utility as a bare var', async () => {
    for (const [name, resolve_] of await varBackedTokens()) {
      expect(resolve_({ opacityValue: undefined }), name).toMatch(/^var\(--dv-[\w-]+\)$/)
      expect(resolve_({ opacityValue: 'var(--tw-bg-opacity)' }), name).toMatch(/^var\(--dv-[\w-]+\)$/)
    }
  })
})

describe('the brand accent is readable in both themes', () => {
  const AA_TEXT = 4.5
  function relativeLuminance(hex: string): number {
    const h = hex.replace('#', ''), channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  function contrast(a: string, b: string): number { const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
  function tokens(theme: 'dark' | 'light'): Record<string, string> {
    const css = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf8'), start = theme === 'light' ? css.indexOf('html.light {') : css.indexOf(':root,')
    expect(start, `${theme} theme block not found`).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('\n  }', start)), found: Record<string, string> = {}
    for (const m of block.matchAll(/(--dv-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) found[m[1]] = m[2]
    return found
  }
  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: gold text clears AA on the page and on a card`, () => { const t = tokens(theme); expect(contrast(t['--dv-gold'], t['--dv-surface-0'])).toBeGreaterThanOrEqual(AA_TEXT); expect(contrast(t['--dv-gold'], t['--dv-surface-1'])).toBeGreaterThanOrEqual(AA_TEXT) })
    it(`${theme}: the foreground on a solid gold fill clears AA`, () => { const t = tokens(theme); expect(contrast(t['--dv-gold-on'], t['--dv-gold'])).toBeGreaterThanOrEqual(AA_TEXT); expect(contrast(t['--dv-gold-on'], t['--dv-gold-from'])).toBeGreaterThanOrEqual(AA_TEXT); expect(contrast(t['--dv-gold-on'], t['--dv-gold-to'])).toBeGreaterThanOrEqual(AA_TEXT) })
    it(`${theme}: gold text clears AA on its own tint, not just on bare surfaces`, () => {
      const t = tokens(theme), hex = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16)), toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), mix = (fg: number[], bg: number[], a: number) => fg.map((v, i) => v * a + bg[i] * (1 - a))
      for (const surface of ['--dv-surface-0', '--dv-surface-1']) for (const alpha of [0.1, 0.15]) { const tint = toHex(mix(hex(t['--dv-gold']), hex(t[surface]), alpha)); expect(contrast(t['--dv-gold'], tint)).toBeGreaterThanOrEqual(AA_TEXT) }
    })
    it(`${theme}: the gold ramp is monotonic`, () => { const t = tokens(theme), steps = ['--dv-gold-light', '--dv-gold', '--dv-gold-dim'].map((k) => contrast(t[k], t['--dv-surface-0'])); expect(steps[0] < steps[1] && steps[1] < steps[2] || steps[0] > steps[1] && steps[1] > steps[2]).toBe(true) })
  }
})

describe('the text ladder is readable in both themes', () => {
  const AA_TEXT = 4.5
  function luminance(hex: string): number { const h = hex.replace('#', ''), ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] }
  function contrast(a: string, b: string): number { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
  function themeTokens(theme: 'dark' | 'light'): Record<string, string> { const css = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf8'), start = theme === 'light' ? css.indexOf('html.light {') : css.indexOf(':root,'); const block = css.slice(start, css.indexOf('\n  }', start)), found: Record<string, string> = {}; for (const m of block.matchAll(/(--dv-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) found[m[1]] = m[2]; return found }
  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: primary, secondary and muted all clear AA on both surfaces`, () => { const t = themeTokens(theme); for (const key of ['--dv-text-primary', '--dv-text-secondary', '--dv-text-muted']) for (const surface of ['--dv-surface-0', '--dv-surface-1']) expect(contrast(t[key], t[surface])).toBeGreaterThanOrEqual(AA_TEXT) })
    it(`${theme}: the emphasis ladder does not double back`, () => { const t = themeTokens(theme), steps = ['--dv-text-primary', '--dv-text-secondary', '--dv-text-muted', '--dv-text-ghost'].map((k) => contrast(t[k], t['--dv-surface-0'])); for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]) })
  }
})
