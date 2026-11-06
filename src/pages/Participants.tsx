import { Download, Phone, Search, Trash2, UserRoundX, Users } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Button, Empty, Fab, Field, FilterChip, IconButton, Modal, PageTitle, Tag, cx, inputClass } from '../components/ui'
import { useCurrentEvent } from '../context/Event'
import { useFeedback } from '../context/Feedback'
import { categoryCounts, findDuplicates, isCustomCategory, matchesCategory, normalize, withoutRide } from '../lib/domain'
import { downloadParticipantsCsv } from '../lib/export'
import { PARTICIPANT_STATUS, STANDARD_CATEGORIES, type Participant, type ParticipantStatus } from '../lib/types'

type StatusFilter = ParticipantStatus | 'sem_ida' | 'sem_volta' | null

export default function Participants() {
  const { event, data } = useCurrentEvent()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>(null)
  const [editing, setEditing] = useState<Participant | 'new' | null>(null)

  const active = useMemo(() => data.participants.filter((p) => p.status !== 'cancelado'), [data.participants])
  const counts = useMemo(() => categoryCounts(active), [active])
  const noIda = useMemo(() => new Set(withoutRide('ida', data.participants, data.vehicles, data.passengers).map((p) => p.id)), [data])
  const noVolta = useMemo(() => new Set(withoutRide('volta', data.participants, data.vehicles, data.passengers).map((p) => p.id)), [data])

  const list = useMemo(() => {
    const q = normalize(query)
    return [...data.participants]
      .filter((p) => !q || normalize(p.display_name).includes(q) || normalize(p.full_name).includes(q))
      .filter((p) => !category || matchesCategory(p, category))
      .filter((p) => {
        if (!status) return true
        if (status === 'sem_ida') return noIda.has(p.id)
        if (status === 'sem_volta') return noVolta.has(p.id)
        return p.status === status
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt-BR'))
  }, [data.participants, query, category, status, noIda, noVolta])

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'confirmado', label: 'Confirmados' },
    { value: 'pendente', label: 'Pendentes' },
    { value: 'cancelado', label: 'Cancelados' },
    { value: 'sem_ida', label: `Sem ida ${noIda.size}` },
    { value: 'sem_volta', label: `Sem volta ${noVolta.size}` },
  ]

  return (
    <div>
      <PageTitle title="Participantes">
        <IconButton icon={Download} label="Exportar lista de participantes" disabled={!data.participants.length} onClick={() => downloadParticipantsCsv(event, data.participants)} />
      </PageTitle>

      <div className="relative mb-2">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pedra-400" />
        <input aria-label="Buscar por nome" className={cx(inputClass, 'pl-9')} placeholder="Buscar por nome" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="scroll-x -mx-4 mb-1.5 flex gap-1.5 px-4 md:mx-0 md:px-0">
        <FilterChip active={!category} onClick={() => setCategory(null)}>
          Todos <span className="tnum opacity-70">{active.length}</span>
        </FilterChip>
        {counts.map((c) => (
          <FilterChip key={c.name} active={category === c.name} onClick={() => setCategory(category === c.name ? null : c.name)}>
            {c.name} <span className="tnum opacity-70">{c.count}</span>
          </FilterChip>
        ))}
      </div>
      <div className="scroll-x -mx-4 mb-3 flex gap-1.5 px-4 md:mx-0 md:px-0">
        {statusChips.map((s) => (
          <FilterChip key={s.label} active={status === s.value} onClick={() => setStatus(status === s.value ? null : s.value)}>
            {s.label}
          </FilterChip>
        ))}
      </div>

      {data.participants.length === 0 ? (
        <Empty icon={Users} title="Nenhum participante ainda" text="Cadastre as pessoas para usá-las nas caronas e no cronograma." />
      ) : list.length === 0 ? (
        <p className="rounded-xl bg-musgo-50 px-3 py-6 text-center text-sm text-pedra-600">Ninguém encontrado com esses filtros.</p>
      ) : (
        <>
          <ul className="divide-y divide-linha rounded-2xl border border-linha bg-white md:grid md:grid-cols-2 md:divide-y-0">
            {list.map((p) => (
              <li key={p.id} className="md:border-b md:border-linha">
                <button type="button" onClick={() => setEditing(p)} className="flex min-h-12 w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-musgo-50">
                  <span className="min-w-0 flex-1">
                    <span className={cx('block font-semibold', p.status === 'cancelado' && 'text-pedra-400 line-through')}>{p.display_name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-pedra-600">
                      {p.categories.join(' e ') || 'Sem categoria'}
                      {p.phone && (
                        <span className="inline-flex items-center gap-0.5 tnum">
                          <Phone size={11} />
                          {p.phone}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {p.status === 'pendente' && <Tag tone="amber">Pendente</Tag>}
                    {p.status === 'cancelado' && <Tag>Cancelado</Tag>}
                    {noIda.has(p.id) && (
                      <Tag tone="amber">
                        <UserRoundX size={11} />
                        Ida
                      </Tag>
                    )}
                    {noVolta.has(p.id) && (
                      <Tag tone="amber">
                        <UserRoundX size={11} />
                        Volta
                      </Tag>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-pedra-600 tnum">
            Mostrando {list.length} de {data.participants.length}. Etiquetas Ida e Volta indicam quem está sem carona.
          </p>
        </>
      )}

      <Fab label="Novo participante" onClick={() => setEditing('new')} />

      {editing && <ParticipantForm participant={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ParticipantForm({ participant, onClose }: { participant?: Participant; onClose: () => void }) {
  const { data, saveRow, deleteRow } = useCurrentEvent()
  const { ask, confirmDelete, toast } = useFeedback()
  const [fullName, setFullName] = useState(participant?.full_name ?? '')
  const [displayName, setDisplayName] = useState(participant?.display_name ?? '')
  // Enquanto o usuário não digitar um nome de exibição próprio, ele acompanha o primeiro nome.
  const [displayTouched, setDisplayTouched] = useState(!!participant)
  const [categories, setCategories] = useState(participant?.categories.filter((c) => !isCustomCategory(c)) ?? [])
  const [customOn, setCustomOn] = useState(participant?.categories.some(isCustomCategory) ?? false)
  const [custom, setCustom] = useState(participant?.categories.filter(isCustomCategory).join(', ') ?? '')
  const [phone, setPhone] = useState(participant?.phone ?? '')
  const [guardian, setGuardian] = useState(participant?.guardian ?? '')
  const [notes, setNotes] = useState(participant?.notes ?? '')
  const [status, setStatus] = useState<ParticipantStatus>(participant?.status ?? 'confirmado')
  const [busy, setBusy] = useState(false)

  const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const full = fullName.trim()
    const display = displayName.trim() || firstName(full)
    if (!full) return

    const duplicates = findDuplicates({ id: participant?.id, full_name: full, display_name: display }, data.participants)
    if (duplicates.length) {
      const go = await ask({
        title: 'Essa pessoa já pode estar cadastrada',
        message: `Já existe: ${duplicates.map((d) => `${d.full_name}${d.categories.length ? ` (${d.categories.join(' e ')})` : ''}`).join(', ')}. Para dar mais de uma função à mesma pessoa, edite o registro existente.`,
        options: [{ label: participant ? 'Salvar mesmo assim' : 'Cadastrar mesmo assim', value: true, variant: 'soft' }],
        cancelLabel: 'Voltar e revisar',
      })
      if (!go) return
    }

    const customList = customOn ? custom.split(',').map((c) => c.trim()).filter(Boolean) : []
    const finalCategories = [...categories, ...(customOn && !customList.length ? ['Outra'] : customList)]
    const row = { full_name: full, display_name: display, categories: finalCategories, phone: phone.trim(), guardian: guardian.trim(), notes: notes.trim(), status }

    setBusy(true)
    const saved = await saveRow('participants', participant ? { ...row, id: participant.id } : row)
    setBusy(false)
    if (saved) {
      toast(participant ? 'Participante salvo' : 'Participante adicionado')
      onClose()
    }
  }

  const remove = async () => {
    if (!participant) return
    const rides = data.passengers.filter((r) => r.participant_id === participant.id).length
    const activities = data.activities.filter((a) => a.responsible_participant_id === participant.id).length
    const details = [rides ? `Sai de ${rides} ${rides === 1 ? 'carona' : 'caronas'}.` : '', activities ? `${activities} ${activities === 1 ? 'atividade fica' : 'atividades ficam'} sem responsável.` : ''].filter(Boolean).join(' ')
    if ((await confirmDelete(`Excluir ${participant.display_name}?`, details || undefined)) && (await deleteRow('participants', participant.id))) {
      toast('Participante excluído')
      onClose()
    }
  }

  const toggle = (c: string) => setCategories((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]))

  return (
    <Modal
      title={participant ? 'Editar participante' : 'Novo participante'}
      onClose={onClose}
      headerActions={participant && <IconButton icon={Trash2} label="Excluir participante" variant="dangerSoft" onClick={() => void remove()} />}
      footer={
        <Button type="submit" form="participant-form" block busy={busy} disabled={!fullName.trim()}>
          {participant ? 'Salvar participante' : 'Adicionar participante'}
        </Button>
      }
    >
      <form id="participant-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nome completo">
          <input
            data-autofocus={participant ? undefined : true}
            className={inputClass}
            required
            value={fullName}
            autoCapitalize="words"
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => {
              if (!displayTouched || !displayName.trim()) setDisplayName(firstName(fullName))
            }}
          />
        </Field>
        <Field label="Nome de exibição" hint="Como aparece nas caronas e no cronograma.">
          <input className={inputClass} value={displayName} autoCapitalize="words" onChange={(e) => {
            setDisplayTouched(true)
            setDisplayName(e.target.value)
          }} />
        </Field>
        <div>
          <span className="mb-1 block text-[13px] font-semibold text-pedra-600">Categorias (uma ou mais)</span>
          <div className="flex flex-wrap gap-1.5">
            {STANDARD_CATEGORIES.map((c) => (
              <FilterChip key={c} active={categories.includes(c)} onClick={() => toggle(c)}>
                {c}
              </FilterChip>
            ))}
            <FilterChip active={customOn} onClick={() => setCustomOn(!customOn)}>
              Outra
            </FilterChip>
          </div>
          {customOn && <input aria-label="Nome da outra categoria" className={cx(inputClass, 'mt-2')} placeholder="Ex.: Diretor, Cozinha" value={custom === 'Outra' ? '' : custom} onChange={(e) => setCustom(e.target.value)} />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone (opcional)">
            <input className={inputClass} type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ParticipantStatus)}>
              {Object.entries(PARTICIPANT_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Responsável legal (opcional)">
          <input className={inputClass} value={guardian} onChange={(e) => setGuardian(e.target.value)} />
        </Field>
        <Field label="Observações">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
