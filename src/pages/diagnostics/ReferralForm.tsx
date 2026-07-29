import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Send, User, Microscope, FlaskConical, Building2, FlaskRound as FlaskRoundIcon, Upload } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import { Button } from '@/components/ui/ds/Button';
import { Input, Select, Textarea } from '@/components/ui/ds/Input';
import { Card } from '@/components/ui/ds/Card';
import * as api from '@/utils/api';
import { queryKeys } from '@/queries/keys';
import FileUploader from '@/components/diagnostics/FileUploader';
import ToothSelector from '@/components/diagnostics/ToothSelector';
import { fileToDataUrl } from '@/lib/image-upload';

type DiagCategory = '3D' | 'LABORATORY';
const CATEGORIES: { value: DiagCategory; label: string; icon: React.ReactNode }[] = [
  { value: '3D', label: '3D-диагностика', icon: <Microscope size={16} /> },
  { value: 'LABORATORY', label: 'Лабораторные исследования', icon: <FlaskConical size={16} /> },
];

const STUDY_TYPES: Record<string, { value: string; label: string }[]> = {
  '3D': [
    { value: 'CBCT', label: 'CBCT (КЛКТ)' },
    { value: 'OPG', label: 'ОПГ (Панорамный)' },
    { value: 'TRG', label: 'ТРГ (Телерентгенограмма)' },
    { value: 'TMJ', label: 'ВНЧС' },
    { value: 'STL', label: 'STL-скан' },
    { value: 'FACE_SCAN', label: 'Face Scan' },
    { value: 'DICOM', label: 'DICOM-загрузка' },
  ],
  'LABORATORY': [
    { value: 'ALLERGY', label: 'Аллергопробы' },
    { value: 'HISTOLOGY', label: 'Гистология' },
    { value: 'PCR', label: 'ПЦР' },
    { value: 'MICROBIOLOGY', label: 'Микробиология' },
    { value: 'BLOOD', label: 'Анализ крови' },
    { value: 'GENETICS', label: 'Генетика' },
    { value: 'BIOPSY', label: 'Биопсия' },
    { value: 'SALIVA', label: 'Анализ слюны' },
    { value: 'PATHOLOGY', label: 'Патология' },
    { value: 'OTHER', label: 'Другое' },
  ],
};

const PRIORITIES = [
  { value: 'NORMAL', label: 'Обычный' },
  { value: 'URGENT', label: 'Срочный' },
  { value: 'EMERGENCY', label: 'Экстренный' },
];

const GENDERS = [
  { value: '', label: 'Не указан' },
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export default function ReferralForm() {
  const { user, clinic, clinics, activeMembership } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialPatientName = searchParams.get('patientName') || '';
  const initialPatientPhone = searchParams.get('patientPhone') || '';
  const initialPatientId = searchParams.get('patientId') || '';

  const [category, setCategory] = useState<DiagCategory>('3D');
  const [form, setForm] = useState({
    patientName: initialPatientName, patientIin: '', patientBirth: '', patientGender: '',
    patientPhone: initialPatientPhone, patientEmail: '', pregnancy: false, allergies: '', specialNotes: '',
    studyType: 'CBCT', complaints: '', preliminaryDx: '', studyGoal: '',
    commentForDoctor: '', commentForLab: '', priority: 'NORMAL',
    centerId: '', labId: '',
  });

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const selectedClinicId = clinic?.id || activeMembership?.clinicId || '';
  const [files, setFiles] = useState<{ id: string; fileName: string; fileType: string; fileUrl: string; fileSize?: number }[]>([]);
  const [referralId, setReferralId] = useState<string | null>(null);
  const [teeth, setTeeth] = useState<number[]>([]);

  const handleFileUpload = useCallback(async (file: File, dataUrl: string) => {
    if (!referralId) {
      const id = Math.random().toString(36).slice(2);
      setFiles(prev => [...prev, { id, fileName: file.name, fileType: file.type, fileUrl: dataUrl, fileSize: file.size }]);
      return;
    }
    await api.uploadDiagnosticFile({
      referralId, fileName: file.name, fileData: dataUrl, fileType: file.type, fileSize: file.size,
    });
  }, [referralId]);

  const handleDeleteFile = useCallback(async (id: string) => {
    const file = files.find(f => f.id === id);
    if (!file) return;
    if (file.fileUrl.startsWith('data:')) {
      setFiles(prev => prev.filter(f => f.id !== id));
    } else {
      await api.deleteDiagnosticFile(id);
    }
  }, [files]);

  const { data: centersData } = useQuery({
    queryKey: queryKeys.diagnostics.centers(),
    queryFn: () => api.getDiagnosticCenters(),
    staleTime: 60_000,
  });
  const centers = useMemo(() => (centersData?.data || []).map((c: any) => ({ value: c.id, label: c.name })), [centersData]);

  const { data: labsData } = useQuery({
    queryKey: queryKeys.diagnostics.labs(),
    queryFn: () => api.getDiagnosticLaboratories(),
    staleTime: 60_000,
  });
  const labs = useMemo(() => (labsData?.data || []).map((l: any) => ({ value: l.id, label: l.name })), [labsData]);

  const clinicsOpts = useMemo(() =>
    (clinics || []).map((c: any) => ({ value: c.id, label: c.name })), [clinics]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createDiagnosticReferral(data),
    onSuccess: async (result: any) => {
      const rid = result?.data?.id || result?.id;
      setReferralId(rid);
      if (files.length > 0) {
        for (const f of files) {
          try { await api.uploadDiagnosticFile({ referralId: rid, fileName: f.fileName, fileData: f.fileUrl, fileType: f.fileType, fileSize: f.fileSize }); } catch { /* file upload failed, continue */ }
        }
      }
      toast.success('Направление создано');
      navigate('/diagnostics/referrals');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim()) { toast.warn('Введите имя пациента'); return; }
    if (!form.studyType) { toast.warn('Выберите тип исследования'); return; }

    const payload = {
      patientName: form.patientName,
      patientIin: form.patientIin || undefined,
      patientBirth: form.patientBirth || undefined,
      patientGender: form.patientGender || undefined,
      patientPhone: form.patientPhone || undefined,
      patientEmail: form.patientEmail || undefined,
      pregnancy: form.pregnancy || undefined,
      allergies: form.allergies || undefined,
      specialNotes: form.specialNotes || undefined,
      clinicId: selectedClinicId,
      doctorId: user!.id,
      category: form.studyType as any,
      studyType: form.studyType,
      complaints: form.complaints || undefined,
      preliminaryDx: form.preliminaryDx || undefined,
      studyGoal: form.studyGoal || undefined,
      commentForDoctor: form.commentForDoctor || undefined,
      commentForLab: form.commentForLab || undefined,
      priority: form.priority as any,
      centerId: form.centerId || undefined,
      labId: form.labId || undefined,
      anatomicalSites: teeth.length > 0 ? { teeth } : undefined,
    };

    createMutation.mutate(payload);
  };

  const currentStudies = STUDY_TYPES[category] || [];

  return (
    <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Назад" onClick={() => navigate('/diagnostics')}><ArrowLeft size={18} /></Button>
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Новое направление</h1>
          <p className="text-sm text-txt-muted mt-0.5">Заполните информацию для направления на диагностику</p>
        </div>
      </div>

      <Card padding="md">
        <label className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-3 block">Тип диагностики</label>
        <div className="flex gap-2">
          {CATEGORIES.map(c => (
            <button key={c.value} type="button" onClick={() => { setCategory(c.value); update('studyType', STUDY_TYPES[c.value][0]?.value || ''); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${category === c.value ? 'bg-dv-gold/10 border-dv-gold/40 text-dv-gold' : 'bg-surface-1 border-bdr-subtle text-txt-muted hover:text-txt-primary'}`}>
              {c.icon}{c.label}
            </button>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-dv-gold" />
          <h2 className="text-sm font-bold text-txt-primary">Пациент</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="ФИО *" value={form.patientName} onChange={e => update('patientName', e.target.value)} placeholder="Иванов Иван Иванович" required />
          <Input label="ИИН" value={form.patientIin} onChange={e => update('patientIin', e.target.value)} placeholder="12 цифр" />
          <Input label="Дата рождения" type="date" value={form.patientBirth} onChange={e => update('patientBirth', e.target.value)} />
          <Select label="Пол" value={form.patientGender} onChange={e => update('patientGender', e.target.value)} options={GENDERS} />
          <Input label="Телефон" value={form.patientPhone} onChange={e => update('patientPhone', e.target.value)} placeholder="+7 777 000 00 00" />
          <Input label="Email" type="email" value={form.patientEmail} onChange={e => update('patientEmail', e.target.value)} />
        </div>
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm text-txt-secondary cursor-pointer">
            <input type="checkbox" checked={form.pregnancy} onChange={e => update('pregnancy', e.target.checked)}
              className="accent-dv-gold w-4 h-4" />
            Беременность
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Input label="Аллергии" value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="Лидокаин, йод..." />
          <Input label="Особые отметки" value={form.specialNotes} onChange={e => update('specialNotes', e.target.value)} placeholder="Противопоказания, ограничения" />
        </div>
      </Card>

      <Card padding="md">
        <div className="flex items-center gap-2 mb-4">
          <Microscope size={16} className="text-dv-gold" />
          <h2 className="text-sm font-bold text-txt-primary">Исследование</h2>
        </div>
        <Select label="Тип исследования *" value={form.studyType} onChange={e => update('studyType', e.target.value)}
          options={currentStudies.map(s => ({ value: s.value, label: s.label }))} />
      </Card>

      {category === '3D' && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-dv-gold" />
            <h2 className="text-sm font-bold text-txt-primary">Диагностический центр</h2>
          </div>
          {centers.length > 0 ? (
            <Select label="Центр" value={form.centerId} onChange={e => update('centerId', e.target.value)}
              options={[{ value: '', label: 'Не выбран' }, ...centers]} />
          ) : (
            <p className="text-xs text-txt-muted italic">Нет доступных центров. Добавьте центр через SuperAdmin или регистрацию.</p>
          )}
        </Card>
      )}

      {category === 'LABORATORY' && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <FlaskRoundIcon size={16} className="text-dv-gold" />
            <h2 className="text-sm font-bold text-txt-primary">Лаборатория</h2>
          </div>
          {labs.length > 0 ? (
            <Select label="Лаборатория" value={form.labId} onChange={e => update('labId', e.target.value)}
              options={[{ value: '', label: 'Не выбрана' }, ...labs]} />
          ) : (
            <p className="text-xs text-txt-muted italic">Нет доступных лабораторий. Добавьте лабораторию через SuperAdmin или регистрацию.</p>
          )}
        </Card>
      )}

      {/* Tooth selector for 3D */}
      {category === '3D' && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Microscope size={16} className="text-dv-gold" />
            <h2 className="text-sm font-bold text-txt-primary">Зубы / Область</h2>
          </div>
          <ToothSelector selected={teeth} onChange={setTeeth} />
        </Card>
      )}

      <Card padding="md">
        <h2 className="text-sm font-bold text-txt-primary mb-4">Клиническая информация</h2>
        <div className="space-y-3">
          <Textarea label="Жалобы" value={form.complaints} onChange={e => update('complaints', e.target.value)} rows={2} placeholder="Что беспокоит пациента" />
          <Textarea label="Предварительный диагноз" value={form.preliminaryDx} onChange={e => update('preliminaryDx', e.target.value)} rows={2} placeholder="K00.0, K02.1..." />
          <Textarea label="Цель исследования" value={form.studyGoal} onChange={e => update('studyGoal', e.target.value)} rows={2} placeholder="Подтверждение диагноза, планирование имплантации..." />
          <Textarea label="Комментарий врачу" value={form.commentForDoctor} onChange={e => update('commentForDoctor', e.target.value)} rows={2} placeholder="Дополнительная информация для врача центра" />
          <Textarea label="Комментарий лаборатории" value={form.commentForLab} onChange={e => update('commentForLab', e.target.value)} rows={2} placeholder="Специфические требования" />
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-bold text-txt-primary mb-3">Приоритет</h2>
        <div className="flex gap-2">
          {PRIORITIES.map(p => (
            <button key={p.value} type="button" onClick={() => update('priority', p.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${form.priority === p.value ? 'border-dv-gold/40 bg-dv-gold/10' : 'border-bdr-subtle bg-surface-1'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <div className="flex items-center gap-2 mb-4">
          <Upload size={16} className="text-dv-gold" />
          <h2 className="text-sm font-bold text-txt-primary">Файлы</h2>
        </div>
        <FileUploader onUpload={handleFileUpload} files={files.map(f => ({ ...f, fileType: f.fileType }))} onDelete={handleDeleteFile} />
      </Card>

      <div className="flex items-center justify-between p-4 bg-surface-1 rounded-xl border border-bdr-subtle">
        <div className="text-xs text-txt-muted">
          {selectedClinicId ? 'Направление от клиники — без ограничений' : 'Личный режим — до 5 направлений в день'}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/diagnostics')}>Отмена</Button>
          <Button type="submit" variant="primary" loading={createMutation.isPending} icon={<Send size={16} />}>
            Отправить направление
          </Button>
        </div>
      </div>
    </motion.form>
  );
}
