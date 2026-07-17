import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Search, Edit3, Save, X, Trash2, Download, Eye, Copy, Stethoscope, Shield, ClipboardList, PenTool, Send, Link2 } from 'lucide-react';
import SignaturePad from '../../components/ui/SignaturePad';
import { gid, today } from '../../utils/constants';
import { useToast } from '@/components/ui/ds/Toast'
import { useDataQuery } from '../../queries/useDataQuery';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/ds/Card';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { Input, Textarea, Select } from '../../components/ui/ds/Input';
import { Modal } from '../../components/ui/ds/Modal';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';
import type { Document, Patient, User as UserType, Clinic, RoleInfo } from '../../types';

const DOC_STATUS: Record<string, { l: string; v: string }> = {
  draft: { l: 'Черновик', v: 'slate' },
  active: { l: 'Действующий', v: 'emerald' },
  pending_signature: { l: 'Ожидает подписи', v: 'gold' },
  signed: { l: 'Подписан', v: 'gold' },
  archived: { l: 'Архив', v: 'sapphire' },
};

const DOC_TEMPLATES = [
  {
    category: 'Согласия',
    items: [
      {
        type: 'Согласие на лечение',
        title: 'Согласие на оказание стоматологических услуг',
        content: `СОГЛАСИЕ НА ОКАЗАНИЕ СТОМАТОЛОГИЧЕСКИХ МЕДИЦИНСКИХ УСЛУГ

Я, _________________________________ (ФИО пациента),
дата рождения: _________________, паспорт: _________________

Настоящим даю согласие на оказание стоматологических медицинских услуг в клинике «{clinic_name}».

1. Я информирован(а) о диагнозе: _________________________________
2. План лечения: _______________________________________________
3. Мне разъяснены:
   - Характер заболевания и предполагаемые методы лечения
   - Возможные альтернативные методы лечения
   - Риски и возможные осложнения
   - Предполагаемый результат лечения
   - Стоимость услуг: _____________ тенге

4. Я даю согласие на:
   [ ] Лечение кариеса и его осложнений
   [ ] Эндодонтическое лечение (пломбирование каналов)
   [ ] Хирургическое вмешательство (удаление зубов)
   [ ] Протезирование (установка коронок, мостов, протезов)
   [ ] Имплантацию
   [ ] Ортодонтическое лечение
   [ ] Профессиональную гигиену полости рта
   [ ] Рентгенологическое исследование
   [ ] Анестезию (обезболивание)
   [ ] Иное: _________________________________

5. Я предупреждён(а) о необходимости соблюдения рекомендаций врача
6. Я подтверждаю, что предоставил(а) достоверные сведения о состоянии здоровья

Дата: _________________                    Подпись пациента: _________________

Врач: _________________________________    Подпись врача: _________________`,
      },
      {
        type: 'Согласие на анестезию',
        title: 'Согласие на проведение анестезии',
        content: `СОГЛАСИЕ НА ПРОВЕДЕНИЕ АНЕСТЕЗИИ (ОБЕЗБОЛИВАНИЯ)

Я, _________________________________ (ФИО пациента),
дата рождения: _________________

Информирован(а) о том, что в процессе стоматологического лечения будет проведено обезболивание.

Мне разъяснены:
1. Вид анестезии: _________________________________
   (инфильтрационная / проводниковая / аппликационная / седация)
2. Препарат для анестезии: _________________________________
3. Возможные побочные реакции:
   - Аллергическая реакция на анестетик
   - Повреждение нерва (кратковременное онемение)
   - Гематома в месте инъекции
   - Кратковременная тахикардия
   - Головокружение, тошнота
4. Вероятность серьёзных осложнений составляет менее 1:500 000

Я предоставил(а) информацию об аллергических реакциях:
[ ] Нет аллергии
[ ] Аллергия на: _________________________________
[ ] Непереносимость: _________________________________

Дата: _________________                    Подпись пациента: _________________

Врач: _________________________________    Подпись врача: _________________`,
      },
      {
        type: 'Согласие на хирургию',
        title: 'Согласие на хирургическое вмешательство',
        content: `СОГЛАСИЕ НА ХИРУРГИЧЕСКОЕ ВМЕШАТЕЛЬСТВО

Я, _________________________________ (ФИО пациента),
дата рождения: _________________

Проинформирован(а) хирургом-стоматологом _________________________________ о необходимости проведения хирургического вмешательства:

Диагноз: _________________________________
Показание к операции: _________________________________
Вид операции: _________________________________
Предполагаемая продолжительность: _______ мин / час

Мне разъяснены:
1. Цель операции и ожидаемый результат
2. Метод проведения операции
3. Необходимость предоперационной подготовки (анализы, рентген)
4. Вид анестезии: _________________________________
5. Риски и возможные осложнения:
   - Кровотечение
   - Инфицирование
   - Повреждение соседних тканей/зубов
   - Онемение (парестезия)
   - Осложнения заживления
   - Отёк, болевой синдром после операции
6. Период восстановления: _______ дней
7. Альтернативные методы лечения: _________________________________

Предоперационные анализы сданы: [ ] Да [ ] Нет
Рентгенологическое исследование выполнено: [ ] Да [ ] Нет

Дата: _________________                    Подпись пациента: _________________

Хирург: _________________________________   Подпись врача: _________________`,
      },
      {
        type: 'Согласие на имплантацию',
        title: 'Согласие на установку дентальных имплантов',
        content: `СОГЛАСИЕ НА УСТАНОВКУ ДЕНТАЛЬНЫХ ИМПЛАНТОВ

Я, _________________________________ (ФИО пациента),
проинформирован(а) о необходимости установки дентальных имплантов.

Область установки: _________________________________
Количество имплантов: _______
Система имплантов: _________________________________

Мне разъяснены:
1. Этапность лечения: хирургический этап → период остеоинтеграции (3-6 мес) → ортопедический этап
2. Необходимость дополнительных процедур: наращивание кости (аугментация), синус-лифтинг
3. Риски: отторжение импланта (3-5%), инфицирование, повреждение нервов, синусита
4. Срок службы импланта зависит от гигиены и регулярных осмотров
5. Стоимость: имплант _____________ тенге, коронка _____________ тенге
6. Гарантия на имплант: _______ лет при регулярных осмотрах (1 раз в 6 мес)

Стоимость всего лечения: _____________ тенге

Дата: _________________                    Подпись пациента: _________________

Врач: _________________________________    Подпись врача: _________________`,
      },
    ],
  },
  {
    category: 'Медицинские документы',
    items: [
      {
        type: 'Медицинское заключение',
        title: 'Медицинское заключение стоматолога',
        content: `МЕДИЦИНСКОЕ ЗАКЛЮЧЕНИЕ

Дата: _________________
Клиника: «{clinic_name}»

Пациент: _________________________________
Дата рождения: _________________

ДИАГНОЗ:
Основной: _________________________________ (МКБ-10: _______)
Сопутствующие: _________________________________

РЕЗУЛЬТАТЫ ОСМОТРА:
Состояние полости рта: _________________________________
Зубная формула: [ ] Сформирована [ ] Частичная адентия [ ] Полная адентия
Гигиена полости рта: [ ] Удовлетворительная [ ] Неудовлетворительная
Пародонт: [ ] В норме [ ] Гингивит [ ] Пародонтит ст. ___

РЕЗУЛЬТАТЫ ДИАГНОСТИКИ:
Рентген: _________________________________
КТ/Панорамный снимок: _________________________________

ПЛАН ЛЕЧЕНИЯ:
1. _________________________________
2. _________________________________
3. _________________________________

ПРОГНОЗ: [ ] Благоприятный [ ] Осторожный [ ] Сомнительный

Врач: _________________________________    Подпись: _________________
Лицензия №: _________________`,
      },
      {
        type: 'Эпикриз',
        title: 'Выписной эпикриз',
        content: `ВЫПИСНОЙ ЭПИКРИЗ

Пациент: _________________________________
Дата рождения: _________________
Период лечения: с _____________ по _____________

ДИАГНОЗ ПРИ ПОСТУПЛЕНИИ:
_______________________________

ПРОВЕДЁННОЕ ЛЕЧЕНИЕ:
1. _________________________________
2. _________________________________
3. _________________________________

РЕЗУЛЬТАТ ЛЕЧЕНИЯ:
[ ] Выздоровление  [ ] Улучшение  [ ] Без изменений

РЕКОМЕНДАЦИИ:
1. _________________________________
2. _________________________________
3. _________________________________

СРОК ВРЕМЕННОЙ НЕТРУДОСПОСОБНОСТИ: _______ дней
СЛЕДУЮЩИЙ ОСМОТР: _____________

Врач: _________________________________    Подпись: _________________`,
      },
      {
        type: 'Рецепт',
        title: 'Рецепт на лекарственное средство',
        content: `РЕЦЕПТ

Дата: _________________

Пациент: _________________________________
Возраст: _________________

Rp.:
1. _________________________________
   Способ применения: _________________________________
   Дозировка: _________________________________
   Кратность: _______ раз(а) в день
   Курс: _______ дней

2. _________________________________
   Способ применения: _________________________________
   Дозировка: _________________________________
   Кратность: _______ раз(а) в день
   Курс: _______ дней

Особые указания: _________________________________

Врач: _________________________________    Подпись: _________________
Печать: _________________`,
      },
      {
        type: 'Направление',
        title: 'Направление к специалисту',
        content: `НАПРАВЛЕНИЕ К СПЕЦИАЛИСТУ

Дата: _________________
Из клиники: «{clinic_name}»

Пациент: _________________________________
Дата рождения: _________________
Телефон: _________________

ДИАГНОЗ: _________________________________
(МКБ-10: _______)

НАПРАВЛЯЕТСЯ К:
Врач: _________________________________
Специальность: _________________________________
Клиника/учреждение: _________________________________

ЦЕЛЬ НАПРАВЛЕНИЯ:
_______________________________
_______________________________

СРОЧНОСТЬ: [ ] Экстренно [ ] В плановом порядке

СОПРОВОДИТЕЛЬНЫЕ ДОКУМЕНТЫ:
[ ] Рентгеновские снимки
[ ] Выписка из медицинской карты
[ ] Результаты анализов
[ ] Иное: _________________________________

Врач: _________________________________    Подпись: _________________
Печать: _________________`,
      },
    ],
  },
  {
    category: 'Договоры',
    items: [
      {
        type: 'Договор на лечение',
        title: 'Договор на оказание стоматологических услуг',
        content: `ДОГОВОР НА ОКАЗАНИЕ СТОМАТОЛОГИЧЕСКИХ УСЛУГ № _____________

г. _____________                         _____________ 20___ г.

«{clinic_name}» (далее — Исполнитель), в лице директора _________________________________,
с одной стороны, и

_______________________________ (далее — Пациент/Заказчик), паспорт серия _______ № _____________,
выдан _____________, дата выдачи _____________,
с другой стороны, заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
   1.1. Исполнитель обязуется оказать стоматологические медицинские услуги,
        а Пациент — принять и оплатить указанные услуги.

2. ПЕРЕЧЕНЬ УСЛУГ И СТОИМОСТЬ
   №  |  Наименование услуги                          |  Стоимость (₸)
   1.  |  ________________________________________   |  _____________
   2.  |  ________________________________________   |  _____________
   3.  |  ________________________________________   |  _____________
                                                   ИТОГО: _____________

3. ПОРЯДОК ОПЛАТЫ
   3.1. Оплата производится: [ ] Наличными [ ] Банковская карта [ ] Перевод
   3.2. Предоплата: _____________ %
   3.3. Окончательный расчёт — после завершения оказания услуг.

4. СРОКИ ВЫПОЛНЕНИЯ
   4.1. Услуги оказываются в сроки, согласованные в плане лечения.

5. ОБЯЗАННОСТИ СТОРОН
   5.1. Исполнитель обязуется оказать услуги надлежащего качества.
   5.2. Пациент обязуется предоставить достоверную информацию о здоровье.

6. ГАРАНТИИ
   6.1. Гарантийный срок на протезы и коронки: 12 месяцев.

7. ОТВЕТСТВЕННОСТЬ
   7.1. Стороны несут ответственность в соответствии с законодательством РК.

ПОДПИСИ СТОРОН:

Исполнитель: _________________    Пациент: _________________
Печать: _________________`,
      },
    ],
  },
  {
    category: 'Справки',
    items: [
      {
        type: 'Справка о лечении',
        title: 'Справка о прохождении стоматологического лечения',
        content: `СПРАВКА

Выдана _________________________________ (ФИО пациента)
Дата рождения: _________________

В том, что он(а) проходил(а) стоматологическое лечение в клинике «{clinic_name}»
с _____________ по _____________

Диагноз: _________________________________

Проведённое лечение:
_______________________________
_______________________________

Справка выдана для предъявления по месту требования.

Дата выдачи: _________________

Лечащий врач: _________________    Подпись: _________________
Главный врач: _________________    Подпись: _________________
Печать клиники: _________________`,
      },
      {
        type: 'Справка об отсутствии противопоказаний',
        title: 'Справка об отсутствии противопоказаний к стоматологическому лечению',
        content: `СПРАВКА ОБ ОТСУТСТВИИ ПРОТИВОПОКАЗАНИЙ

Выдана _________________________________ (ФИО пациента)
Дата рождения: _________________

На основании проведённого осмотра и собранного анамнеза установлено, что
противопоказаний к проведению стоматологических манипуляций НЕТ.

Имеющиеся хронические заболевания (при наличии):
_______________________________

Срок действия справки: 30 дней с момента выдачи.

Дата: _________________

Врач-стоматолог: _________________    Подпись: _________________
Печать: _________________`,
      },
    ],
  },
];

interface DocForm {
  patient_id: string
  doctor_id: string
  doc_type: string
  title: string
  content: string
  status: string
}

interface TemplateItem {
  type: string
  title: string
  content: string
}

interface OutletContext {
  clinic: Clinic & { id: string; name: string }
  user: UserType
  roleInfo?: RoleInfo
}

function getAllTemplates(): TemplateItem[] {
  return DOC_TEMPLATES.flatMap(cat => cat.items);
}

function TemplateCard({ template, onSelect }: { template: TemplateItem; onSelect: (t: TemplateItem) => void }) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="rounded-xl border border-bdr-subtle bg-surface-raised p-3 text-left transition-all hover:border-dv-gold/30 hover:bg-surface-raised-hover"
    >
      <p className="text-xs font-bold text-txt-primary truncate">{template.title}</p>
      <p className="text-[10px] text-txt-muted mt-0.5">{template.type}</p>
    </button>
  );
}

export default function Documents() {
  const { clinic, user } = useOutletContext<OutletContext>();
  const { patients, doctors, documents, upsertDocument, deleteDocument } = useDataQuery(clinic?.id);
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [contentSnapshot, setContentSnapshot] = useState('');
  const [form, setForm] = useState<DocForm>({
    patient_id: '', doctor_id: '', doc_type: '', title: '', content: '', status: 'draft',
  });

  const allTypes = useMemo(() => {
    const types = new Set<string>((documents || []).map(d => d.doc_type).filter(Boolean) as string[]);
    DOC_TEMPLATES.forEach(cat => cat.items.forEach(t => types.add(t.type)));
    return ['all', ...Array.from(types).sort()];
  }, [documents]);

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    let result = documents;
    if (filterType !== 'all') result = result.filter(d => d.doc_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.title?.toLowerCase().includes(q) ||
        d.patient_name?.toLowerCase().includes(q) ||
        d.doc_type?.toLowerCase().includes(q) ||
        d.content?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [documents, searchQuery, filterType]);

  const resetForm = () => {
    setForm({ patient_id: '', doctor_id: '', doc_type: '', title: '', content: '', status: 'draft' });
    setContentSnapshot('');
    setEditingId(null);
    setShowForm(false);
    setShowTemplates(false);
  };

  const autoFillContent = (content: string, patientId: string, doctorId: string): string => {
    if (!content) return content;
    let filled = content;
    const patient = patients.find(p => p.id === patientId);
    const doctor = doctors.find(d => d.id === doctorId);
    const clinicName = clinic?.name || 'Клиника';
    filled = filled.replace(/{clinic_name}/g, clinicName);
    if (patient) {
      const pName = patient.name || '';
      filled = filled.replace(/_{15,}\s*\(ФИО пациента\)/g, pName.padEnd(35, ' '));
      filled = filled.replace(/_{10,}\s*\(ФИО\)/g, pName.padEnd(25, ' '));
      if (patient.dob) filled = filled.replace(/дата рождения: _________________/g, `дата рождения: ${patient.dob}`);
      if (patient.phone) filled = filled.replace(/Телефон: _________________/g, `Телефон: ${patient.phone}`);
      if (patient.passport) filled = filled.replace(/паспорт: _________________/g, `паспорт: ${patient.passport}`);
      if (patient.address) filled = filled.replace(/Адрес: _________________/g, `Адрес: ${patient.address}`);
    }
    if (doctor) {
      const dName = doctor.name || '';
      filled = filled.replace(/Врач: _________________/g, `Врач: ${dName.padEnd(30, ' ')}`);
      filled = filled.replace(/Хирург: _________________/g, `Хирург: ${dName.padEnd(30, ' ')}`);
      filled = filled.replace(/Врач-стоматолог: _________________/g, `Врач-стоматолог: ${dName.padEnd(20, ' ')}`);
      filled = filled.replace(/_{15,}\s*\(ФИО врача\)/g, dName.padEnd(35, ' '));
      if (doctor.spec) filled = filled.replace(/_{10,}\s*\(специальность\)/g, doctor.spec);
    }
    return filled;
  };

  const applyTemplate = (template: TemplateItem) => {
    const clinicName = clinic?.name || 'Клиника';
    let content = template.content.replace(/{clinic_name}/g, clinicName);
    content = autoFillContent(content, form.patient_id, form.doctor_id);
    setContentSnapshot(content);
    setForm(f => ({ ...f, doc_type: template.type, title: template.title, content }));
    setShowTemplates(false);
    setShowForm(true);
  };

  const startEdit = (doc: Document) => {
    setForm({
      patient_id: doc.patient_id || doc.patientId || '',
      doctor_id: doc.doctor_id || '',
      doc_type: doc.doc_type || '',
      title: doc.title || '',
      content: doc.content || '',
      status: doc.status || 'draft',
    });
    setContentSnapshot(doc.content || '');
    setEditingId(doc.id);
    setShowForm(true);
  };

  const handlePatientChange = (patientId: string) => {
    setForm(f => {
      const newForm = { ...f, patient_id: patientId };
      if (contentSnapshot && f.content) {
        const reverted = f.content !== contentSnapshot ? contentSnapshot : f.content;
        const newContent = autoFillContent(reverted, patientId, f.doctor_id);
        setContentSnapshot(newContent);
        return { ...newForm, content: newContent };
      }
      return newForm;
    });
  };

  const handleDoctorChange = (doctorId: string) => {
    setForm(f => {
      const newForm = { ...f, doctor_id: doctorId };
      if (contentSnapshot && f.content) {
        const reverted = f.content !== contentSnapshot ? contentSnapshot : f.content;
        const newContent = autoFillContent(reverted, f.patient_id, doctorId);
        setContentSnapshot(newContent);
        return { ...newForm, content: newContent };
      }
      return newForm;
    });
  };

  const saveDocument = async () => {
    if (!form.title || !form.doc_type) { toast.error('Заполните тип и название документа'); return; }
    const patient = patients.find(p => p.id === form.patient_id);
    await upsertDocument({
      id: editingId || gid(),
      ...form,
      clinic_id: clinic.id,
      doctor_id: form.doctor_id || user?.id,
      patient_name: patient?.name || '',
      user_id: user?.id,
      user_name: user?.name,
    } as any);
    toast.success(editingId ? 'Документ обновлён' : 'Документ создан');
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить документ?')) return;
    await deleteDocument(id);
    toast.success('Документ удалён');
  };

  const downloadDoc = (doc: Document) => {
    const blob = new Blob([doc.content || ''], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${doc.title || 'document'}.txt`;
    link.click();
  };

  const copyDoc = (content: string) => {
    navigator.clipboard.writeText(content || '').then(() => toast.success('Скопировано в буфер'));
  };

  const [signLink, setSignLink] = useState<string | null>(null);

  const handleSendForSignature = async (doc: Document) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001')}/api/documents/${doc.id}/send-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSignLink(data.signingUrl);
      toast.success('Ссылка для подписи создана');
    } catch {
      toast.error('Ошибка создания ссылки');
    }
  };

  const [signInlineDoc, setSignInlineDoc] = useState<Document | null>(null);
  const [signInlineName, setSignInlineName] = useState('');

  const handleSignInline = async (doc: Document) => {
    if (!signInlineDoc || signInlineDoc.id !== doc.id) {
      setSignInlineDoc(doc);
      return;
    }
  };

  const handleInlineSignSave = async (signatureData: string) => {
    if (!signInlineName.trim()) { toast.warning('Введите имя'); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001')}/api/documents/${signInlineDoc!.id}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data: signatureData, signed_by_name: signInlineName }),
      });
      if (!res.ok) throw new Error();
      toast.success('Документ подписан');
      setSignInlineDoc(null);
    } catch {
      toast.error('Ошибка подписания');
    }
  };

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Электронные документы"
        subtitle="Согласия, рецепты, направления, договоры, справки, заключения"
        icon={<FileText size={24} className="text-dv-gold" />}
        actions={
          <>
            <Button variant="outline" icon={<Copy size={16} />} onClick={() => { resetForm(); setShowTemplates(true); }}>
              Из шаблона
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => { resetForm(); setShowForm(true); }}>
              Вручную
            </Button>
          </>
        }
      />

      {showTemplates && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Copy size={16} className="text-dv-gold" /> Выберите шаблон документа
                </span>
                <Button variant="ghost" size="icon-sm" icon={<X size={18} />} onClick={() => setShowTemplates(false)} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DOC_TEMPLATES.map(cat => (
                  <div key={cat.category}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-txt-muted mb-2 flex items-center gap-1.5">
                      {cat.category === 'Согласия' && <Shield size={12} />}
                      {cat.category === 'Медицинские документы' && <Stethoscope size={12} />}
                      {cat.category === 'Договоры' && <FileText size={12} />}
                      {cat.category === 'Справки' && <ClipboardList size={12} />}
                      {cat.category}
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {cat.items.map(t => (
                        <TemplateCard key={t.type} template={t} onSelect={applyTemplate} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{editingId ? 'Редактирование' : 'Новый документ'}</span>
                <Button variant="ghost" size="icon-sm" icon={<X size={18} />} onClick={resetForm} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Тип документа *</label>
                    <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                      <option value="">Выберите...</option>
                      {DOC_TEMPLATES.map(cat => (
                        <optgroup key={cat.category} label={cat.category}>
                          {cat.items.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Пациент</label>
                    <select value={form.patient_id} onChange={e => handlePatientChange(e.target.value)}>
                      <option value="">Не выбран</option>
                      {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Врач</label>
                    <select value={form.doctor_id} onChange={e => handleDoctorChange(e.target.value)}>
                      <option value="">Не выбран</option>
                      {(doctors || []).map(d => <option key={d.id} value={d.id}>{d.name}{d.spec ? ` (${d.spec})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Статус</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Название *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Название документа..." />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Содержание</label>
                  <textarea rows={16} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Текст документа..." className="font-mono text-xs leading-relaxed" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={resetForm}>Отмена</Button>
                  <Button variant="primary" icon={<Save size={14} />} onClick={saveDocument}>
                    {editingId ? 'Обновить' : 'Создать'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input placeholder="Поиск по названию, пациенту, содержанию..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full md:w-56">
          {allTypes.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'Все типы' : t}</option>
          ))}
        </select>
      </div>

      {previewDoc && (
        <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-txt-primary">{previewDoc.title}</h3>
                <p className="text-xs text-txt-muted">{previewDoc.doc_type} · {previewDoc.patient_name || 'Без пациента'}</p>
              </div>
              <Button variant="ghost" size="icon-sm" icon={<X size={20} />} onClick={() => setPreviewDoc(null)} />
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-white/5 p-6 text-sm text-txt-secondary font-mono leading-relaxed border border-bdr-subtle">
              {previewDoc.content || 'Нет содержания'}
            </div>
            {previewDoc.signature_data && (
              <div className="mt-4 rounded-lg border border-dv-gold/20 bg-dv-gold/5 p-4">
                <p className="mb-2 text-xs font-semibold text-dv-gold">Электронная подпись</p>
                <img src={previewDoc.signature_data} alt="Подпись" className="max-h-20 bg-white rounded-md p-1" />
                <p className="mt-2 text-xs text-txt-muted">
                  {previewDoc.signed_by_name && `Подпись: ${previewDoc.signed_by_name}`}
                  {previewDoc.signed_at && ` · ${new Date(previewDoc.signed_at).toLocaleString('ru-RU')}`}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" icon={<Copy size={12} />} onClick={() => copyDoc(previewDoc.content || '')}>Копировать</Button>
              <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={() => downloadDoc(previewDoc)}>Скачать</Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="space-y-2">
        {filteredDocs.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="Нет документов"
            description="Создайте из шаблона или вручную"
          />
        ) : (
          filteredDocs.map((doc, i) => {
            const statusInfo = DOC_STATUS[doc.status || 'draft'] || DOC_STATUS.draft;
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Card hover className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dv-gold/10">
                        <FileText size={18} className="text-dv-gold" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-txt-primary">{doc.title}</h4>
                          <Badge variant={statusInfo.v as any} size="xs">{statusInfo.l}</Badge>
                        </div>
                        <p className="text-xs text-txt-muted mt-0.5">
                          {doc.doc_type} · {doc.patient_name || 'Без пациента'} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-xs" icon={<Eye size={14} />} onClick={() => setPreviewDoc(doc)} title="Просмотр" />
                      <Button variant="ghost" size="icon-xs" icon={<Copy size={14} />} onClick={() => copyDoc(doc.content || '')} title="Копировать" />
                      <Button variant="ghost" size="icon-xs" icon={<Download size={14} />} onClick={() => downloadDoc(doc)} title="Скачать" />
                      <Button variant="ghost" size="icon-xs" icon={<Edit3 size={14} />} onClick={() => startEdit(doc)} title="Редактировать" />
                      <Button variant="ghost" size="icon-xs" icon={<Trash2 size={14} />} onClick={() => handleDelete(doc.id)} title="Удалить" className="text-txt-muted hover:text-error" />
                      {doc.status !== 'signed' && (
                        <>
                          <Button variant="ghost" size="icon-xs" icon={<Send size={14} />} onClick={() => handleSendForSignature(doc)} title="Отправить на подпись" />
                          <Button variant="ghost" size="icon-xs" icon={<PenTool size={14} />} onClick={() => handleSignInline(doc)} title="Подписать на планшете" className="text-txt-muted hover:text-emerald-400" />
                        </>
                      )}
                    </div>
                  </div>
                  {signLink && signInlineDoc?.id !== doc.id && (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
                        <Link2 size={12} /> Ссылка для подписи
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate text-xs text-txt-secondary">{signLink}</code>
                        <Button variant="primary" size="xs" onClick={() => { navigator.clipboard.writeText(signLink); toast.success('Скопировано'); }}>Копировать</Button>
                        <Button variant="ghost" size="icon-xs" icon={<X size={12} />} onClick={() => setSignLink(null)} />
                      </div>
                    </div>
                  )}
                  {signInlineDoc?.id === doc.id && (
                    <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="mb-2 text-xs font-semibold text-emerald-400">Подпись на планшете</p>
                      <input type="text" value={signInlineName} onChange={e => setSignInlineName(e.target.value)} placeholder="ФИО пациента" className="mb-3 w-full" />
                      <div className="flex justify-center">
                        <SignaturePad onSave={handleInlineSignSave} width={Math.min(450, 380)} height={150} />
                      </div>
                      <button onClick={() => setSignInlineDoc(null)} className="mt-2 text-xs text-txt-muted hover:text-txt-primary">Отмена</button>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="text-center text-xs text-txt-ghost">
        {filteredDocs.length} документов · Шаблонов: {getAllTemplates().length}
      </div>
    </div>
  );
}
