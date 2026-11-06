import { absoluteMinutes, dateFromDayNumber, fromMinutes, type Now } from './time'
import type { Activity } from './types'

export type Scheduled = Activity & { activity_date: string; start_time: string }

export const isScheduled = (a: Activity): a is Scheduled => !!a.activity_date && !!a.start_time

export const startAbs = (a: Scheduled) => absoluteMinutes(a.activity_date, a.start_time)
export const endAbs = (a: Scheduled) => startAbs(a) + a.duration_minutes

export function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const da = a.activity_date ?? '9999'
    const db = b.activity_date ?? '9999'
    if (da !== db) return da < db ? -1 : 1
    const ta = (a.start_time ?? '99').slice(0, 5)
    const tb = (b.start_time ?? '99').slice(0, 5)
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.sort_order - b.sort_order
  })
}

const canConflict = (a: Activity): a is Scheduled =>
  isScheduled(a) && a.status !== 'cancelada' && a.duration_minutes > 0 && !a.allow_overlap

/** Mapa de atividade para as atividades que se sobrepõem a ela. É um aviso, não um erro. */
export function findConflicts(list: Activity[]): Map<string, Activity[]> {
  const items = list.filter(canConflict).sort((a, b) => startAbs(a) - startAbs(b))
  const result = new Map<string, Activity[]>()
  const add = (a: Activity, b: Activity) => result.set(a.id, [...(result.get(a.id) ?? []), b])
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (startAbs(items[j]) >= endAbs(items[i])) break
      add(items[i], items[j])
      add(items[j], items[i])
    }
  }
  return result
}

/** Número de pares em conflito. */
export function conflictPairs(conflicts: Map<string, Activity[]>): number {
  let total = 0
  for (const c of conflicts.values()) total += c.length
  return total / 2
}

const isOpen = (a: Activity) => a.status === 'pendente' || a.status === 'em_andamento'

export function isRunning(a: Activity, now: Now): boolean {
  if (a.status === 'em_andamento') return true
  if (a.status !== 'pendente' || !isScheduled(a) || a.duration_minutes === 0) return false
  return startAbs(a) <= now.absolute && now.absolute < endAbs(a)
}

export function currentAndNext(list: Activity[], now: Now): { current: Activity[]; next: Scheduled | null } {
  const sorted = sortActivities(list)
  const current = sorted.filter((a) => isRunning(a, now))
  const next =
    sorted
      .filter(isScheduled)
      .find((a) => a.status === 'pendente' && startAbs(a) > now.absolute) ?? null
  return { current, next }
}

export interface TimeUpdate {
  id: string
  activity_date: string | null
  start_time: string | null
  sort_order: number
}

export const toUpdate = (a: Activity): TimeUpdate => ({
  id: a.id,
  activity_date: a.activity_date,
  start_time: a.start_time,
  sort_order: a.sort_order,
})

/** Atividades abertas do mesmo dia que começam depois do fim anterior da atividade alterada. */
export function followingActivities(all: Activity[], edited: Scheduled, previousDuration: number): Scheduled[] {
  const oldEnd = startAbs(edited) + previousDuration
  return all
    .filter(isScheduled)
    .filter(
      (a) =>
        a.id !== edited.id &&
        isOpen(a) &&
        a.activity_date === edited.activity_date &&
        startAbs(a) > startAbs(edited) &&
        startAbs(a) >= oldEnd,
    )
    .sort((a, b) => startAbs(a) - startAbs(b))
}

export function placeAt(a: Activity, absolute: number): Activity {
  const clamped = Math.max(0, absolute)
  return {
    ...a,
    activity_date: dateFromDayNumber(Math.floor(clamped / 1440)),
    start_time: fromMinutes(clamped),
  }
}

/** Desloca as atividades pelo delta. Nunca é chamado sem confirmação do usuário. */
export function shiftActivities(items: Scheduled[], delta: number): Activity[] {
  return items.map((a) => {
    const target = startAbs(a) + delta
    const dayStart = Math.floor(startAbs(a) / 1440) * 1440
    // Ao adiantar, não invade o dia anterior.
    return placeAt(a, delta < 0 ? Math.max(target, dayStart) : target)
  })
}

export interface DropPlan {
  order: Activity[]
  /** A nova posição contraria os horários: é preciso perguntar o que fazer. */
  needsDecision: boolean
  moved: Activity
  /** Só a atividade movida muda de horário. */
  onlyMoved: Activity[]
  /** A movida muda e as seguintes são empurradas quando necessário. */
  pushed: Activity[]
  pushedCount: number
}

export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

const withOrder = (list: Activity[]) => list.map((a, i) => ({ ...a, sort_order: (i + 1) * 10 }))

export function planDrop(group: Activity[], from: number, to: number): DropPlan {
  const order = withOrder(arrayMove(group, from, to))
  const moved = order[to]
  const prev = order[to - 1]
  const next = order[to + 1]
  const base: DropPlan = { order, needsDecision: false, moved, onlyMoved: order, pushed: order, pushedCount: 0 }

  if (!isScheduled(moved)) return base
  const prevOk = !prev || !isScheduled(prev) || startAbs(prev) <= startAbs(moved)
  const nextOk = !next || !isScheduled(next) || startAbs(moved) <= startAbs(next)
  if (prevOk && nextOk) return base

  // Início sugerido: logo após a anterior, sem passar da seguinte.
  let target: number
  if (prev && isScheduled(prev)) {
    target = endAbs(prev)
    if (next && isScheduled(next)) target = Math.min(target, startAbs(next))
  } else if (next && isScheduled(next)) {
    target = Math.max(startAbs(next) - moved.duration_minutes, Math.floor(startAbs(next) / 1440) * 1440)
  } else {
    target = startAbs(moved)
  }
  const placed = placeAt(moved, target) as Scheduled
  const onlyMoved = order.map((a) => (a.id === moved.id ? placed : a))

  // Com empurrão: a movida começa logo após a anterior e as seguintes abrem espaço.
  const pushedStart = prev && isScheduled(prev) ? endAbs(prev) : target
  const pushedMoved = placeAt(moved, pushedStart) as Scheduled
  let cursor = endAbs(pushedMoved)
  let pushedCount = 0
  const pushed = order.map((a, i) => {
    if (i < to) return a
    if (i === to) return pushedMoved
    if (!isScheduled(a) || !isOpen(a)) return a
    if (a.duration_minutes === 0 && startAbs(a) >= cursor) return a
    if (startAbs(a) < cursor) {
      pushedCount++
      const shifted = placeAt(a, cursor) as Scheduled
      cursor = endAbs(shifted)
      return shifted
    }
    cursor = Math.max(cursor, endAbs(a))
    return a
  })

  return { order, needsDecision: true, moved: placed, onlyMoved, pushed, pushedCount }
}
