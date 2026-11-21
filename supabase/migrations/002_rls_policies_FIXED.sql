-- Migración 002: Políticas RLS (Row Level Security) para Single-Tenant (F.1) - CORREGIDA
-- Todas las tablas tienen RLS habilitado y políticas basadas en auth.uid() + role desde public.users
-- NO hay school_id - aislamiento por usuario autenticado y rol

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_composition_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_composition_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_plan_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIONES AUXILIARES
-- ============================================================

-- Obtener rol del usuario actual desde public.users
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.users
    WHERE id = auth.uid() AND is_active;
    RETURN v_role;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar si el usuario actual es admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar si el usuario actual es canteen o admin (NOMBRE CORREGIDO)
CREATE OR REPLACE FUNCTION is_current_user_canteen_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() IN ('admin', 'canteen');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar si el usuario actual es parent
CREATE OR REPLACE FUNCTION is_current_user_parent()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() = 'parent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- POLÍTICAS PARA USERS
-- ============================================================
-- Usuario ve su propio perfil
CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (id = auth.uid());

-- Admins ven todos los perfiles
CREATE POLICY "users_select_admin" ON users
    FOR SELECT USING (is_current_user_admin());

-- Admins pueden actualizar cualquier perfil
CREATE POLICY "users_update_admin" ON users
    FOR UPDATE USING (is_current_user_admin());

-- Usuario puede actualizar su propio perfil (campos limitados via app logic)
CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- POLÍTICAS PARA INGREDIENTS
-- ============================================================
-- Todos los usuarios autenticados pueden ver ingredientes activos
CREATE POLICY "ingredients_select_authenticated" ON ingredients
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND is_active
    );

-- Solo admins y canteen pueden insertar
CREATE POLICY "ingredients_insert_canteen_admin" ON ingredients
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Solo admins y canteen pueden actualizar
CREATE POLICY "ingredients_update_canteen_admin" ON ingredients
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "ingredients_delete_admin" ON ingredients
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA DISHES
-- ============================================================
-- Todos los usuarios autenticados pueden ver platos activos
CREATE POLICY "dishes_select_authenticated" ON dishes
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND is_active
    );

-- Solo admins y canteen pueden insertar
CREATE POLICY "dishes_insert_canteen_admin" ON dishes
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Solo admins y canteen pueden actualizar
CREATE POLICY "dishes_update_canteen_admin" ON dishes
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "dishes_delete_admin" ON dishes
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA DISH_RECIPES
-- ============================================================
-- Todos los usuarios autenticados pueden ver recetas activas
CREATE POLICY "dish_recipes_select_authenticated" ON dish_recipes
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND is_active
    );

-- Solo admins y canteen pueden insertar
CREATE POLICY "dish_recipes_insert_canteen_admin" ON dish_recipes
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Solo admins y canteen pueden actualizar
CREATE POLICY "dish_recipes_update_canteen_admin" ON dish_recipes
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "dish_recipes_delete_admin" ON dish_recipes
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA RECIPE_INGREDIENTS
-- ============================================================
-- Todos los usuarios autenticados pueden ver ingredientes de receta activos
CREATE POLICY "recipe_ingredients_select_authenticated" ON recipe_ingredients
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND is_active
    );

-- Solo admins y canteen pueden insertar
CREATE POLICY "recipe_ingredients_insert_canteen_admin" ON recipe_ingredients
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Solo admins y canteen pueden actualizar
CREATE POLICY "recipe_ingredients_update_canteen_admin" ON recipe_ingredients
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "recipe_ingredients_delete_admin" ON recipe_ingredients
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA MEAL_COMPOSITION_TEMPLATES
-- ============================================================
-- Todos los usuarios autenticados pueden ver plantillas activas
CREATE POLICY "meal_comp_templates_select_authenticated" ON meal_composition_templates
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND is_active
    );

-- Solo admins y canteen pueden insertar
CREATE POLICY "meal_comp_templates_insert_canteen_admin" ON meal_composition_templates
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Solo admins y canteen pueden actualizar
CREATE POLICY "meal_comp_templates_update_canteen_admin" ON meal_composition_templates
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "meal_comp_templates_delete_admin" ON meal_composition_templates
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA MEAL_COMPOSITION_COMPONENTS
-- ============================================================
-- Todos los usuarios autenticados pueden ver componentes activos
CREATE POLICY "meal_comp_components_select_authenticated" ON meal_composition_components
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND is_active
    );

-- Solo admins y canteen pueden insertar
CREATE POLICY "meal_comp_components_insert_canteen_admin" ON meal_composition_components
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Solo admins y canteen pueden actualizar
CREATE POLICY "meal_comp_components_update_canteen_admin" ON meal_composition_components
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "meal_comp_components_delete_admin" ON meal_composition_components
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA MENU_PLAN_CELLS (F.6 ServiceType)
-- ============================================================
-- Todos los usuarios autenticados pueden ver celdas activas
CREATE POLICY "menu_plan_cells_select_authenticated" ON menu_plan_cells
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND is_active
    );

-- Solo admins y canteen pueden insertar
CREATE POLICY "menu_plan_cells_insert_canteen_admin" ON menu_plan_cells
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Solo admins y canteen pueden actualizar
CREATE POLICY "menu_plan_cells_update_canteen_admin" ON menu_plan_cells
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "menu_plan_cells_delete_admin" ON menu_plan_cells
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA STUDENTS
-- ============================================================
-- Admins y canteen ven todos los estudiantes activos
CREATE POLICY "students_select_canteen_admin" ON students
    FOR SELECT USING (
        is_current_user_canteen_admin() AND is_active
    );

-- Padres ven solo sus propios hijos
CREATE POLICY "students_select_parent" ON students
    FOR SELECT USING (
        parent_id = auth.uid() AND is_active
    );

-- Admins y canteen pueden insertar
CREATE POLICY "students_insert_canteen_admin" ON students
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- Admins y canteen pueden actualizar
CREATE POLICY "students_update_canteen_admin" ON students
    FOR UPDATE USING (is_current_user_canteen_admin());

-- Solo admins pueden eliminar (borrado lógico via update)
CREATE POLICY "students_delete_admin" ON students
    FOR DELETE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA TRANSACTIONS
-- ============================================================
-- Padres ven sus propias transacciones
CREATE POLICY "transactions_select_parent" ON transactions
    FOR SELECT USING (parent_id = auth.uid());

-- Admins y canteen ven todas
CREATE POLICY "transactions_select_canteen_admin" ON transactions
    FOR SELECT USING (is_current_user_canteen_admin());

-- Padres crean transacciones (solicitudes de recarga)
CREATE POLICY "transactions_insert_parent" ON transactions
    FOR INSERT WITH CHECK (parent_id = auth.uid());

-- Solo admins pueden aprobar/rechazar
CREATE POLICY "transactions_update_admin" ON transactions
    FOR UPDATE USING (is_current_user_admin());

-- ============================================================
-- POLÍTICAS PARA CONSUMPTIONS
-- ============================================================
-- Padres ven consumos de sus hijos
CREATE POLICY "consumptions_select_parent" ON consumptions
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = auth.uid()
        )
    );

-- Admins y canteen ven todos
CREATE POLICY "consumptions_select_canteen_admin" ON consumptions
    FOR SELECT USING (is_current_user_canteen_admin());

-- Canteen registra consumos
CREATE POLICY "consumptions_insert_canteen" ON consumptions
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- ============================================================
-- POLÍTICAS PARA IMPORT_BATCHES
-- ============================================================
-- Admins y canteen gestionan importaciones
CREATE POLICY "import_batches_select_canteen_admin" ON import_batches
    FOR SELECT USING (is_current_user_canteen_admin());

CREATE POLICY "import_batches_insert_canteen_admin" ON import_batches
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

CREATE POLICY "import_batches_update_canteen_admin" ON import_batches
    FOR UPDATE USING (is_current_user_canteen_admin());

-- ============================================================
-- POLÍTICAS PARA IMPORTED_ROWS
-- ============================================================
-- Admins y canteen ven filas importadas
CREATE POLICY "imported_rows_select_canteen_admin" ON imported_rows
    FOR SELECT USING (is_current_user_canteen_admin());

-- Sistema inserta filas durante importación (via service role o canteen/admin)
CREATE POLICY "imported_rows_insert_canteen_admin" ON imported_rows
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- ============================================================
-- POLÍTICAS PARA IMPORT_AUDIT_LOGS
-- ============================================================
-- Admins y canteen ven logs de auditoría
CREATE POLICY "import_audit_logs_select_canteen_admin" ON import_audit_logs
    FOR SELECT USING (is_current_user_canteen_admin());

-- Sistema inserta logs durante importación
CREATE POLICY "import_audit_logs_insert_canteen_admin" ON import_audit_logs
    FOR INSERT WITH CHECK (is_current_user_canteen_admin());

-- ============================================================
-- POLÍTICA ESPECIAL: Service Role (para migraciones y admin backend)
-- ============================================================
-- El service role bypassa RLS automáticamente en Supabase.
-- No se necesitan políticas explícitas para service_role.

-- Comentarios finales
COMMENT ON FUNCTION current_user_role() IS 'Obtiene el rol del usuario actual desde public.users';
COMMENT ON FUNCTION is_current_user_admin() IS 'Verifica si el usuario actual es admin';
COMMENT ON FUNCTION is_current_user_canteen_admin() IS 'Verifica si el usuario actual es canteen o admin';
COMMENT ON FUNCTION is_current_user_parent() IS 'Verifica si el usuario actual es parent';