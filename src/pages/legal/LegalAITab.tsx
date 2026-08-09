import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, Button, GlassCard, Input } from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds';
import { apiRequest } from '../../utils/api';
import { Sparkles, GitBranch, AlertTriangle } from 'lucide-react';

export default function LegalAITab() {
  const toast = useToast();
  const [mode, setMode] = useState<'explain' | 'diff' | 'check'>('explain');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('ru');
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [result, setResult] = useState<any>(null);

  const explainMut = useMutation({
    mutationFn: (d: any) => apiRequest('/api/legal/ai/explain', { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: (d: any) => setResult(d.data),
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const diffMut = useMutation({
    mutationFn: (d: any) => apiRequest('/api/legal/ai/diff', { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: (d: any) => setResult(d.data),
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const checkMut = useMutation({
    mutationFn: (d: any) => apiRequest('/api/legal/ai/check', { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: (d: any) => setResult(d.data),
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const isPending = explainMut.isPending || diffMut.isPending || checkMut.isPending;

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap gap-2 border-b border-bdr-subtle pb-3">
        {[
          { key: 'explain', label: 'Объяснить', icon: <Sparkles size={14} /> },
          { key: 'diff', label: 'Сравнить версии', icon: <GitBranch size={14} /> },
          { key: 'check', label: 'Проверить ошибки', icon: <AlertTriangle size={14} /> },
        ].map(m => (
          <button key={m.key} onClick={() => { setMode(m.key as any); setResult(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all min-h-11 ${mode === m.key ? 'bg-dv-gold text-dv-gold-on font-semibold' : 'text-txt-secondary hover:text-txt-primary bg-surface-2'}`}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            {mode === 'explain' && (
              <div className="space-y-3">
                <p className="text-xs text-txt-muted">Вставьте текст документа для AI-объяснения (юридическая суть, риски, ключевые положения)</p>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary px-3 py-2 min-h-11">
                  <option value="ru">Русский</option>
                  <option value="kz">Қазақша</option>
                  <option value="en">English</option>
                </select>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={10} className="w-full rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary p-3 font-mono resize-y outline-none focus:ring-1 focus:ring-dv-gold/50" placeholder="Введите содержание документа..." />
                <Button onClick={() => explainMut.mutate({ content, language })} loading={isPending} className="min-h-11">Объяснить</Button>
              </div>
            )}
            {mode === 'diff' && (
              <div className="space-y-3">
                <p className="text-xs text-txt-muted">Сравните две версии документа и покажите изменения</p>
                <p className="text-xs font-semibold text-txt-secondary">Версия 1</p>
                <textarea value={v1} onChange={e => setV1(e.target.value)} rows={6} className="w-full rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary p-3 font-mono resize-y outline-none focus:ring-1 focus:ring-dv-gold/50" />
                <p className="text-xs font-semibold text-txt-secondary">Версия 2</p>
                <textarea value={v2} onChange={e => setV2(e.target.value)} rows={6} className="w-full rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary p-3 font-mono resize-y outline-none focus:ring-1 focus:ring-dv-gold/50" />
                <Button onClick={() => diffMut.mutate({ v1, v2 })} loading={isPending} className="min-h-11">Сравнить</Button>
              </div>
            )}
            {mode === 'check' && (
              <div className="space-y-3">
                <p className="text-xs text-txt-muted">AI-проверка документа на юридические ошибки и противоречия</p>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={10} className="w-full rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary p-3 font-mono resize-y outline-none focus:ring-1 focus:ring-dv-gold/50" />
                <Button onClick={() => checkMut.mutate({ content })} loading={isPending} className="min-h-11">Проверить</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-sm font-semibold text-txt-primary mb-3">Результат AI</p>
            {isPending && <p className="text-sm text-txt-muted animate-pulse">Анализируем...</p>}
            {!result && !isPending && <p className="text-sm text-txt-muted">Результат появится здесь</p>}
            {result && (
              <div className="space-y-3 text-sm text-txt-secondary">
                {mode === 'explain' && (
                  <>
                    {result.explanation && <GlassCard padding="sm"><p className="text-txt-primary whitespace-pre-wrap">{result.explanation}</p></GlassCard>}
                    {result.risks && result.risks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-error mb-1">Риски:</p>
                        <ul className="list-disc list-inside space-y-1">{result.risks.map((r: string, i: number) => <li key={i} className="text-xs">{r}</li>)}</ul>
                      </div>
                    )}
                    {result.keyPoints && (
                      <div>
                        <p className="text-xs font-semibold text-txt-primary mb-1">Ключевые положения:</p>
                        <p className="text-xs whitespace-pre-wrap">{result.keyPoints}</p>
                      </div>
                    )}
                  </>
                )}
                {mode === 'diff' && (
                  <>
                    {result.changes?.map((c: any, i: number) => (
                      <div key={i} className={`p-2 rounded-lg text-xs ${c.type === 'added' ? 'bg-green-500/10 text-green-400' : c.type === 'removed' ? 'bg-red-500/10 text-red-400' : 'bg-surface-2 text-txt-primary'}`}>
                        <span className="font-semibold">{c.type === 'added' ? '+' : c.type === 'removed' ? '- ' : '~ '}</span>
                        {c.text || c.content}
                      </div>
                    ))}
                    {result.summary && <GlassCard padding="sm"><p className="text-xs text-txt-primary">{result.summary}</p></GlassCard>}
                  </>
                )}
                {mode === 'check' && (
                  <>
                    <div className={`p-2 rounded-lg text-xs font-semibold ${result.verdict === 'pass' ? 'bg-green-500/10 text-green-400' : result.verdict === 'warning' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                      {result.verdict === 'pass' ? 'Pass' : result.verdict === 'warning' ? 'Warning' : 'Fail'}
                    </div>
                    {result.findings?.map((f: string, i: number) => <p key={i} className="text-xs text-txt-secondary">• {f}</p>)}
                    {result.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-txt-primary mb-1">Рекомендации:</p>
                        <ul className="list-disc list-inside">{result.recommendations.map((r: string, i: number) => <li key={i} className="text-xs text-txt-secondary">{r}</li>)}</ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
