import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Inbox, Clock, UserRound, CheckCircle2, ArrowLeft, Send, Phone } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { Tabs } from '@/components/ui/ds/Misc';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useToast } from '@/components/ui/ds/Toast';
import { useEventStream } from '@/hooks/useEventStream';
import * as api from '@/utils/api';
import { cn } from '@/lib/utils';
import type { ConversationStatus, InboxConversationSummary } from '@/utils/api';

/**
 * Where an escalated patient question actually gets answered.
 *
 * The list is every thread the assistant handed off, newest activity first.
 * Opening one and replying is what a `WAITING` thread needs to become `LIVE` —
 * the same write the patient's own portal is listening for over SSE, so a
 * reply here shows up there within the same second, not on the next refresh.
 */

interface OutletContext {
  clinic: { id: string; name: string };
}

const STATUS_TABS: { id: ConversationStatus | 'ALL'; label: string }[] = [
  { id: 'WAITING', label: 'Ждут ответа' },
  { id: 'LIVE', label: 'В работе' },
  { id: 'RESOLVED', label: 'Закрытые' },
  { id: 'ALL', label: 'Все' },
];

function patientName(c: InboxConversationSummary): string {
  return [c.patientUser.firstName, c.patientUser.lastName].filter(Boolean).join(' ') || 'Пациент';
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

function StatusChip({ status }: { status: ConversationStatus }) {
  if (status === 'WAITING') return <Badge variant="warning" size="sm">ждёт</Badge>;
  if (status === 'LIVE') return <Badge variant="success" size="sm">в работе</Badge>;
  return <Badge variant="outline" size="sm">закрыт</Badge>;
}

function ConversationRow({ c, active }: { c: InboxConversationSummary; active: boolean }) {
  return (
    <Link
      to={`/crm/patient-inbox/${c.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-colors',
        active
          ? 'border-dv-gold/40 bg-dv-gold/5'
          : 'border-bdr-subtle bg-surface-raised hover:border-bdr/60 hover:bg-surface-raised-hover'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-txt-primary">{patientName(c)}</p>
        <StatusChip status={c.status} />
      </div>
      <p className="mt-1 truncate text-xs text-txt-muted">{c.escalationReason || 'Вопрос пациенту ассистенту'}</p>
      <div className="mt-1.5 flex items-center justify-between text-2xs text-txt-ghost">
        <span>{relativeTime(c.lastPatientMessageAt || c.createdAt)}</span>
        {c.assignedTo && <span>{c.assignedTo.firstName} {c.assignedTo.lastName}</span>}
      </div>
    </Link>
  );
}

function ThreadPanel({ clinicId, conversationId }: { clinicId: string; conversationId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const threadQuery = useQuery({
    queryKey: ['inbox-thread', conversationId],
    queryFn: () => api.getInboxThread(conversationId),
  });

  const getStreamUrl = useCallback(() => api.inboxStreamUrl(clinicId), [clinicId]);
  useEventStream(getStreamUrl, (event: any) => {
    if (event?.conversationId === conversationId || event?.type === 'reply') {
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', conversationId] });
    }
    queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
  });

  const reply = useMutation({
    mutationFn: (text: string) => api.replyToInboxConversation(conversationId, text),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось отправить сообщение'),
  });

  const resolve = useMutation({
    mutationFn: () => api.resolveInboxConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      toast.success('Диалог закрыт');
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось закрыть диалог'),
  });

  const claim = useMutation({
    mutationFn: () => api.claimInboxConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось взять диалог в работу'),
  });

  const messages = threadQuery.data?.messages || [];
  const conversation = threadQuery.data?.conversation;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages.length, reduceMotion]);

  function submit() {
    const text = draft.trim();
    if (!text || reply.isPending) return;
    reply.mutate(text);
  }

  if (threadQuery.isLoading) {
    return <Skeleton variant="card" height={420} />;
  }
  if (!conversation) {
    return <EmptyState icon={<Inbox size={28} className="text-dv-gold" />} title="Диалог не найден" />;
  }

  const closed = conversation.status === 'RESOLVED';

  return (
    <Card padding="xl" className="flex h-full min-h-[480px] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-bdr-subtle pb-3">
        <div className="min-w-0">
          <p className="font-serif text-lg text-txt-primary">{patientName(conversation)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-txt-muted">
            <StatusChip status={conversation.status} />
            {conversation.patientUser.phone && (
              <span className="inline-flex items-center gap-1"><Phone size={12} /> {conversation.patientUser.phone}</span>
            )}
          </div>
          {conversation.escalationReason && (
            <p className="mt-1 text-xs text-txt-ghost">Ассистент передал: {conversation.escalationReason}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {conversation.status === 'WAITING' && (
            <Button size="sm" variant="outline" loading={claim.isPending} onClick={() => claim.mutate()}>
              Взять в работу
            </Button>
          )}
          {!closed && (
            <Button
              size="sm"
              variant="ghost"
              icon={<CheckCircle2 size={14} />}
              loading={resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              Закрыть
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.map((m) => {
          const mine = m.authorType === 'STAFF';
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                  mine
                    ? 'bg-dv-gold/12 text-txt-primary rounded-br-md'
                    : 'bg-surface-raised border border-bdr-subtle text-txt-primary rounded-bl-md'
                )}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {!closed && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex items-center gap-2 border-t border-bdr-subtle pt-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={reply.isPending}
            placeholder="Ответить пациенту…"
            aria-label="Ответ пациенту"
            className="min-h-11 w-full rounded-xl border border-bdr-subtle bg-surface-raised px-4 text-sm text-txt-primary placeholder:text-txt-ghost focus:border-dv-gold/40 focus:outline-none focus:ring-2 focus:ring-dv-gold/20 disabled:opacity-60"
          />
          <Button type="submit" variant="primary" className="min-h-11 shrink-0" disabled={!draft.trim()} loading={reply.isPending} icon={<Send size={15} />}>
            <span className="sr-only">Отправить</span>
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function PatientInbox() {
  const { clinic } = useOutletContext<OutletContext>();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'ALL'>('WAITING');

  const listQuery = useQuery({
    queryKey: ['inbox-conversations', statusFilter],
    queryFn: () => api.getInboxConversations(statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const clinicId = clinic?.id;
  const getStreamUrl = useCallback(() => api.inboxStreamUrl(clinicId!), [clinicId]);
  useEventStream(clinicId ? getStreamUrl : null, () => {
    queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
  });

  const conversations = listQuery.data || [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Диалоги с пациентами"
        subtitle="Вопросы, которые ассистент не смог закрыть сам"
        icon={<Inbox size={22} />}
      />

      <Tabs
        tabs={STATUS_TABS.map((s) => ({ id: s.id, label: s.label }))}
        active={statusFilter}
        onChange={(v) => setStatusFilter(v as ConversationStatus | 'ALL')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {listQuery.isLoading ? (
            <>
              <Skeleton variant="card" height={72} />
              <Skeleton variant="card" height={72} />
            </>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={<Clock size={26} className="text-dv-gold" />}
              title="Пусто"
              description="Здесь появятся вопросы, которые ассистент передал администратору."
            />
          ) : (
            conversations.map((c) => <ConversationRow key={c.id} c={c} active={c.id === id} />)
          )}
        </div>

        <div className="min-h-[480px]">
          {id ? (
            <ThreadPanel clinicId={clinic.id} conversationId={id} />
          ) : (
            <Card padding="xl" className="flex h-full min-h-[480px] items-center justify-center text-center">
              <div>
                <UserRound size={26} className="mx-auto text-txt-ghost" />
                <p className="mt-3 text-sm text-txt-muted">Выберите диалог слева</p>
                {conversations.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-3"
                    icon={<ArrowLeft size={14} className="rotate-180" />}
                    onClick={() => navigate(`/crm/patient-inbox/${conversations[0].id}`)}
                  >
                    Открыть первый
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
