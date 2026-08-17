import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Send, ShieldCheck, AlertCircle, Clock, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useEventStream } from '@/hooks/useEventStream';
import * as api from '@/utils/api';
import { cn } from '@/lib/utils';

/**
 * The portal's front door: a conversation, with the tabs still underneath.
 *
 * Everything the tabs can show, the assistant can answer — but it is never the
 * only way to the data. If the provider is down, if the daily allowance is
 * spent, or if the patient simply declines, this panel says so plainly and the
 * sections keep working. A medical record should not be reachable only through
 * a language model.
 *
 * Two channels share this one box. Ordinarily it is the assistant, reading the
 * record and answering. The moment `askClinicStaff` fires — the model decided
 * it could not answer, or triage came back urgent — this switches to the live
 * thread with clinic staff, and stays there until the thread resolves. The
 * patient never picks a channel; the panel just becomes whichever one is live.
 */

/** The questions worth suggesting are the ones a patient actually opens the portal to ask. */
const OPENERS = [
  'Когда мой следующий приём?',
  'Сколько я должен клинике?',
  'Что мне делали в прошлый раз?',
  'Есть ли документы на подпись?',
];

function Bubble({ mine, content }: { mine: boolean; content: string }) {
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
          mine
            ? 'bg-dv-gold/12 text-txt-primary rounded-br-md'
            : 'bg-surface-raised border border-bdr-subtle text-txt-primary rounded-bl-md'
        )}
      >
        {content}
      </div>
    </div>
  );
}

export function Assistant() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const statusQuery = useQuery({
    queryKey: ['pp-ai-status'],
    queryFn: () => api.getPatientAiStatus(),
  });

  const historyQuery = useQuery({
    queryKey: ['pp-ai-history'],
    queryFn: () => api.getPatientAiHistory(),
    enabled: Boolean(statusQuery.data?.consented),
  });

  // Checked whenever the assistant is reachable at all, consent or not — a
  // thread already escalated must keep working even if consent later lapses.
  const conversationQuery = useQuery({
    queryKey: ['pp-conversation'],
    queryFn: () => api.getCurrentConversation(),
    enabled: Boolean(statusQuery.data?.linked),
  });

  const conversation = conversationQuery.data;
  const isLive = Boolean(conversation && conversation.status !== 'RESOLVED');

  // Only subscribed once a thread is known to exist — before that there is
  // nothing to stream, and opening a connection that 404s in a loop wastes a
  // socket for no reason. `api.conversationStreamUrl` is a stable module-level
  // reference (it takes no arguments), so no `useCallback` is needed to keep
  // it from reconnecting the stream on every render.
  const getStreamUrl = isLive ? api.conversationStreamUrl : null;
  useEventStream(getStreamUrl, (event: any) => {
    if (event?.type === 'message') {
      queryClient.invalidateQueries({ queryKey: ['pp-conversation'] });
    }
  });

  const consent = useMutation({
    mutationFn: () => api.acceptPatientAiConsent(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pp-ai-status'] }),
    onError: (e: any) => setError(e?.message || 'Не удалось сохранить согласие'),
  });

  const send = useMutation({
    mutationFn: (text: string) => api.sendPatientAiMessage(text),
    onSuccess: (data) => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['pp-ai-history'] });
      queryClient.invalidateQueries({ queryKey: ['pp-ai-status'] });
      // The assistant just handed off — switch to the live thread instead of
      // waiting for the next poll to notice it exists.
      if (data.toolsUsed?.includes('askClinicStaff')) {
        queryClient.invalidateQueries({ queryKey: ['pp-conversation'] });
      }
    },
    onError: (e: any) => setError(e?.message || 'Не удалось отправить сообщение'),
  });

  const sendLive = useMutation({
    mutationFn: (text: string) => api.sendConversationMessage(text),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['pp-conversation'] });
    },
    onError: (e: any) => setError(e?.message || 'Не удалось отправить сообщение'),
  });

  const messages = historyQuery.data || [];
  const busy = isLive ? sendLive.isPending : send.isPending;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages.length, conversation?.messages.length, busy, reduceMotion]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setDraft('');
    if (isLive) sendLive.mutate(value);
    else send.mutate(value);
  }

  if (statusQuery.isLoading) {
    return <Skeleton variant="card" height={220} />;
  }

  // No card in any clinic yet — the assistant has nothing to read, and saying
  // that is more useful than an empty chat that answers "не знаю" to everything.
  if (statusQuery.data && !statusQuery.data.linked) {
    return (
      <Card padding="xl" className="text-center">
        <Sparkles size={22} className="mx-auto text-dv-gold" />
        <h2 className="mt-3 font-serif text-xl text-txt-primary">Ассистент появится, когда клиника свяжет вашу карту</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-txt-muted">
          Он отвечает только по вашей медицинской карте, поэтому без неё ему нечего показать.
          Попросите клинику привязать ваш аккаунт — или запишитесь онлайн, тогда связь создастся сама.
        </p>
      </Card>
    );
  }

  // A live thread already exists — this is a human conversation now, so it
  // stays reachable even if AI consent was never given or has lapsed.
  if (!isLive && statusQuery.data && !statusQuery.data.consented) {
    return (
      <Card padding="xl">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-dv-gold" />
          <div className="min-w-0">
            <h2 className="font-serif text-xl text-txt-primary">Прежде чем начать</h2>
            <p className="mt-2 text-sm leading-relaxed text-txt-secondary">
              Ассистент читает вашу медицинскую карту — приёмы, лечение, визиты, счета, документы
              и результаты исследований — чтобы отвечать на ваши вопросы. Он видит только вашу карту
              и ничью больше.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-txt-secondary">
              Он <span className="text-txt-primary">не ставит диагноз</span> и не назначает лечение:
              он объясняет то, что уже записано врачом. Если вопрос срочный, он скажет об этом
              и предложит связаться с клиникой.
            </p>
            <p className="mt-2 text-sm text-txt-muted">
              Отказ ничего не ломает — все разделы кабинета работают как обычно.
            </p>
            {error && <p className="mt-3 text-xs text-error">{error}</p>}
            <div className="mt-4">
              <Button variant="primary" loading={consent.isPending} onClick={() => consent.mutate()}>
                Согласен, включить ассистента
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const outOfQuota = !isLive && (statusQuery.data?.remaining ?? 1) <= 0;

  return (
    <div className="space-y-4">
      {isLive && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs',
            conversation!.status === 'WAITING'
              ? 'border-warning/25 bg-warning/10 text-warning'
              : 'border-success/25 bg-success/10 text-success'
          )}
        >
          {conversation!.status === 'WAITING' ? <Clock size={14} /> : <UserRound size={14} />}
          <span>
            {conversation!.status === 'WAITING'
              ? 'Вопрос передан администратору клиники. Ответ придёт сюда же — можно писать дальше.'
              : 'С вами общается сотрудник клиники.'}
          </span>
          <Badge variant="outline" size="sm" className="ml-auto shrink-0">
            {conversation!.status === 'WAITING' ? 'ждём ответа' : 'на связи'}
          </Badge>
        </div>
      )}

      <Card padding="xl" className="min-h-[320px]">
        {isLive ? (
          <div className="space-y-3">
            {conversation!.messages.map((m) => (
              <Bubble key={m.id} mine={m.authorType === 'PATIENT'} content={m.body} />
            ))}
            <div ref={endRef} />
          </div>
        ) : historyQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton variant="card" height={48} />
            <Skeleton variant="card" height={48} />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-6 text-center">
            <Sparkles size={22} className="mx-auto text-dv-gold" />
            <h2 className="mt-3 font-serif text-xl text-txt-primary">Спросите о своём лечении</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-txt-muted">
              Ассистент смотрит вашу карту и отвечает по ней. Например:
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {OPENERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submit(q)}
                  className="rounded-full border border-bdr-subtle px-3 py-1.5 text-xs text-txt-secondary transition-colors hover:border-dv-gold/40 hover:text-txt-primary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} mine={m.role === 'user'} content={m.content} />
            ))}
            {busy && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="rounded-2xl rounded-bl-md border border-bdr-subtle bg-surface-raised px-4 py-2.5 text-sm text-txt-muted">
                  смотрю вашу карту…
                </div>
              </motion.div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/10 px-3 py-2.5 text-xs text-error">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={outOfQuota || busy}
          placeholder={
            outOfQuota
              ? 'Дневной лимит вопросов исчерпан'
              : isLive
                ? 'Написать администратору…'
                : 'Спросите о приёме, лечении или счёте…'
          }
          aria-label="Сообщение"
          className="min-h-11 w-full rounded-xl border border-bdr-subtle bg-surface-raised px-4 text-sm text-txt-primary placeholder:text-txt-ghost focus:border-dv-gold/40 focus:outline-none focus:ring-2 focus:ring-dv-gold/20 disabled:opacity-60"
        />
        <Button
          type="submit"
          variant="primary"
          className="min-h-11 shrink-0"
          disabled={outOfQuota || !draft.trim()}
          loading={busy}
          icon={<Send size={15} />}
        >
          <span className="sr-only">{t('common.send', 'Отправить')}</span>
        </Button>
      </form>

      <p className="text-2xs text-txt-ghost">
        {isLive
          ? 'Вы говорите с сотрудником клиники, а не с ассистентом.'
          : 'Ассистент объясняет то, что записано в вашей карте, и не заменяет консультацию врача.'}
        {!isLive && typeof statusQuery.data?.remaining === 'number' && (
          <> Осталось вопросов сегодня: {statusQuery.data.remaining}.</>
        )}
      </p>
    </div>
  );
}

export default Assistant;
