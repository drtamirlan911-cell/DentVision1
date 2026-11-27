import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import EcosystemContextCard from './EcosystemContextCard'
import { useWorkspaceStore } from '@/store/workspace.store'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

describe('EcosystemContextCard active workspace shortcut', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      activeWorkspace: {
        id: 'supplier-workspace',
        scopeType: 'SUPPLIER',
        organizationId: 'supplier-organization',
        name: 'Dental Supply',
        roleLabel: 'Менеджер поставщика',
        roleKey: 'manager',
        switchedAt: 1,
      },
    })
  })

  it('returns to the active supplier cabinet from another section', () => {
    render(
      <MemoryRouter initialEntries={['/crm/patients']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Открыть рабочий кабинет' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/supplier')
  })

  it('opens the shared workspace directory when no organization is active', () => {
    useWorkspaceStore.setState({ activeWorkspace: null })
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Подключить рабочий контекст' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/workspaces')
  })

  it('keeps the cabinet shortcut available when the sidebar is collapsed', () => {
    render(
      <MemoryRouter initialEntries={['/shop']}>
        <EcosystemContextCard user={null} collapsed />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Открыть рабочий кабинет' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/supplier')
  })
})
