import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Smartphone, Monitor, Globe, Clock, CheckCircle2, XCircle, Brain, AlertTriangle } from 'lucide-react';
import * as api from '../utils/api';
import { useAuthStore } from '../store/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/ds/Card';
import { Button } from '../components/ui/ds/Button';
import { Badge } from '../components/ui/ds/Badge';
import { PageHeader } from '../components/ui/ds/StatCard';
import { Switch } from '@/components/ui/ds/Misc';
import { useToast } from '@/components/ui/ds/Toast';

const CONSENT_TYPES = [
  { key: 'PERSONAL_DATA', label: 'Обработка персональных данных', desc: 'ФИО, телефон, email для оказания услуг' },
  { key: 'MEDICAL_DATA', label: 'Обработка медицинских данных', desc: 'История болезни, диагнозы, лечение' },
  { key: 'PHOTO_PROCESSING', label: 'Фото и снимки', desc: 'КТ, рентген, внутриротовые фото' },
  { key: 'AI_ANALYSIS', label: 'AI-анализ данных', desc: 'Использование ИИ для диагностики и рекомендаций' },
  { key: 'MARKETING', label: 'Маркетинговые коммуникации', desc: 'Уведомления об акциях и новостях' },
  { key: 'EDUCATION', label: 'Обучение', desc: 'Доступ к образовательным материалам' },
];

export default function SecurityCompliance() {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [dashboard, setDashboard] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [aiActions, setAiActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, sess, cons, ai] = await Promise.all([
        api.getComplianceDashboard().catch(() => null),
        api.getSessions().catch(() => []),
        api.getConsents().catch(() => []),
        api.getAIActions().catch(() => []),
      ]);
      setDashboard(dash);
      setSessions(Array.isArray(sess) ? sess : []);
      setConsents(Array.isArray(cons) ? cons : []);
      setAiActions(Array.isArray(ai) ? ai : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    load();
  }, [user]);

  const handleConsent = async (type: string, accepted: boolean) => {
    setBusy(`consent-${type}`);
    try {
      await api.updateConsent(type, accepted);
      toast.success(accepted ? 'Согласие сохранено' : 'Согласие отозвано');
      await load();
    } catch {
      toast.error('Ошибка сохранения согласия');
    }
    setBusy(null);
  };

  const handleExpireSession = async (id: string) => {
    setBusy(`session-${id}`);
    try {
      await api.expireSession(id);
      toast.success('Сессия завершена');
      await load();
    } catch { toast.error('Ошибка'); }
    setBusy(null);
  };

  const handleExpireAll = async () => {
    setBusy('expire-all');
    try {
      await api.expireAllSessions();
      toast.success('Все сессии завершены');
      await load();
    } catch { toast.error('Ошибка'); }
    setBusy(null);
  };

  const handleConfirmAI = async (id: string) => {
    setBusy(`ai-${id}`);
    try {
      await api.confirmAIAction(id);
      toast.success('AI действие подтверждено');
      await load();
    } catch { toast.error('Ошибка'); }
    setBusy(null);
  };

  const consentMap = new Map(consents.map((c) => [c.type, c.accepted]));

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        title="Security & Compliance"
        subtitle="Безопасность, согласия, аудит AI и управление сессиями"
        icon={<Shield size={20} />}
        actions={
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            Обновить
          </Button>
        }
      />

      {!user ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield size={40} className="text-txt-muted mb-4" />
          <p className="text-txt-muted text-sm">Войдите в аккаунт для доступа к безопасности и согласиям</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-dv-gold/30 border-t-dv-gold" />
        </div>
      ) : (
        <>
          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor size={16} className="text-dv-gold" />
                Активные сессии ({sessions.length})
                <Button size="sm" variant="danger" className="ml-auto" onClick={handleExpireAll} disabled={busy === 'expire-all'}>
                  Завершить все
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-txt-muted py-4 text-center">Нет активных сессий</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.05]">
                      <div className="flex items-center gap-3 min-w-0">
                        {s.device === 'Mobile' ? <Smartphone size={16} className="text-txt-muted shrink-0" /> : <Monitor size={16} className="text-txt-muted shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-txt-primary truncate">{s.browser || 'Unknown'} · {s.device || 'Unknown'}</p>
                          <p className="text-xs text-txt-muted">
                            <Globe size={10} className="inline mr-1" />{s.ipAddress || '—'} · <Clock size={10} className="inline mr-1" />{s.lastActivity ? new Date(s.lastActivity).toLocaleString('ru-RU') : '—'}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-error shrink-0" onClick={() => handleExpireSession(s.id)} disabled={busy === `session-${s.id}`}>
                        Завершить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Stats */}
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-txt-primary">{sessions.length}</p>
                  <p className="text-[10px] text-txt-muted">Активных сессий</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-txt-primary">{consents.filter((c) => c.accepted).length}/{consents.length}</p>
                  <p className="text-[10px] text-txt-muted">Согласий активно</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-txt-primary">{dashboard.failedLogins24h || 0}</p>
                  <p className="text-[10px] text-txt-muted">Неудачных входов (24ч)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-txt-primary">{aiActions.filter((a) => a.doctorConfirmed).length}/{aiActions.length}</p>
                  <p className="text-[10px] text-txt-muted">AI действий подтверждено</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Consent Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-dv-gold" />
                Согласия на обработку данных
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {CONSENT_TYPES.map(({ key, label, desc }) => {
                const accepted = consentMap.get(key) ?? false;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-txt-primary">{label}</p>
                      <p className="text-xs text-txt-muted">{desc}</p>
                    </div>
                    <Switch
                      checked={accepted}
                      disabled={busy === `consent-${key}`}
                      onCheckedChange={(next) => handleConsent(key, next)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* AI Action Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain size={16} className="text-dv-gold" />
                AI Governance — история действий
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiActions.length === 0 ? (
                <p className="text-sm text-txt-muted py-4 text-center">Нет записей AI</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {aiActions.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.05]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-txt-primary">{a.agent}</p>
                          {a.doctorConfirmed ? (
                            <Badge variant="success" size="xs">Подтверждено</Badge>
                          ) : (
                            <Badge variant="gold" size="xs">Ожидает</Badge>
                          )}
                        </div>
                        <p className="text-xs text-txt-muted mt-0.5">{a.model || '—'} · {a.createdAt ? new Date(a.createdAt).toLocaleString('ru-RU') : '—'}</p>
                      </div>
                      {!a.doctorConfirmed && (
                        <Button size="sm" variant="primary" onClick={() => handleConfirmAI(a.id)} disabled={busy === `ai-${a.id}`}>
                          Подтвердить
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
