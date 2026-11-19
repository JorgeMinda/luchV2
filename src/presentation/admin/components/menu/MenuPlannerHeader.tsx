import { ChevronLeft, ChevronRight, Calendar, Copy, Plus } from 'lucide-react'
import type { WeekStartDate } from '../../../../domain/value-objects/week'

interface MenuPlannerHeaderProps {
  /** Fecha de inicio de la semana actual (lunes). */
  currentWeekStartDate: WeekStartDate
  /** Callback para navegar al mes anterior. */
  onPreviousMonth: () => void
  /** Callback para navegar al mes siguiente. */
  onNextMonth: () => void
  /** Callback para ir al mes actual (semana de hoy). */
  onToday: () => void
  /** Callback para duplicar la semana activa. */
  onDuplicate: () => void
  /** Callback para abrir el diálogo de nueva semana. */
  onNewWeek: () => void
  /** Etiqueta de accesibilidad para el mes actual. */
  currentMonthLabel: string
}

/**
 * Barra superior única del planificador semanal.
 * Contiene navegación mensual y acciones principales.
 */
export function MenuPlannerHeader({
  onPreviousMonth,
  onNextMonth,
  onToday,
  onDuplicate,
  onNewWeek,
  currentMonthLabel,
}: MenuPlannerHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 flex-wrap">
      {/* Lado izquierdo: navegación mensual */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPreviousMonth}
          aria-label="Mes anterior"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </button>

        <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
          {currentMonthLabel}
        </span>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Mes siguiente"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onToday}
          aria-label="Ir a la semana actual"
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <Calendar className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Hoy</span>
        </button>
      </div>

      {/* Lado derecho: acciones principales */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Duplicar semana activa"
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <Copy className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Duplicar</span>
        </button>

        <button
          type="button"
          onClick={onNewWeek}
          aria-label="Crear nueva semana"
          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Nueva semana</span>
        </button>
      </div>
    </header>
  )
}