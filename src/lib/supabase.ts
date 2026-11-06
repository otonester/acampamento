import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'http://localhost', anonKey || 'nao-configurado', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Traduz erros técnicos para uma orientação clara ao usuário. */
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message ?? ''
  if (/failed to fetch|network|load failed/i.test(message)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail pelo link que enviamos e tente entrar de novo.'
  if (/user already registered/i.test(message)) return 'Este e-mail já tem conta. Entre com sua senha.'
  if (/password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit|too many/i.test(message)) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'
  if (/jwt|row-level security|permission denied/i.test(message)) return 'Sua sessão expirou. Saia e entre novamente.'
  if (/end_date|events_check/i.test(message)) return 'A data de término não pode ser anterior à de início.'
  return message ? `Não foi possível salvar: ${message}` : 'Não foi possível concluir. Tente de novo.'
}
