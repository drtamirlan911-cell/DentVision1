import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Stethoscope,
  Activity,
  ShoppingCart,
  GraduationCap,
  CreditCard,
  BarChart3,
  Briefcase,
  Users,
  Calendar,
  FileText,
  Package,
  Settings,
  ShieldCheck,
  Database,
  Sparkles,
  ArrowRight,
  FlaskConical,
  Store,
  Bot,
  User,
  Scale,
  Smile,
  Tag,
  Clock,
  LineChart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ServiceItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'crm' | 'diagnostics' | 'market' | 'school' | 'finance' | 'community' | 'platform';
  icon: React.ReactNode;
  path: string;
  badge?: string;
  color: string;
  keywords: string[];
}

interface KaspiAllServicesModalProps {
  open: boolean;
  onClose: () => void;
  onAIQuery?: (query: string) => void;
}

export const KaspiAllServicesModal: React.FC<KaspiAllServicesModalProps> = ({
  open,
  onClose,
  onAIQuery,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'Все сервисы', icon: <Sparkles size={14} /> },
    { id: 'crm', label: 'Клиника & CRM', icon: <Stethoscope size={14} /> },
    { id: 'diagnostics', label: 'Диагностика', icon: <Activity size={14} /> },
    { id: 'market', label: 'Маркетплейс', icon: <ShoppingCart size={14} /> },
    { id: 'school', label: 'Academy OS', icon: <GraduationCap size={14} /> },
    { id: 'finance', label: 'Финансы', icon: <CreditCard size={14} /> },
    { id: 'community', label: 'Карьера & Сообщество', icon: <Users size={14} /> },
    { id: 'platform', label: 'Платформа', icon: <Settings size={14} /> },
  ];

  const filteredServices = useMemo(() => {
    const services: ServiceItem[] = [
      // CRM
      {
        id: 'schedule',
        title: 'Расписание записей',
        subtitle: 'Управление визитами и временем врачей',
        category: 'crm',
        icon: <Calendar size={20} />,
        path: '/crm/schedule',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['расписание', 'записи', 'прием', 'календарь', 'врачи'],
      },
      {
        id: 'patients',
        title: 'Картотека пациентов',
        subtitle: 'База клиентов, медицинская история и поиск',
        category: 'crm',
        icon: <Users size={20} />,
        path: '/crm/patients',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['пациенты', 'карты', 'клиенты', 'поиск'],
      },
      {
        id: 'medical-card',
        title: 'Медицинские карты',
        subtitle: 'Анамнез, диагнозы, файлы и протоколы',
        category: 'crm',
        icon: <FileText size={20} />,
        path: '/crm/medical-card',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['медкарта', 'история', 'протокол'],
      },
      {
        id: 'dental-chart',
        title: 'Зубная формула',
        subtitle: '3D интерактивная карта зубов',
        category: 'crm',
        icon: <Smile size={20} />,
        path: '/crm/dental-chart',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['зубная формула', 'карта зубов', 'периодонт'],
      },
      {
        id: 'treatment-plans',
        title: 'Планы лечения',
        subtitle: 'Расчет стоимости и этапов для пациента',
        category: 'crm',
        icon: <FileText size={20} />,
        path: '/crm/treatment-plans',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['план лечения', 'смета', 'расчет'],
      },
      {
        id: 'visits',
        title: 'Журнал визитов',
        subtitle: 'История посещений и выполненных процедур',
        category: 'crm',
        icon: <Clock size={20} />,
        path: '/crm/visits',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        keywords: ['визиты', 'посещения', 'история'],
      },

      // Diagnostics
      {
        id: 'diag-dashboard',
        title: '3D Диагностический центр',
        subtitle: 'Центральный хаб КТ сканов и исследований',
        category: 'diagnostics',
        icon: <Activity size={20} />,
        path: '/diagnostics',
        badge: '3D Scan',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        keywords: ['диагностика', 'кт', 'снимки', '3d'],
      },
      {
        id: 'referrals',
        title: 'Направления на КТ',
        subtitle: 'Создание и отслеживание направлений',
        category: 'diagnostics',
        icon: <FileText size={20} />,
        path: '/diagnostics/referrals',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        keywords: ['направление', 'кт', 'обследование'],
      },
      {
        id: 'center-workspace',
        title: 'Кабинет КТ Центра',
        subtitle: 'Интерфейс диагностического партнера',
        category: 'diagnostics',
        icon: <FlaskConical size={20} />,
        path: '/center-workspace',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        keywords: ['центр', 'лаборатория', 'кт кабинет'],
      },

      // Market
      {
        id: 'shop-catalog',
        title: 'Каталог DentMarket',
        subtitle: 'Расходные материалы, инструменты и оборудование',
        category: 'market',
        icon: <ShoppingCart size={20} />,
        path: '/shop',
        badge: 'B2B Маркет',
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        keywords: ['маркетплейс', 'магазин', 'закупка', 'материалы', 'пломбы'],
      },
      {
        id: 'shop-orders',
        title: 'Мои заказы',
        subtitle: 'Статусы доставок и история закупок',
        category: 'market',
        icon: <Package size={20} />,
        path: '/shop/orders',
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        keywords: ['заказы', 'доставка', 'покупки'],
      },
      {
        id: 'supplier',
        title: 'Кабинет поставщика',
        subtitle: 'Управление товарами и поставками',
        category: 'market',
        icon: <Store size={20} />,
        path: '/supplier',
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        keywords: ['поставщик', 'продажи', 'склад'],
      },

      // School
      {
        id: 'school-catalog',
        title: 'Academy OS',
        subtitle: 'Курсы по имплантологии, ортодонтии и терапии',
        category: 'school',
        icon: <GraduationCap size={20} />,
        path: '/school',
        badge: 'Обучение',
        color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
        keywords: ['обучение', 'курсы', 'вебинары', 'академия'],
      },
      {
        id: 'school-workspace',
        title: 'Кабинет преподавателя',
        subtitle: 'Управление материалами и студентами',
        category: 'school',
        icon: <GraduationCap size={20} />,
        path: '/school-workspace',
        color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
        keywords: ['преподаватель', 'школа', 'лекции'],
      },

      // Finance
      {
        id: 'cashier',
        title: 'Касса & Чеки',
        subtitle: 'Прием платежей, чеки и кассовая смена',
        category: 'finance',
        icon: <CreditCard size={20} />,
        path: '/crm/cashier',
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        keywords: ['касса', 'чеки', 'оплата', 'наличные', 'карта'],
      },
      {
        id: 'pricelist',
        title: 'Прейскурант услуг',
        subtitle: 'Цены на лечение и категории стоматологии',
        category: 'finance',
        icon: <Tag size={20} />,
        path: '/crm/pricelist',
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        keywords: ['прейскурант', 'цены', 'услуги', 'прайс'],
      },
      {
        id: 'inventory',
        title: 'Склад и материалы',
        subtitle: 'Учет остатков, списание и правила запасов',
        category: 'finance',
        icon: <Package size={20} />,
        path: '/crm/inventory',
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        keywords: ['склад', 'остатки', 'материалы', 'инвентаризация'],
      },
      {
        id: 'analytics',
        title: 'Аналитика и отчеты',
        subtitle: 'Финансовые метрики, выручка и загрузка',
        category: 'finance',
        icon: <BarChart3 size={20} />,
        path: '/analytics',
        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
        keywords: ['аналитика', 'выручка', 'kpi', 'отчеты'],
      },
      {
        id: 'bi',
        title: 'BI Аналитика клиники',
        subtitle: 'Глубокий бизнес-анализ и тренды',
        category: 'finance',
        icon: <LineChart size={20} />,
        path: '/bi',
        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
        keywords: ['bi', 'бизнес аналитика', 'графики'],
      },

      // Community
      {
        id: 'jobs',
        title: 'Биржа вакансий',
        subtitle: 'Найм врачей, ассистентов и гигиенистов',
        category: 'community',
        icon: <Briefcase size={20} />,
        path: '/jobs',
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        keywords: ['вакансии', 'работа', 'найм', 'врачи'],
      },
      {
        id: 'community',
        title: 'Профессиональное сообщество',
        subtitle: 'Обсуждение клинических случаев и нетворкинг',
        category: 'community',
        icon: <Users size={20} />,
        path: '/community',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        keywords: ['сообщество', 'чат', 'коллеги', 'форум'],
      },
      {
        id: 'profile',
        title: 'Профессиональный профиль',
        subtitle: 'Портфолио врача и квалификация',
        category: 'community',
        icon: <User size={20} />,
        path: '/profile',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        keywords: ['профиль', 'врач', 'резюме'],
      },

      // Platform
      {
        id: 'settings',
        title: 'Настройки системы',
        subtitle: 'Параметры клиники, интеграции и права',
        category: 'platform',
        icon: <Settings size={20} />,
        path: '/settings',
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        keywords: ['настройки', 'конфигурация', 'клиника'],
      },
      {
        id: 'ai-approvals',
        title: 'AI Согласования',
        subtitle: 'Контроль и утверждение действий ИИ',
        category: 'platform',
        icon: <ShieldCheck size={20} />,
        path: '/ai-approvals',
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        keywords: ['ai', 'согласование', 'безопасность'],
      },
      {
        id: 'agent-activity',
        title: 'Активность ИИ агентов',
        subtitle: 'Логи действий автономных ассистентов',
        category: 'platform',
        icon: <Bot size={20} />,
        path: '/agent-activity',
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        keywords: ['агенты', 'жарвис', 'логи'],
      },
      {
        id: 'backup',
        title: 'Резервное копирование',
        subtitle: 'Безопасность и бэкапы данных клиники',
        category: 'platform',
        icon: <Database size={20} />,
        path: '/backup',
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        keywords: ['бэкап', 'резервная копия', 'данные'],
      },
      {
        id: 'legal',
        title: 'Юридический центр',
        subtitle: 'Документы, оферты и соответствие законам',
        category: 'platform',
        icon: <Scale size={20} />,
        path: '/legal',
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        keywords: ['юрист', 'договор', 'оферта'],
      },
    ];

    return services.filter((srv) => {
      const matchCategory =
        activeCategory === 'all' || srv.category === activeCategory;
      if (!matchCategory) return false;

      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        srv.title.toLowerCase().includes(q) ||
        srv.subtitle.toLowerCase().includes(q) ||
        srv.keywords.some((k) => k.includes(q))
      );
    });
  }, [activeCategory, query]);

  const handleSelectService = (srv: ServiceItem) => {
    navigate(srv.path);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-[111] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="w-full max-w-4xl bg-surface-1 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-surface-2/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/30 to-dv-gold/10 border border-dv-gold/30 text-dv-gold">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-txt-primary">
                      Все сервисы SuperApp DentVision
                    </h2>
                    <p className="text-xs text-txt-muted">
                      Быстрый переход к любому модулю клиники в один клик
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-txt-muted hover:text-txt-primary hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-white/10 bg-surface-1">
                <div className="relative flex items-center">
                  <Search
                    size={18}
                    className="absolute left-3.5 text-txt-muted pointer-events-none"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск нужного сервиса или действия (например, 'расписание', 'КТ', 'чеки')..."
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-white/10 rounded-xl text-sm text-txt-primary placeholder:text-txt-muted outline-none focus:border-dv-gold/40 transition-colors"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-3 text-xs text-txt-muted hover:text-txt-primary"
                    >
                      Очистить
                    </button>
                  )}
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border',
                        activeCategory === cat.id
                          ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold shadow-sm'
                          : 'bg-surface-2/60 border-white/5 text-txt-muted hover:text-txt-primary hover:bg-white/5'
                      )}
                    >
                      {cat.icon}
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Services Grid */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {filteredServices.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-txt-muted">Ничего не найдено по вашему запросу.</p>
                    <button
                      onClick={() => {
                        setQuery('');
                        setActiveCategory('all');
                      }}
                      className="mt-3 px-4 py-1.5 rounded-xl bg-dv-gold/15 text-dv-gold text-xs font-semibold hover:bg-dv-gold/25"
                    >
                      Сбросить фильтр
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredServices.map((srv) => (
                      <motion.button
                        key={srv.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectService(srv)}
                        className="group flex items-start gap-3 p-3.5 rounded-2xl bg-surface-2/70 border border-white/5 hover:border-white/20 text-left transition-all hover:bg-surface-2"
                      >
                        <div
                          className={cn(
                            'p-2.5 rounded-xl border shrink-0',
                            srv.color
                          )}
                        >
                          {srv.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-sm font-semibold text-txt-primary group-hover:text-dv-gold transition-colors truncate">
                              {srv.title}
                            </h4>
                            <ArrowRight
                              size={14}
                              className="text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity text-dv-gold shrink-0"
                            />
                          </div>
                          <p className="text-xs text-txt-muted line-clamp-2 mt-0.5">
                            {srv.subtitle}
                          </p>
                          {srv.badge && (
                            <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-txt-secondary font-medium">
                              {srv.badge}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-surface-2/40 flex items-center justify-between text-xs text-txt-muted">
                <span>DentVision SuperApp OS — Нажмите на любой сервис для перехода</span>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-txt-primary font-medium"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
