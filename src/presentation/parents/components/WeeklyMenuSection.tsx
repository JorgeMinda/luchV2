import { CalendarDays, CupSoda, Soup, UtensilsCrossed } from 'lucide-react'
import { useWeeklyMenu } from '../hooks/useWeeklyMenu'

export function WeeklyMenuSection() {
  const state = useWeeklyMenu()

  const heading =
    state.status === 'loading' || state.status === 'error'
      ? 'Menú de la semana'
      : state.heading

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            <UtensilsCrossed className="size-4" aria-hidden="true" />
            Menú de la semana
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            {heading}
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {state.status === 'ready'
            ? '5 días · Almuerzo completo'
            : state.status === 'empty'
              ? 'Aún sin publicar'
              : 'Semana en curso'}
        </span>
      </header>

      {state.status === 'loading' && (
        <p
          role="status"
          className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
        >
          Cargando el menú de esta semana…
        </p>
      )}

      {state.status === 'error' && (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm font-medium text-rose-700"
        >
          No se pudo cargar el menú de la semana.
        </p>
      )}

      {state.status === 'empty' && (
        <p
          role="status"
          className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
        >
          Aún no hay menú publicado para esta semana
        </p>
      )}

      {state.status === 'ready' && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {state.days.map((day) => (
            <article
              key={day.day}
              className={`rounded-2xl border p-4 transition-colors ${
                day.isToday
                  ? 'border-brand-300 bg-brand-50/60 ring-2 ring-brand-500/30'
                  : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {day.dayLabel}
                </p>
                {day.isToday && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Hoy
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {day.dateLabel}
              </p>

              <h3 className="mt-3 text-sm font-semibold leading-snug text-slate-900">
                {day.mainDish}
              </h3>

              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <Soup
                    className="mt-0.5 size-4 shrink-0 text-amber-500"
                    aria-hidden="true"
                  />
                  <span>{day.sideDish}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CupSoda
                    className="mt-0.5 size-4 shrink-0 text-sky-500"
                    aria-hidden="true"
                  />
                  <span>{day.drink}</span>
                </li>
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
