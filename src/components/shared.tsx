import { Copy, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useEvent } from '../context/Event'
import { useFeedback } from '../context/Feedback'
import { buildWhatsAppText } from '../lib/export'
import { getNow, type Now } from '../lib/time'
import type { EventRow, Participant } from '../lib/types'
import { Button, Field, Modal, inputClass } from './ui'

export function useNow(): Now {
  const [now, setNow] = useState(() => getNow())
  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 30000)
    return () => clearInterval(id)
  }, [])
  return now
}

const MANUAL = '__manual__'

/** Escolhe um participante cadastrado ou aceita um nome digitado (ex.: motorista externo). */
export function PersonField({
  label,
  participants,
  participantId,
  name,
  onChange,
  manualLabel = 'Digitar outro nome',
  emptyLabel = 'Sem responsável',
  placeholder = 'Nome',
  error,
}: {
  label: string
  participants: Participant[]
  participantId: string | null
  name: string
  onChange: (value: { participantId: string | null; name: string }) => void
  manualLabel?: string
  emptyLabel?: string
  placeholder?: string
  error?: string
}) {
  const [manual, setManual] = useState(!participantId && !!name)
  const sorted = useMemo(
    () => [...participants].filter((p) => p.status !== 'cancelado' || p.id === participantId).sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt-BR')),
    [participants, participantId],
  )
  return (
    <Field label={label} error={error}>
      <select
        className={inputClass}
        value={manual ? MANUAL : (participantId ?? '')}
        onChange={(e) => {
          const v = e.target.value
          if (v === MANUAL) {
            setManual(true)
            onChange({ participantId: null, name })
          } else {
            setManual(false)
            onChange({ participantId: v || null, name: '' })
          }
        }}
      >
        <option value="">{emptyLabel}</option>
        {sorted.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
        <option value={MANUAL}>{manualLabel}</option>
      </select>
      {manual && (
        <input
          className={`${inputClass} mt-2`}
          placeholder={placeholder}
          aria-label={placeholder}
          value={name}
          onChange={(e) => onChange({ participantId: null, name: e.target.value })}
        />
      )}
    </Field>
  )
}

export function EventForm({ event, onClose, onSaved }: { event?: EventRow; onClose: () => void; onSaved?: (saved: EventRow) => void }) {
  const { saveEvent } = useEvent()
  const { toast } = useFeedback()
  const today = getNow().date
  const [name, setName] = useState(event?.name ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [start, setStart] = useState(event?.start_date ?? today)
  const [end, setEnd] = useState(event?.end_date ?? today)
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const invalidDates = end < start

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || invalidDates) return
    setBusy(true)
    const saved = await saveEvent({ id: event?.id, name: name.trim(), location: location.trim(), start_date: start, end_date: end, notes })
    setBusy(false)
    if (saved) {
      toast(event ? 'Evento salvo' : 'Evento criado')
      onSaved?.(saved)
      onClose()
    }
  }

  return (
    <Modal
      title={event ? 'Editar evento' : 'Novo evento'}
      onClose={onClose}
      footer={
        <Button type="submit" form="event-form" block busy={busy} disabled={!name.trim() || invalidDates}>
          {event ? 'Salvar evento' : 'Criar evento'}
        </Button>
      }
    >
      <form id="event-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nome do evento">
          <input data-autofocus className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Local">
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início">
            <input
              className={inputClass}
              type="date"
              required
              value={start}
              onChange={(e) => {
                const value = e.target.value
                if (end < value) setEnd(value)
                setStart(value)
              }}
            />
          </Field>
          <Field label="Término" error={invalidDates ? 'Anterior ao início.' : undefined}>
            <input className={inputClass} type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Observações">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

export function ShareModal({ onClose }: { onClose: () => void }) {
  const { event, data } = useEvent()
  const { toast } = useFeedback()
  const [schedule, setSchedule] = useState(true)
  const [menu, setMenu] = useState(true)
  const [rides, setRides] = useState(false)
  const text = useMemo(() => (event ? buildWhatsAppText(event, data, { schedule, menu, rides }) : ''), [event, data, schedule, menu, rides])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Texto copiado')
    } catch {
      toast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error')
    }
  }

  const option = (label: string, checked: boolean, set: (v: boolean) => void) => (
    <label className="flex min-h-9 items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="size-4 accent-mata-800" checked={checked} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  )

  return (
    <Modal
      title="Compartilhar resumo"
      onClose={onClose}
      footer={
        <>
          <Button variant="soft" icon={Copy} onClick={() => void copy()}>
            Copiar
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-mata-800 px-4 font-semibold text-white hover:bg-mata-700"
          >
            <MessageCircle size={18} />
            Enviar no WhatsApp
          </a>
        </>
      }
    >
      <div className="mb-2 flex flex-wrap gap-x-4">
        {option('Cronograma', schedule, setSchedule)}
        {option('Cardápio', menu, setMenu)}
        {option('Caronas', rides, setRides)}
      </div>
      <pre className="rounded-xl bg-musgo-50 p-3 font-sans text-sm break-words whitespace-pre-wrap">{text}</pre>
    </Modal>
  )
}
