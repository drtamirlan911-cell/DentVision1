import React from 'react'
import { ServiceLayout } from '../ServiceLayout'
import {
  GraduationCap,
  BookOpen,
  Award,
  FileText,
  Library,
} from 'lucide-react'

const SCHOOL_NAV_ITEMS = [
  { id: 'courses', label: 'Курсы', icon: <GraduationCap size={18} />, path: '/school' },
  { id: 'clinical-cases', label: 'Клинические случаи', icon: <BookOpen size={18} />, path: '/school/clinical-cases' },
  { id: 'library', label: 'Библиотека', icon: <Library size={18} />, path: '/school/library' },
  { id: 'certificates', label: 'Сертификаты', icon: <Award size={18} />, path: '/school/certificates' },
]

export function SchoolLayout() {
  return (
    <ServiceLayout
      navItems={SCHOOL_NAV_ITEMS}
      serviceName="DentVision School"
      serviceColor="#27AE60"
      serviceIcon={<GraduationCap size={16} />}
    />
  )
}

export { SCHOOL_NAV_ITEMS }
