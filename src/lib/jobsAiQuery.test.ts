import { describe, expect, it } from 'vitest'
import { parseJobsSearchQuery } from './jobsAiQuery'

describe('parseJobsSearchQuery', () => {
  it('parses orthodontist vacancy search', () => {
    expect(parseJobsSearchQuery('Найди вакансии ортодонта')).toEqual({ q: 'ортодонта' })
  })

  it('ignores unrelated clinic queries', () => {
    expect(parseJobsSearchQuery('Показать расписание')).toBeNull()
    expect(parseJobsSearchQuery('Проверить долги')).toBeNull()
  })

  it('detects specialty without вакансии word', () => {
    expect(parseJobsSearchQuery('Найди ортодонта')).toEqual({ q: 'ортодонта' })
  })
})
