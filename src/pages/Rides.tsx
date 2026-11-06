import { AlertTriangle, ArrowRightLeft, Car, Check, Clock, CopyPlus, MapPin, Plus, Search, Trash2, UserMinus, UserPlus, UserRoundX } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { PersonField } from '../components/shared'
import { Button, Empty, Fab, Field, IconButton, Modal, Notice, PageTitle, Segmented, TimeInput, cx, inputClass } from '../components/ui'
import { useCurrentEvent } from '../context/Event'
import { useFeedback } from '../context/Feedback'
import { normalize, passengersOf, repeatedInRides, withoutRide } from '../lib/domain'
import { hhmm } from '../lib/time'
import type { Direction, Participant, Vehicle } from '../lib/types'

const LABEL: Record<Direction, string> = { ida: 'ida', volta: 'volta' }

export default function Rides() {
  const { data, copyRidesToReturn } = useCurrentEvent()
  const { ask, toast } = useFeedback()
  const [direction, setDirection] = useState<Direction>('ida')
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [action, setAction] = useState<{ vehicleId: string; participant: Participant } | null>(null)
  const [assigning, setAssigning] = useState<Participant | null>(null)
  const [copying, setCopying] = useState(false)

  const vehicles = useMemo(() => data.vehicles.filter((v) => v.direction === direction), [data.vehicles, direction])
  const missing = useMemo(() => withoutRide(direction, data.participants, data.vehicles, data.passengers), [direction, data.participants, data.vehicles, data.passengers])
  const repeated = useMemo(() => repeatedInRides(direction, data.participants, data.vehicles, data.passengers), [direction, data.participants, data.vehicles, data.passengers])
  const repeatedIds = useMemo(() => new Set(repeated.map((r) => r.participant.id)), [repeated])

  const totals = useMemo(() => {
    const seats = vehicles.reduce((sum, v) => sum + v.seats, 0)
    const taken = vehicles.reduce((sum, v) => sum + passengersOf(v.id, data.passengers, data.participants).length, 0)
    return { seats, taken }
  }, [vehicles, data.passengers, data.participants])

  const copyFromIda = async () => {
    const ok = await ask({
      title: 'Copiar veículos da ida?',
      message: 'Cria veículos iguais na volta, com os mesmos passageiros. Depois disso, ida e volta são independentes.',
      options: [{ label: 'Copiar para a volta', value: true }],
    })
    if (!ok) return
    setCopying(true)
    if (await copyRidesToReturn()) toast('Veículos copiados para a volta')
    setCopying(false)
  }

  const hasIda = data.vehicles.some((v) => v.direction === 'ida')

  return (
    <div>
      <PageTitle title="Caronas" />
      <div className="mb-2">
        <Segmented
          label="Sentido"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'ida', label: 'Ida' },
            { value: 'volta', label: 'Volta' },
          ]}
        />
      </div>

      {vehicles.length > 0 && (
        <p className="mb-2 text-sm font-medium text-pedra-600 tnum">
          {vehicles.length} {vehicles.length === 1 ? 'veículo' : 'veículos'}, {totals.taken} de {totals.seats} vagas ocupadas, {Math.max(totals.seats - totals.taken, 0)} livres
        </p>
      )}

      <div className="mb-2 flex flex-col gap-2">
        {repeated.map((r) => (
          <Notice key={r.participant.id} icon={AlertTriangle}>
            <strong>{r.participant.display_name}</strong> está em {r.vehicles.length} carros: {r.vehicles.map((v) => v.driver_name).join(' e ')}. Revise e remova de onde não deve estar.
          </Notice>
        ))}
      </div>

      {missing.length > 0 && (
        <section className="mb-3 rounded-2xl bg-musgo-50 p-2.5">
          <h2 className="mb-1.5 flex items-center gap-1.5 px-0.5 text-sm font-bold text-mata-800">
            <UserRoundX size={15} />
            Sem carona na {LABEL[direction]}: {missing.length}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((p) => (
              <button key={p.id} type="button" onClick={() => setAssigning(p)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-musgo-300 bg-white pr-3 pl-2 text-sm font-semibold hover:bg-musgo-100" aria-label={`Colocar ${p.display_name} em um veículo`}>
                <Plus size={14} className="text-mata-700" />
                {p.display_name}
              </button>
            ))}
          </div>
        </section>
      )}

      {vehicles.length === 0 ? (
        <Empty
          icon={Car}
          title={`Nenhum veículo na ${LABEL[direction]}`}
          text={direction === 'volta' ? 'A volta tem cadastro próprio. Adicione os veículos ou comece a partir da ida.' : 'Adicione o primeiro veículo.'}
          action={
            direction === 'volta' && hasIda ? (
              <Button variant="soft" icon={CopyPlus} busy={copying} onClick={() => void copyFromIda()}>
                Copiar veículos da ida
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {vehicles.map((v) => (
            <VehicleCard key={v.id} vehicle={v} repeatedIds={repeatedIds} onEdit={() => setEditing(v)} onAdd={() => setPickerFor(v.id)} onPassenger={(p) => setAction({ vehicleId: v.id, participant: p })} />
          ))}
        </div>
      )}

      <Fab label="Novo veículo" onClick={() => setEditing('new')} />

      {editing && <VehicleForm vehicle={editing === 'new' ? undefined : editing} direction={direction} onClose={() => setEditing(null)} />}
      {pickerFor && <PassengerPicker vehicleId={pickerFor} direction={direction} onClose={() => setPickerFor(null)} />}
      {action && <PassengerActions {...action} direction={direction} onClose={() => setAction(null)} />}
      {assigning && <AssignVehicle participant={assigning} direction={direction} onClose={() => setAssigning(null)} onNewVehicle={() => { setAssigning(null); setEditing('new') }} />}
    </div>
  )
}

function SeatBar({ taken, seats }: { taken: number; seats: number }) {
  const over = taken > seats
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full', over ? 'bg-erro-bg' : 'bg-musgo-100')} role="presentation">
      <div className={cx('h-full rounded-full', over ? 'bg-erro' : 'bg-mata-700')} style={{ width: `${seats ? Math.min((taken / seats) * 100, 100) : taken ? 100 : 0}%` }} />
    </div>
  )
}

function seatsText(taken: number, seats: number) {
  if (taken > seats) return `${taken} de ${seats} vagas: ${taken - seats} acima da capacidade`
  return `${taken} de ${seats} vagas, ${seats - taken} ${seats - taken === 1 ? 'livre' : 'livres'}`
}

function VehicleCard({ vehicle: v, repeatedIds, onEdit, onAdd, onPassenger }: { vehicle: Vehicle; repeatedIds: Set<string>; onEdit: () => void; onAdd: () => void; onPassenger: (p: Participant) => void }) {
  const { data } = useCurrentEvent()
  const riders = passengersOf(v.id, data.passengers, data.participants)
  const over = riders.length > v.seats
  return (
    <article className={cx('rounded-2xl border bg-white p-2.5', over ? 'border-erro' : 'border-linha')}>
      <button type="button" onClick={onEdit} className="block w-full rounded-lg text-left" aria-label={`Editar veículo de ${v.driver_name}`}>
        <span className="flex items-baseline gap-2">
          <span className="truncate font-display text-[17px] font-bold text-mata-900">{v.driver_name}</span>
          {v.vehicle && <span className="truncate text-sm text-pedra-600">{v.vehicle}</span>}
        </span>
        <span className={cx('mt-0.5 flex items-center gap-1 text-[13px] font-medium tnum', over ? 'text-erro' : 'text-pedra-600')}>
          {over && <AlertTriangle size={13} />}
          {seatsText(riders.length, v.seats)}
        </span>
        <span className="my-1.5 block">
          <SeatBar taken={riders.length} seats={v.seats} />
        </span>
        {(v.depart_time || v.depart_place) && (
          <span className="mb-1.5 flex flex-wrap gap-x-3 text-[13px] text-pedra-600">
            {v.depart_time && (
              <span className="inline-flex items-center gap-1 tnum">
                <Clock size={12} />
                {hhmm(v.depart_time)}
              </span>
            )}
            {v.depart_place && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {v.depart_place}
              </span>
            )}
          </span>
        )}
        {v.notes && <span className="mb-1.5 block text-[13px] text-pedra-600">{v.notes}</span>}
      </button>
      <div className="flex flex-wrap gap-1.5">
        {riders.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPassenger(p)}
            className={cx('inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold', repeatedIds.has(p.id) ? 'bg-ambar-bg text-ambar ring-1 ring-ambar' : 'bg-musgo-100 text-mata-900 hover:bg-musgo-200')}
          >
            {repeatedIds.has(p.id) && <AlertTriangle size={13} />}
            {p.display_name}
          </button>
        ))}
        <button type="button" onClick={onAdd} aria-label={`Adicionar passageiro ao carro de ${v.driver_name}`} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-pedra-400 px-3 text-sm font-semibold text-pedra-600 hover:bg-musgo-50">
          <UserPlus size={14} />
          Passageiro
        </button>
      </div>
    </article>
  )
}

function VehicleForm({ vehicle, direction, onClose }: { vehicle?: Vehicle; direction: Direction; onClose: () => void }) {
  const { data, saveRow, deleteRow } = useCurrentEvent()
  const { confirmDelete, toast } = useFeedback()
  const [driver, setDriver] = useState({ participantId: vehicle?.driver_participant_id ?? null, name: vehicle?.driver_participant_id ? '' : (vehicle?.driver_name ?? '') })
  const [model, setModel] = useState(vehicle?.vehicle ?? '')
  const [seats, setSeats] = useState(String(vehicle?.seats ?? 4))
  const [time, setTime] = useState(hhmm(vehicle?.depart_time))
  const [place, setPlace] = useState(vehicle?.depart_place ?? '')
  const [notes, setNotes] = useState(vehicle?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)

  const driverName = driver.participantId ? (data.participants.find((p) => p.id === driver.participantId)?.display_name ?? '') : driver.name.trim()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!driverName) return
    setBusy(true)
    const row = {
      driver_name: driverName,
      driver_participant_id: driver.participantId,
      vehicle: model.trim(),
      seats: Math.max(0, Math.floor(Number(seats) || 0)),
      depart_time: time || null,
      depart_place: place.trim(),
      notes: notes.trim(),
    }
    const saved = await saveRow('vehicles', vehicle ? { ...row, id: vehicle.id } : { ...row, direction, sort_order: (data.vehicles.length + 1) * 10 })
    setBusy(false)
    if (saved) {
      toast(vehicle ? 'Veículo salvo' : 'Veículo adicionado')
      onClose()
    }
  }

  const remove = async () => {
    if (!vehicle) return
    const count = data.passengers.filter((r) => r.vehicle_id === vehicle.id).length
    const ok = await confirmDelete(`Excluir o veículo de ${vehicle.driver_name}?`, count ? `${count === 1 ? 'O passageiro volta' : `Os ${count} passageiros voltam`} para a lista de quem está sem carona.` : undefined)
    if (ok && (await deleteRow('vehicles', vehicle.id))) {
      toast('Veículo excluído')
      onClose()
    }
  }

  return (
    <Modal
      title={vehicle ? 'Editar veículo' : `Novo veículo na ${LABEL[direction]}`}
      onClose={onClose}
      headerActions={vehicle && <IconButton icon={Trash2} label="Excluir veículo" variant="dangerSoft" onClick={() => void remove()} />}
      footer={
        <Button type="submit" form="vehicle-form" block busy={busy}>
          {vehicle ? 'Salvar veículo' : 'Adicionar veículo'}
        </Button>
      }
    >
      <form id="vehicle-form" onSubmit={submit} className="flex flex-col gap-3">
        <PersonField
          label="Motorista"
          participants={data.participants}
          participantId={driver.participantId}
          name={driver.name}
          onChange={setDriver}
          emptyLabel="Escolha o motorista"
          manualLabel="Motorista externo (digitar nome)"
          placeholder="Nome do motorista"
          error={tried && !driverName ? 'Informe o motorista.' : undefined}
        />
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Veículo (opcional)">
            <input className={inputClass} placeholder="Modelo e cor" value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Vagas">
            <input className={cx(inputClass, 'tnum')} type="number" inputMode="numeric" min={0} value={seats} onChange={(e) => setSeats(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="Saída (opcional)">
            <TimeInput value={time} onChange={setTime} />
          </Field>
          <Field label="Local de saída (opcional)">
            <input className={inputClass} value={place} onChange={(e) => setPlace(e.target.value)} />
          </Field>
        </div>
        <Field label="Observações">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

function PassengerPicker({ vehicleId, direction, onClose }: { vehicleId: string; direction: Direction; onClose: () => void }) {
  const { data, addPassenger, removePassenger, transferPassenger } = useCurrentEvent()
  const { ask, toast } = useFeedback()
  const [query, setQuery] = useState('')
  const vehicle = data.vehicles.find((v) => v.id === vehicleId)!
  const others = data.vehicles.filter((v) => v.direction === direction && v.id !== vehicleId)
  const inHere = new Set(data.passengers.filter((r) => r.vehicle_id === vehicleId).map((r) => r.participant_id))

  const whereElse = (id: string) => others.filter((v) => data.passengers.some((r) => r.vehicle_id === v.id && r.participant_id === id))

  const list = useMemo(() => {
    const q = normalize(query)
    return data.participants
      .filter((p) => p.status !== 'cancelado' || inHere.has(p.id))
      .filter((p) => !q || normalize(p.display_name).includes(q) || normalize(p.full_name).includes(q))
      .sort((a, b) => Number(whereElse(a.id).length > 0) - Number(whereElse(b.id).length > 0) || a.display_name.localeCompare(b.display_name, 'pt-BR'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.participants, data.passengers, query])

  const taken = inHere.size

  const tap = async (p: Participant) => {
    if (inHere.has(p.id)) {
      await removePassenger(vehicleId, p.id)
      return
    }
    const elsewhere = whereElse(p.id)
    if (elsewhere.length) {
      const names = elsewhere.map((v) => v.driver_name).join(' e ')
      const answer = await ask<'move' | 'both'>({
        title: `${p.display_name} já tem carro`,
        message: `Está no carro de ${names}.`,
        options: [
          { label: `Transferir para o carro de ${vehicle.driver_name}`, value: 'move' },
          { label: 'Manter nos dois (sinalizar para revisão)', value: 'both', variant: 'soft' },
        ],
      })
      if (!answer) return
      if (answer === 'move') {
        const first = elsewhere[0]
        await transferPassenger(first.id, vehicleId, p.id)
        for (const v of elsewhere.slice(1)) await removePassenger(v.id, p.id)
      } else {
        await addPassenger(vehicleId, p.id)
      }
    } else {
      await addPassenger(vehicleId, p.id)
    }
    if (taken + 1 > vehicle.seats) toast(`O carro de ${vehicle.driver_name} passou da capacidade`, 'error')
  }

  return (
    <Modal
      title={`Passageiros de ${vehicle.driver_name}`}
      onClose={onClose}
      footer={
        <Button block onClick={onClose}>
          Concluir
        </Button>
      }
    >
      <p className={cx('mb-2 text-sm font-medium tnum', taken > vehicle.seats ? 'text-erro' : 'text-pedra-600')}>{seatsText(taken, vehicle.seats)}</p>
      <div className="relative mb-2">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pedra-400" />
        <input aria-label="Buscar participante" className={cx(inputClass, 'pl-9')} placeholder="Buscar por nome" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-pedra-600">Ninguém com esse nome. Cadastre em Participantes.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {list.map((p) => {
            const here = inHere.has(p.id)
            const elsewhere = whereElse(p.id)
            return (
              <li key={p.id}>
                <button type="button" aria-pressed={here} onClick={() => void tap(p)} className="flex min-h-12 w-full items-center gap-3 py-1 text-left">
                  <span className={cx('flex size-6 shrink-0 items-center justify-center rounded-full border-2', here ? 'border-mata-700 bg-mata-700 text-white' : 'border-linha')}>{here && <Check size={14} strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.display_name}</span>
                    <span className="block text-[13px] text-pedra-600">{elsewhere.length ? `No carro de ${elsewhere.map((v) => v.driver_name).join(' e ')}` : here ? 'Neste carro' : 'Sem carona'}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

function PassengerActions({ vehicleId, participant, direction, onClose }: { vehicleId: string; participant: Participant; direction: Direction; onClose: () => void }) {
  const { data, removePassenger, transferPassenger } = useCurrentEvent()
  const { toast } = useFeedback()
  const current = data.vehicles.find((v) => v.id === vehicleId)
  const others = data.vehicles.filter((v) => v.direction === direction && v.id !== vehicleId)

  return (
    <Modal title={participant.display_name} onClose={onClose} narrow>
      <p className="mb-2 text-sm text-pedra-600">No carro de {current?.driver_name}.</p>
      {others.length > 0 && (
        <>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-mata-800">
            <ArrowRightLeft size={15} />
            Transferir para
          </h3>
          <ul className="mb-3 divide-y divide-linha rounded-xl border border-linha">
            {others.map((v) => {
              const taken = passengersOf(v.id, data.passengers, data.participants).length
              const already = data.passengers.some((r) => r.vehicle_id === v.id && r.participant_id === participant.id)
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left font-semibold hover:bg-musgo-50"
                    onClick={async () => {
                      if (await transferPassenger(vehicleId, v.id, participant.id)) {
                        toast(`${participant.display_name} transferido para o carro de ${v.driver_name}`)
                        onClose()
                      }
                    }}
                  >
                    {v.driver_name}
                    <span className={cx('text-[13px] font-medium tnum', taken >= v.seats && !already ? 'text-erro' : 'text-pedra-600')}>
                      {already ? 'Já está neste carro' : `${taken} de ${v.seats} vagas`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <Button
        block
        variant="dangerSoft"
        icon={UserMinus}
        onClick={async () => {
          if (await removePassenger(vehicleId, participant.id)) {
            toast(`${participant.display_name} removido do carro`)
            onClose()
          }
        }}
      >
        Remover deste carro
      </Button>
    </Modal>
  )
}

function AssignVehicle({ participant, direction, onClose, onNewVehicle }: { participant: Participant; direction: Direction; onClose: () => void; onNewVehicle: () => void }) {
  const { data, addPassenger } = useCurrentEvent()
  const { toast } = useFeedback()
  const vehicles = data.vehicles.filter((v) => v.direction === direction)
  return (
    <Modal title={`Carona de ${participant.display_name}`} onClose={onClose} narrow>
      {vehicles.length === 0 ? (
        <div className="py-2">
          <p className="mb-3 text-sm text-pedra-600">Ainda não há veículos na {LABEL[direction]}.</p>
          <Button block icon={Plus} onClick={onNewVehicle}>
            Novo veículo
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-linha rounded-xl border border-linha">
          {vehicles.map((v) => {
            const taken = passengersOf(v.id, data.passengers, data.participants).length
            return (
              <li key={v.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left font-semibold hover:bg-musgo-50"
                  onClick={async () => {
                    if (await addPassenger(v.id, participant.id)) {
                      toast(taken + 1 > v.seats ? `O carro de ${v.driver_name} passou da capacidade` : `${participant.display_name} no carro de ${v.driver_name}`, taken + 1 > v.seats ? 'error' : 'ok')
                      onClose()
                    }
                  }}
                >
                  {v.driver_name}
                  <span className={cx('text-[13px] font-medium tnum', taken >= v.seats ? 'text-erro' : 'text-pedra-600')}>
                    {taken} de {v.seats} vagas
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
