import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, CalendarClock, Check, Copy, FileDown, GripVertical, Layers, Printer, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { PersonField, useNow } from '../components/shared'
import { Button, DurationInput, Empty, Fab, Field, FilterChip, IconButton, Modal, Notice, PageTitle, Tag, TimeInput, cx, inputClass } from '../components/ui'
import { useCurrentEvent } from '../context/Event'
import { useFeedback } from '../context/Feedback'
import { responsibleName } from '../lib/domain'
import { downloadSchedulePdf, endLabel } from '../lib/export'
import { conflictPairs, findConflicts, followingActivities, isRunning, isScheduled, planDrop, shiftActivities, sortActivities, startAbs, toUpdate, endAbs, type Scheduled } from '../lib/schedule'
import { dateRange, daysInRange, formatDuration, hhmm, longDay, shortDay, type Now } from '../lib/time'
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUS, categoryColor, type Activity, type ActivityStatus } from '../lib/types'

type View = 'todos' | 'programar' | string

export default function Schedule() {
  const { event, data, saveRow, bulkUpdateActivities } = useCurrentEvent()
  const { ask, toast } = useFeedback()
  const now = useNow()
  const [view, setView] = useState<View>(() => (now.date >= event.start_date && now.date <= event.end_date ? now.date : 'todos'))
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const sorted = useMemo(() => sortActivities(data.activities), [data.activities])
  const conflicts = useMemo(() => findConflicts(data.activities), [data.activities])
  const scheduled = useMemo(() => sorted.filter(isScheduled), [sorted])
  const unscheduled = useMemo(() => sorted.filter((a) => !isScheduled(a)), [sorted])
  const days = useMemo(() => {
    const set = new Set([...daysInRange(event.start_date, event.end_date), ...scheduled.map((a) => a.activity_date)])
    return [...set].sort()
  }, [event.start_date, event.end_date, scheduled])
  const pairs = conflictPairs(conflicts)

  const handleDrop = async (group: Activity[], from: number, to: number) => {
    const plan = planDrop(group, from, to)
    if (!plan.needsDecision) {
      await bulkUpdateActivities(plan.order.map(toUpdate))
      return
    }
    const options: { label: string; value: 'only' | 'push'; variant?: 'primary' | 'soft' }[] = [
      { label: `Só esta atividade: começar às ${hhmm(plan.moved.start_time)}`, value: 'only' },
    ]
    const pushedMoved = plan.pushed.find((a) => a.id === plan.moved.id)
    if (plan.pushedCount > 0) {
      options.push({
        label: `Começar às ${hhmm(pushedMoved?.start_time)} e empurrar ${plan.pushedCount === 1 ? 'a seguinte' : `as ${plan.pushedCount} seguintes`}`,
        value: 'push',
        variant: 'soft',
      })
    }
    const answer = await ask({
      title: 'Ajustar o horário?',
      message: `"${plan.moved.title}" está fora da ordem dos horários nessa posição.`,
      options,
    })
    if (!answer) return
    await bulkUpdateActivities((answer === 'only' ? plan.onlyMoved : plan.pushed).map(toUpdate))
    toast('Cronograma atualizado')
  }

  const toggleDone = async (a: Activity) => {
    const status: ActivityStatus = a.status === 'concluida' || a.status === 'cancelada' ? 'pendente' : 'concluida'
    const saved = await saveRow('activities', { id: a.id, status })
    if (saved && a.game_id && status === 'concluida') await saveRow('games', { id: a.game_id, done: true })
  }

  const exportPdf = async () => {
    setPdfBusy(true)
    try {
      await downloadSchedulePdf(event, data)
    } catch {
      toast('Não foi possível gerar o PDF. Tente de novo.', 'error')
    }
    setPdfBusy(false)
  }

  const visibleDays = view === 'todos' ? days.filter((d) => scheduled.some((a) => a.activity_date === d)) : days.filter((d) => d === view)
  const showUnscheduled = view === 'todos' || view === 'programar'
  const nothing = data.activities.length === 0

  const rowProps = { participants: data.participants, conflicts, now, onOpen: setEditing, onToggle: toggleDone }

  return (
    <div>
      <div className="print:hidden">
        <PageTitle title="Cronograma">
          <IconButton icon={FileDown} label="Exportar PDF" disabled={pdfBusy} onClick={() => void exportPdf()} />
          <IconButton icon={Printer} label="Imprimir" onClick={() => window.print()} />
        </PageTitle>

        <div className="scroll-x -mx-4 mb-3 flex gap-1.5 px-4 md:mx-0 md:px-0">
          <FilterChip active={view === 'todos'} onClick={() => setView('todos')}>
            Todos
          </FilterChip>
          {days.map((d) => (
            <FilterChip key={d} active={view === d} onClick={() => setView(d)}>
              <span className="tnum">{shortDay(d)}</span>
            </FilterChip>
          ))}
          <FilterChip active={view === 'programar'} onClick={() => setView('programar')}>
            A programar
            <span className="tnum opacity-70">{unscheduled.length}</span>
          </FilterChip>
        </div>

        {pairs > 0 && view !== 'programar' && (
          <div className="mb-3">
            <Notice icon={AlertTriangle}>
              {pairs === 1 ? '1 possível conflito de horário' : `${pairs} possíveis conflitos de horário`}. Se for de propósito, marque a atividade como simultânea.
            </Notice>
          </div>
        )}

        {nothing ? (
          <Empty icon={CalendarClock} title="Nenhuma atividade ainda" text="Adicione a primeira atividade do acampamento." />
        ) : (
          <>
            {visibleDays.map((day) => {
              const group = scheduled.filter((a) => a.activity_date === day)
              return (
                <section key={day} className="mb-4">
                  {view === 'todos' && <h2 className="mb-1 font-display text-lg font-bold text-mata-900">{longDay(day)}</h2>}
                  {group.length ? (
                    <SortableGroup group={group} onDrop={handleDrop}>
                      {group.map((a, i) => (
                        <TimelineRow key={a.id} activity={a} first={i === 0} last={i === group.length - 1} previous={group[i - 1]} {...rowProps} />
                      ))}
                    </SortableGroup>
                  ) : (
                    <p className="rounded-xl bg-musgo-50 px-3 py-4 text-center text-sm text-pedra-600">Nenhuma atividade neste dia.</p>
                  )}
                </section>
              )
            })}

            {showUnscheduled && (
              <section className="mb-4">
                {view === 'todos' && unscheduled.length > 0 && <h2 className="mb-1 font-display text-lg font-bold text-mata-900">A programar</h2>}
                {unscheduled.length ? (
                  <SortableGroup group={unscheduled} onDrop={handleDrop}>
                    <div className="divide-y divide-linha rounded-2xl border border-dashed border-musgo-300 bg-white">
                      {unscheduled.map((a) => (
                        <UnscheduledRow key={a.id} activity={a} {...rowProps} />
                      ))}
                    </div>
                  </SortableGroup>
                ) : (
                  view === 'programar' && <p className="rounded-xl bg-musgo-50 px-3 py-4 text-center text-sm text-pedra-600">Tudo já tem dia e horário.</p>
                )}
              </section>
            )}
          </>
        )}

        <Fab label="Nova atividade" onClick={() => setEditing('new')} />
      </div>

      <PrintView />

      {editing && (
        <ActivityForm
          activity={editing === 'new' ? undefined : editing}
          defaultDate={view !== 'todos' && view !== 'programar' ? view : view === 'programar' ? '' : (days[0] ?? '')}
          days={days}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ---------- Arrastar ----------

function SortableGroup({ group, onDrop, children }: { group: Activity[]; onDrop: (group: Activity[], from: number, to: number) => void; children: React.ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = group.findIndex((a) => a.id === active.id)
    const to = group.findIndex((a) => a.id === over.id)
    if (from >= 0 && to >= 0) onDrop(group, from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={group.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

function useRowSort(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return {
    setNodeRef,
    style: { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 5 : undefined, position: 'relative' as const },
    isDragging,
    handleProps: { ...attributes, ...listeners },
  }
}

function DragHandle({ props, title, dark }: { props: object; title: string; dark?: boolean }) {
  return (
    <button type="button" {...props} aria-label={`Arrastar ${title}`} className={cx('flex w-9 shrink-0 cursor-grab touch-none items-center justify-center self-stretch rounded-lg active:cursor-grabbing', dark ? 'text-musgo-300' : 'text-pedra-400 hover:text-pedra-600')}>
      <GripVertical size={17} />
    </button>
  )
}

// ---------- Linhas ----------

interface RowProps {
  activity: Activity
  participants: Parameters<typeof responsibleName>[1]
  conflicts: Map<string, Activity[]>
  now: Now
  onOpen: (a: Activity) => void
  onToggle: (a: Activity) => void
}

function ConflictLine({ activity, conflicts, dark }: { activity: Activity; conflicts: Map<string, Activity[]>; dark?: boolean }) {
  const list = conflicts.get(activity.id)
  if (!list?.length) return null
  return (
    <span className={cx('mt-0.5 flex items-start gap-1 text-[13px] font-medium', dark ? 'text-[#f3cf8f]' : 'text-ambar')}>
      <AlertTriangle size={13} className="mt-[3px] shrink-0" />
      <span>
        Possível conflito com {list[0].title}
        {list.length > 1 ? ` e mais ${list.length - 1}` : ''}
      </span>
    </span>
  )
}

function Meta({ activity, participants, dark }: { activity: Activity; participants: RowProps['participants']; dark?: boolean }) {
  const resp = responsibleName(activity, participants)
  return (
    <span className={cx('flex flex-wrap items-center gap-x-2.5 text-[13px]', dark ? 'text-musgo-200' : 'text-pedra-600')}>
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-[3px]" style={{ background: dark ? '#CFE0CF' : categoryColor(activity.category) }} aria-hidden />
        {activity.category}
      </span>
      {activity.duration_minutes > 0 && <span className="tnum">{formatDuration(activity.duration_minutes)}</span>}
      {resp && <span>{resp}</span>}
      {activity.allow_overlap && (
        <span className="inline-flex items-center gap-0.5">
          <Layers size={12} />
          Simultânea
        </span>
      )}
      {activity.requirements && <span className="truncate">{activity.requirements}</span>}
    </span>
  )
}

function TimelineRow({ activity: a, participants, conflicts, now, onOpen, onToggle, first, last, previous }: RowProps & { first: boolean; last: boolean; previous?: Activity }) {
  const sort = useRowSort(a.id)
  const running = isRunning(a, now)
  const done = a.status === 'concluida'
  const cancelled = a.status === 'cancelada'
  const milestone = a.duration_minutes === 0
  const s = a as Scheduled
  // Trilha tracejada indica um intervalo livre antes desta atividade.
  const gap = previous && isScheduled(previous) && startAbs(s) > endAbs(previous)

  return (
    <div ref={sort.setNodeRef} style={sort.style} className={cx('group flex items-stretch', sort.isDragging && 'rounded-xl bg-white opacity-95 shadow-lg')}>
      <button type="button" onClick={() => onOpen(a)} className={cx('w-[3.1rem] shrink-0 pt-2 pr-1 text-right tnum', running && 'font-semibold')} tabIndex={-1} aria-hidden>
        <span className={cx('block text-[15px] leading-tight font-bold', done || cancelled ? 'text-pedra-400' : 'text-mata-900')}>{hhmm(a.start_time)}</span>
        {!milestone && <span className="block text-xs leading-tight text-pedra-600">{endLabel(s.start_time, a.duration_minutes)}</span>}
      </button>

      {/* A trilha */}
      <div className="relative w-9 shrink-0">
        {!first && <span className={cx('absolute top-0 left-1/2 h-[1.15rem] -translate-x-1/2 border-l-2', gap ? 'border-dashed border-musgo-300' : 'border-musgo-300')} />}
        {!last && <span className="absolute top-[1.15rem] bottom-0 left-1/2 -translate-x-1/2 border-l-2 border-musgo-300" />}
        <button
          type="button"
          onClick={() => onToggle(a)}
          aria-label={done ? `Reabrir ${a.title}` : `Concluir ${a.title}`}
          aria-pressed={done}
          className="absolute top-[.05rem] left-1/2 flex size-9 -translate-x-1/2 items-center justify-center"
        >
          <span
            className={cx(
              'flex items-center justify-center border-2 transition-colors',
              milestone ? 'size-3.5 rotate-45 rounded-[3px]' : 'size-[1.15rem] rounded-full',
              done ? 'border-mata-700 bg-mata-700 text-white' : running ? 'border-mata-800 bg-mata-800 ring-4 ring-musgo-200' : cancelled ? 'border-pedra-400 bg-pedra-400 text-white' : 'border-mata-700 bg-papel group-hover:bg-musgo-100',
            )}
          >
            {done && !milestone && <Check size={12} strokeWidth={3.5} />}
            {cancelled && !milestone && <X size={12} strokeWidth={3.5} />}
          </span>
        </button>
      </div>

      <div className={cx('mb-1 flex min-w-0 flex-1 rounded-xl', running && 'bg-mata-800 text-white')}>
        <button type="button" onClick={() => onOpen(a)} className={cx('min-h-11 min-w-0 flex-1 py-1.5 text-left', running ? 'pl-3' : 'pl-1')}>
          <span className={cx('block leading-snug font-semibold', (done || cancelled) && 'text-pedra-600', cancelled && 'line-through')}>
            {a.title}
            {running && <span className="ml-1.5 inline-block rounded-md bg-musgo-200 px-1.5 text-xs font-bold text-mata-900">Agora</span>}
            {a.status === 'em_andamento' && !running && <Tag tone="green">Em andamento</Tag>}
          </span>
          <Meta activity={a} participants={participants} dark={running} />
          <ConflictLine activity={a} conflicts={conflicts} dark={running} />
        </button>
        <DragHandle props={sort.handleProps} title={a.title} dark={running} />
      </div>
    </div>
  )
}

function UnscheduledRow({ activity: a, participants, conflicts, onOpen, onToggle }: RowProps) {
  const sort = useRowSort(a.id)
  const done = a.status === 'concluida'
  const cancelled = a.status === 'cancelada'
  return (
    <div ref={sort.setNodeRef} style={sort.style} className={cx('flex items-stretch bg-white first:rounded-t-2xl last:rounded-b-2xl', sort.isDragging && 'shadow-lg')}>
      <button type="button" onClick={() => onToggle(a)} aria-label={done ? `Reabrir ${a.title}` : `Concluir ${a.title}`} aria-pressed={done} className="flex w-11 shrink-0 items-center justify-center">
        <span className={cx('flex size-[1.15rem] items-center justify-center rounded-full border-2', done ? 'border-mata-700 bg-mata-700 text-white' : 'border-dashed border-pedra-400')}>
          {done && <Check size={12} strokeWidth={3.5} />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(a)} className="min-h-12 min-w-0 flex-1 py-2 text-left">
        <span className={cx('block leading-snug font-semibold', (done || cancelled) && 'text-pedra-600', cancelled && 'line-through')}>{a.title}</span>
        <Meta activity={a} participants={participants} />
        {a.activity_date && <span className="text-[13px] text-pedra-600">{shortDay(a.activity_date)}, sem horário</span>}
        <ConflictLine activity={a} conflicts={conflicts} />
      </button>
      <DragHandle props={sort.handleProps} title={a.title} />
    </div>
  )
}

// ---------- Formulário ----------

function ActivityForm({ activity, defaultDate, days, onClose }: { activity?: Activity; defaultDate: string; days: string[]; onClose: () => void }) {
  const { data, saveRow, deleteRow, bulkUpdateActivities } = useCurrentEvent()
  const { ask, confirmDelete, toast } = useFeedback()
  const [title, setTitle] = useState(activity?.title ?? '')
  const [date, setDate] = useState(activity ? (activity.activity_date ?? '') : defaultDate)
  const [time, setTime] = useState(hhmm(activity?.start_time))
  const [duration, setDuration] = useState(activity?.duration_minutes ?? 30)
  const [person, setPerson] = useState({ participantId: activity?.responsible_participant_id ?? null, name: activity?.responsible_name ?? '' })
  const [description, setDescription] = useState(activity?.description ?? '')
  const [category, setCategory] = useState(activity?.category ?? 'Logística')
  const [requirements, setRequirements] = useState(activity?.requirements ?? '')
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'pendente')
  const [overlap, setOverlap] = useState(activity?.allow_overlap ?? false)
  const [busy, setBusy] = useState(false)

  const dayOptions = useMemo(() => [...new Set([...days, ...(date ? [date] : [])])].sort(), [days, date])
  const categories = useMemo(() => {
    const names = ACTIVITY_CATEGORIES.map((c) => c.name)
    return names.includes(category) ? names : [category, ...names]
  }, [category])

  const buildRow = () => ({
    title: title.trim(),
    activity_date: date || null,
    start_time: date && time ? time : null,
    duration_minutes: duration,
    responsible_participant_id: person.participantId,
    responsible_name: person.name.trim(),
    description: description.trim(),
    category,
    requirements: requirements.trim(),
    status,
    allow_overlap: overlap,
  })

  const nextSort = () => data.activities.reduce((max, a) => Math.max(max, a.sort_order), 0) + 10

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const row = buildRow()
    let toShift: Activity[] = []

    // Mudou a duração: o usuário decide o que acontece com as próximas.
    if (activity && row.start_time && row.activity_date && duration !== activity.duration_minutes) {
      const edited = { ...activity, ...row } as Scheduled
      const following = followingActivities(data.activities, edited, activity.duration_minutes)
      if (following.length) {
        const delta = duration - activity.duration_minutes
        const shifted = shiftActivities(following, delta)
        const preview = shifted.slice(0, 4)
        const answer = await ask<'keep' | 'shift'>({
          title: 'A duração mudou',
          message: (
            <>
              <p>
                "{row.title}" passa de {formatDuration(activity.duration_minutes)} para {formatDuration(duration)}. O que fazer com {following.length === 1 ? 'a próxima atividade do dia' : `as ${following.length} próximas atividades do dia`}?
              </p>
              <ul className="mt-2 rounded-xl bg-musgo-50 px-3 py-2 text-sm tnum">
                {preview.map((a) => (
                  <li key={a.id}>
                    {hhmm(following.find((f) => f.id === a.id)?.start_time)} passaria para {hhmm(a.start_time)}: {a.title}
                  </li>
                ))}
                {shifted.length > preview.length && <li>e mais {shifted.length - preview.length}</li>}
              </ul>
            </>
          ),
          options: [
            { label: 'Manter os horários das próximas', value: 'keep' },
            { label: 'Recalcular os horários das próximas', value: 'shift', variant: 'soft' },
          ],
        })
        if (!answer) return
        if (answer === 'shift') toShift = shifted
      }
    }

    setBusy(true)
    const saved = await saveRow('activities', activity ? { ...row, id: activity.id } : { ...row, sort_order: nextSort() })
    if (saved && activity?.game_id && status === 'concluida') await saveRow('games', { id: activity.game_id, done: true })
    const ok = saved && (toShift.length ? await bulkUpdateActivities(toShift.map(toUpdate)) : true)
    setBusy(false)
    if (ok) {
      toast(activity ? 'Atividade salva' : 'Atividade adicionada')
      onClose()
    }
  }

  const duplicate = async () => {
    if (!activity) return
    setBusy(true)
    const saved = await saveRow('activities', { ...buildRow(), title: `${title.trim()} (cópia)`, status: 'pendente', game_id: activity.game_id, sort_order: activity.sort_order + 1 })
    setBusy(false)
    if (saved) {
      toast('Atividade duplicada')
      onClose()
    }
  }

  const remove = async () => {
    if (!activity) return
    if (await confirmDelete(`Excluir "${activity.title}"?`, 'Esta atividade sai do cronograma. As demais não mudam.')) {
      if (await deleteRow('activities', activity.id)) {
        toast('Atividade excluída')
        onClose()
      }
    }
  }

  const end = date && time ? endLabel(time, duration) : ''

  return (
    <Modal
      title={activity ? 'Editar atividade' : 'Nova atividade'}
      onClose={onClose}
      headerActions={
        activity && (
          <>
            <IconButton icon={Copy} label="Duplicar atividade" onClick={() => void duplicate()} />
            <IconButton icon={Trash2} label="Excluir atividade" variant="dangerSoft" onClick={() => void remove()} />
          </>
        )
      }
      footer={
        <Button type="submit" form="activity-form" block busy={busy} disabled={!title.trim()}>
          {activity ? 'Salvar atividade' : 'Adicionar atividade'}
        </Button>
      }
    >
      <form id="activity-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nome da atividade">
          <input data-autofocus={activity ? undefined : true} className={inputClass} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia">
            <select
              className={inputClass}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                if (!e.target.value) setTime('')
              }}
            >
              <option value="">A programar</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {shortDay(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Início" hint={!date ? 'Escolha o dia primeiro.' : !time ? 'Vazio fica em "A programar".' : undefined}>
            <TimeInput disabled={!date} value={time} onChange={setTime} />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-[13px] font-semibold text-pedra-600">Duração</span>
          <DurationInput value={duration} onChange={setDuration} />
          <p className="mt-1 text-[13px] text-pedra-600 tnum" data-testid="end-time">
            {end ? (duration ? `Termina às ${end}` : 'Sem duração: aparece como aviso ou marco do evento.') : duration ? '' : 'Sem duração: aviso ou marco do evento.'}
          </p>
        </div>
        <PersonField label="Responsável" participants={data.participants} participantId={person.participantId} name={person.name} onChange={setPerson} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus)}>
              {Object.entries(ACTIVITY_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Descrição ou observações">
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Requisitos ou especialidades (opcional)">
          <input className={inputClass} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
        </Field>
        <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
          <input type="checkbox" className="size-5 shrink-0 accent-mata-800" checked={overlap} onChange={(e) => setOverlap(e.target.checked)} />
          Simultânea de propósito (não avisar conflito)
        </label>
      </form>
    </Modal>
  )
}

// ---------- Impressão ----------

function PrintView() {
  const { event, data } = useCurrentEvent()
  const sorted = sortActivities(data.activities)
  const scheduled = sorted.filter(isScheduled)
  const unscheduled = sorted.filter((a) => !isScheduled(a))
  const days = [...new Set(scheduled.map((a) => a.activity_date))]
  const cell = 'border-b border-neutral-300 py-1 pr-3 align-top'
  return (
    <div className="hidden text-[12px] text-black print:block">
      <h1 className="font-display text-2xl font-bold">{event.name}</h1>
      <p className="mb-3">
        {event.location}
        {event.location ? ', ' : ''}
        {dateRange(event.start_date, event.end_date)}
      </p>
      {days.map((day) => (
        <section key={day} className="mb-4 break-inside-avoid-page">
          <h2 className="mb-1 text-base font-bold">{longDay(day)}</h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {['Início', 'Término', 'Duração', 'Atividade', 'Responsável', 'Status'].map((h) => (
                  <th key={h} className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tnum">
              {scheduled
                .filter((a) => a.activity_date === day)
                .map((a) => (
                  <tr key={a.id}>
                    <td className={cell}>{hhmm(a.start_time)}</td>
                    <td className={cell}>{a.duration_minutes ? endLabel(a.start_time, a.duration_minutes) : ''}</td>
                    <td className={cell}>{a.duration_minutes ? formatDuration(a.duration_minutes) : ''}</td>
                    <td className={cell}>
                      {a.title}
                      {a.description && <div className="text-neutral-600">{a.description}</div>}
                    </td>
                    <td className={cell}>{responsibleName(a, data.participants)}</td>
                    <td className={cell}>{ACTIVITY_STATUS[a.status]}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
      {unscheduled.length > 0 && (
        <section>
          <h2 className="mb-1 text-base font-bold">A programar</h2>
          <ul className="list-disc pl-5">
            {unscheduled.map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
