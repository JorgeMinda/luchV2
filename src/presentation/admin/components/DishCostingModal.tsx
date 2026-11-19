import { useState } from 'react'
import {
  Banknote,
  Check,
  FileUp,
  Info,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from 'lucide-react'
import type {
  Dish,
  DishRecipe,
  RecipeIngredient,
} from '../../../domain/entities'
import {
  getDishRecipeTotalCost,
  getIngredientRecipeCost,
  getIngredientUnitCost,
  getRecipeIngredientsTotalCost,
} from '../../../domain/entities'
import { fromCents, fromDollars, toDollars } from '../../../domain/value-objects/money'
import { saveDishRecipeUseCase } from '../../../infrastructure/container'
import { Modal } from '../../shared/Modal'
import { getDishCategoryBadgeClass } from '../utils/dishCategories'
import {
  formatCostCurrency,
  formatRecipeQuantity,
  formatUnitCost,
  parseCostNumber,
  parseQuantityNumber,
} from '../utils/costFormat'

interface DishCostingModalProps {
  dish: Dish
  recipe: DishRecipe | null
  onClose: () => void
  onOpenImport: () => void
  onRecipeSaved: (recipe: DishRecipe) => void
}

interface EditableIngredient {
  id: string
  name: string
  purchasePresentation: string
  purchasePrice: string
  purchaseQuantity: string
  recipeQuantity: string
}

type EditableIngredientField = Exclude<keyof EditableIngredient, 'id'>

const inputClassName =
  'h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function toEditableIngredient(
  ingredient: RecipeIngredient,
): EditableIngredient {
  return {
    id: ingredient.id,
    name: ingredient.name,
    purchasePresentation: ingredient.purchasePresentation,
    purchasePrice: String(toDollars(ingredient.purchasePrice)),
    purchaseQuantity: String(ingredient.purchaseQuantity),
    recipeQuantity: String(ingredient.recipeQuantity),
  }
}

function createEmptyIngredient(): EditableIngredient {
  return {
    id: `recipe-line-${crypto.randomUUID()}`,
    name: '',
    purchasePresentation: '',
    purchasePrice: '',
    purchaseQuantity: '1',
    recipeQuantity: '',
  }
}

function toCalculatedIngredient(
  ingredient: EditableIngredient,
): RecipeIngredient {
  return {
    id: ingredient.id,
    name: ingredient.name.trim(),
    purchasePresentation: ingredient.purchasePresentation.trim(),
    purchasePrice: fromDollars(parseCostNumber(ingredient.purchasePrice) ?? 0),
    purchaseQuantity: parseQuantityNumber(ingredient.purchaseQuantity) ?? 0,
    recipeQuantity: parseQuantityNumber(ingredient.recipeQuantity) ?? 0,
  }
}

function isValidIngredient(ingredient: EditableIngredient): boolean {
  const purchasePrice = parseCostNumber(ingredient.purchasePrice)
  const purchaseQuantity = parseQuantityNumber(
    ingredient.purchaseQuantity,
  )
  const recipeQuantity = parseQuantityNumber(ingredient.recipeQuantity)

  return (
    ingredient.name.trim().length > 0 &&
    purchasePrice !== null &&
    purchasePrice >= 0 &&
    purchaseQuantity !== null &&
    purchaseQuantity > 0 &&
    recipeQuantity !== null &&
    recipeQuantity >= 0
  )
}

export function DishCostingModal({
  dish,
  recipe,
  onClose,
  onOpenImport,
  onRecipeSaved,
}: DishCostingModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editableIngredients, setEditableIngredients] = useState<
    EditableIngredient[]
  >(() => (recipe?.ingredients ?? []).map(toEditableIngredient))
  const totalCost = recipe
    ? getDishRecipeTotalCost(recipe)
    : fromCents(0)
  const editableTotalCost = getRecipeIngredientsTotalCost(
    editableIngredients.map(toCalculatedIngredient),
  )
  const canSave =
    editableIngredients.length > 0 &&
    editableIngredients.every(isValidIngredient)

  function startEditing() {
    setEditableIngredients(
      recipe
        ? recipe.ingredients.map(toEditableIngredient)
        : [createEmptyIngredient()],
    )
    setSaveError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setEditableIngredients(
      (recipe?.ingredients ?? []).map(toEditableIngredient),
    )
    setSaveError(null)
    setIsEditing(false)
  }

  function updateIngredient(
    id: string,
    field: EditableIngredientField,
    value: string,
  ) {
    setEditableIngredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id
          ? { ...ingredient, [field]: value }
          : ingredient,
      ),
    )
  }

  function addIngredient() {
    setEditableIngredients((current) => [
      ...current,
      createEmptyIngredient(),
    ])
  }

  function removeIngredient(id: string) {
    setEditableIngredients((current) =>
      current.filter((ingredient) => ingredient.id !== id),
    )
  }

  async function saveChanges() {
    if (!canSave || isSaving) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const saved = await saveDishRecipeUseCase.execute({
        dishId: dish.id,
        source: recipe?.source ?? 'Edición manual',
        ingredients: editableIngredients.map(toCalculatedIngredient),
      })
      setEditableIngredients(saved.ingredients.map(toEditableIngredient))
      setIsEditing(false)
      onRecipeSaved(saved)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la receta. Inténtalo de nuevo.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      titleId="dish-costing-title"
      maxWidthClassName="max-w-6xl"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
            <Banknote className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Ficha de costeo
            </p>
            <h2
              id="dish-costing-title"
              className="mt-1 text-xl font-semibold uppercase tracking-tight text-slate-900"
            >
              {dish.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${getDishCategoryBadgeClass(dish.category)}`}
              >
                {dish.category}
              </span>
              {recipe && (
                <span>
                  {recipe.ingredients.length}{' '}
                  {recipe.ingredients.length === 1
                    ? 'ingrediente'
                    : 'ingredientes'}
                  {recipe.source ? ` · ${recipe.source}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ficha de costeo"
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      {recipe || isEditing ? (
        <>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Ingrediente
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Presentación de compra
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-semibold"
                    >
                      PVP compra
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-semibold"
                    >
                      Cantidad de compra-presentación
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-semibold"
                    >
                      Costo por gr o uni
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-semibold"
                    >
                      Cantidad en receta
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-semibold"
                    >
                      Costo en receta
                    </th>
                    {isEditing && (
                      <th
                        scope="col"
                        className="px-3 py-3 text-right font-semibold"
                      >
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isEditing
                    ? editableIngredients.map((line, index) => {
                        const ingredient =
                          toCalculatedIngredient(line)

                        return (
                          <tr
                            key={line.id}
                            className="align-top hover:bg-slate-50/70"
                          >
                            <td className="px-3 py-2.5">
                              <input
                                value={line.name}
                                onChange={(event) =>
                                  updateIngredient(
                                    line.id,
                                    'name',
                                    event.target.value,
                                  )
                                }
                                aria-label={`Ingrediente ${index + 1}`}
                                className={inputClassName}
                                placeholder="Nombre del ingrediente"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                value={line.purchasePresentation}
                                onChange={(event) =>
                                  updateIngredient(
                                    line.id,
                                    'purchasePresentation',
                                    event.target.value,
                                  )
                                }
                                aria-label={`Presentación ${index + 1}`}
                                className={inputClassName}
                                placeholder="Ej. Funda 500 gr"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                value={line.purchasePrice}
                                onChange={(event) =>
                                  updateIngredient(
                                    line.id,
                                    'purchasePrice',
                                    event.target.value,
                                  )
                                }
                                inputMode="decimal"
                                aria-label={`PVP de compra ${index + 1}`}
                                className={`${inputClassName} text-right tabular-nums`}
                                placeholder="0,00"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                value={line.purchaseQuantity}
                                onChange={(event) =>
                                  updateIngredient(
                                    line.id,
                                    'purchaseQuantity',
                                    event.target.value,
                                  )
                                }
                                inputMode="decimal"
                                aria-label={`Cantidad de compra ${index + 1}`}
                                className={`${inputClassName} text-right tabular-nums`}
                                placeholder="1"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                              {formatUnitCost(
                                getIngredientUnitCost(ingredient),
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                value={line.recipeQuantity}
                                onChange={(event) =>
                                  updateIngredient(
                                    line.id,
                                    'recipeQuantity',
                                    event.target.value,
                                  )
                                }
                                inputMode="decimal"
                                aria-label={`Cantidad en receta ${index + 1}`}
                                className={`${inputClassName} text-right tabular-nums`}
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                              {formatCostCurrency(
                                getIngredientRecipeCost(ingredient),
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  removeIngredient(line.id)
                                }
                                aria-label={`Eliminar ingrediente ${index + 1}`}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              >
                                <Trash2
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    : recipe?.ingredients.map((ingredient) => (
                        <tr
                          key={ingredient.id}
                          className="align-top hover:bg-slate-50/70"
                        >
                          <td className="px-3 py-2.5 font-medium text-slate-800">
                            {ingredient.name}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {ingredient.purchasePresentation || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatCostCurrency(
                              ingredient.purchasePrice,
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatRecipeQuantity(
                              ingredient.purchaseQuantity,
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatUnitCost(
                              getIngredientUnitCost(ingredient),
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatRecipeQuantity(
                              ingredient.recipeQuantity,
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                            {formatCostCurrency(
                              getIngredientRecipeCost(ingredient),
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-emerald-50/70">
                    <td
                      colSpan={isEditing ? 7 : 6}
                      className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-emerald-900"
                    >
                      Costo total de producción
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-emerald-900">
                      {formatCostCurrency(
                        isEditing ? editableTotalCost : totalCost,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={addIngredient}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Agregar ingrediente
            </button>
          )}

          <p className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            El costo por gramo o unidad se calcula dividiendo el PVP de compra
            entre la cantidad de compra-presentación. El costo en receta
            multiplica ese valor por la cantidad usada. Puedes editar los
            precios y cantidades para recalcular el costo total.
          </p>
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm ring-1 ring-inset ring-slate-200">
            <ReceiptText className="size-6" aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            Este platillo aún no tiene receta de costeo
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Sube el archivo de costos del cliente o crea la receta manualmente.
            El costo total se calculará automáticamente.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onOpenImport}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <FileUp className="size-4" aria-hidden="true" />
              Subir archivo de costos
            </button>
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Crear receta manual
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {saveError}
        </p>
      )}

      <footer className="mt-5 flex flex-wrap justify-end gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                void saveChanges()
              }}
              disabled={!canSave || isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        ) : (
          <>
            {recipe && (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Editar costos
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Cerrar
            </button>
          </>
        )}
      </footer>
    </Modal>
  )
}
