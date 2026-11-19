import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CircleDollarSign,
  QrCode,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { BalanceConsumptionSection } from './components/BalanceConsumptionSection'
import { RechargeSection } from './components/RechargeSection'
import { StudentQrModal } from './components/StudentQrModal'
import { WeeklyMenuSection } from './components/WeeklyMenuSection'
import {
  demoBankAccount,
  demoLunchesThisMonth,
  demoRecentConsumptions,
  demoStudent,
} from './data/parentPortalData'
import { formatCurrency } from '../shared/utils/formatCurrency'
import { getInitials } from '../shared/utils/getInitials'

const TABS = [
  {
    id: 'menu',
    shortLabel: 'Menú',
    label: 'Menú de la semana',
    icon: UtensilsCrossed,
  },
  {
    id: 'balance',
    shortLabel: 'Saldo',
    label: 'Saldo y consumos',
    icon: Wallet,
  },
  {
    id: 'recharge',
    shortLabel: 'Recarga',
    label: 'Recargar saldo',
    icon: CircleDollarSign,
  },
] as const

type TabId = (typeof TABS)[number]['id']

export function ParentDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('menu')
  const [qrOpen, setQrOpen] = useState(false)

  const closeQr = useCallback(() => setQrOpen(false), [])

  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-teal-500 px-6 py-7 text-white shadow-lg shadow-brand-900/10 sm:px-8 sm:py-8">
        <div
          className="absolute -right-12 -top-12 size-44 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-semibold ring-1 ring-inset ring-white/30 backdrop-blur">
            {getInitials(demoStudent.name)}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Portal de padres
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold">
              {demoStudent.name}
            </h1>
            <p className="text-sm text-white/80">
              {demoStudent.grade} · Código {demoStudent.qrCode}
            </p>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              Saldo disponible
            </p>
            <p className="mt-0.5 text-lg font-semibold">
              {formatCurrency(demoStudent.balance)}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              Almuerzos este mes
            </p>
            <p className="mt-0.5 text-lg font-semibold">
              {demoLunchesThisMonth}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
          >
            <QrCode className="size-4" aria-hidden="true" />
            Ver código QR
          </button>
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Secciones del portal de padres"
        className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === activeTab

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                isActive
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          )
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="mt-5"
        role="tabpanel"
      >
        {activeTab === 'menu' && <WeeklyMenuSection />}

        {activeTab === 'balance' && (
          <BalanceConsumptionSection
            student={demoStudent}
            lunchesThisMonth={demoLunchesThisMonth}
            recentConsumptions={demoRecentConsumptions}
            onShowQr={() => setQrOpen(true)}
          />
        )}

        {activeTab === 'recharge' && (
          <RechargeSection bankAccount={demoBankAccount} />
        )}
      </motion.div>

      <StudentQrModal
        open={qrOpen}
        student={demoStudent}
        onClose={closeQr}
      />
    </div>
  )
}
