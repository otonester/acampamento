import { CalendarClock, Car, Home, Loader2, LogOut, PartyPopper, Tent, Users, Utensils, ChevronsUpDown, RefreshCw, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Button, Empty, Skeleton, cx } from './components/ui'
import { AuthProvider, useAuth } from './context/Auth'
import { EventProvider, useEvent } from './context/Event'
import { FeedbackProvider } from './context/Feedback'
import { isConfigured, supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Games from './pages/Games'
import Login, { NewPassword } from './pages/Login'
import MenuPage from './pages/Menu'
import Participants from './pages/Participants'
import Rides from './pages/Rides'
import Schedule from './pages/Schedule'

const NAV: { to: string; label: string; icon: LucideIcon; mobile: boolean }[] = [
  { to: '/', label: 'Início', icon: Home, mobile: true },
  { to: '/cronograma', label: 'Cronograma', icon: CalendarClock, mobile: true },
  { to: '/cardapio', label: 'Cardápio', icon: Utensils, mobile: true },
  { to: '/caronas', label: 'Caronas', icon: Car, mobile: true },
  { to: '/participantes', label: 'Participantes', icon: Users, mobile: true },
  { to: '/brincadeiras', label: 'Brincadeiras', icon: PartyPopper, mobile: false },
]

function Shell() {
  const { event, loadingEvents, loadingData, loadError, retry } = useEvent()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (loadingEvents) return <FullLoader />
  if (!event && !loadError && pathname !== '/eventos') return <Navigate to="/eventos" replace />

  return (
    <div className="min-h-dvh md:pl-56">
      {/* Trilho lateral no computador */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col bg-mata-800 p-3 text-white md:flex print:hidden">
        <Link to="/eventos" className="mb-4 flex items-center gap-2 rounded-xl p-2 hover:bg-mata-700">
          <Tent size={22} className="shrink-0 text-musgo-200" />
          <span className="min-w-0 flex-1 truncate font-display font-bold">{event?.name ?? 'Eventos'}</span>
          <ChevronsUpDown size={15} className="shrink-0 text-musgo-300" />
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx('flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors', isActive ? 'bg-musgo-100 text-mata-900' : 'text-musgo-100 hover:bg-mata-700')
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={() => void supabase.auth.signOut()} className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-musgo-200 hover:bg-mata-700">
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      {/* Cabeçalho no celular */}
      {pathname !== '/' && (
        <header className="sticky top-0 z-10 flex h-11 items-center bg-papel/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden print:hidden" style={{ height: 'calc(2.75rem + env(safe-area-inset-top))' }}>
          <Link to="/eventos" className="flex min-h-11 min-w-0 items-center gap-1.5 px-4 text-sm font-semibold text-pedra-600">
            <Tent size={16} className="shrink-0 text-mata-700" />
            <span className="truncate">{event?.name ?? 'Eventos'}</span>
            <ChevronsUpDown size={14} className="shrink-0" />
          </Link>
        </header>
      )}

      <main className="mx-auto max-w-5xl px-4 pt-1 pb-[calc(9rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-24 print:max-w-none print:p-0">
        {loadError ? (
          <Empty
            icon={RefreshCw}
            title="Os dados não carregaram"
            text={loadError}
            action={
              <Button icon={RefreshCw} onClick={retry}>
                Tentar de novo
              </Button>
            }
          />
        ) : loadingData ? (
          <div className="flex flex-col gap-2 pt-3" aria-label="Carregando">
            <Skeleton className="h-28" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Barra inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-white pb-safe md:hidden print:hidden" aria-label="Principal">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => n.mobile).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx('flex h-[3.75rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-mata-800' : 'text-pedra-600')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-musgo-100')}>
                    <Icon size={20} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function FullLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-mata-700" role="status" aria-label="Carregando">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <Tent size={32} className="text-mata-700" />
      <h1 className="font-display text-2xl font-bold text-mata-900">Falta conectar o banco de dados</h1>
      <p className="text-pedra-600">
        Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> ou nas variáveis de ambiente da Vercel, e publique de novo. O passo a passo está no README.
      </p>
    </div>
  )
}

function Authenticated() {
  const { session, loading, recovering } = useAuth()
  if (loading) return <FullLoader />
  if (recovering) return <NewPassword />
  if (!session) return <Login />
  return (
    // A chave garante que os dados de uma conta nunca apareçam em outra.
    <EventProvider key={session.user.id}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Guard><Dashboard /></Guard>} />
          <Route path="cronograma" element={<Guard><Schedule /></Guard>} />
          <Route path="cardapio" element={<Guard><MenuPage /></Guard>} />
          <Route path="caronas" element={<Guard><Rides /></Guard>} />
          <Route path="participantes" element={<Guard><Participants /></Guard>} />
          <Route path="brincadeiras" element={<Guard><Games /></Guard>} />
          <Route path="eventos" element={<Events />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </EventProvider>
  )
}

function Guard({ children }: { children: React.ReactNode }) {
  const { event } = useEvent()
  return event ? children : null
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return (
    <FeedbackProvider>
      <AuthProvider>
        <Authenticated />
      </AuthProvider>
    </FeedbackProvider>
  )
}
