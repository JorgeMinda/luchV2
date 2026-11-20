/**
 * Tipos de base de datos generados desde el esquema Supabase (migraciones 001 + 002) - Single-Tenant F.1
 * Estos tipos deben mantenerse sincronizados con las migraciones SQL.
 * En producción, usar `supabase gen types typescript --project-id <id>` o CLI local.
 */

import type { Json } from './json'

// ============================================================
// ENUMS / TIPOS BASE
// ============================================================

export type UserRole = 'admin' | 'parent' | 'canteen'
export type IngredientStatus = 'ACTIVO' | 'INACTIVO'
export type DishCategory =
  | 'Sopa'
  | 'Proteína'
  | 'Guarnición'
  | 'Ensalada'
  | 'Bebida Fría'
  | 'Postre'
  | 'Fruta'
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'
export type ServiceType = 'lunch' | 'breakfast' | 'snack'
export type TransactionStatus = 'pending' | 'approved' | 'rejected'
export type ConsumptionSource = 'qr' | 'manual'
export type ImportStatus = 'pending' | 'analyzing' | 'preview' | 'committed' | 'failed'
export type SourceFormat = 'csv' | 'xlsx' | 'xls'
export type SourceType = 'CATALOG' | 'RECIPE_COSTING' | 'MENU_PLAN' | 'MEAL_COMPOSITION'
export type MealCompositionComponentType =
  | 'PROTEINA'
  | 'GUARNICION'
  | 'ARROZ'
  | 'ENSALADA'
  | 'FRUTA'
  | 'SOPA'
  | 'POSTRE'
  | 'SALSAS'
  | 'JUGO'
export type PersistenceResult = 'pending' | 'success' | 'partial' | 'failed'
export type ImportedRowStatus = 'valid' | 'warning' | 'error'
export type UnitOfMeasure = 'g' | 'kg' | 'ml' | 'l' | 'un' | 'lb' | 'oz'

// ============================================================
// TABLAS PRINCIPALES
// ============================================================

export interface UsersRow {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface IngredientsRow {
  id: string
  code: string
  category: string
  product: string
  presentation: string
  cost_cents: number
  purchase_unit_cost_raw: number | null
  source_formula: string | null
  status: IngredientStatus
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export interface DishesRow {
  id: string
  name: string
  category: DishCategory
  description: string
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export interface DishRecipesRow {
  id: string
  dish_id: string
  source: string
  service_type: ServiceType
  portions: number | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export interface RecipeIngredientsRow {
  id: string
  recipe_id: string
  ingredient_id: string | null
  name: string
  purchase_presentation: string
  purchase_price_cents: number
  purchase_quantity: number
  recipe_quantity: number
  purchase_unit_cost_raw: number | null
  source_formula: string | null
  source_cell: string | null
  yield_percentage: number | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
}

export interface MealCompositionTemplatesRow {
  id: string
  name: string
  service_type: ServiceType
  target_total_cost_cents: number | null
  calculated_total_cost_cents: number | null
  tolerance_cents: number
  aliases: string[] | null
  provenance: Json | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export interface MealCompositionComponentsRow {
  id: string
  template_id: string
  component_type: MealCompositionComponentType
  name: string
  standard_quantity: number | null
  unit: UnitOfMeasure | null
  net_quantity_per_portion: number | null
  reference_unit_cost_cents: number | null
  reference_unit_cost_raw: number | null
  source_formula: string | null
  source_cell: string | null
  target_portion_cost_cents: number | null
  calculated_cost_cents: number | null
  yield_percentage: number | null
  merma_percentage: number | null
  aliases: string[] | null
  provenance: Json | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
}

export interface MenuPlanCellsRow {
  id: string
  week_start_date: string
  day: WeekDay
  category: DishCategory
  slot: number
  dish_id: string
  service_type: ServiceType
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
}

export interface StudentsRow {
  id: string
  parent_id: string
  name: string
  grade: string
  balance_cents: number
  qr_code: string
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export interface TransactionsRow {
  id: string
  student_id: string
  parent_id: string
  amount_cents: number
  receipt_url: string
  status: TransactionStatus
  created_at: string
  approved_at: string | null
}

export interface ConsumptionsRow {
  id: string
  student_id: string
  meals: number
  total_cents: number
  source: ConsumptionSource
  created_at: string
}

export interface ImportBatchesRow {
  id: string
  file_name: string
  file_hash: string
  status: ImportStatus
  created_at: string
  processed_at: string | null
  total_rows: number
  valid_rows: number
  warning_rows: number
  error_rows: number
  approved_rows: number
  rejected_rows: number
  source_format: SourceFormat
  encoding: string | null
  source_type: SourceType | null
  analysis_version: string | null
  provenance: string | null
}

export interface ImportedRowsRow {
  id: string
  batch_id: string
  row_index: number
  sheet_name: string | null
  source_type: SourceType
  raw_data: Json
  normalized_data: Json | null
  status: ImportedRowStatus
  error_message: string | null
  warning_messages: string[] | null
  created_at: string
}

export interface ImportAuditLogsRow {
  id: string
  batch_id: string
  operator_id: string
  operator_role: string
  timestamp: string
  file_name: string
  file_hash: string
  format: string
  sheet_name: string | null
  source_type: SourceType | null
  analysis_version: string | null
  total_rows: number
  valid_rows: number
  warning_rows: number
  error_rows: number
  transformations: string[] | null
  corrections: string[] | null
  approvals: string[] | null
  rejections: string[] | null
  persistence_result: PersistenceResult
}

// ============================================================
// TIPOS PARA INSERTS (sin campos auto-generados)
// ============================================================

export interface UsersInsert {
  id: string
  email: string
  full_name?: string | null
  role?: UserRole
  is_active?: boolean
}

export interface IngredientsInsert {
  code: string
  category: string
  product: string
  presentation: string
  cost_cents: number
  purchase_unit_cost_raw?: number | null
  source_formula?: string | null
  status?: IngredientStatus
  is_active?: boolean
}

export interface DishesInsert {
  name: string
  category: DishCategory
  description?: string
  is_active?: boolean
}

export interface DishRecipesInsert {
  dish_id: string
  source: string
  service_type: ServiceType
  portions?: number | null
  is_active?: boolean
}

export interface RecipeIngredientsInsert {
  recipe_id: string
  ingredient_id?: string | null
  name: string
  purchase_presentation: string
  purchase_price_cents: number
  purchase_quantity: number
  recipe_quantity: number
  purchase_unit_cost_raw?: number | null
  source_formula?: string | null
  source_cell?: string | null
  yield_percentage?: number | null
  is_active?: boolean
}

export interface MealCompositionTemplatesInsert {
  name: string
  service_type: ServiceType
  target_total_cost_cents?: number | null
  calculated_total_cost_cents?: number | null
  tolerance_cents?: number
  aliases?: string[] | null
  provenance?: Json | null
  is_active?: boolean
}

export interface MealCompositionComponentsInsert {
  template_id: string
  component_type: MealCompositionComponentType
  name: string
  standard_quantity?: number | null
  unit?: UnitOfMeasure | null
  net_quantity_per_portion?: number | null
  reference_unit_cost_cents?: number | null
  reference_unit_cost_raw?: number | null
  source_formula?: string | null
  source_cell?: string | null
  target_portion_cost_cents?: number | null
  calculated_cost_cents?: number | null
  yield_percentage?: number | null
  merma_percentage?: number | null
  aliases?: string[] | null
  provenance?: Json | null
  is_active?: boolean
}

export interface MenuPlanCellsInsert {
  week_start_date: string
  day: WeekDay
  category: DishCategory
  slot: number
  dish_id: string
  service_type: ServiceType
  is_active?: boolean
}

export interface StudentsInsert {
  parent_id: string
  name: string
  grade: string
  balance_cents?: number
  qr_code: string
  is_active?: boolean
}

export interface TransactionsInsert {
  student_id: string
  parent_id: string
  amount_cents: number
  receipt_url: string
  status?: TransactionStatus
}

export interface ConsumptionsInsert {
  student_id: string
  meals: number
  total_cents: number
  source: ConsumptionSource
}

export interface ImportBatchesInsert {
  file_name: string
  file_hash: string
  status?: ImportStatus
  total_rows?: number
  valid_rows?: number
  warning_rows?: number
  error_rows?: number
  approved_rows?: number
  rejected_rows?: number
  source_format: SourceFormat
  encoding?: string | null
  source_type?: SourceType | null
  analysis_version?: string | null
  provenance?: string | null
}

export interface ImportedRowsInsert {
  batch_id: string
  row_index: number
  sheet_name?: string | null
  source_type: SourceType
  raw_data: Json
  normalized_data?: Json | null
  status?: ImportedRowStatus
  error_message?: string | null
  warning_messages?: string[] | null
}

export interface ImportAuditLogsInsert {
  batch_id: string
  operator_id: string
  operator_role: string
  file_name: string
  file_hash: string
  format: string
  sheet_name?: string | null
  source_type?: SourceType | null
  analysis_version?: string | null
  total_rows: number
  valid_rows: number
  warning_rows: number
  error_rows: number
  transformations?: string[] | null
  corrections?: string[] | null
  approvals?: string[] | null
  rejections?: string[] | null
  persistence_result: PersistenceResult
}

// ============================================================
// TIPOS PARA UPDATES (campos opcionales)
// ============================================================

export interface UsersUpdate {
  email?: string
  full_name?: string | null
  role?: UserRole
  is_active?: boolean
}

export interface IngredientsUpdate {
  code?: string
  category?: string
  product?: string
  presentation?: string
  cost_cents?: number
  purchase_unit_cost_raw?: number | null
  source_formula?: string | null
  status?: IngredientStatus
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface DishesUpdate {
  name?: string
  category?: DishCategory
  description?: string
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface DishRecipesUpdate {
  source?: string
  service_type?: ServiceType
  portions?: number | null
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface RecipeIngredientsUpdate {
  ingredient_id?: string | null
  name?: string
  purchase_presentation?: string
  purchase_price_cents?: number
  purchase_quantity?: number
  recipe_quantity?: number
  purchase_unit_cost_raw?: number | null
  source_formula?: string | null
  source_cell?: string | null
  yield_percentage?: number | null
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface MealCompositionTemplatesUpdate {
  name?: string
  service_type?: ServiceType
  target_total_cost_cents?: number | null
  calculated_total_cost_cents?: number | null
  tolerance_cents?: number
  aliases?: string[] | null
  provenance?: Json | null
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface MealCompositionComponentsUpdate {
  component_type?: MealCompositionComponentType
  name?: string
  standard_quantity?: number | null
  unit?: UnitOfMeasure | null
  net_quantity_per_portion?: number | null
  reference_unit_cost_cents?: number | null
  reference_unit_cost_raw?: number | null
  source_formula?: string | null
  source_cell?: string | null
  target_portion_cost_cents?: number | null
  calculated_cost_cents?: number | null
  yield_percentage?: number | null
  merma_percentage?: number | null
  aliases?: string[] | null
  provenance?: Json | null
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface MenuPlanCellsUpdate {
  week_start_date?: string
  day?: WeekDay
  category?: DishCategory
  slot?: number
  dish_id?: string
  service_type?: ServiceType
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface StudentsUpdate {
  parent_id?: string
  name?: string
  grade?: string
  balance_cents?: number
  qr_code?: string
  is_active?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

export interface TransactionsUpdate {
  status?: TransactionStatus
  approved_at?: string | null
}

export interface ConsumptionsUpdate {
  meals?: number
  total_cents?: number
  source?: ConsumptionSource
}

export interface ImportBatchesUpdate {
  status?: ImportStatus
  processed_at?: string | null
  total_rows?: number
  valid_rows?: number
  warning_rows?: number
  error_rows?: number
  approved_rows?: number
  rejected_rows?: number
}

export interface ImportedRowsUpdate {
  normalized_data?: Json | null
  status?: ImportedRowStatus
  error_message?: string | null
  warning_messages?: string[] | null
}

export interface ImportAuditLogsUpdate {
  persistence_result?: PersistenceResult
}

// ============================================================
// ESQUEMA COMPLETO PARA SUPABASE CLIENT
// ============================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UsersRow
        Insert: UsersInsert
        Update: UsersUpdate
      }
      ingredients: {
        Row: IngredientsRow
        Insert: IngredientsInsert
        Update: IngredientsUpdate
      }
      dishes: {
        Row: DishesRow
        Insert: DishesInsert
        Update: DishesUpdate
      }
      dish_recipes: {
        Row: DishRecipesRow
        Insert: DishRecipesInsert
        Update: DishRecipesUpdate
      }
      recipe_ingredients: {
        Row: RecipeIngredientsRow
        Insert: RecipeIngredientsInsert
        Update: RecipeIngredientsUpdate
      }
      meal_composition_templates: {
        Row: MealCompositionTemplatesRow
        Insert: MealCompositionTemplatesInsert
        Update: MealCompositionTemplatesUpdate
      }
      meal_composition_components: {
        Row: MealCompositionComponentsRow
        Insert: MealCompositionComponentsInsert
        Update: MealCompositionComponentsUpdate
      }
      menu_plan_cells: {
        Row: MenuPlanCellsRow
        Insert: MenuPlanCellsInsert
        Update: MenuPlanCellsUpdate
      }
      students: {
        Row: StudentsRow
        Insert: StudentsInsert
        Update: StudentsUpdate
      }
      transactions: {
        Row: TransactionsRow
        Insert: TransactionsInsert
        Update: TransactionsUpdate
      }
      consumptions: {
        Row: ConsumptionsRow
        Insert: ConsumptionsInsert
        Update: ConsumptionsUpdate
      }
      import_batches: {
        Row: ImportBatchesRow
        Insert: ImportBatchesInsert
        Update: ImportBatchesUpdate
      }
      imported_rows: {
        Row: ImportedRowsRow
        Insert: ImportedRowsInsert
        Update: ImportedRowsUpdate
      }
      import_audit_logs: {
        Row: ImportAuditLogsRow
        Insert: ImportAuditLogsInsert
        Update: ImportAuditLogsUpdate
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_canteen_or_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_parent: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_updated_at_column: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: {
      user_role: UserRole
      ingredient_status: IngredientStatus
      dish_category: DishCategory
      week_day: WeekDay
      service_type: ServiceType
      transaction_status: TransactionStatus
      consumption_source: ConsumptionSource
      import_status: ImportStatus
      source_format: SourceFormat
      source_type: SourceType
      meal_composition_component_type: MealCompositionComponentType
      persistence_result: PersistenceResult
      imported_row_status: ImportedRowStatus
      unit_of_measure: UnitOfMeasure
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}