import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, LogIn, MousePointer2, CheckCircle2, Building2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/ds/Button'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Avatar } from '@/components/ui/ds/Avatar'
import { StaggerContainer, StaggerItem } from '@/components/ui/motion'

interface WorkspaceSelectorProps {
  onSelect: (type: 'create' | 'join' | 'demo') => void
}

export function WorkspaceSelector({ onSelect }: WorkspaceSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a12]"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/[0.03] via-transparent to-transparent" />
      
      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-dv-gold/[0.10] to-dv-gold/[0.03] border border-dv-gold/[0.18] mb-6">
            <Building2 size={36} className="text-dv-gold" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">DentVision Workspace</h1>
          <p className="text-white/40 mt-2 text-lg">Выберите способ начала работы</p>
        </motion.div>

        {/* Options */}
        <StaggerContainer staggerChildren={0.1} delayChildren={0.2}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 md:grid-cols-3"
          >
            {/* Create */}
            <StaggerItem>
              <GlassCard
                hover
                padding="lg"
                border="subtle"
                interactive
                onClick={() => onSelect('create')}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: '#C9A96E18', color: '#C9A96E' }}>
                  <Plus size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white/90 mb-2">Создать клинику</h3>
                <p className="text-white/40 text-sm mb-4 flex-1">Название, тип, адрес, тарифный план. Готово за 2 минуты.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="gold" size="xs">Название</Badge>
                  <Badge variant="outline" size="xs">Тип</Badge>
                  <Badge variant="outline" size="xs">Адрес</Badge>
                  <Badge variant="outline" size="xs">Тариф</Badge>
                </div>
                <Button variant="primary" className="w-full" size="lg">
                  <Plus size={16} className="mr-2" />
                  Создать
                </Button>
              </GlassCard>
            </StaggerItem>

            {/* Join */}
            <StaggerItem>
              <GlassCard
                hover
                padding="lg"
                border="subtle"
                interactive
                onClick={() => onSelect('join')}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: '#8E44AD18', color: '#8E44AD' }}>
                  <LogIn size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white/90 mb-2">Присоединиться</h3>
                <p className="text-white/40 text-sm mb-4 flex-1">Код приглашения от владельца клиники. Мгновенный доступ.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" size="xs">Код приглашения</Badge>
                </div>
                <Button variant="secondary" className="w-full" size="lg">
                  <LogIn size={16} className="mr-2" />
                  Присоединиться
                </Button>
              </GlassCard>
            </StaggerItem>

            {/* Demo */}
            <StaggerItem>
              <GlassCard
                hover
                padding="lg"
                border="medium"
                shadow="lg"
                interactive
                onClick={() => onSelect('demo')}
                className="h-full flex flex-col"
                style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))' }}
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: '#C9A96E20', color: '#C9A96E' }}>
                  <Sparkles size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white/90 mb-2">Попробовать демо</h3>
                <p className="text-white/40 text-sm mb-4 flex-1">Готовая клиника с пациентами, расписанием, товарами и курсами. Без регистрации.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="gold" size="xs">Пациенты</Badge>
                  <Badge variant="gold" size="xs">Расписание</Badge>
                  <Badge variant="gold" size="xs">Товары</Badge>
                  <Badge variant="gold" size="xs">Курсы</Badge>
                </div>
                <Button variant="primary" className="w-full" size="lg" style={{ background: 'linear-gradient(135deg, #C9A96E, #C9A96E)' }}>
                  <MousePointer2 size={16} className="mr-2" />
                  Попробовать демо
                </Button>
              </GlassCard>
            </StaggerItem>
          </motion.div>
        </StaggerContainer>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 grid gap-4 md:grid-cols-3 text-center"
        >
          <FeatureIcon icon={<CheckCircle2 size={24} />} color="#27AE60" label="Реальные данные" desc="Пациенты, записи, товары" />
          <FeatureIcon icon={<Sparkles size={24} />} color="#C9A96E" label="AI ассистент" desc="Уже внутри демо" />
          <FeatureIcon icon={<MousePointer2 size={24} />} color="#8E44AD" label="Нет регистрации" desc="Один клик — работаешь" />
        </motion.div>
      </div>
    </motion.div>
  )
}

function FeatureIcon({ icon: Icon, color, label, desc }: { icon: React.ReactNode; color: string; label: string; desc: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl mx-auto mb-3" style={{ background: `${color}20`, color }}>
        {Icon}
      </div>
      <p className="text-sm font-semibold text-white/90">{label}</p>
      <p className="text-[10px] text-white/30">{desc}</p>
    </div>
  )
}

export interface ClinicSelectorProps {
  clinics: Array<{
    id: string
    name: string
    city: string
    doctors: number
    patients: number
    plan: 'demo' | 'standard' | 'pro' | 'enterprise'
  }>
  onSelect: (clinicId: string) => void
  onCreateNew: () => void
}

export function ClinicSelector({ clinics, onSelect, onCreateNew }: ClinicSelectorProps) {
  const planColors = {
    demo: '#95A5A6',
    standard: '#3498DB',
    pro: '#C9A96E',
    enterprise: '#8E44AD',
  }

  const planLabels = {
    demo: 'Демо',
    standard: 'Стандарт',
    pro: 'Профессионал',
    enterprise: 'Enterprise',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a12]"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/[0.03] via-transparent to-transparent" />
      
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Выберите клинику</h1>
          <p className="text-white/40">Ваш рабочий контекст</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {clinics.map((clinic, i) => (
            <motion.button
              key={clinic.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => onSelect(clinic.id)}
              className="w-full"
            >
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                  'relative p-5 rounded-2xl border text-left transition-all',
                  'bg-gradient-to-br from-white/[0.06] to-white/[0.02]',
                  'border-white/[0.06] hover:border-white/10 hover:bg-white/[0.08]',
                  'shadow-xl shadow-black/20'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl" style={{ background: '#C9A96E18', color: '#C9A96E' }}>
                    <Building2 size={28} className="text-dv-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white/90 truncate">{clinic.name}</h3>
                      <Badge variant="outline" size="xs">{planLabels[clinic.plan]}</Badge>
                    </div>
                    <p className="text-white/40 text-sm">{clinic.city}</p>
                    <div className="flex items-center gap-4 mt-3 text-[10px] text-white/30">
                      <span className="flex items-center gap-1"><Users size={10} /> {clinic.doctors} врачей</span>
                      <span className="flex items-center gap-1"><Users size={10} /> {clinic.patients} пациентов</span>
                      <Badge variant="gold" size="xs">{clinic.plan}</Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.button>
          ))}
        </motion.div>

        {/* Create New */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onCreateNew}
          className="w-full mt-4"
        >
          <div className="flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-white/[0.12] text-white/40 hover:border-dv-gold/30 hover:text-dv-gold hover:bg-dv-gold/[0.03] transition-all">
            <Plus size={20} />
            <span className="text-sm font-medium">Создать новую клинику</span>
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}

export default WorkspaceSelector