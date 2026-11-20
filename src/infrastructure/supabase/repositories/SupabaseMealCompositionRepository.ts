import type { MealCompositionTemplate, MealCompositionComponent, NewMealCompositionTemplate, NewMealCompositionComponent } from '../../../domain/entities/meal-composition-template'
import type { MealCompositionRepository } from '../../../application/ports/MealCompositionRepository'
import { SupabaseRepositoryBase } from './SupabaseRepositoryBase'
import type { TypedSupabaseClient } from './SupabaseRepositoryBase'
import { fromCents } from '../../../domain/value-objects/money'
import type { MealCompositionTemplatesRow, MealCompositionTemplatesInsert, MealCompositionTemplatesUpdate, MealCompositionComponentsRow, MealCompositionComponentsInsert, MealCompositionComponentsUpdate } from '../database.types'
import type { Json } from '../json'

/**
 * Mapea fila de BD a MealCompositionComponent de dominio.
 */
function mapRowToComponent(row: MealCompositionComponentsRow): MealCompositionComponent {
  return {
    id: row.id,
    componentType: row.component_type,
    name: row.name,
    standardQuantity: row.standard_quantity ?? undefined,
    unit: row.unit ?? undefined,
    netQuantityPerPortion: row.net_quantity_per_portion ?? undefined,
    referenceUnitCost: row.reference_unit_cost_cents !== null && row.reference_unit_cost_cents !== undefined
      ? fromCents(row.reference_unit_cost_cents)
      : undefined,
    targetPortionCost: row.target_portion_cost_cents !== null && row.target_portion_cost_cents !== undefined
      ? fromCents(row.target_portion_cost_cents)
      : undefined,
    calculatedCost: row.calculated_cost_cents !== null && row.calculated_cost_cents !== undefined
      ? fromCents(row.calculated_cost_cents)
      : undefined,
    yieldPercentage: row.yield_percentage ?? undefined,
    mermaPercentage: row.merma_percentage ?? undefined,
    aliases: row.aliases ?? undefined,
    provenance: row.provenance as unknown as MealCompositionComponent['provenance'] | undefined,
    referenceUnitCostRaw: row.reference_unit_cost_raw ?? undefined,
    sourceFormula: row.source_formula ?? undefined,
    sourceCell: row.source_cell ?? undefined,
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined,
  }
}

/**
 * Mapea fila de BD + componentes a MealCompositionTemplate de dominio.
 */
async function mapRowToTemplate(
  client: TypedSupabaseClient,
  row: MealCompositionTemplatesRow,
): Promise<MealCompositionTemplate> {
  const { data: components, error } = await client
    .from('meal_composition_components')
    .select('*')
    .eq('template_id', row.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error

  return {
    id: row.id,
    name: row.name,
    serviceType: row.service_type,
    components: (components ?? []).map(mapRowToComponent),
    targetTotalCost: row.target_total_cost_cents !== null && row.target_total_cost_cents !== undefined
      ? fromCents(row.target_total_cost_cents)
      : undefined,
    calculatedTotalCost: row.calculated_total_cost_cents !== null && row.calculated_total_cost_cents !== undefined
      ? fromCents(row.calculated_total_cost_cents)
      : undefined,
    tolerance: row.tolerance_cents ?? undefined,
    aliases: row.aliases ?? undefined,
    provenance: row.provenance as unknown as MealCompositionTemplate['provenance'] | undefined,
    isActive: row.is_active,
    deletedAt: row.deleted_at ?? undefined,
    deletedBy: undefined,
  }
}

/**
 * Repositorio Supabase para MealCompositionTemplates.
 * Single-tenant (F.1): sin school_id, RLS por auth.uid() + role.
 * Incluye ServiceType (F.6) y precisión sub-centavo (F.7).
 * Borrado lógico (is_active, deleted_at, deleted_by).
 */
export class SupabaseMealCompositionRepository
  extends SupabaseRepositoryBase
  implements MealCompositionRepository {
  constructor(client?: TypedSupabaseClient) {
    super(client)
  }

  listSnapshot(): MealCompositionTemplate[] {
    return []
  }

  async list(): Promise<MealCompositionTemplate[]> {
    const { data, error } = await this.client
      .from('meal_composition_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) this.handleError(error, 'listar plantillas de composición')

    const results: MealCompositionTemplate[] = []
    for (const template of data ?? []) {
      results.push(await mapRowToTemplate(this.client, template))
    }
    return results
  }

  async getById(id: string): Promise<MealCompositionTemplate | null> {
    const { data: template, error } = await this.client
      .from('meal_composition_templates')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) this.handleError(error, 'obtener plantilla por ID')
    if (!template) return null

    return mapRowToTemplate(this.client, template)
  }

  async saveMany(templates: NewMealCompositionTemplate[]): Promise<MealCompositionTemplate[]> {
    if (templates.length === 0) return []

    const results: MealCompositionTemplate[] = []

    for (const template of templates) {
      // 1. Upsert meal_composition_templates
      const templateInsert: MealCompositionTemplatesInsert = {
        name: template.name,
        service_type: template.serviceType,
        target_total_cost_cents: template.targetTotalCost?.cents ?? null,
        calculated_total_cost_cents: template.calculatedTotalCost?.cents ?? null,
        tolerance_cents: template.tolerance ?? 1,
        aliases: template.aliases ? [...template.aliases] : null,
        provenance: template.provenance as unknown as Json | null,
        is_active: true,
      }

      const templateRow = await this.upsertOne<MealCompositionTemplatesRow, MealCompositionTemplatesInsert>(
        'meal_composition_templates',
        templateInsert,
        { onConflict: 'name', ignoreDuplicates: false }
      )

      // 2. Soft delete existing components for this template
      const currentUser = await this.getCurrentUser()
      if (!currentUser) throw new Error('Usuario no autenticado')

      const deleteUpdate: MealCompositionComponentsUpdate = {
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser.id,
      }

      await this.updateRows<MealCompositionComponentsUpdate>('meal_composition_components', deleteUpdate, { template_id: templateRow.id })

      // 3. Insert new components
      if (template.components.length > 0) {
        const componentRows: MealCompositionComponentsInsert[] = template.components.map((comp: NewMealCompositionComponent) => ({
          template_id: templateRow.id,
          component_type: comp.componentType,
          name: comp.name,
          standard_quantity: comp.standardQuantity ?? null,
          unit: comp.unit ?? null,
          net_quantity_per_portion: comp.netQuantityPerPortion ?? null,
          reference_unit_cost_cents: comp.referenceUnitCost?.cents ?? null,
          reference_unit_cost_raw: comp.referenceUnitCostRaw ?? null,
          source_formula: comp.sourceFormula ?? null,
          source_cell: comp.sourceCell ?? null,
          target_portion_cost_cents: comp.targetPortionCost?.cents ?? null,
          calculated_cost_cents: comp.calculatedCost?.cents ?? null,
          yield_percentage: comp.yieldPercentage ?? null,
          merma_percentage: comp.mermaPercentage ?? null,
          aliases: comp.aliases ? [...comp.aliases] : null,
          provenance: comp.provenance as unknown as Json | null,
          is_active: true,
        }))

        await this.insertRows<MealCompositionComponentsRow, MealCompositionComponentsInsert>('meal_composition_components', componentRows)
      }

      results.push(await mapRowToTemplate(this.client, templateRow))
    }

    return results
  }

  async removeById(id: string): Promise<void> {
    const currentUser = await this.getCurrentUser()
    if (!currentUser) throw new Error('Usuario no autenticado')

    const update: MealCompositionTemplatesUpdate = {
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: currentUser.id,
    }

    await this.updateRows<MealCompositionTemplatesUpdate>('meal_composition_templates', update, { id })
  }
}