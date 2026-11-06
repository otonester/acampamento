import { describe, expect, it } from 'vitest'
import { buildShoppingList, findDuplicates, nextMeal, repeatedInRides, withoutRide } from './domain'
import { buildParticipantsCsv, buildWhatsAppText } from './export'
import { conflictPairs, currentAndNext, findConflicts, followingActivities, planDrop, shiftActivities, sortActivities, type Scheduled } from './schedule'
import { absoluteMinutes, endOf, formatDuration, getNow, longDay } from './time'
import { EMPTY_DATA, type Activity, type EventRow, type Meal, type MealItem, type Participant, type RidePassenger, type Vehicle } from './types'

const SAT = '2026-11-14'
const act = (id: string, time: string | null, duration: number, extra: Partial<Activity> = {}): Activity => ({
  id, event_id: 'e', title: id, activity_date: time ? SAT : null, start_time: time, duration_minutes: duration,
  responsible_participant_id: null, responsible_name: '', description: '', category: 'Outra', requirements: '',
  status: 'pendente', allow_overlap: false, game_id: null, sort_order: 0, ...extra,
})
const person = (id: string, extra: Partial<Participant> = {}): Participant => ({
  id, event_id: 'e', full_name: id, display_name: id, categories: [], phone: '', guardian: '', notes: '', status: 'confirmado', ...extra,
})
const car = (id: string, direction: 'ida' | 'volta' = 'ida', extra: Partial<Vehicle> = {}): Vehicle => ({
  id, event_id: 'e', direction, driver_name: id, driver_participant_id: null, vehicle: '', seats: 4, depart_time: null, depart_place: '', notes: '', sort_order: 0, ...extra,
})
const ride = (vehicle_id: string, participant_id: string): RidePassenger => ({ event_id: 'e', vehicle_id, participant_id })
const at = (time: string) => { const [h, m] = time.split(':').map(Number); return getNow(new Date(2026, 10, 14, h, m)) }

describe('horários', () => {
  it('calcula o término, inclusive virando o dia', () => {
    expect(endOf('08:50', 40)).toEqual({ time: '09:30', dayOffset: 0 })
    expect(endOf('23:30', 90)).toEqual({ time: '01:00', dayOffset: 1 })
  })
  it('formata duração no padrão usado no app', () => {
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(90)).toBe('1h30')
    expect(formatDuration(60)).toBe('1h')
  })
  it('usa o dia da semana correto sem erro de fuso', () => {
    expect(longDay(SAT)).toBe('Sábado, 14/11')
  })
})

describe('conflitos', () => {
  it('sinaliza sobreposição real e não considera término igual a início', () => {
    const c = findConflicts([act('a', '10:15', 15), act('b', '10:15', 90), act('c', '11:45', 30)])
    expect(c.get('a')?.map((x) => x.id)).toEqual(['b'])
    expect(c.has('c')).toBe(false)
    expect(conflictPairs(c)).toBe(1)
  })
  it('ignora marcos, canceladas, simultâneas de propósito e sem horário', () => {
    const c = findConflicts([
      act('marco', '09:45', 0), act('longa', '09:45', 120),
      act('cancelada', '10:00', 30, { status: 'cancelada' }),
      act('junto', '10:00', 30, { allow_overlap: true }), act('semhora', null, 30),
    ])
    expect(c.size).toBe(0)
  })
})

describe('em andamento e próxima', () => {
  const list = [act('a', '08:00', 30), act('b', '08:30', 20), act('c', '09:00', 10, { status: 'cancelada' }), act('d', '09:30', 15)]
  it('detecta a atual pelo relógio e a próxima pendente', () => {
    const r = currentAndNext(list, at('08:35'))
    expect(r.current.map((a) => a.id)).toEqual(['b'])
    expect(r.next?.id).toBe('d')
  })
  it('respeita o status manual em andamento', () => {
    const r = currentAndNext([act('a', '08:00', 30, { status: 'em_andamento' })], at('12:00'))
    expect(r.current.map((a) => a.id)).toEqual(['a'])
  })
})

describe('alteração de duração', () => {
  const list = [act('a', '08:00', 30), act('junto', '08:10', 10), act('b', '08:30', 20), act('c', '08:50', 40), act('fim', '10:00', 10, { status: 'concluida' })]
  it('afeta só as abertas que começam depois do fim anterior', () => {
    const f = followingActivities(list, list[0] as Scheduled, 30)
    expect(f.map((a) => a.id)).toEqual(['b', 'c'])
  })
  it('desloca os horários pelo delta', () => {
    const f = followingActivities(list, list[0] as Scheduled, 30)
    expect(shiftActivities(f, 15).map((a) => a.start_time)).toEqual(['08:45', '09:05'])
  })
  it('passa para o dia seguinte quando ultrapassa a meia-noite', () => {
    const [s] = shiftActivities([act('n', '23:50', 10) as Scheduled], 20)
    expect(s.start_time).toBe('00:10')
    expect(s.activity_date).toBe('2026-11-15')
  })
  it('atividade simultânea com marco não é deslocada', () => {
    const marco = act('marco', '09:45', 0) as Scheduled
    const f = followingActivities([marco, act('camin', '09:45', 120)], marco, 0)
    expect(f).toEqual([])
  })
})

describe('arrastar', () => {
  const g = [act('a', '08:00', 30), act('b', '08:30', 30), act('c', '09:00', 30)]
  it('mesmo horário: só reordena', () => {
    const same = [act('x', '10:15', 15), act('y', '10:15', 90)]
    const p = planDrop(same, 1, 0)
    expect(p.needsDecision).toBe(false)
    expect(sortActivities(p.order).map((a) => a.id)).toEqual(['y', 'x'])
  })
  it('fora da ordem: pergunta e oferece ajustar só a movida', () => {
    const p = planDrop(g, 2, 1)
    expect(p.needsDecision).toBe(true)
    const only = sortActivities(p.onlyMoved)
    expect(only.map((a) => a.id)).toEqual(['a', 'c', 'b'])
    expect(only.find((a) => a.id === 'c')?.start_time).toBe('08:30')
    expect(only.find((a) => a.id === 'b')?.start_time).toBe('08:30')
  })
  it('ou empurrar as seguintes', () => {
    const p = planDrop(g, 2, 1)
    expect(p.pushedCount).toBe(1)
    const b = p.pushed.find((a) => a.id === 'b')
    expect(b?.start_time).toBe('09:00')
  })
  it('sem horário: nunca pergunta', () => {
    const p = planDrop([act('a', null, 0), act('b', null, 0)], 0, 1)
    expect(p.needsDecision).toBe(false)
    expect(p.order[0].id).toBe('b')
  })
})

describe('caronas', () => {
  const people = [person('Daniel'), person('Pedro'), person('Ana', { status: 'cancelado' }), person('Motorista')]
  const cars = [car('v1'), car('v2'), car('v3', 'volta'), car('v4', 'ida', { driver_participant_id: 'Motorista' })]
  const rides = [ride('v1', 'Daniel'), ride('v2', 'Daniel')]
  it('mostra quem está sem carona, sem contar cancelados e motoristas', () => {
    expect(withoutRide('ida', people, cars, rides).map((p) => p.id)).toEqual(['Pedro'])
    expect(withoutRide('volta', people, cars, rides).map((p) => p.id)).toEqual(['Daniel', 'Pedro', 'Motorista'])
  })
  it('sinaliza nome repetido no mesmo sentido', () => {
    const r = repeatedInRides('ida', people, cars, rides)
    expect(r.map((x) => [x.participant.id, x.vehicles.length])).toEqual([['Daniel', 2]])
  })
  it('ida e volta em carros diferentes não é repetição', () => {
    expect(repeatedInRides('ida', people, cars, [ride('v1', 'Daniel'), ride('v3', 'Daniel')])).toEqual([])
  })
})

describe('participantes', () => {
  it('detecta duplicado ignorando acento, caixa e espaços', () => {
    const list = [person('1', { full_name: 'Cauã Silva', display_name: 'Cauã' })]
    expect(findDuplicates({ full_name: 'caua  silva', display_name: 'C' }, list)).toHaveLength(1)
    expect(findDuplicates({ full_name: 'Outro', display_name: 'CAUÃ' }, list)).toHaveLength(1)
    expect(findDuplicates({ id: '1', full_name: 'Cauã Silva', display_name: 'Cauã' }, list)).toHaveLength(0)
  })
  it('exporta CSV para Excel, com aspas e proteção contra fórmula', () => {
    const csv = buildParticipantsCsv([person('=SOMA(1)', { notes: 'a;b "c"' })])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("'=SOMA(1)")
    expect(csv).toContain('"a;b ""c"""')
  })
})

describe('cardápio', () => {
  const meal = (id: string, type: Meal['meal_type'], date = SAT, time: string | null = null): Meal => ({
    id, event_id: 'e', meal_date: date, meal_type: type, meal_time: time, description: '', responsible_participant_id: null, responsible_name: '', notes: '', sort_order: 0,
  })
  const item = (name: string, meal_id: string | null, quantity: number | null = null, unit = ''): MealItem => ({
    id: name + meal_id + quantity, event_id: 'e', meal_id, name, quantity, unit, kind: 'alimento', sort_order: 0,
  })
  it('consolida por nome e soma por unidade', () => {
    const lines = buildShoppingList(
      [item('Pão', 'm1', 10, 'un'), item('pao', 'm2', 5, 'UN'), item('Pão', 'm2', 1, 'kg'), item('Pão', 'm1'), item('Suco', null)],
      [meal('m1', 'jantar'), meal('m2', 'cafe_tarde')],
      new Set(['suco']),
    )
    const pao = lines.find((l) => l.key === 'pao')!
    expect(pao.amounts).toEqual(['15 un', '1 kg'])
    expect(pao.withoutQuantity).toBe(1)
    expect(pao.usedIn).toHaveLength(4)
    expect(lines.find((l) => l.key === 'suco')).toMatchObject({ general: true, purchased: true })
  })
  it('acha a próxima refeição, usando horário típico quando não há hora', () => {
    const meals = [meal('a', 'almoco'), meal('j', 'jantar'), meal('c', 'cafe_tarde', SAT, '15:30')]
    expect(nextMeal(meals, at('11:00'))?.id).toBe('a')
    expect(nextMeal(meals, at('13:00'))?.id).toBe('c')
    expect(nextMeal(meals, at('20:00'))).toBeNull()
  })
})

describe('whatsapp', () => {
  it('monta um texto com seções escolhidas', () => {
    const event: EventRow = { id: 'e', owner_id: 'o', name: 'Camp', location: 'Sítio', start_date: SAT, end_date: '2026-11-15', notes: '', created_at: '' }
    const text = buildWhatsAppText(event, { ...EMPTY_DATA, participants: [person('Gustavo')], activities: [act('Abertura', '08:30', 20, { responsible_participant_id: 'Gustavo' }), act('Depois', null, 0)] }, { schedule: true, menu: false, rides: false })
    expect(text).toContain('*Camp*')
    expect(text).toContain('📅 14/11 a 15/11/2026')
    expect(text).toContain('_Sábado, 14/11_')
    expect(text).toContain('08:30 Abertura (Gustavo)')
    expect(text).toContain('• Depois')
    expect(absoluteMinutes(SAT, '00:00')).toBeGreaterThan(0)
  })
})

describe('campo de horário', () => {
  it('aceita formas comuns e sempre devolve 24 horas', async () => {
    const { parseTime } = await import('../components/ui')
    expect(parseTime('8')).toBe('08:00')
    expect(parseTime('830')).toBe('08:30')
    expect(parseTime('14:05')).toBe('14:05')
    expect(parseTime('2359')).toBe('23:59')
    expect(parseTime('25:00')).toBe('')
    expect(parseTime('12:75')).toBe('')
    expect(parseTime('')).toBe('')
  })
})
