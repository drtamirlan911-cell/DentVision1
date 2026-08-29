import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Mic, MicOff, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { Textarea } from '@/components/ui/ds/Input'
import { useToast } from '@/components/ui/ds/Toast'
import { startRecognition, voiceInputSupported, type VoiceRecognitionHandle } from '@/utils/voice'
import { normalizeTooth, statusColor, statusLabel, type PatientTeeth } from '@/lib/odontogram'
import {
  parseDictation,
  type DictationFields,
  type ToothFinding,
  type UnresolvedReason,
} from '@/lib/visitDictation'

/**
 * "Приём под диктовку" — one spoken sentence instead of three data entries.
 *
 * The doctor describes the visit the way they would to a colleague; the chart
 * changes are proposed, not applied. Nothing here writes on its own: every
 * finding is a checkbox the doctor can clear, and each one carries the words
 * that produced it, so the review is against the dictation rather than against
 * a black box.
 *
 * Speech goes through the existing on-device `utils/voice` helper (Web Speech,
 * ru-RU) — no audio leaves the browser and no dependency is added. Parsing is
 * `lib/visitDictation`, which is deterministic, so the preview updates on every
 * keystroke with no request and no cost.
 */

interface VisitDictationProps {
  /** Current chart, used to show what each finding would change. */
  teeth: PatientTeeth
  /** Called with the findings the doctor kept. */
  onApply: (findings: ToothFinding[]) => void
}

const UNRESOLVED_LABEL: Record<UnresolvedReason, string> = {
  ambiguous_tooth: 'Не хватает челюсти или стороны',
  finding_without_tooth: 'Состояние без зуба',
  tooth_without_finding: 'Зуб назван без состояния',
}

const SURFACE_LABEL: Record<string, string> = {
  M: 'мед.', O: 'жев.', D: 'дист.', B: 'вестиб.', L: 'нёбн.',
}

const EXAMPLE = 'На 16 глубокий кариес, жевательная и медиальная, поставил композитную пломбу. На 26 трещина, рекомендую коронку.'

function findingKey(f: ToothFinding): string {
  return `${f.kind}:${f.tooth}:${f.status}`
}

/** Plain-text rendering of the split visit note, for pasting into the record. */
function visitText(fields: DictationFields): string {
  return ([
    ['Жалобы', fields.complaints],
    ['Анамнез', fields.anamnesis],
    ['Диагноз', fields.diagnosis],
    ['Лечение', fields.treatment],
    ['Примечания', fields.notes],
  ] as Array<[string, string]>)
    .filter(([, v]) => v.trim())
    .map(([label, v]) => `${label}: ${v}`)
    .join('\n')
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      aria-hidden
      style={{ '--sw': statusColor(status) } as React.CSSProperties}
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--sw)]"
    />
  )
}

function FindingRow({
  finding,
  before,
  checked,
  onToggle,
}: {
  finding: ToothFinding
  before: string
  checked: boolean
  onToggle: () => void
}) {
  const planned = finding.kind === 'planned'
  return (
    <li className="flex items-start gap-3 rounded-lg border border-bdr-subtle p-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Зуб ${finding.tooth}, ${statusLabel(finding.status)}`}
        className="mt-1 h-4 w-4 shrink-0 accent-current"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-txt-primary">{finding.tooth}</span>
          {planned ? (
            <Badge variant="outline" size="xs">в план</Badge>
          ) : (
            <span className="text-xs text-txt-muted">{before} →</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <StatusDot status={finding.status} />
            <span className="text-sm text-txt-primary">{statusLabel(finding.status)}</span>
          </span>
          {finding.surfaces.length > 0 && (
            <span className="text-xs text-txt-secondary">
              {finding.surfaces.map((s) => SURFACE_LABEL[s] || s).join(', ')}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-txt-ghost" title={finding.span.text}>
          «{finding.span.text}»
        </p>
      </div>
    </li>
  )
}

export function VisitDictation({ teeth, onApply }: VisitDictationProps) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const recognitionRef = useRef<VoiceRecognitionHandle | null>(null)
  // Speech appends to whatever was already typed, so the phrase in progress is
  // held apart from the committed text instead of overwriting it.
  const committedRef = useRef('')

  const supported = useMemo(() => voiceInputSupported(), [])
  const draft = useMemo(() => parseDictation(text), [text])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const kept = draft.findings.filter((f) => !excluded.has(findingKey(f)))
  const observedKept = kept.filter((f) => f.kind === 'observed')

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    committedRef.current = text ? `${text.trim()} ` : ''
    const handle = startRecognition({
      onInterim: (phrase) => setText(committedRef.current + phrase),
      onFinal: (phrase) => {
        committedRef.current = `${(committedRef.current + phrase).trim()} `
        setText(committedRef.current)
      },
      onEnd: () => setListening(false),
      onError: (message) => {
        setListening(false)
        toast.error(message)
      },
    })
    if (handle) {
      recognitionRef.current = handle
      setListening(true)
    }
  }

  function apply() {
    if (kept.length === 0) return
    onApply(kept)
    setText('')
    setExcluded(new Set())
    toast.success(
      observedKept.length === kept.length
        ? `Карта обновлена: ${kept.length} зуб(ов)`
        : `Применено ${kept.length}: карта и рекомендации`,
    )
  }

  async function copyVisit() {
    const body = visitText(draft.fields)
    if (!body) return
    try {
      await navigator.clipboard.writeText(body)
      toast.success('Текст визита скопирован')
    } catch {
      toast.error('Буфер обмена недоступен')
    }
  }

  const hasVisitText = Boolean(visitText(draft.fields))

  return (
    <section className="rounded-xl border border-bdr-subtle p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-dv-gold" />
          <h3 className="text-sm font-semibold text-txt-primary">Приём под диктовку</h3>
        </div>
        <div className="flex items-center gap-2">
          {supported && (
            <Button
              size="sm"
              variant={listening ? 'danger' : 'secondary'}
              icon={listening ? <MicOff size={14} /> : <Mic size={14} />}
              onClick={toggleListening}
            >
              {listening ? 'Стоп' : 'Говорить'}
            </Button>
          )}
          {text && (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => { setText(''); setExcluded(new Set()) }}>
              Очистить
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          aria-label="Текст приёма"
          placeholder={`Опишите приём словами. Например: ${EXAMPLE}`}
        />
      </div>

      {listening && (
        <p className="mt-2 text-xs text-dv-gold">Слушаю… говорите обычными словами, номера зубов по FDI или «верхняя шестёрка справа».</p>
      )}

      {draft.findings.length > 0 && (
        <>
          <ul className="mt-3 space-y-2">
            {draft.findings.map((f) => {
              const key = findingKey(f)
              const before = statusLabel(normalizeTooth(teeth[f.tooth] ?? teeth[String(f.tooth)]).status)
              return (
                <FindingRow
                  key={key}
                  finding={f}
                  before={before}
                  checked={!excluded.has(key)}
                  onToggle={() =>
                    setExcluded((prev) => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }
                />
              )
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" icon={<Check size={14} />} disabled={kept.length === 0} onClick={apply}>
              Применить ({kept.length})
            </Button>
            {hasVisitText && (
              <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={copyVisit}>
                Скопировать текст визита
              </Button>
            )}
          </div>
        </>
      )}

      {draft.unresolved.length > 0 && (
        <ul className="mt-3 space-y-1">
          {draft.unresolved.map((u, i) => (
            <li key={`${u.reason}-${i}`} className="flex items-start gap-2 text-xs text-txt-muted">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
              <span className="min-w-0">
                {UNRESOLVED_LABEL[u.reason]}: «{u.span.text}»
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default VisitDictation
