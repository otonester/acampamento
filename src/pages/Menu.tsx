import { Copy, CupSoda, Plus, ShoppingCart, Trash2, User, Utensils, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { PersonField } from '../components/shared'
import { Button, Empty, Fab, Field, IconButton, Modal, PageTitle, Segmented, TimeInput, cx, inputClass } from '../components/ui'
import { useCurrentEvent } from '../context/Event'
import { useFeedback } from '../context/Feedback'
import { buildShoppingList, normalize, responsibleName, sortMeals, splitNames } from '../lib/domain'
import { daysInRange, hhmm, longDay, shortDay } from '../lib/time'
import { MEAL_TYPES, type ItemKind, type Meal, type MealItem, type MealType } from '../lib/types'

export default function MenuPage() {
  const { event, data } = useCurrentEvent()
  const [tab, setTab] = useState<'refeicoes' | 'compras'>('refeicoes')
  const [editing, setEditing] = useState<Meal | 'new' | null>(null)
  const [editingItem, setEditingItem] = useState<MealItem | 'new' | null>(null)

  const meals = useMemo(() => sortMeals(data.meals), [data.meals])
  const days = useMemo(() => [...new Set([...daysInRange(event.start_date, event.end_date), ...meals.map((m) => m.meal_date)])].sort(), [event, meals])

  return (
    <div>
      <PageTitle title="Cardápio" />
      <div className="mb-3">
        <Segmented
          label="Seção do cardápio"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'refeicoes', label: 'Refeições' },
            { value: 'compras', label: 'Lista de compras' },
          ]}
        />
      </div>

      {tab === 'refeicoes' ? (
        meals.length === 0 ? (
          <Empty icon={Utensils} title="Nenhuma refeição ainda" text="Adicione as refeições de cada dia do acampamento." />
        ) : (
          days
            .filter((d) => meals.some((m) => m.meal_date === d))
            .map((d) => (
              <section key={d} className="mb-4">
                <h2 className="mb-1.5 font-display text-lg font-bold text-mata-900">{longDay(d)}</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {meals
                    .filter((m) => m.meal_date === d)
                    .map((m) => (
                      <MealCard key={m.id} meal={m} onOpen={() => setEditing(m)} />
                    ))}
                </div>
              </section>
            ))
        )
      ) : (
        <ShoppingTab onEdit={setEditingItem} />
      )}

      {tab === 'refeicoes' ? <Fab label="Nova refeição" onClick={() => setEditing('new')} /> : <Fab label="Item geral" onClick={() => setEditingItem('new')} />}

      {editing && <MealForm meal={editing === 'new' ? undefined : editing} days={days} onClose={() => setEditing(null)} />}
      {editingItem && <GeneralItemForm item={editingItem === 'new' ? undefined : editingItem} onClose={() => setEditingItem(null)} />}
    </div>
  )
}

function MealCard({ meal, onOpen }: { meal: Meal; onOpen: () => void }) {
  const { data } = useCurrentEvent()
  const items = data.mealItems.filter((i) => i.meal_id === meal.id)
  const resp = responsibleName(meal, data.participants)
  // Evita repetir a lista quando a descrição apenas enumera os alimentos.
  const description = normalize(meal.description)
  const showItems = items.some((i) => i.quantity != null || !description.includes(normalize(i.name)))
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-2xl border border-linha bg-white px-3 py-2 text-left hover:border-musgo-300">
      <span className="flex items-baseline gap-2">
        <span className="font-semibold text-mata-800">{MEAL_TYPES[meal.meal_type]}</span>
        {meal.meal_time && <span className="text-sm text-pedra-600 tnum">{hhmm(meal.meal_time)}</span>}
      </span>
      <span className="block leading-snug">{meal.description || 'A definir'}</span>
      {showItems && <span className="mt-0.5 block text-[13px] text-pedra-600">{items.map(itemLabel).join(', ')}</span>}
      {resp && (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-pedra-600">
          <User size={12} />
          {resp}
        </span>
      )}
      {meal.notes && <span className="mt-0.5 block text-[13px] text-pedra-600">{meal.notes}</span>}
    </button>
  )
}

function itemLabel(i: { name: string; quantity: number | null; unit: string }) {
  if (i.quantity == null) return i.name
  return `${i.name} (${Number(i.quantity).toLocaleString('pt-BR')}${i.unit ? ` ${i.unit}` : ''})`
}

// ---------- Compras ----------

function ShoppingTab({ onEdit }: { onEdit: (item: MealItem) => void }) {
  const { data, togglePurchased } = useCurrentEvent()
  const purchased = useMemo(() => new Set(data.checks.map((c) => c.item_key)), [data.checks])
  const lines = useMemo(() => buildShoppingList(data.mealItems, data.meals, purchased), [data.mealItems, data.meals, purchased])
  const general = useMemo(() => data.mealItems.filter((i) => !i.meal_id), [data.mealItems])
  const doneCount = lines.filter((l) => l.purchased).length

  if (!lines.length) {
    return <Empty icon={ShoppingCart} title="Lista vazia" text="Os alimentos cadastrados nas refeições e os itens gerais aparecem aqui, já somados." />
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-pedra-600 tnum">
        {doneCount} de {lines.length} comprados
      </p>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-musgo-100">
        <div className="h-full rounded-full bg-mata-700 transition-[width]" style={{ width: `${(doneCount / lines.length) * 100}%` }} />
      </div>
      <ul className="mb-5 divide-y divide-linha rounded-2xl border border-linha bg-white">
        {lines.map((l) => (
          <li key={l.key}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-1.5">
              <input type="checkbox" className="size-5 shrink-0 accent-mata-800" checked={l.purchased} onChange={(e) => void togglePurchased(l.key, e.target.checked)} />
              <span className="min-w-0 flex-1">
                <span className={cx('flex flex-wrap items-baseline gap-x-2 font-semibold', l.purchased && 'text-pedra-400 line-through')}>
                  {l.name}
                  {l.amounts.length > 0 && <span className="text-sm font-medium text-mata-700 tnum">{l.amounts.join(' + ')}</span>}
                  {l.amounts.length > 0 && l.withoutQuantity > 0 && <span className="text-[13px] font-normal text-pedra-600">e {l.withoutQuantity} sem quantidade</span>}
                </span>
                <span className="block text-[13px] leading-snug text-pedra-600">
                  {[...l.usedIn, ...(l.general ? ['Item geral'] : [])].join(', ')}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <h2 className="mb-1.5 font-display text-lg font-bold text-mata-900">Alimentos e bebidas gerais</h2>
      {general.length === 0 ? (
        <p className="rounded-xl bg-musgo-50 px-3 py-3 text-sm text-pedra-600">Itens que não pertencem a uma refeição, como sucos e refrigerantes.</p>
      ) : (
        <ul className="divide-y divide-linha rounded-2xl border border-linha bg-white">
          {general.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onEdit(i)} className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left hover:bg-musgo-50">
                {i.kind === 'bebida' ? <CupSoda size={16} className="text-mata-700" /> : <Utensils size={16} className="text-mata-700" />}
                <span className="font-medium">{itemLabel(i)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GeneralItemForm({ item, onClose }: { item?: MealItem; onClose: () => void }) {
  const { data, saveRow, deleteRow } = useCurrentEvent()
  const { confirmDelete, toast } = useFeedback()
  const [name, setName] = useState(item?.name ?? '')
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? 'bebida')
  const [quantity, setQuantity] = useState(item?.quantity == null ? '' : String(item.quantity))
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const qty = parseQuantity(quantity)
    let ok = true
    if (item) {
      ok = !!(await saveRow('mealItems', { id: item.id, name: name.trim(), kind, quantity: qty, unit: unit.trim() }))
    } else {
      // Vários nomes separados por vírgula viram vários itens.
      const base = data.mealItems.length
      for (const [i, n] of splitNames(name).entries()) {
        ok = ok && !!(await saveRow('mealItems', { meal_id: null, name: n, kind, quantity: qty, unit: unit.trim(), sort_order: base + i + 1 }))
      }
    }
    setBusy(false)
    if (ok) {
      toast(item ? 'Item salvo' : 'Item adicionado')
      onClose()
    }
  }

  const remove = async () => {
    if (item && (await confirmDelete(`Excluir "${item.name}"?`)) && (await deleteRow('mealItems', item.id))) {
      toast('Item excluído')
      onClose()
    }
  }

  return (
    <Modal
      title={item ? 'Editar item geral' : 'Novo item geral'}
      onClose={onClose}
      narrow
      headerActions={item && <IconButton icon={Trash2} label="Excluir item" variant="dangerSoft" onClick={() => void remove()} />}
      footer={
        <Button type="submit" form="item-form" block busy={busy} disabled={!name.trim()}>
          {item ? 'Salvar item' : 'Adicionar item'}
        </Button>
      }
    >
      <form id="item-form" onSubmit={submit} className="flex flex-col gap-3">
        <Segmented
          label="Tipo de item"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'bebida', label: 'Bebida' },
            { value: 'alimento', label: 'Alimento' },
          ]}
        />
        <Field label="Nome" hint={item ? undefined : 'Para vários, separe por vírgula.'}>
          <input data-autofocus className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade (opcional)">
            <input className={inputClass} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unidade (opcional)">
            <input className={inputClass} placeholder="L, kg, un" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function parseQuantity(text: string): number | null {
  const n = Number(text.replace(',', '.'))
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null
}

// ---------- Refeição ----------

interface DraftItem {
  key: string
  id?: string
  name: string
  quantity: string
  unit: string
  kind: ItemKind
}

function MealForm({ meal, days, onClose }: { meal?: Meal; days: string[]; onClose: () => void }) {
  const { data, saveRow, deleteRow, saveMealItems } = useCurrentEvent()
  const { confirmDelete, toast } = useFeedback()
  const [date, setDate] = useState(meal?.meal_date ?? days[0])
  const [type, setType] = useState<MealType>(meal?.meal_type ?? 'almoco')
  const [time, setTime] = useState(hhmm(meal?.meal_time))
  const [description, setDescription] = useState(meal?.description ?? '')
  const [person, setPerson] = useState({ participantId: meal?.responsible_participant_id ?? null, name: meal?.responsible_name ?? '' })
  const [notes, setNotes] = useState(meal?.notes ?? '')
  const [items, setItems] = useState<DraftItem[]>(() =>
    data.mealItems
      .filter((i) => i.meal_id === meal?.id && meal)
      .map((i) => ({ key: i.id, id: i.id, name: i.name, quantity: i.quantity == null ? '' : String(i.quantity), unit: i.unit, kind: i.kind })),
  )
  const [newItem, setNewItem] = useState('')
  const [busy, setBusy] = useState(false)

  const drafted = (names: string[]): DraftItem[] => names.map((name) => ({ key: crypto.randomUUID(), name, quantity: '', unit: '', kind: 'alimento' }))

  const addItems = () => {
    const names = splitNames(newItem)
    if (!names.length) return
    setItems((list) => [...list, ...drafted(names)])
    setNewItem('')
  }

  const update = (key: string, patch: Partial<DraftItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const persist = async (asCopy: boolean) => {
    setBusy(true)
    // Texto digitado e ainda não adicionado também entra na lista.
    const allItems = [...items, ...drafted(splitNames(newItem))].filter((i) => i.name.trim())
    const row = {
      meal_date: date,
      meal_type: type,
      meal_time: time || null,
      description: description.trim(),
      responsible_participant_id: person.participantId,
      responsible_name: person.name.trim(),
      notes: notes.trim(),
    }
    const isUpdate = meal && !asCopy
    const saved = await saveRow('meals', isUpdate ? { ...row, id: meal.id } : { ...row, sort_order: data.meals.length + 1 })
    let ok = !!saved
    if (saved) {
      ok = await saveMealItems(
        saved.id,
        allItems.map((i) => ({ id: asCopy ? undefined : i.id, name: i.name.trim(), quantity: parseQuantity(i.quantity), unit: i.unit.trim(), kind: i.kind })),
      )
    }
    setBusy(false)
    if (ok) {
      toast(asCopy ? 'Refeição duplicada' : meal ? 'Refeição salva' : 'Refeição adicionada')
      onClose()
    }
  }

  const remove = async () => {
    if (meal && (await confirmDelete(`Excluir ${MEAL_TYPES[meal.meal_type].toLowerCase()} de ${shortDay(meal.meal_date)}?`, 'Os alimentos desta refeição saem da lista de compras.')) && (await deleteRow('meals', meal.id))) {
      toast('Refeição excluída')
      onClose()
    }
  }

  const dayOptions = [...new Set([...days, date])].sort()

  return (
    <Modal
      title={meal ? 'Editar refeição' : 'Nova refeição'}
      onClose={onClose}
      headerActions={
        meal && (
          <>
            <IconButton icon={Copy} label="Duplicar refeição" onClick={() => void persist(true)} />
            <IconButton icon={Trash2} label="Excluir refeição" variant="dangerSoft" onClick={() => void remove()} />
          </>
        )
      }
      footer={
        <Button type="submit" form="meal-form" block busy={busy}>
          {meal ? 'Salvar refeição' : 'Adicionar refeição'}
        </Button>
      }
    >
      <form
        id="meal-form"
        onSubmit={(e) => {
          e.preventDefault()
          void persist(false)
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia">
            <select className={inputClass} value={date} onChange={(e) => setDate(e.target.value)}>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {shortDay(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Horário (opcional)">
            <TimeInput value={time} onChange={setTime} />
          </Field>
        </div>
        <Field label="Tipo">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as MealType)}>
            {Object.entries(MEAL_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição do cardápio">
          <input className={inputClass} placeholder="A definir" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div>
          <span className="mb-1 block text-[13px] font-semibold text-pedra-600">Lista de alimentos</span>
          {items.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1.5">
              {items.map((i) => (
                <li key={i.key} className="flex items-center gap-1.5">
                  <input aria-label="Alimento" className={cx(inputClass, 'min-w-0 flex-[3] px-2.5')} value={i.name} onChange={(e) => update(i.key, { name: e.target.value })} />
                  <input aria-label={`Quantidade de ${i.name}`} placeholder="Qtd." inputMode="decimal" className={cx(inputClass, 'w-14! shrink-0 px-2 tnum')} value={i.quantity} onChange={(e) => update(i.key, { quantity: e.target.value })} />
                  <input aria-label={`Unidade de ${i.name}`} placeholder="Un." className={cx(inputClass, 'w-14! shrink-0 px-2')} value={i.unit} onChange={(e) => update(i.key, { unit: e.target.value })} />
                  <IconButton icon={X} label={`Remover ${i.name}`} className="-mx-1" onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-1.5">
            <input
              aria-label="Adicionar alimentos"
              className={inputClass}
              placeholder="Pão, queijo, frutas"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addItems()
                }
              }}
            />
            <IconButton icon={Plus} label="Adicionar alimentos à lista" variant="soft" onClick={addItems} />
          </div>
          <p className="mt-1 text-[13px] text-pedra-600">Quantidade e unidade são opcionais.</p>
        </div>

        <PersonField label="Responsável (opcional)" participants={data.participants} participantId={person.participantId} name={person.name} onChange={setPerson} />
        <Field label="Observações">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

