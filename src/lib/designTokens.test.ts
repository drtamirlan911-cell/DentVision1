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
/** Any className, not only the ones on headings. */
const CLASS_ATTR = /class[nN]ame=(?:"[^"]*"|'[^']*'|\{`[^`]*`\}|\{[^{}]*\})/g
const INLINE_FONT_STACK = /font-\['/
/** A heading size that is not a step on the scale in tailwind.config.js. */
const OFF_SCALE_SIZE = /text-\[\d+(px|rem)\]/
/** An inline style object — the blind spot the className rules cannot see. */
const INLINE_STYLE = /style=\{\{[^}]*\}\}/g
/** A colour written straight into that object: hex, rgb(a) or hsl(a). */
const INLINE_LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
/**
 * A translucent wash — an ambient glow behind content.
 *
 * These cannot make anything unreadable: they tint whatever is beneath them
 * rather than replacing it, and nothing sets a foreground against them. What
 * this rule is for is the opposite case: an opaque literal panel that stays
 * dark while the text on it follows the theme.
 */
const TRANSLUCENT_WASH = /\b(?:rgba|hsla)\([^)]*,\s*0?\.[0-5]\d*\s*\)/g
/** Shadows tint, they do not fill. */
const SHADOW_DECL = /\bbox-?[Ss]hadow\s*:/

/**
 * A colour class that names a token this project does not have.
 *
 * These are leftovers from a different design system (shadcn's `primary` /
 * `muted` / `foreground` / `border` roles). In tailwind.config.js `primary` and
 * `muted` live *inside* the `txt` group, so the classes that exist are
 * `text-txt-primary` and `text-txt-muted`; there is no top-level `primary`,
 * `foreground`, `border` or `input` colour at all.
 *
 * Tailwind does not warn about this — it simply emits nothing, so the element
 * silently inherits whatever is above it. That is how the BI tab shipped with
 * an active sub-tab distinguishable from an inactive one only by its shadow,
 * and a chat where the user's bubble and the assistant's were the same colour.
 *
 * The literal-colour rule above cannot catch these: the colour is not written
 * literally, it is written as a name that resolves to nothing. Hence a separate,
 * explicit list rather than a general "is this class real?" check — the latter
 * would need the whole utility surface (text-sm, border-2, …) to be modelled to
 * avoid false positives.
 */
const FOREIGN_TOKEN = new RegExp(
  '(?<![\\w-])(?:' + [
    'text-muted-foreground', 'text-primary-foreground', 'text-foreground',
    'text-primary', 'text-destructive',
    'bg-primary', 'bg-muted', 'bg-surface', 'bg-accent',
    'border-border', 'border-input', 'ring-ring',
  ].join('|') + ')(?![-\\w])',
)

/**
 * A loading spinner hand-built out of a div.
 *
 * `ds/Skeleton` exists and 43 screens use it; 18 others reimplemented a
 * spinning circle, which says nothing about the content that is coming and
 * makes the layout jump when it arrives.
 *
 * Deliberately narrow: it matches the div-circle shape, not every
 * `animate-spin`. A lucide icon that spins is a different and correct idiom —
 * the refresh icon on a "Refresh" button, the spinner inside a Button while a
 * mutation runs, a labelled progress line over content that is already on
 * screen. Those stayed.
 */
const HAND_ROLLED_SPINNER = /animate-spin(?=[^"'`]*rounded-full)(?=[^"'`]*border)|rounded-full(?=[^"'`]*animate-spin)(?=[^"'`]*border-)/

/** A browser dialog: unstyled, unlocalised, and blocking. */
const NATIVE_DIALOG = /(?<![\w$.])(?:window\.)?(?:confirm|alert|prompt)\s*\(/

/**
 * Every exception carries the reason it is one. An entry here is a claim that
 * the literal is correct — not a to-do.
 */
const ALLOWED_LITERAL_HEADINGS: Array<{ file: string; line: number; why: string }> = [
  {
    file: 'src/pages/shop/Shop.tsx',
    line: 300,
    why: 'Banner previous-slide control: sits on a gradient ancestor and carries its own bg-white/15 fill, so the foreground is intentionally non-theme-bound.',
  },
  {
    file: 'src/pages/shop/Shop.tsx',
    line: 305,
    why: 'Banner next-slide control: sits on the same ancestor gradient as the hero text.',
  },
]

/** Same contract as above, for colours that have to stay inline. */
const ALLOWED_INLINE_COLOURS: Array<{ file: string; line: number; why: string }> = [
  // Intentionally empty: inline literal colours were removed in favour of
  // token classes and CSS variables (see Odontogram3D.tsx tooth-status legend,
  // which now uses --status-color instead of style={{ background: meta.color }}).
]

/** Walked by hand rather than globbed: no glob package is a direct dependency. */
function pageFiles(dir = resolve(ROOT, "src/pages")): string[] {
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
  const files = [...pageFiles(), ...pageFiles(resolve(ROOT, 'src/components'))]

  it('finds the files it is supposed to be guarding', () => {
    // A walk that silently matches nothing would make every test below pass.
    expect(files.length).toBeGreaterThan(150)
  })

  it('paints every piece of text with a token, not a literal colour', () => {
    // Widened from headings to any className once the pages were converted:
    // body text painted `text-white` over a themed surface is the same defect
    // as a heading painted that way, and there were 84 of them.
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(CLASS_ATTR)) {
        const cls = match[0]
        if (!LITERAL_COLOUR.test(cls)) continue
        if (SELF_FILLED.test(cls)) continue

        const line = lineOf(source, match.index ?? 0)
        if (ALLOWED_LITERAL_HEADINGS.some((a) => a.file === file && a.line === line)) continue

        violations.push({ file, line, snippet: cls.replace(/\s+/g, ' ').slice(0, 140) })
      }
    }

    expect(violations, `Use text-txt-primary / text-txt-secondary / a semantic token instead:\n${format(violations)}`)
      .toEqual([])
  })

  it('never writes the brand gold as a raw hex', () => {
    // A literal #C9A96E bypasses the token, so it cannot follow the theme —
    // the same defect the config had, just spelled at the call site.
    const violations: Violation[] = []
    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')
      for (const match of source.matchAll(/\b[\w-]+-\[#C9A96E\][^\s"'`]*/gi)) {
        violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: match[0] })
      }
    }
    expect(violations, `Use the dv-gold token so the accent follows the theme:\n${format(violations)}`).toEqual([])
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

  it('never paints a colour through an inline style', () => {
    // The rule above reads `className`, so it could not see `style={{ background:
    // '#0D1B2E' }}` — and that is exactly how the shop kept a dark palette in
    // the light theme. `src/pages/shop/Shop.tsx` alone carried 86 inline style
    // objects; the cart drawer was pinned to a hardcoded navy while its text
    // used `text-txt-primary`, so on the light theme it rendered dark-on-dark.
    //
    // Layout, sizes and filters are none of this rule's business — only colour.
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(INLINE_STYLE)) {
        // Strip what cannot affect legibility before deciding, so the rule
        // fires on opaque fills and not on decoration.
        const body = match[0].replace(TRANSLUCENT_WASH, '').replace(SHADOW_DECL, '')
        if (!INLINE_LITERAL_COLOUR.test(body)) continue
        // A CSS variable is the theme, so it is the fix, not the defect —
        // native <option> popups genuinely cannot be reached by a class.
        if (/var\(--/.test(body)) continue

        const line = lineOf(source, match.index ?? 0)
        if (ALLOWED_INLINE_COLOURS.some((a) => a.file === file && a.line === line)) continue

        violations.push({ file, line, snippet: body.replace(/\s+/g, ' ').slice(0, 140) })
      }
    }

    expect(violations, `Move the colour into a token class — an inline hex cannot follow the theme:\n${format(violations)}`)
      .toEqual([])
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

  it('never names a colour token that does not exist', () => {
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(CLASS_ATTR)) {
        const cls = match[0]
        if (!FOREIGN_TOKEN.test(cls)) continue
        violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: cls.replace(/\s+/g, ' ').slice(0, 140) })
      }
    }

    expect(
      violations,
      `These classes resolve to nothing — Tailwind emits no rule and the element inherits.\n`
      + `Use text-txt-primary / text-txt-muted / bg-surface-1..4 / border-bdr-subtle / bg-dv-gold:\n${format(violations)}`,
    ).toEqual([])
  })

  it('shows loading through Skeleton, not a hand-built spinner', () => {
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      // ds/Skeleton and ds/Button are where the real thing lives.
      if (file.startsWith('src/components/ui/ds/')) continue
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(CLASS_ATTR)) {
        const cls = match[0]
        if (!HAND_ROLLED_SPINNER.test(cls)) continue
        violations.push({ file, line: lineOf(source, match.index ?? 0), snippet: cls.replace(/\s+/g, ' ').slice(0, 140) })
      }
    }

    expect(
      violations,
      `Use Skeleton / CardSkeleton / ListSkeleton for content, or Button's own \`loading\` inside a button:\n${format(violations)}`,
    ).toEqual([])
  })

  it('asks for confirmation through ConfirmModal, not a browser dialog', () => {
    const violations: Violation[] = []

    for (const absolute of files) {
      const file = relative(ROOT, absolute)
      const source = readFileSync(absolute, 'utf8')

      for (const match of source.matchAll(new RegExp(NATIVE_DIALOG, 'g'))) {
        const index = match.index ?? 0
        violations.push({
          file,
          line: lineOf(source, index),
          snippet: source.slice(index, index + 90).split('\n')[0],
        })
      }
    }

    expect(
      violations,
      `A native dialog is unstyled, unlocalised and blocking. Use ConfirmModal from ds/Modal:\n${format(violations)}`,
    ).toEqual([])
  })
})

describe('theme colours honour an opacity modifier', () => {
  /**
   * These tokens are CSS variables holding a hex. Tailwind 3 cannot inject an
   * alpha into a bare `var()` — it drops the utility and says nothing — so
   * `border-bdr-subtle/50` compiled to no rule at all in 42 places and
   * `bg-surface-1/50` in 12 more. `tailwind.config.js` resolves them through
   * `color-mix` instead; this asserts that resolver keeps both halves working,
   * because either half can break silently.
   */
  // The config is plain JS with no types of its own; the shape asserted below
  // is the whole point of the test, so a cast here is the honest spelling.
  const load = async () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((await import('../../tailwind.config.js' as any)) as any).default as {
      theme: { extend: { colors: Record<string, unknown> } }
    }

  type Resolver = (arg: { opacityValue?: string | number }) => string

  async function varBackedTokens(): Promise<Array<[string, Resolver]>> {
    const config = await load()
    const found: Array<[string, Resolver]> = []
    const walk = (node: unknown, prefix: string) => {
      if (typeof node === 'function') {
        found.push([prefix, node as Resolver])
        return
      }
      if (!node || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key)
      }
    }
    walk(config.theme.extend.colors, '')
    return found
  }

  it('routes the surface, text and border families through the resolver', async () => {
    const tokens = await varBackedTokens()
    const names = tokens.map(([name]) => name)
    expect(names).toContain('surface-0')
    expect(names).toContain('txt-primary')
    expect(names).toContain('bdr-subtle')
    expect(tokens.length).toBeGreaterThan(10)
  })

  it('produces a real colour for a written modifier', async () => {
    for (const [name, resolve_] of await varBackedTokens()) {
      const value = resolve_({ opacityValue: 0.5 })
      expect(value, name).toMatch(/^color-mix\(in srgb, var\(--dv-[\w-]+\) 50%, transparent\)$/)
    }
  })

  it('leaves the plain utility as a bare var', async () => {
    for (const [name, resolve_] of await varBackedTokens()) {
      // Tailwind hands its own `var(--tw-bg-opacity)` to the plain utility, and
      // Number() of that is NaN — which once emitted a literal `NaN%`.
      expect(resolve_({ opacityValue: undefined }), name).toMatch(/^var\(--dv-[\w-]+\)$/)
      expect(resolve_({ opacityValue: 'var(--tw-bg-opacity)' }), name).toMatch(/^var\(--dv-[\w-]+\)$/)
    }
  })
})

describe('the brand accent is readable in both themes', () => {
  /**
   * `--dv-gold` was a literal in `tailwind.config.js`, so the light-theme
   * override in `global.css` never reached a single `*-dv-gold` utility and the
   * accent simply did not invert. Measured on the light surface, gold text sat
   * at 2.03:1 and the primary button at 2.03:1 — against a 4.5:1 AA floor.
   *
   * Contrast is computed from the declared values rather than a screenshot, so
   * the test fails on the commit that changes a token, not weeks later when
   * someone happens to look at the light theme.
   */
  const AA_TEXT = 4.5

  function relativeLuminance(hex: string): number {
    const h = hex.replace('#', '')
    const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }

  function contrast(a: string, b: string): number {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  /** Reads one `--dv-*` hex out of a `:root`/`html.dark` or `html.light` block. */
  function tokens(theme: 'dark' | 'light'): Record<string, string> {
    const css = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf8')
    const start = theme === 'light' ? css.indexOf('html.light {') : css.indexOf(':root,')
    expect(start, `${theme} theme block not found`).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('\n  }', start))
    const found: Record<string, string> = {}
    for (const m of block.matchAll(/(--dv-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) found[m[1]] = m[2]
    return found
  }

  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: gold text clears AA on the page and on a card`, () => {
      const t = tokens(theme)
      expect(contrast(t['--dv-gold'], t['--dv-surface-0']), 'gold on surface-0').toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(t['--dv-gold'], t['--dv-surface-1']), 'gold on surface-1').toBeGreaterThanOrEqual(AA_TEXT)
    })

    it(`${theme}: the foreground on a solid gold fill clears AA`, () => {
      // The accent inverts with the theme, so the text on it inverts the other
      // way — one token cannot serve both roles, which is why `gold-on` exists.
      const t = tokens(theme)
      expect(contrast(t['--dv-gold-on'], t['--dv-gold']), 'gold-on over gold').toBeGreaterThanOrEqual(AA_TEXT)
      // A gradient is only as readable as its weakest end, and which end that
      // is flips with the theme — so the primary fill carries its own pair.
      expect(contrast(t['--dv-gold-on'], t['--dv-gold-from']), 'gold-on over the gradient start')
        .toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(t['--dv-gold-on'], t['--dv-gold-to']), 'gold-on over the gradient end')
        .toBeGreaterThanOrEqual(AA_TEXT)
    })

    it(`${theme}: gold text clears AA on its own tint, not just on bare surfaces`, () => {
      // `bg-dv-gold/10 text-dv-gold` is a chip pattern used across the app, and
      // it is a harder case than gold on the bare page: the wash pulls the
      // background toward the text. Checking only the plain surface passed a
      // gold that measured 4.17:1 in the real render.
      const t = tokens(theme)
      const hex = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16))
      const toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
      const mix = (fg: number[], bg: number[], a: number) => fg.map((v, i) => v * a + bg[i] * (1 - a))

      for (const surface of ['--dv-surface-0', '--dv-surface-1']) {
        for (const alpha of [0.1, 0.15]) {
          const tint = toHex(mix(hex(t['--dv-gold']), hex(t[surface]), alpha))
          expect(contrast(t['--dv-gold'], tint), `gold on a ${alpha * 100}% gold tint over ${surface}`)
            .toBeGreaterThanOrEqual(AA_TEXT)
        }
      }
    })

    it(`${theme}: the gold ramp is monotonic`, () => {
      // light → base → dim must move in ONE direction, whichever it is. The
      // direction itself flips: against a dark page the lighter step has the
      // higher contrast, against a light page the darker one does. What breaks
      // a progression drawn with the ramp is a step that doubles back — which
      // is exactly what shipped in the referral pipeline before #183.
      const t = tokens(theme)
      const bg = t['--dv-surface-0']
      const steps = ['--dv-gold-light', '--dv-gold', '--dv-gold-dim'].map((k) => contrast(t[k], bg))
      const ascending = steps[0] < steps[1] && steps[1] < steps[2]
      const descending = steps[0] > steps[1] && steps[1] > steps[2]
      expect(ascending || descending, `not monotonic: ${steps.map((s) => s.toFixed(2)).join(' → ')}`).toBe(true)
    })
  }
})

describe('the text ladder is readable in both themes', () => {
  /**
   * `--dv-text-muted` was the one text token that missed AA, and only in the
   * light theme — 3.91:1 on a white card. Nothing surfaces that: the class is
   * a token, the build is clean, and the dark theme (6.49:1) looks fine.
   *
   * `ghost` is deliberately below the floor in BOTH themes (2.28 dark / 2.34
   * light). It is the placeholder-and-divider tier, which WCAG exempts as
   * decorative — and because both themes agree, it is a chosen tier rather
   * than a light-theme accident. It is asserted as such so a future change
   * that promotes ghost to real content has to say so out loud.
   */
  const AA_TEXT = 4.5

  function luminance(hex: string): number {
    const h = hex.replace('#', '')
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
  }
  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  function themeTokens(theme: 'dark' | 'light'): Record<string, string> {
    const css = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf8')
    const start = theme === 'light' ? css.indexOf('html.light {') : css.indexOf(':root,')
    const block = css.slice(start, css.indexOf('\n  }', start))
    const found: Record<string, string> = {}
    for (const m of block.matchAll(/(--dv-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) found[m[1]] = m[2]
    return found
  }

  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: primary, secondary and muted all clear AA on both surfaces`, () => {
      const t = themeTokens(theme)
      for (const key of ['--dv-text-primary', '--dv-text-secondary', '--dv-text-muted']) {
        for (const surface of ['--dv-surface-0', '--dv-surface-1']) {
          expect(contrast(t[key], t[surface]), `${key} on ${surface}`).toBeGreaterThanOrEqual(AA_TEXT)
        }
      }
    })

    it(`${theme}: the emphasis ladder does not double back`, () => {
      const t = themeTokens(theme)
      const bg = t['--dv-surface-0']
      const steps = ['--dv-text-primary', '--dv-text-secondary', '--dv-text-muted', '--dv-text-ghost']
        .map((k) => contrast(t[k], bg))
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i], `${steps.map((s) => s.toFixed(2)).join(' > ')}`).toBeLessThan(steps[i - 1])
      }
    })
  }
})
