import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/ds';
import { Scale, FileText, Grid, Users, FileSignature, Receipt, ScrollText, Brain, Settings } from 'lucide-react';
import LegalDashboard from './LegalDashboard';
import LegalBlockLibrary from './LegalBlockLibrary';
import LegalTemplates from './LegalTemplates';
import LegalPartners from './LegalPartners';
import LegalDocuments from './LegalDocuments';
import LegalInvoices from './LegalInvoices';
import LegalAudit from './LegalAudit';
import LegalAITab from './LegalAITab';
import LegalSettings from './LegalSettings';

const TABS = [
  { id: 'dashboard', label: 'Дашборд', icon: <Scale size={16} /> },
  { id: 'templates', label: 'Шаблоны', icon: <FileText size={16} /> },
  { id: 'blocks', label: 'Блоки', icon: <Grid size={16} /> },
  { id: 'partners', label: 'Партнёры', icon: <Users size={16} /> },
  { id: 'documents', label: 'Документы', icon: <FileSignature size={16} /> },
  { id: 'invoices', label: 'Инвойсы', icon: <Receipt size={16} /> },
  { id: 'audit', label: 'Аудит', icon: <ScrollText size={16} /> },
  { id: 'ai', label: 'AI', icon: <Brain size={16} /> },
  { id: 'settings', label: 'Настройки', icon: <Settings size={16} /> },
];

export default function LegalLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'dashboard';
  const [tab, setTab] = useState(tabFromUrl);

  const handleTabChange = (id: string) => {
    setTab(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Legal Engine"
        subtitle="Юридический движок платформы"
        icon={<Scale size={20} />}
      />

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => handleTabChange(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors min-h-11 ${tab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <LegalDashboard />}
      {tab === 'templates' && <LegalTemplates />}
      {tab === 'blocks' && <LegalBlockLibrary />}
      {tab === 'partners' && <LegalPartners />}
      {tab === 'documents' && <LegalDocuments />}
      {tab === 'invoices' && <LegalInvoices />}
      {tab === 'audit' && <LegalAudit />}
      {tab === 'ai' && <LegalAITab />}
      {tab === 'settings' && <LegalSettings />}
    </div>
  );
}
