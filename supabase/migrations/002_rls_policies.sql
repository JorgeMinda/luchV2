-- Migración 002: Políticas RLS (Row Level Security) para multi-institución (F.1)
-- Todas las tablas tienen RLS habilitado y políticas basadas en school_id
-- vinculado a auth.users a través de school_users

-- Habilitar RLS en todas las tablas
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_users ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE import_audit_logs ENABLE ROW LEVEL SECURITY;

-- Función auxiliar: obtener school_id del usuario actual
-- Un usuario puede pertenecer a múltiples escuelas; usamos la primera activa
-- o la que coincida con el contexto de la request (header x-school-id en producción)
CREATE OR REPLACE FUNCTION current_user_school_id()
RETURNS UUID AS $$
DECLARE
    v_school_id UUID;
BEGIN
    -- Intenta obtener school_id del header de la request (para APIs)
    -- En Supabase, se puede acceder via current_setting
    BEGIN
        v_school_id := nullif(current_setting('request.header.x-school-id', true), '')::uuid;
        IF v_school_id IS NOT NULL THEN
            -- Verifica que el usuario tenga acceso a esta escuela
            IF EXISTS (
                SELECT 1 FROM school_users
                WHERE user_id = auth.uid() AND school_id = v_school_id AND is_active
            ) THEN
                RETURN v_school_id;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Ignora errores de parsing del header
    END;

    -- Fallback: primera escuela activa del usuario
    SELECT school_id INTO v_school_id
    FROM school_users
    WHERE user_id = auth.uid() AND is_active
    LIMIT 1;

    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función auxiliar: verificar si el usuario es admin de la escuela
CREATE OR REPLACE FUNCTION is_school_admin(p_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM school_users
        WHERE user_id = auth.uid()
          AND school_id = p_school_id
          AND role = 'admin'
          AND is_active
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función auxiliar: verificar si el usuario pertenece a la escuela (cualquier rol)
CREATE OR REPLACE FUNCTION is_school_member(p_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM school_users
        WHERE user_id = auth.uid()
          AND school_id = p_school_id
          AND is_active
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- POLÍTICAS PARA SCHOOLS
-- ============================================================
-- Los admins de escuela pueden ver/editar su escuela
CREATE POLICY "schools_select_admin" ON schools
    FOR SELECT USING (
        id = current_user_school_id() AND is_school_admin(id)
    );

CREATE POLICY "schools_update_admin" ON schools
    FOR UPDATE USING (
        id = current_user_school_id() AND is_school_admin(id)
    );

-- ============================================================
-- POLÍTICAS PARA SCHOOL_USERS
-- ============================================================
-- Admins pueden gestionar usuarios de su escuela
CREATE POLICY "school_users_select_admin" ON school_users
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

CREATE POLICY "school_users_insert_admin" ON school_users
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

CREATE POLICY "school_users_update_admin" ON school_users
    FOR UPDATE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

CREATE POLICY "school_users_delete_admin" ON school_users
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA INGREDIENTS
-- ============================================================
-- Miembros de la escuela pueden ver ingredientes
CREATE POLICY "ingredients_select_member" ON ingredients
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

-- Solo admins y canteen pueden insertar/actualizar
CREATE POLICY "ingredients_insert_canteen_admin" ON ingredients
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = ingredients.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "ingredients_update_canteen_admin" ON ingredients
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = ingredients.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "ingredients_delete_admin" ON ingredients
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA DISHES
-- ============================================================
CREATE POLICY "dishes_select_member" ON dishes
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

CREATE POLICY "dishes_insert_canteen_admin" ON dishes
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = dishes.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "dishes_update_canteen_admin" ON dishes
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = dishes.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "dishes_delete_admin" ON dishes
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA DISH_RECIPES
-- ============================================================
CREATE POLICY "dish_recipes_select_member" ON dish_recipes
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

CREATE POLICY "dish_recipes_insert_canteen_admin" ON dish_recipes
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = dish_recipes.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "dish_recipes_update_canteen_admin" ON dish_recipes
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = dish_recipes.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "dish_recipes_delete_admin" ON dish_recipes
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA RECIPE_INGREDIENTS
-- ============================================================
CREATE POLICY "recipe_ingredients_select_member" ON recipe_ingredients
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

CREATE POLICY "recipe_ingredients_insert_canteen_admin" ON recipe_ingredients
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = recipe_ingredients.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "recipe_ingredients_update_canteen_admin" ON recipe_ingredients
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = recipe_ingredients.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "recipe_ingredients_delete_admin" ON recipe_ingredients
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA MEAL_COMPOSITION_TEMPLATES
-- ============================================================
CREATE POLICY "meal_comp_templates_select_member" ON meal_composition_templates
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

CREATE POLICY "meal_comp_templates_insert_canteen_admin" ON meal_composition_templates
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = meal_composition_templates.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "meal_comp_templates_update_canteen_admin" ON meal_composition_templates
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = meal_composition_templates.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "meal_comp_templates_delete_admin" ON meal_composition_templates
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA MEAL_COMPOSITION_COMPONENTS
-- ============================================================
CREATE POLICY "meal_comp_components_select_member" ON meal_composition_components
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

CREATE POLICY "meal_comp_components_insert_canteen_admin" ON meal_composition_components
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = meal_composition_components.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "meal_comp_components_update_canteen_admin" ON meal_composition_components
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = meal_composition_components.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "meal_comp_components_delete_admin" ON meal_composition_components
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA MENU_PLAN_CELLS (F.6 ServiceType)
-- ============================================================
CREATE POLICY "menu_plan_cells_select_member" ON menu_plan_cells
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

CREATE POLICY "menu_plan_cells_insert_canteen_admin" ON menu_plan_cells
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = menu_plan_cells.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "menu_plan_cells_update_canteen_admin" ON menu_plan_cells
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = menu_plan_cells.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "menu_plan_cells_delete_admin" ON menu_plan_cells
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA STUDENTS
-- ============================================================
-- Miembros pueden ver estudiantes de su escuela
CREATE POLICY "students_select_member" ON students
    FOR SELECT USING (
        school_id = current_user_school_id() AND is_school_member(school_id)
    );

-- Padres solo pueden ver sus propios hijos
CREATE POLICY "students_select_parent" ON students
    FOR SELECT USING (
        parent_id = auth.uid() AND school_id = current_user_school_id()
    );

-- Admins y canteen pueden insertar/actualizar
CREATE POLICY "students_insert_canteen_admin" ON students
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = students.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "students_update_canteen_admin" ON students
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = students.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "students_delete_admin" ON students
    FOR DELETE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA TRANSACTIONS
-- ============================================================
-- Padres pueden ver sus transacciones
CREATE POLICY "transactions_select_parent" ON transactions
    FOR SELECT USING (
        parent_id = auth.uid() AND school_id = current_user_school_id()
    );

-- Admins y canteen ven todas
CREATE POLICY "transactions_select_canteen_admin" ON transactions
    FOR SELECT USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = transactions.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

-- Padres crean transacciones (solicitudes de recarga)
CREATE POLICY "transactions_insert_parent" ON transactions
    FOR INSERT WITH CHECK (
        parent_id = auth.uid() AND school_id = current_user_school_id()
    );

-- Solo admins pueden aprobar/rechazar
CREATE POLICY "transactions_update_admin" ON transactions
    FOR UPDATE USING (
        school_id = current_user_school_id() AND is_school_admin(school_id)
    );

-- ============================================================
-- POLÍTICAS PARA CONSUMPTIONS
-- ============================================================
-- Padres ven consumos de sus hijos
CREATE POLICY "consumptions_select_parent" ON consumptions
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = auth.uid() AND school_id = current_user_school_id()
        )
    );

-- Admins y canteen ven todos
CREATE POLICY "consumptions_select_canteen_admin" ON consumptions
    FOR SELECT USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = consumptions.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

-- Canteen registra consumos
CREATE POLICY "consumptions_insert_canteen" ON consumptions
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = consumptions.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

-- ============================================================
-- POLÍTICAS PARA IMPORT_BATCHES
-- ============================================================
-- Admins y canteen gestionan importaciones
CREATE POLICY "import_batches_select_canteen_admin" ON import_batches
    FOR SELECT USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = import_batches.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "import_batches_insert_canteen_admin" ON import_batches
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = import_batches.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "import_batches_update_canteen_admin" ON import_batches
    FOR UPDATE USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = import_batches.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

-- ============================================================
-- POLÍTICAS PARA IMPORT_AUDIT_LOGS
-- ============================================================
CREATE POLICY "import_audit_logs_select_canteen_admin" ON import_audit_logs
    FOR SELECT USING (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = import_audit_logs.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

CREATE POLICY "import_audit_logs_insert_canteen_admin" ON import_audit_logs
    FOR INSERT WITH CHECK (
        school_id = current_user_school_id() AND
        EXISTS (
            SELECT 1 FROM school_users
            WHERE user_id = auth.uid() AND school_id = import_audit_logs.school_id
              AND role IN ('admin', 'canteen') AND is_active
        )
    );

-- ============================================================
-- POLÍTICA ESPECIAL: Service Role (para migraciones y admin backend)
-- ============================================================
-- El service role bypassa RLS automáticamente en Supabase.
-- No se necesitan políticas explícitas para service_role.

-- Comentarios finales
COMMENT ON FUNCTION current_user_school_id() IS 'Obtiene school_id del usuario actual desde header x-school-id o primera escuela activa';
COMMENT ON FUNCTION is_school_admin(UUID) IS 'Verifica si el usuario actual es admin de la escuela dada';
COMMENT ON FUNCTION is_school_member(UUID) IS 'Verifica si el usuario actual pertenece a la escuela dada (cualquier rol activo)';