import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'

const { getTeam, removeMember, getInvitations, createInvitation, revokeInvitation, toast } = vi.hoisted(() => ({
  getTeam: vi.fn(),
  removeMember: vi.fn(),
  getInvitations: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils/api', () => ({
  supplierWs: {
    team: getTeam,
    removeMember,
  },
  getOrganizationInvitations: getInvitations,
  createOrganizationInvitation: createInvitation,
  revokeOrganizationInvitation: revokeInvitation,
}))

vi.mock('@/components/ui/ds/Toast', () => ({
  useToast: () => toast,
}))

import SupplierTeamTab from './SupplierTeamTab'

const members = [
  { id: 'owner-member', userId: 'owner-user', role: 'owner', firstName: 'Тима', lastName: 'Владелец', email: 'owner@example.kz' },
  { id: 'manager-member', userId: 'manager-user', role: 'manager', firstName: 'Иван', lastName: 'Менеджер', email: 'manager@example.kz' },
]
const invitations = [
  { id: 'invite-1', code: 'A1B2C3D4', role: 'manager', email: 'new@example.kz', expiresAt: '2026-12-01T00:00:00.000Z' },
]

beforeEach(() => {
  getTeam.mockReset().mockResolvedValue(members)
  removeMember.mockReset().mockResolvedValue({ removed: true })
  getInvitations.mockReset().mockResolvedValue({ data: invitations })
  createInvitation.mockReset().mockResolvedValue({ id: 'invite-2', code: 'E5F6G7H8', role: 'manager', email: 'staff@example.kz', expiresAt: '2026-12-05T00:00:00.000Z' })
  revokeInvitation.mockReset().mockResolvedValue({ revoked: true })
  toast.success.mockReset()
  toast.error.mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SupplierTeamTab', () => {
  it('shows the owner and team without offering a way to remove the owner', async () => {
    render(<SupplierTeamTab token="scoped-token" supplierId="supplier-1" organizationId="org-1" />)

    expect(await screen.findByText('Иван Менеджер')).toBeInTheDocument()
    expect(screen.getByText('Тима Владелец')).toBeInTheDocument()
    expect(screen.getByText('A1B2C3D4')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Удалить сотрудника' })).toHaveLength(1)
  })

  it('creates a manager invitation scoped to the active supplier organization', async () => {
    render(<SupplierTeamTab token="scoped-token" supplierId="supplier-1" organizationId="org-1" />)
    await screen.findByText('Иван Менеджер')
    fireEvent.change(screen.getByLabelText('Email сотрудника'), { target: { value: 'staff@example.kz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Пригласить менеджера' }))

    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith({
      organizationId: 'org-1',
      role: 'manager',
      email: 'staff@example.kz',
    }))
    expect(await screen.findByText('E5F6G7H8')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
  })

  it('revokes an active invitation', async () => {
    render(<SupplierTeamTab token="scoped-token" supplierId="supplier-1" organizationId="org-1" />)
    await screen.findByText('A1B2C3D4')
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать приглашение' }))

    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith('invite-1'))
    await waitFor(() => expect(screen.queryByText('A1B2C3D4')).not.toBeInTheDocument())
  })

  it('removes a manager but never calls the removal API for the owner', async () => {
    render(<SupplierTeamTab token="scoped-token" supplierId="supplier-1" organizationId="org-1" />)
    await screen.findByText('Иван Менеджер')
    fireEvent.click(screen.getByRole('button', { name: 'Удалить сотрудника' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Да, удалить сотрудника' }))

    await waitFor(() => expect(removeMember).toHaveBeenCalledWith('scoped-token', 'manager-member'))
    expect(screen.getByText('Тима Владелец')).toBeInTheDocument()
  })
})
