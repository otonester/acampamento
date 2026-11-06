import { CalendarPlus, Check, Clock, PackageOpen, PartyPopper, Search, Trash2, User } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { PersonField } from '../components/shared'
import { Button, DurationInput, Empty, Fab, Field, IconButton, Modal, PageTitle, Tag, TimeInput, cx, inputClass } from '../components/ui'
import { useCurrentEvent } from '../context/Event'
import { useFeedback } from '../context/Feedback'
import { normalize, responsibleName } from '../lib/domain'
import { daysInRange, formatDuration, hhmm, shortDay } from '../lib/time'
import type { Game } from '../lib/types'

export default function Games() {
  const { data, saveRow } = useCurrentEvent()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Game | 'new' | null>(null)
  const [scheduling, setScheduling] = useState<Game | null>(null)

  const list = useMemo(() => {
    const q = normalize(query)
    return data.games
      .filter((g) => !q || normalize(`${g.name} ${g.description} ${g.materials}`).includes(q))
      .sort((a, b) => Number(a.done) - Number(b.done) || a.sort_order - b.sort_order)
  }, [data.games, query])

  return (
    <div>
      <PageTitle title="Atividades e brincadeiras" />
      <div className="relative mb-3">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pedra-400" />
        <input aria-label="Buscar atividades" className={cx(inputClass, 'pl-9')} placeholder="Buscar atividades" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {data.games.length === 0 ? (
        <Empty icon={PartyPopper} title="Nenhuma ideia ainda" text="Guarde aqui as brincadeiras e leve para o cronograma quando decidir o horário." />
      ) : list.length === 0 ? (
        <p className="rounded-xl bg-musgo-50 px-3 py-6 text-center text-sm text-pedra-600">Nada encontrado para essa busca.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.map((g) => {
            const linked = data.activities.filter((a) => a.game_id === g.id)
            const resp = responsibleName(g, data.participants)
            return (
              <li key={g.id} className="flex items-stretch rounded-2xl border border-linha bg-white">
                <button type="button" aria-pressed={g.done} aria-label={g.done ? `Desmarcar ${g.name} como realizada` : `Marcar ${g.name} como realizada`} onClick={() => void saveRow('games', { id: g.id, done: !g.done })} className="flex w-11 shrink-0 items-center justify-center">
                  <span className={cx('flex size-5 items-center justify-center rounded-full border-2', g.done ? 'border-mata-700 bg-mata-700 text-white' : 'border-pedra-400')}>{g.done && <Check size={13} strokeWidth={3} />}</span>
                </button>
                <button type="button" onClick={() => setEditing(g)} className="min-w-0 flex-1 py-2 text-left">
                  <span className={cx('block font-semibold', g.done && 'text-pedra-600 line-through')}>{g.name}</span>
                  {g.description && <span className="block text-sm leading-snug text-pedra-600">{g.description}</span>}
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-pedra-600">
                    {g.duration_minutes != null && g.duration_minutes > 0 && (
                      <span className="inline-flex items-center gap-1 tnum">
                        <Clock size={12} />
                        {formatDuration(g.duration_minutes)}
                      </span>
                    )}
                    {g.materials && (
                      <span className="inline-flex items-center gap-1">
                        <PackageOpen size={12} />
                        {g.materials}
                      </span>
                    )}
                    {resp && (
                      <span className="inline-flex items-center gap-1">
                        <User size={12} />
                        {resp}
                      </span>
                    )}
                    {linked.map((a) => (
                      <Tag key={a.id} tone="green">
                        {a.activity_date && a.start_time ? `${shortDay(a.activity_date)} às ${hhmm(a.start_time)}` : 'A programar'}
                      </Tag>
                    ))}
                  </span>
                </button>
                <IconButton icon={CalendarPlus} label={`Adicionar ${g.name} ao cronograma`} className="self-center" onClick={() => setScheduling(g)} />
              </li>
            )
          })}
        </ul>
      )}

      <Fab label="Nova brincadeira" onClick={() => setEditing('new')} />

      {editing && <GameForm game={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {scheduling && <ScheduleGame game={scheduling} onClose={() => setScheduling(null)} />}
    </div>
  )
}

function GameForm({ game, onClose }: { game?: Game; onClose: () => void }) {
  const { data, saveRow, deleteRow } = useCurrentEvent()
  const { confirmDelete, toast } = useFeedback()
  const [name, setName] = useState(game?.name ?? '')
  const [description, setDescription] = useState(game?.description ?? '')
  const [materials, setMaterials] = useState(game?.materials ?? '')
  const [duration, setDuration] = useState(game?.duration_minutes ?? 0)
  const [person, setPerson] = useState({ participantId: game?.responsible_participant_id ?? null, name: game?.responsible_name ?? '' })
  const [notes, setNotes] = useState(game?.notes ?? '')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const row = {
      name: name.trim(),
      description: description.trim(),
      materials: materials.trim(),
      duration_minutes: duration || null,
      responsible_participant_id: person.participantId,
      responsible_name: person.name.trim(),
      notes: notes.trim(),
    }
    const saved = await saveRow('games', game ? { ...row, id: game.id } : { ...row, sort_order: (data.games.length + 1) * 10 })
    setBusy(false)
    if (saved) {
      toast(game ? 'Brincadeira salva' : 'Brincadeira adicionada')
      onClose()
    }
  }

  const remove = async () => {
    if (!game) return
    const linked = data.activities.filter((a) => a.game_id === game.id).length
    if ((await confirmDelete(`Excluir "${game.name}"?`, linked ? 'A atividade já adicionada ao cronograma continua lá.' : undefined)) && (await deleteRow('games', game.id))) {
      toast('Brincadeira excluída')
      onClose()
    }
  }

  return (
    <Modal
      title={game ? 'Editar brincadeira' : 'Nova brincadeira'}
      onClose={onClose}
      headerActions={game && <IconButton icon={Trash2} label="Excluir brincadeira" variant="dangerSoft" onClick={() => void remove()} />}
      footer={
        <Button type="submit" form="game-form" block busy={busy} disabled={!name.trim()}>
          {game ? 'Salvar brincadeira' : 'Adicionar brincadeira'}
        </Button>
      }
    >
      <form id="game-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nome">
          <input data-autofocus={game ? undefined : true} className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Descrição">
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Materiais necessários">
          <input className={inputClass} value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1 block text-[13px] font-semibold text-pedra-600">Duração estimada</span>
          <DurationInput value={duration} onChange={setDuration} />
        </div>
        <PersonField label="Responsável (opcional)" participants={data.participants} participantId={person.participantId} name={person.name} onChange={setPerson} />
        <Field label="Observações">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

function ScheduleGame({ game, onClose }: { game: Game; onClose: () => void }) {
  const { event, data, saveRow } = useCurrentEvent()
  const { toast } = useFeedback()
  const days = daysInRange(event.start_date, event.end_date)
  const [date, setDate] = useState(days[0])
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(game.duration_minutes ?? 30)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const saved = await saveRow('activities', {
      title: game.name,
      activity_date: date || null,
      start_time: date && time ? time : null,
      duration_minutes: duration,
      description: game.description,
      category: 'Recreação',
      requirements: game.materials ? `Materiais: ${game.materials}` : '',
      responsible_participant_id: game.responsible_participant_id,
      responsible_name: game.responsible_name,
      game_id: game.id,
      sort_order: data.activities.reduce((max, a) => Math.max(max, a.sort_order), 0) + 10,
    })
    setBusy(false)
    if (saved) {
      toast(`${game.name} adicionada ao cronograma`)
      onClose()
    }
  }

  return (
    <Modal
      title="Adicionar ao cronograma"
      onClose={onClose}
      narrow
      footer={
        <Button type="submit" form="schedule-game" block busy={busy}>
          Adicionar ao cronograma
        </Button>
      }
    >
      <form id="schedule-game" onSubmit={submit} className="flex flex-col gap-3">
        <p className="font-semibold">{game.name}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia">
            <select className={inputClass} value={date} onChange={(e) => setDate(e.target.value)}>
              <option value="">A programar</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {shortDay(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Horário">
            <TimeInput disabled={!date} value={time} onChange={setTime} />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-[13px] font-semibold text-pedra-600">Duração</span>
          <DurationInput value={duration} onChange={setDuration} />
        </div>
      </form>
    </Modal>
  )
}
