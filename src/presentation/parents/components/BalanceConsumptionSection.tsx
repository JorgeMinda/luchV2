import { QrCode, UtensilsCrossed, Wallet } from 'lucide-react'
import type { Student } from '../../../domain/entities'
import type { BalanceStatus } from '../../../domain/value-objects/balance'
import { getBalanceStatus } from '../../../domain/value-objects/balance'
import type { RecentConsumption } from '../data/parentPortalData'
import { LUNCH_PRICE } from '../data/parentPortalData'
import { toDollars } from '../../../domain/value-objects/money'
import { formatCurrency } from '../../shared/utils/formatCurrency'

const STATUS_STYLES: Record<
  BalanceStatus,
  { label: string; badge: string; dot: string }
> = {
  healthy: {
    label: 'Saldo saludable',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  low: {
    label: 'Saldo bajo',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
  },
  empty: {
    label: 'Sin saldo',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
  },
}

interface BalanceConsumptionSectionProps {
  student: Student
  lunchesThisMonth: number
  recentConsumptions: RecentConsumption[]
  onShowQr: () => void
}

export function BalanceConsumptionSection({
  student,
  lunchesThisMonth,
  recentConsumptions,
  onShowQr,
}: BalanceConsumptionSectionProps) {
  const status = getBalanceStatus(toDollars(student.balance))
  const styles = STATUS_STYLES[status]
  const lunchesRemaining = Math.floor(
    student.balance.cents / LUNCH_PRICE.cents,
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Saldo actual
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
                {formatCurrency(student.balance)}
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles.badge}`}
            >
              <span className={`size-1.5 rounded-full ${styles.dot}`} />
              {styles.label}
            </span>
            <span className="text-xs text-slate-500">
              Alcanza para ~{lunchesRemaining} almuerzos
            </span>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Precio por almuerzo:{' '}
              <span className="font-semibold text-slate-900">
                {formatCurrency(LUNCH_PRICE)}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Saldo actualizado al último consumo registrado en cocina.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Almuerzos consumidos
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
                {lunchesThisMonth}
                <span className="ml-2 text-sm font-medium text-slate-500">
                  este mes
                </span>
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <UtensilsCrossed className="size-5" aria-hidden="true" />
            </span>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Últimos consumos
          </p>
          <ul className="mt-2 space-y-2">
            {recentConsumptions.map((consumption) => (
              <li
                key={consumption.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">
                    {consumption.dateLabel}
                  </p>
                  <p className="truncate text-sm font-medium text-slate-700">
                    {consumption.description}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatCurrency(consumption.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-gradient-to-r from-brand-700 to-teal-600 p-6 text-white shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/25">
            <QrCode className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">Identificación en cocina</p>
            <p className="text-sm leading-relaxed text-white/80">
              Presenta el código QR del estudiante para descontar su almuerzo.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onShowQr}
          className="w-full shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700 sm:w-auto"
        >
          Mostrar código QR
        </button>
      </section>
    </div>
  )
}
