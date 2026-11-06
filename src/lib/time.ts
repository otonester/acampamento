const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "08:30" ou "08:30:00" para minutos desde 00:00. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Minutos para "HH:MM". Valores fora de 0–1439 dão a volta no relógio. */
export function fromMinutes(total: number): string {
  const m = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ''
}

/** Horário de término e quantos dias ele avança em relação ao início. */
export function endOf(start: string, duration: number): { time: string; dayOffset: number } {
  const total = toMinutes(start) + duration
  return { time: fromMinutes(total), dayOffset: Math.floor(total / 1440) }
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  if (minutes === 0) return 'Sem duração'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

/** Dias desde a época, sem interferência de fuso horário. */
export function dayNumber(date: string): number {
  const [y, m, d] = parts(date)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

export function dateFromDayNumber(n: number): string {
  return new Date(n * 86400000).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return dateFromDayNumber(dayNumber(date) + days)
}

export function absoluteMinutes(date: string, time: string): number {
  return dayNumber(date) * 1440 + toMinutes(time)
}

function weekdayIndex(date: string): number {
  const [y, m, d] = parts(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export const weekday = (date: string) => WEEKDAYS[weekdayIndex(date)]
export const weekdayShort = (date: string) => WEEKDAYS_SHORT[weekdayIndex(date)]

/** 14/11 */
export function dayMonth(date: string): string {
  const [, m, d] = parts(date)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** 14/11/2026 */
export function fullDate(date: string): string {
  return `${dayMonth(date)}/${parts(date)[0]}`
}

/** Sábado, 14/11 */
export function longDay(date: string): string {
  return `${weekday(date)}, ${dayMonth(date)}`
}

/** sáb 14/11 */
export function shortDay(date: string): string {
  return `${weekdayShort(date)} ${dayMonth(date)}`
}

export function dateRange(start: string, end: string): string {
  if (start === end) return `${longDay(start)}/${parts(start)[0]}`
  const sameYear = parts(start)[0] === parts(end)[0]
  return `${sameYear ? dayMonth(start) : fullDate(start)} a ${fullDate(end)}`
}

export function daysInRange(start: string, end: string): string[] {
  const days: string[] = []
  for (let n = dayNumber(start); n <= dayNumber(end); n++) days.push(dateFromDayNumber(n))
  return days
}

export interface Now {
  date: string
  minutes: number
  absolute: number
}

export function getNow(d: Date = new Date()): Now {
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const minutes = d.getHours() * 60 + d.getMinutes()
  return { date, minutes, absolute: dayNumber(date) * 1440 + minutes }
}
