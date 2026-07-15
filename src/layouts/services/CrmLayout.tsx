import React from 'react'
import { ServiceLayout } from '../ServiceLayout'
import {
  Calendar,
  Users,
  Stethoscope,
  ClipboardList,
  BookOpen,
  FileText,
  DollarSign,
  FlaskConical,
  Package,
  Megaphone,
  UserCog,
  Bot,
} from 'lucide-react'

const CRM_NAV_ITEMS = [
  { id: 'schedule', label: 'Расписание', icon: <Calendar size={18} />, path: '/crm/schedule' },
  { id: 'patients', label: 'Пациенты', icon: <Users size={18} />, path: '/crm/patients' },
  { id: 'medical-card', label: 'Мед. карты', icon: <Stethoscope size={18} />, path: '/crm/medical-card' },
  { id: 'visits', label: 'Журнал посещений', icon: <ClipboardList size={18} />, path: '/crm/visits' },
  { id: 'icd10', label: 'МКБ-10', icon: <BookOpen size={18} />, path: '/crm/icd10' },
  { id: 'documents', label: 'Документы', icon: <FileText size={18} />, path: '/crm/documents' },
  { id: 'cashier', label: 'Финансы', icon: <DollarSign size={18} />, path: '/crm/cashier', badge: 'gold' },
  { id: 'pricelist', label: 'Прайс-лист', icon: <FileText size={18} />, path: '/crm/pricelist' },
  { id: 'lab', label: 'Лаборатория', icon: <FlaskConical size={18} />, path: '/crm/lab' },
  { id: 'inventory', label: 'Склад', icon: <Package size={18} />, path: '/crm/inventory' },
  { id: 'promotions', label: 'Акции', icon: <Megaphone size={18} />, path: '/crm/promotions' },
  { id: 'staff', label: 'Сотрудники', icon: <UserCog size={18} />, path: '/crm/staff' },
  { id: 'ai', label: 'AI Помощник', icon: <Bot size={18} />, path: '/ai' },
]

export function CrmLayout() {
  return (
    <ServiceLayout
      navItems={CRM_NAV_ITEMS}
      serviceName="DentVision CRM"
      serviceColor="#C9A96E"
      serviceIcon={<Stethoscope size={16} />}
    />
  )
}

export { CRM_NAV_ITEMS }
