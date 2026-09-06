import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DV_EASE, DV_DURATION } from './index'

/**
 * Motion lives in two places and must not drift.
 *
 * CSS transitions read `--dv-ease` / `--dv-duration-*` from `global.css`;
 * Framer writes inline styles and cannot read a variable, so the same values
 * are duplicated as `DV_EASE` / `DV_DURATION` in TypeScript. Nobody looks at a
 * hover and a list animation side by side and notices that one settles on a
 * slightly different curve — they just come away feeling the product is
 * uneven. That is precisely the kind of thing worth pinning with a test rather
 * than with discipline.
 */
const CSS = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8')

/** Reads a `--dv-*` declaration out of the root block. */
function cssVar(name: string): string {
  const m = CSS.match(new RegExp(`${name}:\\s*([^;]+);`))
  expect(m, `${name} not declared in global.css`).toBeTruthy()
  return m![1].trim()
}

describe('motion tokens agree across CSS and JS', () => {
  it('the easing curve is the same in both', () => {
    const css = cssVar('--dv-ease')
    const fromJs = `cubic-bezier(${DV_EASE.join(', ')})`
    expect(css).toBe(fromJs)
  })

  it('every duration is the same in both', () => {
    for (const [step, seconds] of Object.entries(DV_DURATION)) {
      const css = cssVar(`--dv-duration-${step}`)
      expect(css, `--dv-duration-${step}`).toBe(`${Math.round(seconds * 1000)}ms`)
    }
  })

  it('the durations climb', () => {
    // A scale whose steps are not ordered is not a scale, and the names stop
    // meaning anything at the call site.
    expect(DV_DURATION.fast).toBeLessThan(DV_DURATION.base)
    expect(DV_DURATION.base).toBeLessThan(DV_DURATION.slow)
  })

  it('the curve decelerates and never overshoots', () => {
    // A cubic-bezier whose y ever exceeds 1 springs past its target and comes
    // back. `StaggerItem` documents at length why that is the wrong feel for a
    // clinical record; this keeps a future tweak from quietly reintroducing it.
    const [, y1, , y2] = DV_EASE
    expect(y1).toBeLessThanOrEqual(1)
    expect(y2).toBeLessThanOrEqual(1)
  })
})

describe('elevation is theme-aware', () => {
  /**
   * The failure this pins: elevation used to be black literals in
   * `tailwind.config.js` (`rgba(0,0,0,0.2)` … `0.4`). Those are right on a
   * dark ground and muddy on a light one, so the light theme had no usable
   * depth at all — cards sat flat on the page. Both themes must now declare
   * their own ramp.
   */
  function block(theme: 'dark' | 'light'): string {
    const start = theme === 'light' ? CSS.indexOf('html.light {') : CSS.indexOf(':root,')
    expect(start, `${theme} block not found`).toBeGreaterThan(-1)
    return CSS.slice(start, CSS.indexOf('\n  }', start))
  }

  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: declares all three elevation steps`, () => {
      const b = block(theme)
      for (const step of [1, 2, 3]) {
        expect(b, `--dv-elev-${step} in ${theme}`).toContain(`--dv-elev-${step}:`)
      }
    })

    it(`${theme}: every step layers a contact shadow with an ambient one`, () => {
      const b = block(theme)
      for (const step of [1, 2, 3]) {
        const m = b.match(new RegExp(`--dv-elev-${step}:\\s*([^;]+);`))
        expect(m, `--dv-elev-${step}`).toBeTruthy()
        // Two comma-separated shadows: one shadow alone reads as a sticker.
        const shadows = m![1].split(/,(?![^(]*\))/)
        expect(shadows.length, `--dv-elev-${step} in ${theme} should have 2 layers`).toBe(2)
      }
    })
  }

  it('light elevation is mixed from slate, not from black', () => {
    // Pure black over a light surface greys it; grey is what makes a light UI
    // look cheap. The shade has to share the border ink.
    const b = block('light')
    const steps = [...b.matchAll(/--dv-elev-\d:\s*([^;]+);/g)].map((m) => m[1])
    expect(steps.length).toBe(3)
    for (const s of steps) {
      expect(s, 'light elevation should not use rgba(0, 0, 0, …)').not.toMatch(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/)
    }
  })
})
