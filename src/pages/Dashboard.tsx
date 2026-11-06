import { AlertTriangle, CalendarClock, Car, ChevronRight, ChevronsUpDown, MapPin, PartyPopper, Pencil, Share2, Users, Utensils, UserRoundX, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EventForm, ShareModal, useNow } from '../components/shared'
import { IconButton, cx } from '../components/ui'
import { useCurrentEvent } from '../context/Event'
import { nextMeal, passengersOf, repeatedInRides, responsibleName, withoutRide } from '../lib/domain'
import { endLabel } from '../lib/export'
import { conflictPairs, currentAndNext, findConflicts, isScheduled } from '../lib/schedule'
import { dateRange, hhmm, shortDay } from '../lib/time'
import { MEAL_TYPES, type Activity } from '../lib/types'

const SHORTCUTS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/cronograma', label: 'Cronograma', icon: CalendarClock },
  { to: '/cardapio', label: 'Cardápio', icon: Utensils },
  { to: '/caronas', label: 'Caronas', icon: Car },
  { to: '/participantes', label: 'Participantes', icon: Users },
  { to: '/brincadeiras', label: 'Brincadeiras', icon: PartyPopper },
]

export default function Dashboard() {
  const { event, data } = useCurrentEvent()
  const now = useNow()
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)

  const summary = useMemo(() => {
    const { participants, activities, vehicles, passengers, meals } = data
    const active = participants.filter((p) => p.status !== 'cancelado')
    const scheduled = activities.filter((a) => isScheduled(a) && a.status !== 'cancelada')
    const unscheduled = activities.filter((a) => !isScheduled(a) && a.status !== 'cancelada')
    const conflicts = conflictPairs(findConflicts(activities))
    const overCapacity = vehicles.filter((v) => passengersOf(v.id, passengers, participants).length > v.seats).length
    return {
      active,
      scheduled,
      unscheduled,
      conflicts,
      overCapacity,
      ida: vehicles.filter((v) => v.direction === 'ida').length,
      volta: vehicles.filter((v) => v.direction === 'volta').length,
      noIda: withoutRide('ida', participants, vehicles, passengers),
      noVolta: withoutRide('volta', participants, vehicles, passengers),
      repeated: [...repeatedInRides('ida', participants, vehicles, passengers), ...repeatedInRides('volta', participants, vehicles, passengers)],
      meal: nextMeal(meals, now),
    }
  }, [data, now])

  const { current, next } = useMemo(() => currentAndNext(data.activities, now), [data.activities, now])
  const happening = now.date >= event.start_date && now.date <= event.end_date
  const finished = now.date > event.end_date

  const alerts: { icon: LucideIcon; text: string; to: string }[] = []
  if (summary.noIda.length) alerts.push({ icon: UserRoundX, text: `${count(summary.noIda.length, 'pessoa', 'pessoas')} sem carona na ida`, to: '/caronas' })
  if (summary.noVolta.length) alerts.push({ icon: UserRoundX, text: `${count(summary.noVolta.length, 'pessoa', 'pessoas')} sem carona na volta`, to: '/caronas' })
  if (summary.repeated.length) alerts.push({ icon: AlertTriangle, text: `Nomes repetidos nas caronas: ${[...new Set(summary.repeated.map((r) => r.participant.display_name))].join(', ')}`, to: '/caronas' })
  if (summary.overCapacity) alerts.push({ icon: AlertTriangle, text: `${count(summary.overCapacity, 'veículo acima', 'veículos acima')} da capacidade`, to: '/caronas' })
  if (summary.conflicts) alerts.push({ icon: AlertTriangle, text: `${count(summary.conflicts, 'possível conflito', 'possíveis conflitos')} de horário`, to: '/cronograma' })

  return (
    <div className="-mx-4 md:mx-0">
      {/* Placa do evento */}
      <section className="bg-mata-800 px-4 pt-[max(.5rem,env(safe-area-inset-top))] pb-4 text-white md:rounded-3xl md:px-6 md:pt-4">
        <div className="flex items-center">
          <Link to="/eventos" className="-ml-1 flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-musgo-200 md:invisible">
            Trocar evento
            <ChevronsUpDown size={14} />
          </Link>
          <div className="ml-auto flex">
            <IconButton icon={Share2} label="Compartilhar no WhatsApp" className="text-musgo-100 hover:bg-mata-700" onClick={() => setSharing(true)} />
            <IconButton icon={Pencil} label="Editar evento" className="text-musgo-100 hover:bg-mata-700" onClick={() => setEditing(true)} />
          </div>
        </div>
        <h1 className="font-display text-[1.85rem] leading-[1.05] font-bold tracking-tight md:text-4xl">{event.name}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm text-musgo-200">
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {event.location}
            </span>
          )}
          <span className="tnum">{dateRange(event.start_date, event.end_date)}</span>
        </p>

        <div className="mt-3 flex flex-col gap-px overflow-hidden rounded-2xl">
          {happening &&
            current.map((a) => <SignRow key={a.id} highlight label="Agora" activity={a} sub={activityLine(a, data.participants, false)} />)}
          {next ? (
            <SignRow
              label={happening ? 'Depois' : 'Próxima'}
              activity={next}
              sub={activityLine(next, data.participants, !happening || next.activity_date !== now.date)}
            />
          ) : (
            current.length === 0 && (
              <div className="bg-mata-700 px-3 py-2.5 text-sm text-musgo-100">{finished ? 'Evento encerrado.' : 'Nenhuma atividade com horário à frente.'}</div>
            )
          )}
        </div>
      </section>

      <div className="px-4 md:px-0">
        {/* Números do evento, em uma só faixa */}
        <section className="mt-3 grid grid-cols-3 divide-x divide-linha rounded-2xl border border-linha bg-white">
          <Stat to="/participantes" value={summary.active.length} label="participantes" />
          <Stat to="/cronograma" value={summary.scheduled.length} label={summary.unscheduled.length ? `atividades, mais ${summary.unscheduled.length} a programar` : 'atividades'} />
          <Stat to="/caronas" value={summary.ida} label={`veículos na ida, ${summary.volta} na volta`} />
        </section>

        <Link to="/cardapio" className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-linha bg-white px-3 py-2 hover:border-musgo-300">
          <Utensils size={18} className="shrink-0 text-mata-700" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-pedra-600">Próxima refeição</span>
            {summary.meal ? (
              <span className="block truncate font-semibold">
                {MEAL_TYPES[summary.meal.meal_type]}, {shortDay(summary.meal.meal_date)}
                {summary.meal.meal_time ? ` às ${hhmm(summary.meal.meal_time)}` : ''}: {summary.meal.description || 'A definir'}
              </span>
            ) : (
              <span className="block font-semibold">Nenhuma refeição à frente</span>
            )}
          </span>
          <ChevronRight size={17} className="shrink-0 text-pedra-400" />
        </Link>

        {/* Atalhos */}
        <nav aria-label="Módulos" className="-mx-2 mt-3 grid grid-cols-5 md:mx-0">
          {SHORTCUTS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold tracking-tight text-tinta hover:bg-musgo-50 md:text-sm md:tracking-normal">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-musgo-100 text-mata-800">
                <Icon size={20} />
              </span>
              <span className="text-center">{label}</span>
            </Link>
          ))}
        </nav>

        {alerts.length > 0 && (
          <section aria-label="Pontos de atenção" className="mt-2 flex flex-col divide-y divide-[#f2e3c4] overflow-hidden rounded-2xl bg-ambar-bg">
            {alerts.map((a) => (
              <Link key={a.text} to={a.to} className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm font-medium text-ambar">
                <a.icon size={16} className="shrink-0" />
                <span className="min-w-0 flex-1">{a.text}</span>
                <ChevronRight size={16} className="shrink-0" />
              </Link>
            ))}
          </section>
        )}
      </div>

      {editing && <EventForm event={event} onClose={() => setEditing(false)} />}
      {sharing && <ShareModal onClose={() => setSharing(false)} />}
    </div>
  )
}

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function activityLine(a: Activity, participants: Parameters<typeof responsibleName>[1], withDay: boolean) {
  const parts: string[] = []
  if (a.start_time) {
    const range = a.duration_minutes ? `${hhmm(a.start_time)} às ${endLabel(a.start_time, a.duration_minutes)}` : hhmm(a.start_time)
    parts.push(withDay && a.activity_date ? `${shortDay(a.activity_date)}, ${range}` : range)
  }
  const resp = responsibleName(a, participants)
  parts.push(resp ? `Responsável: ${resp}` : 'Sem responsável')
  return parts
}

function SignRow({ label, activity, sub, highlight }: { label: string; activity: Activity; sub: string[]; highlight?: boolean }) {
  return (
    <Link to="/cronograma" className={cx('flex items-start gap-3 px-3 py-2.5', highlight ? 'bg-musgo-100 text-mata-900' : 'bg-mata-700 text-white hover:bg-mata-600')}>
      <span className={cx('w-14 shrink-0 pt-0.5 text-sm font-bold', highlight ? 'text-mata-700' : 'text-musgo-200')}>{label}</span>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-semibold">{activity.title}</span>
        <span className={cx('mt-0.5 flex flex-wrap gap-x-3 text-[13px] tnum', highlight ? 'text-mata-700' : 'text-musgo-200')}>
          {sub.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </span>
      </span>
    </Link>
  )
}

function Stat({ to, value, label }: { to: string; value: number; label: string }) {
  return (
    <Link to={to} className="min-w-0 px-3 py-2.5 first:rounded-l-2xl last:rounded-r-2xl hover:bg-musgo-50">
      <span className="block font-display text-2xl leading-none font-bold text-mata-800 tnum">{value}</span>
      <span className="mt-1 block text-xs leading-tight text-pedra-600">{label}</span>
    </Link>
  )
}
