import React, { useState, type ChangeEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DollarSign, Download, Edit, RotateCcw } from 'lucide-react'
import { useData, useToast } from '../../hooks/useData'
import { Button } from '../../components/ui/ds/Button'
import { Card } from '../../components/ui/ds/Card'
import { Input } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard'
import { T, tg, ALL_SERVICES } from '../../utils/constants'
import { cn } from '../../lib/utils'
import type { Clinic, User, RoleInfo } from '../../types'

const CATEGORIES = [...new Set(ALL_SERVICES.map(s => s.cat))]

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export default function PriceList() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const { toast, showToast, clearToast } = useToast()
  const [clinicPrices, setClinicPrices] = useState<Record<string, number>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<{ id: string; cat: string; name: string; price: number } | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const getServicePrice = (serviceId: string): number => {
    const custom = clinicPrices[serviceId]
    const base = ALL_SERVICES.find(s => s.id === serviceId)
    return custom !== undefined ? custom : base?.price || 0
  }

  const handleSavePrice = (serviceId: string, newPrice: number) => {
    setClinicPrices(prev => ({ ...prev, [serviceId]: Number(newPrice) }))
  }

  const filteredServices = selectedCategory === 'all'
    ? ALL_SERVICES
    : ALL_SERVICES.filter(s => s.cat === selectedCategory)

  const openEdit = (service: { id: string; cat: string; name: string; price: number }) => {
    setEditingService({ ...service, price: getServicePrice(service.id) })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!editingService || editingService.price <= 0) {
      showToast('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Г╤О ╤Ж╨╡╨╜╤Г', 'warning')
      return
    }
    handleSavePrice(editingService.id, editingService.price)
    showToast(`╨ж╨╡╨╜╨░ ╨╜╨░ "${editingService.name}" ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨░`, 'success')
    setModalOpen(false)
    setEditingService(null)
  }

  const handleReset = (serviceId: string) => {
    setClinicPrices(prev => { const next = { ...prev }; delete next[serviceId]; return next })
    showToast('╨ж╨╡╨╜╨░ ╤Б╨▒╤А╨╛╤И╨╡╨╜╨░ ╨║ ╤Б╤В╨░╨╜╨┤╨░╤А╤В╨╜╨╛╨╣', 'success')
  }

  return (
    <div className="p-6">
      <PageHeader
        title="╨Я╤А╨░╨╣╤Б-╨╗╨╕╤Б╤В"
        subtitle={`${clinic?.name} ┬╖ ╨Ш╨╜╨┤╨╕╨▓╨╕╨┤╤Г╨░╨╗╤М╨╜╤Л╨╡ ╤Ж╨╡╨╜╤Л ╨┤╨╗╤П ╨║╨╗╨╕╨╜╨╕╨║╨╕`}
        icon={<DollarSign size={20} />}
        actions={
          <Button variant="secondary" icon={<Download size={16} />}
            onClick={() => showToast('╨Я╤А╨░╨╣╤Б ╤Н╨║╤Б╨┐╨╛╤А╤В╨╕╤А╨╛╨▓╨░╨╜ ╨▓ Excel', 'success')}>
            ╨н╨║╤Б╨┐╨╛╤А╤В
          </Button>
        }
      />

      {/* Category filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <Button variant={selectedCategory === 'all' ? 'outline' : 'ghost'} size="sm"
          onClick={() => setSelectedCategory('all')}
          className={selectedCategory === 'all' ? 'border-dv-gold/50 text-dv-gold' : ''}>
          ╨Т╤Б╨╡ ╤Г╤Б╨╗╤Г╨│╨╕
        </Button>
        {CATEGORIES.map(cat => (
          <Button key={cat} variant={selectedCategory === cat ? 'outline' : 'ghost'} size="sm"
            onClick={() => setSelectedCategory(cat)}
            className={selectedCategory === cat ? 'border-dv-gold/50 text-dv-gold' : ''}>
            {cat}
          </Button>
        ))}
      </div>

      {/* Services table */}
      <Card padding="none" className="overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-bdr-subtle">
                {['╨г╤Б╨╗╤Г╨│╨░', '╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╤П', '╨С╨░╨╖╨╛╨▓╨░╤П ╤Ж╨╡╨╜╨░', '╨ж╨╡╨╜╨░ ╨║╨╗╨╕╨╜╨╕╨║╨╕', '╨Ф╨╡╨╣╤Б╤В╨▓╨╕╤П'].map(h => (
                  <th key={h} className={cn(
                    'py-3 px-4 text-2xs font-bold text-txt-muted uppercase tracking-wider',
                    h === '╨С╨░╨╖╨╛╨▓╨░╤П ╤Ж╨╡╨╜╨░' || h === '╨ж╨╡╨╜╨░ ╨║╨╗╨╕╨╜╨╕╨║╨╕' || h === '╨Ф╨╡╨╣╤Б╤В╨▓╨╕╤П' ? 'text-right' : 'text-left'
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service, idx) => {
                const basePrice = service.price
                const clinicPrice = getServicePrice(service.id)
                const isCustom = clinicPrice !== basePrice
                return (
                  <tr key={service.id} className={cn('border-b border-bdr-subtle last:border-b-0', idx % 2 !== 0 && 'bg-white/[0.01]')}>
                    <td className="py-3 px-4 text-sm font-semibold text-txt-primary">{service.name}</td>
                    <td className="py-3 px-4"><Badge variant="info" size="sm">{service.cat}</Badge></td>
                    <td className="py-3 px-4 text-right text-sm text-txt-secondary">{tg(basePrice)}</td>
                    <td className={cn('py-3 px-4 text-right text-sm font-bold', isCustom ? 'text-dv-gold' : 'text-success')}>
                      {tg(clinicPrice)}
                      {isCustom && <span className="ml-1 text-warning">*</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon-sm" icon={<Edit size={14} />} onClick={() => openEdit(service)} />
                        {isCustom && (
                          <Button variant="ghost" size="icon-sm" icon={<RotateCcw size={14} />}
                            onClick={() => handleReset(service.id)} className="text-error/60 hover:text-error" />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="╨Ш╨╖╨╝╨╡╨╜╤С╨╜╨╜╤Л╤Е ╤Ж╨╡╨╜" value={Object.keys(clinicPrices).length} icon={<DollarSign size={18} />} />
        <StatCard label="╨Т╤Б╨╡╨│╨╛ ╤Г╤Б╨╗╤Г╨│" value={ALL_SERVICES.length} icon={<DollarSign size={18} />} />
      </div>

      {/* Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? `╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╤Ж╨╡╨╜╤Г: ${editingService.name}` : '╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╤Ж╨╡╨╜╤Г'}
        size="md"
      >
        {editingService && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-txt-secondary mb-1">╨С╨░╨╖╨╛╨▓╨░╤П ╤Ж╨╡╨╜╨░:</p>
              <p className="text-lg font-bold text-txt-secondary">{tg(editingService.price)}</p>
            </div>
            <Input
              label="╨ж╨╡╨╜╨░ ╨┤╨╗╤П ╨║╨╗╨╕╨╜╨╕╨║╨╕ (тВ╕)"
              type="number"
              value={editingService.price}
              onChange={e => setEditingService({ ...editingService, price: Number(e.target.value) })}
              autoFocus
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1">╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М</Button>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
