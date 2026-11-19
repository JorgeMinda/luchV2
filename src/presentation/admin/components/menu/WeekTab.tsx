interface WeekTabProps {
  week: {
    id: string
    /** Rango corto del lunes al viernes, ej. "16 – 20 Nov". */
    rangeLabel: string
  }
  isActive: boolean
  filled: number
  totalCells: number
  onClick: () => void
}

/**
 * Tarjeta minimalista de semana (2 líneas):
 * L1 = rango de fechas + punto de estado (6px).
 * L2 = celdas asignadas "45/45".
 */
export function WeekTab({
  week,
  isActive,
  filled,
  totalCells,
  onClick,
}: WeekTabProps) {
  const isComplete = filled >= totalCells
  const isEmpty = filled === 0

  const dotClassName = isComplete
    ? 'bg-emerald-500'
    : isEmpty
      ? 'bg-slate-300'
      : 'bg-amber-500'

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={`Semana ${week.rangeLabel}, ${filled} de ${totalCells} celdas asignadas`}
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        isActive
          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold">
          {week.rangeLabel}
        </span>
        <span
          className={`size-1.5 shrink-0 rounded-full ${dotClassName}`}
          aria-hidden="true"
        />
      </span>
      <span
        className={`mt-1 block text-[11px] font-medium tabular-nums ${
          isActive ? 'text-white/70' : 'text-slate-500'
        }`}
      >
        {filled}/{totalCells}
      </span>
    </button>
  )
}

export default WeekTab
