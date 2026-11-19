import { useState } from 'react'
import { readSpreadsheetMatrix } from '../utils/spreadsheet'
import {
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react'

interface ImportStep {
  id: string
  label: string
  completed: boolean
  active: boolean
}

interface ImportedRowUI {
  rowNumber: number
  original: Record<string, string>
  normalized: Record<string, string>
  status: 'valid' | 'warning' | 'error'
  issues: string[]
  selected: boolean
}

interface ImportState {
  step: 'select' | 'preview' | 'confirm' | 'done'
  fileName: string | null
  fileType: 'csv' | 'xlsx' | 'xls' | null
  rows: ImportedRowUI[]
  stats: { total: number; valid: number; warnings: number; errors: number }
  batchId: string | null
  error: string | null
  isProcessing: boolean
}

const STEPS: ImportStep[] = [
  { id: 'select', label: 'Seleccionar archivo', completed: false, active: true },
  { id: 'preview', label: 'Previsualizar', completed: false, active: false },
  { id: 'confirm', label: 'Confirmar importación', completed: false, active: false },
  { id: 'done', label: 'Completado', completed: false, active: false },
]

export function ImportManager() {
  const [state, setState] = useState<ImportState>({
    step: 'select',
    fileName: null,
    fileType: null,
    rows: [],
    stats: { total: 0, valid: 0, warnings: 0, errors: 0 },
    batchId: null,
    error: null,
    isProcessing: false,
  })

  const handleFileSelect = async (file: File) => {
    setState((prev) => ({
      ...prev,
      fileName: file.name,
      fileType: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
      error: null,
      isProcessing: true,
    }))

    try {
      const matrix = await readSpreadsheetMatrix(file)
      const nonEmptyRows = matrix.filter((row) =>
        row.some((cell) => String(cell ?? '').trim() !== ''),
      )

      if (nonEmptyRows.length < 2) {
        throw new Error('El archivo no contiene datos vǭlidos.')
      }

      const headers = nonEmptyRows[0].map((cell) =>
        String(cell ?? '').trim(),
      )
      const rows: ImportedRowUI[] = []
      let valid = 0
      let warnings = 0
      let errors = 0

      nonEmptyRows.slice(1).forEach((row, index) => {
        const values = headers.map((_, columnIndex) =>
          String(row[columnIndex] ?? '').trim(),
        )

        const original: Record<string, string> = {}
        const normalized: Record<string, string> = {}
        const issues: string[] = []

        headers.forEach((header, columnIndex) => {
          original[header] = values[columnIndex] || ''
          normalized[header] = values[columnIndex] || ''
        })

        if (!original['nombre'] && !original['nombre del plato']) {
          issues.push('Nombre del plato requerido')
        }
        if (!original['cantidad'] && !original['gramos']) {
          issues.push('Cantidad requerida')
        }

        const importedRow: ImportedRowUI = {
          rowNumber: index + 2,
          original,
          normalized,
          status: issues.length > 0 ? 'error' : 'valid',
          issues,
          selected: true,
        }

        if (importedRow.status === 'error') errors++
        else if (importedRow.status === 'warning') warnings++
        else valid++

        rows.push(importedRow)
      })

      setState((prev) => ({
        ...prev,
        step: 'preview',
        rows,
        stats: { total: rows.length, valid, warnings, errors },
        isProcessing: false,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Error al leer el archivo',
      }))
    }
  }

  const handleToggleRow = (rowNumber: number) => {
    setState((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.rowNumber === rowNumber ? { ...r, selected: !r.selected } : r
      ),
    }))
  }

  const handleToggleAll = () => {
    const allSelected = state.rows.every((r) => r.selected)
    setState((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => ({ ...r, selected: !allSelected })),
    }))
  }

  const handleConfirm = async () => {
    const selectedRows = state.rows.filter((r) => r.selected)
    if (selectedRows.length === 0) {
      setState((prev) => ({ ...prev, error: 'Seleccione al menos un registro para importar' }))
      return
    }

    setState((prev) => ({ ...prev, isProcessing: true }))

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setState((prev) => ({
        ...prev,
        step: 'done',
        isProcessing: false,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: 'Error al importar los datos',
      }))
    }
  }

  const handleReset = () => {
    setState({
      step: 'select',
      fileName: null,
      fileType: null,
      rows: [],
      stats: { total: 0, valid: 0, warnings: 0, errors: 0 },
      batchId: null,
      error: null,
      isProcessing: false,
    })
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700 mb-4">
          <FileSpreadsheet className="size-8" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Importar datos</h2>
        <p className="mt-2 text-slate-600">Carga tus archivos CSV o Excel para importar datos al sistema</p>
      </div>

      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <div
              className={`flex size-10 items-center justify-center rounded-full ${
                step.completed
                  ? 'bg-brand-500 text-white'
                  : step.active
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step.completed ? (
                <CheckCircle2 className="size-5" aria-hidden="true" />
              ) : step.active ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <span className="text-xs font-medium">{idx + 1}</span>
              )}
            </div>
            <span className={`text-xs font-medium ${step.active ? 'text-brand-700' : 'text-slate-500'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {state.step === 'select' && (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div
            className="flex-1 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-12 py-12 hover:border-brand-300 hover:bg-brand-50 cursor-pointer transition-colors"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <CloudUpload className="size-12 text-brand-400 mb-4" aria-hidden="true" />
            <p className="text-lg font-medium text-slate-900">Seleccionar archivo</p>
            <p className="mt-2 text-sm text-slate-600">CSV o Excel (.csv, .xlsx, .xls) · Máx. 10 MB</p>
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
            />
            <p className="mt-4 text-xs text-slate-400">O arrastra el archivo aquí</p>
          </div>
        </div>
      )}

      {state.step === 'preview' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{state.fileName}</p>
              <p className="text-xs text-slate-500">{state.fileType} · {state.rows.length} filas detectadas</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <FileText className="size-4" aria-hidden="true" />
                Cambiar archivo
              </button>
              <button
                onClick={handleConfirm}
                disabled={state.rows.filter((r) => r.selected).length === 0}
                className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Importar seleccionados ({state.rows.filter((r) => r.selected).length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total</p>
              <p className="text-2xl font-bold text-slate-900">{state.stats.total}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase">Válidos</p>
              <p className="text-2xl font-bold text-emerald-700">{state.stats.valid}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <p className="text-xs font-semibold text-rose-700 uppercase">Errores</p>
              <p className="text-2xl font-bold text-rose-700">{state.stats.errors}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center w-8">
                      <input
                        type="checkbox"
                        checked={state.rows.length > 0 && state.rows.every((r) => r.selected)}
                        onChange={handleToggleAll}
                        className="rounded text-brand-700 focus:ring-brand-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Fila</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Datos</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`transition-colors ${row.selected ? 'bg-slate-50' : ''} ${row.status === 'error' ? 'bg-rose-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => handleToggleRow(row.rowNumber)}
                          className="rounded text-brand-700 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-900">#{row.rowNumber}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex items-center gap-3 truncate">
                          <span className="truncate">{row.original.nombre || row.original['nombre del plato'] || 'Sin nombre'}</span>
                          <span className="text-xs text-slate-400">({row.original.cantidad || row.original.gramos || '-'})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.status === 'valid' ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            <span className="flex size-3 items-center justify-center rounded-full bg-emerald-700 text-[10px] text-white">✓</span>
                            Válido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                            <span className="flex size-3 items-center justify-center rounded-full bg-rose-700 text-[10px] text-white">✕</span>
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Cambiar archivo
            </button>
            <button
              onClick={handleConfirm}
              disabled={state.rows.filter((r) => r.selected).length === 0}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isProcessing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {state.isProcessing ? 'Importando...' : `Importar seleccionados (${state.rows.filter((r) => r.selected).length})`}
            </button>
          </div>
        </div>
      )}

      {state.step === 'done' && (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 mb-6">
            <CheckCircle2 className="size-10" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">¡Importación completada!</h2>
          <p className="mt-2 text-slate-600">
            Se importaron {state.stats.valid} registros correctamente.
          </p>
          <button
            onClick={handleReset}
            className="mt-8 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Importar otro archivo
          </button>
        </div>
      )}

      {state.error && (
        <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="ml-2">{state.error}</span>
        </div>
      )}
    </div>
  )
}
