import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * Regression guard for the legend inside SurfaceEditor (Odontogram3D).
 *
 * When a whole-tooth status is active, its button must paint via the CSS
 * variable --status-color (sourced from STATUS_META) — NOT via an inline
 * literal colour or a hardcoded token class. This is the contract the
 * bg-[var(--status-color)] refactor relies on.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
  initReactI18next: { type: '3rdParty', default: vi.fn() },
}))
vi.mock('lucide-react', () => ({
  Sparkles: () => null,
  Check: () => null,
  X: () => null,
  History: () => null,
  Pencil: () => null,
  Camera: () => null,
  Trash2: () => null,
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
}))

const { Odontogram3D, SurfaceEditor } = await import('../Odontogram3D')

describe('SurfaceEditor legend', () => {
  it('binds --status-color from STATUS_META to the active status button', () => {
    render(
      <SurfaceEditor
        toothNumber={18}
        tooth="healthy"
        surfaces={undefined}
        onSave={() => {}}
        onCancel={() => {}}
      />
    )

    // Legend repeats the status label once per button plus the editor header
    // badge, so scope to the whole-tooth-status strip (under diagnostics.tooth_status heading).
    const legendHeading = screen.getByText('diagnostics.tooth_status')
    const legendStrip = legendHeading.closest('div')!
    const legend = within(legendStrip)

    const healthyBtn = legend.getAllByText('Здоров').find((el) => el.closest('button'))!.closest('button')!
    expect(healthyBtn).toHaveClass('bg-[var(--status-color)]')
    expect(healthyBtn.style.getPropertyValue('--status-color').trim()).toBe('#27AE60')

    // Activate crown (a whole-tooth status in WHOLE_TOOTH_STATUSES that is NOT
    // 'healthy'): the active button flips to crown's colour.
    //
    // #3B82F6, not the old #8E44AD: the chart palette moved to the conventional
    // clinical vocabulary (crown blue) when the odontogram was rebuilt against a
    // reference chart. The contract this test guards is the --status-color
    // binding, not any particular hue — but it reads the value from STATUS_META,
    // so it has to name the one that lives there.
    const crownBtn = legend.getAllByText('Коронка').find((el) => el.closest('button'))!.closest('button')!
    fireEvent.click(crownBtn)
    expect(crownBtn).toHaveClass('bg-[var(--status-color)]')
    expect(crownBtn.style.getPropertyValue('--status-color').trim()).toBe('#3B82F6')
  })
})


describe('Odontogram selected-tooth clinical context', () => {
  it('opens anatomical context for a real tooth selection and reflects surface findings', () => {
    const patientTeeth = {
      16: { status: 'caries', surfaces: { O: 'caries' } },
    }

    const onToothClick = vi.fn()
    const view = render(
      <Odontogram3D
        patientTeeth={patientTeeth}
        onToothClick={onToothClick}
        selectedTooth={undefined}
        showToolbar={false}
      />,
    )

    const toothButton = screen.getByRole('button', { name: /16 ·/ })
    fireEvent.click(toothButton)
    expect(onToothClick).toHaveBeenCalledWith(16)

    view.rerender(
      <Odontogram3D
        patientTeeth={patientTeeth}
        onToothClick={onToothClick}
        selectedTooth={16}
        showToolbar={false}
      />,
    )

    const context = screen.getByTestId('selected-tooth-anatomy')
    expect(within(context).getByText('Клинический контекст')).toBeTruthy()
    expect(within(context).getByText('Коронка')).toBeTruthy()
    expect(within(context).getByText('Дентин')).toBeTruthy()
    expect(within(context).getByText('Пульпа')).toBeTruthy()
    expect(within(context).getByText('Нерв')).toBeTruthy()
    expect(within(context).getByText('Корень')).toBeTruthy()
    expect(within(context).getByText(/Поверхности/)).toBeTruthy()
    expect(within(context).getByText(/O:/)).toBeTruthy()
  })
})
