-- Migración 001: Esquema inicial para Lunch v2
-- 14 tablas core con soporte multi-institución (F.1) y precisión monetaria (F.2, F.7)

-- 1. ESCUELAS (multi-institución F.1)
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schools IS 'Instituciones educativas (colegios) - F.1 multi-institución';

-- 2. USUARIOS DE ESCUELA (vinculación auth.users -> schools)
CREATE TABLE school_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- auth.users.id
    role TEXT NOT NULL CHECK (role IN ('admin', 'parent', 'canteen')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, user_id)
);

COMMENT ON TABLE school_users IS 'Vincula usuarios de Supabase Auth a escuelas con rol';

-- 3. INGREDIENTES (F.2 Money migration, F.7 precisión sub-centavo)
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    category TEXT NOT NULL,
    product TEXT NOT NULL,
    presentation TEXT NOT NULL,
    cost_cents INTEGER NOT NULL, -- Money en centavos enteros
    purchase_unit_cost_raw NUMERIC(12,6), -- Precisión sub-centavo (ej. 0.007234 USD/g)
    source_formula TEXT, -- Fórmula Excel original (ej. "=C5/D5")
    status TEXT NOT NULL CHECK (status IN ('ACTIVO', 'INACTIVO')) DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, code)
);

COMMENT ON TABLE ingredients IS 'Catálogo de ingredientes con costo en centavos y precisión sub-centavo - F.2, F.7';

CREATE INDEX idx_ingredients_school_id ON ingredients(school_id);
CREATE INDEX idx_ingredients_category ON ingredients(school_id, category);

-- 4. PLATOS (Dishes)
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Sopa', 'Proteína', 'Guarnición', 'Ensalada', 'Bebida Fría', 'Postre', 'Fruta')),
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);

COMMENT ON TABLE dishes IS 'Platos del menú';

CREATE INDEX idx_dishes_school_id ON dishes(school_id);
CREATE INDEX idx_dishes_category ON dishes(school_id, category);

-- 5. RECETAS DE PLATOS (Dish Recipes - F.6 ServiceType, F.7 precisión)
CREATE TABLE dish_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- Origen de la receta (ej. "COSTEO RECETAS")
    service_type TEXT NOT NULL CHECK (service_type IN ('lunch', 'breakfast', 'snack')), -- F.6
    portions INTEGER, -- Número de porciones que rinde
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, dish_id)
);

COMMENT ON TABLE dish_recipes IS 'Recetas de platos con tipo de servicio - F.6';

CREATE INDEX idx_dish_recipes_school_id ON dish_recipes(school_id);
CREATE INDEX idx_dish_recipes_dish_id ON dish_recipes(dish_id);

-- 6. INGREDIENTES DE RECETA (Recipe Ingredients - F.7 precisión sub-centavo)
CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE recipe_ingredients IS 'Ingredientes de recetas con precisión sub-centavo - F.7';

CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_school_id ON recipe_ingredients(school_id);

-- 7. PLANTILLAS DE COMPOSICIÓN DE COMIDA (Meal Composition Templates)
CREATE TABLE meal_composition_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('lunch', 'breakfast', 'snack')), -- F.6
    target_total_cost_cents INTEGER, -- Costo objetivo total en centavos
    calculated_total_cost_cents INTEGER, -- Costo calculado total en centavos
    tolerance_cents INTEGER DEFAULT 1, -- Tolerancia en centavos
    aliases TEXT[], -- Nombres alternativos
    provenance JSONB, -- Metadatos de importación
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);

COMMENT ON TABLE meal_composition_templates IS 'Plantillas de composición de comida (ej. Almuerzo Saludable Estudiantil)';

CREATE INDEX idx_meal_comp_templates_school_id ON meal_composition_templates(school_id);

-- 8. COMPONENTES DE COMPOSICIÓN (Meal Composition Components - F.7 precisión)
CREATE TABLE meal_composition_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE meal_composition_components IS 'Componentes de plantillas de composición con precisión sub-centavo - F.7';

CREATE INDEX idx_meal_comp_components_template_id ON meal_composition_components(template_id);
CREATE INDEX idx_meal_comp_components_school_id ON meal_composition_components(school_id);

-- 9. CELDAS DEL PLAN DE MENÚ (Menu Plan Cells - F.6 ServiceType)
CREATE TABLE menu_plan_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL, -- Lunes de la semana (YYYY-MM-DD local)
    day TEXT NOT NULL CHECK (day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
    category TEXT NOT NULL CHECK (category IN ('Sopa', 'Proteína', 'Guarnición', 'Ensalada', 'Bebida Fría', 'Postre', 'Fruta')),
    slot INTEGER NOT NULL CHECK (slot >= 1), -- Slot dentro de la categoría (1, 2, ...)
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('lunch', 'breakfast', 'snack')), -- F.6
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, week_start_date, day, category, slot)
);

COMMENT ON TABLE menu_plan_cells IS 'Celdas del plan de menú semanal con tipo de servicio - F.6';

CREATE INDEX idx_menu_plan_cells_school_id ON menu_plan_cells(school_id);
CREATE INDEX idx_menu_plan_cells_week ON menu_plan_cells(school_id, week_start_date);
CREATE INDEX idx_menu_plan_cells_dish_id ON menu_plan_cells(dish_id);

-- 10. ESTUDIANTES (Students)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL, -- Referencia a auth.users del padre
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0, -- Money en centavos
    qr_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE students IS 'Estudiantes vinculados a escuela y padre';

CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_parent_id ON students(parent_id);
CREATE INDEX idx_students_qr_code ON students(qr_code);

-- 11. TRANSACCIONES / PAGOS (Transactions)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL, -- auth.users.id del padre
    amount_cents INTEGER NOT NULL, -- Money en centavos
    receipt_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ
);

COMMENT ON TABLE transactions IS 'Transacciones de recarga de saldo';

CREATE INDEX idx_transactions_school_id ON transactions(school_id);
CREATE INDEX idx_transactions_student_id ON transactions(student_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- 12. CONSUMOS (Consumptions)
CREATE TABLE consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    meals INTEGER NOT NULL DEFAULT 1,
    total_cents INTEGER NOT NULL, -- Money en centavos
    source TEXT NOT NULL CHECK (source IN ('qr', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE consumptions IS 'Registros de consumo de almuerzo';

CREATE INDEX idx_consumptions_school_id ON consumptions(school_id);
CREATE INDEX idx_consumptions_student_id ON consumptions(student_id);
CREATE INDEX idx_consumptions_created_at ON consumptions(created_at);

-- 13. LOTES DE IMPORTACIÓN (Import Batches)
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
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

CREATE INDEX idx_import_batches_school_id ON import_batches(school_id);
CREATE INDEX idx_import_batches_status ON import_batches(status);
CREATE INDEX idx_import_batches_file_hash ON import_batches(file_hash);

-- 14. AUDITORÍA DE IMPORTACIÓN (Import Audit Logs)
CREATE TABLE import_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL, -- auth.users.id
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
CREATE INDEX idx_import_audit_logs_school_id ON import_audit_logs(school_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_school_users_updated_at BEFORE UPDATE ON school_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dish_recipes_updated_at BEFORE UPDATE ON dish_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meal_comp_templates_updated_at BEFORE UPDATE ON meal_composition_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();