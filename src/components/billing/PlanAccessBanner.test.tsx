import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key === 'common.hide' ? 'Скрыть' : key,
    }),
  }
})

import { PlanAccessBanner, type PlanEntitlementsSnapshot } from './PlanAccessBanner'

afterEach(() => {
  window.sessionStorage.clear()
})

const dismissibleStates: Array<[string, PlanEntitlementsSnapshot]> = [
  ['hard limit', { limits: { usersReached: true }, usage: { users: 10 }, entitlements: { maxUsers: 10 } }],
  ['approaching limit', { approaching: { users: true }, usage: { users: 8 }, entitlements: { maxUsers: 10 } }],
  ['expiring soon', { expiringSoon: true, daysLeft: 5 }],
]

describe('PlanAccessBanner dismiss control', () => {
  it.each(dismissibleStates)('renders a 36px minimum dismiss target for %s', (_label, snap) => {
    render(
      <MemoryRouter>
        <PlanAccessBanner snap={snap} />
      </MemoryRouter>,
    )

    const dismiss = screen.getByRole('button', { name: 'Скрыть' })
    expect(dismiss).toHaveClass('min-h-9', 'min-w-9', 'inline-flex', 'items-center', 'justify-center')
  })
})
