import {
  formatTeethList,
  lineItemTotal,
  planTotal,
  stageTotal,
  type TreatmentPlanStage,
} from './treatment-plan'

export interface TreatmentPlanPrintContext {
  clinicName: string
  clinicAddress?: string
  clinicPhone?: string
  clinicCity?: string
  patientName: string
  patientPhone?: string
  doctorName?: string
  title: string
  diagnosis?: string
  status?: string
  stages: TreatmentPlanStage[]
  createdAt?: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  proposed: 'Предложен',
  accepted: 'Принят',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₸`
}

function formatDate(value?: string): string {
  if (!value) return new Date().toLocaleDateString('ru-RU')
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('ru-RU')
}

export function buildTreatmentPlanPrintHtml(ctx: TreatmentPlanPrintContext): string {
  const total = planTotal(ctx.stages)
  const stageBlocks = ctx.stages.map((stage, index) => {
    const items = stage.items?.length
      ? stage.items.map((item) => `
          <tr>
            <td>${escapeHtml(item.serviceName)}</td>
            <td>${escapeHtml(formatTeethList(item.teeth))}</td>
            <td style="text-align:right">${formatMoney(item.price)}</td>
            <td style="text-align:right">${formatMoney(lineItemTotal(item))}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="4" style="color:#666">Услуги не добавлены</td></tr>`

    return `
      <section class="stage">
        <div class="stage-head">
          <h3>Этап ${index + 1}: ${escapeHtml(stage.title)}</h3>
          <span class="stage-sum">${formatMoney(stageTotal(stage))}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Услуга</th>
              <th>Зубы</th>
              <th style="text-align:right">Цена</th>
              <th style="text-align:right">Сумма</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
        ${stage.notes ? `<p class="notes">${escapeHtml(stage.notes)}</p>` : ''}
      </section>
    `
  }).join('')

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>План лечения — ${escapeHtml(ctx.patientName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #c9a96e; padding-bottom: 16px; margin-bottom: 24px; }
    .clinic h1 { margin: 0 0 8px; font-size: 22px; color: #8b7340; }
    .clinic p { margin: 2px 0; color: #555; font-size: 13px; }
    .meta { text-align: right; font-size: 13px; color: #555; }
    .meta strong { display: block; color: #111; font-size: 16px; margin-bottom: 4px; }
    .title { margin: 0 0 8px; font-size: 20px; }
    .subtitle { margin: 0 0 20px; color: #666; }
    .stage { margin-bottom: 24px; page-break-inside: avoid; }
    .stage-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .stage-head h3 { margin: 0; font-size: 15px; }
    .stage-sum { font-weight: 700; color: #8b7340; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 13px; text-align: left; }
    th { background: #f7f3ea; }
    .notes { margin: 8px 0 0; font-size: 12px; color: #666; }
    .total { margin-top: 24px; padding-top: 16px; border-top: 2px solid #c9a96e; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #777; }
    .sign { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .sign div { border-top: 1px solid #999; padding-top: 8px; font-size: 12px; color: #555; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="clinic">
      <h1>${escapeHtml(ctx.clinicName)}</h1>
      ${ctx.clinicCity ? `<p>${escapeHtml(ctx.clinicCity)}</p>` : ''}
      ${ctx.clinicAddress ? `<p>${escapeHtml(ctx.clinicAddress)}</p>` : ''}
      ${ctx.clinicPhone ? `<p>Тел.: ${escapeHtml(ctx.clinicPhone)}</p>` : ''}
    </div>
    <div class="meta">
      <strong>${escapeHtml(ctx.patientName)}</strong>
      ${ctx.patientPhone ? `<div>${escapeHtml(ctx.patientPhone)}</div>` : ''}
      <div>Дата: ${formatDate(ctx.createdAt)}</div>
      ${ctx.doctorName ? `<div>Врач: ${escapeHtml(ctx.doctorName)}</div>` : ''}
      ${ctx.status ? `<div>Статус: ${escapeHtml(STATUS_LABELS[ctx.status] || ctx.status)}</div>` : ''}
    </div>
  </div>

  <h2 class="title">${escapeHtml(ctx.title || 'План лечения')}</h2>
  ${ctx.diagnosis ? `<p class="subtitle">Диагноз / показания: ${escapeHtml(ctx.diagnosis)}</p>` : ''}

  ${stageBlocks || '<p>Этапы не добавлены</p>'}

  <div class="total">
    <span>Итого по плану</span>
    <span>${formatMoney(total)}</span>
  </div>

  <div class="sign">
    <div>Подпись врача</div>
    <div>Подпись пациента</div>
  </div>

  <div class="footer">
    <span>Сформировано в DentVision</span>
    <span>${new Date().toLocaleString('ru-RU')}</span>
  </div>

  <script>window.onload = () => window.print()</script>
</body>
</html>`
}

export function printTreatmentPlan(ctx: TreatmentPlanPrintContext): void {
  const html = buildTreatmentPlanPrintHtml(ctx)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
