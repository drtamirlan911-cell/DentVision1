import { describe, expect, it } from 'vitest'
import { recommendationsToStages } from './odontogram-plan-sync'
import type { PlanRecommendation } from './odontogram'

describe('odontogram-plan-sync', () => {
  it('groups recommendations into urgency stages', () => {
    const recs: PlanRecommendation[] = [
      { tooth: '16', procedure: 'A', urgency: 'high', estimatedPrice: 100, reason: 'r' },
      { tooth: '26', procedure: 'B', urgency: 'medium', estimatedPrice: 50, reason: 'r' },
      { tooth: '36', procedure: 'C', urgency: 'low', estimatedPrice: 200, reason: 'r' },
    ]
    const stages = recommendationsToStages(recs)
    expect(stages).toHaveLength(3)
    expect(stages[0].title).toBe('Срочно')
    expect(stages[0].items[0].teeth).toEqual([16])
    expect(stages[1].items[0].price).toBe(50)
    expect(stages[2].cost).toBe(200)
  })
})
