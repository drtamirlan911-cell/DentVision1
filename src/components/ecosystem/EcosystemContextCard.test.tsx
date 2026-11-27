import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import EcosystemContextCard from './EcosystemContextCard'
import { useAuthStore } from '@/store/auth.store'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

describe('EcosystemContextCard active workspace shortcut', () => {
  beforeEach(() => {
    useAuthStore.setState({
      workspaceContexts: [
        {
          id: 'supplier-workspace', scopeType: 'SUPPLIER', scopeId: 'supplier-1', organizationId: 'supplier-organization',
          name: 'Dental Supply', roleKey: 'manager', roleLabel: 'Менеджер поставщика',
        },
        {
          id: 'clinic-workspace', scopeType: 'CLINIC', scopeId: 'clinic-1',
          name: 'Dental Clinic', roleKey: 'doctor', roleLabel: 'Врач',
        },
      ] as any,
      activeWorkspace: {
        id: 'supplier-workspace',
        scopeType: 'SUPPLIER',
        organizationId: 'supplier-organization',
        name: 'Dental Supply',
        roleLabel: 'Менеджер поставщика',
        roleKey: 'manager',
        switchedAt: 1,
      } as any,
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
    useAuthStore.setState({ activeWorkspace: null, workspaceContexts: [] })
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Подключить рабочий контекст' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/my-clinics')
  })

  it('returns a finance-scoped clinic employee to an allowed cashier page', () => {
    useAuthStore.setState({
      pages: ['cashier', 'billing'],
      workspaceContexts: [{
        id: 'clinic-workspace', scopeType: 'CLINIC', scopeId: 'clinic-1', name: 'Dental Clinic',
        roleKey: 'clinic.cashier', roleLabel: 'Кассир',
      }] as any,
      activeWorkspace: {
        id: 'clinic-workspace', scopeType: 'CLINIC', scopeId: 'clinic-1', name: 'Dental Clinic',
        roleLabel: 'Кассир', roleKey: 'clinic.cashier', switchedAt: 2,
      } as any,
    });
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Открыть рабочий кабинет' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/crm/cashier');
  })

  it('opens the organization selector from the active workspace card', () => {
    useAuthStore.setState({
      workspaceContexts: [
        { id: 'supplier-workspace', scopeType: 'SUPPLIER', scopeId: 'supplier-1', organizationId: 'supplier-organization', name: 'Dental Supply', roleKey: 'manager', roleLabel: 'Менеджер поставщика' },
        { id: 'clinic-workspace', scopeType: 'CLINIC', scopeId: 'clinic-1', name: 'Dental Clinic', roleKey: 'doctor', roleLabel: 'Врач' },
      ] as any,
    });
    const onOpen = vi.fn();
    window.addEventListener('dentvision:open-workspace-switcher', onOpen);

    render(
      <MemoryRouter initialEntries={['/crm/patients']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сменить организацию или филиал' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener('dentvision:open-workspace-switcher', onOpen);
  })

  it('asks for an explicit context instead of reopening a stale cabinet', () => {
    useAuthStore.setState({
      activeWorkspace: null,
      workspaceContexts: [
        { id: 'supplier-workspace', scopeType: 'SUPPLIER', scopeId: 'supplier-1', organizationId: 'supplier-organization', name: 'Dental Supply', roleKey: 'manager', roleLabel: 'Менеджер поставщика' },
        { id: 'clinic-workspace', scopeType: 'CLINIC', scopeId: 'clinic-1', name: 'Dental Clinic', roleKey: 'doctor', roleLabel: 'Врач' },
      ] as any,
    });
    const onOpen = vi.fn();
    window.addEventListener('dentvision:open-workspace-switcher', onOpen);
    render(
      <MemoryRouter initialEntries={['/crm/patients']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Открыть рабочий кабинет' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/crm/patients');
    window.removeEventListener('dentvision:open-workspace-switcher', onOpen);
  })

  it('keeps organization and branch selection accessible with a single active workspace', () => {
    const onOpen = vi.fn();
    window.addEventListener('dentvision:open-workspace-switcher', onOpen);
    render(
      <MemoryRouter initialEntries={['/crm/schedule']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сменить организацию или филиал' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener('dentvision:open-workspace-switcher', onOpen);
  })

  it('prompts an unselected single workspace to be selected without showing a duplicate connect action', () => {
    useAuthStore.setState({ activeWorkspace: null });
    const onOpen = vi.fn();
    window.addEventListener('dentvision:open-workspace-switcher', onOpen);
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <EcosystemContextCard user={null} />
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Подключить рабочий контекст' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть рабочий кабинет' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener('dentvision:open-workspace-switcher', onOpen);
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
