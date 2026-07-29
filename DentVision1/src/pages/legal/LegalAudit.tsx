import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Badge, Input, Select, EmptyState, Skeleton } from '../../components/ui/ds';
import { apiRequest } from '../../utils/api';
import { ScrollText, Search } from 'lucide-react';

const fd = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') + ' ' + new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';

const actionColors: Record<string, string> = {
  CREATED: 'bg-green-500/10 text-green-400',
  STATUS_CHANGED: 'bg-blue-500/10 text-blue-400',
  VERSION_ADDED: 'bg-purple-500/10 text-purple-400',
  EXPORTED: 'bg-gray-500/10 text-gray-400',
  VIEWED: 'bg-yellow-500/10 text-yellow-400',
  AI_EXPLAIN: 'bg-cyan-500/10 text-cyan-400',
  AI_DIFF: 'bg-cyan-500/10 text-cyan-400',
  AI_CHECK: 'bg-cyan-500/10 text-cyan-400',
  INVOICE_STATUS_CHANGED: 'bg-orange-500/10 text-orange-400',
};

export default function LegalAudit() {
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['legal-audit'],
    queryFn: () => apiRequest('/api/legal/audit'),
  });

  const logs = data?.data || [];
  const filtered = logs.filter((l: any) => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (search && !l.document?.documentNumber?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const actions = [...new Set(logs.map((l: any) => l.action))] as string[];

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по номеру..." className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary px-2 py-1.5">
          <option value="">Все действия</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <Card padding="none">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-bdr-subtle">
              {['Время', 'Действие', 'Документ', 'Исполнитель', 'Статус', 'Версия'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((log: any) => (
              <tr key={log.id} className="border-b border-bdr-subtle/50 hover:bg-surface-1/50">
                <td className="px-4 py-3 text-xs text-txt-muted whitespace-nowrap">{fd(log.createdAt)}</td>
                <td className="px-4 py-3"><Badge size="xs" className={actionColors[log.action] || ''}>{log.action}</Badge></td>
                <td className="px-4 py-3 text-sm font-mono text-txt-primary">{log.document?.documentNumber || '—'}</td>
                <td className="px-4 py-3 text-sm text-txt-secondary">{log.performer ? `${log.performer.firstName} ${log.performer.lastName}` : '—'}</td>
                <td className="px-4 py-3 text-xs text-txt-muted">{log.fromStatus || ''} {log.toStatus ? `→ ${log.toStatus}` : ''}</td>
                <td className="px-4 py-3 text-xs text-txt-muted">{log.fromVersion || ''} {log.toVersion ? `→ ${log.toVersion}` : ''}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12"><EmptyState icon={<ScrollText size={40} />} title="Нет записей аудита" description="Действия по документам будут отображаться здесь" /></td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
