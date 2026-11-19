import { useState, useEffect } from 'react'
import { Copy, Plus, X } from 'lucide-react'
import type { WeekStartDate } from '../../../../domain/value-objects/week'
import {
  normalizeToMonday,
  getCompactRangeLabel,
  getFullRangeLabel,
  getMonthYearLabel,
  getWeekOfMonth,
} from '../../../../domain/value-objects/week'

interface NewMenuWeekDialogProps {
  /** Indica si el diálogo está abierto. */
  open: boolean
  /** Callback para cerrar el diálogo. */
  onClose: () => void
  /** Callback para crear semana vacía. */
  onCreateEmpty: (weekStartDate: WeekStartDate) => void
  /** Callback para clonar semana existente. */
  onCloneExisting: (sourceWeekStartDate: WeekStartDate, targetWeekStartDate: WeekStartDate) => void
  /** Semanas existentes para detectar duplicados y para clonar. */
  existingWeeks: readonly WeekStartDate[]
  /** Semana actual activa (para sugerir clonar la actual). */
  activeWeekStartDate?: WeekStartDate
  /**
   * Fecha de referencia sugerida al abrir (ej. el siguiente lunes
   * del mes). Tiene prioridad sobre la semana activa.
   */
  initialReferenceDate?: WeekStartDate
}

/**
 * Diálogo compacto para crear una nueva semana.
 * Permite crear semana vacía o clonar una existente.
 */
export function NewMenuWeekDialog({
  open,
  onClose,
  onCreateEmpty,
  onCloneExisting,
  existingWeeks,
  activeWeekStartDate,
  initialReferenceDate,
}: NewMenuWeekDialogProps) {
  const [referenceDate, setReferenceDate] = useState('')
  const [previewWeekStartDate, setPreviewWeekStartDate] = useState<WeekStartDate | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [selectedSourceWeek, setSelectedSourceWeek] = useState<WeekStartDate | ''>('')
  const [error, setError] = useState<string | null>(null)

  // Actualizar preview cuando cambia la fecha de referencia
  useEffect(() => {
    if (!referenceDate) {
      setPreviewWeekStartDate(null)
      setError(null)
      return
    }

    try {
      const weekStart = normalizeToMonday(referenceDate)
      setPreviewWeekStartDate(weekStart)

      // Verificar duplicado
      if (existingWeeks.includes(weekStart)) {
        setError(`Ya existe una semana para ${getFullRangeLabel(weekStart)}`)
      } else {
        setError(null)
      }
    } catch {
      setPreviewWeekStartDate(null)
      setError('Fecha inválida')
    }
  }, [referenceDate, existingWeeks])

  // Inicializar con la fecha sugerida (siguiente lunes del mes) o con
  // la semana siguiente a la activa si está disponible
  useEffect(() => {
    if (!open || referenceDate) return

    if (initialReferenceDate) {
      setReferenceDate(initialReferenceDate)
      return
    }

    if (activeWeekStartDate) {
      setReferenceDate(addWeeks(activeWeekStartDate, 1))
    }
  }, [open, activeWeekStartDate, referenceDate, initialReferenceDate])

  function addWeeks(weekStartDate: WeekStartDate, weeks: number): WeekStartDate {
    const timestamp = Date.parse(`${weekStartDate}T00:00:00Z`)
    const result = new Date(timestamp + weeks * 7 * 24 * 60 * 60 * 1000)
    return result.toISOString().slice(0, 10) as WeekStartDate
  }

  function handleCreateEmpty() {
    if (!previewWeekStartDate || isDuplicate || error) return

    onCreateEmpty(previewWeekStartDate)
    onClose()
    resetForm()
  }

  function handleCloneExisting() {
    if (!previewWeekStartDate || !selectedSourceWeek || error) return

    onCloneExisting(selectedSourceWeek, previewWeekStartDate)
    onClose()
    resetForm()
  }

  function resetForm() {
    setReferenceDate('')
    setPreviewWeekStartDate(null)
    setIsDuplicate(false)
    setSelectedSourceWeek('')
    setError(null)
  }

  // Calcular semanas disponibles para clonar (que existan)
  const availableSourceWeeks = existingWeeks.filter((w) =>
    existingWeeks.includes(w),
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative max-w-sm w-full rounded-2xl bg-white p-5 shadow-xl">
        {/* Header del diálogo */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Nueva semana</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Selector de fecha */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="reference-date"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Fecha de referencia
            </label>
            <input
              id="reference-date"
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-describedby="preview-date"
            />
            <p id="preview-date" className="mt-1 text-xs text-slate-500">
              Selecciona cualquier día; la semana se normaliza al lunes.
            </p>
          </div>

          {/* Preview de la semana */}
          {previewWeekStartDate && (
            <div
              className="rounded-xl bg-slate-50 p-3 border border-slate-200"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  {getFullRangeLabel(previewWeekStartDate)}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {getMonthYearLabel(previewWeekStartDate)} · Sem {getWeekOfMonth(previewWeekStartDate)}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {previewWeekStartDate} (lunes)
              </div>
            </div>
          )}

          {/* Mensaje de error/duplicado */}
          {error && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <span className="size-3.5" role="img" aria-label="Alerta">⚠</span>
              {error}
            </p>
          )}

          {/* Selector de modo: crear vacía vs clonar */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsDuplicate(false)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                !isDuplicate
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Plus className="size-3.5 inline mr-1" aria-hidden="true" />
              Crear vacía
            </button>
            <button
              type="button"
              onClick={() => setIsDuplicate(true)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                isDuplicate
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Copy className="size-3.5 inline mr-1" aria-hidden="true" />
              Clonar existente
            </button>
          </div>

          {/* Selector de semana origen para clonar */}
          {isDuplicate && availableSourceWeeks.length > 0 && (
            <div>
              <label
                htmlFor="source-week"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Semana origen
              </label>
              <select
                id="source-week"
                value={selectedSourceWeek}
                onChange={(e) => setSelectedSourceWeek(e.target.value as WeekStartDate)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="">Seleccionar semana</option>
                {availableSourceWeeks.map((week) => (
                  <option key={week} value={week}>
                    {getCompactRangeLabel(week)} · Sem {getWeekOfMonth(week)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
{isDuplicate ? (
              <button
                type="button"
                onClick={handleCloneExisting}
                disabled={!selectedSourceWeek || !previewWeekStartDate || !!error}
                className="flex-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clonar
                </button>
              ) : (
              <button
                type="button"
                onClick={handleCreateEmpty}
                disabled={!previewWeekStartDate || !!error}
                className="flex-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}