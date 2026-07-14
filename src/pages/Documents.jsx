import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Search, Edit3, Save, X, Trash2, Download, Eye } from 'lucide-react';
import { T, gid, today } from '../utils/constants';
import { useData, useToast } from '../hooks/useData';

const DOC_TYPES = [
  'Согласие на лечение', 'Согласие на анестезию', 'Согласие на операцию',
  'Медицинское заключение', 'Справка', 'Рецепт', 'Направление',
  'Эпикриз', 'Договор', 'Претензия', 'Другое'
];

const DOC_STATUS = {
  draft: { l: 'Черновик', c: T.slate },
  active: { l: 'Действующий', c: T.emerald },
  archived: { l: 'Архив', c: T.sapphire },
};

export default function Documents() {
  const { clinic, user } = useOutletContext();
  const { patients, doctors, documents, upsertDocument, deleteDocument } = useData(clinic?.id);
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [form, setForm] = useState({
    patient_id: '', doctor_id: '', doc_type: '', title: '', content: '', status: 'draft',
  });

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    const q = searchQuery.toLowerCase();
    return documents.filter(d =>
      !q || d.title?.toLowerCase().includes(q) ||
      d.patient_name?.toLowerCase().includes(q) ||
      d.doc_type?.toLowerCase().includes(q)
    );
  }, [documents, searchQuery]);

  const resetForm = () => {
    setForm({ patient_id: '', doctor_id: '', doc_type: '', title: '', content: '', status: 'draft' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (doc) => {
    setForm({
      patient_id: doc.patient_id || doc.patientId || '',
      doctor_id: doc.doctor_id || doc.doctorId || '',
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
      doctor_id: form.doctor_id || user?.id,
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

  return (
    <div className="fade-in space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={24} style={{ color: T.gold }} />
            Электронные документы
          </h1>
          <p className="mt-1 text-sm text-slate-500">Согласия, заключения, справки, договоры</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-black" style={{ background: T.gold }}>
          <Plus size={16} /> Новый документ
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{editingId ? 'Редактирование документа' : 'Новый документ'}</h3>
            <button onClick={resetForm} className="text-slate-500 hover:text-white"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Тип документа *</label>
              <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                <option value="">Выберите...</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
            <textarea rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Текст документа..." className="font-mono text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 hover:text-white">Отмена</button>
            <button onClick={saveDocument} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-black" style={{ background: T.emerald }}>
              <Save size={14} /> {editingId ? 'Обновить' : 'Создать'}
            </button>
          </div>
        </motion.div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input placeholder="Поиск по названию, пациенту, типу..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      {previewDoc && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewDoc(null)}>
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#0D1B2E] p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{previewDoc.title}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-2">{previewDoc.doc_type} · {previewDoc.patient_name || 'Без пациента'}</p>
            <div className="whitespace-pre-wrap rounded-lg bg-white/5 p-4 text-sm text-slate-300 font-mono leading-relaxed">
              {previewDoc.content || 'Нет содержания'}
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-2">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-20 text-center">
            <FileText size={48} className="mb-3 text-slate-600" />
            <p className="text-lg font-semibold text-slate-500">Нет документов</p>
            <p className="text-sm text-slate-600">Создайте первый документ</p>
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
                      <div className="flex items-center gap-2">
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
                    <button onClick={() => startEdit(doc)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#C9A96E]" title="Редактировать">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(doc.id)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#E74C3C]" title="Удалить">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
