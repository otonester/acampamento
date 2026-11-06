import { X, Loader2, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ---------- Botões ----------

type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'dangerSoft'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-mata-800 text-white hover:bg-mata-700 active:bg-mata-900',
  soft: 'bg-musgo-100 text-mata-800 hover:bg-musgo-200',
  ghost: 'text-mata-800 hover:bg-musgo-50',
  danger: 'bg-erro text-white hover:opacity-90',
  dangerSoft: 'text-erro hover:bg-erro-bg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: LucideIcon
  busy?: boolean
  block?: boolean
}

export function Button({ variant = 'primary', icon: Icon, busy, block, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || busy}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors disabled:opacity-55',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : Icon && <Icon size={18} />}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  variant?: Variant
  size?: number
}

export function IconButton({ icon: Icon, label, variant = 'ghost', size = 19, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx('inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40', VARIANTS[variant], className)}
    >
      <Icon size={size} />
    </button>
  )
}

/** Botão flutuante, ao alcance do polegar. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 inline-flex h-12 items-center gap-1.5 rounded-full bg-mata-800 pr-5 pl-4 font-semibold text-white shadow-[0_6px_18px_rgba(17,48,31,.32)] transition-colors hover:bg-mata-700 md:right-8 md:bottom-8 print:hidden"
    >
      <span className="text-xl leading-none" aria-hidden>
        +
      </span>
      {label}
    </button>
  )
}

// ---------- Formulário ----------

export const inputClass =
  'block min-h-11 w-full rounded-xl border border-linha bg-white px-3 py-2 text-base text-tinta placeholder:text-pedra-400 focus:border-mata-600 focus:outline-none focus:ring-2 focus:ring-musgo-200 disabled:bg-musgo-50'

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[13px] font-semibold text-pedra-600">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[13px] text-pedra-600">{hint}</span>}
      {error && <span className="mt-1 block text-[13px] font-medium text-erro">{error}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-musgo-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-white text-mata-800 shadow-sm' : 'text-pedra-600 hover:text-mata-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Converte o que foi digitado em HH:MM de 24 horas; vazio se ainda não for um horário válido. */
export function parseTime(text: string): string {
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  const [h, m] = digits.length <= 2 ? [digits, '00'] : digits.length === 3 ? [digits.slice(0, 1), digits.slice(1)] : [digits.slice(0, 2), digits.slice(2, 4)]
  if (Number(h) > 23 || Number(m) > 59) return ''
  return `${h.padStart(2, '0')}:${m}`
}

/** Campo de horário sempre em 24 horas, no padrão brasileiro, independente do aparelho. */
export function TimeInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [text, setText] = useState(value)
  useEffect(() => {
    if (parseTime(text) !== value) setText(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      className={cx(inputClass, 'tnum')}
      inputMode="numeric"
      placeholder="00:00"
      maxLength={5}
      autoComplete="off"
      disabled={disabled}
      value={text}
      onChange={(e) => {
        let next = e.target.value.replace(/[^\d:]/g, '')
        // Insere os dois-pontos ao digitar, sem atrapalhar quem está apagando.
        if (next.length > text.length && /^\d{2}$/.test(next)) next += ':'
        if (/^\d{3,4}$/.test(next)) next = `${next.slice(0, 2)}:${next.slice(2)}`
        setText(next)
        onChange(parseTime(next))
      }}
      onBlur={() => setText(parseTime(text))}
    />
  )
}

/** Horas e minutos separados, aceitando zero. */
export function DurationInput({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const h = Math.floor(value / 60)
  const m = value % 60
  const clamp = (text: string) => Math.max(0, Math.floor(Number(text) || 0))
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          aria-label="Horas de duração"
          type="number"
          inputMode="numeric"
          min={0}
          value={h}
          onChange={(e) => onChange(clamp(e.target.value) * 60 + m)}
          className={cx(inputClass, 'pr-7 tnum')}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-pedra-600">h</span>
      </div>
      <div className="relative flex-1">
        <input
          aria-label="Minutos de duração"
          type="number"
          inputMode="numeric"
          min={0}
          step={5}
          value={m}
          onChange={(e) => onChange(h * 60 + clamp(e.target.value))}
          className={cx(inputClass, 'pr-10 tnum')}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-pedra-600">min</span>
      </div>
    </div>
  )
}

// ---------- Chips e filtros ----------

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition-colors',
        active ? 'border-mata-800 bg-mata-800 text-white' : 'border-linha bg-white text-tinta hover:border-musgo-300',
      )}
    >
      {children}
    </button>
  )
}

export function Tag({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'amber' | 'red'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-musgo-50 text-pedra-600',
    green: 'bg-musgo-100 text-mata-700',
    amber: 'bg-ambar-bg text-ambar',
    red: 'bg-erro-bg text-erro',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>
}

export function Notice({
  tone = 'amber',
  icon: Icon,
  children,
  action,
}: {
  tone?: 'amber' | 'red' | 'green'
  icon?: LucideIcon
  children: ReactNode
  action?: ReactNode
}) {
  const tones = { amber: 'bg-ambar-bg text-ambar', red: 'bg-erro-bg text-erro', green: 'bg-musgo-100 text-mata-700' }
  return (
    <div className={cx('flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium', tones[tone])}>
      {Icon && <Icon size={17} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-musgo-100 text-mata-700">
        <Icon size={23} />
      </span>
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="max-w-xs text-sm text-pedra-600">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-11 items-center gap-1 print:hidden">
      <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold tracking-tight text-mata-900">{title}</h1>
      {children}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-musgo-100', className)} />
}

// ---------- Modal ----------

const openModals: symbol[] = []

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  headerActions?: ReactNode
  /** Sobrepõe outro painel já aberto. */
  layer?: 'panel' | 'dialog'
  narrow?: boolean
}

export function Modal({ title, onClose, children, footer, headerActions, layer = 'panel', narrow }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const token = Symbol()
    openModals.push(token)
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = ref.current
    const autofocus = root?.querySelector<HTMLElement>('[data-autofocus]')
    ;(autofocus ?? root)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== token) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab' && root) {
        const items = [...root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
          (el) => !el.hasAttribute('disabled'),
        )
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === root)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openModals.splice(openModals.indexOf(token), 1)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className={cx('fixed inset-0 flex items-end justify-center bg-mata-900/45 anim-fade md:items-center md:p-6 print:hidden', layer === 'dialog' ? 'z-50' : 'z-40')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white outline-none anim-sheet md:rounded-3xl',
          narrow ? 'md:max-w-md' : 'md:max-w-xl',
        )}
      >
        <div className="flex items-center gap-1 py-1.5 pr-1.5 pl-4">
          <h2 id={titleId} className="min-w-0 flex-1 font-display text-lg leading-tight font-bold text-mata-900">
            {title}
          </h2>
          {headerActions}
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-linha px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
