/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Design-token guard.
 *
 * Consistency across ~90 page files is not something review catches reliably —
 * it is caught once, drifts back, and gets caught again. The status vocabulary
 * and the page-parity table both stopped rotting the moment a test asserted
 * them, so the same treatment applies here.
 *
 * The rules below are deliberately narrow. They cover the two things that were
 * measurably *broken*, not everything one could have an opinion about:
 *
 *  1. A heading painted with a literal colour follows one theme and ignores the
 *     other. Every page that did this was dark-only by accident.
 *  2. An inline `font-['Georgia',serif]` stack silently opts out of the brand
 *     face — the `font-serif` token is `Playfair Display, Georgia, serif`, so
 *     those pages were rendering in a different typeface from everything else.
 *
 * What is *not* a violation: a literal colour on a saturated fill. `text-white`
 * on `bg-success` is correct precisely because the fill does not follow the
 * theme either — a token there would put graphite on green in light mode. The
 * heading rule therefore ignores tags that carry their own `bg-` class, and the
 * one heading that inherits a fill from its parent is listed explicitly below.
 */

/** vitest.config.ts sits at the repo root, so that is the working directory. */
const ROOT = process.cwd()

/** A colour that will not follow the theme. */
const LITERAL_COLOUR = /\btext-(white|black|gray-\d{2,3}|slate-\d{2,3})\b|\btext-\[#[0-9a-fA-F]{3,8}\]/
/** The tag paints its own background, so its foreground is not theme-bound. */
const SELF_FILLED = /\bbg-(?!transparent)[\w[\]#./-]+/
const HEADING_TAG = /<h[1-3]\b[^>]*>/g
const INLINE_FONT_STACK = /font-\['/
/** A heading size that is not a step on the scale in tailwind.config.js. */
const OFF_SCALE_SIZE = /text-\[\d+(px|rem)\]/

/**
 * Every exception carries the reason it is one. An entry here is a claim that
 * the literal is correct — not a to-do.
 */
const ALLOWED_LITERAL_HEADINGS: Array<{ file: string; line: number; why: string }> = [
  {
    file: 'src/pages/shop/Shop.tsx',
    line: 282,
    why: 'Banner hero: the heading sits on a gradient fill applied by an ancestor, so it must not follow the theme.',
  },
]

/** Walked by hand rather than globbed: no glob package is a direct dependency. */
function pageFiles(dir = resolve(ROOT, 'src/pages')): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...pageFiles(path))
    else if (entry.name.endsWith('.tsx')) found.push(path)
  }
  return found
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

interface Violation {
  file: string
  line: number
  snippet: string
}

function format(violations: Violation[]): string {
  return violations.map((v) => `${v.file}:${v.line}\n    ${v.snippet}`).join('\n')
}

describe('design tokens in page markup', () => {
  const files = pageFiles()

  it('finds the pages it is supposed to be guarding', () => {
    // A glob that silently matches nothing would make every test below pass.
    expect(files.length).toBeGreaterThan(50)
  })

  it('paints every heading with a token, not a literal colour', () => {
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(HEADING_TAG)) {
        const tag = match[0]
        if (!LITERAL_COLOUR.test(tag)) continue
        if (SELF_FILLED.test(tag)) continue

        const line = lineOf(source, match.index ?? 0)
        if (ALLOWED_LITERAL_HEADINGS.some((a) => a.file === file && a.line === line)) continue

        violations.push({ file, line, snippet: tag.replace(/\s+/g, ' ').slice(0, 140) })
      }
    }

    expect(violations, `Use text-txt-primary / text-txt-secondary / a semantic token instead:\n${format(violations)}`)
      .toEqual([])
  })

  it('never inlines a font stack in place of the font-serif token', () => {
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(new RegExp(INLINE_FONT_STACK, 'g'))) {
        const line = lineOf(source, match.index ?? 0)
        violations.push({ file, line, snippet: source.split('\n')[line - 1].trim().slice(0, 140) })
      }
    }

    expect(violations, `font-serif already resolves to "Playfair Display, Georgia, serif":\n${format(violations)}`)
      .toEqual([])
  })

  it('sizes every heading from the type scale', () => {
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(HEADING_TAG)) {
        if (!OFF_SCALE_SIZE.test(match[0])) continue
        violations.push({
          file,
          line: lineOf(source, match.index ?? 0),
          snippet: match[0].replace(/\s+/g, ' ').slice(0, 140),
        })
      }
    }

    expect(violations, `Use a step from theme.fontSize in tailwind.config.js:\n${format(violations)}`).toEqual([])
  })

  it('keeps the exception list honest', () => {
    // An allowance that no longer points at a literal-coloured heading is dead
    // weight that quietly widens the rule for whatever moves onto that line.
    for (const allowed of ALLOWED_LITERAL_HEADINGS) {
      const source = readFileSync(resolve(ROOT, allowed.file), 'utf8')
      const line = source.split('\n')[allowed.line - 1] ?? ''
      expect(LITERAL_COLOUR.test(line), `${allowed.file}:${allowed.line} no longer has a literal-coloured heading`).toBe(true)
      expect(allowed.why.length).toBeGreaterThan(20)
    }
  })
})
