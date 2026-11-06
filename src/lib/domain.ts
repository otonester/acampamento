import { absoluteMinutes, shortDay, type Now } from './time'
import {
  MEAL_DEFAULT_TIME,
  MEAL_TYPES,
  STANDARD_CATEGORIES,
  type Direction,
  type Meal,
  type MealItem,
  type Participant,
  type RidePassenger,
  type Vehicle,
} from './types'

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------- Participantes ----------

/** Registros que provavelmente são a mesma pessoa que está sendo cadastrada. */
export function findDuplicates(
  candidate: { id?: string; full_name: string; display_name: string },
  list: Participant[],
): Participant[] {
  const full = normalize(candidate.full_name)
  const display = normalize(candidate.display_name)
  return list.filter((p) => {
    if (p.id === candidate.id) return false
    const pf = normalize(p.full_name)
    const pd = normalize(p.display_name)
    return (full && (pf === full || pd === full)) || (display && (pd === display || pf === display))
  })
}

export const isCustomCategory = (c: string) => !STANDARD_CATEGORIES.includes(c)

export function matchesCategory(p: Participant, filter: string): boolean {
  if (filter === 'Outra') return p.categories.some(isCustomCategory)
  return p.categories.includes(filter)
}

export function categoryCounts(list: Participant[]): { name: string; count: number }[] {
  const counts = [...STANDARD_CATEGORIES, 'Outra'].map((name) => ({
    name,
    count: list.filter((p) => matchesCategory(p, name)).length,
  }))
  return counts.filter((c) => c.count > 0 || c.name !== 'Outra')
}

export function participantName(list: Participant[], id: string | null | undefined): string {
  return list.find((p) => p.id === id)?.display_name ?? ''
}

export function responsibleName(
  row: { responsible_participant_id: string | null; responsible_name: string },
  list: Participant[],
): string {
  return participantName(list, row.responsible_participant_id) || row.responsible_name
}

// ---------- Caronas ----------

export function passengersOf(vehicleId: string, passengers: RidePassenger[], participants: Participant[]): Participant[] {
  return passengers
    .filter((r) => r.vehicle_id === vehicleId)
    .map((r) => participants.find((p) => p.id === r.participant_id))
    .filter((p): p is Participant => !!p)
}

/** Pessoas ativas sem carro nesse sentido. Quem dirige um dos carros já tem transporte. */
export function withoutRide(
  direction: Direction,
  participants: Participant[],
  vehicles: Vehicle[],
  passengers: RidePassenger[],
): Participant[] {
  const inDirection = vehicles.filter((v) => v.direction === direction)
  const ids = new Set(inDirection.map((v) => v.id))
  const covered = new Set(passengers.filter((r) => ids.has(r.vehicle_id)).map((r) => r.participant_id))
  inDirection.forEach((v) => v.driver_participant_id && covered.add(v.driver_participant_id))
  return participants.filter((p) => p.status !== 'cancelado' && !covered.has(p.id))
}

/** Participantes que aparecem em mais de um carro no mesmo sentido. */
export function repeatedInRides(
  direction: Direction,
  participants: Participant[],
  vehicles: Vehicle[],
  passengers: RidePassenger[],
): { participant: Participant; vehicles: Vehicle[] }[] {
  const inDirection = vehicles.filter((v) => v.direction === direction)
  return participants
    .map((participant) => ({
      participant,
      vehicles: inDirection.filter((v) =>
        passengers.some((r) => r.vehicle_id === v.id && r.participant_id === participant.id),
      ),
    }))
    .filter((r) => r.vehicles.length > 1)
}

// ---------- Cardápio ----------

export function sortMeals(meals: Meal[]): Meal[] {
  const time = (m: Meal) => (m.meal_time ?? MEAL_DEFAULT_TIME[m.meal_type]).slice(0, 5)
  return [...meals].sort((a, b) =>
    a.meal_date !== b.meal_date
      ? a.meal_date < b.meal_date
        ? -1
        : 1
      : time(a) !== time(b)
        ? time(a) < time(b)
          ? -1
          : 1
        : a.sort_order - b.sort_order,
  )
}

export function nextMeal(meals: Meal[], now: Now): Meal | null {
  return (
    sortMeals(meals).find(
      (m) => absoluteMinutes(m.meal_date, (m.meal_time ?? MEAL_DEFAULT_TIME[m.meal_type]).slice(0, 5)) >= now.absolute,
    ) ?? null
  )
}

export interface ShoppingLine {
  key: string
  name: string
  kind: MealItem['kind']
  /** Quantidades somadas por unidade, já formatadas. Vazio quando nada foi informado. */
  amounts: string[]
  /** Quantos usos não têm quantidade informada. */
  withoutQuantity: number
  usedIn: string[]
  general: boolean
  purchased: boolean
}

const formatNumber = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Une ingredientes de mesmo nome, somando quantidades de mesma unidade. */
export function buildShoppingList(items: MealItem[], meals: Meal[], purchasedKeys: Set<string>): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine & { totals: Map<string, number> }>()
  for (const item of items) {
    const key = normalize(item.name)
    if (!key) continue
    let line = lines.get(key)
    if (!line) {
      line = {
        key,
        name: item.name.trim(),
        kind: item.kind,
        amounts: [],
        withoutQuantity: 0,
        usedIn: [],
        general: false,
        purchased: purchasedKeys.has(key),
        totals: new Map(),
      }
      lines.set(key, line)
    }
    if (item.kind === 'bebida') line.kind = 'bebida'
    if (item.quantity != null) {
      const unit = item.unit.trim().toLowerCase()
      line.totals.set(unit, (line.totals.get(unit) ?? 0) + Number(item.quantity))
    } else {
      line.withoutQuantity++
    }
    const meal = meals.find((m) => m.id === item.meal_id)
    if (meal) line.usedIn.push(`${MEAL_TYPES[meal.meal_type]} de ${shortDay(meal.meal_date)}`)
    else line.general = true
  }
  return [...lines.values()]
    .map(({ totals, ...line }) => ({
      ...line,
      amounts: [...totals].map(([unit, n]) => `${formatNumber(n)}${unit ? ` ${unit}` : ''}`),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** "pão, bolo; frutas" vira uma lista de nomes. */
export function splitNames(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
