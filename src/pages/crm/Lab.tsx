import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FlaskConical, Plus, Printer, Clock, CheckCircle, Package, AlertTriangle,
  Edit, Trash2,
} from 'lucide-react'
import { useData, useToast } from '../../hooks/useData'
import { Button } from '../../components/ui/ds/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/ds/Card'
import { Input, Textarea, Select } from '../../components/ui/ds/Input'
import { Badge, StatusBadge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { PageHeader } from '../../components/ui/ds/StatCard'
import { Tabs } from '../../components/ui/ds/Misc'
import { gid, fd, today } from '../../utils/constants'
import { cn } from '../../lib/utils'
import type { LabOrder, User as UserType, Clinic, RoleInfo } from '../../types'

const STATUS_CFG: Record<string, { label: string; variant: string }> = {
  in_progress: { label: 'В работе', variant: 'info' },
  ready: { label: 'Готово', variant: 'success' },
  delivered: { label: 'Выдано', variant: 'gold' },
  delayed: { label: 'Просрочено', variant: 'error' },
  cancelled: { label: 'Отменено', variant: 'default' },
}

const STATUS_VARIANT: Record<string, string> = { in_progress: 'info', ready: 'success', delivered: 'gold', delayed: 'error', cancelled: 'default' }

const LAB_TYPES = [
  { value: 'crown', label: 'Коронка' },
  { value: 'bridge', label: 'Мост' },
  { value: 'veneer', label: 'Винир' },
  { value: 'implant', label: 'Имплант' },
  { value: 'denture', label: 'Протез' },
  { value: 'nightguard', label: 'Капа' },
  { value: 'other', label: 'Другое' },
]

const MATERIALS = [
  { value: 'ceramic', label: 'Керамика' },
  { value: 'zirconia', label: 'Диоксид циркония' },
  { value: 'metal_ceramic', label: 'Металлокерамика' },
  { value: 'composite', label: 'Композит' },
  { value: 'pmma', label: 'PMMA' },
]

const EMPTY_FORM = {
  patientName: '', doctorId: '', labType: 'crown',
  material: 'zirconia', toothNumber: '', shade: '', dueDate: '', notes: '', status: 'in_progress',
}

const TABS = [
  { id: 'active', label: 'Активные', icon: <Clock size={14} /> },
  { id: 'ready', label: 'Готовые', icon: <CheckCircle size={14} /> },
  { id: 'completed', label: 'Завершённые', icon: <Package size={14} /> },
  { id: 'waxup', label: 'Wax-Up / Smile Design', icon: <FlaskConical size={14} /> },
]

interface OutletContext {
  clinic: Clinic & { id: string }
  user: UserType
  roleInfo?: RoleInfo
}

function escapeHtml(str: string): string {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function printWorkOrder(order: Partial<LabOrder>): void {
  const labTypeLabel = LAB_TYPES.find(t => t.value === order.labType)?.label || order.labType
  const materialLabel = MATERIALS.find(m => m.value === order.material)?.label || order.material
  const printWindow = window.open('', '_blank')
  printWindow!.document.write(`<!DOCTYPE html><html><head><title>Заказ-наряд №${escapeHtml(order.id?.slice(-6) || 'NEW')}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}.header{text-align:center;border-bottom:2px solid #C9A96E;padding-bottom:20px;margin-bottom:30px}.title{font-size:24px;font-weight:bold;color:#C9A96E;margin-bottom:10px}.subtitle{font-size:14px;color:#666}.section{margin-bottom:25px}.section-title{font-size:16px;font-weight:bold;color:#0D1B2E;border-bottom:1px solid #ddd;padding-bottom:8px;margin-bottom:12px}.row{display:flex;justify-content:space-between;margin-bottom:8px}.label{color:#666;font-size:13px}.value{font-weight:600;color:#333;font-size:14px}.highlight{color:#C9A96E}.footer{margin-top:40px;border-top:1px solid #ddd;padding-top:20px;font-size:12px;color:#999;text-align:center}.stamp{margin-top:30px;display:flex;justify-content:space-between}.stamp-box{border:1px solid #333;padding:15px 30px;text-align:center}@media print{body{padding:20px}.no-print{display:none}}</style></head><body>
    <div class="header"><div class="title">ЗАКАЗ-НАРЯД</div><div class="subtitle">Стоматологическая лаборатория DentVision</div></div>
    <div class="section"><div class="section-title">Общая информация</div>
    <div class="row"><span class="label">№ заказа:</span><span class="value highlight">${escapeHtml(order.id?.slice(-6) || 'NEW')}</span></div>
    <div class="row"><span class="label">Дата создания:</span><span class="value">${escapeHtml(fd(order.createdAt || today()))}</span></div>
    <div class="row"><span class="label">Срок готовности:</span><span class="value highlight">${escapeHtml(fd(order.dueDate))}</span></div>
    <div class="row"><span class="label">Статус:</span><span class="value">${escapeHtml(STATUS_CFG[order.status || '']?.label || order.status || '')}</span></div></div>
    <div class="section"><div class="section-title">Пациент</div><div class="row"><span class="label">ФИО:</span><span class="value">${escapeHtml(order.patientName || '')}</span></div></div>
    <div class="section"><div class="section-title">Параметры работы</div>
    <div class="row"><span class="label">Тип работы:</span><span class="value highlight">${escapeHtml(labTypeLabel || '')}</span></div>
    <div class="row"><span class="label">Материал:</span><span class="value highlight">${escapeHtml(materialLabel || '')}</span></div>
    ${order.toothNumber ? `<div class="row"><span class="label">Зуб:</span><span class="value">${escapeHtml(order.toothNumber)}</span></div>` : ''}
    ${order.shade ? `<div class="row"><span class="label">Цвет (Shade):</span><span class="value">${escapeHtml(order.shade)}</span></div>` : ''}</div>
    ${order.notes ? `<div class="section"><div class="section-title">Комментарии</div><div style="background:#f9f9f9;padding:15px;border-radius:8px;font-size:13px;line-height:1.5">${escapeHtml(order.notes)}</div></div>` : ''}
    <div class="stamp"><div class="stamp-box">Врач<br>_____________</div><div class="stamp-box">Техник<br>_____________</div><div class="stamp-box">Пациент<br>_____________</div></div>
    <div class="footer">DentVision Lab | Распечатано: ${new Date().toLocaleString('ru-RU')}</div>
    <button class="no-print" onclick="window.print()" style="margin-top:20px;padding:10px 30px;background:#C9A96E;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">Печать</button>
    <button class="no-print" onclick="window.close()" style="margin-top:20px;margin-left:10px;padding:10px 30px;background:#666;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">Закрыть</button>
    <script>setTimeout(()=>window.print(),500)</script></body></html>`)
  printWindow!.document.close()
}

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export default function Lab() {
  const { clinic } = useOutletContext<OutletContext>()
  const { labOrders, upsertLabOrder, doctors } = useData(clinic?.id)
  const { toast, showToast, clearToast } = useToast()
  const [activeTab, setActiveTab] = useState('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<LabOrder | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const byStatus = (statuses: string[]) => labOrders.filter(o => statuses.includes(o.status))
  const active = byStatus(['in_progress'])
  const ready = byStatus(['ready'])
  const completed = byStatus(['delivered', 'cancelled'])
  const delayed = byStatus(['delayed'])

  const openNew = () => { setEditOrder(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (o: LabOrder) => { setEditOrder(o); setForm({ ...o }); setModalOpen(true) }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.patientName || !form.dueDate) {
      showToast('Укажите пациента и срок готовности', 'warning')
      return
    }
    try {
      const newOrder = { ...form, id: editOrder?.id || gid(), clinicId: clinic?.id }
      await upsertLabOrder(newOrder)
      showToast(editOrder ? 'Заказ обновлён' : 'Заказ создан', 'success')
      if ((form.labType === 'crown' || form.labType === 'bridge') && form.material) {
        printWorkOrder(newOrder)
      }
      setModalOpen(false)
    } catch {
      showToast('Ошибка сохранения', 'error')
    }
  }

  const changeStatus = async (order: LabOrder, newStatus: string) => {
    await upsertLabOrder({ ...order, status: newStatus as any })
    showToast(`Статус изменён: ${STATUS_CFG[newStatus]?.label}`, 'success')
  }

  const displayOrders = activeTab === 'active' ? active
    : activeTab === 'ready' ? ready
    : activeTab === 'completed' ? completed
    : []

  return (
    <div className="p-6">
      <PageHeader
        title="Лаборатория"
        subtitle="Управление лабораторными заказами"
        icon={<FlaskConical size={20} />}
        actions={
          <Button icon={<Plus size={16} />} onClick={openNew}>
            Новый заказ
          </Button>
        }
      />

      {/* KPIs */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {[
          { label: 'В работе', value: active.length, variant: 'info' },
          { label: 'Готово', value: ready.length, variant: 'success' },
          { label: 'Завершено', value: completed.length, variant: 'gold' },
          { label: 'Просрочено', value: delayed.length, variant: 'error' },
        ].map((s, i) => (
          <motion.div key={i} variants={fadeUp}>
            <Card padding="md" className="text-center">
              <p className={cn('text-3xl font-bold', s.variant === 'error' ? 'text-error' : s.variant === 'success' ? 'text-success' : s.variant === 'gold' ? 'text-dv-gold' : 'text-info')}>
                {s.value}
              </p>
              <p className="text-xs text-txt-muted mt-1">{s.label}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-5" />

      {activeTab === 'waxup' ? (
        <Card padding="lg">
          <p className="text-sm font-bold text-txt-primary mb-4">Цифровой Wax-Up / Smile Design</p>
          <label className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-bdr rounded-xl cursor-pointer text-txt-secondary text-sm hover:border-dv-gold/40 hover:text-dv-gold transition-all mb-5">
            <input type="file" className="hidden" accept=".stl,.obj,.dcm,.png,.jpg" multiple
              onChange={() => showToast('Файл загружен для Wax-Up', 'success')} />
            <FlaskConical size={40} className="mb-3 text-txt-muted" />
            <p className="font-semibold text-txt-secondary mb-1">Загрузить файлы для Wax-Up</p>
            <p className="text-xs text-txt-muted">Форматы: STL, OBJ, DICOM, PNG, JPG</p>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl overflow-hidden border border-bdr-subtle bg-white/[0.02]">
                <div className="h-28 bg-gradient-to-br from-info/10 to-accent-purple/10 flex items-center justify-center">
                  <FlaskConical size={36} className="text-txt-muted" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-txt-primary">Wax-Up #{i}</p>
                  <p className="text-xs text-txt-muted">12.01.2025</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : displayOrders.length === 0 ? (
        <EmptyState
          icon={<FlaskConical size={32} />}
          title={`Нет ${activeTab === 'active' ? 'активных' : activeTab === 'ready' ? 'готовых' : 'завершённых'} заказов`}
          description={activeTab === 'active' ? 'Нажмите «+ Новый заказ» для создания' : undefined}
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {displayOrders.map(order => {
            const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== 'delivered'
            const labTypeLabel = LAB_TYPES.find(t => t.value === order.labType)?.label || order.labType
            const materialLabel = MATERIALS.find(m => m.value === order.material)?.label || order.material
            return (
              <motion.div key={order.id} variants={fadeUp}>
                <Card padding="none" className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-txt-primary">{order.patientName}</p>
                        <p className="text-xs text-txt-muted mt-0.5">Создан {fd(order.createdAt || today())}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[order.status] as any || 'default'} size="sm">
                        {STATUS_CFG[order.status]?.label || order.status}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-txt-secondary mb-3">
                      <div className="flex justify-between"><span className="text-txt-muted">Тип:</span><span className="font-semibold text-txt-primary">{labTypeLabel}</span></div>
                      <div className="flex justify-between"><span className="text-txt-muted">Материал:</span><span className="font-semibold text-txt-primary">{materialLabel}</span></div>
                      {order.toothNumber && <div className="flex justify-between"><span className="text-txt-muted">Зуб:</span><span className="font-semibold text-txt-primary">{order.toothNumber}</span></div>}
                      {order.shade && <div className="flex justify-between"><span className="text-txt-muted">Цвет:</span><span className="font-semibold text-dv-gold">{order.shade}</span></div>}
                      {order.dueDate && (
                        <div className="flex justify-between">
                          <span className="text-txt-muted">Срок:</span>
                          <span className={cn('font-semibold', isOverdue ? 'text-error' : 'text-txt-secondary')}>
                            {isOverdue ? '!!! ' : ''}{fd(order.dueDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {order.notes && (
                      <div className="p-2.5 text-xs text-txt-muted rounded-lg bg-white/[0.02] border border-bdr-subtle mb-3">
                        {order.notes}
                      </div>
                    )}

                    <div className="flex gap-1.5 flex-wrap">
                      {order.status === 'in_progress' && (
                        <Button variant="primary" size="sm" onClick={() => changeStatus(order, 'ready')}>Готово</Button>
                      )}
                      {order.status === 'ready' && (
                        <Button variant="primary" size="sm" onClick={() => changeStatus(order, 'delivered')}>Выдать</Button>
                      )}
                      <Button variant="ghost" size="sm" icon={<Edit size={14} />} onClick={() => openEdit(order)}>Изменить</Button>
                      <Button variant="outline" size="sm" icon={<Printer size={14} />} onClick={() => printWorkOrder(order)}>Печать</Button>
                      {order.status === 'in_progress' && (
                        <Button variant="danger" size="sm" icon={<AlertTriangle size={14} />} onClick={() => changeStatus(order, 'delayed')}>Просрочено</Button>
                      )}
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
        title={editOrder ? 'Редактировать заказ' : 'Новый лабораторный заказ'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Пациент" value={form.patientName}
            onChange={e => setForm({ ...form, patientName: e.target.value })}
            required placeholder="ФИО пациента" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Тип работы" value={form.labType}
              onChange={e => setForm({ ...form, labType: e.target.value })}
              options={LAB_TYPES} required />
            <Select label="Материал" value={form.material}
              onChange={e => setForm({ ...form, material: e.target.value })}
              options={MATERIALS} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Номер зуба" value={form.toothNumber}
              onChange={e => setForm({ ...form, toothNumber: e.target.value })}
              placeholder="11, 21, 36..." />
            <Input label="Цвет (Shade)" value={form.shade}
              onChange={e => setForm({ ...form, shade: e.target.value })}
              placeholder="A1, A2, B1..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Срок готовности" type="date" value={form.dueDate}
              onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
            <Select label="Статус" value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
          </div>
          <Input label="Комментарии для техника" value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Особые пожелания, уточнения..." />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">Сохранить</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
