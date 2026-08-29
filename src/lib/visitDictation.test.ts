import { describe, it, expect } from 'vitest'
import { parseDictation, isValidFdi, type ToothFinding } from './visitDictation'

function observed(text: string): Array<Pick<ToothFinding, 'tooth' | 'status' | 'surfaces'>> {
  return parseDictation(text)
    .findings.filter((f) => f.kind === 'observed')
    .map(({ tooth, status, surfaces }) => ({ tooth, status, surfaces }))
}

function planned(text: string) {
  return parseDictation(text)
    .findings.filter((f) => f.kind === 'planned')
    .map(({ tooth, status }) => ({ tooth, status }))
}

describe('isValidFdi', () => {
  it('accepts permanent quadrants 1-4 up to position 8', () => {
    expect(isValidFdi(11)).toBe(true)
    expect(isValidFdi(48)).toBe(true)
  })

  it('accepts primary quadrants 5-8 only up to position 5', () => {
    expect(isValidFdi(55)).toBe(true)
    expect(isValidFdi(85)).toBe(true)
    expect(isValidFdi(56)).toBe(false)
  })

  it('rejects position 0 and out-of-range quadrants', () => {
    expect(isValidFdi(10)).toBe(false)
    expect(isValidFdi(90)).toBe(false)
    expect(isValidFdi(19)).toBe(false)
  })
})

describe('parseDictation — teeth by number', () => {
  it('reads a status stated after the tooth', () => {
    expect(observed('На 16 глубокий кариес')).toEqual([{ tooth: 16, status: 'caries', surfaces: [] }])
  })

  it('reads a status stated before the tooth', () => {
    expect(observed('Кариес на 16')).toEqual([{ tooth: 16, status: 'caries', surfaces: [] }])
  })

  it('picks up surfaces named alongside the finding', () => {
    const [f] = observed('На 16 кариес, жевательная и медиальная поверхности')
    expect(f.tooth).toBe(16)
    expect(f.status).toBe('caries')
    expect([...f.surfaces].sort()).toEqual(['M', 'O'])
  })

  it('records the end state, not the state that was treated', () => {
    // "caries … put a filling in" is one tooth in one final state.
    expect(observed('Кариес на 16, поставил композитную пломбу')).toEqual([
      { tooth: 16, status: 'filled', surfaces: [] },
    ])
  })

  it('keeps each tooth with its own finding regardless of word order', () => {
    expect(observed('Кариес на 16, коронка на 26')).toEqual([
      { tooth: 16, status: 'caries', surfaces: [] },
      { tooth: 26, status: 'crown', surfaces: [] },
    ])
  })

  it('splits findings across sentences', () => {
    expect(observed('На 16 кариес. На 26 коронка.')).toEqual([
      { tooth: 16, status: 'caries', surfaces: [] },
      { tooth: 26, status: 'crown', surfaces: [] },
    ])
  })

  it('shares one verb across an enumeration of teeth', () => {
    expect(observed('На 16 и 26 коронки')).toEqual([
      { tooth: 16, status: 'crown', surfaces: [] },
      { tooth: 26, status: 'crown', surfaces: [] },
    ])
  })

  it('reads primary teeth', () => {
    expect(observed('На 55 кариес')).toEqual([{ tooth: 55, status: 'caries', surfaces: [] }])
  })

  it.each([
    ['47 удалён ранее', 47, 'extracted'],
    ['зуб 38 отсутствует', 38, 'missing'],
    ['на 36 каналы пролечены', 36, 'endo_ok'],
    ['на 21 винир', 21, 'veneer'],
    ['на 46 имплант', 46, 'implant'],
    ['на 12 трещина', 12, 'fracture'],
    ['на 24 воспаление', 24, 'inflammation'],
  ])('reads %s', (text, tooth, status) => {
    expect(observed(text)).toEqual([{ tooth, status, surfaces: [] }])
  })
})

describe('parseDictation — spoken tooth names', () => {
  it('resolves a name with both arch and side', () => {
    expect(observed('Верхняя шестёрка справа — кариес')).toEqual([
      { tooth: 16, status: 'caries', surfaces: [] },
    ])
  })

  it.each([
    ['Верхняя семёрка слева — коронка', 27],
    ['Нижняя восьмёрка слева удалена', 38],
    ['Нижний клык справа — трещина', 43],
  ])('resolves %s', (text, tooth) => {
    expect(observed(text)[0].tooth).toBe(tooth)
  })

  it('refuses to guess a quadrant it was not given', () => {
    const draft = parseDictation('Шестёрка кариес')
    expect(draft.findings).toEqual([])
    expect(draft.unresolved.map((u) => u.reason)).toContain('ambiguous_tooth')
  })
})

describe('parseDictation — recommendations stay off the chart', () => {
  it('separates what was seen from what was proposed', () => {
    const text = 'На 26 трещина, рекомендую коронку'
    expect(observed(text)).toEqual([{ tooth: 26, status: 'fracture', surfaces: [] }])
    expect(planned(text)).toEqual([{ tooth: 26, status: 'crown' }])
  })

  it.each(['планируется', 'нужна', 'требуется', 'показана'])('treats "%s" as intent', (marker) => {
    const found = planned(`На 26 трещина, ${marker} коронка`)
    expect(found).toEqual([{ tooth: 26, status: 'crown' }])
  })
})

describe('parseDictation — refuses to invent', () => {
  it('does not read an age as a tooth', () => {
    expect(parseDictation('Пациенту 16 лет, жалоб нет').findings).toEqual([])
  })

  it.each(['на 35 тысяч', '12 мм', '18 месяцев'])('does not read "%s" as a tooth', (text) => {
    expect(parseDictation(`${text} кариес`).findings).toEqual([])
  })

  it('reports a clinical term with no tooth instead of dropping it', () => {
    const draft = parseDictation('Обнаружен кариес')
    expect(draft.findings).toEqual([])
    expect(draft.unresolved.map((u) => u.reason)).toEqual(['finding_without_tooth'])
  })

  it('reports a tooth with no finding instead of marking it healthy', () => {
    const draft = parseDictation('Осмотрен зуб 16')
    expect(draft.findings).toEqual([])
    expect(draft.unresolved.map((u) => u.reason)).toEqual(['tooth_without_finding'])
  })

  it('ignores an out-of-range FDI number', () => {
    expect(parseDictation('На 19 кариес').findings).toEqual([])
  })

  it('returns an empty draft for empty input', () => {
    const draft = parseDictation('')
    expect(draft.findings).toEqual([])
    expect(draft.unresolved).toEqual([])
    expect(draft.fields.notes).toBe('')
  })
})

describe('parseDictation — repeated mentions', () => {
  it('collapses a tooth named twice into its final state', () => {
    expect(observed('На 16 кариес. Поставил пломбу на 16.')).toEqual([
      { tooth: 16, status: 'filled', surfaces: [] },
    ])
  })

  it('carries surfaces forward when the later clause does not repeat them', () => {
    const [f] = observed('На 16 кариес жевательная. Поставил пломбу на 16.')
    expect(f).toEqual({ tooth: 16, status: 'filled', surfaces: ['O'] })
  })
})

describe('parseDictation — visit fields', () => {
  const text = [
    'Пациент жалуется на боль в верхней шестёрке справа',
    'В анамнезе аллергия на пенициллин',
    'На 16 глубокий кариес, жевательная поверхность',
    'Поставил композитную пломбу под анестезией',
  ].join('. ')

  it('routes complaints, anamnesis, diagnosis and treatment', () => {
    const { fields } = parseDictation(text)
    expect(fields.complaints).toContain('жалуется')
    expect(fields.anamnesis).toContain('аллергия')
    expect(fields.diagnosis).toContain('глубокий кариес')
    expect(fields.treatment).toContain('пломбу')
  })

  it('does not lose a sentence it cannot categorise', () => {
    const { fields } = parseDictation('Пациент пришёл вовремя')
    expect(fields.notes).toBe('Пациент пришёл вовремя')
  })
})

describe('parseDictation — Cyrillic word boundaries', () => {
  // JS `\w` is [A-Za-z0-9_] and `\b` is defined by it, so both are blind to
  // Cyrillic. Every pattern here failed silently until the classes were made
  // explicit; these cases pin the behaviour so it cannot regress.
  it.each([
    ['на 36 каналы пролечены', 'endo_ok'],
    ['на 36 каналы запломбированы', 'endo_ok'],
    ['на 16 скол', 'fracture'],
    ['на 16 корневой остаток', 'root'],
  ])('matches a multi-word stem in "%s"', (text, status) => {
    expect(observed(text)[0].status).toBe(status)
  })

  it.each([
    ['Верхняя шестёрка справа — кариес', 16],
    ['Нижняя семёрка справа — кариес', 47],
    ['Верхний центральный резец слева — трещина', 21],
    ['Нижний второй премоляр слева — коронка', 35],
  ])('resolves side and arch in "%s"', (text, tooth) => {
    expect(observed(text)[0].tooth).toBe(tooth)
  })

  it('does not read "мед" inside a longer word as a surface', () => {
    const [f] = observed('Немедленно поставил пломбу на 16')
    expect(f.surfaces).not.toContain('M')
  })

  it('reads a bare surface abbreviation', () => {
    const [f] = observed('На 16 кариес, дистальная поверхность')
    expect(f.surfaces).toEqual(['D'])
  })
})

describe('parseDictation — evidence spans', () => {
  it('points every finding back at the words that produced it', () => {
    const text = 'На 16 кариес, коронка на 26'
    const draft = parseDictation(text)
    expect(draft.findings).toHaveLength(2)
    for (const f of draft.findings) {
      expect(text.slice(f.span.start, f.span.end)).toContain(f.span.text)
      expect(f.span.text).toContain(String(f.tooth))
    }
  })
})
