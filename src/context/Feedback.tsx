import { CheckCircle2, AlertCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, Modal } from '../components/ui'

export interface AskOption<T> {
  label: string
  value: T
  variant?: 'primary' | 'soft' | 'danger'
}

interface AskConfig<T> {
  title: string
  message?: ReactNode
  options: AskOption<T>[]
  cancelLabel?: string
}

interface FeedbackApi {
  toast: (message: string, tone?: 'ok' | 'error') => void
  /** Abre um diálogo com opções; resolve com a escolhida ou null se cancelar. */
  ask: <T>(config: AskConfig<T>) => Promise<T | null>
  /** Confirmação de ação destrutiva. */
  confirmDelete: (title: string, message?: ReactNode, label?: string) => Promise<boolean>
}

const Ctx = createContext<FeedbackApi | null>(null)

export const useFeedback = () => {
  const value = useContext(Ctx)
  if (!value) throw new Error('FeedbackProvider ausente')
  return value
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: 'ok' | 'error' }[]>([])
  const [dialog, setDialog] = useState<(AskConfig<unknown> & { resolve: (v: unknown) => void }) | null>(null)
  const nextId = useRef(1)

  const toast = useCallback<FeedbackApi['toast']>((message, tone = 'ok') => {
    const id = nextId.current++
    setToasts((list) => [...list, { id, message, tone }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 2800)
  }, [])

  const ask = useCallback(<T,>(config: AskConfig<T>) => {
    return new Promise<T | null>((resolve) => {
      setDialog({ ...(config as AskConfig<unknown>), resolve: resolve as (v: unknown) => void })
    })
  }, [])

  const confirmDelete = useCallback<FeedbackApi['confirmDelete']>(
    async (title, message, label = 'Excluir') => {
      const answer = await ask({ title, message, options: [{ label, value: true, variant: 'danger' }] })
      return answer === true
    },
    [ask],
  )

  const api = useMemo(() => ({ toast, ask, confirmDelete }), [toast, ask, confirmDelete])

  const finish = (value: unknown) => {
    dialog?.resolve(value)
    setDialog(null)
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {dialog && (
        <Modal title={dialog.title} onClose={() => finish(null)} layer="dialog" narrow>
          {dialog.message && <div className="mb-4 text-[15px] text-pedra-600">{dialog.message}</div>}
          <div className="flex flex-col gap-2">
            {dialog.options.map((o, i) => (
              <Button key={i} block variant={o.variant ?? (i === 0 ? 'primary' : 'soft')} onClick={() => finish(o.value)} className="h-auto py-2.5">
                {o.label}
              </Button>
            ))}
            <Button block variant="ghost" onClick={() => finish(null)}>
              {dialog.cancelLabel ?? 'Cancelar'}
            </Button>
          </div>
        </Modal>
      )}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[max(.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 print:hidden"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={`flex max-w-md items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold shadow-lg anim-fade ${
                t.tone === 'error' ? 'bg-erro text-white' : 'bg-mata-900 text-white'
              }`}
            >
              {t.tone === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}
