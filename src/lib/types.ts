export type ActivityStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
export type ParticipantStatus = 'confirmado' | 'pendente' | 'cancelado'
export type MealType = 'cafe_manha' | 'almoco' | 'cafe_tarde' | 'jantar' | 'lanche'
export type Direction = 'ida' | 'volta'
export type ItemKind = 'alimento' | 'bebida'

export interface EventRow {
  id: string
  owner_id: string
  name: string
  location: string
  start_date: string
  end_date: string
  notes: string
  created_at: string
}

export interface Participant {
  id: string
  event_id: string
  full_name: string
  display_name: string
  categories: string[]
  phone: string
  guardian: string
  notes: string
  status: ParticipantStatus
}

export interface Activity {
  id: string
  event_id: string
  title: string
  activity_date: string | null
  start_time: string | null
  duration_minutes: number
  responsible_participant_id: string | null
  responsible_name: string
  description: string
  category: string
  requirements: string
  status: ActivityStatus
  allow_overlap: boolean
  game_id: string | null
  sort_order: number
}

export interface Game {
  id: string
  event_id: string
  name: string
  description: string
  materials: string
  duration_minutes: number | null
  responsible_participant_id: string | null
  responsible_name: string
  notes: string
  done: boolean
  sort_order: number
}

export interface Meal {
  id: string
  event_id: string
  meal_date: string
  meal_type: MealType
  meal_time: string | null
  description: string
  responsible_participant_id: string | null
  responsible_name: string
  notes: string
  sort_order: number
}

export interface MealItem {
  id: string
  event_id: string
  meal_id: string | null
  name: string
  quantity: number | null
  unit: string
  kind: ItemKind
  sort_order: number
}

export interface Vehicle {
  id: string
  event_id: string
  direction: Direction
  driver_name: string
  driver_participant_id: string | null
  vehicle: string
  seats: number
  depart_time: string | null
  depart_place: string
  notes: string
  sort_order: number
}

export interface RidePassenger {
  event_id: string
  vehicle_id: string
  participant_id: string
}

export interface ShoppingCheck {
  event_id: string
  item_key: string
}

export interface EventData {
  participants: Participant[]
  activities: Activity[]
  games: Game[]
  meals: Meal[]
  mealItems: MealItem[]
  vehicles: Vehicle[]
  passengers: RidePassenger[]
  checks: ShoppingCheck[]
}

export const EMPTY_DATA: EventData = {
  participants: [],
  activities: [],
  games: [],
  meals: [],
  mealItems: [],
  vehicles: [],
  passengers: [],
  checks: [],
}

export const ACTIVITY_STATUS: Record<ActivityStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const PARTICIPANT_STATUS: Record<ParticipantStatus, string> = {
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  cancelado: 'Cancelado',
}

export const MEAL_TYPES: Record<MealType, string> = {
  cafe_manha: 'Café da manhã',
  almoco: 'Almoço',
  cafe_tarde: 'Café da tarde',
  jantar: 'Jantar',
  lanche: 'Lanche',
}

/** Horário usado só para ordenar refeições que ainda não têm hora definida. */
export const MEAL_DEFAULT_TIME: Record<MealType, string> = {
  cafe_manha: '07:30',
  almoco: '12:00',
  lanche: '15:00',
  cafe_tarde: '16:00',
  jantar: '19:00',
}

export const STANDARD_CATEGORIES = ['Conselheiro', 'Amigo', 'Companheiro']

export const ACTIVITY_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Logística', color: '#6B7A70' },
  { name: 'Instrução', color: '#2B6B4A' },
  { name: 'Especialidade', color: '#7A6A1F' },
  { name: 'Caminhada', color: '#8A5A2B' },
  { name: 'Recreação', color: '#2F7D8C' },
  { name: 'Pausa', color: '#9AA39C' },
  { name: 'Refeição', color: '#B0642A' },
  { name: 'Devocional', color: '#5B5A9B' },
  { name: 'Aviso ou marco', color: '#1B2420' },
  { name: 'Outra', color: '#B5BCB6' },
]

export function categoryColor(name: string): string {
  return ACTIVITY_CATEGORIES.find((c) => c.name === name)?.color ?? '#B5BCB6'
}
