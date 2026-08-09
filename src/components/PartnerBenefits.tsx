import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Box,
  GraduationCap,
  Inbox,
  Megaphone,
  Sparkles,
  Store,
  UserPlus,
  Wallet,
} from 'lucide-react'

/**
 * "What this gives you" for every screen that asks someone to become a partner.
 *
 * There are three of them — diagnostics, supplier, lecturer — and each was a
 * bare form: fill this in, and find out afterwards what you signed up for.
 * Written once here so the three stay consistent and so a claim is added in one
 * place rather than three.
 *
 * Every line points at something that exists in the product today. Each list
 * below names the tab or flow it describes, so a claim that stops being true
 * has a place to be caught.
 */

export interface Benefit {
  icon: LucideIcon
  title: string
  body: string
}

/** Diagnostic centre / laboratory — `pages/diagnostics/workspace/*`. */
export const DIAGNOSTICS_BENEFITS: Benefit[] = [
  {
    icon: Inbox,
    title: 'Поток заказов от клиник',
    body: 'Направления приходят в кабинет со снимками и данными пациента — не по телефону и не в мессенджере.',
  },
  {
    icon: Wallet,
    title: 'Пациент платит вам напрямую',
    body: 'Касса и финансы внутри кабинета: приём оплаты, выручка за период, комиссия платформы отдельной строкой.',
  },
  {
    icon: Sparkles,
    title: 'AI-черновик заключения',
    body: 'По загруженному исследованию готовится черновик. Врач правит и подписывает — результат возвращается в карту пациента.',
  },
  {
    icon: UserPlus,
    title: 'Сотрудники по коду приглашения',
    body: 'Рентгенолог, оператор, менеджер — каждый со своим доступом. Код действует один раз и ограничен по сроку.',
  },
]

/** Supplier — `pages/supplier/SupplierWorkspace.tsx` tabs. */
export const SUPPLIER_BENEFITS: Benefit[] = [
  {
    icon: Store,
    title: 'Клиники находят вас в каталоге',
    body: 'Товары попадают в маркетплейс DentVision — с поиском по городу, брендам и категориям.',
  },
  {
    icon: Box,
    title: 'Заказы, остатки и возвраты в одном месте',
    body: 'Продажи, низкие остатки и открытые возвраты — отдельными вкладками со счётчиками, без таблиц в почте.',
  },
  {
    icon: BarChart3,
    title: 'Видно, что спрашивают клиники',
    body: 'Аналитика спроса показывает, что ищут и покупают, — до того как вы закупите не то.',
  },
  {
    icon: Megaphone,
    title: 'Реклама внутри маркетплейса',
    body: 'Продвижение товаров там, где клиника уже выбирает поставщика.',
  },
]

/** Lecturer — `pages/school/SchoolWorkspace.tsx`. */
export const LECTURER_BENEFITS: Benefit[] = [
  {
    icon: GraduationCap,
    title: 'Четыре формата в одном кабинете',
    body: 'Онлайн-курс, вебинар, учебник и офис-курс — публикуются и продаются из одного места.',
  },
  {
    icon: Store,
    title: 'Аудитория Academy OS',
    body: 'Ваши продукты видят стоматологи, которые уже работают в DentVision, — искать студентов отдельно не нужно.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика продаж',
    body: 'Что покупают, сколько заработано, как расходятся форматы.',
  },
  {
    icon: Wallet,
    title: 'Вывод заработанного',
    body: 'Баланс кошелька в кабинете, заявка на выплату — в один клик.',
  },
]

export function PartnerBenefits({
  benefits,
  title = 'Что это даёт',
  className,
}: {
  benefits: Benefit[]
  title?: string
  className?: string
}) {
  return (
    <div className={className}>
      <h2 className="text-sm font-semibold text-txt-primary mb-4">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {benefits.map(({ icon: Icon, title: heading, body }) => (
          <div key={heading} className="rounded-xl border border-bdr-subtle bg-surface-1 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon size={16} className="shrink-0 text-dv-gold" />
              <h3 className="text-sm font-medium text-txt-primary">{heading}</h3>
            </div>
            <p className="text-sm text-txt-muted">{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
