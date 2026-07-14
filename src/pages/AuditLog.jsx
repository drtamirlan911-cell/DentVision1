import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Search, RefreshCw, Filter, Clock, User, ArrowRight, Download } from 'lucide-react';
import { T } from '../utils/constants';
import * as api from '../utils/api';

const ACTION_LABELS = {
  create_patient: { l: 'Создал пациента', c: T.emerald },
  update_patient: { l: 'Обновил пациента', c: T.sapphire },
  upsert_patient: { l: 'Изменил пациента', c: T.sapphire },
  delete_patient: { l: 'Удалил пациента', c: T.ruby },
  create_visit: { l: 'Добавил посещение', c: T.gold },
  upsert_visit: { l: 'Обновил посещение', c: T.gold },
  upsert_appointment: { l: 'Записал приём', c: T.cyan },
  delete_appointment: { l: 'Отменил приём', c: T.ruby },
  upsert_receipt: { l: 'Создал чек', c: T.emerald },
  update_receipt: { l: 'Обновил чек', c: T.emerald },
  upsert_document: { l: 'Создал документ', c: T.purple },
  upsert_medical_card: { l: 'Обновил мед. карту', c: T.gold },
  backup: { l: 'Резервное копирование', c: T.teal },
  upsert_promotion: { l: 'Изменил акцию', c: T.pink },
  upsert_booking: { l: 'Изменил бронирование', c: T.amber },
  upsert_inventory: { l: 'Обновил склад', c: T.slate },
  upsert_user: { l: 'Изменил сотрудника', c: T.sapphire },
};

function getActionInfo(action) {
  return ACTION_LABELS[action] || { l: action, c: T.slate };
}

export default function AuditLog() {
  const { clinic, user } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!clinic?.id) return;
    setLoading(true);
    api.getAuditLog(clinic.id, 500)
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setLogs([]); setLoading(false); });
  }, [clinic?.id, refreshKey]);

  const actionTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.action));
    return ['all', ...Array.from(types).sort()];
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
    link.download = `audit_log_${clinic.id}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div className="fade-in space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={24} style={{ color: T.gold }} />
            Аудит-журнал
          </h1>
          <p className="mt-1 text-sm text-slate-500">Кто что изменил и когда — полный аудит всех действий</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRefreshKey(k => k + 1)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 hover:text-white">
            <RefreshCw size={14} /> Обновить
          </button>
          <button onClick={exportLogs} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-black" style={{ background: T.gold }}>
            <Download size={14} /> Экспорт CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input placeholder="Поиск по пользователю, типу..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="w-full md:w-56">
          {actionTypes.map(a => (
            <option key={a} value={a}>{a === 'all' ? 'Все действия' : (getActionInfo(a).l || a)}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02]">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9A96E]/30 border-t-[#C9A96E]" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Shield size={48} className="mb-3 text-slate-600" />
            <p className="text-lg font-semibold text-slate-500">Журнал пуст</p>
            <p className="text-sm text-slate-600">Действия будут записываться автоматически</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Время</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Пользователь</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Действие</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Объект</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => {
                  const actionInfo = getActionInfo(log.action);
                  return (
                    <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-600" />
                          {log.created_at ? new Date(log.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-slate-600" />
                          <span className="text-xs text-white">{log.user_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${actionInfo.c}18`, color: actionInfo.c }}>
                          {actionInfo.l}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{log.entity_type || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono truncate max-w-[120px]">{log.entity_id || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-slate-600">
        Показано {filteredLogs.length} из {logs.length} записей аудита
      </div>
    </div>
  );
}
