import React, { useState, useMemo, type FormEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Target, Plus, Calendar, Percent } from 'lucide-react'
import { useToast } from '../../hooks/useData'
import { Button } from '../../components/ui/ds/Button'
import { Card } from '../../components/ui/ds/Card'
import { Input, Textarea } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard'
import { Switch } from '../../components/ui/ds/Misc'
import { gid, today, ALL_SERVICES } from '../../utils/constants'
import { useData } from '../../hooks/useData'
import { cn } from '../../lib/utils'
import type { Clinic, User, RoleInfo, Promotion } from '../../types'

interface PromotionForm {
  title: string;
  description: string;
  discountPercent: number;
  serviceIds: string[];
  startDate: string;
  endDate: string;
  active: boolean;
}

const EMPTY_FORM: PromotionForm = {
  title: '', description: '', discountPercent: 0,
  serviceIds: [], startDate: today(), endDate: '', active: true,
}

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export default function Promotions() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const { showToast, toast, clearToast } = useToast()
  const { promotions, upsertPromotion } = useData(clinic?.id)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<PromotionForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return promotions
    if (filter === 'active') return promotions.filter(p => p.active && (!p.endDate || p.endDate >= today()))
    if (filter === 'inactive') return promotions.filter(p => !p.active)
    if (filter === 'expired') return promotions.filter(p => p.endDate && p.endDate < today())
    return promotions
  }, [promotions, filter])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { showToast('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨░╨║╤Ж╨╕╨╕', 'warning'); return }
    upsertPromotion({
      ...form,
      id: editing?.id || gid(),
      clinicId: clinic?.id,
      discountPercent: Number(form.discountPercent) || 0,
      serviceIds: form.serviceIds || [],
    })
    showToast(editing ? '╨Р╨║╤Ж╨╕╤П ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨░' : '╨Р╨║╤Ж╨╕╤П ╤Б╨╛╨╖╨┤╨░╨╜╨░', 'success')
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditing(null)
  }

  const openEdit = (promo: Promotion) => {
    setEditing(promo)
    setForm({
      title: promo.title || '', description: promo.description || '',
      discountPercent: promo.discountPercent || 0, serviceIds: promo.serviceIds || [],
      startDate: promo.startDate || today(), endDate: promo.endDate || '',
      active: promo.active !== false,
    })
    setModalOpen(true)
  }

  const toggleService = (serviceId: string) => {
    setForm(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }))
  }

  const stats = useMemo(() => ({
    total: promotions.length,
    active: promotions.filter(p => p.active && (!p.endDate || p.endDate >= today())).length,
    expired: promotions.filter(p => p.endDate && p.endDate < today()).length,
  }), [promotions])

  return (
    <div className="p-6">
      <PageHeader
        title="╨Р╨║╤Ж╨╕╨╕ ╨╕ ╨┐╤А╨╛╨╝╨╛╤Ж╨╕╨╕"
        subtitle={`${clinic?.name} ┬╖ ${stats.active} ╨░╨║╤В╨╕╨▓╨╜╤Л╤Е`}
        icon={<Target size={20} />}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }}>
            ╨Э╨╛╨▓╨░╤П ╨░╨║╤Ж╨╕╤П
          </Button>
        }
      />

      <motion.div
        className="grid grid-cols-3 gap-3 mb-5"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <StatCard label="╨Т╤Б╨╡╨│╨╛" value={stats.total} icon={<Target size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="╨Р╨║╤В╨╕╨▓╨╜╤Л╤Е" value={stats.active} icon={<Calendar size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="╨Ш╤Б╤В╤С╨║╤И╨╕╤Е" value={stats.expired} icon={<Calendar size={18} />} />
        </motion.div>
      </motion.div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'all', label: '╨Т╤Б╨╡' },
          { key: 'active', label: '╨Р╨║╤В╨╕╨▓╨╜╤Л╨╡' },
          { key: 'inactive', label: '╨Э╨╡╨░╨║╤В╨╕╨▓╨╜╤Л╨╡' },
          { key: 'expired', label: '╨Ш╤Б╤В╤С╨║╤И╨╕╨╡' },
        ].map(f => (
          <Button key={f.key} variant={filter === f.key ? 'outline' : 'ghost'} size="sm"
            onClick={() => setFilter(f.key)}
            className={filter === f.key ? 'border-dv-gold/50 text-dv-gold' : ''}>
            {f.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Target size={32} />} title="╨Э╨╡╤В ╨░╨║╤Ж╨╕╨╣" description="╨б╨╛╨╖╨┤╨░╨╣╤В╨╡ ╨┐╨╡╤А╨▓╤Г╤О ╨┐╤А╨╛╨╝╨╛╤Ж╨╕╤О" />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {filtered.map(promo => {
            const isExpired = promo.endDate && promo.endDate < today()
            const statusVariant = isExpired ? 'error' : promo.active ? 'success' : 'default'
            return (
              <motion.div key={promo.id} variants={fadeUp}>
                <Card hover padding="none" className="overflow-hidden cursor-pointer group" onClick={() => openEdit(promo)}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Target size={14} className="text-dv-gold shrink-0" />
                          <p className="text-sm font-bold text-txt-primary group-hover:text-dv-gold transition-colors truncate">{promo.title}</p>
                        </div>
                        {(promo.discountPercent ?? 0) > 0 && (
                          <Badge variant="error" size="sm">
                            <Percent size={10} /> -{promo.discountPercent}%
                          </Badge>
                        )}
                      </div>
                      <Badge variant={statusVariant} size="sm">
                        {isExpired ? '╨Ш╤Б╤В╨╡╨║╨╗╨░' : promo.active ? '╨Р╨║╤В╨╕╨▓╨╜╨░' : '╨Э╨╡╨░╨║╤В╨╕╨▓╨╜╨░'}
                      </Badge>
                    </div>
                    {promo.description && (
                      <p className="text-xs text-txt-secondary mb-2 line-clamp-2 leading-relaxed">{promo.description}</p>
                    )}
                    <div className="flex gap-3 text-xs text-txt-muted">
                      {promo.startDate && <span>╨б {promo.startDate}</span>}
                      {promo.endDate && <span>╨Ф╨╛ {promo.endDate}</span>}
                      {promo.serviceIds && promo.serviceIds.length > 0 && <span>{promo.serviceIds.length} ╤Г╤Б╨╗╤Г╨│</span>}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╨░╨║╤Ж╨╕╤О' : '╨Э╨╛╨▓╨░╤П ╨░╨║╤Ж╨╕╤П'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ *" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="╨б╨║╨╕╨┤╨║╨░ ╨╜╨░ ╨╛╤В╨▒╨╡╨╗╨╕╨▓╨░╨╜╨╕╨╡" required icon={<Target size={16} />} />
          <Textarea label="╨Ю╨┐╨╕╤Б╨░╨╜╨╕╨╡" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="╨Я╨╛╨┤╤А╨╛╨▒╨╜╨╛╨╡ ╨╛╨┐╨╕╤Б╨░╨╜╨╕╨╡ ╨░╨║╤Ж╨╕╨╕..." rows={3} />
          <div className="grid grid-cols-2 gap-3 items-end">
            <Input label="╨б╨║╨╕╨┤╨║╨░ (%)" type="number" min="0" max="100" value={form.discountPercent}
              onChange={e => setForm({ ...form, discountPercent: Number(e.target.value) })} />
            <Switch checked={form.active} onCheckedChange={(v: boolean) => setForm({ ...form, active: v })} label="╨Р╨║╤В╨╕╨▓╨╜╨░" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="╨Ф╨░╤В╨░ ╨╜╨░╤З╨░╨╗╨░" type="date" value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })} />
            <Input label="╨Ф╨░╤В╨░ ╨╛╨║╨╛╨╜╤З╨░╨╜╨╕╤П" type="date" value={form.endDate}
              onChange={e => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div>
            <p className="text-xs font-semibold text-txt-secondary mb-2">╨г╤Б╨╗╤Г╨│╨╕ (╨░╨║╤Ж╨╕╤П ╨╜╨░)</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SERVICES.slice(0, 14).map(s => {
                const selected = form.serviceIds?.includes(s.id)
                return (
                  <Button key={s.id} type="button" size="xs"
                    variant={selected ? 'outline' : 'ghost'}
                    onClick={() => toggleService(s.id)}
                    className={selected ? 'border-dv-gold/50 text-dv-gold' : ''}>
                    {s.name}
                  </Button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">{editing ? '╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М' : '╨б╨╛╨╖╨┤╨░╤В╤М'}</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
