import { Check, Copy, LogOut, Pencil, Plus, Tent, Trash2, Wand2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { EventForm } from '../components/shared'
import { Button, Empty, Field, IconButton, Modal, PageTitle, Tag, cx, inputClass } from '../components/ui'
import { useEvent } from '../context/Event'
import { useFeedback } from '../context/Feedback'
import { supabase } from '../lib/supabase'
import { dateRange, getNow } from '../lib/time'
import type { EventRow } from '../lib/types'

export default function Events() {
  const { events, event: current, selectEvent, deleteEvent, createDemoEvent } = useEvent()
  const { confirmDelete, toast } = useFeedback()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [duplicating, setDuplicating] = useState<EventRow | null>(null)
  const [demoBusy, setDemoBusy] = useState(false)

  const demo = async () => {
    setDemoBusy(true)
    const id = await createDemoEvent()
    setDemoBusy(false)
    if (id) {
      toast('Evento de exemplo criado')
      navigate('/')
    }
  }

  const remove = async (e: EventRow) => {
    const ok = await confirmDelete(
      `Excluir "${e.name}"?`,
      'O cronograma, o cardápio, as caronas, os participantes e as brincadeiras deste evento serão apagados para sempre. Os outros eventos não mudam.',
      'Excluir evento',
    )
    if (ok && (await deleteEvent(e.id))) toast('Evento excluído')
  }

  return (
    <div>
      <PageTitle title="Eventos">
        <span className="md:hidden">
          <IconButton icon={LogOut} label="Sair" onClick={() => void supabase.auth.signOut()} />
        </span>
      </PageTitle>

      {events.length === 0 ? (
        <Empty
          icon={Tent}
          title="Crie seu primeiro acampamento"
          text="Comece do zero ou com um evento de exemplo, totalmente editável."
          action={
            <div className="flex flex-col gap-2">
              <Button icon={Plus} onClick={() => setCreating(true)}>
                Novo evento
              </Button>
              <Button variant="soft" icon={Wand2} busy={demoBusy} onClick={() => void demo()}>
                Criar evento de exemplo
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-linha rounded-2xl border border-linha bg-white">
            {events.map((e) => (
              <li key={e.id} className={cx('flex items-center gap-1 py-1 pr-1 pl-3', e.id === current?.id && 'bg-musgo-50 first:rounded-t-2xl last:rounded-b-2xl')}>
                <button
                  type="button"
                  className="min-h-12 min-w-0 flex-1 py-1 text-left"
                  onClick={() => {
                    selectEvent(e.id)
                    navigate('/')
                  }}
                >
                  <span className="flex flex-wrap items-center gap-x-1.5 leading-snug font-semibold">
                    <span>{e.name}</span>
                    {e.id === current?.id && (
                      <Tag tone="green">
                        <Check size={12} />
                        Aberto
                      </Tag>
                    )}
                  </span>
                  <span className="block text-sm text-pedra-600 tnum">{dateRange(e.start_date, e.end_date)}</span>
                </button>
                <IconButton icon={Copy} label={`Duplicar ${e.name}`} onClick={() => setDuplicating(e)} />
                <IconButton icon={Pencil} label={`Editar ${e.name}`} onClick={() => setEditing(e)} />
                <IconButton icon={Trash2} label={`Excluir ${e.name}`} variant="dangerSoft" onClick={() => void remove(e)} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Novo evento
            </Button>
            <Button variant="soft" icon={Wand2} busy={demoBusy} onClick={() => void demo()}>
              Criar evento de exemplo
            </Button>
          </div>
        </>
      )}

      {creating && <EventForm onClose={() => setCreating(false)} onSaved={() => navigate('/')} />}
      {editing && <EventForm event={editing} onClose={() => setEditing(null)} />}
      {duplicating && <DuplicateForm source={duplicating} onClose={() => setDuplicating(null)} />}
    </div>
  )
}

function DuplicateForm({ source, onClose }: { source: EventRow; onClose: () => void }) {
  const { duplicateEvent } = useEvent()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const [name, setName] = useState(`${source.name} (novo)`)
  const [start, setStart] = useState(getNow().date)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !start) return
    setBusy(true)
    const id = await duplicateEvent(source.id, name.trim(), start)
    setBusy(false)
    if (id) {
      toast('Evento duplicado')
      onClose()
      navigate('/')
    }
  }

  return (
    <Modal
      title="Duplicar evento"
      onClose={onClose}
      narrow
      footer={
        <Button type="submit" form="dup-form" block busy={busy}>
          Duplicar evento
        </Button>
      }
    >
      <form id="dup-form" onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-pedra-600">
          Copia tudo de "{source.name}" e ajusta as datas. Atividades voltam a pendentes, participantes a pendentes e a lista de compras recomeça.
        </p>
        <Field label="Nome do novo evento">
          <input data-autofocus className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Nova data de início">
          <input className={inputClass} type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
