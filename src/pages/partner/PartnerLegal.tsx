import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, Button, Badge, GlassCard, EmptyState, Skeleton, Modal } from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds';
import { apiRequest } from '../../utils/api';
import { FileText, Receipt, ScrollText, Scale, Download, Eye, CheckCircle, ChevronDown } from 'lucide-react';

const fd = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  REVIEW: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PUBLISHED: 'bg-green-500/10 text-green-400 border-green-500/20',
  ARCHIVED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  EXPIRED: 'bg-red-500/10 text-red-400 border-red-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Ожидает подписания',
  REVIEW: 'На проверке',
  APPROVED: 'Одобрен',
  PUBLISHED: 'Подписан',
  ARCHIVED: 'Архивный',
  EXPIRED: 'Просрочен',
  CANCELLED: 'Отменён',
};

const fmtKzt = (n: any) => new Intl.NumberFormat('ru-RU').format(Number(n || 0) / 100) + ' ₸';

export default function PartnerLegal() {
  const toast = useToast();
  const qc = useQueryClient();
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [signConfirm, setSignConfirm] = useState<string | null>(null);
  const [showLeagalForm, setShowLegalForm] = useState(false);
  const [editLegal, setEditLegal] = useState(false);
  const [legalForm, setLegalForm] = useState({ legalName: '', bin: '', director: '', address: '', iban: '', phone: '', email: '' });

  const { data: docs, isLoading: docsLoading, isError, error } = useQuery({
    queryKey: ['partner-legal-docs'],
    queryFn: () => apiRequest('/api/partner/legal/documents'),
    retry: false,
  });

  const { data: invoices } = useQuery({
    queryKey: ['partner-legal-invoices'],
    queryFn: () => apiRequest('/api/partner/legal/invoices'),
    retry: false,
  });

  const { data: history } = useQuery({
    queryKey: ['partner-legal-history'],
    queryFn: () => apiRequest('/api/partner/legal/history'),
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: (docId: string) => apiRequest(`/api/partner/legal/documents/${docId}/sign`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-legal-docs'] });
      qc.invalidateQueries({ queryKey: ['partner-legal-history'] });
      toast.showToast('Документ подписан', 'success');
      setSignConfirm(null);
    },
    onError: (e: any) => {
      const msg = e.message || 'Ошибка подписания';
      if (msg.includes('реквизиты')) {
        toast.showToast(msg, 'warning');
        setSignConfirm(null);
      } else {
        toast.showToast(msg, 'error');
      }
    },
  });

  const onboardMutation = useMutation({
    mutationFn: () => apiRequest('/api/partner/legal/onboard', { method: 'POST', body: JSON.stringify(legalForm) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-legal-docs'] });
      toast.showToast('Документы созданы', 'success');
      setShowLegalForm(false);
    },
    onError: (e: any) => {
      toast.showToast(e.message || 'Не удалось создать документы', 'error');
    },
  });

  const updateLegalMutation = useMutation({
    mutationFn: () => apiRequest('/api/partner/legal/partner', { method: 'PUT', body: JSON.stringify(legalForm) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-legal-docs'] });
      toast.showToast('Реквизиты обновлены, документы перегенерированы', 'success');
      setEditLegal(false);
    },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const err = error as any;
  const isForbidden = isError && (err?.status === 403);
  const docsArr = Array.isArray(docs) ? docs : [];
  const pendingDocs = docsArr.filter((d: any) => d.status === 'DRAFT' || d.status === 'REVIEW');

  const { data: partnerInfo } = useQuery({
    queryKey: ['partner-legal-partner'],
    queryFn: () => apiRequest('/api/partner/legal/partner'),
    enabled: !isForbidden && !isError,
    retry: false,
  });

  useEffect(() => {
    if (partnerInfo && typeof partnerInfo === 'object') {
      const p = partnerInfo as any;
      setLegalForm(prev => prev.legalName ? prev : {
        legalName: p.legalName || '',
        bin: p.bin || '',
        director: p.director || '',
        address: p.address || '',
        iban: p.iban || '',
        phone: p.phone || '',
        email: p.email || '',
      });
    }
  }, [partnerInfo]);

  if (docsLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  if (isForbidden && !showLeagalForm) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <Scale size={48} className="mx-auto mb-3 text-txt-muted" />
          <h2 className="text-lg font-bold text-txt-primary mb-2">Юридические документы</h2>
          <p className="text-sm text-txt-muted mb-4">У вашей клиники ещё нет юридических документов в системе. Заполните реквизиты для их создания.</p>
          <Button className="min-h-11" onClick={() => setShowLegalForm(true)}>Заполнить реквизиты</Button>
        </GlassCard>
      </div>
    );
  }

  if (showLeagalForm) {
    const fields = [
      { key: 'legalName', label: 'Наименование юрлица / ИП', placeholder: 'ТОО «Моя клиника»' },
      { key: 'bin', label: 'БИН / ИИН', placeholder: '123456789012' },
      { key: 'director', label: 'ФИО руководителя', placeholder: 'Иванов Иван Иванович' },
      { key: 'address', label: 'Юридический адрес', placeholder: 'г. Алматы, ул. Абая, д. 100' },
      { key: 'iban', label: 'IBAN счёт', placeholder: 'KZ123456789012345678' },
      { key: 'phone', label: 'Телефон', placeholder: '+7 (727) 123-45-67' },
      { key: 'email', label: 'Email', placeholder: 'info@clinic.kz' },
    ];
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="w-full max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <Scale size={20} className="text-dv-gold" />
            <h2 className="text-lg font-bold text-txt-primary">Реквизиты клиники</h2>
          </div>
          <p className="text-xs text-txt-muted mb-4">Данные будут использованы для генерации договоров (Договор с клиникой, NDA, DPA).</p>
          <div className="space-y-3">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-xs text-txt-secondary mb-1 block">{f.label}</label>
                <input
                  className="w-full px-3 py-2 min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg text-sm text-txt-primary focus:outline-none focus:border-dv-gold"
                  placeholder={f.placeholder}
                  value={(legalForm as any)[f.key]}
                  onChange={e => setLegalForm({ ...legalForm, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {onboardMutation.isError && <p className="text-xs text-red-400 mt-3">{(onboardMutation.error as any)?.message || 'Ошибка'}</p>}
          <div className="flex gap-2 mt-4">
            <Button className="min-h-11 flex-1" onClick={() => onboardMutation.mutate()} loading={onboardMutation.isPending}>Создать документы</Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setShowLegalForm(false)}>Отмена</Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard padding="lg" className="text-center max-w-md">
          <Scale size={48} className="mx-auto mb-3 text-red-400" />
          <h2 className="text-lg font-bold text-txt-primary mb-2">Ошибка загрузки</h2>
          <p className="text-sm text-txt-muted mb-4">{(error as any)?.message || 'Неизвестная ошибка'}</p>
          <Button className="min-h-11" onClick={() => qc.invalidateQueries({ queryKey: ['partner-legal-docs'] })}>Повторить</Button>
        </GlassCard>
      </div>
    );
  }

  const renderDocRow = (d: any) => (
    <>
      <tr key={d.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] cursor-pointer" onClick={() => setExpandedDoc(expandedDoc === d.id ? null : d.id)}>
        <td className="px-3 py-2.5 text-sm font-mono text-txt-primary">{d.documentNumber}</td>
        <td className="px-3 py-2.5 text-sm text-txt-secondary">{d.template?.name || d.template?.type || '—'}</td>
        <td className="px-3 py-2.5"><Badge size="xs" className={statusColors[d.status] || ''}>{statusLabels[d.status] || d.status}</Badge></td>
        <td className="px-3 py-2.5 text-xs text-txt-muted">{fd(d.createdAt)}</td>
        <td className="px-3 py-2.5">
          <div className="flex gap-1">
            <Button size="icon-xs" variant="ghost" aria-label="Просмотр">{expandedDoc === d.id ? <ChevronDown size={14} /> : <Eye size={14} />}</Button>
            {(d.status === 'DRAFT' || d.status === 'REVIEW') && (
              <Button size="xs" icon={<CheckCircle size={12} />} className="min-h-11" onClick={(e) => {
                e.stopPropagation();
                const p = partnerInfo as any;
                if (p && (!p.legalName || !p.bin || !p.director || !p.address || !p.iban)) {
                  toast.showToast('Сначала заполните реквизиты (кнопка «Реквизиты»)', 'warning');
                  return;
                }
                setSignConfirm(d.id);
              }}>Подписать</Button>
            )}
            {d.status === 'PUBLISHED' && (
              <Button size="icon-xs" variant="ghost" aria-label="Скачать" icon={<Download size={14} />} onClick={(e) => { e.stopPropagation(); window.open(`/api/partner/legal/documents/${d.id}/export`, '_blank'); }} />
            )}
          </div>
        </td>
      </tr>
      {expandedDoc === d.id && (
        <tr key={`${d.id}-exp`}>
          <td colSpan={5} className="px-4 py-3 bg-surface-2/50">
            <div className="text-xs text-txt-secondary leading-relaxed max-h-80 overflow-y-auto bg-surface-1 rounded-lg p-3 font-mono whitespace-pre-wrap border border-bdr-subtle">
              {d.content}
            </div>
          </td>
        </tr>
      )}
    </>
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale size={20} className="text-dv-gold" />
          <h2 className="text-lg font-bold text-txt-primary">Партнёрский портал Legal Engine</h2>
        </div>
        <Button size="xs" variant="outline" className="min-h-11" onClick={() => setEditLegal(true)}>Реквизиты</Button>
      </div>

      {pendingDocs.length > 0 && (
        <Card padding="none" className="border-dv-gold/30">
          <CardHeader className="px-4 pt-4 pb-0">
            <CardTitle><div className="flex items-center gap-2 text-dv-gold"><FileText size={16} /> Требуют подписания ({pendingDocs.length})</div></CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Номер', 'Тип', 'Статус', 'Создан', 'Действия'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-txt-muted uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody>{pendingDocs.map(renderDocRow)}</tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <CardTitle><div className="flex items-center gap-2"><FileText size={16} className="text-dv-gold" /> Все документы</div></CardTitle>
        </CardHeader>
        {(!docsArr.length) ? (
          <EmptyState icon={<FileText size={32} />} title="Нет документов" description="У вас пока нет юридических документов" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Номер', 'Тип', 'Статус', 'Создан', 'Действия'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-txt-muted uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody>{docsArr.map(renderDocRow)}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <CardTitle><div className="flex items-center gap-2"><Receipt size={16} className="text-dv-gold" /> Мои инвойсы</div></CardTitle>
        </CardHeader>
        {(!invoices || (Array.isArray(invoices) && invoices.length === 0)) ? (
          <EmptyState icon={<Receipt size={32} />} title="Нет инвойсов" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Номер', 'Сумма', 'Статус', 'Создан'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-txt-muted uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(invoices) ? invoices : []).map((inv: any) => (
                  <tr key={inv.id} className="border-b border-bdr-subtle/50">
                    <td className="px-3 py-2 text-sm font-mono text-txt-primary">{inv.invoiceNumber}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-txt-primary">{fmtKzt(inv.amountKzt)}</td>
                    <td className="px-3 py-2"><Badge size="xs" className={statusColors[inv.status] || ''}>{inv.status}</Badge></td>
                    <td className="px-3 py-2 text-xs text-txt-muted">{fd(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <CardTitle><div className="flex items-center gap-2"><ScrollText size={16} className="text-dv-gold" /> История</div></CardTitle>
        </CardHeader>
        {(!history || (Array.isArray(history) && history.length === 0)) ? (
          <EmptyState icon={<ScrollText size={32} />} title="Нет записей" />
        ) : (
          <div className="space-y-1 p-4">
            {(Array.isArray(history) ? history : []).slice(0, 10).map((h: any) => (
              <div key={h.id} className="flex justify-between items-center py-1.5 px-2 rounded-lg hover:bg-surface-1/50">
                <span className="text-xs text-txt-secondary">{h.action} {h.document?.documentNumber && `— ${h.document.documentNumber}`}</span>
                <span className="text-xs text-txt-muted">{fd(h.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={editLegal} onClose={() => setEditLegal(false)} title="Реквизиты клиники">
        <div className="space-y-4">
          <p className="text-xs text-txt-muted">Данные подставляются во все договоры. После сохранения документы будут перегенерированы.</p>
          {[
            { key: 'legalName', label: 'Наименование юрлица / ИП' },
            { key: 'bin', label: 'БИН / ИИН' },
            { key: 'director', label: 'ФИО руководителя' },
            { key: 'address', label: 'Юридический адрес' },
            { key: 'iban', label: 'IBAN счёт' },
            { key: 'phone', label: 'Телефон' },
            { key: 'email', label: 'Email' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-txt-secondary mb-1 block">{f.label}</label>
              <input className="w-full px-3 py-2 bg-surface-1 border border-bdr-subtle rounded-lg text-sm text-txt-primary focus:outline-none focus:border-dv-gold" value={(legalForm as any)[f.key] || ''} onChange={e => setLegalForm({ ...legalForm, [f.key]: e.target.value })} />
            </div>
          ))}
          {updateLegalMutation.isError && <p className="text-xs text-red-400">{(updateLegalMutation.error as any)?.message}</p>}
          <div className="flex gap-2 pt-2">
            <Button className="min-h-11" onClick={() => updateLegalMutation.mutate()} loading={updateLegalMutation.isPending}>Сохранить</Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setEditLegal(false)}>Отмена</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!signConfirm} onClose={() => setSignConfirm(null)} title="Подписание документа">
        <div className="space-y-4">
          <p className="text-sm text-txt-secondary">Подтверждая подписание, вы соглашаетесь с условиями документа в соответствии с законодательством Республики Казахстан.</p>
          <p className="text-xs text-txt-muted">Электронная подпись приравнивается к собственноручной (Закон РК «Об электронном документе и ЭЦП»).</p>
          <div className="flex gap-2 pt-2">
            <Button className="min-h-11" onClick={() => { if (signConfirm) signMutation.mutate(signConfirm); }} loading={signMutation.isPending}>Подписать</Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setSignConfirm(null)}>Отмена</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
