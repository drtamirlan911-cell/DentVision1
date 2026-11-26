import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { getLecturers, getInvitations, createInvitation, revokeInvitation, removeLecturer, toast } = vi.hoisted(() => ({
  getLecturers: vi.fn(),
  getInvitations: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  removeLecturer: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils/api', () => ({
  getManagedSchoolLecturers: getLecturers,
  getOrganizationInvitations: getInvitations,
  createOrganizationInvitation: createInvitation,
  revokeOrganizationInvitation: revokeInvitation,
  removeManagedSchoolLecturer: removeLecturer,
}))

vi.mock('@/components/ui/ds/Toast', () => ({ useToast: () => toast }))

import AcademyTeamTab from './AcademyTeamTab'

beforeEach(() => {
  getLecturers.mockReset().mockResolvedValue([
    { id: 'lecturer-1', userId: 'user-1', firstName: 'Айжан', lastName: 'Преподаватель', email: 'teacher@example.kz', level: 'new', courseCount: 0 },
    { id: 'lecturer-2', userId: 'user-2', firstName: 'Иван', lastName: 'Эксперт', email: 'expert@example.kz', level: 'verified', courseCount: 2 },
  ])
  getInvitations.mockReset().mockResolvedValue({ data: [{ id: 'invite-1', code: 'ACAD1234', role: 'lecturer', email: 'new@example.kz', expiresAt: '2026-12-01T00:00:00.000Z' }] })
  createInvitation.mockReset().mockResolvedValue({ data: { id: 'invite-2', code: 'ACAD5678', role: 'lecturer', email: 'second@example.kz' } })
  revokeInvitation.mockReset().mockResolvedValue({ revoked: true })
  removeLecturer.mockReset().mockResolvedValue({ removed: true })
  toast.success.mockReset()
  toast.error.mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AcademyTeamTab', () => {
  it('lists lecturers and protects teachers who still own courses', async () => {
    render(<AcademyTeamTab organizationId="academy-org-1" />)

    expect(await screen.findByText('Айжан Преподаватель')).toBeInTheDocument()
    expect(screen.getByText('Иван Эксперт')).toBeInTheDocument()
    expect(screen.getByText('ACAD1234')).toBeInTheDocument()
    const removeButtons = screen.getAllByRole('button', { name: 'Удалить преподавателя' })
    expect(removeButtons).toHaveLength(2)
    expect(removeButtons[0]).toBeEnabled()
    expect(removeButtons[1]).toBeDisabled()
  })

  it('creates a lecturer invitation for the active Academy organization', async () => {
    render(<AcademyTeamTab organizationId="academy-org-1" />)
    await screen.findByText('Айжан Преподаватель')
    fireEvent.change(screen.getByLabelText('Email преподавателя (необязательно)'), { target: { value: 'second@example.kz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Пригласить преподавателя' }))

    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith({
      organizationId: 'academy-org-1',
      role: 'lecturer',
      email: 'second@example.kz',
    }))
    expect(await screen.findByText('ACAD5678')).toBeInTheDocument()
  })

  it('revokes a pending lecturer invitation', async () => {
    render(<AcademyTeamTab organizationId="academy-org-1" />)
    await screen.findByText('ACAD1234')
    fireEvent.click(screen.getByRole('button', { name: 'Отозвать приглашение' }))

    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith('invite-1'))
    await waitFor(() => expect(screen.queryByText('ACAD1234')).not.toBeInTheDocument())
  })

  it('removes a lecturer without courses after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AcademyTeamTab organizationId="academy-org-1" />)
    await screen.findByText('Айжан Преподаватель')
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить преподавателя' })[0])

    await waitFor(() => expect(removeLecturer).toHaveBeenCalledWith('lecturer-1'))
    expect(screen.queryByText('Айжан Преподаватель')).not.toBeInTheDocument()
  })
})
