-- Migración 001: Esquema inicial para Lunch v2 (Single-Tenant F.1)
-- 13 tablas core con precisión monetaria (F.2, F.7), tipos de servicio (F.6), y auditoría completa

-- 1. USUARIOS PÚBLICOS (perfil sincronizado desde auth.users via trigger)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'parent', 'canteen')) DEFAULT 'parent',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Perfiles de usuario sincronizados desde auth.users - Single-tenant F.1';

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Trigger para sincronizar perfil al crear usuario en auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'parent')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. INGREDIENTES (F.2 Money migration, F.7 precisión sub-centavo)
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    product TEXT NOT NULL,
    presentation TEXT NOT NULL,
    cost_cents INTEGER NOT NULL, -- Money en centavos enteros
    purchase_unit_cost_raw NUMERIC(12,6), -- Precisión sub-centavo (ej. 0.007234 USD/g)
    source_formula TEXT, -- Fórmula Excel original (ej. "=C5/D5")
    status TEXT NOT NULL CHECK (status IN ('ACTIVO', 'INACTIVO')) DEFAULT 'ACTIVO',
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ingredients IS 'Catálogo de ingredientes con costo en centavos y precisión sub-centavo - F.2, F.7';

CREATE INDEX idx_ingredients_category ON ingredients(category);
CREATE INDEX idx_ingredients_is_active ON ingredients(is_active);
CREATE INDEX idx_ingredients_code ON ingredients(code);

-- 3. PLATOS (Dishes)
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('Sopa', 'Proteína', 'Guarnición', 'Ensalada', 'Bebida Fría', 'Postre', 'Fruta')),
    description TEXT NOT NULL DEFAULT '',
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dishes IS 'Platos del menú';

CREATE INDEX idx_dishes_category ON dishes(category);
CREATE INDEX idx_dishes_is_active ON dishes(is_active);
CREATE INDEX idx_dishes_name ON dishes(name);

-- 4. RECETAS DE PLATOS (Dish Recipes - F.6 ServiceType, F.7 precisión)
CREATE TABLE dish_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- Origen de la receta (ej. "COSTEO RECETAS")
    service_type TEXT NOT NULL CHECK (service_type IN ('lunch', 'breakfast', 'snack')), -- F.6
    portions INTEGER, -- Número de porciones que rinde
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dish_id)
);

COMMENT ON TABLE dish_recipes IS 'Recetas de platos con tipo de servicio - F.6';

CREATE INDEX idx_dish_recipes_dish_id ON dish_recipes(dish_id);
CREATE INDEX idx_dish_recipes_service_type ON dish_recipes(service_type);
CREATE INDEX idx_dish_recipes_is_active ON dish_recipes(is_active);

-- 5. INGREDIENTES DE RECETA (Recipe Ingredients - F.7 precisión sub-centavo)
CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES dish_recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL, -- Referencia opcional a catálogo
    name TEXT NOT NULL, -- Nombre del ingrediente en la receta
    purchase_presentation TEXT NOT NULL,
    purchase_price_cents INTEGER NOT NULL, -- PVP presentación completa en centavos
    purchase_quantity NUMERIC(12,3) NOT NULL, -- Cantidad de compra (permite decimales)
    recipe_quantity NUMERIC(12,3) NOT NULL, -- Cantidad usada en la receta
    purchase_unit_cost_raw NUMERIC(12,6), -- Precisión sub-centavo (ej. 0.007234)
    source_formula TEXT, -- Fórmula Excel original
    source_cell TEXT, -- Celda Excel origen (ej. "E5")
    yield_percentage NUMERIC(5,4), -- Merma: fracción aprovechable (0.8 = 80%)
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE recipe_ingredients IS 'Ingredientes de recetas con precisión sub-centavo - F.7';

CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_recipe_ingredients_is_active ON recipe_ingredients(is_active);

-- 6. PLANTILLAS DE COMPOSICIÓN DE COMIDA (Meal Composition Templates)
CREATE TABLE meal_composition_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    service_type TEXT NOT NULL CHECK (service_type IN ('lunch', 'breakfast', 'snack')), -- F.6
    target_total_cost_cents INTEGER, -- Costo objetivo total en centavos
    calculated_total_cost_cents INTEGER, -- Costo calculado total en centavos
    tolerance_cents INTEGER DEFAULT 1, -- Tolerancia en centavos
    aliases TEXT[], -- Nombres alternativos
    provenance JSONB, -- Metadatos de importación
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE meal_composition_templates IS 'Plantillas de composición de comida (ej. Almuerzo Saludable Estudiantil)';

CREATE INDEX idx_meal_comp_templates_service_type ON meal_composition_templates(service_type);
CREATE INDEX idx_meal_comp_templates_is_active ON meal_composition_templates(is_active);
CREATE INDEX idx_meal_comp_templates_name ON meal_composition_templates(name);

-- 7. COMPONENTES DE COMPOSICIÓN (Meal Composition Components - F.7 precisión)
CREATE TABLE meal_composition_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES meal_composition_templates(id) ON DELETE CASCADE,
    component_type TEXT NOT NULL CHECK (component_type IN (
        'PROTEINA', 'GUARNICION', 'ARROZ', 'ENSALADA', 'FRUTA',
        'SOPA', 'POSTRE', 'SALSAS', 'JUGO'
    )),
    name TEXT NOT NULL,
    standard_quantity NUMERIC(12,3),
    unit TEXT CHECK (unit IN ('g', 'kg', 'ml', 'l', 'un', 'lb', 'oz')),
    net_quantity_per_portion NUMERIC(12,3),
    reference_unit_cost_cents INTEGER, -- Costo unitario referencia en centavos
    reference_unit_cost_raw NUMERIC(12,6), -- Precisión sub-centavo - F.7
    source_formula TEXT, -- Fórmula Excel original - F.7
    source_cell TEXT, -- Celda Excel origen - F.7
    target_portion_cost_cents INTEGER, -- Costo objetivo por porción en centavos
    calculated_cost_cents INTEGER, -- Costo calculado en centavos
    yield_percentage NUMERIC(5,4),
    merma_percentage NUMERIC(5,4),
    aliases TEXT[],
    provenance JSONB,
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE meal_composition_components IS 'Componentes de plantillas de composición con precisión sub-centavo - F.7';

CREATE INDEX idx_meal_comp_components_template_id ON meal_composition_components(template_id);
CREATE INDEX idx_meal_comp_components_is_active ON meal_composition_components(is_active);

-- 8. CELDAS DEL PLAN DE MENÚ (Menu Plan Cells - F.6 ServiceType)
CREATE TABLE menu_plan_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start_date DATE NOT NULL, -- Lunes de la semana (YYYY-MM-DD local)
    day TEXT NOT NULL CHECK (day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
    category TEXT NOT NULL CHECK (category IN ('Sopa', 'Proteína', 'Guarnición', 'Ensalada', 'Bebida Fría', 'Postre', 'Fruta')),
    slot INTEGER NOT NULL CHECK (slot >= 1), -- Slot dentro de la categoría (1, 2, ...)
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('lunch', 'breakfast', 'snack')), -- F.6
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (week_start_date, day, category, slot)
);

COMMENT ON TABLE menu_plan_cells IS 'Celdas del plan de menú semanal con tipo de servicio - F.6';

CREATE INDEX idx_menu_plan_cells_week ON menu_plan_cells(week_start_date);
CREATE INDEX idx_menu_plan_cells_dish_id ON menu_plan_cells(dish_id);
CREATE INDEX idx_menu_plan_cells_is_active ON menu_plan_cells(is_active);
CREATE INDEX idx_menu_plan_cells_service_type ON menu_plan_cells(service_type);

-- 9. ESTUDIANTES (Students)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0, -- Money en centavos
    qr_code TEXT NOT NULL UNIQUE,
    -- Borrado lógico
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE students IS 'Estudiantes vinculados a padre (auth.users)';

CREATE INDEX idx_students_parent_id ON students(parent_id);
CREATE INDEX idx_students_qr_code ON students(qr_code);
CREATE INDEX idx_students_is_active ON students(is_active);
CREATE INDEX idx_students_grade ON students(grade);

-- 10. TRANSACCIONES / PAGOS (Transactions)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL, -- Money en centavos
    receipt_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ
);

COMMENT ON TABLE transactions IS 'Transacciones de recarga de saldo';

CREATE INDEX idx_transactions_student_id ON transactions(student_id);
CREATE INDEX idx_transactions_parent_id ON transactions(parent_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- 11. CONSUMOS (Consumptions)
CREATE TABLE consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    meals INTEGER NOT NULL DEFAULT 1,
    total_cents INTEGER NOT NULL, -- Money en centavos
    source TEXT NOT NULL CHECK (source IN ('qr', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE consumptions IS 'Registros de consumo de almuerzo';

CREATE INDEX idx_consumptions_student_id ON consumptions(student_id);
CREATE INDEX idx_consumptions_created_at ON consumptions(created_at);

-- 12. LOTES DE IMPORTACIÓN (Import Batches)
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'analyzing', 'preview', 'committed', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    warning_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    approved_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    source_format TEXT NOT NULL CHECK (source_format IN ('csv', 'xlsx', 'xls')),
    encoding TEXT,
    source_type TEXT CHECK (source_type IN ('CATALOG', 'RECIPE_COSTING', 'MENU_PLAN', 'MEAL_COMPOSITION')),
    analysis_version TEXT,
    provenance TEXT
);

COMMENT ON TABLE import_batches IS 'Lotes de importación de archivos Excel/CSV';

CREATE INDEX idx_import_batches_status ON import_batches(status);
CREATE INDEX idx_import_batches_file_hash ON import_batches(file_hash);
CREATE INDEX idx_import_batches_source_type ON import_batches(source_type);
CREATE INDEX idx_import_batches_created_at ON import_batches(created_at);

-- 13. FILAS IMPORTADAS (Imported Rows - F.3 batchId obligatorio)
CREATE TABLE imported_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL, -- Índice original en el archivo (0-based)
    sheet_name TEXT, -- Nombre de la hoja de origen
    source_type TEXT NOT NULL CHECK (source_type IN ('CATALOG', 'RECIPE_COSTING', 'MENU_PLAN', 'MEAL_COMPOSITION')),
    raw_data JSONB NOT NULL, -- Datos crudos de la fila
    normalized_data JSONB, -- Datos normalizados tras parsing
    status TEXT NOT NULL CHECK (status IN ('valid', 'warning', 'error')) DEFAULT 'valid',
    error_message TEXT,
    warning_messages TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, row_index)
);

COMMENT ON TABLE imported_rows IS 'Filas individuales importadas con trazabilidad completa - F.3';

CREATE INDEX idx_imported_rows_batch_id ON imported_rows(batch_id);
CREATE INDEX idx_imported_rows_status ON imported_rows(status);
CREATE INDEX idx_imported_rows_source_type ON imported_rows(source_type);

-- 14. AUDITORÍA DE IMPORTACIÓN (Import Audit Logs)
CREATE TABLE import_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL REFERENCES users(id), -- auth.users.id via users
    operator_role TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    format TEXT NOT NULL,
    sheet_name TEXT,
    source_type TEXT CHECK (source_type IN ('CATALOG', 'RECIPE_COSTING', 'MENU_PLAN', 'MEAL_COMPOSITION')),
    analysis_version TEXT,
    total_rows INTEGER NOT NULL,
    valid_rows INTEGER NOT NULL,
    warning_rows INTEGER NOT NULL,
    error_rows INTEGER NOT NULL,
    transformations TEXT[],
    corrections TEXT[],
    approvals TEXT[],
    rejections TEXT[],
    persistence_result TEXT NOT NULL CHECK (persistence_result IN ('pending', 'success', 'partial', 'failed'))
);

COMMENT ON TABLE import_audit_logs IS 'Log de auditoría de importaciones';

CREATE INDEX idx_import_audit_logs_batch_id ON import_audit_logs(batch_id);
CREATE INDEX idx_import_audit_logs_operator_id ON import_audit_logs(operator_id);
CREATE INDEX idx_import_audit_logs_timestamp ON import_audit_logs(timestamp);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dish_recipes_updated_at BEFORE UPDATE ON dish_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meal_comp_templates_updated_at BEFORE UPDATE ON meal_composition_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();