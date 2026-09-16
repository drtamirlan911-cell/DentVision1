import { Router, Response } from 'express'
import type { AuthRequest } from '../../types/index.js'
import { loadClinicAccess } from '../../middleware/planGate.js'
import { getClinicId } from '../../lib/orgContext.js'
import prisma from '../../lib/prisma.js'
import { CaseStatus } from '@prisma/client'

export const treatmentCaseRouter = Router()

function effectiveClinicId(req: AuthRequest): string | undefined {
  return getClinicId(req.user!)
}

async function clinicCase(caseId: string, clinicId: string) {
  return prisma.treatmentCase.findFirst({
    where: { id: caseId, clinicId, deletedAt: null },
    include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  })
}

// GET /api/crm/cases?patientId=...
treatmentCaseRouter.get('/', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = effectiveClinicId(req)
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Clinic context is required' })

    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined
    const whereClause: { deletedAt: null; clinicId: string; patientId?: string } = { deletedAt: null, clinicId }
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

// GET /api/crm/cases/:id — canonical case plus its linked ecosystem records.
treatmentCaseRouter.get('/:id', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = effectiveClinicId(req)
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Clinic context is required' })

    const caseRow = await clinicCase(req.params.id, clinicId)
    if (!caseRow) return res.status(404).json({ ok: false, error: 'Treatment case not found' })

    const caseId = caseRow.id
    const [appointments, labOrders, invoices, treatmentPlans, referrals, visits] = await Promise.all([
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, "patientId", "doctorId", date, time, duration, status, type, notes
        FROM appointments
        WHERE "clinicId" = ${clinicId} AND "treatmentCaseId" = ${caseId}
        ORDER BY date ASC, time ASC
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, "patientId", "doctorId", "labName", status, type, notes, deadline, price
        FROM lab_orders
        WHERE "clinicId" = ${clinicId} AND "treatmentCaseId" = ${caseId}
        ORDER BY "createdAt" DESC
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, "patientId", amount, status, "paidAt", "treatmentPlanId"
        FROM invoices
        WHERE "clinicId" = ${clinicId} AND "treatmentCaseId" = ${caseId}
        ORDER BY "createdAt" DESC
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, "patientId", title, status, price
        FROM treatment_plans
        WHERE ("clinicId" = ${clinicId} OR "clinicId" IS NULL) AND "treatmentCaseId" = ${caseId}
        ORDER BY "createdAt" DESC
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, "patientId", "doctorId", "centerId", "labId", status, category, priority, "createdAt", "updatedAt"
        FROM referrals
        WHERE "clinicId" = ${clinicId} AND "treatmentCaseId" = ${caseId}
        ORDER BY "createdAt" DESC
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, "patientId", "doctorId", date, diagnosis, complaints, anamnesis, treatment, notes
        FROM visits
        WHERE "treatmentCaseId" = ${caseId}
        ORDER BY date DESC
      `,
    ])

    return res.json({
      ok: true,
      data: {
        ...caseRow,
        graph: { appointments, labOrders, invoices, treatmentPlans, referrals, visits },
        counts: {
          appointments: appointments.length,
          labOrders: labOrders.length,
          invoices: invoices.length,
          treatmentPlans: treatmentPlans.length,
          referrals: referrals.length,
          visits: visits.length,
        },
      },
    })
  } catch (error) {
    console.error('[treatmentCaseRouter] detail error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to fetch treatment case graph' })
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

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) return res.status(404).json({ ok: false, error: 'Patient not found in the active clinic' })

    const requestedStatus = status === undefined ? CaseStatus.active : status
    if (!Object.values(CaseStatus).includes(requestedStatus)) {
      return res.status(400).json({ ok: false, error: 'Invalid treatment case status' })
    }

    const newCase = await prisma.treatmentCase.create({
      data: { clinicId, patientId: patient.id, title, description, status: requestedStatus, chiefComplaint, diagnosisCodes },
    })
    return res.status(201).json({ ok: true, data: newCase })
  } catch (error) {
    console.error('[treatmentCaseRouter] create error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to create treatment case' })
  }
})

// PATCH /api/crm/cases/:id
treatmentCaseRouter.patch('/:id', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = effectiveClinicId(req)
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Clinic context is required' })
    const existing = await clinicCase(req.params.id, clinicId)
    if (!existing) return res.status(404).json({ ok: false, error: 'Treatment case not found' })

    const { title, description, status, chiefComplaint, diagnosisCodes, metadata } = req.body || {}
    if (status !== undefined && !Object.values(CaseStatus).includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid treatment case status' })
    }

    const updated = await prisma.treatmentCase.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description: description === null ? null : String(description) } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(chiefComplaint !== undefined ? { chiefComplaint: chiefComplaint === null ? null : String(chiefComplaint) } : {}),
        ...(diagnosisCodes !== undefined ? { diagnosisCodes } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
      include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    })
    return res.json({ ok: true, data: updated })
  } catch (error) {
    console.error('[treatmentCaseRouter] update error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to update treatment case' })
  }
})

const LINK_TARGETS = ['appointment', 'labOrder', 'invoice', 'treatmentPlan', 'referral', 'visit'] as const
type LinkTarget = typeof LINK_TARGETS[number]

async function assertLinkTarget(target: LinkTarget, recordId: string, clinicId: string, patientId: string): Promise<boolean> {
  switch (target) {
    case 'appointment': {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM appointments
        WHERE id = ${recordId} AND "clinicId" = ${clinicId} AND "patientId" = ${patientId}
        LIMIT 1`
      return rows.length > 0
    }
    case 'labOrder': {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM lab_orders
        WHERE id = ${recordId} AND "clinicId" = ${clinicId} AND ("patientId" = ${patientId} OR "patientId" IS NULL)
        LIMIT 1`
      return rows.length > 0
    }
    case 'invoice': {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM invoices
        WHERE id = ${recordId} AND "clinicId" = ${clinicId} AND ("patientId" = ${patientId} OR "patientId" IS NULL)
        LIMIT 1`
      return rows.length > 0
    }
    case 'treatmentPlan': {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM treatment_plans
        WHERE id = ${recordId} AND ("clinicId" = ${clinicId} OR "clinicId" IS NULL) AND "patientId" = ${patientId}
        LIMIT 1`
      return rows.length > 0
    }
    case 'referral': {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM referrals
        WHERE id = ${recordId} AND "clinicId" = ${clinicId} AND ("patientId" = ${patientId} OR "patientId" IS NULL)
        LIMIT 1`
      return rows.length > 0
    }
    case 'visit': {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT v.id FROM visits v
        JOIN patients p ON p.id = v."patientId"
        WHERE v.id = ${recordId} AND p."clinicId" = ${clinicId} AND v."patientId" = ${patientId}
        LIMIT 1`
      return rows.length > 0
    }
  }
}

async function setLink(target: LinkTarget, recordId: string, caseId: string | null): Promise<void> {
  switch (target) {
    case 'appointment':
      await prisma.$executeRawUnsafe(`UPDATE appointments SET "treatmentCaseId" = $1 WHERE id = $2`, caseId, recordId)
      return
    case 'labOrder':
      await prisma.$executeRawUnsafe(`UPDATE lab_orders SET "treatmentCaseId" = $1 WHERE id = $2`, caseId, recordId)
      return
    case 'invoice':
      await prisma.$executeRawUnsafe(`UPDATE invoices SET "treatmentCaseId" = $1 WHERE id = $2`, caseId, recordId)
      return
    case 'treatmentPlan':
      await prisma.$executeRawUnsafe(`UPDATE treatment_plans SET "treatmentCaseId" = $1 WHERE id = $2`, caseId, recordId)
      return
    case 'referral':
      await prisma.$executeRawUnsafe(`UPDATE referrals SET "treatmentCaseId" = $1 WHERE id = $2`, caseId, recordId)
      return
    case 'visit':
      await prisma.$executeRawUnsafe(`UPDATE visits SET "treatmentCaseId" = $1 WHERE id = $2`, caseId, recordId)
      return
  }
}

// POST /api/crm/cases/:id/links — attach an existing ecosystem record to the canonical case.
treatmentCaseRouter.post('/:id/links', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = effectiveClinicId(req)
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Clinic context is required' })
    const existing = await clinicCase(req.params.id, clinicId)
    if (!existing) return res.status(404).json({ ok: false, error: 'Treatment case not found' })

    const target = String(req.body?.target || '') as LinkTarget
    const recordId = String(req.body?.recordId || '')
    if (!LINK_TARGETS.includes(target) || !recordId) return res.status(400).json({ ok: false, error: 'target and recordId are required' })
    if (!(await assertLinkTarget(target, recordId, clinicId, existing.patientId))) {
      return res.status(404).json({ ok: false, error: 'Record not found in this case patient/clinic scope' })
    }

    await setLink(target, recordId, existing.id)
    return res.json({ ok: true, data: { target, recordId, caseId: existing.id } })
  } catch (error) {
    console.error('[treatmentCaseRouter] link error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to link record to treatment case' })
  }
})

// DELETE /api/crm/cases/:id/links — unlink an ecosystem record without deleting it.
treatmentCaseRouter.delete('/:id/links', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = effectiveClinicId(req)
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Clinic context is required' })
    const existing = await clinicCase(req.params.id, clinicId)
    if (!existing) return res.status(404).json({ ok: false, error: 'Treatment case not found' })

    const target = String(req.body?.target || '') as LinkTarget
    const recordId = String(req.body?.recordId || '')
    if (!LINK_TARGETS.includes(target) || !recordId) return res.status(400).json({ ok: false, error: 'target and recordId are required' })
    await setLink(target, recordId, null)
    return res.json({ ok: true, data: { target, recordId, caseId: existing.id, linked: false } })
  } catch (error) {
    console.error('[treatmentCaseRouter] unlink error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to unlink record from treatment case' })
  }
})

// DELETE /api/crm/cases/:id — archive, never hard-delete a clinical case.
treatmentCaseRouter.delete('/:id', loadClinicAccess, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = effectiveClinicId(req)
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Clinic context is required' })
    const existing = await clinicCase(req.params.id, clinicId)
    if (!existing) return res.status(404).json({ ok: false, error: 'Treatment case not found' })

    await prisma.treatmentCase.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: CaseStatus.archived } })
    return res.json({ ok: true, data: { id: existing.id, archived: true } })
  } catch (error) {
    console.error('[treatmentCaseRouter] archive error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to archive treatment case' })
  }
})
