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
  'text-muted-foreground', 'text-primary-foreground', 'text-foreground', 'text-primary', 'text-destructive',
  'bg-primary', 'bg-muted', 'bg-surface', 'bg-accent', 'border-border', 'border-input', 'ring-ring',
].join('|') + ')(?![-\\w])')
const HAND_ROLLED_SPINNER = /animate-spin(?=[^"'`]*rounded-full)(?=[^"'`]*border)|rounded-full(?=[^"'`]*animate-spin)(?=[^"'`]*border-)/
const NATIVE_DIALOG = /(?<![\w$.])(?:window\.)?(?:confirm|alert|prompt)\s*\(/

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
    expect(violations, `Use font-serif:\n${format(violations)}`).toEqual([]
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
    expect(violations, `Use ds/Skeleton:\n${format(violations)}`).toEqual([])
  })
  it('uses ConfirmModal, not a browser dialog', () => {
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute), source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(new RegExp(NATIVE_DIALOG, 'g'))) violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: source.split('\n')[lineOf(source, match.index ?? 0) - 1].trim() })
    }
    expect(violations, `Use ConfirmModal:\n${format(violations)}`).toEqual([]
  })
})
