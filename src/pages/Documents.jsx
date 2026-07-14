import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Search, Edit3, Save, X, Trash2, Download, Eye, Copy, Stethoscope, Shield, ClipboardList, PenTool, Send, Link2 } from 'lucide-react';
import SignaturePad from '../components/ui/SignaturePad';
import { T, gid, today } from '../utils/constants';
import { useData, useToast } from '../hooks/useData';

const DOC_STATUS = {
  draft: { l: 'Черновик', c: T.slate },
  active: { l: 'Действующий', c: T.emerald },
  pending_signature: { l: 'Ожидает подписи', c: T.amber },
  signed: { l: 'Подписан', c: T.gold },
  archived: { l: 'Архив', c: T.sapphire },
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

Стоимость 전체го лечения: _____________ тенге

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

function getAllTemplates() {
  return DOC_TEMPLATES.flatMap(cat => cat.items);
}

function TemplateCard({ template, onSelect }) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-left transition-all hover:border-[#C9A96E]/20 hover:bg-white/[0.04]"
    >
      <p className="text-xs font-bold text-white truncate">{template.title}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{template.type}</p>
    </button>
  );
}

export default function Documents() {
  const { clinic, user } = useOutletContext();
  const { patients, documents, upsertDocument, deleteDocument } = useData(clinic?.id);
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [form, setForm] = useState({
    patient_id: '', doc_type: '', title: '', content: '', status: 'draft',
  });

  const allTypes = useMemo(() => {
    const types = new Set((documents || []).map(d => d.doc_type).filter(Boolean));
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
    setForm({ patient_id: '', doc_type: '', title: '', content: '', status: 'draft' });
    setEditingId(null);
    setShowForm(false);
    setShowTemplates(false);
  };

  const applyTemplate = (template) => {
    const clinicName = clinic?.name || 'Клиника';
    const content = template.content.replace(/{clinic_name}/g, clinicName);
    setForm(f => ({ ...f, doc_type: template.type, title: template.title, content }));
    setShowTemplates(false);
    setShowForm(true);
  };

  const startEdit = (doc) => {
    setForm({
      patient_id: doc.patient_id || doc.patientId || '',
      doc_type: doc.doc_type || '',
      title: doc.title || '',
      content: doc.content || '',
      status: doc.status || 'draft',
    });
    setEditingId(doc.id);
    setShowForm(true);
  };

  const saveDocument = async () => {
    if (!form.title || !form.doc_type) { toast.error('Заполните тип и название документа'); return; }
    await upsertDocument({
      id: editingId || gid(),
      ...form,
      clinic_id: clinic.id,
      doctor_id: user?.id,
      user_id: user?.id,
      user_name: user?.name,
    });
    toast.success(editingId ? 'Документ обновлён' : 'Документ создан');
    resetForm();
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить документ?')) return;
    await deleteDocument(id);
    toast.success('Документ удалён');
  };

  const downloadDoc = (doc) => {
    const blob = new Blob([doc.content || ''], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${doc.title || 'document'}.txt`;
    link.click();
  };

  const copyDoc = (content) => {
    navigator.clipboard.writeText(content || '').then(() => toast.success('Скопировано в буфер'));
  };

  const [signLink, setSignLink] = useState(null);

  const handleSendForSignature = async (doc) => {
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

  const handleSignInline = async (doc) => {
    if (!signInlineDoc || signInlineDoc.id !== doc.id) {
      setSignInlineDoc(doc);
      return;
    }
  };

  const [signInlineDoc, setSignInlineDoc] = useState(null);
  const [signInlineName, setSignInlineName] = useState('');

  const handleInlineSignSave = async (signatureData) => {
    if (!signInlineName.trim()) { toast.warning('Введите имя'); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001')}/api/documents/${signInlineDoc.id}/sign`, {
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
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={24} style={{ color: T.gold }} />
            Электронные документы
          </h1>
          <p className="mt-1 text-sm text-slate-500">Согласия, рецепты, направления, договоры, справки, заключения</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setShowTemplates(true); }}
            className="flex items-center gap-2 rounded-lg border border-[#C9A96E]/20 bg-[#C9A96E]/8 px-4 py-2.5 text-sm font-semibold text-[#C9A96E]">
            <Copy size={16} /> Из шаблона
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-black" style={{ background: T.gold }}>
            <Plus size={16} /> Вручную
          </button>
        </div>
      </div>

      {showTemplates && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Copy size={16} style={{ color: T.gold }} /> Выберите шаблон документа
            </h3>
            <button onClick={() => setShowTemplates(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
          </div>
          {DOC_TEMPLATES.map(cat => (
            <div key={cat.category}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
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
        </motion.div>
      )}

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{editingId ? 'Редактирование' : 'Новый документ'}</h3>
            <button onClick={resetForm} className="text-slate-500 hover:text-white"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Тип документа *</label>
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
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Пациент</label>
              <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}>
                <option value="">Не выбран</option>
                {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Статус</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Название *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Название документа..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Содержание</label>
            <textarea rows={16} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Текст документа..." className="font-mono text-xs leading-relaxed" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 hover:text-white">Отмена</button>
            <button onClick={saveDocument} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-black" style={{ background: T.emerald }}>
              <Save size={14} /> {editingId ? 'Обновить' : 'Создать'}
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input placeholder="Поиск по названию, пациенту, содержанию..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full md:w-56">
          {allTypes.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'Все типы' : t}</option>
          ))}
        </select>
      </div>

      {previewDoc && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewDoc(null)}>
          <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0D1B2E] p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500">{previewDoc.doc_type} · {previewDoc.patient_name || 'Без пациента'}</p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-white/5 p-6 text-sm text-slate-300 font-mono leading-relaxed border border-white/5">
              {previewDoc.content || 'Нет содержания'}
            </div>
            {previewDoc.signature_data && (
              <div className="mt-4 rounded-lg border border-[#C9A96E]/20 bg-[#C9A96E]/5 p-4">
                <p className="mb-2 text-xs font-semibold text-[#C9A96E]">Электронная подпись</p>
                <img src={previewDoc.signature_data} alt="Подпись" style={{ maxHeight: 80, background: 'white', borderRadius: 6, padding: 4 }} />
                <p className="mt-2 text-xs text-slate-500">
                  {previewDoc.signed_by_name && `Подпись: ${previewDoc.signed_by_name}`}
                  {previewDoc.signed_at && ` · ${new Date(previewDoc.signed_at).toLocaleString('ru-RU')}`}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => copyDoc(previewDoc.content)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:text-white">
                <Copy size={12} /> Копировать
              </button>
              <button onClick={() => downloadDoc(previewDoc)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:text-white">
                <Download size={12} /> Скачать
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-2">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-20 text-center">
            <FileText size={48} className="mb-3 text-slate-600" />
            <p className="text-lg font-semibold text-slate-500">Нет документов</p>
            <p className="text-sm text-slate-600">Создайте из шаблона или вручную</p>
          </div>
        ) : (
          filteredDocs.map((doc, i) => {
            const statusInfo = DOC_STATUS[doc.status] || DOC_STATUS.draft;
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-[#C9A96E]/15 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${T.gold}12` }}>
                      <FileText size={18} style={{ color: T.gold }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">{doc.title}</h4>
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${statusInfo.c}18`, color: statusInfo.c }}>
                          {statusInfo.l}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {doc.doc_type} · {doc.patient_name || 'Без пациента'} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPreviewDoc(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#C9A96E]" title="Просмотр">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => copyDoc(doc.content)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#C9A96E]" title="Копировать">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => downloadDoc(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#C9A96E]" title="Скачать">
                      <Download size={14} />
                    </button>
                    <button onClick={() => startEdit(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#C9A96E]" title="Редактировать">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(doc.id)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#E74C3C]" title="Удалить">
                      <Trash2 size={14} />
                    </button>
                    {doc.status !== 'signed' && (
                      <>
                        <button onClick={() => handleSendForSignature(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-amber-400" title="Отправить на подпись">
                          <Send size={14} />
                        </button>
                        <button onClick={() => handleSignInline(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-emerald-400" title="Подписать на планшете">
                          <PenTool size={14} />
                        </button>
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
                      <code className="flex-1 truncate text-xs text-[#DDE4EA]">{signLink}</code>
                      <button onClick={() => { navigator.clipboard.writeText(signLink); toast.success('Скопировано'); }} className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold" style={{ background: T.gold, color: T.bg }}>Копировать</button>
                      <button onClick={() => setSignLink(null)} className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-white">✕</button>
                    </div>
                  </div>
                )}
                {signInlineDoc?.id === doc.id && (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="mb-2 text-xs font-semibold text-emerald-400">Подпись на планшете</p>
                    <input type="text" value={signInlineName} onChange={e => setSignInlineName(e.target.value)} placeholder="ФИО пациента"
                      className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500" />
                    <div className="flex justify-center">
                      <SignaturePad onSave={handleInlineSignSave} width={Math.min(450, 380)} height={150} />
                    </div>
                    <button onClick={() => setSignInlineDoc(null)} className="mt-2 text-xs text-slate-500 hover:text-white">Отмена</button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <div className="text-center text-xs text-slate-600">
        {filteredDocs.length} документов · Шаблонов: {getAllTemplates().length}
      </div>
    </div>
  );
}
