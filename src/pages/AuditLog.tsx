import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Search, RefreshCw, Filter, Clock, User as UserIcon, ArrowRight, Download } from 'lucide-react';
import * as api from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/ds/Card';
import { Button } from '../components/ui/ds/Button';
import { Badge } from '../components/ui/ds/Badge';
import { EmptyState } from '../components/ui/ds/EmptyState';
import { PageHeader } from '../components/ui/ds/StatCard';
import type { Clinic, User, RoleInfo, AuditLogEntry } from '../types';

const ACTION_LABELS: Record<string, { l: string; v: string }> = {
  create_patient: { l: 'Создал пациента', v: 'emerald' },
  update_patient: { l: 'Обновил пациента', v: 'sky' },
  upsert_patient: { l: 'Изменил пациента', v: 'sky' },
  delete_patient: { l: 'Удалил пациента', v: 'error' },
  create_visit: { l: 'Добавил посещение', v: 'gold' },
  upsert_visit: { l: 'Обновил посещение', v: 'gold' },
  upsert_appointment: { l: 'Записал приём', v: 'sky' },
  delete_appointment: { l: 'Отменил приём', v: 'error' },
  upsert_receipt: { l: 'Создал чек', v: 'emerald' },
  update_receipt: { l: 'Обновил чек', v: 'emerald' },
  upsert_document: { l: 'Создал документ', v: 'purple' },
  upsert_medical_card: { l: 'Обновил мед. карту', v: 'gold' },
  backup: { l: 'Резервное копирование', v: 'teal' },
  upsert_promotion: { l: 'Изменил акцию', v: 'pink' },
  upsert_booking: { l: 'Изменил бронирование', v: 'gold' },
  upsert_inventory: { l: 'Обновил склад', v: 'slate' },
  upsert_user: { l: 'Изменил сотрудника', v: 'sky' },
};

function getActionInfo(action: string): { l: string; v: string } {
  return ACTION_LABELS[action] || { l: action, v: 'slate' };
}

export default function AuditLog() {
  const { clinic, user } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!clinic?.id) return;
    setLoading(true);
    api.getAuditLog(clinic.id, 500)
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setLogs([]); setLoading(false); });
  }, [clinic?.id, refreshKey]);

  const actionTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.action).filter(Boolean));
    return ['all', ...Array.from(types).sort()] as string[];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterAction !== 'all') result = result.filter(l => l.action === filterAction);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.user_name?.toLowerCase().includes(q) ||
        l.entity_type?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.entity_id?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterAction, searchQuery]);

  const exportLogs = () => {
    const csv = ['Дата,Пользователь,Действие,Тип сущности,ID сущности,Детали'].concat(
      filteredLogs.map(l => [
        l.created_at, l.user_name, l.action, l.entity_type, l.entity_id,
        l.details ? l.details.replace(/"/g, '""') : ''
      ].map(v => `"${v || ''}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_log_${clinic?.id}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Аудит-журнал"
        subtitle="Кто что изменил и когда — полный аудит всех действий"
        icon={<Shield size={24} className="text-dv-gold" />}
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={() => setRefreshKey(k => k + 1)}>
              Обновить
            </Button>
            <Button variant="primary" icon={<Download size={14} />} onClick={exportLogs}>
              Экспорт CSV
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input placeholder="Поиск по пользователю, типу..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="w-full md:w-56">
          {actionTypes.map(a => (
            <option key={a} value={a}>{a === 'all' ? 'Все действия' : (getActionInfo(a).l || a)}</option>
          ))}
        </select>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-dv-gold/30 border-t-dv-gold" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Shield size={48} />}
            title="Журнал пуст"
            description="Действия будут записываться автоматически"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-txt-muted">Время</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-txt-muted">Пользователь</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-txt-muted">Действие</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-txt-muted">Объект</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-txt-muted">ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => {
                  const actionInfo = getActionInfo(log.action || '');
                  return (
                    <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-txt-secondary whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-txt-ghost" />
                          {log.created_at ? new Date(log.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <UserIcon size={12} className="text-txt-ghost" />
                          <span className="text-xs text-txt-primary">{log.user_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actionInfo.v as any} size="xs">{actionInfo.l}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-txt-secondary">{log.entity_type || '—'}</td>
                      <td className="px-4 py-3 text-xs text-txt-ghost font-mono truncate max-w-[120px]">{log.entity_id || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="text-center text-xs text-txt-ghost">
        Показано {filteredLogs.length} из {logs.length} записей аудита
      </div>
    </div>
  );
}
