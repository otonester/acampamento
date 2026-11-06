import { participantName, passengersOf, responsibleName, sortMeals } from './domain'
import { isScheduled, sortActivities } from './schedule'
import { dateRange, endOf, formatDuration, fullDate, hhmm, longDay, weekday, dayMonth } from './time'
import {
  ACTIVITY_STATUS,
  MEAL_TYPES,
  PARTICIPANT_STATUS,
  type EventData,
  type EventRow,
  type Participant,
} from './types'

function fileSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function endLabel(start: string, duration: number): string {
  const end = endOf(start, duration)
  return end.dayOffset > 0 ? `${end.time} (+${end.dayOffset}d)` : end.time
}

// ---------- WhatsApp ----------

export interface ShareOptions {
  schedule: boolean
  menu: boolean
  rides: boolean
}

export function buildWhatsAppText(event: EventRow, data: EventData, opts: ShareOptions): string {
  const active = data.participants.filter((p) => p.status !== 'cancelado')
  const lines: string[] = [`*${event.name}*`]
  if (event.location) lines.push(`📍 ${event.location}`)
  lines.push(`📅 ${dateRange(event.start_date, event.end_date)}`)
  lines.push(`👥 ${active.length} ${active.length === 1 ? 'participante' : 'participantes'}`)

  if (opts.schedule) {
    const sorted = sortActivities(data.activities).filter((a) => a.status !== 'cancelada')
    const scheduled = sorted.filter(isScheduled)
    if (scheduled.length) {
      lines.push('', '*Cronograma*')
      let day = ''
      for (const a of scheduled) {
        if (a.activity_date !== day) {
          day = a.activity_date
          lines.push(`_${weekday(day)}, ${dayMonth(day)}_`)
        }
        const resp = responsibleName(a, data.participants)
        lines.push(`${hhmm(a.start_time)} ${a.title}${resp ? ` (${resp})` : ''}`)
      }
    }
    const pending = sorted.filter((a) => !isScheduled(a))
    if (pending.length) {
      lines.push('', '*A programar*')
      pending.forEach((a) => lines.push(`• ${a.title}`))
    }
  }

  if (opts.menu && data.meals.length) {
    lines.push('', '*Cardápio*')
    let day = ''
    for (const m of sortMeals(data.meals)) {
      if (m.meal_date !== day) {
        day = m.meal_date
        lines.push(`_${weekday(day)}, ${dayMonth(day)}_`)
      }
      lines.push(`${MEAL_TYPES[m.meal_type]}: ${m.description || 'A definir'}`)
    }
  }

  if (opts.rides) {
    for (const direction of ['ida', 'volta'] as const) {
      const vehicles = data.vehicles.filter((v) => v.direction === direction)
      if (!vehicles.length) continue
      lines.push('', direction === 'ida' ? '*Caronas: ida*' : '*Caronas: volta*')
      for (const v of vehicles) {
        const names = passengersOf(v.id, data.passengers, data.participants).map((p) => p.display_name)
        lines.push(`🚗 ${v.driver_name}: ${names.join(', ') || 'sem passageiros'}`)
      }
    }
  }
  return lines.join('\n')
}

// ---------- Participantes (CSV) ----------

function csvCell(value: string): string {
  // Evita que uma planilha interprete o conteúdo como fórmula.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function buildParticipantsCsv(list: Participant[]): string {
  const header = ['Nome completo', 'Nome de exibição', 'Categorias', 'Telefone', 'Responsável legal', 'Status', 'Observações']
  const rows = [...list]
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt-BR'))
    .map((p) => [p.full_name, p.display_name, p.categories.join(', '), p.phone, p.guardian, PARTICIPANT_STATUS[p.status], p.notes])
  // Ponto e vírgula e BOM: o Excel em português abre com colunas e acentos corretos.
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadParticipantsCsv(event: EventRow, list: Participant[]) {
  download(new Blob([buildParticipantsCsv(list)], { type: 'text/csv;charset=utf-8' }), `participantes-${fileSlug(event.name)}.csv`)
}

// ---------- Cronograma (PDF) ----------

export async function downloadSchedulePdf(event: EventRow, data: EventData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const green: [number, number, number] = [23, 63, 44]

  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...green)
  doc.text(event.name, 40, 48)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90)
  doc.text([event.location, dateRange(event.start_date, event.end_date)].filter(Boolean).join('  |  '), 40, 66)

  const sorted = sortActivities(data.activities)
  const days = [...new Set(sorted.filter(isScheduled).map((a) => a.activity_date))]
  let y = 84

  const table = (head: string[], body: string[][]) => {
    autoTable(doc, {
      startY: y + 18,
      head: [head],
      body,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9, cellPadding: 4, valign: 'top' },
      headStyles: { fillColor: green, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 247, 242] },
    })
    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  }

  for (const day of days) {
    if (y > 720) {
      doc.addPage()
      y = 40
    }
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...green)
    doc.text(longDay(day), 40, y + 10)
    const rows = sorted
      .filter(isScheduled)
      .filter((a) => a.activity_date === day)
      .map((a) => [
        hhmm(a.start_time),
        a.duration_minutes ? endLabel(a.start_time, a.duration_minutes) : '-',
        a.duration_minutes ? formatDuration(a.duration_minutes) : '-',
        a.title + (a.description ? `\n${a.description}` : ''),
        responsibleName(a, data.participants) || '-',
        ACTIVITY_STATUS[a.status],
      ])
    y = table(['Início', 'Término', 'Duração', 'Atividade', 'Responsável', 'Status'], rows) + 18
  }

  const pending = sorted.filter((a) => !isScheduled(a))
  if (pending.length) {
    if (y > 720) {
      doc.addPage()
      y = 40
    }
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...green)
    doc.text('A programar', 40, y + 10)
    table(
      ['Atividade', 'Duração', 'Responsável'],
      pending.map((a) => [
        a.title,
        a.duration_minutes ? formatDuration(a.duration_minutes) : '-',
        participantName(data.participants, a.responsible_participant_id) || a.responsible_name || '-',
      ]),
    )
  }

  doc.save(`cronograma-${fileSlug(event.name)}-${fullDate(event.start_date).replace(/\//g, '-')}.pdf`)
}
