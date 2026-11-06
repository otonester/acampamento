import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { friendlyError, supabase } from '../lib/supabase'
import type { TimeUpdate } from '../lib/schedule'
import { EMPTY_DATA, type EventData, type EventRow, type RidePassenger } from '../lib/types'
import { useFeedback } from './Feedback'

const STORAGE_KEY = 'gestor-acampamento:evento'

const TABLES = {
  participants: 'participants',
  activities: 'activities',
  games: 'games',
  meals: 'meals',
  mealItems: 'meal_items',
  vehicles: 'vehicles',
} as const

export type RowKey = keyof typeof TABLES
type RowOf<K extends RowKey> = EventData[K][number]

/** Excluir estas linhas altera outras (cascata ou limpeza de vínculo): recarrega depois. */
const CASCADING: RowKey[] = ['participants', 'games', 'meals', 'vehicles']

interface EventApi {
  events: EventRow[]
  event: EventRow | null
  data: EventData
  loadingEvents: boolean
  loadingData: boolean
  loadError: string | null
  retry: () => void
  selectEvent: (id: string) => void
  saveEvent: (row: Partial<EventRow>) => Promise<EventRow | null>
  deleteEvent: (id: string) => Promise<boolean>
  duplicateEvent: (id: string, name: string, startDate: string) => Promise<string | null>
  createDemoEvent: () => Promise<string | null>
  saveRow: <K extends RowKey>(key: K, row: Partial<RowOf<K>>) => Promise<RowOf<K> | null>
  deleteRow: (key: RowKey, id: string) => Promise<boolean>
  saveMealItems: (mealId: string, items: { id?: string; name: string; quantity: number | null; unit: string; kind: string }[]) => Promise<boolean>
  bulkUpdateActivities: (updates: TimeUpdate[]) => Promise<boolean>
  addPassenger: (vehicleId: string, participantId: string) => Promise<boolean>
  removePassenger: (vehicleId: string, participantId: string) => Promise<boolean>
  transferPassenger: (fromVehicle: string, toVehicle: string, participantId: string) => Promise<boolean>
  copyRidesToReturn: () => Promise<boolean>
  togglePurchased: (key: string, purchased: boolean) => Promise<void>
}

const Ctx = createContext<EventApi | null>(null)

export const useEvent = () => {
  const value = useContext(Ctx)
  if (!value) throw new Error('EventProvider ausente')
  return value
}

/** Atalho para páginas que só existem com um evento selecionado. */
export const useCurrentEvent = () => {
  const value = useEvent()
  return { ...value, event: value.event as EventRow }
}

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Sem armazenamento local, o app abre sempre no primeiro evento.
  }
}

async function fetchEventData(eventId: string): Promise<EventData> {
  const q = (table: string, order: string) => supabase.from(table).select('*').eq('event_id', eventId).order(order)
  const [participants, activities, games, meals, mealItems, vehicles, passengers, checks] = await Promise.all([
    q('participants', 'display_name'),
    q('activities', 'sort_order'),
    q('games', 'sort_order'),
    q('meals', 'sort_order'),
    q('meal_items', 'sort_order'),
    q('vehicles', 'sort_order'),
    supabase.from('ride_passengers').select('*').eq('event_id', eventId),
    supabase.from('shopping_checks').select('*').eq('event_id', eventId),
  ])
  for (const r of [participants, activities, games, meals, mealItems, vehicles, passengers, checks]) {
    if (r.error) throw r.error
  }
  return {
    participants: participants.data!,
    activities: activities.data!,
    games: games.data!,
    meals: meals.data!,
    mealItems: mealItems.data!,
    vehicles: vehicles.data!,
    passengers: passengers.data!,
    checks: checks.data!,
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const { toast } = useFeedback()
  const [events, setEvents] = useState<EventRow[]>([])
  const [eventId, setEventId] = useState<string | null>(null)
  const [data, setData] = useState<EventData>(EMPTY_DATA)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  // Impede que uma leitura antiga sobrescreva uma alteração mais recente.
  const version = useRef(0)

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId])

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    setLoadError(null)
    const { data: rows, error } = await supabase.from('events').select('*').order('start_date', { ascending: false })
    if (error) {
      setLoadError(friendlyError(error))
      setLoadingEvents(false)
      return
    }
    setEvents(rows as EventRow[])
    const stored = readStoredId()
    const list = rows as EventRow[]
    setEventId((current) => {
      if (current && list.some((e) => e.id === current)) return current
      if (stored && list.some((e) => e.id === stored)) return stored
      return list[0]?.id ?? null
    })
    setLoadingEvents(false)
  }, [])

  const refreshData = useCallback(async (id: string, silent = false) => {
    const started = ++version.current
    if (!silent) {
      setLoadingData(true)
      setLoadError(null)
    }
    try {
      const fresh = await fetchEventData(id)
      if (started === version.current) setData(fresh)
    } catch (e) {
      if (!silent && started === version.current) setLoadError(friendlyError(e))
    } finally {
      if (!silent && started === version.current) setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (!eventId) {
      version.current++
      setData(EMPTY_DATA)
      setLoadingData(false)
      return
    }
    storeId(eventId)
    void refreshData(eventId)
  }, [eventId, refreshData])

  // Ao voltar para o app, traz o que foi alterado em outro aparelho.
  useEffect(() => {
    if (!eventId) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshData(eventId, true)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [eventId, refreshData])

  const fail = useCallback(
    (e: unknown) => {
      toast(friendlyError(e), 'error')
    },
    [toast],
  )

  const saveEvent = useCallback<EventApi['saveEvent']>(
    async (row) => {
      const { id, ...fields } = row
      const query = id ? supabase.from('events').update(fields).eq('id', id) : supabase.from('events').insert(fields)
      const { data: saved, error } = await query.select().single()
      if (error) {
        fail(error)
        return null
      }
      const value = saved as EventRow
      setEvents((list) => (id ? list.map((e) => (e.id === id ? value : e)) : [value, ...list]))
      if (!id) setEventId(value.id)
      return value
    },
    [fail],
  )

  const deleteEvent = useCallback<EventApi['deleteEvent']>(
    async (id) => {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) {
        fail(error)
        return false
      }
      setEvents((list) => {
        const rest = list.filter((e) => e.id !== id)
        setEventId((current) => (current === id ? (rest[0]?.id ?? null) : current))
        return rest
      })
      return true
    },
    [fail],
  )

  const afterNewEvent = useCallback(
    async (id: string) => {
      const { data: rows, error } = await supabase.from('events').select('*').order('start_date', { ascending: false })
      if (error) throw error
      setEvents(rows as EventRow[])
      setEventId(id)
    },
    [],
  )

  const duplicateEvent = useCallback<EventApi['duplicateEvent']>(
    async (id, name, startDate) => {
      try {
        const { data: newId, error } = await supabase.rpc('duplicate_event', { p_source: id, p_name: name, p_start_date: startDate })
        if (error) throw error
        await afterNewEvent(newId as string)
        return newId as string
      } catch (e) {
        fail(e)
        return null
      }
    },
    [afterNewEvent, fail],
  )

  const createDemoEvent = useCallback<EventApi['createDemoEvent']>(async () => {
    try {
      const { data: newId, error } = await supabase.rpc('create_demo_event')
      if (error) throw error
      await afterNewEvent(newId as string)
      return newId as string
    } catch (e) {
      fail(e)
      return null
    }
  }, [afterNewEvent, fail])

  const saveRow = useCallback(
    async <K extends RowKey>(key: K, row: Partial<RowOf<K>>): Promise<RowOf<K> | null> => {
      const { id, ...fields } = row as { id?: string }
      const table = TABLES[key]
      version.current++
      const query = id
        ? supabase.from(table).update(fields).eq('id', id)
        : supabase.from(table).insert({ ...fields, event_id: eventId })
      const { data: saved, error } = await query.select().single()
      if (error) {
        fail(error)
        return null
      }
      const value = saved as RowOf<K>
      setData((d) => {
        const list = d[key] as RowOf<K>[]
        const next = id ? list.map((r) => ((r as { id: string }).id === id ? value : r)) : [...list, value]
        return { ...d, [key]: next }
      })
      return value
    },
    [eventId, fail],
  )

  const deleteRow = useCallback<EventApi['deleteRow']>(
    async (key, id) => {
      version.current++
      const { error } = await supabase.from(TABLES[key]).delete().eq('id', id)
      if (error) {
        fail(error)
        return false
      }
      setData((d) => ({ ...d, [key]: (d[key] as { id: string }[]).filter((r) => r.id !== id) }))
      if (CASCADING.includes(key) && eventId) await refreshData(eventId, true)
      return true
    },
    [eventId, fail, refreshData],
  )

  const saveMealItems = useCallback<EventApi['saveMealItems']>(
    async (mealId, items) => {
      version.current++
      const existing = dataRef.current.mealItems.filter((i) => i.meal_id === mealId)
      const keep = new Set(items.map((i) => i.id).filter(Boolean))
      const removed = existing.filter((i) => !keep.has(i.id)).map((i) => i.id)
      const rows = items.map((i, index) => ({
        id: i.id ?? crypto.randomUUID(),
        event_id: eventId,
        meal_id: mealId,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        kind: i.kind,
        sort_order: index + 1,
      }))
      try {
        if (rows.length) {
          const { error } = await supabase.from('meal_items').upsert(rows)
          if (error) throw error
        }
        if (removed.length) {
          const { error } = await supabase.from('meal_items').delete().in('id', removed)
          if (error) throw error
        }
        setData((d) => ({
          ...d,
          mealItems: [...d.mealItems.filter((i) => i.meal_id !== mealId), ...(rows as EventData['mealItems'])],
        }))
        return true
      } catch (e) {
        fail(e)
        return false
      }
    },
    [eventId, fail],
  )

  const bulkUpdateActivities = useCallback<EventApi['bulkUpdateActivities']>(
    async (updates) => {
      if (!updates.length) return true
      version.current++
      const { error } = await supabase.rpc('bulk_update_activities', { p_event_id: eventId, p_updates: updates })
      if (error) {
        fail(error)
        return false
      }
      const byId = new Map(updates.map((u) => [u.id, u]))
      setData((d) => ({ ...d, activities: d.activities.map((a) => (byId.has(a.id) ? { ...a, ...byId.get(a.id)! } : a)) }))
      return true
    },
    [eventId, fail],
  )

  const addPassenger = useCallback<EventApi['addPassenger']>(
    async (vehicleId, participantId) => {
      version.current++
      const row: RidePassenger = { event_id: eventId!, vehicle_id: vehicleId, participant_id: participantId }
      const { error } = await supabase.from('ride_passengers').upsert(row)
      if (error) {
        fail(error)
        return false
      }
      setData((d) => ({
        ...d,
        passengers: d.passengers.some((r) => r.vehicle_id === vehicleId && r.participant_id === participantId)
          ? d.passengers
          : [...d.passengers, row],
      }))
      return true
    },
    [eventId, fail],
  )

  const removePassenger = useCallback<EventApi['removePassenger']>(
    async (vehicleId, participantId) => {
      version.current++
      const { error } = await supabase.from('ride_passengers').delete().match({ vehicle_id: vehicleId, participant_id: participantId })
      if (error) {
        fail(error)
        return false
      }
      setData((d) => ({
        ...d,
        passengers: d.passengers.filter((r) => !(r.vehicle_id === vehicleId && r.participant_id === participantId)),
      }))
      return true
    },
    [fail],
  )

  const transferPassenger = useCallback<EventApi['transferPassenger']>(
    async (fromVehicle, toVehicle, participantId) => {
      const added = await addPassenger(toVehicle, participantId)
      return added && (await removePassenger(fromVehicle, participantId))
    },
    [addPassenger, removePassenger],
  )

  const copyRidesToReturn = useCallback<EventApi['copyRidesToReturn']>(async () => {
    version.current++
    try {
      const outbound = dataRef.current.vehicles.filter((v) => v.direction === 'ida')
      for (const v of outbound) {
        const { id, ...fields } = v
        const { data: created, error } = await supabase
          .from('vehicles')
          .insert({ ...fields, direction: 'volta', depart_time: null, depart_place: '' })
          .select()
          .single()
        if (error) throw error
        const riders = dataRef.current.passengers.filter((r) => r.vehicle_id === id)
        if (riders.length) {
          const { error: e2 } = await supabase
            .from('ride_passengers')
            .insert(riders.map((r) => ({ event_id: r.event_id, participant_id: r.participant_id, vehicle_id: created.id })))
          if (e2) throw e2
        }
      }
      if (eventId) await refreshData(eventId, true)
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }, [eventId, fail, refreshData])

  const togglePurchased = useCallback<EventApi['togglePurchased']>(
    async (key, purchased) => {
      version.current++
      const previous = dataRef.current.checks
      setData((d) => ({
        ...d,
        checks: purchased ? [...d.checks, { event_id: eventId!, item_key: key }] : d.checks.filter((c) => c.item_key !== key),
      }))
      const { error } = purchased
        ? await supabase.from('shopping_checks').upsert({ event_id: eventId, item_key: key })
        : await supabase.from('shopping_checks').delete().match({ event_id: eventId, item_key: key })
      if (error) {
        fail(error)
        setData((d) => ({ ...d, checks: previous }))
      }
    },
    [eventId, fail],
  )

  const retry = useCallback(() => {
    if (!events.length) void loadEvents()
    if (eventId) void refreshData(eventId)
  }, [eventId, events.length, loadEvents, refreshData])

  const value: EventApi = {
    events,
    event,
    data,
    loadingEvents,
    loadingData,
    loadError,
    retry,
    selectEvent: setEventId,
    saveEvent,
    deleteEvent,
    duplicateEvent,
    createDemoEvent,
    saveRow,
    deleteRow,
    saveMealItems,
    bulkUpdateActivities,
    addPassenger,
    removePassenger,
    transferPassenger,
    copyRidesToReturn,
    togglePurchased,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
