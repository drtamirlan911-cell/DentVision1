import prisma from '../../../lib/prisma.js'
import { buildSystemPrompt } from './system.prompt.js'

export interface ClinicContext {
  clinicId: string
  clinicName: string
  address: string
  phone: string
  workingHours: string
  services: Array<{ name: string; price: number; priceTo?: number }>
  doctors: Array<{ name: string; specialty: string }>
  systemPrompt: string
}

const contextCache = new Map<string, { data: ClinicContext; expiresAt: number }>()

export async function buildContext(clinicId: string): Promise<ClinicContext> {
  const cached = contextCache.get(clinicId)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { name: true, address: true, phone: true },
  })

  const services = await prisma.priceListItem.findMany({
    where: { clinicId, active: true },
    select: { name: true, price: true },
    orderBy: { name: 'asc' },
    take: 30,
  }).catch(() => [])

  const doctors = await prisma.clinicMember.findMany({
    where: { clinicId, role: 'DOCTOR' },
    select: { user: { select: { firstName: true, lastName: true, spec: true } } },
  }).catch(() => [])

  const ctx: ClinicContext = {
    clinicId,
    clinicName: clinic.name,
    address: clinic.address ?? '',
    phone: clinic.phone ?? '',
    workingHours: 'Пн-Пт 9:00-19:00, Сб 10:00-16:00',
    services: services.map((s: any) => ({
      name: s.name ?? '',
      price: Number(s.price ?? 0),
    })),
    doctors: doctors.map((d: any) => ({
      name: `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim() || 'Врач',
      specialty: d.user?.spec ?? 'стоматолог',
    })),
    systemPrompt: '',
  }

  ctx.systemPrompt = buildSystemPrompt(ctx)

  contextCache.set(clinicId, { data: ctx, expiresAt: Date.now() + 10 * 60 * 1000 })
  return ctx
}
