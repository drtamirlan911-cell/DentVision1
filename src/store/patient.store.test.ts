import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/api', () => ({
  getPatient: vi.fn(),
  getPatientSummary: vi.fn(),
  getMedicalCard: vi.fn(),
}))

import * as api from '@/utils/api'
import { usePatientStore } from './patient.store'

beforeEach(() => {
  vi.clearAllMocks()
  usePatientStore.setState({
    selectedPatient: null,
    patientData: null,
    loading: false,
  })
})

describe('patient context access boundary', () => {
  it('keeps an operational patient selection without fetching clinical or financial data', async () => {
    await usePatientStore.getState().openPatient('patient-1', {
      clinicalChart: false,
      billingSummary: false,
    })

    expect(usePatientStore.getState()).toMatchObject({
      selectedPatient: 'patient-1',
      patientData: null,
      loading: false,
    })
    expect(api.getPatient).not.toHaveBeenCalled()
    expect(api.getPatientSummary).not.toHaveBeenCalled()
    expect(api.getMedicalCard).not.toHaveBeenCalled()
  })

  it('does not request a financial summary without billing permission', async () => {
    vi.mocked(api.getPatient).mockResolvedValue({
      id: 'patient-1',
      firstName: 'Иван',
      lastName: 'Петров',
    } as any)
    vi.mocked(api.getMedicalCard).mockResolvedValue({} as any)

    await usePatientStore.getState().openPatient('patient-1', {
      clinicalChart: true,
      billingSummary: false,
    })

    expect(api.getPatient).toHaveBeenCalledOnce()
    expect(api.getMedicalCard).toHaveBeenCalledOnce()
    expect(api.getPatientSummary).not.toHaveBeenCalled()
    expect(usePatientStore.getState().patientData?.name).toBe('Петров Иван')
  })

  it('invalidates an in-flight chart response when patient context is closed', async () => {
    let resolvePatient: ((value: any) => void) | undefined
    vi.mocked(api.getPatient).mockImplementation(() => new Promise((resolve) => {
      resolvePatient = resolve
    }))
    vi.mocked(api.getMedicalCard).mockResolvedValue({} as any)

    const pending = usePatientStore.getState().openPatient('patient-1', {
      clinicalChart: true,
      billingSummary: false,
    })
    usePatientStore.getState().closePatient()
    resolvePatient?.({ id: 'patient-1', firstName: 'Иван', lastName: 'Петров' })
    await pending

    expect(usePatientStore.getState()).toMatchObject({
      selectedPatient: null,
      patientData: null,
      loading: false,
    })
  })
})
