import { useState, useEffect } from 'react'
import { LayoutDashboard, CalendarDays, MessageSquare, Settings, BarChart2, Dumbbell, TrendingUp, CalendarRange, X } from 'lucide-react'
import { useProfileStore } from './store/useProfileStore'
import { usePlanStore } from './store/usePlanStore'
import { HomePage } from './pages/HomePage'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import { LogPage } from './pages/LogPage'
import { ProgressPage } from './pages/ProgressPage'
import { ExercisePage } from './pages/ExercisePage'
import { PlannerPage } from './pages/PlannerPage'
import { ProfileForm } from './components/profile/ProfileForm'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { todayIso } from './lib/formatters'

type Tab = 'home' | 'add' | 'log' | 'progress' | 'exercise' | 'planner' | 'chat' | 'settings'

const NAV = [
  { id: 'home' as Tab, icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'add' as Tab, icon: CalendarDays, label: 'Add' },
  { id: 'log' as Tab, icon: BarChart2, label: 'History' },
  { id: 'progress' as Tab, icon: TrendingUp, label: 'Progress' },
  { id: 'exercise' as Tab, icon: Dumbbell, label: 'Exercise' },
  { id: 'planner' as Tab, icon: CalendarRange, label: 'Planner' },
  { id: 'chat' as Tab, icon: MessageSquare, label: 'AI Chat' },
  { id: 'settings' as Tab, icon: Settings, label: 'Settings' }
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [updateReady, setUpdateReady] = useState<string | null>(null)
  const { load, profile, loaded } = useProfileStore()
  const { loadDay } = usePlanStore()

  useEffect(() => {
    load()
    loadDay(todayIso())
  }, [])

  // Auto-update: surface a restart prompt once an update has downloaded.
  useEffect(() => window.api.onUpdateDownloaded(({ version }) => setUpdateReady(version)), [])

  const updateBanner = updateReady && (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-emerald-900 border border-emerald-700 rounded-xl px-4 py-3 shadow-2xl">
      <span className="text-sm text-emerald-100">Update v{updateReady} ready</span>
      <button onClick={() => window.api.updateInstall()} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg">
        Restart &amp; install
      </button>
      <button onClick={() => setUpdateReady(null)} className="text-emerald-300 hover:text-white" aria-label="Dismiss update notice">
        <X size={14} />
      </button>
    </div>
  )

  // Wait for the profile lookup to resolve before deciding what to render —
  // avoids briefly flashing the onboarding screen for returning users.
  if (!loaded) {
    return <div className="h-screen bg-gray-950" />
  }

  // First-launch gate: the app is unusable without a profile (targets/TDEE
  // depend on it), so force setup before anything else. Saving the profile
  // populates the store, which re-renders straight into the full app below.
  if (!profile) {
    return (
      <div className="h-screen bg-gray-950 text-gray-100 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">
          <ProfileForm onboarding />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <nav className="flex flex-col w-16 border-r border-gray-800 bg-gray-900 py-3 items-center gap-1 shrink-0">
        <div className="mb-3 w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-xs font-bold">N</span>
        </div>
        {NAV.map(item => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl w-12 transition-colors ${
                active
                  ? 'bg-emerald-700/30 text-emerald-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        <ErrorBoundary key={tab}>
          {tab === 'home' && <HomePage onNavigate={(t) => setTab(t as Tab)} />}
          {tab === 'add' && <DashboardPage />}
          {tab === 'log' && <LogPage />}
          {tab === 'progress' && <ProgressPage />}
          {tab === 'exercise' && <ExercisePage />}
          {tab === 'planner' && <PlannerPage onNavigate={(t) => setTab(t as Tab)} />}
          {tab === 'chat' && <ChatPage onGoToSettings={() => setTab('settings')} />}
          {tab === 'settings' && <SettingsPage />}
        </ErrorBoundary>
      </main>
      {updateBanner}
    </div>
  )
}
