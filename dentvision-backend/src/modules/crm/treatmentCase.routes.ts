import { Router, Response } from 'express'
import type { AuthRequest } from '../../types/index.js'
import { loadClinicAccess } from '../../middleware/planGate.js'
import { getClinicId } from '../../lib/orgContext.js'
import prisma from '../../lib/prisma.js'

export const treatmentCaseRouter = Router()

function effectiveClinicId(req: AuthRequest): string | undefined {
  return getClinicId(req.user!)
}

// GET /api/crm/cases?patientId=...
treatmentCaseRouter.get('/', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = effectiveClinicId(req)
    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined
    const whereClause: { deletedAt: null; clinicId?: string; patientId?: string } = { deletedAt: null }
    if (clinicId) whereClause.clinicId = clinicId
    if (patientId) whereClause.patientId = patientId
    const cases = await prisma.treatmentCase.findMany({
      where: whereClause,
      include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ ok: true, data: cases })
  } catch (error) {
    console.error('[treatmentCaseRouter] list error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to fetch treatment cases' })
  }
})

// POST /api/crm/cases
treatmentCaseRouter.post('/', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, title, description, status, chiefComplaint, diagnosisCodes } = req.body
    const clinicId = effectiveClinicId(req)
    if (!patientId || !title || !clinicId) {
      return res.status(400).json({ ok: false, error: 'patientId, title, and clinic context are required' })
    }
    const newCase = await prisma.treatmentCase.create({
      data: { clinicId, patientId, title, description, status: status || 'active', chiefComplaint, diagnosisCodes },
    })
    return res.status(201).json({ ok: true, data: newCase })
  } catch (error) {
    console.error('[treatmentCaseRouter] create error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to create treatment case' })
  }
})
