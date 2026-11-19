/**
 * Tipos de base de datos generados desde el esquema Supabase (migraciones 001 + 002).
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
export type UnitOfMeasure = 'g' | 'kg' | 'ml' | 'l' | 'un' | 'lb' | 'oz'

// ============================================================
// TABLAS PRINCIPALES
// ============================================================

export interface SchoolsRow {
  id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SchoolUsersRow {
  id: string
  school_id: string
  user_id: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface IngredientsRow {
  id: string
  school_id: string
  code: string
  category: string
  product: string
  presentation: string
  cost_cents: number
  purchase_unit_cost_raw: number | null
  source_formula: string | null
  status: IngredientStatus
  created_at: string
  updated_at: string
}

export interface DishesRow {
  id: string
  school_id: string
  name: string
  category: DishCategory
  description: string
  created_at: string
  updated_at: string
}

export interface DishRecipesRow {
  id: string
  school_id: string
  dish_id: string
  source: string
  service_type: ServiceType
  portions: number | null
  updated_at: string
}

export interface RecipeIngredientsRow {
  id: string
  school_id: string
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
  created_at: string
}

export interface MealCompositionTemplatesRow {
  id: string
  school_id: string
  name: string
  service_type: ServiceType
  target_total_cost_cents: number | null
  calculated_total_cost_cents: number | null
  tolerance_cents: number
  aliases: string[] | null
  provenance: Json | null
  created_at: string
  updated_at: string
}

export interface MealCompositionComponentsRow {
  id: string
  school_id: string
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
  created_at: string
}

export interface MenuPlanCellsRow {
  id: string
  school_id: string
  week_start_date: string
  day: WeekDay
  category: DishCategory
  slot: number
  dish_id: string
  service_type: ServiceType
  created_at: string
}

export interface StudentsRow {
  id: string
  school_id: string
  parent_id: string
  name: string
  grade: string
  balance_cents: number
  qr_code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TransactionsRow {
  id: string
  school_id: string
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
  school_id: string
  student_id: string
  meals: number
  total_cents: number
  source: ConsumptionSource
  created_at: string
}

export interface ImportBatchesRow {
  id: string
  school_id: string
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

export interface ImportAuditLogsRow {
  id: string
  school_id: string
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

export interface SchoolsInsert {
  name: string
  code: string
  address?: string | null
  phone?: string | null
  email?: string | null
  is_active?: boolean
}

export interface SchoolUsersInsert {
  school_id: string
  user_id: string
  role: UserRole
  is_active?: boolean
}

export interface IngredientsInsert {
  school_id: string
  code: string
  category: string
  product: string
  presentation: string
  cost_cents: number
  purchase_unit_cost_raw?: number | null
  source_formula?: string | null
  status?: IngredientStatus
}

export interface DishesInsert {
  school_id: string
  name: string
  category: DishCategory
  description?: string
}

export interface DishRecipesInsert {
  school_id: string
  dish_id: string
  source: string
  service_type: ServiceType
  portions?: number | null
}

export interface RecipeIngredientsInsert {
  school_id: string
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
}

export interface MealCompositionTemplatesInsert {
  school_id: string
  name: string
  service_type: ServiceType
  target_total_cost_cents?: number | null
  calculated_total_cost_cents?: number | null
  tolerance_cents?: number
  aliases?: string[] | null
  provenance?: Json | null
}

export interface MealCompositionComponentsInsert {
  school_id: string
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
}

export interface MenuPlanCellsInsert {
  school_id: string
  week_start_date: string
  day: WeekDay
  category: DishCategory
  slot: number
  dish_id: string
  service_type: ServiceType
}

export interface StudentsInsert {
  school_id: string
  parent_id: string
  name: string
  grade: string
  balance_cents?: number
  qr_code: string
  is_active?: boolean
}

export interface TransactionsInsert {
  school_id: string
  student_id: string
  parent_id: string
  amount_cents: number
  receipt_url: string
  status?: TransactionStatus
}

export interface ConsumptionsInsert {
  school_id: string
  student_id: string
  meals: number
  total_cents: number
  source: ConsumptionSource
}

export interface ImportBatchesInsert {
  school_id: string
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

export interface ImportAuditLogsInsert {
  school_id: string
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

export interface SchoolsUpdate {
  name?: string
  code?: string
  address?: string | null
  phone?: string | null
  email?: string | null
  is_active?: boolean
}

export interface SchoolUsersUpdate {
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
}

export interface DishesUpdate {
  name?: string
  category?: DishCategory
  description?: string
}

export interface DishRecipesUpdate {
  source?: string
  service_type?: ServiceType
  portions?: number | null
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
}

export interface MealCompositionTemplatesUpdate {
  name?: string
  service_type?: ServiceType
  target_total_cost_cents?: number | null
  calculated_total_cost_cents?: number | null
  tolerance_cents?: number
  aliases?: string[] | null
  provenance?: Json | null
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
}

export interface MenuPlanCellsUpdate {
  week_start_date?: string
  day?: WeekDay
  category?: DishCategory
  slot?: number
  dish_id?: string
  service_type?: ServiceType
}

export interface StudentsUpdate {
  parent_id?: string
  name?: string
  grade?: string
  balance_cents?: number
  qr_code?: string
  is_active?: boolean
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

export interface ImportAuditLogsUpdate {
  persistence_result?: PersistenceResult
}

// ============================================================
// ESQUEMA COMPLETO PARA SUPABASE CLIENT
// ============================================================

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: SchoolsRow
        Insert: SchoolsInsert
        Update: SchoolsUpdate
      }
      school_users: {
        Row: SchoolUsersRow
        Insert: SchoolUsersInsert
        Update: SchoolUsersUpdate
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
      current_user_school_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_school_admin: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      is_school_member: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      update_updated_at_column: {
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
      unit_of_measure: UnitOfMeasure
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}