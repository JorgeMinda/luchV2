import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  Database,
  ListOrdered,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { getBalanceStatus } from '../../domain/value-objects/balance'
import type { ImportMenuMatrixResult } from '../../application/use-cases/ImportMenuMatrixUseCase'
import { ImportedDataManagement } from './components/ImportedDataManagement'
import { InventoryManagement } from './components/InventoryManagement'
import { MenuConstructor } from './components/MenuConstructor'
import { PlatillosManagement } from './components/PlatillosManagement'
import { StudentBalanceRanking } from './components/StudentBalanceRanking'
import { TransferVerification } from './components/TransferVerification'
import type {
  AdminStudent,
  AdminTransfer,
} from './data/adminDashboardData'
import {
  initialStudents,
  initialTransfers,
} from './data/adminDashboardData'
import { formatCurrency } from '../shared/utils/formatCurrency'

const TABS = [
  {
    id: 'menu',
    shortLabel: 'Menús',
    label: 'Constructor de menús',
    icon: CalendarDays,
  },
  {
    id: 'dishes',
    shortLabel: 'Platillos',
    label: 'Catálogo de platillos',
    icon: ChefHat,
  },
  {
    id: 'inventory',
    shortLabel: 'Stock',
    label: 'Inventario',
    icon: Boxes,
  },
  {
    id: 'imported-data',
    shortLabel: 'Datos',
    label: 'Datos importados',
    icon: Database,
  },
  {
    id: 'transfers',
    shortLabel: 'Pagos',
    label: 'Transferencias',
    icon: ArrowLeftRight,
  },
  {
    id: 'ranking',
    shortLabel: 'Ranking',
    label: 'Ranking de saldos',
    icon: ListOrdered,
  },
] as const

type AdminTabId = (typeof TABS)[number]['id']

interface AdminFeedback {
  tone: 'success' | 'danger'
  message: string
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTabId>('menu')
  const [transfers, setTransfers] = useState<AdminTransfer[]>(initialTransfers)
  const [students, setStudents] = useState<AdminStudent[]>(initialStudents)
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null)

  useEffect(() => {
    if (!feedback) return

    const timeout = window.setTimeout(() => setFeedback(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const pendingCount = transfers.filter(
    (transfer) => transfer.status === 'pending',
  ).length
  const approvedTotal = transfers
    .filter((transfer) => transfer.status === 'approved')
    .reduce((total, transfer) => total + transfer.amount, 0)
  const alertCount = students.filter(
    (student) => getBalanceStatus(student.balance) !== 'healthy',
  ).length

  const kpis = [
    {
      label: 'Pagos por verificar',
      value: String(pendingCount),
      hint: 'Comprobantes pendientes',
      icon: Clock3,
      iconClass: 'bg-amber-100 text-amber-700',
    },
    {
      label: 'Recaudado aprobado',
      value: formatCurrency(approvedTotal),
      hint: 'Saldo liberado a estudiantes',
      icon: Banknote,
      iconClass: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'Alumnos en alerta',
      value: String(alertCount),
      hint: 'Saldo bajo o agotado',
      icon: TriangleAlert,
      iconClass: 'bg-rose-100 text-rose-700',
    },
  ]

  function handleApproveTransfer(transferId: string) {
    const transfer = transfers.find((item) => item.id === transferId)

    if (!transfer || transfer.status !== 'pending') return

    const approvedAt = `${new Date().toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'short',
    })} · ahora`

    setTransfers((current) =>
      current.map((item) =>
        item.id === transferId
          ? { ...item, status: 'approved', approvedAt }
          : item,
      ),
    )
    setStudents((current) =>
      current.map((student) =>
        student.id === transfer.studentId
          ? {
              ...student,
              balance: Number((student.balance + transfer.amount).toFixed(2)),
            }
          : student,
      ),
    )
    setFeedback({
      tone: 'success',
      message: `Saldo de ${formatCurrency(transfer.amount)} liberado a ${transfer.studentName}.`,
    })
  }

  function handleMenuImported(result: ImportMenuMatrixResult) {
    const weeksLabel =
      result.weeks === 1 ? '1 semana' : `${result.weeks} semanas`
    const createdLabel =
      result.createdDishes === 1
        ? '1 platillo nuevo'
        : `${result.createdDishes} platillos nuevos`
    const skippedLabel =
      result.skipped === 1
        ? ' Se omitió 1 celda sin espacio disponible.'
        : result.skipped > 1
          ? ` Se omitieron ${result.skipped} celdas sin espacio disponible.`
          : ''

    setFeedback({
      tone: 'success',
      message: `Menú importado: ${result.cells} asignaciones en ${weeksLabel} y ${createdLabel}.${skippedLabel}`,
    })
    setActiveTab('menu')
  }

  function handleRejectTransfer(transferId: string) {
    const transfer = transfers.find((item) => item.id === transferId)

    if (!transfer || transfer.status !== 'pending') return

    setTransfers((current) =>
      current.map((item) =>
        item.id === transferId
          ? { ...item, status: 'rejected', approvedAt: null }
          : item,
      ),
    )
    setFeedback({
      tone: 'danger',
      message: `Transferencia de ${transfer.studentName} rechazada por comprobante inválido.`,
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">
              Panel de administración
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Torre de control
            </h1>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          Planificación de menús
        </span>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon

          return (
            <article
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    {kpi.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{kpi.hint}</p>
                </div>
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${kpi.iconClass}`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              </div>
            </article>
          )
        })}
      </div>

      {feedback && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : 'bg-rose-50 text-rose-800 ring-rose-200'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <p className="flex-1">{feedback.message}</p>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Cerrar aviso"
            className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Secciones del panel de administración"
        className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-3 lg:grid-cols-6"
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
        {activeTab === 'menu' && (
          <MenuConstructor onOpenCatalog={() => setActiveTab('dishes')} />
        )}

        {activeTab === 'dishes' && (
          <PlatillosManagement onMenuImported={handleMenuImported} />
        )}

        {activeTab === 'inventory' && <InventoryManagement />}

        {activeTab === 'imported-data' && <ImportedDataManagement />}

        {activeTab === 'transfers' && (
          <TransferVerification
            transfers={transfers}
            onApprove={handleApproveTransfer}
            onReject={handleRejectTransfer}
          />
        )}

        {activeTab === 'ranking' && (
          <StudentBalanceRanking students={students} />
        )}
      </motion.div>
    </div>
  )
}
