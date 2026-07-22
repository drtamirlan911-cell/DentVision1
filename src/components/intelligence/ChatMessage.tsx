import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Sparkles, Zap, Stethoscope, Calendar, BarChart3, ShoppingCart, GraduationCap, BookOpen, Users, Globe, Database, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  skill?: string;
  actions?: Array<{ action?: string; type?: string; label: string; confidence: number; params?: Record<string, unknown> }>;
  proactive?: Array<{ type: string; text: string; priority: number }>;
  source?: 'crm' | 'shop' | 'school' | 'knowledge' | 'external' | 'market';
  data?: Record<string, unknown>;
  recommendations?: Array<Record<string, unknown>>;
  onAction?: (action: string, params?: Record<string, unknown>) => void;
  messageId?: string;
  feedback?: 'up' | 'down';
  learnedHint?: string;
}

const SKILL_ICONS: Record<string, React.ReactNode> = {
  clinical: <Stethoscope size={10} />,
  practice: <Calendar size={10} />,
  analytics: <BarChart3 size={10} />,
  shopping: <ShoppingCart size={10} />,
  learning: <GraduationCap size={10} />,
  research: <BookOpen size={10} />,
  automation: <Zap size={10} />,
  patient: <Users size={10} />,
};

/** Map backend intents / skill ids to short Russian chips — never show SCREAMING_SNAKE. */
const SKILL_LABELS: Record<string, string> = {
  clinical: 'Клиника',
  practice: 'Практика',
  analytics: 'Аналитика',
  shopping: 'Магазин',
  learning: 'Обучение',
  research: 'Исследования',
  automation: 'Автоматизация',
  patient: 'Пациент',
  general: 'Ассистент',
  MORNING_BRIEFING: 'Сводка',
  GET_ANALYTICS: 'Финансы',
  CHECK_DEBTS: 'Долги',
  VIEW_SCHEDULE: 'Расписание',
  GENERATE_REPORT: 'Отчёт',
  GENERATE_INVOICE: 'Счёт',
  CREATE_APPOINTMENT: 'Запись',
  LOW_STOCK: 'Склад',
  OPEN_INVENTORY: 'Склад',
  OPEN_SCHEDULE: 'Расписание',
  OPEN_SHOP: 'Магазин',
  OPEN_SCHOOL: 'Школа',
  OPEN_CRM: 'CRM',
  OPEN_ANALYTICS: 'Аналитика',
  UNKNOWN: 'Ассистент',
};

const ACTION_LABELS: Record<string, string> = {
  OPEN_SCHEDULE: 'Открыть расписание',
  OpenSchedule: 'Открыть расписание',
  OPEN_INVENTORY: 'Открыть склад',
  OpenInventory: 'Открыть склад',
  OPEN_CRM: 'Открыть CRM',
  OpenCRM: 'Открыть CRM',
  OPEN_SHOP: 'Открыть маркетплейс',
  OpenShop: 'Открыть маркетплейс',
  OPEN_SCHOOL: 'Открыть Academy OS',
  OpenSchool: 'Открыть Academy OS',
  OPEN_ANALYTICS: 'Открыть аналитику',
  OpenAnalytics: 'Открыть аналитику',
  OPEN_FINANCE: 'Открыть финансы',
  OpenFinance: 'Открыть финансы',
  OPEN_PATIENTS: 'Открыть пациентов',
  OpenPatients: 'Открыть пациентов',
  NAVIGATE: 'Открыть раздел',
};

const SECTION_KEY_RU: Record<string, string> = {
  schedule: 'Расписание',
  patients: 'Пациенты',
  finance: 'Финансы',
  inventory: 'Склад',
  documents: 'Документы',
  lab: 'Лаборатория',
  reminders: 'Напоминания',
  'dental-chart': 'Зубная карта',
  'treatment-plans': 'Планы лечения',
  visits: 'Визиты',
  staff: 'Сотрудники',
  shop: 'Маркетплейс',
  school: 'Academy OS',
  analytics: 'Аналитика',
  settings: 'Настройки',
  profile: 'Профиль',
  demo: 'Демо-клиника',
  pricing: 'Тарифы',
  jobs: 'Вакансии',
  community: 'Сообщество',
};

const SECTION_PATHS: Record<string, string> = {
  schedule: '/crm/schedule',
  patients: '/crm/patients',
  finance: '/crm/finance',
  inventory: '/crm/inventory',
  documents: '/crm/documents',
  lab: '/crm/lab',
  reminders: '/crm/reminders',
  'dental-chart': '/crm/dental-chart',
  'treatment-plans': '/crm/treatment-plans',
  visits: '/crm/visits',
  staff: '/crm/staff',
  shop: '/shop',
  school: '/school',
  analytics: '/analytics',
  settings: '/settings',
  profile: '/profile',
  demo: '/crm/schedule?demo=1',
  pricing: '/pricing',
  jobs: '/jobs',
  community: '/community',
};

const SECTION_BY_LABEL: Record<string, { key: string; path: string; label: string }> = Object.fromEntries(
  Object.entries(SECTION_KEY_RU).map(([key, label]) => [
    label.toLowerCase(),
    { key, path: SECTION_PATHS[key], label },
  ]),
);

function resolveSection(raw: string): { key: string; path: string; label: string } | null {
  const t = String(raw || '').trim().replace(/^[•\d.)\s-]+/, '').replace(/[.。]+$/, '');
  if (!t) return null;
  const lower = t.toLowerCase();
  if (SECTION_BY_LABEL[lower]) return SECTION_BY_LABEL[lower];
  if (SECTION_PATHS[lower]) {
    return { key: lower, path: SECTION_PATHS[lower], label: SECTION_KEY_RU[lower] || t };
  }
  // "Открыть расписание" / "открыть маркетплейс"
  const opened = lower.replace(/^открыть\s+/, '');
  if (SECTION_BY_LABEL[opened]) return SECTION_BY_LABEL[opened];
  return null;
}

type SectionChoice = { key: string; path: string; label: string };

const ACTION_TYPE_PATHS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OPEN_SCHEDULE: '/crm/schedule',
  OpenPatients: '/crm/patients',
  OPEN_PATIENTS: '/crm/patients',
  OpenPatient: '/crm/patients',
  OpenFinance: '/crm/finance',
  OPEN_FINANCE: '/crm/finance',
  OpenCashier: '/crm/finance',
  OpenInventory: '/crm/inventory',
  OPEN_INVENTORY: '/crm/inventory',
  OpenDocuments: '/crm/documents',
  OPEN_DOCUMENTS: '/crm/documents',
  OpenLab: '/crm/lab',
  OPEN_LABORATORY: '/crm/lab',
  OpenReminders: '/crm/reminders',
  OpenDentalChart: '/crm/dental-chart',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenVisits: '/crm/visits',
  OpenStaff: '/crm/staff',
  OpenShop: '/shop',
  OPEN_SHOP: '/shop',
  OpenSchool: '/school',
  OPEN_SCHOOL: '/school',
  OpenAnalytics: '/analytics',
  OPEN_ANALYTICS: '/analytics',
  OpenSettings: '/settings',
  OpenProfile: '/profile',
  OpenDemo: '/crm/schedule?demo=1',
  OpenPricing: '/pricing',
  OpenJobs: '/jobs',
  OpenCommunity: '/community',
  OpenCRM: '/crm/schedule',
  OPEN_CRM: '/crm/schedule',
  OPEN_INVOICE: '/crm/finance',
  OpenInvoice: '/crm/finance',
  OPEN_BILLING: '/crm/billing',
  OpenBilling: '/crm/billing',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pathToSection(path: string): SectionChoice | null {
  const raw = String(path || '').trim();
  if (!raw) return null;
  const bare = raw.split('?')[0];
  for (const [key, p] of Object.entries(SECTION_PATHS)) {
    const pBare = p.split('?')[0];
    if (p === raw || pBare === bare || (key === 'demo' && bare === '/crm/schedule' && raw.includes('demo=1'))) {
      return { key, path: p, label: SECTION_KEY_RU[key] || key };
    }
  }
  // /crm/schedule → schedule
  const last = bare.replace(/^\/crm\//, '').replace(/^\//, '');
  if (SECTION_PATHS[last]) {
    return { key: last, path: SECTION_PATHS[last], label: SECTION_KEY_RU[last] || last };
  }
  return null;
}

/** Collect every place the assistant suggests opening — for in-message buttons. */
function extractNavTargets(
  content: string,
  actions?: ChatMsg['actions'],
): SectionChoice[] {
  const seen = new Set<string>();
  const out: SectionChoice[] = [];
  const add = (s: SectionChoice | null | undefined) => {
    if (!s?.path || seen.has(s.path)) return;
    seen.add(s.path);
    out.push(s);
  };

  // 1) Explicit actions from backend (navigate tool / Open*)
  for (const a of actions || []) {
    const type = String(a.type || a.action || '');
    if (!type || type.startsWith('SHOW_')) continue;
    if (type === 'NAVIGATE') {
      add(pathToSection(String(a.params?.path || '')));
      continue;
    }
    const mapped = ACTION_TYPE_PATHS[type];
    if (mapped) add(pathToSection(mapped));
  }

  const text = localizeSectionKeys(String(content || ''));
  if (!text.trim()) return out.slice(0, 8);

  // 2) Section menus (comma / bullet lists)
  const offer = parseSectionOffer(text);
  if (offer) offer.sections.forEach(add);

  // 3) CTA phrases: «откройте расписание», «перейдите в маркетплейс»…
  const ctaRe =
    /(?:откройте|открыть|открой|перейдите(?:\s+в)?|перейти(?:\s+в)?|зайдите(?:\s+в)?|зайти(?:\s+в)?|посмотрите(?:\s+в)?|посмотри|покаж(?:у|ите)|откроем|давайте\s+откроем|можете\s+открыть)\s+(?:раздел\s+|страницу\s+|модуль\s+)?[«"']?([А-Яа-яЁёA-Za-z0-9][А-Яа-яЁёA-Za-z0-9 -]{1,40})/gi;
  let m: RegExpExecArray | null;
  while ((m = ctaRe.exec(text))) {
    const raw = m[1].replace(/[.,;:!?»"']+$/g, '').trim();
    add(resolveSection(raw));
  }

  // 4) Known section labels when the message is clearly giving a go-somewhere tip
  const hasNavIntent =
    /откро|перейд|зайд|посмотри|покаж|раздел|переход|можно\s+открыть|советую\s+открыть|давайте\s+откроем/i.test(
      text,
    );
  if (hasNavIntent) {
    const labels = Object.entries(SECTION_BY_LABEL).sort((a, b) => b[0].length - a[0].length);
    for (const [labelLower, meta] of labels) {
      const re = new RegExp(`(?:^|[^А-Яа-яЁёA-Za-z0-9])${escapeRegExp(labelLower)}(?:[^А-Яа-яЁёA-Za-z0-9]|$)`, 'i');
      if (re.test(text)) add(meta);
    }
  }

  return out.slice(0, 8);
}

/** Pull a navigable section menu out of assistant prose (comma / bullet lists). */
function parseSectionOffer(content: string): { intro: string; sections: SectionChoice[] } | null {
  const text = localizeSectionKeys(String(content || '').trim());
  if (!text) return null;

  const collect = (parts: string[]): SectionChoice[] => {
    const seen = new Set<string>();
    const out: SectionChoice[] = [];
    for (const part of parts) {
      const s = resolveSection(part);
      if (!s || seen.has(s.path)) continue;
      seen.add(s.path);
      out.push(s);
    }
    return out;
  };

  // "…разделы: A, B, C" (same line or following lines)
  const labeled = text.match(/^(.*?раздел(?:ы)?\s*:)\s*([\s\S]+)$/i);
  if (labeled) {
    const tail = labeled[2].trim();
    const parts = tail.includes('\n')
      ? tail.split(/\n+/).map((l) => l.replace(/^[•-]\s*/, '').trim())
      : tail.split(/\s*,\s*/);
    const sections = collect(parts);
    if (sections.length >= 2) {
      return { intro: labeled[1].replace(/:\s*$/, '').trim(), sections };
    }
  }

  // Bullet / numbered list where most lines are known sections
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3) {
    const bulletish = lines.filter((l) => /^[•\d.-]/.test(l) || resolveSection(l));
    if (bulletish.length >= 2) {
      const sections = collect(bulletish);
      if (sections.length >= 2 && sections.length >= Math.ceil(bulletish.length * 0.6)) {
        const introLines = lines.filter((l) => !resolveSection(l.replace(/^[•\d.)\s-]+/, '')));
        const intro = (introLines.join('\n').trim() || 'Куда открыть?').replace(/:\s*$/, '');
        return { intro, sections };
      }
    }
  }

  // Dense comma list of known sections (no "разделы:" prefix)
  const comma = text.match(/^([\s\S]{0,160}?)((?:[A-Za-zА-Яа-яЁё0-9 -]+\s*,\s*){2,}[A-Za-zА-Яа-яЁё0-9 -]+)\s*$/);
  if (comma) {
    const sections = collect(comma[2].split(/\s*,\s*/));
    if (sections.length >= 3) {
      return { intro: (comma[1] || 'Куда открыть?').trim().replace(/:\s*$/, '') || 'Куда открыть?', sections };
    }
  }

  return null;
}

function skillLabel(skill?: string): string | null {
  if (!skill) return null;
  if (SKILL_LABELS[skill]) return SKILL_LABELS[skill];
  if (/^[A-Z0-9_]+$/.test(skill)) {
    return skill
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return skill;
}

function actionLabel(a: { action?: string; type?: string; label?: string; params?: Record<string, unknown> }): string {
  const key = a.action || a.type || '';
  if (key === 'NAVIGATE') {
    const path = String(a.params?.path || '');
    const section = path.replace(/^\/crm\//, '/').replace(/^\//, '');
    const ru = SECTION_KEY_RU[section] || SECTION_KEY_RU[path.replace(/^\//, '')];
    if (ru) return `Открыть ${ru.toLowerCase() === 'academy os' ? 'Academy OS' : ru.toLowerCase()}`;
    if (a.label && !/^NAVIGATE$/i.test(a.label)) return a.label;
    return 'Открыть раздел';
  }
  if (a.label && !/^[A-Z][A-Z0-9_]+$/.test(a.label) && a.label !== key) return a.label;
  return ACTION_LABELS[key] || ACTION_LABELS[a.label || ''] || a.label || key || 'Действие';
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  crm: { label: 'CRM', icon: <Database size={10} /> },
  shop: { label: 'Маркетплейс', icon: <ShoppingCart size={10} /> },
  school: { label: 'Academy OS', icon: <GraduationCap size={10} /> },
  knowledge: { label: 'База знаний', icon: <BookOpen size={10} /> },
  external: { label: 'Внешний источник', icon: <Globe size={10} /> },
  market: { label: 'Рынок', icon: <BarChart3 size={10} /> },
};

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <span key={i} className="font-semibold text-dv-gold">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** Soft-rewrite legacy ACL error copy that leaked raw intent codes into chat history. */
function sanitizeAssistantContent(content: string): string {
  const raw = String(content || '');
  if (/Нет прав для действия:\s*UNKNOWN/i.test(raw)) {
    return 'Не совсем понял запрос. Попробуйте: «Чем полезен DentVision?», «Открыть демо-клинику» или войдите как сотрудник.';
  }
  if (/Нет прав для действия:\s*[A-Z0-9_]+/i.test(raw)) {
    return 'Для этого действия нужны права сотрудника клиники. Войдите в демо или под своей учётной записью.';
  }
  return raw;
}

/** Soft-rewrite English section key dumps the model sometimes echoes from tool schemas. */
function localizeSectionKeys(text: string): string {
  let out = sanitizeAssistantContent(text);
  // Comma-separated English keys (the usual failure mode)
  out = out.replace(
    /\b(schedule|patients|finance|inventory|documents|lab|reminders|dental-chart|treatment-plans|visits|staff|shop|school|analytics|settings|profile|demo|pricing|jobs|community)(\s*,\s*(schedule|patients|finance|inventory|documents|lab|reminders|dental-chart|treatment-plans|visits|staff|shop|school|analytics|settings|profile|demo|pricing|jobs|community))+/gi,
    (match) =>
      match
        .split(/\s*,\s*/)
        .map((k) => SECTION_KEY_RU[k.trim().toLowerCase()] || k.trim())
        .join(', '),
  );
  // After «разделы:» / «раздел:» even a single key
  out = out.replace(
    /(раздел(?:ы)?\s*:\s*)([a-z0-9_,\s-]+)/gi,
    (_m, _prefix: string, list: string) =>
      'разделы: ' +
      list
        .split(/[,\n]/)
        .map((part) => {
          const k = part.trim().toLowerCase();
          return SECTION_KEY_RU[k] || part.trim();
        })
        .filter(Boolean)
        .join(', '),
  );
  return out;
}

function renderContent(
  content: string,
  opts?: { onNavigateSection?: (section: SectionChoice) => void; hideInlineNav?: boolean },
) {
  const onNavigateSection = opts?.onNavigateSection;
  const offer = onNavigateSection && !opts?.hideInlineNav ? parseSectionOffer(content) : null;
  // When we already render a unified button row below the bubble, only keep the intro.
  if (offer && offer.sections.length >= 2 && opts?.hideInlineNav) {
    return offer.intro ? (
      <p className="text-[13px] leading-relaxed text-txt-primary/90">{renderInlineMarkdown(offer.intro)}</p>
    ) : null;
  }
  if (offer && offer.sections.length >= 2) {
    return (
      <div className="space-y-3">
        {offer.intro && (
          <p className="text-[13px] leading-relaxed text-txt-primary/90">{renderInlineMarkdown(offer.intro)}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {offer.sections.map((s, i) => (
            <motion.button
              key={s.path}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.2 }}
              onClick={() => onNavigateSection?.(s)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-dv-gold/10 text-dv-gold border border-dv-gold/20 hover:bg-dv-gold/18 hover:border-dv-gold/35 transition-all cursor-pointer"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              <Zap size={10} />
              {s.label}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  const blocks = localizeSectionKeys(content).split('\n\n');
  return blocks.map((block, i) => {
    if (block.startsWith('•') || block.startsWith('-') || block.includes('\n•') || block.includes('\n-')) {
      return (
        <div key={i} className="space-y-1 my-2">
          {block.split('\n').filter(Boolean).map((line, j) => {
            const plain = line.replace(/^[•-]\s*/, '');
            const section = onNavigateSection && !opts?.hideInlineNav ? resolveSection(plain) : null;
            if (section) {
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => onNavigateSection?.(section)}
                  className="flex gap-2.5 text-[13px] leading-relaxed w-full text-left rounded-lg px-1 py-0.5 -mx-1 hover:bg-dv-gold/10 transition-colors group/row"
                >
                  <span className="text-dv-gold/60 mt-0.5 shrink-0">•</span>
                  <span className="text-dv-gold font-medium underline-offset-2 group-hover/row:underline">{section.label}</span>
                </button>
              );
            }
            return (
              <div key={j} className="flex gap-2.5 text-[13px] leading-relaxed">
                <span className="text-dv-gold/60 mt-0.5 shrink-0">•</span>
                <span className="text-txt-primary/90">{renderInlineMarkdown(plain)}</span>
              </div>
            );
          })}
        </div>
      );
    }
    if (block.startsWith('**') && block.includes('**')) {
      return (
        <div key={i} className="my-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
          {block.split('\n').map((line, j) => {
            const parts = line.match(/\*\*(.+?)\*\*\s*[—–-]?\s*(.*)/);
            if (parts) {
              return (
                <p key={j} className="text-[13px] leading-relaxed mb-0.5">
                  <span className="font-semibold text-dv-gold">{parts[1]}</span>
                  {parts[2] && <span className="text-txt-muted"> — </span>}
                  {parts[2] && <span className="text-txt-primary/80">{renderInlineMarkdown(parts[2])}</span>}
                </p>
              );
            }
            return <p key={j} className="text-[13px] leading-relaxed">{renderInlineMarkdown(line)}</p>;
          })}
        </div>
      );
    }
    return <p key={i} className="my-1.5 text-[13px] leading-relaxed text-txt-primary/90">{renderInlineMarkdown(block)}</p>;
  });
}

export function ChatMessage({
  msg,
  onAction,
  onExecuteAction,
  onFeedback,
}: {
  msg: ChatMsg;
  onAction?: (query: string) => void;
  onExecuteAction?: (action: { action?: string; type?: string; label: string; params?: Record<string, unknown> }) => void;
  onFeedback?: (rating: 'up' | 'down', msg: ChatMsg) => void;
}) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<'up' | 'down' | undefined>(msg.feedback);
  const handleCopy = () => {
    navigator.clipboard?.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendFeedback = (rating: 'up' | 'down') => {
    if (localFeedback === rating) return;
    setLocalFeedback(rating);
    onFeedback?.(rating, msg);
  };

  const goToSection = (section: SectionChoice) => {
    const action = {
      type: 'NAVIGATE',
      label: `Открыть ${section.label}`,
      params: { path: section.path, section: section.key },
    };
    if (onExecuteAction) onExecuteAction(action);
    else onAction?.(section.label);
  };

  const navTargets = !isUser ? extractNavTargets(msg.content, msg.actions) : [];
  const navPaths = new Set(navTargets.map((s) => s.path));
  const sectionOffer = navTargets.length >= 2 ? parseSectionOffer(msg.content) : null;

  const hasContent = !!String(msg.content || '').trim()
  const hasExtras = !!(
    (msg.data && Object.keys(msg.data).length) ||
    (msg.actions && msg.actions.length) ||
    (msg.recommendations && msg.recommendations.length) ||
    navTargets.length
  )
  // Don't render empty assistant placeholders (optimistic stream shell).
  if (!isUser && !hasContent && !hasExtras) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={cn('flex gap-3 group', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/25 to-dv-gold/5 border border-dv-gold/20 shadow-[0_0_20px_rgba(201,169,110,0.12)]"
        >
          <Bot size={17} className="text-dv-gold" />
        </motion.div>
      )}

      <div className={cn('flex flex-col gap-1.5 max-w-[75%] min-w-0', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (msg.skill || msg.source) && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.2 }}
            className="flex items-center gap-1.5 flex-wrap"
          >
            {msg.skill && skillLabel(msg.skill) && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/8 text-dv-gold/80 text-[10px] font-medium backdrop-blur-sm">
                {SKILL_ICONS[msg.skill] || <Sparkles size={10} />}
                <span>{skillLabel(msg.skill)}</span>
              </div>
            )}
            {msg.source && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-txt-muted text-[10px] font-medium">
                {SOURCE_LABELS[msg.source]?.icon || <Globe size={10} />}
                <span>{SOURCE_LABELS[msg.source]?.label || msg.source}</span>
              </div>
            )}
          </motion.div>
        )}

        <motion.div
          layout
          className={cn(
            'rounded-[1.35rem] px-5 py-3.5 text-[13.5px] leading-[1.55] max-w-full',
            sectionOffer || navTargets.length ? 'whitespace-normal' : 'whitespace-pre-wrap',
            isUser
              ? 'bg-gradient-to-br from-[#D4B57A] to-dv-gold/85 text-[#0B1220] font-medium rounded-br-lg shadow-[0_8px_28px_rgba(201,169,110,0.18)]'
              : 'bg-gradient-to-b from-white/[0.055] to-white/[0.025] border border-white/[0.08] text-txt-primary rounded-bl-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md'
          )}
        >
          {renderContent(msg.content, {
            onNavigateSection: isUser ? undefined : goToSection,
            hideInlineNav: navTargets.length > 0,
          })}
        </motion.div>

        {/* Always show go-to buttons when the assistant suggests a destination */}
        {!isUser && navTargets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 w-full">
            {navTargets.map((s, i) => (
              <motion.button
                key={s.path}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08 + i * 0.04, type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => goToSection(s)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-dv-gold/12 text-dv-gold border border-dv-gold/25 hover:bg-dv-gold/20 hover:border-dv-gold/40 transition-all"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                <Zap size={10} />
                {navTargets.length === 1 ? `Открыть ${s.label}` : s.label}
              </motion.button>
            ))}
          </div>
        )}

        {msg.data?.products && Array.isArray(msg.data.products) && msg.data.products.length > 0 && (
          <div className="grid gap-1.5 w-full">
            {(msg.data.products as Array<any>).slice(0, 4).map((p: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-dv-gold/15 transition-all cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10">
                  <ShoppingCart size={16} className="text-dv-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{p.brand ? `${p.brand} ` : ''}{p.name}</p>
                  <p className="text-xs text-txt-muted">
                    {p.price?.toLocaleString?.('ru-RU') || p.price || 'Цена по запросу'} ₸
                    {p.rating ? ` · ${'★'.repeat(Math.round(p.rating))} ${p.rating}` : ''}
                  </p>
                </div>
                {p.stock !== undefined && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.stock > 0 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                    {p.stock > 0 ? 'В наличии' : 'Нет'}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {msg.data?.courses && Array.isArray(msg.data.courses) && msg.data.courses.length > 0 && (
          <div className="grid gap-1.5 w-full">
            {(msg.data.courses as Array<any>).slice(0, 4).map((c: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-emerald-400/15 transition-all cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
                  <GraduationCap size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{c.title}</p>
                  <p className="text-xs text-txt-muted">
                    {c.instructor || c.category || ''}
                    {c.durationHours ? ` · ${c.durationHours} ч.` : ''}
                    {c.rating ? ` · ${'★'.repeat(Math.round(c.rating))}` : ''}
                  </p>
                </div>
                {c.enrolledCount !== undefined && (
                  <span className="text-[10px] text-txt-muted">{c.enrolledCount} зап.</span>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!msg.data && msg.recommendations && Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
          <div className="grid gap-1.5 w-full">
            {msg.recommendations.slice(0, 4).map((r: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{r.name || r.title || r.brand || ''}</p>
                  {(r.price || r.instructor) && (
                    <p className="text-xs text-txt-muted">{r.price ? `${r.price} ₸` : r.instructor || ''}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.actions
              .filter((a) => !String(a.action || a.type || '').startsWith('SHOW_'))
              .filter((a) => {
                // Already covered by the unified nav button row
                const type = String(a.type || a.action || '');
                if (type === 'NAVIGATE' || type in ACTION_TYPE_PATHS) {
                  const path =
                    type === 'NAVIGATE'
                      ? String(a.params?.path || '')
                      : ACTION_TYPE_PATHS[type] || '';
                  if (path && navPaths.has(path)) return false;
                  if (path) {
                    const bare = path.split('?')[0];
                    for (const p of navPaths) {
                      if (p.split('?')[0] === bare) return false;
                    }
                  }
                  // Prefer unified row — skip raw navigate action chips entirely when we have navTargets
                  if (navTargets.length) return false;
                }
                return true;
              })
              .map((a, i) => {
                const label = actionLabel(a);
                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={() => {
                      if (onExecuteAction) onExecuteAction(a);
                      else onAction?.(label);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-dv-gold/8 text-dv-gold border border-dv-gold/15 hover:bg-dv-gold/15 hover:border-dv-gold/30 transition-all"
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Zap size={10} />
                    {label}
                  </motion.button>
                );
              })}
          </div>
        )}

        {!!msg.learnedHint && (
          <p className="text-[11px] text-dv-gold/80 m-0 px-1">{msg.learnedHint}</p>
        )}

        {!isUser && !!msg.content?.trim() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <button
              type="button"
              title="Хороший ответ — ИИ запомнит стиль"
              onClick={() => sendFeedback('up')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                localFeedback === 'up'
                  ? 'text-emerald-400 bg-emerald-400/10'
                  : 'text-txt-ghost hover:text-txt-secondary hover:bg-white/[0.04]',
              )}
            >
              <ThumbsUp size={12} />
            </button>
            <button
              type="button"
              title="Плохой ответ — ИИ учтёт"
              onClick={() => sendFeedback('down')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                localFeedback === 'down'
                  ? 'text-rose-400 bg-rose-400/10'
                  : 'text-txt-ghost hover:text-txt-secondary hover:bg-white/[0.04]',
              )}
            >
              <ThumbsDown size={12} />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-txt-ghost hover:text-txt-secondary hover:bg-white/[0.04] transition-colors"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </motion.div>
        )}
      </div>

      {isUser && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/[0.08]"
        >
          <User size={16} className="text-txt-secondary" />
        </motion.div>
      )}
    </motion.div>
  );
}

export default ChatMessage;
