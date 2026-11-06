import { Tent } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, inputClass } from '../components/ui'
import { useAuth } from '../context/Auth'
import { friendlyError, supabase } from '../lib/supabase'

type Mode = 'entrar' | 'criar' | 'recuperar'

const TITLES: Record<Mode, string> = {
  entrar: 'Entrar',
  criar: 'Criar conta do organizador',
  recuperar: 'Recuperar senha',
}

const ACTIONS: Record<Mode, string> = {
  entrar: 'Entrar',
  criar: 'Criar conta',
  recuperar: 'Enviar link',
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'criar') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setInfo('Conta criada. Abra o link enviado para o seu e-mail para confirmar e depois entre.')
          setMode('entrar')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setInfo('Se este e-mail tiver conta, o link para criar uma nova senha chega em instantes.')
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const change = (next: Mode) => {
    setMode(next)
    setError('')
    setInfo('')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-mata-800">
      <div className="flex flex-1 flex-col justify-end px-6 pt-12 pb-7 text-white md:mx-auto md:w-full md:max-w-md md:flex-none md:pt-20">
        <Tent size={34} className="mb-4 text-musgo-200" />
        <h1 className="font-display text-[2.5rem] leading-[1.02] font-bold tracking-tight">Gestor de Acampamento</h1>
        <p className="mt-2 text-musgo-200">Cronograma, cardápio, caronas e participantes em um só lugar.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-t-3xl bg-white px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:mx-auto md:mb-auto md:w-full md:max-w-md md:rounded-3xl">
        <h2 className="font-display text-xl font-bold text-mata-900">{TITLES[mode]}</h2>
        {error && <Notice tone="red">{error}</Notice>}
        {info && <Notice tone="green">{info}</Notice>}
        <Field label="E-mail">
          <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode !== 'recuperar' && (
          <Field label="Senha" hint={mode === 'criar' ? 'Pelo menos 6 caracteres.' : undefined}>
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        <Button type="submit" block busy={busy} className="mt-1">
          {ACTIONS[mode]}
        </Button>
        <div className="flex justify-between gap-2">
          {mode === 'entrar' ? (
            <>
              <Button variant="ghost" className="px-2 text-sm" onClick={() => change('criar')}>
                Criar conta
              </Button>
              <Button variant="ghost" className="px-2 text-sm" onClick={() => change('recuperar')}>
                Esqueci a senha
              </Button>
            </>
          ) : (
            <Button variant="ghost" className="px-2 text-sm" onClick={() => change('entrar')}>
              Voltar para entrar
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

export function NewPassword() {
  const { finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else finishRecovery()
  }

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="font-display text-2xl font-bold text-mata-900">Criar nova senha</h1>
      {error && <Notice tone="red">{error}</Notice>}
      <Field label="Nova senha" hint="Pelo menos 6 caracteres.">
        <input className={inputClass} type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" busy={busy} block>
        Salvar nova senha
      </Button>
    </form>
  )
}
